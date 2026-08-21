import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CanchaService } from './cancha.service';
import { CanchaController } from './cancha.controller';
import { Cancha } from './entities/cancha.entity';
import { Club } from '../club/entities/club.entity';
import { Deporte } from '../deporte/entities/deporte.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Cancha, Club, Deporte])],
  controllers: [CanchaController],
  providers: [CanchaService],
})
export class CanchaModule {}
