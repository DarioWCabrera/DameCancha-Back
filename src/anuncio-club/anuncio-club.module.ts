import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Club } from '../club/entities/club.entity';
import { AnuncioClubController } from './anuncio-club.controller';
import { AnuncioClubService } from './anuncio-club.service';
import { AnuncioClub } from './entities/anuncio-club.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AnuncioClub,
      Club,
    ]),
  ],
  controllers: [AnuncioClubController],
  providers: [AnuncioClubService],
  exports: [AnuncioClubService],
})
export class AnuncioClubModule {}