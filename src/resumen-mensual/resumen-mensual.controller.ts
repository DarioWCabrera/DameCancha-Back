import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guard/auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';

import { GenerarResumenMensualDto } from './dto/generar-resumen-mensual.dto';
import { ResumenMensualCierreService } from './resumen-mensual-cierre.service';
import { ResumenMensualService } from './resumen-mensual.service';

@Controller('resumen-mensual')
@UseGuards(AuthGuard)
export class ResumenMensualController {
  constructor(
    private readonly resumenMensualService: ResumenMensualService,
    private readonly resumenMensualCierreService: ResumenMensualCierreService,
  ) {}

  /*
    Calcula el período en vivo pero NO guarda snapshot.
    Nos sirve para mostrar el mes actual y para probar el motor.
  */
  @Get('club/:idClub/preview')
  preview(
    @Param('idClub', ParseIntPipe) idClub: number,
    @Query('anio') anio: string | undefined,
    @Query('mes') mes: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.resumenMensualService.preview(
      idClub,
      anio,
      mes,
      request.user,
    );
  }

  /*
    Consulta un snapshot ya cerrado y persistido.
  */
  @Get('club/:idClub')
  obtenerGuardado(
    @Param('idClub', ParseIntPipe) idClub: number,
    @Query('anio') anio: string,
    @Query('mes') mes: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.resumenMensualService.obtenerGuardado(
      idClub,
      anio,
      mes,
      request.user,
    );
  }

  /*
    Genera y persiste un mes YA CERRADO para un club.
    Es idempotente: si el snapshot existe, devuelve el existente.
  */
  @Post('club/:idClub/generar')
  generar(
    @Param('idClub', ParseIntPipe) idClub: number,
    @Body() body: GenerarResumenMensualDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.resumenMensualService.generar(
      idClub,
      body.anio,
      body.mes,
      request.user,
    );
  }

  /*
    Ruta operativa de recuperación/prueba.
    Hace el mismo cierre que ejecutará automáticamente el scheduler,
    pero solo puede usarla un administrador.
  */
  @Post('admin/generar-periodo')
  @UseGuards(RolesGuard)
  @Roles('admin')
  generarPeriodoAdmin(
    @Body() body: GenerarResumenMensualDto,
  ) {
    return this.resumenMensualCierreService.generarPeriodo(
      body.anio,
      body.mes,
    );
  }
}
