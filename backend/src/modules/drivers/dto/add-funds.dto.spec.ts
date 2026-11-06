import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AddFundsDto } from './add-funds.dto';

describe('AddFundsDto — izoh majburiy', () => {
  const errorsFor = async (body: Record<string, unknown>) =>
    validate(plainToInstance(AddFundsDto, body));

  it('izohsiz — xato, o\'zbekcha matn', async () => {
    const errors = await errorsFor({ amount: 50000 });
    const note = errors.find((e) => e.property === 'note');
    expect(note).toBeDefined();
    expect(Object.values(note?.constraints ?? {})).toEqual([
      "Izoh majburiy: balans nima sababdan o'zgarayotganini yozing",
    ]);
  });

  it("faqat bo'shliqlardan iborat izoh — xato", async () => {
    const errors = await errorsFor({ amount: 50000, note: '   ' });
    expect(errors.some((e) => e.property === 'note')).toBe(true);
  });

  it("to'g'ri so'rov o'tadi", async () => {
    expect(await errorsFor({ amount: -1000, note: 'Tuzatish' })).toHaveLength(0);
  });
});
