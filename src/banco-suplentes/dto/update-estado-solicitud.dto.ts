import { IsEnum } from 'class-validator';

import { EstadoSolicitudJugador } from '../entities/solicitud-jugador.entity';

export class UpdateEstadoSolicitudDto {
  @IsEnum(EstadoSolicitudJugador)
  estado!: EstadoSolicitudJugador;
}
