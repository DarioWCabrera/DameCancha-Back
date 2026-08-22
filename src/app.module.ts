import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailerModule } from '@nestjs-modules/mailer';

import { validateEnvironment } from './config/env.validation';
import { createDatabaseOptions } from './config/database.config';
import { ReservaModule } from './reserva/reserva.module';
import { ClubModule } from './club/club.module';
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
import { SolicitudBajaModule } from './solicitud-baja/solicitud-baja.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createDatabaseOptions(config),
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
    MailModule,
    GeorefModule,
    TorneoModule,
    BancoSuplentesModule,
    SolicitudBajaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
