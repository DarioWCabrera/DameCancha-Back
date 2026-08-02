import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { CreateReservaDto } from './dto/create-reserva.dto';
import { UpdateReservaDto } from './dto/update-reserva.dto';
import { BloqueoCanchaService } from '../bloqueo-cancha/bloqueo-cancha.service';
import { BloqueoCancha } from '../bloqueo-cancha/entities/bloqueo-cancha.entity';
import { Cancha } from '../cancha/entities/cancha.entity';
import { Reserva } from './entities/reserva.entity';

@Injectable()
export class ReservaService {
  constructor(
    @InjectRepository(Reserva)
    private readonly reservaRepository: Repository<Reserva>,
    private readonly bloqueoCanchaService: BloqueoCanchaService,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  private normalizarUsuario(usuario: Reserva['usuario']) {
    if (!usuario) return null;
    return {
      id_usuario: usuario.id_usuario,
      nombre_usuario: usuario.nombre_usuario,
      apellido_usuario: usuario.apellido_usuario,
      email_usuario: usuario.email_usuario,
      telefono_usuario: usuario.telefono_usuario,
    };
  }

  private normalizarReserva(reserva: Reserva | null) {
    if (!reserva) return null;

    return {
      id_reserva: reserva.id_reserva,
      fecha: reserva.fecha,
      hora_inicio: reserva.hora_inicio,
      hora_fin: reserva.hora_fin,
      monto_total: reserva.monto_total,
      estado: reserva.estado,
      estado_pago: reserva.estado_pago,
      mercado_pago_preference_id: reserva.mercado_pago_preference_id,
      mercado_pago_payment_id: reserva.mercado_pago_payment_id,
      mercado_pago_status: reserva.mercado_pago_status,
      monto_pagado: reserva.monto_pagado,
      fecha_pago: reserva.fecha_pago,
      created_at: reserva.created_at,
      usuario: this.normalizarUsuario(reserva.usuario),
      cancha: reserva.cancha
        ? {
            ...reserva.cancha,
            club: reserva.cancha.id_club,
            deporte: reserva.cancha.id_deporte,
          }
        : null,
    };
  }

  private normalizarHora(hora: string): string {
    const [hours, minutes, seconds = '00'] = String(hora).split(':');
    return `${String(Number(hours)).padStart(2, '0')}:${String(Number(minutes)).padStart(2, '0')}:${String(Number(seconds)).padStart(2, '0')}`;
  }

  private minutos(hora: string): number {
    const [hours, minutes] = this.normalizarHora(hora).split(':').map(Number);
    return hours * 60 + minutes;
  }

  private validarRango(fecha: Date | string, horaInicio: string, horaFin: string) {
    const start = this.minutos(horaInicio);
    const end = this.minutos(horaFin);
    if (start >= end) {
      throw new BadRequestException('La hora de inicio debe ser anterior a la hora final.');
    }

    const date = String(fecha).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('La fecha debe tener formato YYYY-MM-DD.');
    }
  }

  private calcularMonto(cancha: Cancha, horaInicio: string, horaFin: string): number {
    const minutes = this.minutos(horaFin) - this.minutos(horaInicio);
    const hourlyPrice = Number(cancha.precio_por_hora || 0);
    return Math.round(hourlyPrice * (minutes / 60) * 100) / 100;
  }

  private buscarReservaSolapada(
    manager: EntityManager,
    input: {
      idCancha: number;
      fecha: Date | string;
      horaInicio: string;
      horaFin: string;
      excluirId?: number;
    },
  ) {
    const query = manager
      .getRepository(Reserva)
      .createQueryBuilder('reserva')
      .innerJoin('reserva.cancha', 'cancha')
      .where('cancha.id_cancha = :idCancha', { idCancha: input.idCancha })
      .andWhere('reserva.fecha = :fecha', { fecha: String(input.fecha).slice(0, 10) })
      .andWhere('reserva.estado != :estadoCancelado', { estadoCancelado: 'cancelada' })
      .andWhere('reserva.hora_inicio < :horaFin', { horaFin: input.horaFin })
      .andWhere('reserva.hora_fin > :horaInicio', { horaInicio: input.horaInicio });

    if (input.excluirId !== undefined) {
      query.andWhere('reserva.id_reserva != :excluirId', { excluirId: input.excluirId });
    }
    return query.getOne();
  }

