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

import { AuthGuard } from '../auth/guard/auth.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';
import { AprobarTurnoFijoDto } from './dto/aprobar-turno-fijo.dto';
import { RechazarTurnoFijoDto } from './dto/rechazar-turno-fijo.dto';
import { CreateSolicitudTurnoFijoDto } from './dto/create-solicitud-turno-fijo.dto';
import { CreateTurnoFijoManualDto } from './dto/create-turno-fijo-manual.dto';
import { TurnoFijoService } from './turno-fijo.service';

@Controller('turno-fijo')
@UseGuards(AuthGuard)
export class TurnoFijoController {
  constructor(
    private readonly turnoFijoService: TurnoFijoService,
  ) { }

  @Post('solicitudes')
  crearSolicitudUsuario(
    @Body() dto: CreateSolicitudTurnoFijoDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.turnoFijoService.crearSolicitudUsuario(
      dto,
      request.user,
    );
  }

  @Get('club/:idClub/solicitudes-pendientes')
  listarSolicitudesPendientesClub(
    @Param('idClub', ParseIntPipe) idClub: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.turnoFijoService.listarSolicitudesPendientesClub(
      idClub,
      request.user,
    );
  }

  @Patch(':idTurnoFijo/aprobar')
  aprobarSolicitud(
    @Param('idTurnoFijo', ParseIntPipe) idTurnoFijo: number,
    @Body() dto: AprobarTurnoFijoDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.turnoFijoService.aprobarSolicitud(
      idTurnoFijo,
      dto,
      request.user,
    );
  }

  @Get(':idTurnoFijo/alternativas')
  listarAlternativasReales(
    @Param('idTurnoFijo', ParseIntPipe)
    idTurnoFijo: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.turnoFijoService.listarAlternativasReales(
      idTurnoFijo,
      request.user,
    );
  }


  @Patch(':idTurnoFijo/rechazar')
  rechazarSolicitud(
    @Param('idTurnoFijo', ParseIntPipe)
    idTurnoFijo: number,
    @Body() dto: RechazarTurnoFijoDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.turnoFijoService.rechazarSolicitud(
      idTurnoFijo,
      dto,
      request.user,
    );
  }

  @Patch(':idTurnoFijo/finalizar')
  finalizarTurnoFijoActivo(
    @Param(
      'idTurnoFijo',
      ParseIntPipe,
    )
    idTurnoFijo: number,

    @Req()
    request: AuthenticatedRequest,
  ) {
    return this.turnoFijoService
      .finalizarTurnoFijoActivo(
        idTurnoFijo,
        request.user,
      );
  }


  @Get('club/:idClub/activos')
  listarTurnosFijosActivosClub(
    @Param('idClub', ParseIntPipe) idClub: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.turnoFijoService.listarTurnosFijosActivosClub(
      idClub,
      request.user,
    );
  }

  @Post('manual')
  crearTurnoFijoManual(
    @Body() dto: CreateTurnoFijoManualDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.turnoFijoService.crearTurnoFijoManual(
      dto,
      request.user,
    );
  }

  @Delete(':idTurnoFijo/rechazado')
  eliminarTurnoFijoRechazado(
    @Param('idTurnoFijo', ParseIntPipe)
    idTurnoFijo: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.turnoFijoService.eliminarTurnoFijoRechazado(
      idTurnoFijo,
      request.user,
    );
  }

  @Get('mios')
  listarMisTurnosFijos(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.turnoFijoService.listarMisTurnosFijos(
      request.user,
    );
  }

}
