import { ConfigService } from '@nestjs/config';
import { SavedCardsService, MAX_SAVED_CARDS } from './saved-cards.service';
import { decryptCardToken } from './card-token-crypto';
import { detectCardBrand, formatMaskedPan } from './card-brand';

const KEY = 'c'.repeat(64);

function makeConfig(over: Record<string, string> = {}): ConfigService {
  const values: Record<string, string> = { SAVED_CARDS_ENABLED: 'true', CARD_TOKEN_ENCRYPTION_KEY: KEY, ...over };
  return { get: jest.fn((k: string, d?: string) => (k in values ? values[k] : d)) } as unknown as ConfigService;
}

function setup(opts: { config?: Record<string, string>; existing?: unknown; activeCount?: number } = {}) {
  const saved: Record<string, unknown>[] = [];
  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(opts.existing ?? null),
  };
  const repo = {
    createQueryBuilder: jest.fn(() => qb),
    count: jest.fn().mockResolvedValue(opts.activeCount ?? 0),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => {
      saved.push(x);
      return { ...x, id: 'card-1', createdAt: new Date('2026-11-11') };
    }),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    increment: jest.fn(),
  };
  const manager = { getRepository: jest.fn(() => repo), query: jest.fn() };
  const dataSource = { transaction: jest.fn(async (fn: (m: unknown) => unknown) => fn(manager)) };
  const payme = {
    isConfigured: jest.fn().mockReturnValue(true),
    publicMerchantId: 'mid',
    apiUrl: 'https://checkout.test.paycom.uz/api',
    checkCard: jest.fn().mockResolvedValue({
      ok: true,
      value: { maskedPan: '860006******6311', expiry: '03/99', verified: true, recurrent: true },
    }),
    removeCard: jest.fn().mockResolvedValue({ ok: true, value: true }),
  };
  const service = new SavedCardsService(repo as never, payme as never, makeConfig(opts.config), dataSource as never);
  return { service, repo, qb, payme, saved, manager };
}

