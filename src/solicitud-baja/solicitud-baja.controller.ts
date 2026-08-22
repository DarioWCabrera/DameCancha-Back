import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import type { Request } from 'express';

import { AuthGuard } from '../auth/guard/auth.guard';
import { SolicitudBajaService } from './solicitud-baja.service';
import type { UsuarioAutenticado } from './solicitud-baja.service';

type RequestAutenticado = Request & {
  user: UsuarioAutenticado;
};

@Controller('solicitud-baja')
@UseGuards(AuthGuard)
export class SolicitudBajaController {
  constructor(
    private readonly solicitudBajaService: SolicitudBajaService,
  ) {}

  /*
    DUEÑO
    Registra una solicitud de baja para su propio club.

    POST /solicitud-baja

    Body:
    {
      "idClub": 1,
      "motivo": "No deseo continuar con el servicio."
    }
  */
  @Post()
  crearSolicitud(
    @Body()
    body: {
      idClub: number;
      motivo?: string;
    },
    @Req() request: RequestAutenticado,
  ) {
    return this.solicitudBajaService.crearSolicitud(
      body.idClub,
      body.motivo,
      request.user,
    );
  }

  /*
    ADMIN
    Devuelve todas las solicitudes.

    GET /solicitud-baja/admin
  */
  @Get('admin')
  listarSolicitudes(
    @Req() request: RequestAutenticado,
  ) {
    return this.solicitudBajaService.listarSolicitudes(
      request.user,
    );
  }

  /*
    ADMIN
    Marca una solicitud como procesada.

    PATCH /solicitud-baja/:id/procesar
  */
  @Patch(':id/procesar')
  procesarSolicitud(
    @Param('id') idSolicitud: string,
    @Req() request: RequestAutenticado,
  ) {
    return this.solicitudBajaService.procesarSolicitud(
      idSolicitud,
      request.user,
    );
  }
}