import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Deporte } from '../deporte/entities/deporte.entity';
import { User } from '../user/entities/user.entity';
import { CreateDisponibilidadJugadorDto } from './dto/create-disponibilidad-jugador.dto';
import { CreateSolicitudJugadorDto } from './dto/create-solicitud-jugador.dto';
import { UpdateDisponibilidadJugadorDto } from './dto/update-disponibilidad-jugador.dto';
import { UpdateEstadoDisponibilidadDto } from './dto/update-estado-disponibilidad.dto';
import { UpdateEstadoSolicitudDto } from './dto/update-estado-solicitud.dto';
import {
  DisponibilidadJugador,
  EstadoDisponibilidadJugador,
} from './entities/disponibilidad-jugador.entity';
import {
  EstadoSolicitudJugador,
  SolicitudJugador,
} from './entities/solicitud-jugador.entity';

export interface UsuarioAutenticadoBanco {
  sub: number;
  tipo: string;
}

export interface FiltrosBancoSuplentes {
  id_deporte?: number;
  ciudad?: string;
  nivel?: string;
  dia?: string;
  fecha?: string;
  hora?: string;
}

@Injectable()
export class BancoSuplentesService {
  constructor(
    @InjectRepository(DisponibilidadJugador)
    private readonly disponibilidadRepository: Repository<DisponibilidadJugador>,

    @InjectRepository(SolicitudJugador)
    private readonly solicitudRepository: Repository<SolicitudJugador>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Deporte)
    private readonly deporteRepository: Repository<Deporte>,
  ) {}

  private fechaHoy(): string {
    const hoy = new Date();

    return [
      hoy.getFullYear(),
      String(hoy.getMonth() + 1).padStart(2, '0'),
      String(hoy.getDate()).padStart(2, '0'),
    ].join('-');
  }

  private normalizarHora(hora: string): string {
    const [horas, minutos, segundos = '00'] = hora.split(':');

    return [
      String(Number(horas)).padStart(2, '0'),
      String(Number(minutos)).padStart(2, '0'),
      String(Number(segundos)).padStart(2, '0'),
    ].join(':');
  }

  private validarRango(
    fechaDesde: string,
    fechaHasta: string,
    horaDesde: string,
    horaHasta: string,
  ) {
    if (fechaDesde > fechaHasta) {
      throw new BadRequestException(
        'La fecha de inicio no puede ser posterior a la fecha final.',
      );
    }

    if (fechaHasta < this.fechaHoy()) {
      throw new BadRequestException(
        'La disponibilidad no puede finalizar en una fecha pasada.',
      );
    }

    if (horaDesde >= horaHasta) {
      throw new BadRequestException(
        'La hora inicial debe ser anterior a la hora final.',
      );
    }
  }

  private async obtenerUsuario(idUsuario: number) {
    const usuario = await this.userRepository.findOne({
      where: { id_usuario: idUsuario },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    return usuario;
  }

  private async obtenerDeporte(idDeporte: number) {
    const deporte = await this.deporteRepository.findOne({
      where: { id_deporte: idDeporte },
    });

    if (!deporte) {
      throw new NotFoundException('Deporte no encontrado.');
    }

    return deporte;
  }

  private async obtenerDisponibilidadPropia(
    idDisponibilidad: number,
    idUsuario: number,
  ) {
    const disponibilidad = await this.disponibilidadRepository.findOne({
      where: { id_disponibilidad: idDisponibilidad },
      relations: ['usuario', 'deporte'],
    });

    if (!disponibilidad) {
      throw new NotFoundException('Publicación no encontrada.');
    }

    if (
      Number(disponibilidad.usuario.id_usuario) !== Number(idUsuario)
    ) {
      throw new ForbiddenException(
        'No tenés permiso para modificar esta publicación.',
      );
    }

    return disponibilidad;
  }

  private contactoUsuario(usuario: User) {
    return {
      telefono: usuario.telefono_usuario || null,
      email: usuario.email_usuario || null,
    };
  }

  private solicitudSigueVigente(solicitud: SolicitudJugador): boolean {
    const fechaLimite =
      solicitud.fecha_propuesta || solicitud.disponibilidad?.fecha_hasta;

    if (!fechaLimite) return true;
    return String(fechaLimite).slice(0, 10) >= this.fechaHoy();
  }

  private mapearDisponibilidad(
    disponibilidad: DisponibilidadJugador,
    idUsuarioActual?: number,
  ) {
    const esPropia =
      Number(disponibilidad.usuario?.id_usuario) ===
      Number(idUsuarioActual);

    return {
      id_disponibilidad: disponibilidad.id_disponibilidad,
      deporte: disponibilidad.deporte
        ? {
            id_deporte: disponibilidad.deporte.id_deporte,
            nombre_deporte: disponibilidad.deporte.nombre_deporte,
          }
        : null,
      usuario: disponibilidad.usuario
        ? {
            id_usuario: disponibilidad.usuario.id_usuario,
            nombre: disponibilidad.usuario.nombre_usuario,
            apellido: disponibilidad.usuario.apellido_usuario,
            ciudad: disponibilidad.usuario.ciudad_usuario || null,
          }
        : null,
      nivel: disponibilidad.nivel,
      modalidad: disponibilidad.modalidad,
      posicion: disponibilidad.posicion,
      ciudad: disponibilidad.ciudad,
      dias_disponibles: disponibilidad.dias_disponibles || [],
      hora_desde: disponibilidad.hora_desde,
      hora_hasta: disponibilidad.hora_hasta,
      fecha_desde: disponibilidad.fecha_desde,
      fecha_hasta: disponibilidad.fecha_hasta,
      descripcion: disponibilidad.descripcion,
      // Los datos de contacto nunca se publican en el banco.
      // Se comparten únicamente entre ambos jugadores cuando la solicitud
      // queda aceptada (ver mapearSolicitud).
      contacto_visible: false,
      contacto: null,
      estado: disponibilidad.estado,
      es_propia: esPropia,
      created_at: disponibilidad.created_at,
      updated_at: disponibilidad.updated_at,
    };
  }

  private mapearSolicitud(
    solicitud: SolicitudJugador,
    idUsuarioActual: number,
  ) {
    const propietario = solicitud.disponibilidad.usuario;
    const solicitante = solicitud.solicitante;
    const esPropietario =
      Number(propietario.id_usuario) === Number(idUsuarioActual);
    const esSolicitante =
      Number(solicitante.id_usuario) === Number(idUsuarioActual);
    const contactoHabilitado =
      solicitud.estado === EstadoSolicitudJugador.ACEPTADA;

    return {
      id_solicitud: solicitud.id_solicitud,
      estado: solicitud.estado,
      mensaje: solicitud.mensaje,
      fecha_propuesta: solicitud.fecha_propuesta,
      hora_propuesta: solicitud.hora_propuesta,
      created_at: solicitud.created_at,
      disponibilidad: this.mapearDisponibilidad(
        solicitud.disponibilidad,
        idUsuarioActual,
      ),
      solicitante: {
        id_usuario: solicitante.id_usuario,
        nombre: solicitante.nombre_usuario,
        apellido: solicitante.apellido_usuario,
        ciudad: solicitante.ciudad_usuario || null,
        contacto:
          contactoHabilitado && esPropietario
            ? this.contactoUsuario(solicitante)
            : null,
      },
      propietario: {
        id_usuario: propietario.id_usuario,
        nombre: propietario.nombre_usuario,
        apellido: propietario.apellido_usuario,
        ciudad: propietario.ciudad_usuario || null,
        contacto:
          contactoHabilitado && esSolicitante
            ? this.contactoUsuario(propietario)
            : null,
      },
    };
  }

  async createDisponibilidad(
    dto: CreateDisponibilidadJugadorDto,
    usuarioAutenticado: UsuarioAutenticadoBanco,
  ) {
    const [usuario, deporte] = await Promise.all([
      this.obtenerUsuario(usuarioAutenticado.sub),
      this.obtenerDeporte(dto.id_deporte),
    ]);

    const fechaDesde = dto.fecha_desde.slice(0, 10);
    const fechaHasta = dto.fecha_hasta.slice(0, 10);
    const horaDesde = this.normalizarHora(dto.hora_desde);
    const horaHasta = this.normalizarHora(dto.hora_hasta);

    this.validarRango(fechaDesde, fechaHasta, horaDesde, horaHasta);

    const disponibilidad = this.disponibilidadRepository.create({
      usuario,
      deporte,
      nivel: dto.nivel.trim(),
      modalidad: dto.modalidad?.trim() || null,
      posicion: dto.posicion?.trim() || null,
      ciudad: dto.ciudad.trim(),
      dias_disponibles: [
        ...new Set(dto.dias_disponibles.map((dia) => dia.trim().toLowerCase())),
      ],
      hora_desde: horaDesde,
      hora_hasta: horaHasta,
      fecha_desde: fechaDesde,
      fecha_hasta: fechaHasta,
      descripcion: dto.descripcion.trim(),
      // Privacidad por diseño: el teléfono/email se comparte sólo
      // cuando una solicitud queda aceptada.
      contacto_visible: false,
      estado: EstadoDisponibilidadJugador.ACTIVA,
    });

    const guardada =
      await this.disponibilidadRepository.save(disponibilidad);

    const completa = await this.disponibilidadRepository.findOne({
      where: { id_disponibilidad: guardada.id_disponibilidad },
      relations: ['usuario', 'deporte'],
    });

    return this.mapearDisponibilidad(
      completa as DisponibilidadJugador,
      usuarioAutenticado.sub,
    );
  }

  async findDisponibles(
    filtros: FiltrosBancoSuplentes,
    usuarioAutenticado: UsuarioAutenticadoBanco,
  ) {
    const hoy = this.fechaHoy();

    const query = this.disponibilidadRepository
      .createQueryBuilder('disponibilidad')
      .innerJoinAndSelect('disponibilidad.usuario', 'usuario')
      .innerJoinAndSelect('disponibilidad.deporte', 'deporte')
      .where('disponibilidad.estado = :estado', {
        estado: EstadoDisponibilidadJugador.ACTIVA,
      })
      .andWhere('disponibilidad.fecha_hasta >= :hoy', { hoy });

    if (filtros.id_deporte) {
      query.andWhere('deporte.id_deporte = :idDeporte', {
        idDeporte: filtros.id_deporte,
      });
    }

    if (filtros.ciudad?.trim()) {
      query.andWhere('LOWER(disponibilidad.ciudad) LIKE :ciudad', {
        ciudad: `%${filtros.ciudad.trim().toLowerCase()}%`,
      });
    }

    if (filtros.nivel?.trim()) {
      query.andWhere('LOWER(disponibilidad.nivel) LIKE :nivel', {
        nivel: `%${filtros.nivel.trim().toLowerCase()}%`,
      });
    }

    if (filtros.fecha) {
      const fecha = filtros.fecha.slice(0, 10);

      query
        .andWhere('disponibilidad.fecha_desde <= :fecha', { fecha })
        .andWhere('disponibilidad.fecha_hasta >= :fecha', { fecha });
    }

    if (filtros.hora) {
      const hora = this.normalizarHora(filtros.hora);

      query
        .andWhere('disponibilidad.hora_desde <= :hora', { hora })
        .andWhere('disponibilidad.hora_hasta >= :hora', { hora });
    }

    let disponibilidades = await query
      .orderBy('disponibilidad.updated_at', 'DESC')
      .getMany();

    if (filtros.dia?.trim()) {
      const dia = filtros.dia.trim().toLowerCase();

      disponibilidades = disponibilidades.filter((disponibilidad) =>
        (disponibilidad.dias_disponibles || []).some(
          (diaDisponible) =>
            String(diaDisponible).toLowerCase() === dia,
        ),
      );
    }

    return disponibilidades.map((disponibilidad) =>
      this.mapearDisponibilidad(
        disponibilidad,
        usuarioAutenticado.sub,
      ),
    );
  }

  async findMisDisponibilidades(idUsuario: number) {
    const hoy = this.fechaHoy();

    const disponibilidades = await this.disponibilidadRepository
      .createQueryBuilder('disponibilidad')
      .innerJoinAndSelect('disponibilidad.usuario', 'usuario')
      .innerJoinAndSelect('disponibilidad.deporte', 'deporte')
      .where('usuario.id_usuario = :idUsuario', { idUsuario })
      .andWhere('disponibilidad.fecha_hasta >= :hoy', { hoy })
      .andWhere('disponibilidad.estado != :eliminada', {
        eliminada: EstadoDisponibilidadJugador.ELIMINADA,
      })
      .orderBy('disponibilidad.updated_at', 'DESC')
      .getMany();

    return disponibilidades.map((disponibilidad) =>
      this.mapearDisponibilidad(disponibilidad, idUsuario),
    );
  }

  async updateDisponibilidad(
    idDisponibilidad: number,
    dto: UpdateDisponibilidadJugadorDto,
    usuarioAutenticado: UsuarioAutenticadoBanco,
  ) {
    const disponibilidad = await this.obtenerDisponibilidadPropia(
      idDisponibilidad,
      usuarioAutenticado.sub,
    );

    const deporte = dto.id_deporte
      ? await this.obtenerDeporte(dto.id_deporte)
      : disponibilidad.deporte;

    const fechaDesde =
      dto.fecha_desde?.slice(0, 10) || disponibilidad.fecha_desde;
    const fechaHasta =
      dto.fecha_hasta?.slice(0, 10) || disponibilidad.fecha_hasta;
    const horaDesde = this.normalizarHora(
      dto.hora_desde || disponibilidad.hora_desde,
    );
    const horaHasta = this.normalizarHora(
      dto.hora_hasta || disponibilidad.hora_hasta,
    );

    this.validarRango(fechaDesde, fechaHasta, horaDesde, horaHasta);

    disponibilidad.deporte = deporte;
    disponibilidad.fecha_desde = fechaDesde;
    disponibilidad.fecha_hasta = fechaHasta;
    disponibilidad.hora_desde = horaDesde;
    disponibilidad.hora_hasta = horaHasta;

    if (dto.nivel !== undefined) {
      disponibilidad.nivel = dto.nivel.trim();
    }

    if (dto.modalidad !== undefined) {
      disponibilidad.modalidad = dto.modalidad.trim() || null;
    }

    if (dto.posicion !== undefined) {
      disponibilidad.posicion = dto.posicion.trim() || null;
    }

    if (dto.ciudad !== undefined) {
      disponibilidad.ciudad = dto.ciudad.trim();
    }

    if (dto.dias_disponibles !== undefined) {
      disponibilidad.dias_disponibles = [
        ...new Set(
          dto.dias_disponibles.map((dia) =>
            dia.trim().toLowerCase(),
          ),
        ),
      ];
    }

    if (dto.descripcion !== undefined) {
      disponibilidad.descripcion = dto.descripcion.trim();
    }

    // Aunque clientes antiguos envíen contacto_visible, ya no se habilita
    // exposición pública de datos de contacto.
    disponibilidad.contacto_visible = false;

    await this.disponibilidadRepository.save(disponibilidad);

    const actualizada = await this.disponibilidadRepository.findOne({
      where: { id_disponibilidad: idDisponibilidad },
      relations: ['usuario', 'deporte'],
    });

    return this.mapearDisponibilidad(
      actualizada as DisponibilidadJugador,
      usuarioAutenticado.sub,
    );
  }

  async updateEstadoDisponibilidad(
    idDisponibilidad: number,
    dto: UpdateEstadoDisponibilidadDto,
    usuarioAutenticado: UsuarioAutenticadoBanco,
  ) {
    const disponibilidad = await this.obtenerDisponibilidadPropia(
      idDisponibilidad,
      usuarioAutenticado.sub,
    );

    if (dto.estado === EstadoDisponibilidadJugador.ELIMINADA) {
      throw new BadRequestException(
        'Para eliminar la publicación utilizá la acción de eliminar.',
      );
    }

    disponibilidad.estado = dto.estado;
    await this.disponibilidadRepository.save(disponibilidad);

    return {
      message: 'Estado actualizado correctamente.',
      id_disponibilidad: disponibilidad.id_disponibilidad,
      estado: disponibilidad.estado,
    };
  }

  async removeDisponibilidad(
    idDisponibilidad: number,
    usuarioAutenticado: UsuarioAutenticadoBanco,
  ) {
    const disponibilidad = await this.obtenerDisponibilidadPropia(
      idDisponibilidad,
      usuarioAutenticado.sub,
    );

    disponibilidad.estado = EstadoDisponibilidadJugador.ELIMINADA;
    await this.disponibilidadRepository.save(disponibilidad);

    return {
      message: 'Publicación eliminada correctamente.',
      id_disponibilidad: idDisponibilidad,
    };
  }

  async createSolicitud(
    idDisponibilidad: number,
    dto: CreateSolicitudJugadorDto,
    usuarioAutenticado: UsuarioAutenticadoBanco,
  ) {
    const disponibilidad = await this.disponibilidadRepository.findOne({
      where: { id_disponibilidad: idDisponibilidad },
      relations: ['usuario', 'deporte'],
    });

    if (
      !disponibilidad ||
      disponibilidad.estado !== EstadoDisponibilidadJugador.ACTIVA
    ) {
      throw new NotFoundException(
        'La publicación no existe o ya no está activa.',
      );
    }

    if (
      Number(disponibilidad.usuario.id_usuario) ===
      Number(usuarioAutenticado.sub)
    ) {
      throw new BadRequestException(
        'No podés enviar una solicitud a tu propia publicación.',
      );
    }

    if (disponibilidad.fecha_hasta < this.fechaHoy()) {
      throw new BadRequestException(
        'La publicación ya venció y no acepta nuevas solicitudes.',
      );
    }

    if (dto.fecha_propuesta) {
      const fechaPropuesta = dto.fecha_propuesta.slice(0, 10);

      if (fechaPropuesta < this.fechaHoy()) {
        throw new BadRequestException(
          'La fecha propuesta no puede estar en el pasado.',
        );
      }

      if (
        fechaPropuesta < disponibilidad.fecha_desde ||
        fechaPropuesta > disponibilidad.fecha_hasta
      ) {
        throw new BadRequestException(
          'La fecha propuesta debe estar dentro del período publicado por el jugador.',
        );
      }
    }

    const solicitante = await this.obtenerUsuario(
      usuarioAutenticado.sub,
    );

    const solicitudExistente = await this.solicitudRepository.findOne({
      where: {
        disponibilidad: {
          id_disponibilidad: idDisponibilidad,
        },
        solicitante: {
          id_usuario: usuarioAutenticado.sub,
        },
        estado: EstadoSolicitudJugador.PENDIENTE,
      },
    });

    if (solicitudExistente) {
      throw new ConflictException(
        'Ya enviaste una solicitud pendiente a esta persona.',
      );
    }

    const solicitud = this.solicitudRepository.create({
      disponibilidad,
      solicitante,
      mensaje: dto.mensaje?.trim() || null,
      fecha_propuesta: dto.fecha_propuesta?.slice(0, 10) || null,
      hora_propuesta: dto.hora_propuesta
        ? this.normalizarHora(dto.hora_propuesta)
        : null,
      estado: EstadoSolicitudJugador.PENDIENTE,
    });

    const guardada = await this.solicitudRepository.save(solicitud);

    const completa = await this.solicitudRepository.findOne({
      where: { id_solicitud: guardada.id_solicitud },
      relations: [
        'solicitante',
        'disponibilidad',
        'disponibilidad.usuario',
        'disponibilidad.deporte',
      ],
    });

    return this.mapearSolicitud(
      completa as SolicitudJugador,
      usuarioAutenticado.sub,
    );
  }

  async findSolicitudesRecibidas(idUsuario: number) {
    const hoy = this.fechaHoy();

    const solicitudes = await this.solicitudRepository
      .createQueryBuilder('solicitud')
      .innerJoinAndSelect('solicitud.solicitante', 'solicitante')
      .innerJoinAndSelect(
        'solicitud.disponibilidad',
        'disponibilidad',
      )
      .innerJoinAndSelect('disponibilidad.usuario', 'propietario')
      .innerJoinAndSelect('disponibilidad.deporte', 'deporte')
      .where('propietario.id_usuario = :idUsuario', { idUsuario })
      .andWhere(
        'COALESCE(solicitud.fecha_propuesta, disponibilidad.fecha_hasta) >= :hoy',
        { hoy },
      )
      .orderBy('solicitud.created_at', 'DESC')
      .getMany();

    return solicitudes.map((solicitud) =>
      this.mapearSolicitud(solicitud, idUsuario),
    );
  }

  async findSolicitudesEnviadas(idUsuario: number) {
    const hoy = this.fechaHoy();

    const solicitudes = await this.solicitudRepository
      .createQueryBuilder('solicitud')
      .innerJoinAndSelect('solicitud.solicitante', 'solicitante')
      .innerJoinAndSelect('solicitud.disponibilidad', 'disponibilidad')
      .innerJoinAndSelect('disponibilidad.usuario', 'propietario')
      .innerJoinAndSelect('disponibilidad.deporte', 'deporte')
      .where('solicitante.id_usuario = :idUsuario', { idUsuario })
      .andWhere(
        'COALESCE(solicitud.fecha_propuesta, disponibilidad.fecha_hasta) >= :hoy',
        { hoy },
      )
      .orderBy('solicitud.created_at', 'DESC')
      .getMany();

    return solicitudes.map((solicitud) =>
      this.mapearSolicitud(solicitud, idUsuario),
    );
  }

  async updateEstadoSolicitud(
    idSolicitud: number,
    dto: UpdateEstadoSolicitudDto,
    usuarioAutenticado: UsuarioAutenticadoBanco,
  ) {
    const solicitud = await this.solicitudRepository.findOne({
      where: { id_solicitud: idSolicitud },
      relations: [
        'solicitante',
        'disponibilidad',
        'disponibilidad.usuario',
        'disponibilidad.deporte',
      ],
    });

    if (!solicitud) {
      throw new NotFoundException('Solicitud no encontrada.');
    }

    if (!this.solicitudSigueVigente(solicitud)) {
      throw new ConflictException(
        'La solicitud venció porque ya pasó la fecha prevista para jugar.',
      );
    }

    if (solicitud.estado !== EstadoSolicitudJugador.PENDIENTE) {
      throw new ConflictException(
        'La solicitud ya fue gestionada.',
      );
    }

    const esPropietario =
      Number(solicitud.disponibilidad.usuario.id_usuario) ===
      Number(usuarioAutenticado.sub);
    const esSolicitante =
      Number(solicitud.solicitante.id_usuario) ===
      Number(usuarioAutenticado.sub);

    if (
      dto.estado === EstadoSolicitudJugador.CANCELADA &&
      !esSolicitante
    ) {
      throw new ForbiddenException(
        'Solo quien envió la solicitud puede cancelarla.',
      );
    }

    if (
      [
        EstadoSolicitudJugador.ACEPTADA,
        EstadoSolicitudJugador.RECHAZADA,
      ].includes(dto.estado) &&
      !esPropietario
    ) {
      throw new ForbiddenException(
        'Solo quien publicó la disponibilidad puede responder.',
      );
    }

    if (dto.estado === EstadoSolicitudJugador.PENDIENTE) {
      throw new BadRequestException(
        'No se puede volver una solicitud a pendiente.',
      );
    }

    solicitud.estado = dto.estado;
    await this.solicitudRepository.save(solicitud);

    return this.mapearSolicitud(
      solicitud,
      usuarioAutenticado.sub,
    );
  }

  async removeSolicitud(
    idSolicitud: number,
    usuarioAutenticado: UsuarioAutenticadoBanco,
  ) {
    const solicitud = await this.solicitudRepository.findOne({
      where: { id_solicitud: idSolicitud },
      relations: [
        'solicitante',
        'disponibilidad',
        'disponibilidad.usuario',
      ],
    });

    if (!solicitud) {
      throw new NotFoundException('Solicitud no encontrada.');
    }

    const esPropietario =
      Number(solicitud.disponibilidad.usuario.id_usuario) ===
      Number(usuarioAutenticado.sub);
    const esSolicitante =
      Number(solicitud.solicitante.id_usuario) ===
      Number(usuarioAutenticado.sub);

    if (!esPropietario && !esSolicitante) {
      throw new ForbiddenException(
        'No tenés permiso para eliminar esta solicitud.',
      );
    }

    await this.solicitudRepository.remove(solicitud);

    return {
      message: 'Solicitud eliminada correctamente.',
      id_solicitud: idSolicitud,
    };
  }

}