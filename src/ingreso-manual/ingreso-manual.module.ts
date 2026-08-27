import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Club } from '../club/entities/club.entity';

import { IngresoManualController } from './ingreso-manual.controller';
import { IngresoManualService } from './ingreso-manual.service';
import { IngresoManualClub } from './entities/ingreso-manual-club.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IngresoManualClub,
      Club,
    ]),
  ],
  controllers: [IngresoManualController],
  providers: [IngresoManualService],
  exports: [IngresoManualService],
})
export class IngresoManualModule {}
