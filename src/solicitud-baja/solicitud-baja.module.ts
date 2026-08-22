import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SolicitudBajaController } from './solicitud-baja.controller';
import { SolicitudBajaService } from './solicitud-baja.service';
import { SolicitudBaja } from './entities/solicitud-baja.entity';
import { Club } from '../club/entities/club.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SolicitudBaja,
      Club,
    ]),
  ],
  controllers: [SolicitudBajaController],
  providers: [SolicitudBajaService],
  exports: [SolicitudBajaService],
})
export class SolicitudBajaModule {}