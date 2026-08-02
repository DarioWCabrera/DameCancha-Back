import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, Matches, Max, Min } from 'class-validator';

const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

export class CreateReservaDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_usuario!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_cancha!: number;

  @IsDateString()
  fecha!: string;

  @Matches(FORMATO_HORA)
  hora_inicio!: string;

  @Matches(FORMATO_HORA)
  hora_fin!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999.99)
  monto_total!: number;

  @IsOptional()
  @IsEnum(['pendiente', 'confirmada', 'cancelada', 'completada'])
  estado?: string;
}
