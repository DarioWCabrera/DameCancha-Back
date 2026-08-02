import {
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

export class CreateSolicitudJugadorDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  mensaje?: string;

  @IsOptional()
  @IsDateString()
  fecha_propuesta?: string;

  @IsOptional()
  @Matches(FORMATO_HORA, {
    message: 'hora_propuesta debe tener formato HH:mm o HH:mm:ss.',
  })
  hora_propuesta?: string;
}
