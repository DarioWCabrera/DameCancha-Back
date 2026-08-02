import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { EstadoTorneo } from '../entities/torneo.entity';

export class UpdateTorneoDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  id_deporte?: number;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  descripcion?: string;

  @IsOptional()
  @IsDateString()
  fecha_inicio?: string;

  @IsOptional()
  @IsDateString()
  fecha_fin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  contacto?: string;

  @IsOptional()
  @IsEnum(EstadoTorneo)
  estado?: EstadoTorneo;
}
