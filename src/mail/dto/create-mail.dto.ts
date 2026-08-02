import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const SUBJECTS = [
  '¡Bienvenido a DameCancha!',
  'Bienvenido a DameCancha!',
  'Club Registrado en DameCancha',
  'Reserva Exitosa',
  'Reserva confirmada',
  'Reserva actualizada',
  'Reserva modificada',
  'Reserva cancelada',
] as const;

export class MailDto {
  @Transform(({ value }) => String(value || '').trim())
  @IsString()
  @MaxLength(150)
  nombre!: string;

  @IsOptional()
  @Transform(({ value }) => String(value || '').trim())
  @IsString()
  @MaxLength(180)
  razonSocial?: string;

  @Transform(({ value }) => String(value || '').trim().toLowerCase())
  @IsEmail()
  @MaxLength(150)
  email!: string;

  @IsString()
  @IsIn(SUBJECTS)
  subject!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fecha debe tener formato YYYY-MM-DD.',
  })
  fecha?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  cancha?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, {
    message: 'hora debe tener formato HH:mm o HH:mm:ss.',
  })
  hora?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  club?: string;
}
