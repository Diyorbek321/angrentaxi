import { withHandoverCodes } from './handover-code';

describe('withHandoverCodes', () => {
  const item = (rideId: string | null) => ({
    id: `v-${rideId}`,
    delivery: rideId ? ({ orderId: rideId, handoverCode: null } as never) : null,
  });

  it("faqat faol safar kodini qo'shadi, bitta so'rov", async () => {
    const query = jest.fn(async () => [{ id: 'r1', delivery_pin: '0427' }]);
    const result = await withHandoverCodes(query, [item('r1'), item('r2'), item(null)]);
    expect(query).toHaveBeenCalledTimes(1);
    expect((query.mock.calls[0] as unknown as [string, unknown[]])[1]).toEqual([['r1', 'r2']]);
    expect(result[0].delivery).toMatchObject({ handoverCode: '0427' });
    expect(result[1].delivery).toMatchObject({ handoverCode: null });
    expect(result[2].delivery).toBeNull();
  });

  it("kuryersiz ro'yxatda bazaga murojaat yo'q", async () => {
    const query = jest.fn();
    await withHandoverCodes(query, [item(null)]);
    expect(query).not.toHaveBeenCalled();
  });
});
