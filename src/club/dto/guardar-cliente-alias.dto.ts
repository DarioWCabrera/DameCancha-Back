import { IsString, MaxLength, MinLength } from 'class-validator';

export class GuardarClienteAliasDto {
  @IsString()
  @MinLength(1, {
    message: 'El alias no puede estar vacío.',
  })
  @MaxLength(120, {
    message: 'El alias no puede superar los 120 caracteres.',
  })
  alias!: string;
}