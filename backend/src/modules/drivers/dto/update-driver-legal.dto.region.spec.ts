import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateDriverLegalDto } from './update-driver-legal.dto';

async function parse(taxiLicenceRegion: unknown) {
  const dto = plainToInstance(UpdateDriverLegalDto, { taxiLicenceRegion });
  const errors = await validate(dto);
  return { value: dto.taxiLicenceRegion, errors: errors.map((e) => e.property) };
}

describe('UpdateDriverLegalDto.taxiLicenceRegion', () => {
  it('kod qabul qilinadi', async () => {
    expect(await parse('UZ-TO')).toEqual({ value: 'UZ-TO', errors: [] });
  });

  it('eski ilovaning erkin matni kodga aylanadi', async () => {
    expect(await parse('Toshkent viloyati')).toEqual({ value: 'UZ-TO', errors: [] });
    expect(await parse('Angren')).toEqual({ value: 'UZ-TO', errors: [] });
  });

  it("null va bo'sh satr — tozalash", async () => {
    expect(await parse(null)).toEqual({ value: null, errors: [] });
    expect(await parse('  ')).toEqual({ value: null, errors: [] });
  });

  it('tanilmagan matn — 400', async () => {
    expect((await parse('Bishkek')).errors).toEqual(['taxiLicenceRegion']);
  });
});
