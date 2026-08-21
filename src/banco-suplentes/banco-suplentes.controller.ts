import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { AuthGuard } from '../auth/guard/auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guard/roles.guard';
import {
  BancoSuplentesService,
  UsuarioAutenticadoBanco,
} from './banco-suplentes.service';
import { CreateDisponibilidadJugadorDto } from './dto/create-disponibilidad-jugador.dto';
import { CreateSolicitudJugadorDto } from './dto/create-solicitud-jugador.dto';
import { UpdateDisponibilidadJugadorDto } from './dto/update-disponibilidad-jugador.dto';
import { UpdateEstadoDisponibilidadDto } from './dto/update-estado-disponibilidad.dto';
import { UpdateEstadoSolicitudDto } from './dto/update-estado-solicitud.dto';

type RequestAutenticada = Request & {
  user: UsuarioAutenticadoBanco;
};

@Controller('banco-suplentes')
@UseGuards(AuthGuard, RolesGuard)
@Roles('usuario')
export class BancoSuplentesController {
  constructor(
    private readonly bancoSuplentesService: BancoSuplentesService,
  ) {}

  @Post('disponibilidades')
  createDisponibilidad(
    @Body() dto: CreateDisponibilidadJugadorDto,
    @Req() request: RequestAutenticada,
  ) {
    return this.bancoSuplentesService.createDisponibilidad(
      dto,
      request.user,
    );
  }

  @Get('disponibilidades')
  findDisponibles(
    @Query('id_deporte') idDeporte: string | undefined,
    @Query('ciudad') ciudad: string | undefined,
    @Query('nivel') nivel: string | undefined,
    @Query('dia') dia: string | undefined,
    @Query('fecha') fecha: string | undefined,
    @Query('hora') hora: string | undefined,
    @Req() request: RequestAutenticada,
  ) {
    return this.bancoSuplentesService.findDisponibles(
      {
        id_deporte: idDeporte ? Number(idDeporte) : undefined,
        ciudad,
        nivel,
        dia,
        fecha,
        hora,
      },
      request.user,
    );
  }

  @Get('mis-disponibilidades')
  findMisDisponibilidades(
    @Req() request: RequestAutenticada,
  ) {
    return this.bancoSuplentesService.findMisDisponibilidades(
      request.user.sub,
    );
  }

  @Patch('disponibilidades/:id')
  updateDisponibilidad(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDisponibilidadJugadorDto,
    @Req() request: RequestAutenticada,
  ) {
    return this.bancoSuplentesService.updateDisponibilidad(
      id,
      dto,
      request.user,
    );
  }

  @Patch('disponibilidades/:id/estado')
  updateEstadoDisponibilidad(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEstadoDisponibilidadDto,
    @Req() request: RequestAutenticada,
  ) {
    return this.bancoSuplentesService.updateEstadoDisponibilidad(
      id,
      dto,
      request.user,
    );
  }

  @Delete('disponibilidades/:id')
  removeDisponibilidad(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: RequestAutenticada,
  ) {
    return this.bancoSuplentesService.removeDisponibilidad(
      id,
      request.user,
    );
  }

  @Post('disponibilidades/:id/solicitudes')
  createSolicitud(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateSolicitudJugadorDto,
    @Req() request: RequestAutenticada,
  ) {
    return this.bancoSuplentesService.createSolicitud(
      id,
      dto,
      request.user,
    );
  }

  @Get('solicitudes/recibidas')
  findSolicitudesRecibidas(
    @Req() request: RequestAutenticada,
  ) {
    return this.bancoSuplentesService.findSolicitudesRecibidas(
      request.user.sub,
    );
  }

  @Get('solicitudes/enviadas')
  findSolicitudesEnviadas(
    @Req() request: RequestAutenticada,
  ) {
    return this.bancoSuplentesService.findSolicitudesEnviadas(
      request.user.sub,
    );
  }

  @Patch('solicitudes/:id/estado')
  updateEstadoSolicitud(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEstadoSolicitudDto,
    @Req() request: RequestAutenticada,
  ) {
    return this.bancoSuplentesService.updateEstadoSolicitud(
      id,
      dto,
      request.user,
    );
  }

  @Delete('solicitudes/:id')
  removeSolicitud(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: RequestAutenticada,
  ) {
    return this.bancoSuplentesService.removeSolicitud(
      id,
      request.user,
    );
  }

}
