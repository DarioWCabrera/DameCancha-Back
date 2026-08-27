import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const FORMATO_HORA =
  /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

export class CreateTurnoFijoManualDto {
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

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fecha_inicio!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_usuario?: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  nombre_cliente?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono_cliente?: string;
}
