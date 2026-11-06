import { ArgumentsHost, BadRequestException, HttpStatus, Logger, ServiceUnavailableException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

/**
 * Payme Merchant API: javob HAR DOIM HTTP 200 + JSON-RPC 2.0. 200 dan boshqa
 * holat Payme uchun −32400. Shu sababli Payme yo'lidagi istisno (buzilgan
 * JSON, kutilmagan xato) ham `{ jsonrpc, id, error }` bo'lib qaytadi.
 */
describe('HttpExceptionFilter — Payme yo\'li', () => {
  let json: jest.Mock;
  let status: jest.Mock;

  function hostFor(url: string, body?: unknown): ArgumentsHost {
    return {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ url, path: url.split('?')[0], headers: {}, body }),
      }),
    } as unknown as ArgumentsHost;
  }

  beforeEach(() => {
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it("buzilgan JSON — 200 + −32700", () => {
    // body-parser xatosi Nest'da `type: 'entity.parse.failed'` bilan keladi.
    const raw = Object.assign(new SyntaxError('Unexpected token'), { type: 'entity.parse.failed', status: 400 });
    new HttpExceptionFilter().catch(raw, hostFor('/api/v1/payments/payme/callback'));
    expect(status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(json).toHaveBeenCalledWith({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: { uz: "JSON'ni o'qib bo'lmadi", ru: 'Ошибка парсинга JSON', en: 'JSON parse error' },
      },
    });
  });

  it("Nest o'ragan body-parser xatosi (400 BadRequest, JSON xabari) — −32700", () => {
    new HttpExceptionFilter().catch(
      new BadRequestException("Expected property name or '}' in JSON at position 1"),
      hostFor('/api/v1/payments/payme/callback'),
    );
    expect(status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: -32700 }) }));
  });

  it('boshqa istisno — 200 + −32400, so\'rov id si saqlanadi', () => {
    new HttpExceptionFilter().catch(
      new ServiceUnavailableException('maintenance'),
      hostFor('/api/v1/payments/payme/callback', { id: 42, method: 'CheckTransaction' }),
    );
    expect(status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ jsonrpc: '2.0', id: 42, error: expect.objectContaining({ code: -32400 }) }),
    );
  });

  it("boshqa yo'llar — odatiy { success: false } konverti", () => {
    new HttpExceptionFilter().catch(new BadRequestException('x'), hostFor('/api/v1/orders/1'));
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });
});
