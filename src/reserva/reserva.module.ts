import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BloqueoCanchaModule } from '../bloqueo-cancha/bloqueo-cancha.module';
import { MailModule } from '../mail/mail.module';

import { ReservaController } from './reserva.controller';
import { ReservaService } from './reserva.service';

import { Reserva } from './entities/reserva.entity';
import { ReservaCobro } from './entities/reserva-cobro.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Reserva,
      ReservaCobro,
    ]),
    BloqueoCanchaModule,
    MailModule,
  ],
  controllers: [ReservaController],
  providers: [ReservaService],
})
export class ReservaModule {}