import {
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

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /*
    Registro de usuario común.

    Permitimos hasta 10 intentos cada 10 minutos por IP.
    Esto sigue protegiendo el endpoint frente a abuso,
    pero evita bloquear durante una hora a alguien que
    simplemente corrigió un email o DNI ya registrado.
  */
  @Post()
  @UseGuards(RateLimitGuard)
  @RateLimit({
    limit: 10,
    windowMs: 10 * 60 * 1000,
  })
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create({
      ...createUserDto,
      tipo_usuario: 'usuario',
      estado_usuario: 'activo',
    });
  }

  /*
    Verificación de email.

    Se mantiene en 20 consultas cada 15 minutos.
  */
  @Post('email')
  @UseGuards(RateLimitGuard)
  @RateLimit({
    limit: 20,
    windowMs: 15 * 60 * 1000,
  })
  existsEmail(@Body('email') email: string) {
    return this.userService.existsByEmail(email);
  }

  /*
    Verificación de DNI.

    Se mantiene en 20 consultas cada 15 minutos.
  */
  @Post('dni')
  @UseGuards(RateLimitGuard)
  @RateLimit({
    limit: 20,
    windowMs: 15 * 60 * 1000,
  })
  existsDni(@Body('dni') dni: string) {
    return this.userService.existsByDni(dni);
  }

  /*
    Creación de administradores.
    Solo puede hacerlo un administrador autenticado.
  */
  @Post('create-admin')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  createAdmin(@Body() createUserDto: CreateUserDto) {
    return this.userService.create({
      ...createUserDto,
      tipo_usuario: 'admin',
      estado_usuario: 'activo',
    });
  }

  /*
    Login.

    Se mantiene más estricto:
    máximo 10 intentos cada 10 minutos.
  */
  @Post('login')
  @UseGuards(RateLimitGuard)
  @RateLimit({
    limit: 10,
    windowMs: 10 * 60 * 1000,
  })
  login(@Body() body: LoginDto) {
    return this.userService.login(
      body.email,
      body.password,
    );
  }

  /*
    Registro de dueño + club.

    Antes estaba limitado a solo 3 intentos por hora.
    Lo dejamos igual que el registro de usuario:
    10 intentos cada 10 minutos.
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
  createWithClub(
    @Body() body: RegisterOwnerDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.userService.createWithClub(
      body,
      file,
    );
  }

  @Get('count')
  countRegisteredUsers() {
    return this.userService.countRegisteredUsers();
  }

  /*
    Listado completo de usuarios.
    Solo administrador.
  */
  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  findAll() {
    return this.userService.findAll();
  }

  /*
    Un usuario solo puede consultar su propio perfil.
    El admin puede consultar cualquiera.
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

  /*
    Un usuario solo puede modificar su propio perfil.
    El admin puede modificar cualquiera.
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

  /*
    Eliminación de usuarios.
    Solo administrador.
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