describe('SavedCardsService', () => {
  describe('feature flag', () => {
    it('is off unless flag, Payme keys and a valid encryption key are all present', () => {
      expect(setup().service.isEnabled()).toBe(true);
      expect(setup({ config: { SAVED_CARDS_ENABLED: 'false' } }).service.isEnabled()).toBe(false);
      expect(setup({ config: { CARD_TOKEN_ENCRYPTION_KEY: 'bad' } }).service.isEnabled()).toBe(false);
      const noKeys = setup();
      noKeys.payme.isConfigured.mockReturnValue(false);
      expect(noKeys.service.isEnabled()).toBe(false);
    });

    it('availability exposes only public values', () => {
      expect(setup().service.availability()).toEqual({
        enabled: true,
        provider: 'payme',
        merchantId: 'mid',
        apiUrl: 'https://checkout.test.paycom.uz/api',
      });
      expect(setup({ config: { SAVED_CARDS_ENABLED: 'false' } }).service.availability()).toEqual({
        enabled: false,
        provider: null,
        merchantId: null,
        apiUrl: null,
      });
    });

    it('rejects adding a card while disabled, without calling Payme', async () => {
      const { service, payme } = setup({ config: { SAVED_CARDS_ENABLED: 'false' } });
      await expect(service.add('u1', 'token-123456')).rejects.toMatchObject({
        response: { code: 'SAVED_CARDS_UNAVAILABLE' },
      });
      expect(payme.checkCard).not.toHaveBeenCalled();
    });
  });

  describe('add', () => {
    it('stores only an encrypted token and a mask; first card becomes default', async () => {
      const { service, saved } = setup();
      const view = await service.add('u1', 'token-123456');
      expect(view).toMatchObject({ maskedPan: '8600 **** **** 6311', cardBrand: 'uzcard', isDefault: true });
      expect(view).not.toHaveProperty('encryptedToken');
      const row = saved[0];
      expect(row.encryptedToken).not.toContain('token-123456');
      expect(decryptCardToken(row.encryptedToken as string, KEY)).toBe('token-123456');
    });

    it('rejects a token Payme has not verified for recurring payments', async () => {
      const { service, payme } = setup();
      payme.checkCard.mockResolvedValue({
        ok: true,
        value: { maskedPan: '8600', expiry: null, verified: false, recurrent: true },
      });
      await expect(service.add('u1', 'token-123456')).rejects.toMatchObject({
        response: { code: 'SAVED_CARD_INVALID', details: { reason: 'not_verified' } },
      });
    });

    it('rejects a token Payme does not recognise', async () => {
      const { service, payme } = setup();
      payme.checkCard.mockResolvedValue({ ok: false, ambiguous: false, reason: 'payme_-31400' });
      await expect(service.add('u1', 'token-123456')).rejects.toMatchObject({
        response: { code: 'SAVED_CARD_INVALID' },
      });
    });

    it('returns the existing card instead of a duplicate', async () => {
      const existing = { id: 'old', provider: 'payme', maskedPan: 'x', cardBrand: 'humo', isDefault: true };
      const { service, repo } = setup({ existing });
      await expect(service.add('u1', 'token-123456')).resolves.toMatchObject({ id: 'old' });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('enforces the per-user card limit', async () => {
      const { service } = setup({ activeCount: MAX_SAVED_CARDS });
      await expect(service.add('u1', 'token-123456')).rejects.toMatchObject({
        response: { code: 'SAVED_CARD_LIMIT' },
      });
    });

    it('later cards are not default', async () => {
      const { service } = setup({ activeCount: 1 });
      await expect(service.add('u1', 'token-123456')).resolves.toMatchObject({ isDefault: false });
    });
  });

  describe('remove / default', () => {
    it("404s another user's card", async () => {
      const { service } = setup({ existing: null });
      await expect(service.remove('u1', 'card-x')).rejects.toMatchObject({
        response: { code: 'SAVED_CARD_NOT_FOUND' },
      });
    });

    it('removing the default card promotes the newest remaining one', async () => {
      const { service, repo, qb } = setup();
      const { encryptCardToken } = jest.requireActual('./card-token-crypto');
      qb.getOne.mockResolvedValue({
        id: 'card-1',
        userId: 'u1',
        isDefault: true,
        encryptedToken: encryptCardToken('tok-abcdef', KEY),
      });
      repo.findOne.mockResolvedValue({ id: 'card-2' });
      await service.remove('u1', 'card-1');
      expect(repo.update).toHaveBeenCalledWith(
        { id: 'card-1' },
        expect.objectContaining({ status: 'removed', isDefault: false }),
      );
      expect(repo.update).toHaveBeenCalledWith({ id: 'card-2' }, { isDefault: true });
    });

    it('deactivates a card after repeated declines', async () => {
      const { service, repo, qb } = setup();
      qb.getOne.mockResolvedValue({ id: 'card-1', userId: 'u1', status: 'active', isDefault: false, failedChargeCount: 3 });
      await expect(service.recordChargeFailure('card-1', 3)).resolves.toEqual({ deactivated: true });
      expect(repo.increment).toHaveBeenCalledWith({ id: 'card-1' }, 'failedChargeCount', 1);
    });

    it('keeps a card below the failure threshold', async () => {
      const { service, qb } = setup();
      qb.getOne.mockResolvedValue({ id: 'card-1', status: 'active', failedChargeCount: 1 });
      await expect(service.recordChargeFailure('card-1', 3)).resolves.toEqual({ deactivated: false });
    });
  });
});

describe('card-brand', () => {
  it.each([
    ['860006******6311', 'uzcard'],
    ['9860 12** **** 0001', 'humo'],
    ['4111********1111', 'visa'],
    ['5500********0004', 'mastercard'],
    ['2221********0000', 'mastercard'],
    ['5614********1234', 'uzcard'],
    ['6200********0000', 'unknown'],
  ])('%s → %s', (pan, brand) => {
    expect(detectCardBrand(pan)).toBe(brand);
  });

  it('formats the mask with only the last four digits', () => {
    expect(formatMaskedPan('860006******6311')).toBe('8600 **** **** 6311');
  });
});
