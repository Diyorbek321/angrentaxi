import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CardBrand, SavedCard } from '../../../database/entities/saved-card.entity';
import { ERROR_CODES, codedBadRequest, codedNotFound } from '../../../common/errors/coded-error';
import { decryptCardToken, encryptCardToken, fingerprintCardToken, isValidCardTokenKey } from './card-token-crypto';
import { PaymeSubscribeClient } from './payme-subscribe.client';
import { detectCardBrand, formatMaskedPan } from './card-brand';

/** Bitta yo'lovchiga faol kartalar chegarasi. */
export const MAX_SAVED_CARDS = 5;

/** Ilovaga ko'rsatiladigan karta — token HECH QACHON chiqmaydi. */
export interface SavedCardView {
  id: string;
  provider: 'payme' | 'click';
  maskedPan: string;
  cardBrand: CardBrand;
  expiry: string | null;
  isDefault: boolean;
  createdAt: Date;
}

/**
 * Ilova karta bog'lash oynasini ochishdan oldin so'raydi. `enabled: false`
 * bo'lsa — ilova eski oqimni (Payme sahifasi) ko'rsatadi.
 * `merchantId` — ommaviy identifikator (Payme `cards.*` uchun ilovaga kerak).
 */
export interface SavedCardsAvailability {
  enabled: boolean;
  provider: 'payme' | null;
  merchantId: string | null;
  apiUrl: string | null;
}

/** Yechish uchun ichki natija — faqat server ichida. */
export interface ChargeableCard {
  card: SavedCard;
  token: string;
}

function toView(card: SavedCard): SavedCardView {
  return {
    id: card.id,
    provider: card.provider,
    maskedPan: card.maskedPan,
    cardBrand: card.cardBrand,
    expiry: card.expiry,
    isDefault: card.isDefault,
    createdAt: card.createdAt,
  };
}

/**
 * Saqlangan kartalar (docs/specs/saqlangan-kartalar.md v2).
 *
 * Flag: `SAVED_CARDS_ENABLED=true` VA Payme Subscribe kalitlari VA to'g'ri
 * shifrlash kaliti — uchalasi bo'lmasa funksiya butunlay o'chiq (har bir
 * yo'l `savedCardsUnavailable` qaytaradi, avtomatik yechish ishlamaydi).
 */
@Injectable()
export class SavedCardsService {
  private readonly logger = new Logger(SavedCardsService.name);

