import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/guard/auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guard/roles.guard';
import { AccessControlService } from '../auth/services/access-control.service';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';
import { CreateReservaDto } from './dto/create-reserva.dto';
import { UpdateReservaDto } from './dto/update-reserva.dto';
import { ReservaService } from './reserva.service';
import { RegistrarCobrosReservaDto } from './dto/registrar-cobros-reserva.dto';

@Controller('reserva')
@UseGuards(AuthGuard)
export class ReservaController {
  constructor(
    private readonly reservaService: ReservaService,
    private readonly accessControl: AccessControlService,
  ) { }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('usuario', 'admin')
  create(
    @Body() dto: CreateReservaDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const idUsuario =
      request.user.tipo === 'admin'
        ? dto.id_usuario
        : request.user.sub;

    return this.reservaService.create({
      ...dto,
      id_usuario: Number(idUsuario),
      estado:
        request.user.tipo === 'admin'
          ? dto.estado
          : 'confirmada',
    });
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin')
  findAll() {
    return this.reservaService.findAll();
  }

  @Get('mias')
  @UseGuards(RolesGuard)
  @Roles('usuario')
  @Header(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate',
  )
  findMine(@Req() request: AuthenticatedRequest) {
    return this.reservaService.findByUsuario(
      Number(request.user.sub),
    );
  }

  @Get('usuario/:idUsuario')
  @Header(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate',
  )
  findByUsuario(
    @Param('idUsuario', ParseIntPipe) idUsuario: number,
    @Req() request: AuthenticatedRequest,
  ) {
    this.accessControl.assertSelfOrAdmin(
      request.user,
      idUsuario,
    );
    return this.reservaService.findByUsuario(idUsuario);
  }

  @Get('club/:idClub')
  @Header(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate',
  )
  async findByClub(
    @Param('idClub', ParseIntPipe) idClub: number,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.accessControl.assertCanReadReservationsForClub(
      request.user,
      idClub,
    );
    return this.reservaService.findByClub(idClub);
  }

  @Get('disponibilidad/:idCancha/:fecha')
  @Header(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate',
  )
  findDisponibilidad(
    @Param('idCancha', ParseIntPipe) idCancha: number,
    @Param('fecha') fecha: string,
  ) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      throw new BadRequestException(
        'La fecha debe tener el formato YYYY-MM-DD.',
      );
    }

    return this.reservaService.findDisponibilidad(
      idCancha,
      fecha,
    );
  }

  @Post(':id/cobros')
  @UseGuards(RolesGuard)
  @Roles('dueno', 'club', 'admin')
  async registrarCobros(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RegistrarCobrosReservaDto,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.accessControl.assertCanAccessReserva(
      request.user,
      id,
    );

    return this.reservaService.registrarCobros(id, dto);
  }

  @Get(':id/cobros')
  @UseGuards(RolesGuard)
  @Roles('dueno', 'club', 'admin')
  async obtenerCobros(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.accessControl.assertCanAccessReserva(
      request.user,
      id,
    );

    return this.reservaService.obtenerCobros(id);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.accessControl.assertCanAccessReserva(
      request.user,
      id,
    );
    return this.reservaService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReservaDto,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.accessControl.assertCanAccessReserva(
      request.user,
      id,
    );

    if (request.user.tipo === 'usuario') {
      await this.reservaService.assertUserCanUpdate(id);

      const safeDto: UpdateReservaDto = {
        id_cancha: dto.id_cancha,
        fecha: dto.fecha,
        hora_inicio: dto.hora_inicio,
        hora_fin: dto.hora_fin,
      };

      return this.reservaService.update(id, safeDto, request.user.tipo);
    }

    if (
      request.user.tipo !== 'admin' &&
      dto.id_cancha !== undefined
    ) {
      await this.accessControl.assertCanManageCancha(
        request.user,
        dto.id_cancha,
      );
    }

    return this.reservaService.update(
      id,
      {
        ...dto,
        id_usuario:
          request.user.tipo === 'admin'
            ? dto.id_usuario
            : undefined,
      },
      request.user.tipo,
    );
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { motivo?: string },
    @Req() request: AuthenticatedRequest,
  ) {
    await this.accessControl.assertCanAccessReserva(
      request.user,
      id,
    );

    if (request.user.tipo === 'usuario') {
      await this.reservaService.assertUserCanCancel(id);
    }

    const motivo = dto?.motivo?.trim();
    const esDueno = request.user.tipo === 'dueno' || request.user.tipo === 'club';

    if (esDueno && !motivo) {
      throw new BadRequestException(
        'Debés indicar el motivo de la cancelación.',
      );
    }

    if (motivo && motivo.length > 500) {
      throw new BadRequestException(
        'El motivo de cancelación no puede superar los 500 caracteres.',
      );
    }

    return this.reservaService.remove(id, {
      tipo: request.user.tipo,
      id: Number(request.user.sub),
      motivo,
    });
  }
}