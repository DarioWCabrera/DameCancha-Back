import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';

import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

import { AuthGuard } from '../auth/guard/auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

import { LoginDto } from '../auth/dto/login.dto';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';
import { RegisterOwnerDto } from '../auth/dto/register-owner.dto';

import { imageUploadOptions } from '../common/uploads/image-upload';

import { RateLimit } from '../common/rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../common/rate-limit/rate-limit.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RecaptchaService } from '../common/recaptcha/recaptcha.service';
import { RegisterPushDeviceDto } from './dto/register-push-device.dto';

@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly recaptchaService: RecaptchaService,
  ) { }

  /**
   * Registro de usuario común.
   *
   * Permitimos hasta 10 intentos cada 10 minutos por IP.
   * Además, el registro requiere una validación reCAPTCHA válida.
   */
  @Post()
  @UseGuards(RateLimitGuard)
  @RateLimit({
    limit: 10,
    windowMs: 10 * 60 * 1000,
  })
  async create(
    @Body() createUserDto: CreateUserDto,
  ) {
    const recaptchaValido =
      await this.recaptchaService.verify(
        createUserDto.recaptchaToken || '',
      );

    if (!recaptchaValido) {
      throw new BadRequestException(
        'No se pudo validar reCAPTCHA. Intentá nuevamente.',
      );
    }

    // Sacamos el token antes de enviar los datos al service.
    // El token de Google NO debe guardarse en la base de datos.
    const {
      recaptchaToken,
      ...datosUsuario
    } = createUserDto;

    return this.userService.create({
      ...datosUsuario,
      tipo_usuario: 'usuario',
      estado_usuario: 'activo',
    });
  }

  /**
   * Verificación de DNI.
   *
   * Se mantiene en 20 consultas cada 15 minutos.
   */
  @Post('dni')
  @UseGuards(RateLimitGuard)
  @RateLimit({
    limit: 20,
    windowMs: 15 * 60 * 1000,
  })
  existsDni(
    @Body('dni') dni: string,
  ) {
    return this.userService.existsByDni(dni);
  }

  /**
   * Creación de administradores.
   *
   * Solo puede hacerlo un administrador autenticado.
   */
  @Post('create-admin')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  createAdmin(
    @Body() createUserDto: CreateUserDto,
  ) {
    const {
      recaptchaToken,
      ...datosUsuario
    } = createUserDto;

    return this.userService.create({
      ...datosUsuario,
      tipo_usuario: 'admin',
      estado_usuario: 'activo',
    });
  }

  /**
   * Login.
   *
   * Máximo 10 intentos cada 10 minutos.
   */
  @Post('login')
  @UseGuards(RateLimitGuard)
  @RateLimit({
    limit: 10,
    windowMs: 10 * 60 * 1000,
  })
  login(
    @Body() body: LoginDto,
  ) {
    return this.userService.login(
      body.email,
      body.password,
    );
  }

  @Post('push-device')
@UseGuards(AuthGuard)
registrarPushDevice(
  @Req() req: AuthenticatedRequest,
  @Body() body: RegisterPushDeviceDto,
) {
  return this.userService.registrarPushDevice(
    req.user.sub,
    body.fcm_token,
  );
}

  /**
   * Registro de dueño + club.
   *
   * Por ahora conserva el funcionamiento actual.
   * En el próximo paso agregaremos también
   * la validación de reCAPTCHA.
   */
  @Post('register')
  @UseGuards(RateLimitGuard)
  @RateLimit({
    limit: 10,
    windowMs: 10 * 60 * 1000,
  })
  @UseInterceptors(
    FileInterceptor(
      'logo',
      imageUploadOptions('', 2),
    ),
  )
  async createWithClub(
    @Body() body: RegisterOwnerDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const recaptchaValido =
      await this.recaptchaService.verify(
        body.recaptchaToken || '',
      );

    if (!recaptchaValido) {
      throw new BadRequestException(
        'No se pudo validar reCAPTCHA. Intentá nuevamente.',
      );
    }

    // El token solamente sirve para verificar el CAPTCHA.
    // No debe llegar al service ni guardarse en la base.
    const {
      recaptchaToken,
      ...datosRegistro
    } = body;

    return this.userService.createWithClub(
      datosRegistro,
      file,
    );
  }

  /**
   * Listado completo de usuarios.
   *
   * Solo administrador.
   */
  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  findAll() {
    return this.userService.findAll();
  }

  /**
   * Un usuario solo puede consultar su propio perfil.
   * El admin puede consultar cualquiera.
   */
  @Get(':id')
  @UseGuards(AuthGuard)
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    if (
      request.user.tipo !== 'admin' &&
      Number(request.user.sub) !== id
    ) {
      throw new ForbiddenException(
        'No tenés permiso para consultar este usuario.',
      );
    }

    return this.userService.findOne(id);
  }

  /**
    * El admin puede cambiar su contraseña.
   */

  @Patch('me/password')
  @UseGuards(AuthGuard)
  async changeOwnPassword(
    @Body() body: ChangePasswordDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.userService.changeOwnPassword(
      Number(request.user.sub),
      body.currentPassword,
      body.newPassword,
      body.confirmPassword,
    );
  }

  /**
   * Un usuario solo puede modificar su propio perfil.
   * El admin puede modificar cualquiera.
   */
  @Patch(':id')
  @UseGuards(AuthGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (
      request.user.tipo !== 'admin' &&
      Number(request.user.sub) !== id
    ) {
      throw new ForbiddenException(
        'No tenés permiso para modificar este usuario.',
      );
    }

    return this.userService.update(
      id,
      updateUserDto,
    );
  }

  /**
   * Eliminación de usuarios.
   *
   * Solo administrador.
   */
  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  remove(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.userService.remove(id);
  }
}