import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  In,
  Repository,
} from 'typeorm';

import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { BloqueoCancha } from '../bloqueo-cancha/entities/bloqueo-cancha.entity';
import { Cancha } from '../cancha/entities/cancha.entity';
import { Club } from '../club/entities/club.entity';
import { Deporte } from '../deporte/entities/deporte.entity';
import { Disponibilidad } from '../disponibilidad/entities/disponibilidad.entity';
import { Reserva } from '../reserva/entities/reserva.entity';
import { User } from '../user/entities/user.entity';
import { AprobarTurnoFijoDto } from './dto/aprobar-turno-fijo.dto';
import { RechazarTurnoFijoDto } from './dto/rechazar-turno-fijo.dto';
import { CreateSolicitudTurnoFijoDto } from './dto/create-solicitud-turno-fijo.dto';
import { CreateTurnoFijoManualDto } from './dto/create-turno-fijo-manual.dto';
import { TurnoFijo } from './entities/turno-fijo.entity';

@Injectable()
export class TurnoFijoService {
  constructor(
    @InjectRepository(TurnoFijo)
    private readonly turnoFijoRepository: Repository<TurnoFijo>,

    @InjectRepository(Club)
    private readonly clubRepository: Repository<Club>,

    @InjectRepository(Deporte)
    private readonly deporteRepository: Repository<Deporte>,

    @InjectRepository(Cancha)
    private readonly canchaRepository: Repository<Cancha>,

    @InjectRepository(Disponibilidad)
    private readonly disponibilidadRepository: Repository<Disponibilidad>,

    private readonly dataSource: DataSource,
  ) {}

  private normalizarHora(valor: string): string {
    const [horaTexto, minutoTexto = '0'] = String(valor || '')
      .trim()
      .split(':');

    const hora = Number(horaTexto);
    const minuto = Number(minutoTexto);

    if (
      !Number.isInteger(hora) ||
      !Number.isInteger(minuto) ||
      hora < 0 ||
      hora > 23 ||
      minuto < 0 ||
      minuto > 59
    ) {
      throw new BadRequestException('El horario indicado no es válido.');
    }

    return `${String(hora).padStart(2, '0')}:${String(minuto).padStart(
      2,
      '0',
    )}`;
  }

  private normalizarHoraFin(valor: string): string {
    const limpia = String(valor || '').trim();

    if (/^24:00(?::00)?$/.test(limpia)) {
      return '24:00';
    }

    return this.normalizarHora(limpia);
  }

  private esHorarioDefaultValido(horaInicio: string): boolean {
    const [hora, minutos] = horaInicio.split(':').map(Number);

    return minutos === 0 && hora >= 9 && hora <= 22;
  }

