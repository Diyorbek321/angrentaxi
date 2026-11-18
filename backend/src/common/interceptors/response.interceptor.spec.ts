import { CallHandler, Controller, ExecutionContext, Get } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';
import { RawResponse } from '../decorators/raw-response.decorator';

@Controller()
class SampleController {
  @Get()
  wrapped(): void {}

  @RawResponse()
  @Get()
  raw(): void {}
}

function contextFor(handler: () => void): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => SampleController,
  } as unknown as ExecutionContext;
}

describe('ResponseInterceptor', () => {
  const body = { jsonrpc: '2.0', id: 1, result: { allow: true } };
  const next: CallHandler = { handle: () => of(body) };
  const interceptor = new ResponseInterceptor(new Reflector());

  it('oddiy yo\'lni { success, data } ga o\'raydi', async () => {
    const ctx = contextFor(SampleController.prototype.wrapped);
    await expect(lastValueFrom(interceptor.intercept(ctx, next))).resolves.toEqual({ success: true, data: body });
  });

  it('@RawResponse() yo\'li javobni o\'zgartirmaydi', async () => {
    const ctx = contextFor(SampleController.prototype.raw);
    await expect(lastValueFrom(interceptor.intercept(ctx, next))).resolves.toBe(body);
  });

  it('Reflector berilmasa — avvalgidek o\'raydi', async () => {
    const plain = new ResponseInterceptor();
    const ctx = contextFor(SampleController.prototype.raw);
    await expect(lastValueFrom(plain.intercept(ctx, next))).resolves.toEqual({ success: true, data: body });
  });
});
