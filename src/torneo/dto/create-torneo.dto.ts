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

export class CreateTorneoDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  id_club!: number;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  id_deporte!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(180)
  titulo!: string;

  @IsString()
  @MinLength(10)
  descripcion!: string;

  @IsDateString()
  fecha_inicio!: string;

  @IsDateString()
  fecha_fin!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  contacto?: string;

  @IsOptional()
  @IsEnum(EstadoTorneo)
  estado?: EstadoTorneo;
}
