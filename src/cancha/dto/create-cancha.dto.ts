import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCanchaDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_club!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_deporte!: number;

  @Transform(({ value }) => String(value || '').trim())
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nombre_cancha!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descripcion_cancha?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  tipo_suelo?: string;

  @IsDefined({
    message: 'El precio de la cancha es obligatorio.',
  })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El precio de la cancha debe ser un número válido.' },
  )
  @Min(0.01, {
    message: 'El precio de la cancha debe ser mayor a $0.',
  })
  @Max(999999999.99)
  precio_por_hora!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  activa?: number;
}