import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailerModule } from '@nestjs-modules/mailer';

import { validateEnvironment } from './config/env.validation';
import { ReservaModule } from './reserva/reserva.module';
import { ClubModule } from './club/club.module';
import { PagoModule } from './pago/pago.module';
import { DeporteModule } from './deporte/deporte.module';
import { CanchaModule } from './cancha/cancha.module';
import { DisponibilidadModule } from './disponibilidad/disponibilidad.module';
import { MailModule } from './mail/mail.module';
import { UserModule } from './user/user.module';
import { GeorefModule } from './georef/georef.module';
import { AuthModule } from './auth/auth.module';
import { TorneoModule } from './torneo/torneo.module';
import { BancoSuplentesModule } from './banco-suplentes/banco-suplentes.module';
import { BloqueoCanchaModule } from './bloqueo-cancha/bloqueo-cancha.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql' as const,
        host: config.getOrThrow<string>('DB_HOST'),
        port: config.getOrThrow<number>('DB_PORT'),
        username: config.getOrThrow<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD') || '',
        database: config.getOrThrow<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: config.get<boolean>('DB_SYNC') === true,
        logging: config.get<boolean>('DB_LOGGING') === true,
        timezone: 'Z',
        charset: 'utf8mb4_unicode_ci',
        extra: {
          connectionLimit: 10,
        },
      }),
    }),
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.get<string>('MAIL_HOST'),
          port: Number(config.get<string>('MAIL_PORT') || 587),
          secure: config.get<string>('MAIL_SECURE') === 'true',
          auth:
            config.get<string>('MAIL_USER') && config.get<string>('MAIL_PASS')
              ? {
                  user: config.get<string>('MAIL_USER'),
                  pass: config.get<string>('MAIL_PASS'),
                }
              : undefined,
        },
        defaults: {
          from: config.get<string>('MAIL_FROM'),
        },
      }),
    }),
    AuthModule,
    UserModule,
    ClubModule,
    CanchaModule,
    DeporteModule,
    DisponibilidadModule,
    BloqueoCanchaModule,
    ReservaModule,
    PagoModule,
    MailModule,
    GeorefModule,
    TorneoModule,
    BancoSuplentesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
