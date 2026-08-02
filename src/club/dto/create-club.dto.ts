import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateClubDto {
  @Transform(({ value }) => String(value || '').trim())
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  nombre_club!: string;

  @Transform(({ value }) => String(value || '').trim())
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  direccion_club!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  ciudad_club!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  provincia_club?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cp_club?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono_club?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  descripcion_club?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_dueno!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  logo_club?: string;
}
