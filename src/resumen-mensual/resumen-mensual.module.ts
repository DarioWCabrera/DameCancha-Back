import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Club } from '../club/entities/club.entity';
import { IngresoManualClub } from '../ingreso-manual/entities/ingreso-manual-club.entity';

import { ResumenMensualClub } from './entities/resumen-mensual-club.entity';
import { ResumenMensualCierreService } from './resumen-mensual-cierre.service';
import { ResumenMensualController } from './resumen-mensual.controller';
import { ResumenMensualService } from './resumen-mensual.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ResumenMensualClub,
      Club,
      IngresoManualClub,
    ]),
  ],
  controllers: [ResumenMensualController],
  providers: [
    ResumenMensualService,
    ResumenMensualCierreService,
  ],
  exports: [ResumenMensualService],
})
export class ResumenMensualModule {}