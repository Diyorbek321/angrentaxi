import { BadRequestException, PipeTransform } from '@nestjs/common';

/**
 * Validates an optional enum-valued query parameter.
 *
 * Several list endpoints declared their filter as `@Query('status') status?: SomeStatus`.
 * TypeScript is satisfied, but nothing checks the value at runtime — Nest only runs
 * the global ValidationPipe against DTO classes, not primitives — so an unrecognised
 * value reached the repository and matched nothing. The panel then showed an empty
 * list, which reads as "no data" rather than "bad filter".
 *
 * Absent and empty-string values pass through as `undefined` so that callers sending
 * `?status=` (a cleared dropdown) keep meaning "no filter", exactly as before.
 * Nest's built-in ParseEnumPipe rejects the empty string instead, which would have
 * broken those callers.
 */
export class OptionalEnumPipe<T extends Record<string, string>>
  implements PipeTransform<string | undefined, T[keyof T] | undefined>
{
  private readonly allowed: string[];

  constructor(
    private readonly enumType: T,
    private readonly paramName = 'value',
  ) {
    this.allowed = Object.values(enumType);
  }

  transform(value: string | undefined): T[keyof T] | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (!this.allowed.includes(value)) {
      throw new BadRequestException(
        `Invalid ${this.paramName} "${value}". Must be one of: ${this.allowed.join(', ')}`,
      );
    }

    return value as T[keyof T];
  }
}
