import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { AuthGuard } from '../auth/guard/auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guard/roles.guard';
import { BloqueoCanchaService, UsuarioAutenticado } from './bloqueo-cancha.service';
import { CreateBloqueoCanchaDto } from './dto/create-bloqueo-cancha.dto';
import { UpdateBloqueoCanchaDto } from './dto/update-bloqueo-cancha.dto';

type RequestAutenticada = Request & {
  user: UsuarioAutenticado;
};

@Controller('bloqueo-cancha')
@UseGuards(AuthGuard, RolesGuard)
export class BloqueoCanchaController {
  constructor(
    private readonly bloqueoCanchaService: BloqueoCanchaService,
  ) {}

  @Post()
  @Roles('club', 'dueno', 'admin')
  create(
    @Body() dto: CreateBloqueoCanchaDto,
    @Req() request: RequestAutenticada,
  ) {
    return this.bloqueoCanchaService.create(dto, request.user);
  }

  @Get('cancha/:idCancha')
  @Roles('club', 'dueno', 'admin')
  findByCancha(
    @Param('idCancha', ParseIntPipe) idCancha: number,
    @Req() request: RequestAutenticada,
  ) {
    return this.bloqueoCanchaService.findByCancha(
      idCancha,
      request.user,
    );
  }

  @Get('cancha/:idCancha/fecha/:fecha')
  @Roles('club', 'dueno', 'admin')
  findByCanchaYFecha(
    @Param('idCancha', ParseIntPipe) idCancha: number,
    @Param('fecha') fecha: string,
    @Req() request: RequestAutenticada,
  ) {
    return this.bloqueoCanchaService.findByCancha(
      idCancha,
      request.user,
      fecha,
    );
  }

  @Patch(':id')
  @Roles('club', 'dueno', 'admin')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBloqueoCanchaDto,
    @Req() request: RequestAutenticada,
  ) {
    return this.bloqueoCanchaService.update(id, dto, request.user);
  }

  @Delete(':id')
  @Roles('club', 'dueno', 'admin')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: RequestAutenticada,
  ) {
    return this.bloqueoCanchaService.remove(id, request.user);
  }
}