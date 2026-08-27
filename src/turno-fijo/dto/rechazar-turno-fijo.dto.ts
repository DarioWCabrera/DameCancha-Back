import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const FORMATO_HORA =
  /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

const FORMATO_HORA_FIN =
  /^(?:([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?|24:00(?::00)?)$/;

export class AlternativaTurnoFijoDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dia_semana!: number;

  @Matches(FORMATO_HORA)
  hora_inicio!: string;

  @Matches(FORMATO_HORA_FIN)
  hora_fin!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_cancha?: number;
}

export class RechazarTurnoFijoDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  motivo!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => AlternativaTurnoFijoDto)
  alternativas?: AlternativaTurnoFijoDto[];
}
