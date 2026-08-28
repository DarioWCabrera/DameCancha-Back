import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ReservaCobroItemDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999999.99)
  monto!: number;

  @IsIn(['efectivo', 'electronico'])
  metodo_pago!: 'efectivo' | 'electronico';

  /*
    Opcional.
    Se usa cuando el club quiere identificar quién pagó esa parte
    del turno. Ej.: "Juanchi - 7ma".
  */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  participante_nombre?: string;
}

export class RegistrarCobrosReservaDto {
  /*
    Puede haber un solo cobro por el total del turno
    o varios cobros cuando los jugadores pagan por separado.
  */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(22)
  @ValidateNested({ each: true })
  @Type(() => ReservaCobroItemDto)
  cobros!: ReservaCobroItemDto[];
}