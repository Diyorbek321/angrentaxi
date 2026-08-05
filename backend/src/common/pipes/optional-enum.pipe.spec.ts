import { BadRequestException } from '@nestjs/common';
import { OptionalEnumPipe } from './optional-enum.pipe';
import { clampPageSize } from '../utils/pagination.util';

enum Colour {
  RED = 'red',
  BLUE = 'blue',
}

/**
 * Several list endpoints declared their filter as `@Query('status') s?: SomeEnum`.
 * Nest only runs the global ValidationPipe against DTO classes, so nothing
 * checked the value at runtime and an unrecognised filter silently matched no
 * rows.
 */
describe('OptionalEnumPipe', () => {
  const pipe = new OptionalEnumPipe(Colour, 'colour');

  it('passes a valid member through unchanged', () => {
    expect(pipe.transform('red')).toBe(Colour.RED);
  });

  it('rejects a value outside the enum', () => {
    expect(() => pipe.transform('green')).toThrow(BadRequestException);
  });

  it('names the accepted values in the error', () => {
    expect(() => pipe.transform('green')).toThrow(/red, blue/);
  });

  it('treats an absent parameter as "no filter"', () => {
    expect(pipe.transform(undefined)).toBeUndefined();
  });

  it('treats an empty string as "no filter", so a cleared dropdown still works', () => {
    // Nest's built-in ParseEnumPipe rejects '' instead; the panels send exactly
    // that when a filter is reset, so rejecting it would have broken them.
    expect(pipe.transform('')).toBeUndefined();
  });
});

describe('clampPageSize', () => {
  it('falls back to the default when the caller sends nothing', () => {
    expect(clampPageSize(undefined, 50, 100)).toBe(50);
  });

  it('falls back to the default for a nonsensical size', () => {
    expect(clampPageSize(0, 50, 100)).toBe(50);
    expect(clampPageSize(-3, 50, 100)).toBe(50);
    expect(clampPageSize(Number.NaN, 50, 100)).toBe(50);
  });

  it('honours a reasonable explicit size', () => {
    expect(clampPageSize(10, 50, 100)).toBe(10);
  });

  it('clamps rather than letting a caller lift the cap', () => {
    expect(clampPageSize(100000, 50, 100)).toBe(100);
  });
});
