import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { Cancha } from '../cancha/entities/cancha.entity';
import { Reserva } from '../reserva/entities/reserva.entity';
import { CreateBloqueoCanchaDto } from './dto/create-bloqueo-cancha.dto';
import { UpdateBloqueoCanchaDto } from './dto/update-bloqueo-cancha.dto';
import { BloqueoCancha } from './entities/bloqueo-cancha.entity';

export interface UsuarioAutenticado {
  sub: number;
  tipo: string;
}

@Injectable()
export class BloqueoCanchaService {
  constructor(
    @InjectRepository(BloqueoCancha)
    private readonly bloqueoRepository: Repository<BloqueoCancha>,

    @InjectRepository(Cancha)
    private readonly canchaRepository: Repository<Cancha>,

    @InjectRepository(Reserva)
    private readonly reservaRepository: Repository<Reserva>,

    private readonly dataSource: DataSource,
  ) {}

  private normalizarHora(hora: string): string {
    const [horas, minutos, segundos = '00'] = hora.split(':');

    return [
      String(Number(horas)).padStart(2, '0'),
      String(Number(minutos)).padStart(2, '0'),
      String(Number(segundos)).padStart(2, '0'),
    ].join(':');
  }

  private validarRangoHorario(horaInicio: string, horaFin: string) {
    if (horaInicio >= horaFin) {
      throw new BadRequestException(
        'La hora de inicio debe ser anterior a la hora de finalización.',
      );
    }
  }

  private async obtenerCanchaYValidarPermiso(
    idCancha: number,
    usuario: UsuarioAutenticado,
  ) {
    const cancha = await this.canchaRepository.findOne({
      where: { id_cancha: idCancha },
      relations: ['id_club', 'id_club.dueno'],
    });

    if (!cancha) {
      throw new NotFoundException('La cancha indicada no existe.');
    }

    if (usuario.tipo === 'admin') {
      return cancha;
    }

    const idDueno = cancha.id_club?.dueno?.id_usuario;

    if (!idDueno || Number(idDueno) !== Number(usuario.sub)) {
      throw new ForbiddenException(
        'No tenés permiso para gestionar esta cancha.',
      );
    }

    return cancha;
  }

  private buscarBloqueoSolapado({
    idCancha,
    fecha,
    horaInicio,
    horaFin,
    excluirId,
    manager,
  }: {
    idCancha: number;
    fecha: string;
    horaInicio: string;
    horaFin: string;
    excluirId?: number;
    manager?: EntityManager;
  }) {
    const repository = manager?.getRepository(BloqueoCancha) ?? this.bloqueoRepository;
    const query = repository
      .createQueryBuilder('bloqueo')
      .innerJoin('bloqueo.cancha', 'cancha')
      .where('cancha.id_cancha = :idCancha', { idCancha })
      .andWhere('bloqueo.fecha = :fecha', { fecha })
      .andWhere('bloqueo.activo = :activo', { activo: 1 })
      .andWhere('bloqueo.hora_inicio < :horaFin', { horaFin })
      .andWhere('bloqueo.hora_fin > :horaInicio', { horaInicio });

    if (excluirId !== undefined) {
      query.andWhere('bloqueo.id_bloqueo != :excluirId', { excluirId });
    }

    return query.getOne();
  }

  private buscarReservaSolapada({
    idCancha,
    fecha,
    horaInicio,
    horaFin,
    manager,
  }: {
    idCancha: number;
    fecha: string;
    horaInicio: string;
    horaFin: string;
    manager?: EntityManager;
  }) {
    const repository = manager?.getRepository(Reserva) ?? this.reservaRepository;
    return repository
      .createQueryBuilder('reserva')
      .innerJoin('reserva.cancha', 'cancha')
      .where('cancha.id_cancha = :idCancha', { idCancha })
      .andWhere('reserva.fecha = :fecha', { fecha })
      .andWhere('reserva.estado != :estadoCancelado', {
        estadoCancelado: 'cancelada',
      })
      .andWhere('reserva.hora_inicio < :horaFin', { horaFin })
      .andWhere('reserva.hora_fin > :horaInicio', { horaInicio })
      .getOne();
  }

