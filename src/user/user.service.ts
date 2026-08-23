import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Club } from '../club/entities/club.entity';
import { Cancha } from '../cancha/entities/cancha.entity';
import { Deporte } from '../deporte/entities/deporte.entity';
import { Repository, DataSource, ILike } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { RegisterOwnerDto } from '../auth/dto/register-owner.dto';
import { unlink } from 'fs/promises';
import { MailService } from '../mail/mail.service';


@Injectable()
export class UserService {
  private readonly SALT_ROUNDS = 10;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,

    @InjectRepository(Club)
    private clubRepository: Repository<Club>,

    private dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) { }

  private normalizarEmail(email: string): string {
    return String(email || '').trim().toLowerCase();
  }

  private mapearUsuarioSeguro(user: User | null) {
    if (!user) return null;

    return {
      id_usuario: user.id_usuario,
      nombre_usuario: user.nombre_usuario,
      apellido_usuario: user.apellido_usuario,
      email_usuario: user.email_usuario,
      dni_usuario: user.dni_usuario,
      CUIT_usuario: user.CUIT_usuario,
      telefono_usuario: user.telefono_usuario,
      direccion_usuario: user.direccion_usuario,
      ciudad_usuario: user.ciudad_usuario,
      provincia_usuario: user.provincia_usuario,
      cp_usuario: user.cp_usuario,
      estado_usuario: user.estado_usuario,
      tipo_usuario: user.tipo_usuario,
      created_at: user.created_at,
      clubs: user.clubs,
    };
  }

  private hashResetCode(email: string, code: string): string {
    const secret = this.configService.getOrThrow<string>('JWT_SECRET');
    return createHmac('sha256', secret)
      .update(`${this.normalizarEmail(email)}:${code}`)
      .digest('hex');
  }

  private compararHashSeguro(expectedHex: string, actualHex: string): boolean {
    const expected = Buffer.from(expectedHex, 'hex');
    const actual = Buffer.from(actualHex, 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  private esPasswordHasheada(password: string): boolean {
    return (
      password.startsWith('$2a$') ||
      password.startsWith('$2b$') ||
      password.startsWith('$2y$')
    );
  }

  private async hashearPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  private validarPoliticaPassword(password: string) {
    if (!password) {
      throw new BadRequestException('La contraseña es obligatoria.');
    }

    const tieneMinimoCaracteres = password.length >= 8;
    const tieneLetra = /[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(password);
    const tieneNumero = /\d/.test(password);

    if (!tieneMinimoCaracteres || !tieneLetra || !tieneNumero) {
      throw new BadRequestException(
        'La contraseña debe tener al menos 8 caracteres, incluir una letra y un número.',
      );
    }
  }

  private async validarPasswordYMigrarSiHaceFalta(
    user: User,
    passwordIngresada: string,
  ): Promise<boolean> {
    const passwordGuardada = user.password_usuario || '';

    if (this.esPasswordHasheada(passwordGuardada)) {
      return bcrypt.compare(passwordIngresada, passwordGuardada);
    }

    const passwordValida = passwordGuardada === passwordIngresada;

    if (passwordValida) {
      user.password_usuario = await this.hashearPassword(passwordIngresada);
      await this.userRepository.save(user);
    }

    return passwordValida;
  }

  async create(createUserDto: CreateUserDto) {
    try {
      createUserDto.email_usuario = this.normalizarEmail(createUserDto.email_usuario);

      if (createUserDto.email_usuario) {
        const existingEmail = await this.userRepository.findOne({
          where: { email_usuario: createUserDto.email_usuario },
        });

        if (existingEmail) {
          throw new BadRequestException('El email ya está registrado');
        }
      }

      if (createUserDto.dni_usuario) {
        const existingDni = await this.userRepository.findOne({
          where: { dni_usuario: createUserDto.dni_usuario },
        });

        if (existingDni) {
          throw new BadRequestException('El DNI ya está registrado');
        }
      }

      if (createUserDto.CUIT_usuario) {
        const existingCuit = await this.userRepository.findOne({
          where: { CUIT_usuario: createUserDto.CUIT_usuario },
        });

        if (existingCuit) {
          throw new BadRequestException('El CUIT ya está registrado');
        }
      }

      this.validarPoliticaPassword(createUserDto.password_usuario);

      const tipo = (createUserDto.tipo_usuario || 'usuario').toString();

      // DameCancha no requiere aprobación previa para los clubes.
      // Usuarios, dueños y administradores se crean activos; el administrador
      // conserva la posibilidad de inactivar luego una cuenta/club que incumpla reglas.
      const estado = 'activo';

      const passwordHasheada = await this.hashearPassword(
        createUserDto.password_usuario,
      );

      const user = this.userRepository.create({
        ...createUserDto,
        password_usuario: passwordHasheada,
        tipo_usuario: tipo,
        estado_usuario: estado,
      });

      const saved = await this.userRepository.save(user);

      return {
        id_usuario: saved.id_usuario,
        nombre_usuario: saved.nombre_usuario,
        apellido_usuario: saved.apellido_usuario,
        email_usuario: saved.email_usuario,
        tipo_usuario: saved.tipo_usuario,
        estado_usuario: saved.estado_usuario,
        created_at: saved.created_at,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Error al crear usuario');
    }
  }

  async countRegisteredUsers() {
    const total = await this.userRepository.count({
      where: {
        tipo_usuario: 'usuario',
        estado_usuario: 'activo',
      },
    });

    return {
      total,
    };
  }

  async findAll() {
    const users = await this.userRepository.find({ relations: ['clubs'] });
    return users.map((user) => this.mapearUsuarioSeguro(user));
  }

  async findOne(id: number) {
    const user = await this.userRepository.findOne({
      where: { id_usuario: id },
      relations: ['clubs'],
    });
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    return this.mapearUsuarioSeguro(user);
  }

  async existsByEmail(email: string) {
    const exists = await this.userRepository.exist({
      where: { email_usuario: this.normalizarEmail(email) },
    });
    return { exists };
  }

  async existsByDni(dni: string) {
    const normalized = String(dni || '').replace(/\D/g, '');
    const exists = normalized
      ? await this.userRepository.exist({ where: { dni_usuario: normalized } })
      : false;
    return { exists };
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const current = await this.userRepository.findOne({
      where: { id_usuario: id },
    });
    if (!current) throw new NotFoundException('Usuario no encontrado.');

    if (updateUserDto.email_usuario) {
      const normalized = this.normalizarEmail(updateUserDto.email_usuario);
      const duplicate = await this.userRepository.findOne({
        where: { email_usuario: normalized },
      });
      if (duplicate && duplicate.id_usuario !== id) {
        throw new BadRequestException('El email ya está registrado.');
      }
      updateUserDto.email_usuario = normalized;
    }

    Object.assign(current, updateUserDto);
    await this.userRepository.save(current);
    return this.findOne(id);
  }

  async remove(id: number) {
    const user = await this.userRepository.findOne({
      where: { id_usuario: id },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    user.estado_usuario = 'inactivo';
    await this.userRepository.save(user);
    return { message: 'Usuario desactivado correctamente.', id_usuario: id };
  }

  async createWithClub(
    data: RegisterOwnerDto,
    file?: Express.Multer.File,
  ) {
    data.email = this.normalizarEmail(data.email);

    if (data.email) {
      const existingEmail = await this.userRepository.findOne({
        where: { email_usuario: data.email },
      });

      if (existingEmail) {
        throw new BadRequestException('El email ya está registrado');
      }
    }

    const normalizedCuit = String(data.CUIT || '').replace(/\D/g, '');

    if (normalizedCuit) {
      const existingCuit = await this.userRepository.findOne({
        where: { CUIT_usuario: normalizedCuit },
      });

      if (existingCuit) {
        throw new BadRequestException('El CUIT ya está registrado');
      }
    }

    const normalizedDni = String(data.DNI || '').replace(/\D/g, '');

    if (normalizedDni) {
      const existingDni = await this.userRepository.findOne({
        where: { dni_usuario: normalizedDni },
      });

      if (existingDni) {
        throw new BadRequestException('El DNI ya está registrado');
      }
    }

    this.validarPoliticaPassword(data.password);

    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const normalize = (v: any) => (Array.isArray(v) ? v[0] : v);

      const canchasRaw = normalize(data.canchas);
      let parsedSports: unknown;
      try {
        parsedSports = canchasRaw ? JSON.parse(String(canchasRaw)) : [];
      } catch {
        throw new BadRequestException('La lista de deportes no es válida.');
      }

      if (!Array.isArray(parsedSports) || parsedSports.length > 20) {
        throw new BadRequestException('La lista de deportes no es válida.');
      }

      const deportesSeleccionados = Array.from(
        new Set(
          parsedSports
            .map((value) => String(value).trim())
            .filter((value) => /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ]{2,60}$/.test(value)),
        ),
      );

      if (!deportesSeleccionados.length) {
        throw new BadRequestException('Seleccioná al menos un deporte.');
      }

      const passwordHasheada = await this.hashearPassword(data.password);

      const user = queryRunner.manager.create(User, {
        nombre_usuario: data.nombre,
        apellido_usuario: data.apellido,
        email_usuario: data.email,
        password_usuario: passwordHasheada,
        telefono_usuario: data.telefono,
        dni_usuario: normalizedDni || null,
        CUIT_usuario: normalizedCuit || null,
        direccion_usuario: data.direccion || 'sin direccion',
        ciudad_usuario: data.ciudad,
        provincia_usuario: data.provincia,
        cp_usuario: data.cp,
        tipo_usuario: 'dueno',
        estado_usuario: 'pendiente_aprobacion',
      });

      const savedUser = await queryRunner.manager.save(user);

      const club = queryRunner.manager.create(Club, {
        nombre_club:
          normalize(data.razonSocial) || 'Sin nombre',
        direccion_club: normalize(data.direccion) || 'sin direccion',
        ciudad_club: normalize(data.ciudad),
        provincia_club: normalize(data.provincia),
        cp_club: normalize(data.cp),
        telefono_club: normalize(data.telefono),
        deportes_club: deportesSeleccionados,
        logo_club: file ? `/uploads/${file.filename}` : undefined,
        dueno: savedUser,
        estado: 'pendiente_aprobacion',
      });

      const savedClub = await queryRunner.manager.save(club);

      const canchasCreadas: Cancha[] = [];

      for (const nombreDeporte of deportesSeleccionados) {
        let deporte = await queryRunner.manager.findOne(Deporte, {
          where: { nombre_deporte: ILike(nombreDeporte) },
        });

        if (!deporte) {
          const nuevoDeporte = queryRunner.manager.create(Deporte, {
            nombre_deporte: nombreDeporte,
          });

          await queryRunner.manager.save(nuevoDeporte);
          deporte = nuevoDeporte;
        }

        const cancha = queryRunner.manager.create(Cancha, {
          nombre_cancha: `Cancha ${nombreDeporte}`,
          descripcion_cancha: `Cancha de ${nombreDeporte} del club ${savedClub.nombre_club}`,
          precio_por_hora: 0,
          activa: 1,
          direccion_cancha: data.direccion || 'sin direccion',
          ciudad_cancha: data.ciudad,
          provincia_cancha: data.provincia,
          cp_cancha: data.cp,
          id_club: savedClub,
          id_deporte: deporte,
        });

        const canchaGuardada = await queryRunner.manager.save(cancha);
        canchasCreadas.push(canchaGuardada);
      }

      await queryRunner.commitTransaction();

      try {
        const admins = await this.userRepository.find({
          where: {
            tipo_usuario: 'admin',
            estado_usuario: 'activo',
          },
        });

        const adminEmails = admins
          .map((admin) => admin.email_usuario)
          .filter(
            (email): email is string =>
              Boolean(email),
          );

        await this.mailService.sendNewClubRequestToAdmins(
          adminEmails,
          {
            club: savedClub.nombre_club,
            nombre: `${savedUser.nombre_usuario} ${savedUser.apellido_usuario}`,
            email: savedUser.email_usuario,
            telefono: savedUser.telefono_usuario || undefined,
            ciudad: savedClub.ciudad_club || undefined,
            provincia: savedClub.provincia_club || undefined,
          },
        );
      } catch (mailError) {
        console.error(
          'El club quedó registrado, pero no se pudo notificar a los administradores:',
          mailError,
        );
      }

      return {
        message: 'Dueño, club y canchas creados correctamente',
        dueno: this.mapearUsuarioSeguro(savedUser),
        club: {
          ...savedClub,
          canchas: canchasCreadas,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();

      if (file?.path) {
        await unlink(file.path).catch(() => undefined);
      }

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findByEmail(email: string) {
    return this.userRepository.findOne({
      where: { email_usuario: this.normalizarEmail(email) },
    });
  }

  async savePasswordResetCode(email: string, code: string, expiresAt: Date) {
    const normalizedEmail = this.normalizarEmail(email);
    await this.userRepository.update(
      { email_usuario: normalizedEmail },
      {
        password_reset_code: this.hashResetCode(normalizedEmail, code),
        password_reset_expires: expiresAt,
        password_reset_attempts: 0,
      },
    );

    return {
      message: 'Código de recuperación generado correctamente',
    };
  }

  async resetPasswordWithCode(
    email: string,
    code: string,
    newPassword: string,
    confirmPassword: string,
  ) {
    if (!email || !code || !newPassword || !confirmPassword) {
      throw new BadRequestException('Todos los campos son obligatorios.');
    }

    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Las contraseñas no coinciden.');
    }

    this.validarPoliticaPassword(newPassword);

    const normalizedEmail = this.normalizarEmail(email);
    const user = await this.userRepository.findOne({
      where: { email_usuario: normalizedEmail },
    });

    if (!user || !user.password_reset_code || !user.password_reset_expires) {
      throw new BadRequestException('Código inválido o vencido.');
    }

    const ahora = new Date();

    if (user.password_reset_expires < ahora) {
      user.password_reset_code = null;
      user.password_reset_expires = null;
      user.password_reset_attempts = 0;
      await this.userRepository.save(user);
      throw new BadRequestException('Código inválido o vencido.');
    }

    const providedHash = this.hashResetCode(normalizedEmail, code);
    if (!this.compararHashSeguro(user.password_reset_code, providedHash)) {
      user.password_reset_attempts = Number(user.password_reset_attempts || 0) + 1;
      if (user.password_reset_attempts >= 5) {
        user.password_reset_code = null;
        user.password_reset_expires = null;
        user.password_reset_attempts = 0;
      }
      await this.userRepository.save(user);
      throw new BadRequestException('Código inválido o vencido.');
    }

    user.password_usuario = await this.hashearPassword(newPassword);
    user.password_reset_code = null;
    user.password_reset_expires = null;
    user.password_reset_attempts = 0;

    await this.userRepository.save(user);

    return {
      message: 'Contraseña actualizada correctamente.',
    };
  }

  async login(email: string, password: string) {
    const user = await this.userRepository.findOne({
      where: { email_usuario: this.normalizarEmail(email) },
      relations: ['clubs'],
    });

    if (!user) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }

    const passwordValida = await this.validarPasswordYMigrarSiHaceFalta(
      user,
      password,
    );

    if (!passwordValida) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }

    if (user.estado_usuario === 'inactivo') {
      throw new ForbiddenException('La cuenta se encuentra inactiva.');
    }

    if (user.estado_usuario === 'pendiente_aprobacion') {
      throw new ForbiddenException(
        'Tu club todavía se encuentra pendiente de aprobación por el administrador de DameCancha.',
      );
    }

    const clubPrincipal = user.clubs?.[0] || null;

    if (
      (user.tipo_usuario === 'dueno' || user.tipo_usuario === 'club') &&
      (!clubPrincipal || clubPrincipal.estado !== 'activo')
    ) {
      throw new ForbiddenException(
        'El club se encuentra inactivo y no puede operar.',
      );
    }

    return {
      message: 'Login exitoso',
      user: {
        id_usuario: user.id_usuario,
        nombre: user.nombre_usuario,
        apellido: user.apellido_usuario,
        email: user.email_usuario,
        tipo: user.tipo_usuario === 'dueno' ? 'club' : user.tipo_usuario,
        club: clubPrincipal,
      },
    };
  }
}