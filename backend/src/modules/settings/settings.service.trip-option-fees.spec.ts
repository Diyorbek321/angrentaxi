import { SettingsService } from './settings.service';

describe('SettingsService — safar opsiyalari haqi', () => {
  function build(stored: unknown) {
    const row = { id: 's1', tripOptionFees: stored };
    const repo = {
      find: jest.fn(async () => [row]),
      update: jest.fn(async () => ({ affected: 1 })),
    };
    return { service: new SettingsService(repo as never), repo };
  }

  it("migratsiyadan keyingi bo'sh sozlama — haq yo'q", async () => {
    const { service } = build({});
    await expect(service.getTripOptionFees()).resolves.toEqual({});
  });

  it("faqat yuborilgan opsiya o'zgaradi, qolganlari saqlanadi", async () => {
    const { service, repo } = build({ child_seat: 5000, pet: 7000 });

    const result = await service.updateTripOptionFees({ pet: 8000, big_luggage: 3000 });

    expect(result).toEqual({ child_seat: 5000, pet: 8000, big_luggage: 3000 });
    expect(repo.update).toHaveBeenCalledWith('s1', { tripOptionFees: result });
  });

  it('0 — opsiya haqini olib tashlaydi', async () => {
    const { service } = build({ child_seat: 5000, pet: 7000 });
    await expect(service.updateTripOptionFees({ pet: 0 })).resolves.toEqual({ child_seat: 5000 });
  });
});