  async buscarActivoSolapado(
    idCancha: number,
    fecha: Date | string,
    horaInicio: string,
    horaFin: string,
  ) {
    return this.buscarBloqueoSolapado({
      idCancha,
      fecha: String(fecha).slice(0, 10),
      horaInicio: this.normalizarHora(horaInicio),
      horaFin: this.normalizarHora(horaFin),
    });
  }

  async findActivosPorCanchaYFecha(idCancha: number, fecha: string) {
    return this.bloqueoRepository
      .createQueryBuilder('bloqueo')
      .innerJoin('bloqueo.cancha', 'cancha')
      .where('cancha.id_cancha = :idCancha', { idCancha })
      .andWhere('bloqueo.fecha = :fecha', { fecha })
      .andWhere('bloqueo.activo = :activo', { activo: 1 })
      .orderBy('bloqueo.hora_inicio', 'ASC')
      .getMany();
  }

  async create(
    dto: CreateBloqueoCanchaDto,
    usuario: UsuarioAutenticado,
  ) {
    await this.obtenerCanchaYValidarPermiso(dto.id_cancha, usuario);

    const horaInicio = this.normalizarHora(dto.hora_inicio);
    const horaFin = this.normalizarHora(dto.hora_fin);
    const fecha = dto.fecha.slice(0, 10);

    this.validarRangoHorario(horaInicio, horaFin);

    return this.dataSource.transaction(async (manager) => {
      // En PostgreSQL evitamos hacer SELECT ... FOR UPDATE sobre relaciones
      // cargadas con LEFT JOIN. PostgreSQL no permite bloquear el lado nullable
      // de un OUTER JOIN y eso provocaba un 500 al crear bloqueos.
      // El permiso del dueño ya fue validado antes de entrar a la transacción;
      // acá solo bloqueamos la fila real de la cancha para serializar reservas
      // y bloqueos concurrentes sobre la misma cancha.
      const cancha = await manager
        .getRepository(Cancha)
        .createQueryBuilder('cancha')
        .where('cancha.id_cancha = :idCancha', { idCancha: dto.id_cancha })
        .setLock('pessimistic_write')
        .getOne();

      if (!cancha) {
        throw new NotFoundException('La cancha indicada no existe.');
      }

      const bloqueoExistente = await this.buscarBloqueoSolapado({
        idCancha: dto.id_cancha,
        fecha,
        horaInicio,
        horaFin,
        manager,
      });
      const reservaExistente = await this.buscarReservaSolapada({
        idCancha: dto.id_cancha,
        fecha,
        horaInicio,
        horaFin,
        manager,
      });

      if (bloqueoExistente) {
        throw new ConflictException(
          'Ya existe un bloqueo que se superpone con ese horario.',
        );
      }

      if (reservaExistente) {
        throw new ConflictException(
          'No se puede bloquear el horario porque ya existe una reserva confirmada.',
        );
      }

      const repository = manager.getRepository(BloqueoCancha);
      const bloqueo = repository.create({
        cancha,
        fecha,
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        tipo: dto.tipo,
        motivo: dto.motivo?.trim() || null,
        activo: 1,
      });

      return repository.save(bloqueo);
    });
  }

  async findByCancha(
    idCancha: number,
    usuario: UsuarioAutenticado,
    fecha?: string,
  ) {
    await this.obtenerCanchaYValidarPermiso(idCancha, usuario);

    const query = this.bloqueoRepository
      .createQueryBuilder('bloqueo')
      .innerJoinAndSelect('bloqueo.cancha', 'cancha')
      .where('cancha.id_cancha = :idCancha', { idCancha })
      .andWhere('bloqueo.activo = :activo', { activo: 1 });

    if (fecha) {
      query.andWhere('bloqueo.fecha = :fecha', {
        fecha: fecha.slice(0, 10),
      });
    }

    return query
      .orderBy('bloqueo.fecha', 'ASC')
      .addOrderBy('bloqueo.hora_inicio', 'ASC')
      .getMany();
  }

