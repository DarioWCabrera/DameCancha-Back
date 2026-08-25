import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { Repository } from 'typeorm';

import { Club } from '../club/entities/club.entity';
import { Deporte } from '../deporte/entities/deporte.entity';
import { User } from '../user/entities/user.entity';
import { CreateTorneoDto } from './dto/create-torneo.dto';
import { UpdateEstadoTorneoDto } from './dto/update-estado-torneo.dto';
import { UpdateTorneoDto } from './dto/update-torneo.dto';
import { EstadoTorneo, Torneo } from './entities/torneo.entity';

export interface UsuarioAutenticadoTorneo {
  sub: number;
  tipo: string;
}

@Injectable()
export class TorneoService {
  private readonly logger = new Logger(TorneoService.name);

  constructor(
    @InjectRepository(Torneo)
    private readonly torneoRepository: Repository<Torneo>,

    @InjectRepository(Club)
    private readonly clubRepository: Repository<Club>,

    @InjectRepository(Deporte)
    private readonly deporteRepository: Repository<Deporte>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly configService: ConfigService,
  ) { }

  private normalizarUbicacion(valor?: string | null) {
    return String(valor || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private validarFechas(fechaInicio: string, fechaFin: string) {
    if (fechaInicio > fechaFin) {
      throw new BadRequestException(
        'La fecha de finalización no puede ser anterior a la fecha de inicio.',
      );
    }
  }

  private async obtenerClubYValidarPermiso(
    idClub: number,
    usuario: UsuarioAutenticadoTorneo,
  ) {
    const club = await this.clubRepository.findOne({
      where: { id_club: idClub },
      relations: ['dueno'],
    });

    if (!club) {
      throw new NotFoundException('El club indicado no existe.');
    }

    if (usuario.tipo === 'admin') {
      return club;
    }

    const idDueno = club.dueno?.id_usuario;

    if (!idDueno || Number(idDueno) !== Number(usuario.sub)) {
      throw new ForbiddenException(
        'No tenés permiso para administrar torneos de este club.',
      );
    }

    return club;
  }

  private async obtenerDeporte(idDeporte: number) {
    const deporte = await this.deporteRepository.findOne({
      where: { id_deporte: idDeporte },
    });

    if (!deporte) {
      throw new NotFoundException('El deporte indicado no existe.');
    }

    return deporte;
  }

  private async obtenerTorneoConRelaciones(id: number) {
    const torneo = await this.torneoRepository.findOne({
      where: { id_torneo: id },
      relations: ['club', 'club.dueno', 'deporte'],
    });

    if (!torneo) {
      throw new NotFoundException('El torneo indicado no existe.');
    }

    return torneo;
  }

  private borrarFlyerAnterior(flyerUrl?: string | null) {
    if (!flyerUrl) return;

    const relativeName = flyerUrl.replace(/^\/uploads\//, '');
    const rutaAbsoluta = join(
      process.cwd(),
      this.configService.get<string>('UPLOAD_DIR') || 'uploads',
      relativeName,
    );

    try {
      if (existsSync(rutaAbsoluta)) {
        unlinkSync(rutaAbsoluta);
      }
    } catch {
      this.logger.warn('No se pudo borrar un flyer anterior.');
    }
  }

  private borrarArchivoSubido(file?: Express.Multer.File | null) {
    if (!file?.path) return;
    try {
      if (existsSync(file.path)) unlinkSync(file.path);
    } catch {
      this.logger.warn('No se pudo limpiar un archivo subido que no llegó a persistirse.');
    }
  }

  async create(
    dto: CreateTorneoDto,
    file: Express.Multer.File | undefined,
    usuario: UsuarioAutenticadoTorneo,
  ) {

    try {
      const [club, deporte] = await Promise.all([
        this.obtenerClubYValidarPermiso(dto.id_club, usuario),
        this.obtenerDeporte(dto.id_deporte),
      ]);

      const fechaInicio = dto.fecha_inicio.slice(0, 10);
      const fechaFin = dto.fecha_fin.slice(0, 10);
      this.validarFechas(fechaInicio, fechaFin);

      const torneo = this.torneoRepository.create({
        club,
        deporte,
        titulo: dto.titulo.trim(),
        descripcion: dto.descripcion.trim(),
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        contacto: dto.contacto?.trim() || null,
        flyer_url: file
          ? `/uploads/torneos/${file.filename}`
          : null,
        estado: dto.estado ?? EstadoTorneo.BORRADOR,
      });

      const guardado = await this.torneoRepository.save(torneo);
      return this.findOne(guardado.id_torneo, usuario);
    } catch (error) {
      this.borrarArchivoSubido(file);
      throw error;
    }
  }

  async findByClub(
    idClub: number,
    usuario: UsuarioAutenticadoTorneo,
  ) {
    await this.obtenerClubYValidarPermiso(idClub, usuario);

    return this.torneoRepository.find({
      where: { club: { id_club: idClub } },
      relations: ['club', 'deporte'],
      order: {
        created_at: 'DESC',
      },
    });
  }

  async findPublicados(usuario: UsuarioAutenticadoTorneo) {
    const torneos = await this.torneoRepository.find({
      where: { estado: EstadoTorneo.PUBLICADO },
      relations: ['club', 'deporte'],
      order: {
        fecha_inicio: 'ASC',
        created_at: 'DESC',
      },
    });

    // Los torneos de clubes inactivos nunca se muestran públicamente.
    let torneosVisibles = torneos.filter(
      (torneo) => torneo.club?.estado === 'activo',
    );

    // Los usuarios comunes solo ven torneos de clubes de su misma ciudad/provincia.
    // Dueños y admins conservan acceso global.
    if (usuario.tipo === 'usuario') {
      const usuarioCompleto = await this.userRepository.findOne({
        where: { id_usuario: Number(usuario.sub) },
      });

      if (!usuarioCompleto) {
        throw new NotFoundException('Usuario no encontrado.');
      }

      const ciudadUsuario = this.normalizarUbicacion(
        usuarioCompleto.ciudad_usuario,
      );
      const provinciaUsuario = this.normalizarUbicacion(
        usuarioCompleto.provincia_usuario,
      );

      if (!ciudadUsuario || !provinciaUsuario) {
        return [];
      }

      torneosVisibles = torneosVisibles.filter((torneo) => {
        const ciudadClub = this.normalizarUbicacion(
          torneo.club?.ciudad_club,
        );
        const provinciaClub = this.normalizarUbicacion(
          torneo.club?.provincia_club,
        );

        return (
          ciudadClub === ciudadUsuario &&
          provinciaClub === provinciaUsuario
        );
      });
    }

    return torneosVisibles;
  }

  async findOne(
    id: number,
    usuario?: UsuarioAutenticadoTorneo,
  ) {
    const torneo = await this.obtenerTorneoConRelaciones(id);

    if (torneo.estado === EstadoTorneo.PUBLICADO) {
      return torneo;
    }

    if (!usuario) {
      throw new ForbiddenException(
        'Este torneo todavía no se encuentra publicado.',
      );
    }

    await this.obtenerClubYValidarPermiso(
      torneo.club.id_club,
      usuario,
    );

    return torneo;
  }

  async update(
    id: number,
    dto: UpdateTorneoDto,
    file: Express.Multer.File | undefined,
    usuario: UsuarioAutenticadoTorneo,
  ) {
    const torneo = await this.obtenerTorneoConRelaciones(id);

    await this.obtenerClubYValidarPermiso(
      torneo.club.id_club,
      usuario,
    );

    const fechaInicio =
      dto.fecha_inicio?.slice(0, 10) ?? torneo.fecha_inicio;
    const fechaFin =
      dto.fecha_fin?.slice(0, 10) ?? torneo.fecha_fin;

    this.validarFechas(fechaInicio, fechaFin);

    if (dto.id_deporte !== undefined) {
      torneo.deporte = await this.obtenerDeporte(dto.id_deporte);
    }

    if (dto.titulo !== undefined) {
      torneo.titulo = dto.titulo.trim();
    }

    if (dto.descripcion !== undefined) {
      torneo.descripcion = dto.descripcion.trim();
    }

    if (dto.contacto !== undefined) {
      torneo.contacto = dto.contacto.trim() || null;
    }

    if (dto.estado !== undefined) {
      torneo.estado = dto.estado;
    }

    torneo.fecha_inicio = fechaInicio;
    torneo.fecha_fin = fechaFin;

    const flyerAnterior = torneo.flyer_url;
    if (file) torneo.flyer_url = `/uploads/torneos/${file.filename}`;

    try {
      await this.torneoRepository.save(torneo);
      if (file) this.borrarFlyerAnterior(flyerAnterior);
      return this.findOne(torneo.id_torneo, usuario);
    } catch (error) {
      this.borrarArchivoSubido(file);
      throw error;
    }
  }

  async updateEstado(
    id: number,
    dto: UpdateEstadoTorneoDto,
    usuario: UsuarioAutenticadoTorneo,
  ) {
    const torneo = await this.obtenerTorneoConRelaciones(id);

    await this.obtenerClubYValidarPermiso(
      torneo.club.id_club,
      usuario,
    );

    torneo.estado = dto.estado;
    await this.torneoRepository.save(torneo);

    return this.findOne(torneo.id_torneo, usuario);
  }

  async remove(
    id: number,
    usuario: UsuarioAutenticadoTorneo,
  ) {
    const torneo = await this.obtenerTorneoConRelaciones(id);

    await this.obtenerClubYValidarPermiso(
      torneo.club.id_club,
      usuario,
    );

    torneo.estado = EstadoTorneo.CANCELADO;
    await this.torneoRepository.save(torneo);

    return {
      message: 'El torneo fue cancelado correctamente.',
      id_torneo: torneo.id_torneo,
      estado: torneo.estado,
    };
  }

  async removePermanently(
    id: number,
    usuario: UsuarioAutenticadoTorneo,
  ) {
    const torneo = await this.obtenerTorneoConRelaciones(id);

    await this.obtenerClubYValidarPermiso(
      torneo.club.id_club,
      usuario,
    );

    const flyerAnterior = torneo.flyer_url;
    await this.torneoRepository.remove(torneo);
    this.borrarFlyerAnterior(flyerAnterior);

    return {
      message: 'El torneo fue eliminado definitivamente.',
      id_torneo: id,
    };
  }
}
