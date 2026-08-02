import { IsEnum } from 'class-validator';

import { EstadoTorneo } from '../entities/torneo.entity';

export class UpdateEstadoTorneoDto {
  @IsEnum(EstadoTorneo)
  estado!: EstadoTorneo;
}
