import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @Transform(({ value }) => String(value || '').trim())
  @IsString()
  @MaxLength(100)
  nombre_usuario?: string;

  @IsOptional()
  @Transform(({ value }) => String(value || '').trim())
  @IsString()
  @MaxLength(100)
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
