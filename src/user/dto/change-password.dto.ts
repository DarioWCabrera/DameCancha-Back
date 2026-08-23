import {
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const PASSWORD_PATTERN =
  /^(?=.*[A-Za-zÁÉÍÓÚáéíóúÑñ])(?=.*\d).{8,128}$/;

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @IsString()
  @Matches(PASSWORD_PATTERN, {
    message:
      'La nueva contraseña debe tener entre 8 y 128 caracteres, incluir una letra y un número.',
  })
  @MaxLength(128)
  newPassword!: string;

  @IsString()
  @MinLength(1)
  confirmPassword!: string;
}