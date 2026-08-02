import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

import { TipoBloqueoCancha } from '../entities/bloqueo-cancha.entity';

const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

export class UpdateBloqueoCanchaDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  id_cancha?: number;

  @IsOptional()
  @IsDateString()
  fecha?: string;

  @IsOptional()
  @Matches(FORMATO_HORA, {
    message: 'hora_inicio debe tener formato HH:mm o HH:mm:ss.',
  })
  hora_inicio?: string;

  @IsOptional()
  @Matches(FORMATO_HORA, {
    message: 'hora_fin debe tener formato HH:mm o HH:mm:ss.',
  })
  hora_fin?: string;

  @IsOptional()
  @IsEnum(TipoBloqueoCancha)
  tipo?: TipoBloqueoCancha;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  motivo?: string;
}
