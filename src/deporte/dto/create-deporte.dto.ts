import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateDeporteDto {
  @Transform(({ value }) => String(value || '').trim())
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nombre_deporte!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descripcion_deporte?: string;
}
