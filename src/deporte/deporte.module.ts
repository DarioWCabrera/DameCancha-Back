import { Module } from '@nestjs/common';
import { DeporteService } from './deporte.service';
import { DeporteController } from './deporte.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Deporte } from './entities/deporte.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Deporte])],
  controllers: [DeporteController],
  providers: [DeporteService],
})
export class DeporteModule {}
