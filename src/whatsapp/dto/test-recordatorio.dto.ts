import {
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class TestRecordatorioDto {
  @IsString()
  @Matches(/^\d{8,15}$/, {
    message:
      'to debe contener únicamente números, incluyendo código de país.',
  })
  to!: string;

  @IsString()
  @MaxLength(100)
  nombre!: string;

  @IsString()
  @MaxLength(160)
  club!: string;

  @IsString()
  @MaxLength(30)
  fecha!: string;

  @IsString()
  @MaxLength(50)
  horario!: string;

  @IsString()
  @MaxLength(160)
  cancha!: string;
}