import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Cancha } from '../cancha/entities/cancha.entity';
import { Reserva } from '../reserva/entities/reserva.entity';
import { BloqueoCanchaController } from './bloqueo-cancha.controller';
import { BloqueoCanchaService } from './bloqueo-cancha.service';
import { BloqueoCancha } from './entities/bloqueo-cancha.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BloqueoCancha,
      Cancha,
      Reserva,
    ]),
  ],
  controllers: [BloqueoCanchaController],
  providers: [BloqueoCanchaService],
  exports: [BloqueoCanchaService],
})
export class BloqueoCanchaModule {}
