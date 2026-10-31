import 'reflect-metadata';
import { plainToInstance, Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';
import { formBoolean } from './form-boolean.util';

class Probe {
  @Transform(formBoolean)
  @IsBoolean()
  flag: boolean;
}

// Global ValidationPipe bilan bir xil sozlama (main.ts).
const convert = (flag: unknown) =>
  plainToInstance(Probe, { flag }, { enableImplicitConversion: true }).flag;

describe('formBoolean', () => {
  it('keeps "false" false despite implicit conversion', () => {
    expect(convert('false')).toBe(false);
    expect(convert('true')).toBe(true);
  });

  it('passes real booleans through', () => {
    expect(convert(false)).toBe(false);
    expect(convert(true)).toBe(true);
  });
});
