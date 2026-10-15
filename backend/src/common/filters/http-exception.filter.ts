import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { localizeMessage, resolveLanguage } from '../i18n/error-messages';
import {
  PAYME_ERRORS,
  paymeError,
  paymeRequestId,
} from '../../modules/payments/merchant/payme-rpc';

/** Payme Merchant API yo'li — javob har doim HTTP 200 + JSON-RPC 2.0. */
const PAYME_CALLBACK_PATH = /\/payments\/payme\/callback\/?$/;

function isJsonParseError(exception: unknown): boolean {
  // Nest body-parser xatosini 400 BadRequestException ga o'raydi (xabar JSON.parse'niki).
  if (exception instanceof HttpException) {
    return exception.getStatus() === 400 && /JSON/i.test(exception.message);
  }
  return (
    exception instanceof SyntaxError ||
    (typeof exception === 'object' &&
      exception !== null &&
      (exception as { type?: unknown }).type === 'entity.parse.failed')
  );
}

interface ErrorReasonView {
  code: string;
  message: string;
}

interface ErrorResponse {
  success: false;
  message: string;
  statusCode: number;
  timestamp: string;
  path: string;
  /** Mashina o'qiydigan kod (`common/errors/coded-error.ts`) — faqat bor bo'lsa. */
  code?: string;
  /** Masalan huquqiy darvoza sabablari — `message` lari ham tilga o'giriladi. */
  reasons?: ErrorReasonView[];
  details?: Record<string, unknown>;
}

/** Istisno tanasidagi QO'SHIMCHA maydonlar (`codedBadRequest`). Noto'g'ri shakl — e'tiborsiz. */
function codedExtras(resp: Record<string, unknown>): Pick<ErrorResponse, 'code' | 'reasons' | 'details'> {
  const extras: Pick<ErrorResponse, 'code' | 'reasons' | 'details'> = {};
  if (typeof resp['code'] === 'string') extras.code = resp['code'];
  if (Array.isArray(resp['reasons'])) {
    extras.reasons = (resp['reasons'] as unknown[])
      .filter(
        (r): r is ErrorReasonView =>
          typeof r === 'object' &&
          r !== null &&
          typeof (r as ErrorReasonView).code === 'string' &&
          typeof (r as ErrorReasonView).message === 'string',
      )
      .map((r) => ({ code: r.code, message: r.message }));
  }
  const details = resp['details'];
  if (typeof details === 'object' && details !== null && !Array.isArray(details)) {
    extras.details = { ...(details as Record<string, unknown>) };
  }
  return extras;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Payme 200 dan boshqa javobni −32400 deb oladi va `{ success }` konvertini
    // tushunmaydi — Payme yo'lidagi har qanday istisno (buzilgan JSON, texnik
    // ishlar rejimi, kutilmagan xato) JSON-RPC xatosi bo'lib qaytadi.
    if (PAYME_CALLBACK_PATH.test((request.path ?? request.url ?? '').split('?')[0])) {
      const parse = isJsonParseError(exception);
      if (!parse) {
        this.logger.error(
          `Payme callback failed: ${exception instanceof Error ? exception.message : String(exception)}`,
        );
      }
      response
        .status(HttpStatus.OK)
        .json(paymeError(paymeRequestId(request.body), parse ? PAYME_ERRORS.parseError : PAYME_ERRORS.system));
      return;
    }

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let extras: Pick<ErrorResponse, 'code' | 'reasons' | 'details'> = {};

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const resp = exceptionResponse as Record<string, unknown>;
        if (Array.isArray(resp['message'])) {
          message = (resp['message'] as string[]).join('; ');
        } else if (typeof resp['message'] === 'string') {
          message = resp['message'];
        }
        extras = codedExtras(resp);
      }
    } else if (exception instanceof Error) {
      // Never leak internal error details (TypeORM/Postgres messages can carry
      // table/column names and query fragments) to the client in production.
      // The full error goes to the logger (and Sentry) only; outside
      // production the real message is kept to keep debugging cheap.
      this.logger.error(`Unhandled exception: ${exception.message}`, exception.stack);

      if (process.env.NODE_ENV !== 'production') {
        message = exception.message;
      }
    } else {
      this.logger.error(`Unhandled non-Error exception: ${String(exception)}`);
    }

    // Ilova tiliga qarab UZ yoki RU (`common/i18n/error-catalogue.ts`).
    // Lug'atda yo'q xabar o'zgarmaydi.
    const language = resolveLanguage(request.headers?.['accept-language']);
    message = localizeMessage(message, language);
    if (extras.reasons) {
      extras = {
        ...extras,
        reasons: extras.reasons.map((r) => ({ code: r.code, message: localizeMessage(r.message, language) })),
      };
    }

    const errorResponse: ErrorResponse = {
      success: false,
      message,
      statusCode,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...extras,
    };

    response.status(statusCode).json(errorResponse);
  }
}
