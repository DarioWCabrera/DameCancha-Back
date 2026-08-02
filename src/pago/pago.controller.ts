import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';

import { PagoService } from './pago.service';
import { CreatePagoDto } from './dto/create-pago.dto';
import { UpdatePagoDto } from './dto/update-pago.dto';
import { AuthGuard } from '../auth/guard/auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessControlService } from '../auth/services/access-control.service';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';

@Controller('pago')
export class PagoController {
  constructor(
    private readonly pagoService: PagoService,
    private readonly accessControl: AccessControlService,
  ) {}

  @Post('mercadopago/preference/:idReserva')
  @UseGuards(AuthGuard)
  async crearPreferenciaMercadoPago(
    @Param('idReserva', ParseIntPipe) idReserva: number,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.accessControl.assertCanAccessReserva(request.user, idReserva);
    return this.pagoService.crearPreferenciaMercadoPago(idReserva);
  }

  /**
   * Endpoint público requerido por Mercado Pago. La autenticidad se valida con
   * la firma x-signature antes de consultar o persistir el estado del pago.
   */
  @Post('mercadopago/webhook')
  procesarWebhookMercadoPago(
    @Body() body: unknown,
    @Query('type') typeQuery?: string,
    @Query('data.id') dataIdQuery?: string,
    @Headers('x-signature') xSignature?: string,
    @Headers('x-request-id') xRequestId?: string,
  ) {
    const payload = body as {
      data?: { id?: string | number };
      id?: string | number;
      type?: string;
      topic?: string;
    };

    return this.pagoService.procesarWebhookMercadoPago({
      dataId: String(dataIdQuery || payload?.data?.id || payload?.id || ''),
      type: typeQuery || payload?.type || payload?.topic,
      xSignature,
      xRequestId,
    });
  }

  @Get('mercadopago/status/:idReserva')
  @UseGuards(AuthGuard)
  async obtenerEstadoMercadoPago(
    @Param('idReserva', ParseIntPipe) idReserva: number,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.accessControl.assertCanAccessReserva(request.user, idReserva);
    return this.pagoService.obtenerEstadoMercadoPago(idReserva);
  }

  @Get('mercadopago/retorno')
  retornoMercadoPago(
    @Query('payment') payment: string,
    @Query('reservaId') reservaId: string,
    @Res() response: Response,
  ) {
    return response.redirect(
      this.pagoService.construirUrlRetornoFrontend(payment, reservaId),
    );
  }

  // El CRUD técnico de pagos queda reservado a administradores.
  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  create(@Body() createPagoDto: CreatePagoDto) {
    return this.pagoService.create(createPagoDto);
  }

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  findAll() {
    return this.pagoService.findAll();
  }

  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.pagoService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePagoDto: UpdatePagoDto,
  ) {
    return this.pagoService.update(id, updatePagoDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.pagoService.remove(id);
  }
}
