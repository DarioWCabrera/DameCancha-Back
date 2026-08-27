import { Type } from 'class-transformer';
import { IsInt, Matches, Max, Min } from 'class-validator';

const FORMATO_HORA_INICIO =
  /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

export class CreateSolicitudTurnoFijoDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_club!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_deporte!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dia_semana!: number;

  @Matches(FORMATO_HORA_INICIO)
  hora_inicio!: string;
}
