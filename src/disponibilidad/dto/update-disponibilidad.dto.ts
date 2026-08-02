import { PartialType } from '@nestjs/mapped-types';
import { CreateDisponibilidadDto } from './create-disponibilidad.dto';

export class UpdateDisponibilidadDto extends PartialType(CreateDisponibilidadDto) {}
