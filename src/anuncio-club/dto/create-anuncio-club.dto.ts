import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAnuncioClubDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_club!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  titulo?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(5000)
  contenido!: string;
}