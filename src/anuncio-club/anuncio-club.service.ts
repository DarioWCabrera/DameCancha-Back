import {
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
import { CreateAnuncioClubDto } from './dto/create-anuncio-club.dto';
import { UpdateAnuncioClubDto } from './dto/update-anuncio-club.dto';
import { AnuncioClub } from './entities/anuncio-club.entity';

export interface UsuarioAutenticadoAnuncio {
  sub: number;
  tipo: string;
}

@Injectable()
export class AnuncioClubService {
  private readonly logger = new Logger(AnuncioClubService.name);

  constructor(
    @InjectRepository(AnuncioClub)
    private readonly anuncioRepository: Repository<AnuncioClub>,

    @InjectRepository(Club)
    private readonly clubRepository: Repository<Club>,

    private readonly configService: ConfigService,
  ) {}

  private async obtenerClubYValidarPermiso(
    idClub: number,
    usuario: UsuarioAutenticadoAnuncio,
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
        'No tenés permiso para administrar la cartelera de este club.',
      );
    }

    return club;
  }

  private async obtenerAnuncioConRelaciones(id: number) {
    const anuncio = await this.anuncioRepository.findOne({
      where: { id_anuncio: id },
      relations: ['club', 'club.dueno'],
    });

    if (!anuncio) {
      throw new NotFoundException('El anuncio indicado no existe.');
    }

    return anuncio;
  }

  private borrarImagenAnterior(imagenUrl?: string | null) {
    if (!imagenUrl) return;

    const relativeName = imagenUrl.replace(/^\/uploads\//, '');
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
      this.logger.warn('No se pudo borrar una imagen anterior de cartelera.');
    }
  }

  private borrarArchivoSubido(file?: Express.Multer.File | null) {
    if (!file?.path) return;

    try {
      if (existsSync(file.path)) {
        unlinkSync(file.path);
      }
    } catch {
      this.logger.warn(
        'No se pudo limpiar una imagen de cartelera que no llegó a persistirse.',
      );
    }
  }

  async create(
    dto: CreateAnuncioClubDto,
    file: Express.Multer.File | undefined,
    usuario: UsuarioAutenticadoAnuncio,
  ) {
    try {
      const club = await this.obtenerClubYValidarPermiso(
        dto.id_club,
        usuario,
      );

      const anuncio = this.anuncioRepository.create({
        club,
        titulo: dto.titulo?.trim() || null,
        contenido: dto.contenido.trim(),
        imagen_url: file
          ? `/uploads/anuncios/${file.filename}`
          : null,
        activo: true,
      });

      const guardado = await this.anuncioRepository.save(anuncio);

      return this.findOne(guardado.id_anuncio, usuario);
    } catch (error) {
      this.borrarArchivoSubido(file);
      throw error;
    }
  }

  async findActivos() {
    return this.anuncioRepository.find({
      where: {
        activo: true,
        club: {
          estado: 'activo',
        },
      },
      relations: ['club'],
      order: {
        created_at: 'DESC',
      },
    });
  }

  async findActivosByClub(idClub: number) {
    return this.anuncioRepository.find({
      where: {
        activo: true,
        club: {
          id_club: idClub,
          estado: 'activo',
        },
      },
      relations: ['club'],
      order: {
        created_at: 'DESC',
      },
    });
  }

  async findByClub(
    idClub: number,
    usuario: UsuarioAutenticadoAnuncio,
  ) {
    await this.obtenerClubYValidarPermiso(idClub, usuario);

    return this.anuncioRepository.find({
      where: {
        club: {
          id_club: idClub,
        },
      },
      relations: ['club'],
      order: {
        created_at: 'DESC',
      },
    });
  }

  async findOne(
    id: number,
    usuario?: UsuarioAutenticadoAnuncio,
  ) {
    const anuncio = await this.obtenerAnuncioConRelaciones(id);

    if (anuncio.activo && anuncio.club.estado === 'activo') {
      return anuncio;
    }

    if (!usuario) {
      throw new ForbiddenException(
        'Este anuncio no se encuentra publicado.',
      );
    }

    await this.obtenerClubYValidarPermiso(
      anuncio.club.id_club,
      usuario,
    );

    return anuncio;
  }

  async update(
    id: number,
    dto: UpdateAnuncioClubDto,
    file: Express.Multer.File | undefined,
    usuario: UsuarioAutenticadoAnuncio,
  ) {
    const anuncio = await this.obtenerAnuncioConRelaciones(id);

    await this.obtenerClubYValidarPermiso(
      anuncio.club.id_club,
      usuario,
    );

    if (dto.titulo !== undefined) {
      anuncio.titulo = dto.titulo.trim() || null;
    }

    if (dto.contenido !== undefined) {
      anuncio.contenido = dto.contenido.trim();
    }

    const imagenAnterior = anuncio.imagen_url;

    if (file) {
      anuncio.imagen_url = `/uploads/anuncios/${file.filename}`;
    }

    try {
      await this.anuncioRepository.save(anuncio);

      if (file) {
        this.borrarImagenAnterior(imagenAnterior);
      }

      return this.findOne(anuncio.id_anuncio, usuario);
    } catch (error) {
      this.borrarArchivoSubido(file);
      throw error;
    }
  }

  async updateEstado(
    id: number,
    activo: boolean,
    usuario: UsuarioAutenticadoAnuncio,
  ) {
    const anuncio = await this.obtenerAnuncioConRelaciones(id);

    await this.obtenerClubYValidarPermiso(
      anuncio.club.id_club,
      usuario,
    );

    anuncio.activo = activo;
    await this.anuncioRepository.save(anuncio);

    return this.findOne(anuncio.id_anuncio, usuario);
  }

  async remove(
    id: number,
    usuario: UsuarioAutenticadoAnuncio,
  ) {
    const anuncio = await this.obtenerAnuncioConRelaciones(id);

    await this.obtenerClubYValidarPermiso(
      anuncio.club.id_club,
      usuario,
    );

    const imagenAnterior = anuncio.imagen_url;

    await this.anuncioRepository.remove(anuncio);
    this.borrarImagenAnterior(imagenAnterior);

    return {
      message: 'El anuncio fue eliminado correctamente.',
      id_anuncio: id,
    };
  }
}