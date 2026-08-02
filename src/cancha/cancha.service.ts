import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateCanchaDto } from './dto/create-cancha.dto';
import { UpdateCanchaDto } from './dto/update-cancha.dto';
import { Cancha } from './entities/cancha.entity';

@Injectable()
export class CanchaService {
  constructor(
    @InjectRepository(Cancha)
    private readonly canchaRepository: Repository<Cancha>,
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
    const cancha = this.canchaRepository.create({
      ...rest,
      id_club: { id_club } as Cancha['id_club'],
      id_deporte: { id_deporte } as Cancha['id_deporte'],
      activa: rest.activa ?? 1,
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
