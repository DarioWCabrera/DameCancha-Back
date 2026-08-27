import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Cancha } from '../cancha/entities/cancha.entity';
import { Club } from '../club/entities/club.entity';
import { Deporte } from '../deporte/entities/deporte.entity';
import { Disponibilidad } from '../disponibilidad/entities/disponibilidad.entity';
import { TurnoFijoController } from './turno-fijo.controller';
import { TurnoFijoService } from './turno-fijo.service';
import { TurnoFijo } from './entities/turno-fijo.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TurnoFijo,
      Club,
      Deporte,
      Cancha,
      Disponibilidad,
    ]),
  ],
  controllers: [TurnoFijoController],
  providers: [TurnoFijoService],
  exports: [TurnoFijoService],
})
export class TurnoFijoModule {}