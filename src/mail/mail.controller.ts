import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { MailDto } from './dto/create-mail.dto';
import { MailService } from './mail.service';
import { RateLimit } from '../common/rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../common/rate-limit/rate-limit.guard';
import { AuthGuard } from '../auth/guard/auth.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';

const PUBLIC_SUBJECTS = new Set([
  '¡Bienvenido a DameCancha!',
  'Bienvenido a DameCancha!',
  'Club Registrado en DameCancha',
]);

const RESERVATION_SUBJECTS = new Set([
  'Reserva Exitosa',
  'Reserva confirmada',
  'Reserva actualizada',
  'Reserva modificada',
  'Reserva cancelada',
]);

@Controller('contact')
@UseGuards(RateLimitGuard)
export class MailController {
  constructor(private readonly mailService: MailService) {}

  /**
   * Endpoint público limitado a mensajes de alta. Los correos asociados a
   * reservas requieren una sesión válida en /contact/reserva.
   */
  @Post()
  @RateLimit({ limit: 8, windowMs: 15 * 60 * 1000 })
  async sendPublic(@Body() body: MailDto) {
    if (!PUBLIC_SUBJECTS.has(body.subject)) {
      throw new ForbiddenException(
        'Este tipo de correo requiere una sesión autenticada.',
      );
    }

    await this.mailService.sendContactMail(body);
    return { ok: true, message: 'Mail enviado' };
  }

  @Post('reserva')
  @UseGuards(AuthGuard)
  @RateLimit({ limit: 12, windowMs: 15 * 60 * 1000 })
  async sendReservation(
    @Body() body: MailDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!RESERVATION_SUBJECTS.has(body.subject)) {
      throw new ForbiddenException('Asunto de reserva no permitido.');
    }

    const destination = String(body.email || '').trim().toLowerCase();
    const authenticatedEmail = String(request.user.email || '')
      .trim()
      .toLowerCase();

    if (
      request.user.tipo !== 'admin' &&
      destination !== authenticatedEmail
    ) {
      throw new ForbiddenException(
        'No tenés permiso para enviar correos a otro usuario.',
      );
    }

    await this.mailService.sendContactMail(body);
    return { ok: true, message: 'Mail enviado' };
  }
}