  private buscarBloqueoSolapado(
    manager: EntityManager,
    idCancha: number,
    fecha: Date | string,
    horaInicio: string,
    horaFin: string,
  ) {
    return manager
      .getRepository(BloqueoCancha)
      .createQueryBuilder('bloqueo')
      .innerJoin('bloqueo.cancha', 'cancha')
      .where('cancha.id_cancha = :idCancha', { idCancha })
      .andWhere('bloqueo.fecha = :fecha', { fecha: String(fecha).slice(0, 10) })
      .andWhere('bloqueo.activo = 1')
      .andWhere('bloqueo.hora_inicio < :horaFin', { horaFin })
      .andWhere('bloqueo.hora_fin > :horaInicio', { horaInicio })
      .getOne();
  }

  async assertUserCanModify(id: number) {
    const reserva = await this.reservaRepository.findOne({
      where: { id_reserva: id },
    });
    if (!reserva) throw new NotFoundException('Reserva no encontrada.');

    const offset =
      this.configService.get<string>('APP_TIMEZONE_OFFSET') || '-03:00';
    const fecha = String(reserva.fecha).slice(0, 10);
    const hora = this.normalizarHora(reserva.hora_inicio);
    const inicio = new Date(`${fecha}T${hora}${offset}`);

    if (Number.isNaN(inicio.getTime())) {
      throw new BadRequestException('La fecha de la reserva no es válida.');
    }

    const horasRestantes = (inicio.getTime() - Date.now()) / 3_600_000;
    if (horasRestantes < 24) {
      throw new BadRequestException(
        'Las reservas solo pueden modificarse o cancelarse con al menos 24 horas de anticipación.',
      );
    }
  }

  async create(createReservaDto: CreateReservaDto) {
    const fecha = String(createReservaDto.fecha).slice(0, 10);
    const horaInicio = this.normalizarHora(createReservaDto.hora_inicio);
    const horaFin = this.normalizarHora(createReservaDto.hora_fin);
    this.validarRango(fecha, horaInicio, horaFin);

    const savedId = await this.dataSource.transaction(async (manager) => {
      const cancha = await manager
        .getRepository(Cancha)
        .createQueryBuilder('cancha')
        .where('cancha.id_cancha = :idCancha', { idCancha: createReservaDto.id_cancha })
        .andWhere('cancha.activa = 1')
        .setLock('pessimistic_write')
        .getOne();

      if (!cancha) throw new NotFoundException('Cancha no encontrada o inactiva.');

      const reservaExistente = await this.buscarReservaSolapada(manager, {
        idCancha: createReservaDto.id_cancha,
        fecha,
        horaInicio,
        horaFin,
      });
      const bloqueoExistente = await this.buscarBloqueoSolapado(
        manager,
        createReservaDto.id_cancha,
        fecha,
        horaInicio,
        horaFin,
      );

      if (reservaExistente) {
        throw new ConflictException('La cancha ya está reservada para esa fecha y horario.');
      }
      if (bloqueoExistente) {
        throw new ConflictException('La cancha fue bloqueada por el club para esa fecha y horario.');
      }

      const reserva = manager.getRepository(Reserva).create({
        fecha: fecha as any,
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        monto_total: this.calcularMonto(cancha, horaInicio, horaFin),
        estado: createReservaDto.estado || 'pendiente',
        usuario: { id_usuario: createReservaDto.id_usuario } as any,
        cancha: { id_cancha: createReservaDto.id_cancha } as any,
      });

      const saved = await manager.getRepository(Reserva).save(reserva);
      return saved.id_reserva;
    });

    return this.findOne(savedId);
  }

  async findAll() {
    const reservas = await this.reservaRepository.find({
      relations: ['usuario', 'cancha', 'cancha.id_club', 'cancha.id_deporte'],
    });
    return reservas.map((reserva) => this.normalizarReserva(reserva));
  }

  async findByUsuario(idUsuario: number) {
    const reservas = await this.reservaRepository.find({
      where: { usuario: { id_usuario: idUsuario } },
      relations: ['usuario', 'cancha', 'cancha.id_club', 'cancha.id_deporte'],
      order: { fecha: 'DESC', hora_inicio: 'DESC' },
    });
    return reservas.map((reserva) => this.normalizarReserva(reserva));
  }

