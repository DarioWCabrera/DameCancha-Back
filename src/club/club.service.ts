import {
  BadRequestException,
  ConflictException,
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
import { ClubClienteAlias } from './entities/club-cliente-alias.entity';
import { User } from '../user/entities/user.entity';
import { ActualizarContactoClubDto } from './dto/actualizar-contacto-club.dto';

@Injectable()
export class ClubService {
  private readonly logger = new Logger(ClubService.name);

  constructor(
    @InjectRepository(Club)
    private readonly clubRepository: Repository<Club>,

    @InjectRepository(ClubClienteAlias)
    private readonly clubClienteAliasRepository: Repository<ClubClienteAlias>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) { }

  private normalizarUbicacion(valor?: string | null) {
    return String(valor || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

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

  async actualizarContacto(
    idClub: number,
    dto: ActualizarContactoClubDto,
  ) {
    const telefono = String(dto.telefono || '').trim();
    const email = String(dto.email || '').trim().toLowerCase();

    if (!telefono || !email) {
      throw new BadRequestException(
        'El teléfono y el email son obligatorios.',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const clubRepository = manager.getRepository(Club);
      const userRepository = manager.getRepository(User);

      const club = await clubRepository.findOne({
        where: { id_club: idClub },
        relations: ['dueno'],
      });

      if (!club) {
        throw new NotFoundException('Club no encontrado.');
      }

      if (!club.dueno) {
        throw new NotFoundException(
          'No se encontró el usuario dueño asociado al club.',
        );
      }

      const emailExistente = await userRepository.findOne({
        where: { email_usuario: email },
      });

      if (
        emailExistente &&
        emailExistente.id_usuario !== club.dueno.id_usuario
      ) {
        throw new ConflictException(
          'Ese email ya está siendo utilizado por otra cuenta.',
        );
      }

      club.telefono_club = telefono;
      club.dueno.telefono_usuario = telefono;
      club.dueno.email_usuario = email;

      await userRepository.save(club.dueno);
      await clubRepository.save(club);

      return {
        message: 'Datos de contacto actualizados correctamente.',
        id_club: club.id_club,
        telefono: club.telefono_club,
        email: club.dueno.email_usuario,
      };
    });
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

  async getAceptados(
    includePrivateDetails = false,
    idUsuario?: number,
    tipoUsuario?: string,
  ) {
    const clubs = await this.clubRepository.find({
      where: [{ estado: 'activo' }, { estado: 'inactivo' }],
      relations: ['dueno', 'canchas', 'canchas.id_deporte'],
      order: { nombre_club: 'ASC' },
    });

    let clubsVisibles = clubs;

    // Los usuarios comunes solo ven clubes de su misma ciudad y provincia.
    // Admins y dueños siguen viendo todos.
    if (!includePrivateDetails && tipoUsuario === 'usuario') {
      if (!idUsuario) {
        return [];
      }

      const usuario = await this.userRepository.findOne({
        where: { id_usuario: idUsuario },
      });

      if (!usuario) {
        throw new NotFoundException('Usuario no encontrado.');
      }

      const ciudadUsuario = this.normalizarUbicacion(
        usuario.ciudad_usuario,
      );

      const provinciaUsuario = this.normalizarUbicacion(
        usuario.provincia_usuario,
      );

      // Si una cuenta antigua no tiene localidad cargada,
      // evitamos mostrarle todos los clubes accidentalmente.
      if (!ciudadUsuario || !provinciaUsuario) {
        return [];
      }

      clubsVisibles = clubs.filter((club) => {
        const ciudadClub = this.normalizarUbicacion(
          club.ciudad_club,
        );

        const provinciaClub = this.normalizarUbicacion(
          club.provincia_club,
        );

        return (
          ciudadClub === ciudadUsuario &&
          provinciaClub === provinciaUsuario
        );
      });
    }

    return clubsVisibles.map((club) => ({
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
  async guardarAliasCliente(
    idClub: number,
    idUsuario: number,
    alias: string,
  ) {
    const aliasLimpio = String(alias || '').trim();

    if (!aliasLimpio) {
      throw new BadRequestException('El alias no puede estar vacío.');
    }

    if (aliasLimpio.length > 120) {
      throw new BadRequestException(
        'El alias no puede superar los 120 caracteres.',
      );
    }

    const club = await this.clubRepository.findOne({
      where: { id_club: idClub },
    });

    if (!club) {
      throw new NotFoundException('Club no encontrado.');
    }

    const usuario = await this.userRepository.findOne({
      where: { id_usuario: idUsuario },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    let registro = await this.clubClienteAliasRepository.findOne({
      where: {
        club: { id_club: idClub },
        usuario: { id_usuario: idUsuario },
      },
    });

    if (registro) {
      registro.alias = aliasLimpio;
    } else {
      registro = this.clubClienteAliasRepository.create({
        club,
        usuario,
        alias: aliasLimpio,
      });
    }

    const guardado =
      await this.clubClienteAliasRepository.save(registro);

    return {
      id_club_cliente_alias: guardado.id_club_cliente_alias,
      id_club: idClub,
      id_usuario: idUsuario,
      alias: guardado.alias,
    };
  }

  async obtenerAliasCliente(
    idClub: number,
    idUsuario: number,
  ) {
    const registro =
      await this.clubClienteAliasRepository.findOne({
        where: {
          club: { id_club: idClub },
          usuario: { id_usuario: idUsuario },
        },
      });

    return {
      id_club: idClub,
      id_usuario: idUsuario,
      alias: registro?.alias ?? null,
    };
  }
}
