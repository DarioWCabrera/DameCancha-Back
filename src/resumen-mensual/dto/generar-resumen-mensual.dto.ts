import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class GenerarResumenMensualDto {
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2200)
  anio!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mes!: number;
}
