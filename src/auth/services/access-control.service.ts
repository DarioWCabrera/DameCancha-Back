import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { AuthenticatedUser } from '../types/authenticated-user';
import { Club } from '../../club/entities/club.entity';
import { Cancha } from '../../cancha/entities/cancha.entity';
import { Reserva } from '../../reserva/entities/reserva.entity';
import { Disponibilidad } from '../../disponibilidad/entities/disponibilidad.entity';
import { Torneo } from '../../torneo/entities/torneo.entity';

@Injectable()
export class AccessControlService {
  constructor(
    @InjectRepository(Club) private readonly clubRepository: Repository<Club>,
    @InjectRepository(Cancha) private readonly canchaRepository: Repository<Cancha>,
    @InjectRepository(Reserva) private readonly reservaRepository: Repository<Reserva>,
    @InjectRepository(Disponibilidad) private readonly disponibilidadRepository: Repository<Disponibilidad>,
    @InjectRepository(Torneo) private readonly torneoRepository: Repository<Torneo>,
  ) {}

  private isAdmin(user: AuthenticatedUser) {
    return user.tipo === 'admin';
  }

  assertSelfOrAdmin(user: AuthenticatedUser, userId: number) {
    if (!this.isAdmin(user) && Number(user.sub) !== Number(userId)) {
      throw new ForbiddenException('No tenés permiso para acceder a este usuario.');
    }
  }

  async assertCanManageClub(user: AuthenticatedUser, clubId: number) {
    if (this.isAdmin(user)) return;

    const club = await this.clubRepository.findOne({
      where: { id_club: clubId },
      relations: ['dueno'],
    });
    if (!club) throw new NotFoundException('Club no encontrado.');
    if (Number(club.dueno?.id_usuario) !== Number(user.sub)) {
      throw new ForbiddenException('No tenés permiso para administrar este club.');
    }
  }

  async assertCanManageCancha(user: AuthenticatedUser, canchaId: number) {
    if (this.isAdmin(user)) return;

    const cancha = await this.canchaRepository.findOne({
      where: { id_cancha: canchaId },
      relations: ['id_club', 'id_club.dueno'],
    });
    if (!cancha) throw new NotFoundException('Cancha no encontrada.');
    if (Number(cancha.id_club?.dueno?.id_usuario) !== Number(user.sub)) {
      throw new ForbiddenException('No tenés permiso para administrar esta cancha.');
    }
  }

  async assertCanManageDisponibilidad(user: AuthenticatedUser, disponibilidadId: number) {
    if (this.isAdmin(user)) return;
    const item = await this.disponibilidadRepository.findOne({
      where: { id_disponibilidad: disponibilidadId },
      relations: ['cancha', 'cancha.id_club', 'cancha.id_club.dueno'],
    });
    if (!item) throw new NotFoundException('Disponibilidad no encontrada.');
    if (Number(item.cancha?.id_club?.dueno?.id_usuario) !== Number(user.sub)) {
      throw new ForbiddenException('No tenés permiso para administrar esta disponibilidad.');
    }
  }

  async assertCanAccessReserva(user: AuthenticatedUser, reservaId: number) {
    if (this.isAdmin(user)) return;
    const reserva = await this.reservaRepository.findOne({
      where: { id_reserva: reservaId },
      relations: ['usuario', 'cancha', 'cancha.id_club', 'cancha.id_club.dueno'],
    });
    if (!reserva) throw new NotFoundException('Reserva no encontrada.');

    const isOwner = Number(reserva.usuario?.id_usuario) === Number(user.sub);
    const isClubOwner = Number(reserva.cancha?.id_club?.dueno?.id_usuario) === Number(user.sub);
    if (!isOwner && !isClubOwner) {
      throw new ForbiddenException('No tenés permiso para acceder a esta reserva.');
    }
  }

  async assertCanReadReservationsForClub(user: AuthenticatedUser, clubId: number) {
    return this.assertCanManageClub(user, clubId);
  }

  async assertCanManageTorneo(user: AuthenticatedUser, torneoId: number) {
    if (this.isAdmin(user)) return;
    const torneo = await this.torneoRepository.findOne({
      where: { id_torneo: torneoId },
      relations: ['club', 'club.dueno'],
    });
    if (!torneo) throw new NotFoundException('Torneo no encontrado.');
    if (Number(torneo.club?.dueno?.id_usuario) !== Number(user.sub)) {
      throw new ForbiddenException('No tenés permiso para administrar este torneo.');
    }
  }
}
