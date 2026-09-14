import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const NAME_PATTERN =
  /^[\p{L}\p{M}]+(?:[ '\-’][\p{L}\p{M}]+)*$/u;

export class UpdateUserDto {
  @IsOptional()
  @Transform(({ value }) => String(value || '').trim())
  @IsString()
  @MaxLength(100)
  @Matches(NAME_PATTERN, {
    message:
      'El nombre solo puede contener letras, espacios, apóstrofes y guiones.',
  })
  nombre_usuario?: string;

  @IsOptional()
  @Transform(({ value }) => String(value || '').trim())
  @IsString()
  @MaxLength(100)
  @Matches(NAME_PATTERN, {
    message:
      'El apellido solo puede contener letras, espacios, apóstrofes y guiones.',
  })
  apellido_usuario?: string;

  @IsOptional()
  @Transform(({ value }) => String(value || '').trim().toLowerCase())
  @IsEmail()
  @MaxLength(150)
  email_usuario?: string;

  @IsOptional()
  @Transform(({ value }) => String(value || '').replace(/\D/g, ''))
  @IsString()
  @MinLength(7)
  @MaxLength(20)
  dni_usuario?: string;

  @IsOptional()
  @Transform(({ value }) => String(value || '').replace(/\D/g, ''))
  @IsString()
  @MinLength(10)
  @MaxLength(20)
  CUIT_usuario?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono_usuario?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  direccion_usuario?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ciudad_usuario?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  provincia_usuario?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cp_usuario?: string;
}
