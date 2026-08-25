import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Club } from '../club/entities/club.entity';
import { Deporte } from '../deporte/entities/deporte.entity';
import { User } from '../user/entities/user.entity';
import { TorneoController } from './torneo.controller';
import { TorneoService } from './torneo.service';
import { Torneo } from './entities/torneo.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Torneo,
      Club,
      Deporte,
      User,
    ]),
  ],
  controllers: [TorneoController],
  providers: [TorneoService],
  exports: [TorneoService],
})
export class TorneoModule {}
