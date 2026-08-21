import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { DataSource, Repository } from 'typeorm';

import { CreateClubDto } from './dto/create-club.dto';
import { UpdateClubDto } from './dto/update-club.dto';
import { Club } from './entities/club.entity';
import { User } from '../user/entities/user.entity';

@Injectable()
export class ClubService {
  private readonly logger = new Logger(ClubService.name);

  constructor(
    @InjectRepository(Club)
    private readonly clubRepository: Repository<Club>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async create(createClubDto: CreateClubDto) {
    const { id_dueno, ...data } = createClubDto;
    const owner = await this.userRepository.findOne({
      where: { id_usuario: id_dueno },
    });
    if (!owner) throw new NotFoundException('Usuario dueño no encontrado.');

    const club = this.clubRepository.create({
      ...data,
      dueno: owner,
      estado: 'activo',
    });
    return this.clubRepository.save(club);
  }

  findAll() {
    return this.clubRepository.find({
      where: { estado: 'activo' },
      relations: ['canchas', 'canchas.id_deporte'],
      order: { nombre_club: 'ASC' },
    });
  }

  async findOne(id: number) {
    const club = await this.clubRepository.findOne({
      where: { id_club: id, estado: 'activo' },
      relations: ['canchas', 'canchas.id_deporte'],
    });
    if (!club) throw new NotFoundException('Club no encontrado.');
    return club;
  }

  findByDueno(id_usuario: number) {
    return this.clubRepository.find({
      where: { dueno: { id_usuario } },
      relations: ['canchas', 'canchas.id_deporte'],
    });
  }

  async update(id: number, updateClubDto: UpdateClubDto) {
    const club = await this.clubRepository.findOne({
      where: { id_club: id },
    });
    if (!club) throw new NotFoundException('Club no encontrado.');

    Object.assign(club, {
      ...updateClubDto,
      servicios_club:
        updateClubDto.servicios_club !== undefined
          ? updateClubDto.servicios_club
          : club.servicios_club,
    });
    await this.clubRepository.save(club);
    return club;
  }

  async remove(id: number) {
    const club = await this.clubRepository.findOne({
      where: { id_club: id },
    });
    if (!club) throw new NotFoundException('Club no encontrado.');
    club.estado = 'inactivo';
    await this.clubRepository.save(club);
    return { message: 'Club desactivado correctamente.', id_club: id };
  }

  async createForOwner(idUsuario: number, data: Record<string, unknown>) {
    const user = await this.userRepository.findOne({
      where: { id_usuario: idUsuario },
    });
    if (!user) throw new NotFoundException('Usuario dueño no encontrado.');

    const club = this.clubRepository.create({
      nombre_club: String(data.razonSocial || '').trim(),
      direccion_club: String(data.direccion || '').trim(),
      ciudad_club: String(data.ciudad || '').trim(),
      telefono_club: String(data.telefono || '').trim(),
      dueno: user,
      estado: 'activo',
    });
    if (!club.nombre_club || !club.direccion_club) {
      throw new BadRequestException('Nombre y dirección del club son obligatorios.');
    }
    return this.clubRepository.save(club);
  }

  private borrarArchivoSubido(file?: Express.Multer.File) {
    if (!file?.path) return;
    try {
      if (existsSync(file.path)) unlinkSync(file.path);
    } catch {
      this.logger.warn('No se pudo limpiar un logo que no llegó a persistirse.');
    }
  }

  private borrarLogoAnterior(logoUrl?: string | null) {
    if (!logoUrl) return;
    const relativeName = logoUrl.replace(/^\/uploads\//, '');
    const absolutePath = join(
      process.cwd(),
      this.configService.get<string>('UPLOAD_DIR') || 'uploads',
      relativeName,
    );

    try {
      if (existsSync(absolutePath)) unlinkSync(absolutePath);
    } catch {
      this.logger.warn('No se pudo borrar el logo anterior del club.');
    }
  }

  async updateLogo(id: number, file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo.');

    try {
      const club = await this.clubRepository.findOne({ where: { id_club: id } });
      if (!club) throw new NotFoundException('Club no encontrado.');

      const logoAnterior = club.logo_club;
      club.logo_club = `/uploads/clubs/${file.filename}`;
      await this.clubRepository.save(club);
      this.borrarLogoAnterior(logoAnterior);

      return { message: 'Logo actualizado correctamente.', logo: club.logo_club };
    } catch (error) {
      this.borrarArchivoSubido(file);
      throw error;
    }
  }

  async getPendientes() {
    const clubs = await this.clubRepository.find({
      where: { estado: 'pendiente_aprobacion' },
      relations: ['dueno'],
      order: { created_at: 'ASC' },
    });

    return clubs.map((club) => ({
      id: club.id_club,
      nombre: club.nombre_club,
      email: club.dueno?.email_usuario,
      telefono: club.telefono_club,
      canchas: club.deportes_club,
      direccion: club.direccion_club,
      servicios: club.servicios_club,
      servicios_club: club.servicios_club,
      activo: false,
    }));
  }

  async getAceptados(includePrivateDetails = false) {
    const clubs = await this.clubRepository.find({
      where: [{ estado: 'activo' }, { estado: 'inactivo' }],
      relations: ['dueno', 'canchas', 'canchas.id_deporte'],
      order: { nombre_club: 'ASC' },
    });

    return clubs.map((club) => ({
      id: club.id_club,
      nombre: club.nombre_club,
      ...(includePrivateDetails
        ? { email: club.dueno?.email_usuario }
        : {}),
      telefono: club.telefono_club,
      canchas: club.deportes_club,
      direccion: club.direccion_club,
      ciudad: club.ciudad_club,
      provincia: club.provincia_club,
      logo: club.logo_club,
      servicios: club.servicios_club,
      servicios_club: club.servicios_club,
      activo: club.estado === 'activo',
      detallesCanchas:
        club.canchas
          ?.filter((cancha) => cancha.activa === 1)
          .map((cancha) => ({
            id: cancha.id_cancha,
            nombre: cancha.nombre_cancha,
            precio: Number(cancha.precio_por_hora) || 0,
            deporte: cancha.id_deporte?.nombre_deporte,
          })) || [],
    }));
  }

  async toggleStatus(id: number, activo: boolean) {
    return this.setClubAndOwnerStatus(id, activo ? 'activo' : 'inactivo');
  }

  async aceptar(id: number) {
    return this.setClubAndOwnerStatus(id, 'activo');
  }

  async rechazar(id: number) {
    return this.setClubAndOwnerStatus(id, 'inactivo');
  }

  private async setClubAndOwnerStatus(
    id: number,
    estado: 'activo' | 'inactivo',
  ) {
    await this.dataSource.transaction(async (manager) => {
      const club = await manager.findOne(Club, {
        where: { id_club: id },
        relations: ['dueno'],
      });
      if (!club) throw new NotFoundException('Club no encontrado.');
      club.estado = estado;
      await manager.save(club);

      if (club.dueno) {
        club.dueno.estado_usuario = estado;
        await manager.save(club.dueno);
      }
    });

    return { message: `Club ${estado === 'activo' ? 'activado' : 'inactivado'} correctamente.` };
  }
}
