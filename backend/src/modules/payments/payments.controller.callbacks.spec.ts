import { Reflector } from '@nestjs/core';
import { PaymentsController } from './payments.controller';
import { RAW_RESPONSE_KEY } from '../../common/decorators/raw-response.decorator';
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';

/**
 * Payme/Click callback yo'llari global `{ success, data }` konvertisiz
 * qaytadi (provayder aniq shaklni kutadi), boshqa yo'llar — konvertda.
 */
describe('PaymentsController — merchant callback yo\'llari', () => {
  const reflector = new Reflector();
  const proto = PaymentsController.prototype;

  it.each([
    ['handlePaymeCallback', true],
    ['handleClickCallback', true],
    ['getWallet', undefined],
    ['handleUzcardCallback', undefined],
  ] as const)('%s → RawResponse = %s', (method, expected) => {
    expect(reflector.get(RAW_RESPONSE_KEY, proto[method])).toBe(expected);
  });

  it('Payme javobi interseptordan aynan o\'tadi (JSON-RPC 2.0)', async () => {
    const body = { jsonrpc: '2.0', id: 5, error: { code: -32504, message: { uz: 'a', ru: 'b', en: 'c' } } };
    const ctx = {
      getHandler: () => proto.handlePaymeCallback,
      getClass: () => PaymentsController,
    } as unknown as ExecutionContext;
    const next: CallHandler = { handle: () => of(body) };
    await expect(lastValueFrom(new ResponseInterceptor(reflector).intercept(ctx, next))).resolves.toBe(body);
  });

  it('Payme yo\'li kontrollerdan PaymeMerchantService ga to\'g\'ridan-to\'g\'ri boradi', async () => {
    const payme = { handle: jest.fn(async () => ({ jsonrpc: '2.0', id: 1, result: { allow: true } })) };
    const click = { handle: jest.fn(async () => ({ error: 0 })) };
    const controller = new PaymentsController({} as never, {} as never, payme as never, click as never);
    await expect(controller.handlePaymeCallback({ id: 1 }, 'Basic x')).resolves.toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: { allow: true },
    });
    expect(payme.handle).toHaveBeenCalledWith({ id: 1 }, 'Basic x');
    await controller.handleClickCallback({ action: '0' });
    expect(click.handle).toHaveBeenCalledWith({ action: '0' });
  });
});
