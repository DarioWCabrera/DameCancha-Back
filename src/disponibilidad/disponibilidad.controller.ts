import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';

import { DisponibilidadService } from './disponibilidad.service';
import { CreateDisponibilidadDto } from './dto/create-disponibilidad.dto';
import { UpdateDisponibilidadDto } from './dto/update-disponibilidad.dto';
import { AuthGuard } from '../auth/guard/auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessControlService } from '../auth/services/access-control.service';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';

@Controller('disponibilidad')
export class DisponibilidadController {
  constructor(
    private readonly service: DisponibilidadService,
    private readonly accessControl: AccessControlService,
  ) {}

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('dueno', 'admin', 'club')
  async create(@Body() dto: CreateDisponibilidadDto, @Req() request: AuthenticatedRequest) {
    await this.accessControl.assertCanManageCancha(request.user, dto.id_cancha);
    return this.service.create(dto);
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('cancha/:idCancha')
  findByCancha(@Param('idCancha', ParseIntPipe) idCancha: number) {
    return this.service.findByCancha(idCancha);
  }

  @Put('cancha/:idCancha')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('dueno', 'admin', 'club')
  async replaceForCancha(
    @Param('idCancha', ParseIntPipe) idCancha: number,
    @Body() items: { dia_semana: number; hora_inicio: string; hora_fin: string }[],
    @Req() request: AuthenticatedRequest,
  ) {
    await this.accessControl.assertCanManageCancha(request.user, idCancha);
    return this.service.replaceForCancha(idCancha, items);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('dueno', 'admin', 'club')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDisponibilidadDto,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.accessControl.assertCanManageDisponibilidad(request.user, id);
    if (dto.id_cancha !== undefined) {
      await this.accessControl.assertCanManageCancha(request.user, dto.id_cancha);
    }
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('dueno', 'admin', 'club')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.accessControl.assertCanManageDisponibilidad(request.user, id);
    return this.service.remove(id);
  }
}
