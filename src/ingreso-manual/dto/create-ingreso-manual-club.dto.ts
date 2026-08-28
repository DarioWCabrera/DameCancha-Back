import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import type {
  CategoriaIngresoManualClub,
  MetodoPagoIngresoManualClub,
} from '../entities/ingreso-manual-club.entity';

const CATEGORIAS: CategoriaIngresoManualClub[] = [
  'buffet',
  'alquiler_equipamiento',
  'evento',
  'clase',
  'sponsor',
  'otro',
];

const METODOS_PAGO: MetodoPagoIngresoManualClub[] = [
  'efectivo',
  'electronico',
];

export class CreateIngresoManualClubDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_club!: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fecha debe tener formato YYYY-MM-DD.',
  })
  fecha!: string;

  @IsString()
  @IsIn(CATEGORIAS)
  categoria!: CategoriaIngresoManualClub;

  @IsString()
  @MinLength(2)
  @MaxLength(180)
  concepto!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto!: number;

  @IsString()
  @IsIn(METODOS_PAGO, {
    message: 'metodo_pago debe ser efectivo o electronico.',
  })
  metodo_pago!: MetodoPagoIngresoManualClub;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string | null;
}