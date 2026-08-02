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
      contacto_visible: disponibilidad.contacto_visible,
      contacto:
        disponibilidad.contacto_visible && disponibilidad.usuario
          ? this.contactoUsuario(disponibilidad.usuario)
          : null,
      estado: disponibilidad.estado,
      oculta_para_creador: disponibilidad.oculta_para_creador,
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
      oculta_para_solicitante: solicitud.oculta_para_solicitante,
      oculta_para_propietario: solicitud.oculta_para_propietario,
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
      contacto_visible: Boolean(dto.contacto_visible),
      estado: EstadoDisponibilidadJugador.ACTIVA,
      oculta_para_creador: false,
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
    const disponibilidades = await this.disponibilidadRepository.find({
      where: {
        usuario: { id_usuario: idUsuario },
        oculta_para_creador: false,
      },
      relations: ['usuario', 'deporte'],
      order: { updated_at: 'DESC' },
    });

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

    if (dto.contacto_visible !== undefined) {
      disponibilidad.contacto_visible = dto.contacto_visible;
    }

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

  async ocultarDisponibilidad(
    idDisponibilidad: number,
    usuarioAutenticado: UsuarioAutenticadoBanco,
  ) {
    const disponibilidad = await this.obtenerDisponibilidadPropia(
      idDisponibilidad,
      usuarioAutenticado.sub,
    );

    if (
      ![
        EstadoDisponibilidadJugador.ELIMINADA,
        EstadoDisponibilidadJugador.VENCIDA,
      ].includes(disponibilidad.estado)
    ) {
      throw new BadRequestException(
        'Primero eliminá o finalizá la publicación antes de quitarla de tu lista.',
      );
    }

    disponibilidad.oculta_para_creador = true;
    await this.disponibilidadRepository.save(disponibilidad);

    return {
      message: 'Publicación quitada de tu lista correctamente.',
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
      oculta_para_solicitante: false,
      oculta_para_propietario: false,
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
      .andWhere('solicitud.oculta_para_propietario = :ocultaPropietario', {
        ocultaPropietario: false,
      })
      .orderBy('solicitud.created_at', 'DESC')
      .getMany();

    return solicitudes.map((solicitud) =>
      this.mapearSolicitud(solicitud, idUsuario),
    );
  }

  async findSolicitudesEnviadas(idUsuario: number) {
    const solicitudes = await this.solicitudRepository.find({
      where: {
        solicitante: { id_usuario: idUsuario },
        oculta_para_solicitante: false,
      },
      relations: [
        'solicitante',
        'disponibilidad',
        'disponibilidad.usuario',
        'disponibilidad.deporte',
      ],
      order: { created_at: 'DESC' },
    });

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

  async ocultarSolicitud(
    idSolicitud: number,
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

    if (solicitud.estado === EstadoSolicitudJugador.PENDIENTE) {
      throw new BadRequestException(
        'Primero gestioná la solicitud antes de quitarla de tu lista.',
      );
    }

    const esPropietario =
      Number(solicitud.disponibilidad.usuario.id_usuario) ===
      Number(usuarioAutenticado.sub);
    const esSolicitante =
      Number(solicitud.solicitante.id_usuario) ===
      Number(usuarioAutenticado.sub);

    if (!esPropietario && !esSolicitante) {
      throw new ForbiddenException(
        'No tenés permiso para quitar esta solicitud.',
      );
    }

    if (esPropietario) {
      solicitud.oculta_para_propietario = true;
    }

    if (esSolicitante) {
      solicitud.oculta_para_solicitante = true;
    }

    await this.solicitudRepository.save(solicitud);

    return {
      message: 'Solicitud quitada de tu lista correctamente.',
      id_solicitud: idSolicitud,
    };
  }

}
