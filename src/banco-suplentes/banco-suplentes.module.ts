import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Deporte } from '../deporte/entities/deporte.entity';
import { User } from '../user/entities/user.entity';
import { BancoSuplentesController } from './banco-suplentes.controller';
import { BancoSuplentesService } from './banco-suplentes.service';
import { DisponibilidadJugador } from './entities/disponibilidad-jugador.entity';
import { SolicitudJugador } from './entities/solicitud-jugador.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DisponibilidadJugador,
      SolicitudJugador,
      User,
      Deporte,
    ]),
  ],
  controllers: [BancoSuplentesController],
  providers: [BancoSuplentesService],
})
export class BancoSuplentesModule {}
