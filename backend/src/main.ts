import * as Sentry from '@sentry/node';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { resolveCorsOrigin } from './config/cors-origin.util';

// Init Sentry before app starts
const sentryDsn = process.env.SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Railway (and any reverse proxy) terminates TLS and forwards the real client
  // address in X-Forwarded-For. Without this, req.ip is the proxy's address for
  // every request and the rate limiter would throttle all users as one tracker.
  // Depth 1 = trust exactly one hop, so clients cannot spoof the header.
  app.set('trust proxy', 1);

  // Security middleware
  app.use(helmet());
  app.use(compression());

  // NOTE: uploaded driver KYC documents (passport/licence scans) are NOT served
  // statically. They are only reachable through the authenticated, authorized
  // GET /api/v1/drivers/documents/:id/file endpoint — see
  // DriverDocumentsController. Do not re-add useStaticAssets('uploads') here.

  // CORS
  app.enableCors({
    origin: resolveCorsOrigin(process.env.NODE_ENV, process.env.CORS_ORIGIN),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global filters and interceptors
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Global API prefix
  app.setGlobalPrefix('api/v1');

  // WebSocket adapter
  app.useWebSocketAdapter(new IoAdapter(app));

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Angren Taxi API')
    .setDescription('Production-ready ride-hailing platform API for Angren city')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Users', 'User management')
    .addTag('Drivers', 'Driver management')
    .addTag('Tariffs', 'Tariff management')
    .addTag('Orders', 'Order management')
    .addTag('Payments', 'Payment processing')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`🚀 Angren Taxi API running on: http://localhost:${port}`);
  logger.log(`📖 Swagger docs: http://localhost:${port}/api/docs`);

  // A production server running with the OTP bypass on is a full
  // authentication bypass: every phone number, including staff accounts, logs
  // in with a fixed code. It is still permitted (an internal test server may
  // legitimately run NODE_ENV=production), but it must never pass unnoticed.
  const bypassActive =
    process.env.NODE_ENV === 'production' &&
    process.env.OTP_BYPASS_ENABLED === 'true' &&
    process.env.ALLOW_OTP_BYPASS_IN_PROD === 'true';

  if (bypassActive) {
    logger.error(
      '⚠️  OTP BYPASS IS ACTIVE IN PRODUCTION — any phone number can log in ' +
        'with the fixed bypass code, including admin accounts. Set ' +
        'OTP_BYPASS_ENABLED=false and ALLOW_OTP_BYPASS_IN_PROD=false.',
    );
  }
}

bootstrap();
