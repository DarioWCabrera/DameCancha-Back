import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';

const PASSWORD_PATTERN = /^(?=.*[A-Za-zÁÉÍÓÚáéíóúÑñ])(?=.*\d).{8,128}$/;

export class ResetPasswordDto {
  @Transform(({ value }) => String(value || '').trim().toLowerCase())
  @IsEmail()
  @MaxLength(150)
  email!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'El código debe contener 6 dígitos.' })
  code!: string;

  @IsString()
  @Matches(PASSWORD_PATTERN, {
    message: 'La contraseña debe tener entre 8 y 128 caracteres, incluir una letra y un número.',
  })
  newPassword!: string;

  @IsString()
  @MaxLength(128)
  confirmPassword!: string;
}
