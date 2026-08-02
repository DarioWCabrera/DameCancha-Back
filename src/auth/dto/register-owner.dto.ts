import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => String(value ?? '').trim();

export class RegisterOwnerDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nombre!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  apellido!: string;

  @Transform(({ value }) => String(value ?? '').trim().toLowerCase())
  @IsEmail()
  @MaxLength(150)
  email!: string;

  @IsString()
  @Matches(/^(?=.*[A-Za-zÁÉÍÓÚáéíóúÑñ])(?=.*\d).{8,128}$/, {
    message: 'La contraseña debe tener entre 8 y 128 caracteres, incluir una letra y un número.',
  })
  password!: string;

  @Transform(trim)
  @IsString()
  @MinLength(7)
  @MaxLength(20)
  telefono!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  razonSocial!: string;

  @Transform(trim)
  @IsString()
  @Matches(/^\d{2}-?\d{8}-?\d$/, { message: 'CUIT inválido.' })
  CUIT!: string;

  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  direccion!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  ciudad!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  provincia!: string;

  @Transform(trim)
  @IsString()
  @MaxLength(20)
  cp!: string;

  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  canchas!: string;

  @IsOptional()
  @IsString()
  tipo?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  DNI?: string;
}
