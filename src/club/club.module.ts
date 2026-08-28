import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClubService } from './club.service';
import { ClubController } from './club.controller';

import { Club } from './entities/club.entity';
import { ClubClienteAlias } from './entities/club-cliente-alias.entity';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Club,
      User,
      ClubClienteAlias,
    ]),
  ],
  controllers: [ClubController],
  providers: [ClubService],
  exports: [ClubService],
})
export class ClubModule {}