import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './guard/auth.guard';
import { RolesGuard } from './guard/roles.guard';
import { UserModule } from '../user/user.module';
import { MailModule } from '../mail/mail.module';
import { AccessControlService } from './services/access-control.service';
import { Club } from '../club/entities/club.entity';
import { Cancha } from '../cancha/entities/cancha.entity';
import { Reserva } from '../reserva/entities/reserva.entity';
import { Disponibilidad } from '../disponibilidad/entities/disponibilidad.entity';
import { Torneo } from '../torneo/entities/torneo.entity';
import { RateLimitGuard } from '../common/rate-limit/rate-limit.guard';

type JwtExpiresIn = NonNullable<
  JwtModuleOptions['signOptions']
>['expiresIn'];

@Global()
@Module({
  imports: [
    UserModule,
    MailModule,
    TypeOrmModule.forFeature([Club, Cancha, Reserva, Disponibilidad, Torneo]),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (
            config.get<string>('JWT_EXPIRES_IN') || '1d'
          ) as JwtExpiresIn,
          issuer: 'damecancha-api',
          audience: 'damecancha-web',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, RolesGuard, AccessControlService, RateLimitGuard],
  exports: [AuthGuard, RolesGuard, AccessControlService, RateLimitGuard, JwtModule],
})
export class AuthModule {}
