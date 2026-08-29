import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateReservaManualClubDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_cancha!: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha debe tener el formato YYYY-MM-DD.',
  })
  fecha!: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/, {
    message: 'La hora de inicio no es válida.',
  })
  hora_inicio!: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/, {
    message: 'La hora de fin no es válida.',
  })
  hora_fin!: string;

  /*
    Si el cliente ya está registrado en DameCancha,
    el club puede vincular la reserva a su usuario.
  */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_usuario?: number;

  /*
    Si NO tiene usuario, alcanza con nombre y teléfono.
    El service valida que exista al menos id_usuario o nombre_cliente.
  */
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  nombre_cliente?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono_cliente?: string;
}
