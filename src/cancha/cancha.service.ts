import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateCanchaDto } from './dto/create-cancha.dto';
import { UpdateCanchaDto } from './dto/update-cancha.dto';
import { Cancha } from './entities/cancha.entity';
import { Club } from '../club/entities/club.entity';
import { Deporte } from '../deporte/entities/deporte.entity';

@Injectable()
export class CanchaService {
  constructor(
    @InjectRepository(Cancha)
    private readonly canchaRepository: Repository<Cancha>,
    @InjectRepository(Club)
    private readonly clubRepository: Repository<Club>,
    @InjectRepository(Deporte)
    private readonly deporteRepository: Repository<Deporte>,
  ) {}

  private normalizarCancha(cancha: Cancha) {
    return {
      ...cancha,
      club: cancha.id_club,
      deporte: cancha.id_deporte,
    };
  }

  async create(createCanchaDto: CreateCanchaDto) {
    const { id_club, id_deporte, ...rest } = createCanchaDto;

    const [club, deporte] = await Promise.all([
      this.clubRepository.findOne({ where: { id_club } }),
      this.deporteRepository.findOne({ where: { id_deporte } }),
    ]);

    if (!club) {
      throw new NotFoundException('Club no encontrado.');
    }

    if (!deporte) {
      throw new BadRequestException('El deporte seleccionado no existe.');
    }

    const cancha = this.canchaRepository.create({
      ...rest,
      id_club: club,
      id_deporte: deporte,
      activa: rest.activa ?? 1,
      // La ubicación de la cancha se hereda del club. El DTO de alta no expone
      // estos campos para evitar inconsistencias entre la dirección del club y
      // sus canchas durante la configuración inicial.
      direccion_cancha: club.direccion_club,
      ciudad_cancha: club.ciudad_club,
      provincia_cancha: club.provincia_club,
      cp_cancha: club.cp_club,
    });

    const guardada = await this.canchaRepository.save(cancha);
    return this.findOne(guardada.id_cancha);
  }

  async findAll() {
    const canchas = await this.canchaRepository.find({
      relations: ['id_club', 'id_deporte'],
      where: { activa: 1 },
      order: { id_cancha: 'ASC' },
    });

    return canchas.map((cancha) => this.normalizarCancha(cancha));
  }

  async findOne(id: number) {
    const cancha = await this.canchaRepository.findOne({
      where: { id_cancha: id },
      relations: ['id_club', 'id_deporte'],
    });

    if (!cancha) throw new NotFoundException('Cancha no encontrada.');
    return this.normalizarCancha(cancha);
  }

  async findByClub(idClub: number) {
    const canchas = await this.canchaRepository
      .createQueryBuilder('cancha')
      .leftJoinAndSelect('cancha.id_club', 'club')
      .leftJoinAndSelect('cancha.id_deporte', 'deporte')
      .where('club.id_club = :idClub', { idClub })
      .andWhere('cancha.activa = :activa', { activa: 1 })
      .orderBy('cancha.id_cancha', 'ASC')
      .getMany();

    return canchas.map((cancha) => this.normalizarCancha(cancha));
  }

  async update(id: number, updateCanchaDto: UpdateCanchaDto) {
    await this.findOne(id);
    const { id_club, id_deporte, ...rest } = updateCanchaDto;

    await this.canchaRepository.update(
      { id_cancha: id },
      {
        ...rest,
        ...(id_club !== undefined
          ? { id_club: { id_club } as Cancha['id_club'] }
          : {}),
        ...(id_deporte !== undefined
          ? { id_deporte: { id_deporte } as Cancha['id_deporte'] }
          : {}),
      },
    );

    return this.findOne(id);
  }

  async remove(id: number) {
    const cancha = await this.canchaRepository.findOne({
      where: { id_cancha: id },
    });
    if (!cancha) throw new NotFoundException('Cancha no encontrada.');

    // Se desactiva en lugar de eliminar para preservar reservas históricas.
    cancha.activa = 0;
    await this.canchaRepository.save(cancha);
    return { message: 'Cancha desactivada correctamente.', id_cancha: id };
  }
}
