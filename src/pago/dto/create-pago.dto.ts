import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreatePagoDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_reserva!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monto!: number;

  @IsEnum(['efectivo', 'tarjeta', 'transferencia', 'mercado_pago'])
  metodo!: string;

  @IsOptional()
  @IsEnum(['pendiente', 'completado', 'rechazado'])
  estado?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  referencia_externa?: string;

  @IsOptional()
  @IsDateString()
  fecha_pago?: string;
}
