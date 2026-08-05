import { ArgumentsHost, BadRequestException, HttpStatus, Logger } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

/**
 * Unhandled (non-HttpException) errors used to have their `message` copied
 * straight into the HTTP response, leaking TypeORM/Postgres internals such as
 * table and column names and query fragments to any client that could trigger
 * a 500. The full error must reach the logger (and Sentry) only.
 */
describe('HttpExceptionFilter', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let loggerError: jest.SpyInstance;
  let filter: HttpExceptionFilter;
  let host: ArgumentsHost;

  const lastBody = (): Record<string, unknown> =>
    jsonMock.mock.calls[0][0] as Record<string, unknown>;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    loggerError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    host = {
      switchToHttp: () => ({
        getResponse: () => ({ status: statusMock }),
        getRequest: () => ({ url: '/orders/abc' }),
      }),
    } as unknown as ArgumentsHost;

    filter = new HttpExceptionFilter();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  it('does not leak internal error details in production', () => {
    process.env.NODE_ENV = 'production';

    filter.catch(
      new Error('relation "orders" does not exist -- SELECT o.passenger_id FROM orders o'),
      host,
    );

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(lastBody()).toMatchObject({
      success: false,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
    expect(JSON.stringify(lastBody())).not.toContain('passenger_id');
  });

  it('logs the full error even when the response is redacted', () => {
    process.env.NODE_ENV = 'production';

    filter.catch(new Error('column "secret_column" does not exist'), host);

    expect(loggerError).toHaveBeenCalledWith(
      expect.stringContaining('secret_column'),
      expect.anything(),
    );
  });

  it('surfaces the real message outside production for debugging', () => {
    process.env.NODE_ENV = 'development';

    filter.catch(new Error('boom in dev'), host);

    expect(lastBody()).toMatchObject({ message: 'boom in dev' });
  });

  it('still returns the HttpException message untouched', () => {
    process.env.NODE_ENV = 'production';

    filter.catch(new BadRequestException('Phone number is invalid'), host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(lastBody()).toMatchObject({ message: 'Phone number is invalid' });
  });
});
