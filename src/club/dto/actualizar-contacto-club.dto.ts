import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ActualizarContactoClubDto {
  @IsString()
  @MinLength(6, {
    message: 'El teléfono debe tener al menos 6 caracteres.',
  })
  @MaxLength(20, {
    message: 'El teléfono no puede superar los 20 caracteres.',
  })
  @Matches(/^[0-9+\-()\s]+$/, {
    message:
      'El teléfono solo puede contener números, espacios, +, -, ( y ).',
  })
  telefono!: string;

  @IsEmail(
    {},
    {
      message: 'El email ingresado no es válido.',
    },
  )
  @MaxLength(150, {
    message: 'El email no puede superar los 150 caracteres.',
  })
  email!: string;
}
