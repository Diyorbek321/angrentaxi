import {
  ArgumentsHost,
  BadRequestException,
  HttpStatus,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';
import { reportException } from '../observability/error-reporting';

jest.mock('../observability/error-reporting', () => ({ reportException: jest.fn() }));

/** Sentry'ga faqat bizning (5xx) xatolar ketadi — mijozning 4xx lari emas. */
describe('HttpExceptionFilter → error reporting', () => {
  const report = reportException as jest.MockedFunction<typeof reportException>;
  let filter: HttpExceptionFilter;

  const hostFor = (url: string): ArgumentsHost =>
    ({
      switchToHttp: () => ({
        getResponse: () => ({ status: () => ({ json: jest.fn() }) }),
        getRequest: () => ({ url, path: url.split('?')[0], method: 'POST', headers: {}, body: {} }),
      }),
    }) as unknown as ArgumentsHost;

  beforeEach(() => {
    report.mockClear();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    filter = new HttpExceptionFilter();
  });

  afterEach(() => jest.restoreAllMocks());

  it('reports an unhandled error with its route', () => {
    const error = new Error('db down');
    filter.catch(error, hostFor('/api/v1/orders'));
    expect(report).toHaveBeenCalledWith(error, {
      method: 'POST',
      path: '/api/v1/orders',
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  });

  it('reports a 5xx HttpException', () => {
    filter.catch(new ServiceUnavailableException(), hostFor('/api/v1/rides'));
    expect(report).toHaveBeenCalledWith(expect.any(ServiceUnavailableException), expect.objectContaining({ statusCode: 503 }));
  });

  it('does not report client errors', () => {
    filter.catch(new BadRequestException('bad'), hostFor('/api/v1/orders'));
    filter.catch(new NotFoundException(), hostFor('/api/v1/orders/x'));
    expect(report).not.toHaveBeenCalled();
  });

  it('reports a Payme callback failure but not a malformed JSON body', () => {
    filter.catch(new Error('boom'), hostFor('/api/v1/payments/payme/callback'));
    expect(report).toHaveBeenCalledTimes(1);
    filter.catch(new SyntaxError('Unexpected token in JSON'), hostFor('/api/v1/payments/payme/callback'));
    expect(report).toHaveBeenCalledTimes(1);
  });
});
