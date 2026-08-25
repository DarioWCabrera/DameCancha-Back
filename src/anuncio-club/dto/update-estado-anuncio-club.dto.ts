import { IsBoolean } from 'class-validator';

export class UpdateEstadoAnuncioClubDto {
  @IsBoolean()
  activo!: boolean;
}