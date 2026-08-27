import { Type } from 'class-transformer';
import { IsInt, Matches, Min } from 'class-validator';

export class AprobarTurnoFijoDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_cancha!: number;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fecha_inicio!: string;
}