  private sumarMinutos(horaInicio: string, cantidad: number): string {
    const [hora, minuto] = horaInicio.split(':').map(Number);
    const total = hora * 60 + minuto + cantidad;

    if (total < 0 || total > 24 * 60) {
      throw new BadRequestException(
        'No se pudo calcular correctamente la hora de finalización.',
      );
    }

    if (total === 24 * 60) {
      return '24:00';
    }

    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(
      total % 60,
    ).padStart(2, '0')}`;
  }

  private esFechaISOValida(fecha: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return false;
    }

    const [anio, mes, dia] = fecha.split('-').map(Number);
    const valor = new Date(Date.UTC(anio, mes - 1, dia));

    return (
      valor.getUTCFullYear() === anio &&
      valor.getUTCMonth() === mes - 1 &&
      valor.getUTCDate() === dia
    );
  }

  private obtenerDiaSemana(fecha: string): number {
    const [anio, mes, dia] = fecha.split('-').map(Number);

    return new Date(
      Date.UTC(anio, mes - 1, dia),
    ).getUTCDay();
  }

  private obtenerHoyArgentina(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  private obtenerMinutosActualesArgentina(): number {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());

  const hora = Number(
    partes.find((parte) => parte.type === 'hour')?.value || 0,
  );

  const minuto = Number(
    partes.find((parte) => parte.type === 'minute')?.value || 0,
  );

  return hora * 60 + minuto;
}

private sumarDiasFechaISO(
  fecha: string,
  cantidadDias: number,
): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);

  const valor = new Date(
    Date.UTC(anio, mes - 1, dia),
  );

  valor.setUTCDate(
    valor.getUTCDate() + cantidadDias,
  );

  return valor.toISOString().slice(0, 10);
}

private calcularUltimaFechaVigenteTurno(
  turno: TurnoFijo,
): string | null {
  const hoy = this.obtenerHoyArgentina();

  const diaHoy = this.obtenerDiaSemana(hoy);

  const diaTurno = Number(
    turno.dia_semana,
  );

  let diasAtras =
    (diaHoy - diaTurno + 7) % 7;

  /*
    Si hoy es el día del turno pero todavía
    no llegó su horario, la última ocurrencia
    posible fue la semana anterior.
  */
  if (diasAtras === 0) {
    const horaInicio =
      this.normalizarHora(
        turno.hora_inicio,
      );

    const [hora, minuto] =
      horaInicio.split(':').map(Number);

    const inicioEnMinutos =
      hora * 60 + minuto;

    if (
      this.obtenerMinutosActualesArgentina() <
      inicioEnMinutos
    ) {
      diasAtras = 7;
    }
  }

  const ultimaOcurrencia =
    this.sumarDiasFechaISO(
      hoy,
      -diasAtras,
    );

  const fechaInicio =
    turno.fecha_inicio
      ? this.fechaComoISO(
          turno.fecha_inicio,
        )
      : null;

  /*
    Si la última ocurrencia posible es anterior
    a la fecha de inicio, significa que el turno
    se canceló antes de suceder por primera vez.

    En ese caso fecha_fin queda null.
  */
  if (
    fechaInicio &&
    ultimaOcurrencia < fechaInicio
  ) {
    return null;
  }

  return ultimaOcurrencia;
}

  private fechaComoISO(valor: string | Date): string {
    if (valor instanceof Date) {
      return valor.toISOString().slice(0, 10);
    }

    return String(valor).slice(0, 10);
  }

  private async obtenerClubAdministrable(
    idClub: number,
    usuario: AuthenticatedUser,
  ): Promise<Club> {
    const idClubNumerico = Number(idClub);

    if (!Number.isInteger(idClubNumerico) || idClubNumerico <= 0) {
      throw new BadRequestException('El club indicado no es válido.');
    }

    const club = await this.clubRepository.findOne({
      where: {
        id_club: idClubNumerico,
      },
      relations: ['dueno'],
    });

    if (!club) {
      throw new NotFoundException('El club indicado no existe.');
    }

    if (usuario.tipo !== 'admin') {
      const esResponsable =
        usuario.tipo === 'dueno' || usuario.tipo === 'club';

      if (!esResponsable) {
        throw new ForbiddenException(
          'Solo el responsable del club puede consultar estas solicitudes.',
        );
      }

      if (
        Number(club.dueno?.id_usuario) !== Number(usuario.sub)
      ) {
        throw new ForbiddenException(
          'No tenés permiso para administrar este club.',
        );
      }
    }

    if (club.estado !== 'activo') {
      throw new ForbiddenException(
        'El club se encuentra inactivo y no puede operar.',
      );
    }

    return club;
  }

  private async existeCanchaCompatible(
    canchas: Cancha[],
    diaSemana: number,
    horaInicio: string,
  ): Promise<boolean> {
    const idsCancha = canchas
      .map((cancha) => Number(cancha.id_cancha))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (!idsCancha.length) return false;

    const disponibilidades = await this.disponibilidadRepository.find({
      where: {
        cancha: {
          id_cancha: In(idsCancha),
        },
      },
      relations: ['cancha'],
    });

    const disponibilidadesPorCancha = new Map<number, Disponibilidad[]>();

    disponibilidades.forEach((item) => {
      const idCancha = Number(item.cancha?.id_cancha);
      if (!idCancha) return;

      const actuales = disponibilidadesPorCancha.get(idCancha) || [];
      actuales.push(item);
      disponibilidadesPorCancha.set(idCancha, actuales);
    });

    return canchas.some((cancha) => {
      const idCancha = Number(cancha.id_cancha);
      const configuradas = disponibilidadesPorCancha.get(idCancha) || [];

      if (configuradas.length === 0) {
        return this.esHorarioDefaultValido(horaInicio);
      }

      return configuradas.some(
        (item) =>
          Number(item.dia_semana) === diaSemana &&
          this.normalizarHora(item.hora_inicio) === horaInicio,
      );
    });
  }

  private async resolverHoraFinParaCancha(
    manager: EntityManager,
    idCancha: number,
    diaSemana: number,
    horaInicio: string,
  ): Promise<string> {
    const disponibilidades: Array<{
      dia_semana: number | string;
      hora_inicio: string;
      hora_fin: string;
    }> = await manager.query(
      `
        SELECT dia_semana, hora_inicio, hora_fin
        FROM disponibilidad
        WHERE id_cancha = $1
        ORDER BY dia_semana, hora_inicio
      `,
      [idCancha],
    );

    /*
      Sin configuración particular:
      mantenemos la grilla histórica 09:00–22:00, cada 60 minutos.
    */
    if (disponibilidades.length === 0) {
      if (!this.esHorarioDefaultValido(horaInicio)) {
        throw new BadRequestException(
          'La cancha elegida no tiene habilitado ese horario.',
        );
      }

      return this.sumarMinutos(horaInicio, 60);
    }

    const slot = disponibilidades.find(
      (item) =>
        Number(item.dia_semana) === diaSemana &&
        this.normalizarHora(item.hora_inicio) === horaInicio,
    );

    if (!slot) {
      throw new BadRequestException(
        'La cancha elegida no tiene habilitado ese día y horario.',
      );
    }

    return this.normalizarHoraFin(slot.hora_fin);
  }

  async crearSolicitudUsuario(
    dto: CreateSolicitudTurnoFijoDto,
    usuario: AuthenticatedUser,
  ) {
    if (usuario.tipo !== 'usuario') {
      throw new ForbiddenException(
        'Solo un usuario puede solicitar un turno fijo desde este flujo.',
      );
    }

    const idClub = Number(dto.id_club);
    const idDeporte = Number(dto.id_deporte);
    const diaSemana = Number(dto.dia_semana);
    const horaInicio = this.normalizarHora(dto.hora_inicio);

    const club = await this.clubRepository.findOne({
      where: {
        id_club: idClub,
      },
    });

    if (!club) {
      throw new NotFoundException('El club indicado no existe.');
    }

    if (club.estado !== 'activo') {
      throw new ForbiddenException(
        'El club se encuentra inactivo y no puede recibir solicitudes.',
      );
    }

    const deporte = await this.deporteRepository.findOne({
      where: {
        id_deporte: idDeporte,
      },
    });

    if (!deporte) {
      throw new NotFoundException('El deporte indicado no existe.');
    }

    const canchas = await this.canchaRepository
      .createQueryBuilder('cancha')
      .innerJoinAndSelect('cancha.id_club', 'club')
      .innerJoinAndSelect('cancha.id_deporte', 'deporte')
      .where('club.id_club = :idClub', { idClub })
      .andWhere('deporte.id_deporte = :idDeporte', { idDeporte })
      .andWhere('cancha.activa = :activa', { activa: 1 })
      .getMany();

    if (!canchas.length) {
      throw new BadRequestException(
        'El club no tiene canchas activas para el deporte seleccionado.',
      );
    }

    const horarioCompatible = await this.existeCanchaCompatible(
      canchas,
      diaSemana,
      horaInicio,
    );

    if (!horarioCompatible) {
      throw new BadRequestException(
        'Ese día y horario no están habilitados para el deporte seleccionado en este club.',
      );
    }

    const existente = await this.turnoFijoRepository
      .createQueryBuilder('turno')
      .innerJoin('turno.usuario', 'usuario')
      .innerJoin('turno.club', 'club')
      .innerJoin('turno.deporte', 'deporte')
      .where('usuario.id_usuario = :idUsuario', {
        idUsuario: Number(usuario.sub),
      })
      .andWhere('club.id_club = :idClub', { idClub })
      .andWhere('deporte.id_deporte = :idDeporte', { idDeporte })
      .andWhere('turno.dia_semana = :diaSemana', { diaSemana })
      .andWhere('turno.hora_inicio = :horaInicio', {
        horaInicio,
      })
      .andWhere('turno.estado IN (:...estados)', {
        estados: ['pendiente', 'activo'],
      })
      .getOne();

    if (existente) {
      throw new ConflictException(
        existente.estado === 'pendiente'
          ? 'Ya tenés una solicitud pendiente para ese día y horario.'
          : 'Ya tenés un turno fijo activo para ese día y horario.',
      );
    }

    const nuevaSolicitud = this.turnoFijoRepository.create({
      origen: 'usuario',
      estado: 'pendiente',
      dia_semana: diaSemana,
      hora_inicio: horaInicio,
      hora_fin: null,
      fecha_inicio: null,
      fecha_fin: null,
      motivo_rechazo: null,
      alternativas: null,
      nombre_cliente_manual: null,
      telefono_cliente_manual: null,
      usuario: {
        id_usuario: Number(usuario.sub),
      } as any,
      club,
      deporte,
      cancha: null,
    });

    const guardada = await this.turnoFijoRepository.save(nuevaSolicitud);

    return {
      message:
        'Solicitud de turno fijo enviada correctamente. Te notificaremos cuando el club la apruebe o rechace.',
      solicitud: {
        id_turno_fijo: guardada.id_turno_fijo,
        origen: guardada.origen,
        estado: guardada.estado,
        dia_semana: guardada.dia_semana,
        hora_inicio: guardada.hora_inicio,
        hora_fin: guardada.hora_fin,
        fecha_inicio: guardada.fecha_inicio,
        id_club: club.id_club,
        nombre_club: club.nombre_club,
        id_deporte: deporte.id_deporte,
        nombre_deporte: deporte.nombre_deporte,
        created_at: guardada.created_at,
      },
    };
  }

  async listarSolicitudesPendientesClub(
    idClub: number,
    usuario: AuthenticatedUser,
  ) {
    const club = await this.obtenerClubAdministrable(
      idClub,
      usuario,
    );

    const solicitudes = await this.turnoFijoRepository.find({
      where: {
        club: {
          id_club: club.id_club,
        },
        estado: 'pendiente',
      },
      relations: ['usuario', 'club', 'deporte', 'cancha'],
      order: {
        created_at: 'DESC',
      },
    });

    return solicitudes.map((solicitud) => ({
      id_turno_fijo: solicitud.id_turno_fijo,
      origen: solicitud.origen,
      estado: solicitud.estado,
      dia_semana: solicitud.dia_semana,
      hora_inicio: solicitud.hora_inicio,
      hora_fin: solicitud.hora_fin,
      fecha_inicio: solicitud.fecha_inicio,
      created_at: solicitud.created_at,

      usuario: solicitud.usuario
        ? {
            id_usuario: solicitud.usuario.id_usuario,
            nombre_usuario: solicitud.usuario.nombre_usuario,
            apellido_usuario: solicitud.usuario.apellido_usuario,
            telefono_usuario: solicitud.usuario.telefono_usuario,
          }
        : null,

      club: {
        id_club: solicitud.club.id_club,
        nombre_club: solicitud.club.nombre_club,
      },

      deporte: {
        id_deporte: solicitud.deporte.id_deporte,
        nombre_deporte: solicitud.deporte.nombre_deporte,
      },

      cancha: solicitud.cancha
        ? {
            id_cancha: solicitud.cancha.id_cancha,
            nombre_cancha: solicitud.cancha.nombre_cancha,
          }
        : null,
    }));
  }

  async aprobarSolicitud(
    idTurnoFijo: number,
    dto: AprobarTurnoFijoDto,
    usuario: AuthenticatedUser,
  ) {
    const idTurno = Number(idTurnoFijo);
    const idCancha = Number(dto.id_cancha);
    const fechaInicio = String(dto.fecha_inicio || '').trim();

    if (!Number.isInteger(idTurno) || idTurno <= 0) {
      throw new BadRequestException(
        'La solicitud de turno fijo indicada no es válida.',
      );
    }

    if (!Number.isInteger(idCancha) || idCancha <= 0) {
      throw new BadRequestException(
        'La cancha indicada no es válida.',
      );
    }

    if (!this.esFechaISOValida(fechaInicio)) {
      throw new BadRequestException(
        'La fecha de inicio no es válida.',
      );
    }

    if (fechaInicio < this.obtenerHoyArgentina()) {
      throw new BadRequestException(
        'La fecha de inicio no puede estar en el pasado.',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      /*
        Bloqueamos la solicitud para impedir que dos aprobaciones/rechazos
        simultáneos modifiquen el mismo turno.
      */
      const solicitud = await manager
        .getRepository(TurnoFijo)
        .createQueryBuilder('turno')
        .leftJoinAndSelect('turno.usuario', 'usuario')
        .innerJoinAndSelect('turno.club', 'club')
        .leftJoinAndSelect('club.dueno', 'dueno')
        .innerJoinAndSelect('turno.deporte', 'deporte')
        .leftJoinAndSelect('turno.cancha', 'canchaActual')
        .where('turno.id_turno_fijo = :idTurno', {
          idTurno,
        })
        .setLock('pessimistic_write', undefined, ['turno'])
        .getOne();

      if (!solicitud) {
        throw new NotFoundException(
          'La solicitud de turno fijo no existe.',
        );
      }

      if (solicitud.estado !== 'pendiente') {
        throw new ConflictException(
          'Solo se pueden aprobar solicitudes pendientes.',
        );
      }

      if (usuario.tipo !== 'admin') {
        const esResponsable =
          usuario.tipo === 'dueno' || usuario.tipo === 'club';

        if (!esResponsable) {
          throw new ForbiddenException(
            'Solo el responsable del club puede aprobar un turno fijo.',
          );
        }

        if (
          Number(solicitud.club.dueno?.id_usuario) !==
          Number(usuario.sub)
        ) {
          throw new ForbiddenException(
            'No tenés permiso para administrar este club.',
          );
        }
      }

      if (solicitud.club.estado !== 'activo') {
        throw new ForbiddenException(
          'El club se encuentra inactivo y no puede operar.',
        );
      }

      if (
        this.obtenerDiaSemana(fechaInicio) !==
        Number(solicitud.dia_semana)
      ) {
        throw new BadRequestException(
          'La fecha de inicio debe corresponder al mismo día de la semana solicitado.',
        );
      }

      /*
        Bloqueamos también la cancha elegida. Reserva ya utiliza bloqueo
        pesimista sobre la cancha al crear/modificar, por lo que así evitamos
        aprobar un turno fijo al mismo tiempo que se crea una reserva normal.
      */
      const cancha = await manager
        .getRepository(Cancha)
        .createQueryBuilder('cancha')
        .innerJoinAndSelect('cancha.id_club', 'club')
        .innerJoinAndSelect('cancha.id_deporte', 'deporte')
        .where('cancha.id_cancha = :idCancha', {
          idCancha,
        })
        .andWhere('cancha.activa = :activa', {
          activa: 1,
        })
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

      if (
        Number(cancha.id_club.id_club) !==
        Number(solicitud.club.id_club)
      ) {
        throw new BadRequestException(
          'La cancha elegida no pertenece al club de la solicitud.',
        );
      }

      if (
        Number(cancha.id_deporte.id_deporte) !==
        Number(solicitud.deporte.id_deporte)
      ) {
        throw new BadRequestException(
          'La cancha elegida no corresponde al deporte solicitado.',
        );
      }

      const horaInicio = this.normalizarHora(
        solicitud.hora_inicio,
      );

      /*
        La hora_fin sale de la disponibilidad REAL de la cancha.
        No confiamos en una duración enviada por el frontend.
      */
      const horaFin = await this.resolverHoraFinParaCancha(
        manager,
        cancha.id_cancha,
        Number(solicitud.dia_semana),
        horaInicio,
      );

      /*
        Mismas reglas de solapamiento que Reserva:
          existente.inicio < nuevo.fin
          existente.fin > nuevo.inicio
      */

      const reservaConflicto = await manager
        .getRepository(Reserva)
        .createQueryBuilder('reserva')
        .innerJoin('reserva.cancha', 'cancha')
        .where('cancha.id_cancha = :idCancha', {
          idCancha: cancha.id_cancha,
        })
        .andWhere('reserva.fecha >= :fechaInicio', {
          fechaInicio,
        })
        .andWhere(
          'EXTRACT(DOW FROM reserva.fecha) = :diaSemana',
          {
            diaSemana: solicitud.dia_semana,
          },
        )
        .andWhere('reserva.estado != :estadoCancelado', {
          estadoCancelado: 'cancelada',
        })
        .andWhere('reserva.hora_inicio < :horaFin', {
          horaFin,
        })
        .andWhere('reserva.hora_fin > :horaInicio', {
          horaInicio,
        })
        .orderBy('reserva.fecha', 'ASC')
        .addOrderBy('reserva.hora_inicio', 'ASC')
        .getOne();

      if (reservaConflicto) {
        throw new ConflictException(
          `La cancha ya tiene una reserva el ${this.fechaComoISO(
            reservaConflicto.fecha,
          )} que se superpone con este turno fijo. Elegí otra cancha o una fecha de inicio posterior.`,
        );
      }

      const bloqueoConflicto = await manager
        .getRepository(BloqueoCancha)
        .createQueryBuilder('bloqueo')
        .innerJoin('bloqueo.cancha', 'cancha')
        .where('cancha.id_cancha = :idCancha', {
          idCancha: cancha.id_cancha,
        })
        .andWhere('bloqueo.fecha >= :fechaInicio', {
          fechaInicio,
        })
        .andWhere(
          'EXTRACT(DOW FROM bloqueo.fecha) = :diaSemana',
          {
            diaSemana: solicitud.dia_semana,
          },
        )
        .andWhere('bloqueo.activo = 1')
        .andWhere('bloqueo.hora_inicio < :horaFin', {
          horaFin,
        })
        .andWhere('bloqueo.hora_fin > :horaInicio', {
          horaInicio,
        })
        .orderBy('bloqueo.fecha', 'ASC')
        .addOrderBy('bloqueo.hora_inicio', 'ASC')
        .getOne();

      if (bloqueoConflicto) {
        throw new ConflictException(
          `La cancha tiene un bloqueo el ${this.fechaComoISO(
            bloqueoConflicto.fecha,
          )} que se superpone con este turno fijo. Elegí otra cancha o una fecha de inicio posterior.`,
        );
      }

      const turnoFijoConflicto = await manager
        .getRepository(TurnoFijo)
        .createQueryBuilder('otro')
        .innerJoin('otro.cancha', 'cancha')
        .where('otro.id_turno_fijo != :idTurno', {
          idTurno,
        })
        .andWhere('cancha.id_cancha = :idCancha', {
          idCancha: cancha.id_cancha,
        })
        .andWhere('otro.estado = :estadoActivo', {
          estadoActivo: 'activo',
        })
        .andWhere('otro.dia_semana = :diaSemana', {
          diaSemana: solicitud.dia_semana,
        })
        .andWhere('otro.hora_fin IS NOT NULL')
        .andWhere('otro.hora_inicio < :horaFin', {
          horaFin,
        })
        .andWhere('otro.hora_fin > :horaInicio', {
          horaInicio,
        })
        .andWhere(
          '(otro.fecha_fin IS NULL OR otro.fecha_fin >= :fechaInicio)',
          {
            fechaInicio,
          },
        )
        .getOne();

      if (turnoFijoConflicto) {
        throw new ConflictException(
          'La cancha ya tiene otro turno fijo activo que se superpone con este día y horario.',
        );
      }

      solicitud.cancha = cancha;
      solicitud.hora_fin = horaFin;
      solicitud.fecha_inicio = fechaInicio;
      solicitud.fecha_fin = null;
      solicitud.estado = 'activo';
      solicitud.motivo_rechazo = null;
      solicitud.alternativas = null;

      const guardada = await manager
        .getRepository(TurnoFijo)
        .save(solicitud);

      return {
        message: 'Turno fijo aprobado correctamente.',
        turno_fijo: {
          id_turno_fijo: guardada.id_turno_fijo,
          origen: guardada.origen,
          estado: guardada.estado,
          dia_semana: guardada.dia_semana,
          hora_inicio: guardada.hora_inicio,
          hora_fin: guardada.hora_fin,
          fecha_inicio: guardada.fecha_inicio,
          fecha_fin: guardada.fecha_fin,

          usuario: guardada.usuario
            ? {
                id_usuario: guardada.usuario.id_usuario,
                nombre_usuario:
                  guardada.usuario.nombre_usuario,
                apellido_usuario:
                  guardada.usuario.apellido_usuario,
                telefono_usuario:
                  guardada.usuario.telefono_usuario,
              }
            : null,

          club: {
            id_club: guardada.club.id_club,
            nombre_club: guardada.club.nombre_club,
          },

          deporte: {
            id_deporte: guardada.deporte.id_deporte,
            nombre_deporte:
              guardada.deporte.nombre_deporte,
          },

          cancha: {
            id_cancha: cancha.id_cancha,
            nombre_cancha: cancha.nombre_cancha,
          },
        },
      };
    });
  }

  async listarAlternativasReales(
    idTurnoFijo: number,
    usuario: AuthenticatedUser,
  ) {
    const idTurno = Number(idTurnoFijo);

    if (!Number.isInteger(idTurno) || idTurno <= 0) {
      throw new BadRequestException(
        'La solicitud de turno fijo indicada no es válida.',
      );
    }

    const solicitud = await this.turnoFijoRepository.findOne({
      where: {
        id_turno_fijo: idTurno,
      },
      relations: ['club', 'deporte'],
    });

    if (!solicitud) {
      throw new NotFoundException(
        'La solicitud de turno fijo no existe.',
      );
    }

    if (solicitud.estado !== 'pendiente') {
      throw new ConflictException(
        'Solo se pueden consultar alternativas para solicitudes pendientes.',
      );
    }

    await this.obtenerClubAdministrable(
      solicitud.club.id_club,
      usuario,
    );

    const canchas = await this.canchaRepository
      .createQueryBuilder('cancha')
      .innerJoinAndSelect('cancha.id_club', 'club')
      .innerJoinAndSelect('cancha.id_deporte', 'deporte')
      .where('club.id_club = :idClub', {
        idClub: solicitud.club.id_club,
      })
      .andWhere('deporte.id_deporte = :idDeporte', {
        idDeporte: solicitud.deporte.id_deporte,
      })
      .andWhere('cancha.activa = :activa', {
        activa: 1,
      })
      .orderBy('cancha.id_cancha', 'ASC')
      .getMany();

    if (!canchas.length) {
      return [];
    }

    const idsCancha = canchas.map((cancha) =>
      Number(cancha.id_cancha),
    );

    const disponibilidades =
      await this.disponibilidadRepository.find({
        where: {
          cancha: {
            id_cancha: In(idsCancha),
          },
        },
        relations: ['cancha'],
        order: {
          dia_semana: 'ASC',
          hora_inicio: 'ASC',
        },
      });

    const disponibilidadesPorCancha =
      new Map<number, Disponibilidad[]>();

    for (const item of disponibilidades) {
      const idCancha = Number(item.cancha?.id_cancha);
      if (!idCancha) continue;

      const actuales =
        disponibilidadesPorCancha.get(idCancha) || [];

      actuales.push(item);
      disponibilidadesPorCancha.set(
        idCancha,
        actuales,
      );
    }

    /*
      Cargamos los turnos fijos ya activos de las canchas compatibles.
      Para sugerir alternativas no necesitamos una fecha concreta:
      excluimos cualquier slot que ya esté estructuralmente ocupado
      por otro turno fijo recurrente.

      Las reservas y bloqueos de fechas puntuales se vuelven a validar
      cuando el dueño aprueba y define la fecha de inicio.
    */
    const turnosActivos = await this.turnoFijoRepository
      .createQueryBuilder('turno')
      .innerJoinAndSelect('turno.cancha', 'cancha')
      .where('cancha.id_cancha IN (:...idsCancha)', {
        idsCancha,
      })
      .andWhere('turno.estado = :estado', {
        estado: 'activo',
      })
      .andWhere('turno.hora_fin IS NOT NULL')
      .getMany();

    const turnosPorCancha =
      new Map<number, TurnoFijo[]>();

    for (const turno of turnosActivos) {
      const idCancha = Number(
        turno.cancha?.id_cancha,
      );

      if (!idCancha) continue;

      const actuales =
        turnosPorCancha.get(idCancha) || [];

      actuales.push(turno);
      turnosPorCancha.set(idCancha, actuales);
    }

    type AlternativaAgrupada = {
      dia_semana: number;
      hora_inicio: string;
      hora_fin: string;
      canchas: Array<{
        id_cancha: number;
        nombre_cancha: string;
      }>;
    };

    const agrupadas =
      new Map<string, AlternativaAgrupada>();

    const agregarSiLibre = (
      cancha: Cancha,
      diaSemana: number,
      horaInicioValor: string,
      horaFinValor: string,
    ) => {
      const horaInicio =
        this.normalizarHora(horaInicioValor);
      const horaFin =
        this.normalizarHoraFin(horaFinValor);

      /*
        No tiene sentido proponer exactamente el mismo día/hora
        que el usuario pidió originalmente.
      */
      if (
        Number(solicitud.dia_semana) === diaSemana &&
        this.normalizarHora(
          solicitud.hora_inicio,
        ) === horaInicio
      ) {
        return;
      }

      const inicioNuevo =
        Number(horaInicio.slice(0, 2)) * 60 +
        Number(horaInicio.slice(3, 5));

      const finNuevo =
        horaFin === '24:00'
          ? 24 * 60
          : Number(horaFin.slice(0, 2)) * 60 +
            Number(horaFin.slice(3, 5));

      const ocupaciones =
        turnosPorCancha.get(
          Number(cancha.id_cancha),
        ) || [];

      const chocaConTurnoFijo =
        ocupaciones.some((turno) => {
          if (
            Number(turno.dia_semana) !==
            diaSemana
          ) {
            return false;
          }

          const inicioExistenteTexto =
            this.normalizarHora(
              turno.hora_inicio,
            );

          const finExistenteTexto =
            this.normalizarHoraFin(
              turno.hora_fin || '',
            );

          const inicioExistente =
            Number(
              inicioExistenteTexto.slice(0, 2),
            ) *
              60 +
            Number(
              inicioExistenteTexto.slice(3, 5),
            );

          const finExistente =
            finExistenteTexto === '24:00'
              ? 24 * 60
              : Number(
                  finExistenteTexto.slice(0, 2),
                ) *
                  60 +
                Number(
                  finExistenteTexto.slice(3, 5),
                );

          return (
            inicioExistente < finNuevo &&
            finExistente > inicioNuevo
          );
        });

      if (chocaConTurnoFijo) {
        return;
      }

      const key =
        `${diaSemana}-${horaInicio}-${horaFin}`;

      const existente = agrupadas.get(key);

      const canchaResumen = {
        id_cancha: Number(
          cancha.id_cancha,
        ),
        nombre_cancha:
          cancha.nombre_cancha,
      };

      if (existente) {
        existente.canchas.push(
          canchaResumen,
        );
        return;
      }

      agrupadas.set(key, {
        dia_semana: diaSemana,
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        canchas: [canchaResumen],
      });
    };

    for (const cancha of canchas) {
      const configuradas =
        disponibilidadesPorCancha.get(
          Number(cancha.id_cancha),
        ) || [];

      /*
        Sin configuración específica mantenemos el comportamiento
        histórico: todos los días, 09:00 a 22:00, turnos de 60 minutos.
      */
      if (configuradas.length === 0) {
        for (
          let diaSemana = 0;
          diaSemana <= 6;
          diaSemana += 1
        ) {
          for (
            let hora = 9;
            hora <= 22;
            hora += 1
          ) {
            const horaInicio =
              `${String(hora).padStart(
                2,
                '0',
              )}:00`;

            const horaFin =
              this.sumarMinutos(
                horaInicio,
                60,
              );

            agregarSiLibre(
              cancha,
              diaSemana,
              horaInicio,
              horaFin,
            );
          }
        }

        continue;
      }

      for (const item of configuradas) {
        agregarSiLibre(
          cancha,
          Number(item.dia_semana),
          item.hora_inicio,
          item.hora_fin,
        );
      }
    }

    return Array.from(agrupadas.values()).sort(
      (a, b) => {
        /*
          Primero mostramos alternativas del mismo día solicitado.
          Después el resto de los días en orden semanal.
        */
        const aMismoDia =
          a.dia_semana ===
          Number(solicitud.dia_semana)
            ? 0
            : 1;

        const bMismoDia =
          b.dia_semana ===
          Number(solicitud.dia_semana)
            ? 0
            : 1;

        if (aMismoDia !== bMismoDia) {
          return aMismoDia - bMismoDia;
        }

        if (
          a.dia_semana !==
          b.dia_semana
        ) {
          return (
            a.dia_semana -
            b.dia_semana
          );
        }

        return a.hora_inicio.localeCompare(
          b.hora_inicio,
        );
      },
    );
  }


  async rechazarSolicitud(
    idTurnoFijo: number,
    dto: RechazarTurnoFijoDto,
    usuario: AuthenticatedUser,
  ) {
    const idTurno = Number(idTurnoFijo);

    if (!Number.isInteger(idTurno) || idTurno <= 0) {
      throw new BadRequestException(
        'La solicitud de turno fijo indicada no es válida.',
      );
    }

    const motivo = String(dto.motivo || '').trim();

    if (motivo.length < 2) {
      throw new BadRequestException(
        'Indicá un motivo para rechazar la solicitud.',
      );
    }

    /*
      Volvemos a obtener alternativas reales antes de guardar.
      Así no confiamos en horarios arbitrarios enviados por el frontend.
    */
    const alternativasReales =
      await this.listarAlternativasReales(
        idTurno,
        usuario,
      );

    const alternativasSolicitadas =
      dto.alternativas || [];

    const normalizadas = alternativasSolicitadas.map(
      (alternativa) => ({
        dia_semana: Number(
          alternativa.dia_semana,
        ),
        hora_inicio: this.normalizarHora(
          alternativa.hora_inicio,
        ),
        hora_fin: this.normalizarHoraFin(
          alternativa.hora_fin,
        ),
        id_cancha:
          alternativa.id_cancha !== undefined
            ? Number(alternativa.id_cancha)
            : null,
      }),
    );

    const claves = new Set<string>();

    for (const alternativa of normalizadas) {
      const real = alternativasReales.find(
        (item) =>
          Number(item.dia_semana) ===
            alternativa.dia_semana &&
          this.normalizarHora(
            item.hora_inicio,
          ) === alternativa.hora_inicio &&
          this.normalizarHoraFin(
            item.hora_fin,
          ) === alternativa.hora_fin,
      );

      if (!real) {
        throw new BadRequestException(
          'Una de las alternativas propuestas ya no está disponible o no corresponde al club/deporte.',
        );
      }

      if (
        alternativa.id_cancha !== null &&
        !real.canchas.some(
          (cancha) =>
            Number(cancha.id_cancha) ===
            alternativa.id_cancha,
        )
      ) {
        throw new BadRequestException(
          'La cancha indicada para una alternativa no es válida.',
        );
      }

      const clave =
        `${alternativa.dia_semana}-${alternativa.hora_inicio}-${alternativa.hora_fin}`;

      if (claves.has(clave)) {
        throw new BadRequestException(
          'No repitas la misma alternativa.',
        );
      }

      claves.add(clave);
    }

    return this.dataSource.transaction(
      async (manager) => {
        const solicitud = await manager
          .getRepository(TurnoFijo)
          .createQueryBuilder('turno')
          .innerJoinAndSelect(
            'turno.club',
            'club',
          )
          .leftJoinAndSelect(
            'club.dueno',
            'dueno',
          )
          .innerJoinAndSelect(
            'turno.deporte',
            'deporte',
          )
          .leftJoinAndSelect(
            'turno.usuario',
            'usuarioTurno',
          )
          .where(
            'turno.id_turno_fijo = :idTurno',
            { idTurno },
          )
          .setLock(
            'pessimistic_write',
            undefined,
            ['turno'],
          )
          .getOne();

        if (!solicitud) {
          throw new NotFoundException(
            'La solicitud de turno fijo no existe.',
          );
        }

        if (solicitud.estado !== 'pendiente') {
          throw new ConflictException(
            'Solo se pueden rechazar solicitudes pendientes.',
          );
        }

        if (usuario.tipo !== 'admin') {
          const esResponsable =
            usuario.tipo === 'dueno' ||
            usuario.tipo === 'club';

          if (!esResponsable) {
            throw new ForbiddenException(
              'Solo el responsable del club puede rechazar un turno fijo.',
            );
          }

          if (
            Number(
              solicitud.club.dueno?.id_usuario,
            ) !== Number(usuario.sub)
          ) {
            throw new ForbiddenException(
              'No tenés permiso para administrar este club.',
            );
          }
        }

        if (solicitud.club.estado !== 'activo') {
          throw new ForbiddenException(
            'El club se encuentra inactivo y no puede operar.',
          );
        }

        solicitud.estado = 'rechazado';
        solicitud.motivo_rechazo = motivo;
        solicitud.alternativas =
          normalizadas.map(
            (alternativa) => ({
              dia_semana:
                alternativa.dia_semana,
              hora_inicio:
                alternativa.hora_inicio,
              hora_fin:
                alternativa.hora_fin,
              id_cancha:
                alternativa.id_cancha,
            }),
          );

        const guardada = await manager
          .getRepository(TurnoFijo)
          .save(solicitud);

        return {
          message:
            'Solicitud de turno fijo rechazada correctamente.',
          turno_fijo: {
            id_turno_fijo:
              guardada.id_turno_fijo,
            estado: guardada.estado,
            motivo_rechazo:
              guardada.motivo_rechazo,
            alternativas:
              guardada.alternativas,
            usuario: guardada.usuario
              ? {
                  id_usuario:
                    guardada.usuario.id_usuario,
                  nombre_usuario:
                    guardada.usuario.nombre_usuario,
                  apellido_usuario:
                    guardada.usuario.apellido_usuario,
                  telefono_usuario:
                    guardada.usuario.telefono_usuario,
                }
              : null,
            club: {
              id_club:
                guardada.club.id_club,
              nombre_club:
                guardada.club.nombre_club,
            },
            deporte: {
              id_deporte:
                guardada.deporte.id_deporte,
              nombre_deporte:
                guardada.deporte.nombre_deporte,
            },
            dia_semana:
              guardada.dia_semana,
            hora_inicio:
              guardada.hora_inicio,
          },
        };
      },
    );
  }



  async crearTurnoFijoManual(
    dto: CreateTurnoFijoManualDto,
    usuario: AuthenticatedUser,
  ) {
    const esResponsable =
      usuario.tipo === 'dueno' ||
      usuario.tipo === 'club' ||
      usuario.tipo === 'admin';

    if (!esResponsable) {
      throw new ForbiddenException(
        'Solo el responsable de un club puede cargar turnos fijos manuales.',
      );
    }

    const idCancha = Number(dto.id_cancha);
    const diaSemana = Number(dto.dia_semana);
    const horaInicio = this.normalizarHora(
      dto.hora_inicio,
    );
    const fechaInicio = String(
      dto.fecha_inicio || '',
    ).trim();

    if (
      !Number.isInteger(idCancha) ||
      idCancha <= 0
    ) {
      throw new BadRequestException(
        'La cancha indicada no es válida.',
      );
    }

    if (
      !Number.isInteger(diaSemana) ||
      diaSemana < 0 ||
      diaSemana > 6
    ) {
      throw new BadRequestException(
        'El día de la semana indicado no es válido.',
      );
    }

    if (!this.esFechaISOValida(fechaInicio)) {
      throw new BadRequestException(
        'La fecha de inicio no es válida.',
      );
    }

    if (
      fechaInicio < this.obtenerHoyArgentina()
    ) {
      throw new BadRequestException(
        'La fecha de inicio no puede estar en el pasado.',
      );
    }

    if (
      this.obtenerDiaSemana(fechaInicio) !==
      diaSemana
    ) {
      throw new BadRequestException(
        'La fecha de inicio debe corresponder al día de la semana seleccionado.',
      );
    }

    const cancha =
      await this.canchaRepository.findOne({
        where: {
          id_cancha: idCancha,
        },
        relations: [
          'id_club',
          'id_club.dueno',
          'id_deporte',
        ],
      });

    if (!cancha || Number(cancha.activa) !== 1) {
      throw new NotFoundException(
        'Cancha no encontrada o inactiva.',
      );
    }

    const club = cancha.id_club;

    if (!club) {
      throw new NotFoundException(
        'La cancha no tiene un club asociado.',
      );
    }

    if (club.estado !== 'activo') {
      throw new ForbiddenException(
        'El club se encuentra inactivo y no puede operar.',
      );
    }

    if (
      usuario.tipo !== 'admin' &&
      Number(club.dueno?.id_usuario) !==
        Number(usuario.sub)
    ) {
      throw new ForbiddenException(
        'No tenés permiso para administrar este club.',
      );
    }

    const deporte = cancha.id_deporte;

    if (!deporte) {
      throw new NotFoundException(
        'La cancha no tiene un deporte asociado.',
      );
    }

    /*
      Validamos el slot antes de crear la fila pendiente temporal.
      La aprobación vuelve a validarlo dentro de su transacción.
    */
    await this.resolverHoraFinParaCancha(
      this.dataSource.manager,
      idCancha,
      diaSemana,
      horaInicio,
    );

    let usuarioVinculado: User | null = null;

    if (dto.id_usuario !== undefined) {
      const idUsuario = Number(dto.id_usuario);

      usuarioVinculado =
        await this.dataSource
          .getRepository(User)
          .findOne({
            where: {
              id_usuario: idUsuario,
            },
          });

      if (!usuarioVinculado) {
        throw new NotFoundException(
          'El usuario indicado no existe.',
        );
      }
    }

    let nombreCliente = String(
      dto.nombre_cliente || '',
    ).trim();

    let telefonoCliente = String(
      dto.telefono_cliente || '',
    ).trim();

    if (
      !nombreCliente &&
      usuarioVinculado
    ) {
      nombreCliente = [
        usuarioVinculado.nombre_usuario,
        usuarioVinculado.apellido_usuario,
      ]
        .filter(Boolean)
        .join(' ')
        .trim();
    }

    if (
      !telefonoCliente &&
      usuarioVinculado?.telefono_usuario
    ) {
      telefonoCliente = String(
        usuarioVinculado.telefono_usuario,
      ).trim();
    }

    if (!usuarioVinculado && !nombreCliente) {
      throw new BadRequestException(
        'Indicá el nombre del cliente o vinculá un usuario registrado.',
      );
    }

    /*
      Creamos una solicitud pendiente interna y enseguida usamos
      aprobarSolicitud(). De esa forma reutilizamos exactamente las
      mismas validaciones de:
      - propiedad del club;
      - cancha/deporte;
      - disponibilidad configurada;
      - reservas futuras;
      - bloqueos futuros;
      - otros turnos fijos activos.
    */
    const borrador =
      this.turnoFijoRepository.create({
        origen: 'club',
        estado: 'pendiente',
        dia_semana: diaSemana,
        hora_inicio: horaInicio,
        hora_fin: null,
        fecha_inicio: null,
        fecha_fin: null,
        motivo_rechazo: null,
        alternativas: null,
        nombre_cliente_manual:
          nombreCliente || null,
        telefono_cliente_manual:
          telefonoCliente || null,
        usuario: usuarioVinculado,
        club,
        deporte,
        cancha: null,
      });

    const guardado =
      await this.turnoFijoRepository.save(
        borrador,
      );

    try {
      await this.aprobarSolicitud(
        guardado.id_turno_fijo,
        {
          id_cancha: idCancha,
          fecha_inicio: fechaInicio,
        },
        usuario,
      );
    } catch (error) {
      /*
        Si la aprobación falla por una validación de negocio,
        no dejamos una solicitud manual pendiente huérfana.
      */
      const pendiente =
        await this.turnoFijoRepository.findOne({
          where: {
            id_turno_fijo:
              guardado.id_turno_fijo,
          },
        });

      if (
        pendiente &&
        pendiente.origen === 'club' &&
        pendiente.estado === 'pendiente'
      ) {
        await this.turnoFijoRepository.remove(
          pendiente,
        );
      }

      throw error;
    }

    const turnoActivo =
      await this.turnoFijoRepository.findOne({
        where: {
          id_turno_fijo:
            guardado.id_turno_fijo,
        },
        relations: [
          'usuario',
          'club',
          'deporte',
          'cancha',
        ],
      });

    if (!turnoActivo) {
      throw new NotFoundException(
        'No se pudo recuperar el turno fijo creado.',
      );
    }

    return {
      message:
        'Turno fijo manual registrado correctamente.',
      turno_fijo: {
        id_turno_fijo:
          turnoActivo.id_turno_fijo,
        origen: turnoActivo.origen,
        estado: turnoActivo.estado,
        dia_semana:
          turnoActivo.dia_semana,
        hora_inicio:
          turnoActivo.hora_inicio,
        hora_fin:
          turnoActivo.hora_fin,
        fecha_inicio:
          turnoActivo.fecha_inicio,
        fecha_fin:
          turnoActivo.fecha_fin,
        nombre_cliente_manual:
          turnoActivo.nombre_cliente_manual,
        telefono_cliente_manual:
          turnoActivo.telefono_cliente_manual,

        usuario: turnoActivo.usuario
          ? {
              id_usuario:
                turnoActivo.usuario
                  .id_usuario,
              nombre_usuario:
                turnoActivo.usuario
                  .nombre_usuario,
              apellido_usuario:
                turnoActivo.usuario
                  .apellido_usuario,
              telefono_usuario:
                turnoActivo.usuario
                  .telefono_usuario,
            }
          : null,

        club: {
          id_club:
            turnoActivo.club.id_club,
          nombre_club:
            turnoActivo.club.nombre_club,
        },

        deporte: {
          id_deporte:
            turnoActivo.deporte.id_deporte,
          nombre_deporte:
            turnoActivo.deporte
              .nombre_deporte,
        },

        cancha: turnoActivo.cancha
          ? {
              id_cancha:
                turnoActivo.cancha
                  .id_cancha,
              nombre_cancha:
                turnoActivo.cancha
                  .nombre_cancha,
            }
          : null,
      },
    };
  }


  async finalizarTurnoFijoActivo(
  idTurnoFijo: number,
  usuario: AuthenticatedUser,
) {
  const idTurno = Number(idTurnoFijo);

  if (
    !Number.isInteger(idTurno) ||
    idTurno <= 0
  ) {
    throw new BadRequestException(
      'El turno fijo indicado no es válido.',
    );
  }

  return this.dataSource.transaction(
    async (manager) => {
      const turno = await manager
        .getRepository(TurnoFijo)
        .createQueryBuilder('turno')
        .innerJoinAndSelect(
          'turno.club',
          'club',
        )
        .leftJoinAndSelect(
          'club.dueno',
          'dueno',
        )
        .leftJoinAndSelect(
          'turno.usuario',
          'usuarioTurno',
        )
        .leftJoinAndSelect(
          'turno.cancha',
          'cancha',
        )
        .innerJoinAndSelect(
          'turno.deporte',
          'deporte',
        )
        .where(
          'turno.id_turno_fijo = :idTurno',
          {
            idTurno,
          },
        )
        .setLock(
          'pessimistic_write',
          undefined,
          ['turno'],
        )
        .getOne();

      if (!turno) {
        throw new NotFoundException(
          'El turno fijo no existe.',
        );
      }

      if (turno.estado !== 'activo') {
        throw new ConflictException(
          'Solo se pueden finalizar turnos fijos activos.',
        );
      }

      if (usuario.tipo !== 'admin') {
        const esResponsable =
          usuario.tipo === 'dueno' ||
          usuario.tipo === 'club';

        if (!esResponsable) {
          throw new ForbiddenException(
            'Solo el responsable del club puede finalizar un turno fijo.',
          );
        }

        if (
          Number(
            turno.club.dueno?.id_usuario,
          ) !== Number(usuario.sub)
        ) {
          throw new ForbiddenException(
            'No tenés permiso para administrar este club.',
          );
        }
      }

      if (!turno.fecha_inicio) {
        throw new ConflictException(
          'El turno fijo no tiene una fecha de inicio válida.',
        );
      }

      /*
        fecha_fin representa la última ocurrencia que
        realmente estuvo vigente.

        No usamos simplemente "hoy":
        si hoy es viernes y el turno es viernes a las
        19:30 pero lo cancelamos a las 10:00,
        ese turno de hoy nunca ocurrió.
      */
      turno.fecha_fin =
        this.calcularUltimaFechaVigenteTurno(
          turno,
        );

      turno.estado = 'cancelado';

      const guardado = await manager
        .getRepository(TurnoFijo)
        .save(turno);

      return {
        message:
          'Turno fijo finalizado correctamente.',

        turno_fijo: {
          id_turno_fijo:
            guardado.id_turno_fijo,

          estado:
            guardado.estado,

          dia_semana:
            guardado.dia_semana,

          hora_inicio:
            guardado.hora_inicio,

          hora_fin:
            guardado.hora_fin,

          fecha_inicio:
            guardado.fecha_inicio,

          fecha_fin:
            guardado.fecha_fin,

          club: {
            id_club:
              guardado.club.id_club,

            nombre_club:
              guardado.club.nombre_club,
          },

          deporte: {
            id_deporte:
              guardado.deporte.id_deporte,

            nombre_deporte:
              guardado.deporte
                .nombre_deporte,
          },

          cancha: guardado.cancha
            ? {
                id_cancha:
                  guardado.cancha
                    .id_cancha,

                nombre_cancha:
                  guardado.cancha
                    .nombre_cancha,
              }
            : null,
        },
      };
    },
  );
}


  async listarTurnosFijosActivosClub(
    idClub: number,
    usuario: AuthenticatedUser,
  ) {
    const club = await this.obtenerClubAdministrable(
      idClub,
      usuario,
    );

    const turnos = await this.turnoFijoRepository.find({
      where: {
        club: {
          id_club: club.id_club,
        },
        estado: 'activo',
      },
      relations: ['usuario', 'club', 'deporte', 'cancha'],
      order: {
        dia_semana: 'ASC',
        hora_inicio: 'ASC',
      },
    });

    return turnos.map((turno) => ({
      id_turno_fijo: turno.id_turno_fijo,
      origen: turno.origen,
      estado: turno.estado,
      dia_semana: turno.dia_semana,
      hora_inicio: turno.hora_inicio,
      hora_fin: turno.hora_fin,
      fecha_inicio: turno.fecha_inicio,
      fecha_fin: turno.fecha_fin,
      nombre_cliente_manual: turno.nombre_cliente_manual,
      telefono_cliente_manual: turno.telefono_cliente_manual,
      created_at: turno.created_at,
      updated_at: turno.updated_at,

      usuario: turno.usuario
        ? {
            id_usuario: turno.usuario.id_usuario,
            nombre_usuario: turno.usuario.nombre_usuario,
            apellido_usuario: turno.usuario.apellido_usuario,
            telefono_usuario: turno.usuario.telefono_usuario,
          }
        : null,

      club: {
        id_club: turno.club.id_club,
        nombre_club: turno.club.nombre_club,
      },

      deporte: {
        id_deporte: turno.deporte.id_deporte,
        nombre_deporte: turno.deporte.nombre_deporte,
      },

      cancha: turno.cancha
        ? {
            id_cancha: turno.cancha.id_cancha,
            nombre_cancha: turno.cancha.nombre_cancha,
          }
        : null,
    }));
  }

  async eliminarTurnoFijoRechazado(
    idTurnoFijo: number,
    usuario: AuthenticatedUser,
  ) {
    if (usuario.tipo !== 'usuario') {
      throw new ForbiddenException(
        'Solo el usuario puede eliminar una solicitud rechazada de su listado.',
      );
    }

    const turno = await this.turnoFijoRepository.findOne({
      where: {
        id_turno_fijo: Number(idTurnoFijo),
      },
      relations: ['usuario'],
    });

    if (!turno) {
      throw new NotFoundException(
        'La solicitud de turno fijo no existe.',
      );
    }

    if (
      !turno.usuario ||
      Number(turno.usuario.id_usuario) !== Number(usuario.sub)
    ) {
      throw new ForbiddenException(
        'No tenés permiso para eliminar esta solicitud.',
      );
    }

    if (turno.estado !== 'rechazado') {
      throw new BadRequestException(
        'Solo se pueden eliminar solicitudes de turno fijo rechazadas.',
      );
    }

    await this.turnoFijoRepository.remove(turno);

    return {
      message:
        'Solicitud de turno fijo eliminada correctamente.',
      id_turno_fijo: Number(idTurnoFijo),
    };
  }

  async listarMisTurnosFijos(
    usuario: AuthenticatedUser,
  ) {
    if (usuario.tipo !== 'usuario') {
      throw new ForbiddenException(
        'Este listado corresponde únicamente a usuarios.',
      );
    }

    const turnos = await this.turnoFijoRepository.find({
      where: {
        usuario: {
          id_usuario: Number(usuario.sub),
        },
      },
      relations: ['club', 'deporte', 'cancha'],
      order: {
        created_at: 'DESC',
      },
    });

    return turnos.map((turno) => ({
      id_turno_fijo: turno.id_turno_fijo,
      origen: turno.origen,
      estado: turno.estado,
      dia_semana: turno.dia_semana,
      hora_inicio: turno.hora_inicio,
      hora_fin: turno.hora_fin,
      fecha_inicio: turno.fecha_inicio,
      fecha_fin: turno.fecha_fin,
      motivo_rechazo: turno.motivo_rechazo,
      alternativas: turno.alternativas,
      created_at: turno.created_at,
      updated_at: turno.updated_at,

      club: {
        id_club: turno.club.id_club,
        nombre_club: turno.club.nombre_club,
      },

      deporte: {
        id_deporte: turno.deporte.id_deporte,
        nombre_deporte: turno.deporte.nombre_deporte,
      },

      cancha: turno.cancha
        ? {
            id_cancha: turno.cancha.id_cancha,
            nombre_cancha: turno.cancha.nombre_cancha,
          }
        : null,
    }));
  }

}
