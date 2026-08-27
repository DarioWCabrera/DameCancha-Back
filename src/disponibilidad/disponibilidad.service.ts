import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { CreateDisponibilidadDto } from './dto/create-disponibilidad.dto';
import { UpdateDisponibilidadDto } from './dto/update-disponibilidad.dto';
import { Disponibilidad } from './entities/disponibilidad.entity';

@Injectable()
export class DisponibilidadService {
  constructor(
    @InjectRepository(Disponibilidad)
    private readonly disponibilidadRepository: Repository<Disponibilidad>,
    private readonly dataSource: DataSource,
  ) {}

  private segundosHora(valor: string, permitir24 = false): number {
    const hora = String(valor ?? '').trim();

    if (permitir24 && /^(?:24:00|24:00:00)$/.test(hora)) {
      return 24 * 60 * 60;
    }

    const match = hora.match(
      /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/,
    );

    if (!match) {
      throw new BadRequestException(
        permitir24
          ? 'La hora debe tener formato HH:MM. Como hora final también se permite 24:00.'
          : 'La hora debe tener formato HH:MM.',
      );
    }

    return (
      Number(match[1]) * 60 * 60 +
      Number(match[2]) * 60 +
      Number(match[3] || 0)
    );
  }

  private validateRange(start: string, end: string) {
    const inicio = this.segundosHora(start);
    const fin = this.segundosHora(end, true);

    if (inicio >= fin) {
      throw new BadRequestException(
        'La hora de inicio debe ser anterior a la hora final.',
      );
    }
  }

  create(dto: CreateDisponibilidadDto) {
    this.validateRange(dto.hora_inicio, dto.hora_fin);

    const entity = this.disponibilidadRepository.create({
      dia_semana: dto.dia_semana,
      hora_inicio: dto.hora_inicio,
      hora_fin: dto.hora_fin,
      cancha: { id_cancha: dto.id_cancha } as any,
    });

    return this.disponibilidadRepository.save(entity);
  }

  findAll() {
    return this.disponibilidadRepository.find({ relations: ['cancha'] });
  }

  findOne(id: number) {
    return this.disponibilidadRepository.findOne({
      where: { id_disponibilidad: id },
      relations: ['cancha'],
    });
  }

  findByCancha(idCancha: number) {
    return this.disponibilidadRepository.find({
      where: { cancha: { id_cancha: idCancha } },
      order: { dia_semana: 'ASC', hora_inicio: 'ASC' },
    });
  }

  async replaceForCancha(
    idCancha: number,
    items: { dia_semana: number; hora_inicio: string; hora_fin: string }[],
  ) {
    const normalized = Array.isArray(items) ? items : [];

    for (const item of normalized) {
      if (
        !Number.isInteger(Number(item.dia_semana)) ||
        Number(item.dia_semana) < 0 ||
        Number(item.dia_semana) > 6
      ) {
        throw new BadRequestException(
          'El día de la semana debe estar entre 0 y 6.',
        );
      }

      this.validateRange(item.hora_inicio, item.hora_fin);
    }

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Disponibilidad);

      await repo.delete({
        cancha: { id_cancha: idCancha },
      });

      if (!normalized.length) return [];

      const entities = normalized.map((item) =>
        repo.create({
          dia_semana: Number(item.dia_semana),
          hora_inicio: item.hora_inicio,
          hora_fin: item.hora_fin,
          cancha: { id_cancha: idCancha } as any,
        }),
      );

      return repo.save(entities);
    });
  }

  async update(id: number, dto: UpdateDisponibilidadDto) {
    const entity = await this.disponibilidadRepository.findOne({
      where: { id_disponibilidad: id },
      relations: ['cancha'],
    });

    if (!entity) {
      throw new NotFoundException('Disponibilidad no encontrada.');
    }

    const start = dto.hora_inicio ?? entity.hora_inicio;
    const end = dto.hora_fin ?? entity.hora_fin;

    this.validateRange(start, end);

    if (dto.dia_semana !== undefined) {
      entity.dia_semana = dto.dia_semana;
    }

    if (dto.hora_inicio !== undefined) {
      entity.hora_inicio = dto.hora_inicio;
    }

    if (dto.hora_fin !== undefined) {
      entity.hora_fin = dto.hora_fin;
    }

    if (dto.id_cancha !== undefined) {
      entity.cancha = { id_cancha: dto.id_cancha } as any;
    }

    return this.disponibilidadRepository.save(entity);
  }

  async remove(id: number) {
    const result = await this.disponibilidadRepository.delete({
      id_disponibilidad: id,
    });

    if (!result.affected) {
      throw new NotFoundException('Disponibilidad no encontrada.');
    }

    return {
      message: 'Disponibilidad eliminada correctamente.',
      id_disponibilidad: id,
    };
  }
}
