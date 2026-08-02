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

export class CreateBloqueoCanchaDto {
  @IsInt()
  @Min(1)
  id_cancha!: number;

  @IsDateString()
  fecha!: string;

  @Matches(FORMATO_HORA, {
    message: 'hora_inicio debe tener formato HH:mm o HH:mm:ss.',
  })
  hora_inicio!: string;

  @Matches(FORMATO_HORA, {
    message: 'hora_fin debe tener formato HH:mm o HH:mm:ss.',
  })
  hora_fin!: string;

  @IsEnum(TipoBloqueoCancha)
  tipo!: TipoBloqueoCancha;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  motivo?: string;
}
