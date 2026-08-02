import { IsEnum } from 'class-validator';

import { EstadoDisponibilidadJugador } from '../entities/disponibilidad-jugador.entity';

export class UpdateEstadoDisponibilidadDto {
  @IsEnum(EstadoDisponibilidadJugador)
  estado!: EstadoDisponibilidadJugador;
}
