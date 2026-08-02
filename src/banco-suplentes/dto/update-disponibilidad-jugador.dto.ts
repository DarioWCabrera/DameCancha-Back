import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

export class UpdateDisponibilidadJugadorDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_deporte?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  nivel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  modalidad?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  posicion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ciudad?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  dias_disponibles?: string[];

  @IsOptional()
  @Matches(FORMATO_HORA, {
    message: 'hora_desde debe tener formato HH:mm o HH:mm:ss.',
  })
  hora_desde?: string;

  @IsOptional()
  @Matches(FORMATO_HORA, {
    message: 'hora_hasta debe tener formato HH:mm o HH:mm:ss.',
  })
  hora_hasta?: string;

  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  contacto_visible?: boolean;
}
