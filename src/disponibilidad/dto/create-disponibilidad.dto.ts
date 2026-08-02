import { Type } from 'class-transformer';
import { IsInt, Matches, Max, Min } from 'class-validator';

const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

export class CreateDisponibilidadDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_cancha!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dia_semana!: number;

  @Matches(FORMATO_HORA)
  hora_inicio!: string;

  @Matches(FORMATO_HORA)
  hora_fin!: string;
}
