import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateClubDto } from './create-club.dto';

export class UpdateClubDto extends PartialType(
  OmitType(CreateClubDto, ['id_dueno', 'logo_club'] as const),
) {
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  servicios_club?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  horas_anticipacion_cancelacion?: number;
}
