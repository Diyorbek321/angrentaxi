import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RealtimeGateway } from './realtime.gateway';
import { DEFAULT_ACCESS_TTL } from '../auth/token-ttl.util';
import { DriversModule } from '../drivers/drivers.module';
import { UsersModule } from '../users/users.module';
import { SupportModule } from '../support/support.module';
import { Order } from '../../database/entities/order.entity';
import { WsJwtGuard } from '../../common/guards/ws-jwt.guard';

@Module({
  imports: [
    // Order is read directly (not via OrdersQueryService) so the gateway can
    // authorise `join:order` without a circular module dependency.
    TypeOrmModule.forFeature([Order]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        // No 'fallback-secret' default: env validation already makes APP_SECRET
        // required, and a silent fallback would verify realtime tokens against
        // a publicly known key if the variable ever went missing.
        secret: configService.getOrThrow<string>('APP_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_ACCESS_TTL', DEFAULT_ACCESS_TTL),
        },
      }),
      inject: [ConfigService],
    }),
    forwardRef(() => DriversModule),
    UsersModule,
    forwardRef(() => SupportModule),
  ],
  providers: [RealtimeGateway, WsJwtGuard],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
