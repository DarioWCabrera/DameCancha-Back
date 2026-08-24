import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager, QueryFailedError, Repository } from 'typeorm';

import { CreateReservaDto } from './dto/create-reserva.dto';
import { UpdateReservaDto } from './dto/update-reserva.dto';
import { BloqueoCanchaService } from '../bloqueo-cancha/bloqueo-cancha.service';
import { BloqueoCancha } from '../bloqueo-cancha/entities/bloqueo-cancha.entity';
import { Cancha } from '../cancha/entities/cancha.entity';
import { Reserva } from './entities/reserva.entity';
import { MailService } from '../mail/mail.service';

@Injectable()
export class ReservaService {
  private readonly logger = new Logger(ReservaService.name);

  constructor(
    @InjectRepository(Reserva)
    private readonly reservaRepository: Repository<Reserva>,
    private readonly bloqueoCanchaService: BloqueoCanchaService,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  private normalizarFechaCalendario(fecha: string | Date): string {
    if (typeof fecha === 'string') {
      const match = fecha.trim().match(/^(\d{4}-\d{2}-\d{2})/);
      if (match) return match[1];
    }

    if (fecha instanceof Date && !Number.isNaN(fecha.getTime())) {
      const anio = fecha.getUTCFullYear();
      const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0');
      const dia = String(fecha.getUTCDate()).padStart(2, '0');
      return `${anio}-${mes}-${dia}`;
    }

    return String(fecha).slice(0, 10);
  }

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
      fecha: this.normalizarFechaCalendario(reserva.fecha),
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
      motivo_cancelacion: reserva.motivo_cancelacion,
      cancelado_por_tipo: reserva.cancelado_por_tipo,
      cancelado_por_id: reserva.cancelado_por_id,
      fecha_cancelacion: reserva.fecha_cancelacion,
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

  private esSolapamientoPostgres(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;
    const driverError = (
      error as QueryFailedError & { driverError?: { code?: string } }
    ).driverError;
    return driverError?.code === '23P01';
  }

  private normalizarHora(hora: string): string {
    const [hours, minutes, seconds = '00'] = String(hora).split(':');
    return `${String(Number(hours)).padStart(2, '0')}:${String(
      Number(minutes),
    ).padStart(2, '0')}:${String(Number(seconds)).padStart(2, '0')}`;
  }

  private minutos(hora: string): number {
    const [hours, minutes] = this.normalizarHora(hora).split(':').map(Number);
    return hours * 60 + minutes;
  }

  private getOffsetMinutes(): number {
    const offset =
      this.configService.get<string>('APP_TIMEZONE_OFFSET') || '-03:00';

    const match = offset.match(/^([+-])(\d{2}):(\d{2})$/);
    if (!match) return -180;

    const sign = match[1] === '-' ? -1 : 1;
    return sign * (Number(match[2]) * 60 + Number(match[3]));
  }

  private obtenerFechaHoraActualAplicacion() {
    const ahora = new Date(Date.now() + this.getOffsetMinutes() * 60_000);

    const fecha = [
      ahora.getUTCFullYear(),
      String(ahora.getUTCMonth() + 1).padStart(2, '0'),
      String(ahora.getUTCDate()).padStart(2, '0'),
    ].join('-');

    const hora = [
      String(ahora.getUTCHours()).padStart(2, '0'),
      String(ahora.getUTCMinutes()).padStart(2, '0'),
      String(ahora.getUTCSeconds()).padStart(2, '0'),
    ].join(':');

    return { fecha, hora };
  }

  private validarRango(
    fecha: Date | string,
    horaInicio: string,
    horaFin: string,
  ) {
    const start = this.minutos(horaInicio);
    const end = this.minutos(horaFin);

    if (start >= end) {
      throw new BadRequestException(
        'La hora de inicio debe ser anterior a la hora final.',
      );
    }

    const date = String(fecha).slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException(
        'La fecha debe tener formato YYYY-MM-DD.',
      );
    }

    const offset =
      this.configService.get<string>('APP_TIMEZONE_OFFSET') || '-03:00';

    const inicioReserva = new Date(
      `${date}T${this.normalizarHora(horaInicio)}${offset}`,
    );

    if (Number.isNaN(inicioReserva.getTime())) {
      throw new BadRequestException(
        'La fecha u hora de la reserva no es válida.',
      );
    }

    if (inicioReserva.getTime() <= Date.now()) {
      throw new BadRequestException(
        'No se puede reservar una fecha u horario que ya pasó.',
      );
    }
  }