  async findDisponibilidad(idCancha: number, fecha: string) {
    const [reservas, bloqueos] = await Promise.all([
      this.reservaRepository
        .createQueryBuilder('reserva')
        .innerJoin('reserva.cancha', 'cancha')
        .where('cancha.id_cancha = :idCancha', { idCancha })
        .andWhere('reserva.fecha = :fecha', { fecha })
        .andWhere('reserva.estado != :estadoCancelado', { estadoCancelado: 'cancelada' })
        .orderBy('reserva.hora_inicio', 'ASC')
        .getMany(),
      this.bloqueoCanchaService.findActivosPorCanchaYFecha(idCancha, fecha),
    ]);

    return [
      ...reservas.map((reserva) => ({
        tipo_ocupacion: 'reserva',
        id_reserva: reserva.id_reserva,
        id_bloqueo: null,
        id_cancha: idCancha,
        fecha: reserva.fecha,
        hora_inicio: reserva.hora_inicio,
        hora_fin: reserva.hora_fin,
        estado: reserva.estado,
        motivo: null,
      })),
      ...bloqueos.map((bloqueo) => ({
        tipo_ocupacion: 'bloqueo',
        id_reserva: null,
        id_bloqueo: bloqueo.id_bloqueo,
        id_cancha: idCancha,
        fecha: bloqueo.fecha,
        hora_inicio: bloqueo.hora_inicio,
        hora_fin: bloqueo.hora_fin,
        estado: 'bloqueada',
        motivo: bloqueo.motivo,
      })),
    ].sort((a, b) => String(a.hora_inicio).localeCompare(String(b.hora_inicio)));
  }

  async findByClub(idClub: number) {
    const reservas = await this.reservaRepository
      .createQueryBuilder('reserva')
      .leftJoinAndSelect('reserva.usuario', 'usuario')
      .leftJoinAndSelect('reserva.cancha', 'cancha')
      .leftJoinAndSelect('cancha.id_club', 'club')
      .leftJoinAndSelect('cancha.id_deporte', 'deporte')
      .where('club.id_club = :idClub', { idClub })
      .getMany();
    return reservas.map((reserva) => this.normalizarReserva(reserva));
  }

  async findOne(id: number) {
    const reserva = await this.reservaRepository.findOne({
      where: { id_reserva: id },
      relations: ['usuario', 'cancha', 'cancha.id_club', 'cancha.id_deporte'],
    });
    return this.normalizarReserva(reserva);
  }

  async update(id: number, dto: UpdateReservaDto) {
    const current = await this.reservaRepository.findOne({
      where: { id_reserva: id },
      relations: ['usuario', 'cancha'],
    });
    if (!current) throw new NotFoundException('Reserva no encontrada.');

    const idCancha = dto.id_cancha ?? current.cancha.id_cancha;
    const fecha = String(dto.fecha ?? current.fecha).slice(0, 10);
    const horaInicio = this.normalizarHora(dto.hora_inicio ?? current.hora_inicio);
    const horaFin = this.normalizarHora(dto.hora_fin ?? current.hora_fin);
    this.validarRango(fecha, horaInicio, horaFin);

    await this.dataSource.transaction(async (manager) => {
      const cancha = await manager
        .getRepository(Cancha)
        .createQueryBuilder('cancha')
        .where('cancha.id_cancha = :idCancha', { idCancha })
        .setLock('pessimistic_write')
        .getOne();
      if (!cancha) throw new NotFoundException('Cancha no encontrada.');

      const overlap = await this.buscarReservaSolapada(manager, {
        idCancha,
        fecha,
        horaInicio,
        horaFin,
        excluirId: id,
      });
      const blockage = await this.buscarBloqueoSolapado(
        manager,
        idCancha,
        fecha,
        horaInicio,
        horaFin,
      );
      if (overlap) throw new ConflictException('La cancha ya está reservada para esa fecha y horario.');
      if (blockage) throw new ConflictException('La cancha fue bloqueada por el club para esa fecha y horario.');

      const repo = manager.getRepository(Reserva);
      const reserva = await repo.findOne({ where: { id_reserva: id } });
      if (!reserva) throw new NotFoundException('Reserva no encontrada.');

      reserva.fecha = fecha as any;
      reserva.hora_inicio = horaInicio;
      reserva.hora_fin = horaFin;
      reserva.cancha = { id_cancha: idCancha } as any;
      reserva.monto_total = this.calcularMonto(cancha, horaInicio, horaFin);
      if (dto.estado !== undefined) reserva.estado = dto.estado;
      if (dto.id_usuario !== undefined) reserva.usuario = { id_usuario: dto.id_usuario } as any;
      await repo.save(reserva);
    });

    return this.findOne(id);
  }

  async remove(id: number) {
    const reserva = await this.reservaRepository.findOneBy({ id_reserva: id });
    if (!reserva) throw new NotFoundException('Reserva no encontrada.');
    reserva.estado = 'cancelada';
    await this.reservaRepository.save(reserva);
    return { message: 'Reserva cancelada correctamente.', id_reserva: id };
  }
}