  async update(
    id: number,
    dto: UpdateBloqueoCanchaDto,
    usuario: UsuarioAutenticado,
  ) {
    const actual = await this.bloqueoRepository.findOne({
      where: { id_bloqueo: id },
      relations: ['cancha', 'cancha.id_club', 'cancha.id_club.dueno'],
    });

    if (!actual || !actual.activo) {
      throw new NotFoundException('El bloqueo indicado no existe.');
    }

    await this.obtenerCanchaYValidarPermiso(actual.cancha.id_cancha, usuario);
    const idCanchaFinal = dto.id_cancha ?? actual.cancha.id_cancha;
    if (idCanchaFinal !== actual.cancha.id_cancha) {
      await this.obtenerCanchaYValidarPermiso(idCanchaFinal, usuario);
    }

    const fechaFinal = dto.fecha?.slice(0, 10) ?? actual.fecha;
    const horaInicioFinal = this.normalizarHora(dto.hora_inicio ?? actual.hora_inicio);
    const horaFinFinal = this.normalizarHora(dto.hora_fin ?? actual.hora_fin);

    this.validarRangoHorario(horaInicioFinal, horaFinFinal);

    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(BloqueoCancha);
      // Mismo criterio que en create(): bloquear únicamente la fila de
      // bloqueo, sin JOINs, para que PostgreSQL pueda aplicar FOR UPDATE.
      const bloqueo = await repository
        .createQueryBuilder('bloqueo')
        .where('bloqueo.id_bloqueo = :id', { id })
        .andWhere('bloqueo.activo = :activo', { activo: 1 })
        .setLock('pessimistic_write')
        .getOne();

      if (!bloqueo || !bloqueo.activo) {
        throw new NotFoundException('El bloqueo indicado no existe.');
      }

      const canchaFinal = await manager.getRepository(Cancha).findOne({
        where: { id_cancha: idCanchaFinal },
        lock: { mode: 'pessimistic_write' },
      });

      if (!canchaFinal) {
        throw new NotFoundException('La cancha indicada no existe.');
      }

      const otroBloqueo = await this.buscarBloqueoSolapado({
        idCancha: idCanchaFinal,
        fecha: fechaFinal,
        horaInicio: horaInicioFinal,
        horaFin: horaFinFinal,
        excluirId: id,
        manager,
      });
      const reservaExistente = await this.buscarReservaSolapada({
        idCancha: idCanchaFinal,
        fecha: fechaFinal,
        horaInicio: horaInicioFinal,
        horaFin: horaFinFinal,
        manager,
      });

      if (otroBloqueo) {
        throw new ConflictException(
          'Ya existe otro bloqueo que se superpone con ese horario.',
        );
      }

      if (reservaExistente) {
        throw new ConflictException(
          'No se puede modificar el bloqueo porque existe una reserva en ese horario.',
        );
      }

      bloqueo.cancha = canchaFinal;
      bloqueo.fecha = fechaFinal;
      bloqueo.hora_inicio = horaInicioFinal;
      bloqueo.hora_fin = horaFinFinal;

      if (dto.tipo !== undefined) bloqueo.tipo = dto.tipo;
      if (dto.motivo !== undefined) bloqueo.motivo = dto.motivo.trim() || null;

      return repository.save(bloqueo);
    });
  }

  async remove(id: number, usuario: UsuarioAutenticado) {
    const bloqueo = await this.bloqueoRepository.findOne({
      where: { id_bloqueo: id },
      relations: ['cancha', 'cancha.id_club', 'cancha.id_club.dueno'],
    });

    if (!bloqueo || !bloqueo.activo) {
      throw new NotFoundException('El bloqueo indicado no existe.');
    }

    await this.obtenerCanchaYValidarPermiso(
      bloqueo.cancha.id_cancha,
      usuario,
    );

    bloqueo.activo = 0;
    await this.bloqueoRepository.save(bloqueo);

    return {
      message: 'El turno fue liberado correctamente.',
      id_bloqueo: bloqueo.id_bloqueo,
    };
  }
}