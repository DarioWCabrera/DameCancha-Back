import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CanchaService } from './cancha.service';
import { CanchaController } from './cancha.controller';
import { Cancha } from './entities/cancha.entity';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [JwtModule, TypeOrmModule.forFeature([Cancha])],
  controllers: [CanchaController],
  providers: [CanchaService],
})
export class CanchaModule {}
