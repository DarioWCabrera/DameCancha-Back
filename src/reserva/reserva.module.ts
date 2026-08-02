import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BloqueoCanchaModule } from '../bloqueo-cancha/bloqueo-cancha.module';
import { ReservaController } from './reserva.controller';
import { ReservaService } from './reserva.service';
import { Reserva } from './entities/reserva.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reserva]),
    BloqueoCanchaModule,
  ],
  controllers: [ReservaController],
  providers: [ReservaService],
})
export class ReservaModule {}
