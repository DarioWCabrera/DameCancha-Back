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

import { AuthGuard } from '../auth/guard/auth.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';

import { CreateIngresoManualClubDto } from './dto/create-ingreso-manual-club.dto';
import { UpdateIngresoManualClubDto } from './dto/update-ingreso-manual-club.dto';
import { IngresoManualService } from './ingreso-manual.service';

@Controller('ingreso-manual')
@UseGuards(AuthGuard)
export class IngresoManualController {
  constructor(
    private readonly ingresoManualService: IngresoManualService,
  ) {}

  @Post()
  crear(
    @Body() body: CreateIngresoManualClubDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.ingresoManualService.crear(
      body,
      request.user,
    );
  }

  @Get('club/:idClub')
  listarPorClub(
    @Param('idClub', ParseIntPipe) idClub: number,
    @Query('anio') anio: string | undefined,
    @Query('mes') mes: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.ingresoManualService.listarPorClub(
      idClub,
      request.user,
      anio,
      mes,
    );
  }

  @Patch(':idIngreso')
  actualizar(
    @Param('idIngreso', ParseIntPipe) idIngreso: number,
    @Body() body: UpdateIngresoManualClubDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.ingresoManualService.actualizar(
      idIngreso,
      body,
      request.user,
    );
  }

  @Delete(':idIngreso')
  eliminar(
    @Param('idIngreso', ParseIntPipe) idIngreso: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.ingresoManualService.eliminar(
      idIngreso,
      request.user,
    );
  }
}
