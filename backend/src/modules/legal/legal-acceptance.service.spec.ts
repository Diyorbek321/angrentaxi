import { BadRequestException, ConflictException } from '@nestjs/common';
import { UserRole } from '../../database/entities/user.entity';
import { ERROR_CODES } from '../../common/errors/coded-error';
import { LegalAcceptanceService } from './legal-acceptance.service';
import { LEGAL_VERSIONS } from './legal-versions';

type Row = { userId: string; document: string; version: string; acceptedAt: Date };

function setup(rows: Row[] = [], env: Record<string, string> = {}) {
  const repo = {
    find: jest.fn(async ({ where }: { where: { userId: string } }) =>
      rows
        .filter((r) => r.userId === where.userId)
        .sort((a, b) => b.acceptedAt.getTime() - a.acceptedAt.getTime()),
    ),
    count: jest.fn(async ({ where }: { where: Partial<Row> }) =>
      rows.filter((r) => r.userId === where.userId && r.document === where.document && r.version === where.version)
        .length,
    ),
    query: jest.fn(async (..._args: unknown[]): Promise<unknown[]> => []),
  };
  const config = { get: jest.fn((key: string) => env[key]) };
  const service = new LegalAcceptanceService(repo as never, config as never);
  return { service, repo, config };
}

const passenger = { id: 'u-1', role: UserRole.PASSENGER };
const driver = { id: 'd-1', role: UserRole.DRIVER };

describe('LegalAcceptanceService.getStatus', () => {
  it("yangi foydalanuvchi — hammasini qabul qilishi kerak", async () => {
    const { service } = setup();
    const s = await service.getStatus(passenger);
    expect(s.mustAccept).toBe(true);
    expect(s.documents.map((d) => d.document)).toEqual(['terms', 'privacy']);
  });

  it("joriy versiya keyinroq qabul qilingan bo'lsa (eski qator ham bor) — talab yo'q", async () => {
    const { service } = setup([
      { userId: 'u-1', document: 'terms', version: '2000-01-01.1', acceptedAt: new Date('2000-01-01') },
      { userId: 'u-1', document: 'terms', version: LEGAL_VERSIONS.terms.version, acceptedAt: new Date('2026-11-03') },
      { userId: 'u-1', document: 'privacy', version: LEGAL_VERSIONS.privacy.version, acceptedAt: new Date('2026-11-03') },
    ]);
    expect((await service.getStatus(passenger)).mustAccept).toBe(false);
  });
});

describe('LegalAcceptanceService.accept', () => {
  it("joriy versiyani yozadi (takror — e'tiborsiz), IP va user-agent bilan", async () => {
    const { service, repo } = setup();
    await service.accept(passenger, [{ document: 'terms', version: LEGAL_VERSIONS.terms.version }], {
      ip: '10.0.0.1',
      userAgent: 'Dart/3.5',
      source: 'login',
    });
    expect(repo.query).toHaveBeenCalledTimes(1);
    const [sql, params] = repo.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/INSERT INTO "legal_acceptances"/);
    expect(sql).toMatch(/ON CONFLICT .* DO NOTHING/s);
    expect(params).toEqual(['u-1', 'terms', LEGAL_VERSIONS.terms.version, '10.0.0.1', 'Dart/3.5', 'login']);
  });

  it("eskirgan versiya — 409 LEGAL_VERSION_OUTDATED, hech narsa yozilmaydi", async () => {
    const { service, repo } = setup();
    const err = await service
      .accept(passenger, [{ document: 'terms', version: '2000-01-01.1' }], { ip: null, userAgent: null, source: 'sheet' })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toMatchObject({ code: ERROR_CODES.legalVersionOutdated });
    expect(repo.query).not.toHaveBeenCalled();
  });

  it("rolga tegishli bo'lmagan hujjat — 400", async () => {
    const { service, repo } = setup();
    await expect(
      service.accept(
        passenger,
        [{ document: 'driver-terms', version: LEGAL_VERSIONS['driver-terms'].version }],
        { ip: null, userAgent: null, source: 'sheet' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.query).not.toHaveBeenCalled();
  });

  it("uzun user-agent kesiladi (256)", async () => {
    const { service, repo } = setup();
    await service.accept(passenger, [{ document: 'privacy', version: LEGAL_VERSIONS.privacy.version }], {
      ip: null,
      userAgent: 'x'.repeat(1000),
      source: 'sheet',
    });
    const params = repo.query.mock.calls[0][1] as unknown[];
    expect((params[4] as string).length).toBe(256);
  });
});

describe('LegalAcceptanceService.assertDriverTermsAccepted', () => {
  it("qabul qilmagan haydovchi — 400 LEGAL_TERMS_NOT_ACCEPTED", async () => {
    const { service } = setup([], { LEGAL_DRIVER_TERMS_GATE: 'on' });
    const err = await service.assertDriverTermsAccepted(driver.id).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).getResponse()).toMatchObject({
      code: ERROR_CODES.legalTermsNotAccepted,
      details: { document: 'driver-terms', version: LEGAL_VERSIONS['driver-terms'].version },
    });
  });

  it("joriy versiyani qabul qilgan — o'tadi", async () => {
    const { service } = setup(
      [{ userId: 'd-1', document: 'driver-terms', version: LEGAL_VERSIONS['driver-terms'].version, acceptedAt: new Date() }],
      { LEGAL_DRIVER_TERMS_GATE: 'on' },
    );
    await expect(service.assertDriverTermsAccepted('d-1')).resolves.toBeUndefined();
  });

  it.each([[{}], [{ LEGAL_DRIVER_TERMS_GATE: 'off' }], [{ LEGAL_DRIVER_TERMS_GATE: 'yes' }]])(
    "standart o'chiq — faqat aniq `on` yoqadi (eski APK'da rozilik oynasi yo'q): %j",
    async (env) => {
      const { service, repo } = setup([], env as Record<string, string>);
      await expect(service.assertDriverTermsAccepted('d-1')).resolves.toBeUndefined();
      expect(repo.count).not.toHaveBeenCalled();
    },
  );
});

describe('LegalAcceptanceService.summary (admin)', () => {
  it("har hujjat: joriy versiya, versiyalar bo'yicha sonlar va joriy versiyani qabul qilganlar", async () => {
    const { service, repo } = setup();
    repo.query
      .mockResolvedValueOnce([
        { document: 'terms', version: LEGAL_VERSIONS.terms.version, users: '7', last_accepted_at: '2026-11-03T10:00:00Z' },
        { document: 'terms', version: '2000-01-01.1', users: '2', last_accepted_at: '2000-01-01T00:00:00Z' },
      ])
      .mockResolvedValueOnce([
        { role: 'passenger', users: '10' },
        { role: 'driver', users: '4' },
      ]);
    const s = await service.summary();
    const terms = s.documents.find((d) => d.document === 'terms');
    expect(terms).toMatchObject({
      version: LEGAL_VERSIONS.terms.version,
      acceptedCurrent: 7,
      requiredUsers: 10,
      versions: [
        { version: LEGAL_VERSIONS.terms.version, users: 7 },
        { version: '2000-01-01.1', users: 2 },
      ],
    });
    const driverTerms = s.documents.find((d) => d.document === 'driver-terms');
    expect(driverTerms).toMatchObject({ acceptedCurrent: 0, requiredUsers: 4, versions: [] });
    // privacy: yo'lovchi + haydovchi
    expect(s.documents.find((d) => d.document === 'privacy')?.requiredUsers).toBe(14);
  });
});
