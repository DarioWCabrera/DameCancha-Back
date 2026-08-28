import { Type } from 'class-transformer';
import {
  IsIn,
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

export class UpdateIngresoManualClubDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fecha debe tener formato YYYY-MM-DD.',
  })
  fecha?: string;

  @IsOptional()
  @IsString()
  @IsIn(CATEGORIAS)
  categoria?: CategoriaIngresoManualClub;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  concepto?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto?: number;

  @IsOptional()
  @IsString()
  @IsIn(METODOS_PAGO, {
    message: 'metodo_pago debe ser efectivo o electronico.',
  })
  metodo_pago?: MetodoPagoIngresoManualClub;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string | null;
}