  private calcularMonto(
    cancha: Cancha,
    horaInicio: string,
    horaFin: string,
  ): number {
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
      .andWhere('reserva.fecha = :fecha', {
        fecha: String(input.fecha).slice(0, 10),
      })
      .andWhere('reserva.estado != :estadoCancelado', {
        estadoCancelado: 'cancelada',
      })
      .andWhere('reserva.hora_inicio < :horaFin', {
        horaFin: input.horaFin,
      })
      .andWhere('reserva.hora_fin > :horaInicio', {
        horaInicio: input.horaInicio,
      });

    if (input.excluirId !== undefined) {
      query.andWhere('reserva.id_reserva != :excluirId', {
        excluirId: input.excluirId,
      });
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
      .andWhere('bloqueo.fecha = :fecha', {
        fecha: String(fecha).slice(0, 10),
      })
      .andWhere('bloqueo.activo = 1')
      .andWhere('bloqueo.hora_inicio < :horaFin', { horaFin })
      .andWhere('bloqueo.hora_fin > :horaInicio', { horaInicio })
      .getOne();
  }

  private async validarDisponibilidadCancha(
    manager: EntityManager,
    idCancha: number,
    fecha: string,
    horaInicio: string,
    horaFin: string,
  ) {
    const [anio, mes, dia] = fecha.split('-').map(Number);

    const diaSemana = new Date(
      Date.UTC(anio, mes - 1, dia),
    ).getUTCDay();

    const disponibilidades: Array<{
      dia_semana: number | string;
      hora_inicio: string;
      hora_fin: string;
    }> = await manager.query(
      `
        SELECT dia_semana, hora_inicio, hora_fin
        FROM disponibilidad
        WHERE id_cancha = $1
      `,
      [idCancha],
    );

    if (disponibilidades.length === 0) {
      const inicio = this.minutos(horaInicio);
      const fin = this.minutos(horaFin);

      const horarioPredeterminadoValido =
        inicio >= 9 * 60 &&
        inicio <= 22 * 60 &&
        inicio % 60 === 0 &&
        fin === inicio + 60;

      if (!horarioPredeterminadoValido) {
        throw new BadRequestException(
          'El horario solicitado no está disponible para esta cancha.',
        );
      }

      return;
    }

    const horarioPermitido = disponibilidades.some((disponibilidad) => {
      return (
        Number(disponibilidad.dia_semana) === diaSemana &&
        this.normalizarHora(disponibilidad.hora_inicio) === horaInicio &&
        this.normalizarHora(disponibilidad.hora_fin) === horaFin
      );
    });

    if (!horarioPermitido) {
      throw new BadRequestException(
        'El horario solicitado no está habilitado por el club para esta cancha.',
      );
    }
  }

  private async bloquearLimitesDeUsuario(
    manager: EntityManager,
    idUsuario: number,
  ) {
    await manager.query(
      'SELECT pg_advisory_xact_lock($1, $2)',
      [20260823, idUsuario],
    );
  }

  private async validarLimitesDeUsuario(
    manager: EntityManager,
    input: {
      idUsuario: number;
      idClub: number;
      fecha: string;
      excluirId?: number;
    },
  ) {
    const estadosFinales = ['cancelada', 'completada'];
    const { fecha: fechaActual, hora: horaActual } =
      this.obtenerFechaHoraActualAplicacion();

    const futurasQuery = manager
      .getRepository(Reserva)
      .createQueryBuilder('reserva')
      .innerJoin('reserva.usuario', 'usuario')
      .where('usuario.id_usuario = :idUsuario', {
        idUsuario: input.idUsuario,
      })
      .andWhere('reserva.estado NOT IN (:...estadosFinales)', {
        estadosFinales,
      })
      .andWhere(
        `(
          reserva.fecha > :fechaActual
          OR (
            reserva.fecha = :fechaActual
            AND reserva.hora_inicio > :horaActual
          )
        )`,
        { fechaActual, horaActual },
      );

    if (input.excluirId !== undefined) {
      futurasQuery.andWhere('reserva.id_reserva != :excluirId', {
        excluirId: input.excluirId,
      });
    }

    const reservasFuturas = await futurasQuery.getCount();

    if (reservasFuturas >= 5) {
      throw new ConflictException(
        'Alcanzaste el máximo de 5 reservas futuras activas. Cuando se complete o canceles una, podrás realizar otra.',
      );
    }

    const mismoDiaMismoClubQuery = manager
      .getRepository(Reserva)
      .createQueryBuilder('reserva')
      .innerJoin('reserva.usuario', 'usuario')
      .innerJoin('reserva.cancha', 'cancha')
      .innerJoin('cancha.id_club', 'club')
      .where('usuario.id_usuario = :idUsuario', {
        idUsuario: input.idUsuario,
      })
      .andWhere('club.id_club = :idClub', { idClub: input.idClub })
      .andWhere('reserva.fecha = :fecha', { fecha: input.fecha })
      .andWhere('reserva.estado NOT IN (:...estadosFinales)', {
        estadosFinales,
      });

    if (input.excluirId !== undefined) {
      mismoDiaMismoClubQuery.andWhere(
        'reserva.id_reserva != :excluirId',
        { excluirId: input.excluirId },
      );
    }

    const reservaMismoDia = await mismoDiaMismoClubQuery.getOne();

    if (reservaMismoDia) {
      throw new ConflictException(
        'Solo podés tener una reserva activa por día en el mismo club.',
      );
    }
  }


  private async cargarReservaParaNotificacion(id: number) {
    return this.reservaRepository.findOne({
      where: { id_reserva: id },
      relations: [
        'usuario',
        'cancha',
        'cancha.id_club',
        'cancha.id_club.dueno',
        'cancha.id_deporte',
      ],
    });
  }

  private nombreCompletoUsuario(reserva: Reserva): string {
    return [
      reserva.usuario?.nombre_usuario,
      reserva.usuario?.apellido_usuario,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  private async notificarSeguro(
    descripcion: string,
    tarea: () => Promise<unknown>,
  ) {
    try {
      await tarea();
    } catch (error) {
      const detalle =
        error instanceof Error ? error.message : String(error);

      this.logger.error(
        `No se pudo enviar ${descripcion}: ${detalle}`,
      );
    }
  }

  async assertUserCanUpdate(id: number) {
    const reserva = await this.reservaRepository.findOne({
      where: { id_reserva: id },
    });

    if (!reserva) throw new NotFoundException('Reserva no encontrada.');

    if (['cancelada', 'completada'].includes(reserva.estado)) {
      throw new BadRequestException(
        'La reserva ya no puede modificarse.',
      );
    }

    const offset =
      this.configService.get<string>('APP_TIMEZONE_OFFSET') || '-03:00';
    const fecha = String(reserva.fecha).slice(0, 10);
    const hora = this.normalizarHora(reserva.hora_inicio);
    const inicio = new Date(`${fecha}T${hora}${offset}`);

    if (Number.isNaN(inicio.getTime())) {
      throw new BadRequestException('La fecha de la reserva no es válida.');
    }

    const horasRestantes = (inicio.getTime() - Date.now()) / 3_600_000;

    if (horasRestantes < 2) {
      throw new BadRequestException(
        'Las reservas solo pueden modificarse con al menos 2 horas de anticipación.',
      );
    }
  }

  async assertUserCanCancel(id: number) {
    const reserva = await this.reservaRepository.findOne({
      where: { id_reserva: id },
    });

    if (!reserva) throw new NotFoundException('Reserva no encontrada.');

    if (['cancelada', 'completada'].includes(reserva.estado)) {
      throw new BadRequestException(
        'La reserva ya no puede cancelarse.',
      );
    }

    const offset =
      this.configService.get<string>('APP_TIMEZONE_OFFSET') || '-03:00';
    const fecha = String(reserva.fecha).slice(0, 10);
    const hora = this.normalizarHora(reserva.hora_inicio);
    const inicio = new Date(`${fecha}T${hora}${offset}`);

    if (Number.isNaN(inicio.getTime())) {
      throw new BadRequestException('La fecha de la reserva no es válida.');
    }

    if (inicio.getTime() <= Date.now()) {
      throw new BadRequestException(
        'La reserva ya comenzó y no puede cancelarse.',
      );
    }
  }

  async create(createReservaDto: CreateReservaDto) {
    const fecha = String(createReservaDto.fecha).slice(0, 10);
    const horaInicio = this.normalizarHora(createReservaDto.hora_inicio);
    const horaFin = this.normalizarHora(createReservaDto.hora_fin);
    this.validarRango(fecha, horaInicio, horaFin);

    let savedId: number;

    try {
      savedId = await this.dataSource.transaction(async (manager) => {
        await this.bloquearLimitesDeUsuario(
          manager,
          createReservaDto.id_usuario,
        );

        const cancha = await manager
          .getRepository(Cancha)
          .createQueryBuilder('cancha')
          .innerJoinAndSelect('cancha.id_club', 'club')
          .where('cancha.id_cancha = :idCancha', {
            idCancha: createReservaDto.id_cancha,
          })
          .andWhere('cancha.activa = 1')
          .andWhere('club.estado = :estadoClub', {
            estadoClub: 'activo',
          })
          .setLock('pessimistic_write')
          .getOne();

        if (!cancha) {
          throw new NotFoundException(
            'Cancha no encontrada, inactiva o perteneciente a un club inactivo.',
          );
        }

        await this.validarLimitesDeUsuario(manager, {
          idUsuario: createReservaDto.id_usuario,
          idClub: cancha.id_club.id_club,
          fecha,
        });

        await this.validarDisponibilidadCancha(
          manager,
          createReservaDto.id_cancha,
          fecha,
          horaInicio,
          horaFin,
        );

        const reservaExistente = await this.buscarReservaSolapada(
          manager,
          {
            idCancha: createReservaDto.id_cancha,
            fecha,
            horaInicio,
            horaFin,
          },
        );

        const bloqueoExistente = await this.buscarBloqueoSolapado(
          manager,
          createReservaDto.id_cancha,
          fecha,
          horaInicio,
          horaFin,
        );

        if (reservaExistente) {
          throw new ConflictException(
            'La cancha ya está reservada para esa fecha y horario.',
          );
        }

        if (bloqueoExistente) {
          throw new ConflictException(
            'La cancha fue bloqueada por el club para esa fecha y horario.',
          );
        }

        const reserva = manager.getRepository(Reserva).create({
          fecha: fecha as any,
          hora_inicio: horaInicio,
          hora_fin: horaFin,
          monto_total: this.calcularMonto(
            cancha,
            horaInicio,
            horaFin,
          ),
          estado: createReservaDto.estado || 'confirmada',
          estado_pago: 'pago_en_club',
          usuario: {
            id_usuario: createReservaDto.id_usuario,
          } as any,
          cancha: {
            id_cancha: createReservaDto.id_cancha,
          } as any,
        });

        const saved = await manager.getRepository(Reserva).save(reserva);
        return saved.id_reserva;
      });
    } catch (error) {
      if (this.esSolapamientoPostgres(error)) {
        throw new ConflictException(
          'La cancha ya está reservada para esa fecha y horario.',
        );
      }
      throw error;
    }

    const reservaCreada =
      await this.cargarReservaParaNotificacion(savedId);

    const emailDueno =
      reservaCreada?.cancha?.id_club?.dueno?.email_usuario;

    if (reservaCreada && emailDueno) {
      await this.notificarSeguro(
        'la notificación de nueva reserva al dueño',
        () =>
          this.mailService.sendReservationEventToOwner({
            email: emailDueno,
            ownerName: [
              reservaCreada.cancha.id_club.dueno.nombre_usuario,
              reservaCreada.cancha.id_club.dueno.apellido_usuario,
            ]
              .filter(Boolean)
              .join(' '),
            action: 'creada',
            reservationId: reservaCreada.id_reserva,
            userName: this.nombreCompletoUsuario(reservaCreada),
            userEmail: reservaCreada.usuario?.email_usuario,
            userPhone: reservaCreada.usuario?.telefono_usuario,
            club: reservaCreada.cancha.id_club.nombre_club,
            cancha: reservaCreada.cancha.nombre_cancha,
            fecha: this.normalizarFechaCalendario(
              reservaCreada.fecha,
            ),
            hora: `${reservaCreada.hora_inicio} - ${reservaCreada.hora_fin}`,
          }),
      );
    }

    return this.findOne(savedId);
  }

  async findAll() {
    const reservas = await this.reservaRepository.find({
      relations: [
        'usuario',
        'cancha',
        'cancha.id_club',
        'cancha.id_deporte',
      ],
    });
    return reservas.map((reserva) => this.normalizarReserva(reserva));
  }

  async findByUsuario(idUsuario: number) {
    const reservas = await this.reservaRepository.find({
      where: { usuario: { id_usuario: idUsuario } },
      relations: [
        'usuario',
        'cancha',
        'cancha.id_club',
        'cancha.id_deporte',
      ],
      order: { fecha: 'ASC', hora_inicio: 'ASC' },
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
        .andWhere('reserva.estado != :estadoCancelado', {
          estadoCancelado: 'cancelada',
        })
        .orderBy('reserva.hora_inicio', 'ASC')
        .getMany(),
      this.bloqueoCanchaService.findActivosPorCanchaYFecha(
        idCancha,
        fecha,
      ),
    ]);

    return [
      ...reservas.map((reserva) => ({
        tipo_ocupacion: 'reserva',
        id_reserva: reserva.id_reserva,
        id_bloqueo: null,
        id_cancha: idCancha,
        fecha,
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
    ].sort((a, b) =>
      String(a.hora_inicio).localeCompare(String(b.hora_inicio)),
    );
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
      relations: [
        'usuario',
        'cancha',
        'cancha.id_club',
        'cancha.id_deporte',
      ],
    });
    return this.normalizarReserva(reserva);
  }

  async update(
    id: number,
    dto: UpdateReservaDto,
    actorTipo?: string,
  ) {
    const anterior = await this.cargarReservaParaNotificacion(id);

    if (!anterior) {
      throw new NotFoundException('Reserva no encontrada.');
    }

    if (['cancelada', 'completada'].includes(anterior.estado)) {
      throw new BadRequestException(
        'La reserva ya no puede modificarse.',
      );
    }

    const idCancha = dto.id_cancha ?? anterior.cancha.id_cancha;
    const idUsuario =
      dto.id_usuario ?? anterior.usuario.id_usuario;
    const fecha = String(dto.fecha ?? anterior.fecha).slice(0, 10);
    const horaInicio = this.normalizarHora(
      dto.hora_inicio ?? anterior.hora_inicio,
    );
    const horaFin = this.normalizarHora(
      dto.hora_fin ?? anterior.hora_fin,
    );

    this.validarRango(fecha, horaInicio, horaFin);

    try {
      await this.dataSource.transaction(async (manager) => {
        await this.bloquearLimitesDeUsuario(manager, idUsuario);

        const cancha = await manager
          .getRepository(Cancha)
          .createQueryBuilder('cancha')
          .innerJoinAndSelect('cancha.id_club', 'club')
          .where('cancha.id_cancha = :idCancha', { idCancha })
          .andWhere('cancha.activa = 1')
          .andWhere('club.estado = :estadoClub', {
            estadoClub: 'activo',
          })
          .setLock('pessimistic_write')
          .getOne();

        if (!cancha) {
          throw new NotFoundException(
            'Cancha no encontrada, inactiva o perteneciente a un club inactivo.',
          );
        }

        await this.validarLimitesDeUsuario(manager, {
          idUsuario,
          idClub: cancha.id_club.id_club,
          fecha,
          excluirId: id,
        });

        await this.validarDisponibilidadCancha(
          manager,
          idCancha,
          fecha,
          horaInicio,
          horaFin,
        );

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

        if (overlap) {
          throw new ConflictException(
            'La cancha ya está reservada para esa fecha y horario.',
          );
        }

        if (blockage) {
          throw new ConflictException(
            'La cancha fue bloqueada por el club para esa fecha y horario.',
          );
        }

        const repo = manager.getRepository(Reserva);
        const reserva = await repo.findOne({
          where: { id_reserva: id },
        });

        if (!reserva) {
          throw new NotFoundException('Reserva no encontrada.');
        }

        reserva.fecha = fecha as any;
        reserva.hora_inicio = horaInicio;
        reserva.hora_fin = horaFin;
        reserva.cancha = { id_cancha: idCancha } as any;
        reserva.monto_total = this.calcularMonto(
          cancha,
          horaInicio,
          horaFin,
        );

        if (dto.estado !== undefined) {
          reserva.estado = dto.estado;
        }

        if (dto.id_usuario !== undefined) {
          reserva.usuario = {
            id_usuario: dto.id_usuario,
          } as any;
        }

        await repo.save(reserva);
      });
    } catch (error) {
      if (this.esSolapamientoPostgres(error)) {
        throw new ConflictException(
          'La cancha ya está reservada para esa fecha y horario.',
        );
      }
      throw error;
    }

    const actual = await this.cargarReservaParaNotificacion(id);

    if (actual && actorTipo === 'usuario') {
      const emailsNotificados = new Set<string>();

      const notificarDueno = async (
        email: string | undefined,
        ownerName: string,
      ) => {
        if (!email || emailsNotificados.has(email)) return;
        emailsNotificados.add(email);

        await this.notificarSeguro(
          'la notificación de reserva modificada al dueño',
          () =>
            this.mailService.sendReservationEventToOwner({
              email,
              ownerName,
              action: 'modificada',
              reservationId: actual.id_reserva,
              userName: this.nombreCompletoUsuario(actual),
              userEmail: actual.usuario?.email_usuario,
              userPhone: actual.usuario?.telefono_usuario,
              club: actual.cancha.id_club.nombre_club,
              cancha: actual.cancha.nombre_cancha,
              fecha: this.normalizarFechaCalendario(actual.fecha),
              hora: `${actual.hora_inicio} - ${actual.hora_fin}`,
              previous: {
                club: anterior.cancha.id_club.nombre_club,
                cancha: anterior.cancha.nombre_cancha,
                fecha: this.normalizarFechaCalendario(
                  anterior.fecha,
                ),
                hora: `${anterior.hora_inicio} - ${anterior.hora_fin}`,
              },
            }),
        );
      };

      await notificarDueno(
        actual.cancha.id_club.dueno?.email_usuario,
        [
          actual.cancha.id_club.dueno?.nombre_usuario,
          actual.cancha.id_club.dueno?.apellido_usuario,
        ]
          .filter(Boolean)
          .join(' '),
      );

      if (
        anterior.cancha.id_club.dueno?.email_usuario !==
        actual.cancha.id_club.dueno?.email_usuario
      ) {
        await notificarDueno(
          anterior.cancha.id_club.dueno?.email_usuario,
          [
            anterior.cancha.id_club.dueno?.nombre_usuario,
            anterior.cancha.id_club.dueno?.apellido_usuario,
          ]
            .filter(Boolean)
            .join(' '),
        );
      }
    }

    return this.findOne(id);
  }

  async remove(
    id: number,
    actor: {
      tipo: string;
      id: number;
      motivo?: string;
    },
  ) {
    const reserva = await this.cargarReservaParaNotificacion(id);

    if (!reserva) {
      throw new NotFoundException('Reserva no encontrada.');
    }

    if (reserva.estado === 'cancelada') {
      throw new BadRequestException(
        'La reserva ya se encuentra cancelada.',
      );
    }

    if (reserva.estado === 'completada') {
      throw new BadRequestException(
        'Una reserva completada no puede cancelarse.',
      );
    }

    const motivo = actor.motivo?.trim() || null;

    reserva.estado = 'cancelada';
    reserva.motivo_cancelacion = motivo;
    reserva.cancelado_por_tipo = actor.tipo;
    reserva.cancelado_por_id = actor.id;
    reserva.fecha_cancelacion = new Date();

    await this.reservaRepository.save(reserva);

    const esUsuario = actor.tipo === 'usuario';
    const esDueno =
      actor.tipo === 'dueno' || actor.tipo === 'club';

    if (esUsuario) {
      const emailDueno =
        reserva.cancha?.id_club?.dueno?.email_usuario;

      if (emailDueno) {
        await this.notificarSeguro(
          'la notificación de reserva cancelada al dueño',
          () =>
            this.mailService.sendReservationEventToOwner({
              email: emailDueno,
              ownerName: [
                reserva.cancha.id_club.dueno.nombre_usuario,
                reserva.cancha.id_club.dueno.apellido_usuario,
              ]
                .filter(Boolean)
                .join(' '),
              action: 'cancelada',
              reservationId: reserva.id_reserva,
              userName: this.nombreCompletoUsuario(reserva),
              userEmail: reserva.usuario?.email_usuario,
              userPhone: reserva.usuario?.telefono_usuario,
              club: reserva.cancha.id_club.nombre_club,
              cancha: reserva.cancha.nombre_cancha,
              fecha: this.normalizarFechaCalendario(reserva.fecha),
              hora: `${reserva.hora_inicio} - ${reserva.hora_fin}`,
              motivo:
                motivo || 'Cancelada por el usuario.',
            }),
        );
      }
    }

    if (esDueno && reserva.usuario?.email_usuario) {
      await this.notificarSeguro(
        'la notificación de cancelación del club al usuario',
        () =>
          this.mailService.sendReservationCancelledByClubToUser({
            email: reserva.usuario.email_usuario,
            nombre: this.nombreCompletoUsuario(reserva),
            reservationId: reserva.id_reserva,
            club: reserva.cancha.id_club.nombre_club,
            cancha: reserva.cancha.nombre_cancha,
            fecha: this.normalizarFechaCalendario(reserva.fecha),
            hora: `${reserva.hora_inicio} - ${reserva.hora_fin}`,
            motivo: motivo || 'Cancelada por el club.',
          }),
      );
    }

    return {
      message: 'Reserva cancelada correctamente.',
      id_reserva: id,
      motivo_cancelacion: motivo,
    };
  }
}