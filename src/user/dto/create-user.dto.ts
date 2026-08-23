import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const PASSWORD_PATTERN = /^(?=.*[A-Za-zÁÉÍÓÚáéíóúÑñ])(?=.*\d).{8,128}$/;

export class CreateUserDto {
  @Transform(({ value }) => String(value || '').trim())
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nombre_usuario!: string;

  @Transform(({ value }) => String(value || '').trim())
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  apellido_usuario!: string;

  @Transform(({ value }) => String(value || '').trim().toLowerCase())
  @IsEmail()
  @MaxLength(150)
  email_usuario!: string;

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

  @IsString()
  @Matches(PASSWORD_PATTERN, {
    message: 'La contraseña debe tener entre 8 y 128 caracteres, incluir una letra y un número.',
  })
  password_usuario!: string;

  @IsOptional()
  @Transform(({ value }) => String(value || '').trim())
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

  @IsOptional()
  @IsEnum(['activo', 'inactivo', 'pendiente_aprobacion'])
  estado_usuario?: string;

  @IsOptional()
  @IsEnum(['usuario', 'dueno', 'admin'])
  tipo_usuario?: string;

  @IsOptional()
  canchas_dueno?: unknown[];

  @IsOptional()
@IsString()
recaptchaToken?: string;
}
