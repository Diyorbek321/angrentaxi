import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RecordFunnelDto } from './record-funnel.dto';

const errorsFor = async (body: unknown) =>
  (await validate(plainToInstance(RecordFunnelDto, body))).map((e) => e.property);

describe('RecordFunnelDto', () => {
  it("ma'lum ilova va bosqichlar — o'tadi", async () => {
    expect(await errorsFor({ app: 'passenger', steps: ['app_open', 'order_requested'] })).toEqual([]);
  });

  it("noma'lum bosqich yoki ilova — rad etiladi (jadval ixtiyoriy matnga to'lmasin)", async () => {
    expect(await errorsFor({ app: 'passenger', steps: ['app_open', 'drop table'] })).toEqual(['steps']);
    expect(await errorsFor({ app: 'web', steps: ['app_open'] })).toEqual(['app']);
  });

  it("massiv emas yoki juda uzun — rad etiladi", async () => {
    expect(await errorsFor({ app: 'passenger', steps: 'app_open' })).toEqual(['steps']);
    expect(await errorsFor({ app: 'passenger', steps: Array(5).fill('app_open') })).toEqual(['steps']);
  });
});