  constructor(
    @InjectRepository(SavedCard)
    private readonly cards: Repository<SavedCard>,
    private readonly payme: PaymeSubscribeClient,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  private get encryptionKey(): string {
    return this.config.get<string>('CARD_TOKEN_ENCRYPTION_KEY', '') ?? '';
  }

  isEnabled(): boolean {
    return (
      this.config.get<string>('SAVED_CARDS_ENABLED', 'false') === 'true' &&
      this.payme.isConfigured() &&
      isValidCardTokenKey(this.encryptionKey)
    );
  }

  availability(): SavedCardsAvailability {
    if (!this.isEnabled()) return { enabled: false, provider: null, merchantId: null, apiUrl: null };
    return { enabled: true, provider: 'payme', merchantId: this.payme.publicMerchantId, apiUrl: this.payme.apiUrl };
  }

  private assertEnabled(): void {
    if (!this.isEnabled()) {
      throw codedBadRequest(ERROR_CODES.savedCardsUnavailable, 'Saved cards are not available yet');
    }
  }

  async list(userId: string): Promise<SavedCardView[]> {
    const rows = await this.cards.find({
      where: { userId, status: 'active' },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
    return rows.map(toView);
  }

  /**
   * Ilova Payme'da bog'lagan tokenni qabul qiladi. Server tokenga
   * ishonmaydi: `cards.check` bilan tasdiqlangan (`verify`) va takroriy
   * yechishga yaroqli (`recurrent`) ekanini o'zi tekshiradi.
   */
  async add(userId: string, token: string): Promise<SavedCardView> {
    this.assertEnabled();
    const checked = await this.payme.checkCard(token);
    if (!checked.ok) {
      throw codedBadRequest(ERROR_CODES.savedCardInvalid, 'Card could not be verified', {
        details: { reason: checked.reason },
      });
    }
    if (!checked.value.verified || !checked.value.recurrent) {
      throw codedBadRequest(ERROR_CODES.savedCardInvalid, 'Card is not verified for recurring payments', {
        details: { reason: checked.value.verified ? 'not_recurrent' : 'not_verified' },
      });
    }

    const fingerprint = fingerprintCardToken(token);
    const encrypted = encryptCardToken(token, this.encryptionKey);

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(SavedCard);
      await this.lockUserCards(manager, userId);

      const existing = await repo
        .createQueryBuilder('c')
        .where('c.userId = :userId AND c.provider = :provider AND c.status = :status', {
          userId,
          provider: 'payme',
          status: 'active',
        })
        .andWhere('c.tokenFingerprint = :fingerprint', { fingerprint })
        .getOne();
      if (existing) return toView(existing);

      const activeCount = await repo.count({ where: { userId, status: 'active' } });
      if (activeCount >= MAX_SAVED_CARDS) {
        throw codedBadRequest(ERROR_CODES.savedCardLimit, 'Too many saved cards', {
          details: { max: MAX_SAVED_CARDS },
        });
      }

      const saved = await repo.save(
        repo.create({
          userId,
          provider: 'payme',
          encryptedToken: encrypted,
          tokenFingerprint: fingerprint,
          maskedPan: formatMaskedPan(checked.value.maskedPan),
          cardBrand: detectCardBrand(checked.value.maskedPan),
          expiry: checked.value.expiry,
          status: 'active',
          isDefault: activeCount === 0,
          failedChargeCount: 0,
          lastUsedAt: null,
          removedAt: null,
        }),
      );
      return toView(saved);
    });
  }

  async remove(userId: string, cardId: string): Promise<void> {
    const removedToken = await this.dataSource.transaction(async (manager) => {
      await this.lockUserCards(manager, userId);
      const card = await this.findOwnedActive(manager, userId, cardId, true);
      await this.deactivate(manager, card);
      return card.encryptedToken;
    });
    // Payme tomonida ham o'chiramiz — best-effort: bizda karta allaqachon o'chgan.
    this.revokeAtProvider(removedToken);
  }

  async setDefault(userId: string, cardId: string): Promise<SavedCardView> {
    return this.dataSource.transaction(async (manager) => {
      await this.lockUserCards(manager, userId);
      const card = await this.findOwnedActive(manager, userId, cardId, false);
      const repo = manager.getRepository(SavedCard);
      await repo.update({ userId, isDefault: true }, { isDefault: false });
      await repo.update({ id: card.id }, { isDefault: true });
      return toView({ ...card, isDefault: true });
    });
  }

  /** Avtomatik yechish uchun asosiy karta va ochilgan token; yo'q bo'lsa null. */
  async getChargeableCard(userId: string): Promise<ChargeableCard | null> {
    if (!this.isEnabled()) return null;
    const card = await this.cards
      .createQueryBuilder('c')
      .addSelect('c.encryptedToken')
      .where('c.userId = :userId AND c.status = :status AND c.isDefault = true', { userId, status: 'active' })
      .getOne();
    if (!card) return null;
    return { card, token: decryptCardToken(card.encryptedToken, this.encryptionKey) };
  }

  /** Muvaffaqiyatli yechish — hisoblagich nolga, oxirgi ishlatilgan vaqt. */
  async recordChargeSuccess(cardId: string): Promise<void> {
    await this.cards.update({ id: cardId }, { failedChargeCount: 0, lastUsedAt: new Date() });
  }

  /**
   * Aniq rad (mablag' yetmadi, bloklangan) — hisoblagich +1; chegaraga
   * yetsa karta o'chiriladi, keyingi safar yo'lovchi boshqa karta tanlaydi.
   */
  async recordChargeFailure(cardId: string, maxFailures: number): Promise<{ deactivated: boolean }> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(SavedCard);
      await repo.increment({ id: cardId }, 'failedChargeCount', 1);
      const card = await repo
        .createQueryBuilder('c')
        .addSelect('c.encryptedToken')
        .where('c.id = :cardId', { cardId })
        .getOne();
      if (!card || card.status !== 'active' || card.failedChargeCount < maxFailures) {
        return { deactivated: false };
      }
      await this.lockUserCards(manager, card.userId);
      await this.deactivate(manager, card);
      return { deactivated: true };
    });
  }

  /**
   * Bir yo'lovchining karta o'zgarishlari (qo'shish, o'chirish, asosiy qilish,
   * raddan o'chish) navbatga turadi — `uq_saved_cards_one_default` poygada
   * 23505 (500) bermasin.
   */
  private async lockUserCards(manager: EntityManager, userId: string): Promise<void> {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`saved_cards:${userId}`]);
  }

  private async findOwnedActive(
    manager: EntityManager,
    userId: string,
    cardId: string,
    withToken: boolean,
  ): Promise<SavedCard> {
    const qb = manager
      .getRepository(SavedCard)
      .createQueryBuilder('c')
      .where('c.id = :cardId AND c.userId = :userId AND c.status = :status', { cardId, userId, status: 'active' })
      .setLock('pessimistic_write');
    if (withToken) qb.addSelect('c.encryptedToken');
    const card = await qb.getOne();
    if (!card) throw codedNotFound(ERROR_CODES.savedCardNotFound, 'Card not found');
    return card;
  }

  /** O'chiradi va asosiy bo'lsa — eng yangi faol kartani asosiy qiladi. */
  private async deactivate(manager: EntityManager, card: SavedCard): Promise<void> {
    const repo = manager.getRepository(SavedCard);
    await repo.update({ id: card.id }, { status: 'removed', isDefault: false, removedAt: new Date() });
    if (!card.isDefault) return;
    const next = await repo.findOne({
      where: { userId: card.userId, status: 'active' },
      order: { createdAt: 'DESC' },
    });
    if (next) await repo.update({ id: next.id }, { isDefault: true });
  }

  private revokeAtProvider(encryptedToken: string): void {
    let token: string;
    try {
      token = decryptCardToken(encryptedToken, this.encryptionKey);
    } catch (err) {
      this.logger.warn(`Removed card token could not be decrypted for revocation: ${(err as Error).message}`);
      return;
    }
    this.payme
      .removeCard(token)
      .then((res) => {
        if (!res.ok) this.logger.warn(`Payme cards.remove failed: ${res.reason}`);
      })
      .catch((err: unknown) => this.logger.warn(`Payme cards.remove threw: ${String(err)}`));
  }
}
