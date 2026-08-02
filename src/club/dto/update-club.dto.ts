import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateClubDto } from './create-club.dto';

export class UpdateClubDto extends PartialType(
  OmitType(CreateClubDto, ['id_dueno', 'logo_club'] as const),
) {
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  servicios_club?: string | null;
}
