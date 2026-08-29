import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';

import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';

import { WhatsAppService } from './whatsapp.service';
import { AuthGuard } from '../auth/guard/auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TestRecordatorioDto } from './dto/test-recordatorio.dto';

@Controller('whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(
    WhatsAppController.name,
  );

  constructor(
    private readonly whatsappService: WhatsAppService,
    private readonly configService: ConfigService,
  ) {}

  /*
    Meta usa este GET una sola vez para verificar
    que la URL del webhook realmente nos pertenece.
  */
  @Get('webhook')
  verificarWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
    @Res() response: Response,
  ) {
    const tokenEsperado =
      this.configService
        .get<string>('WHATSAPP_WEBHOOK_VERIFY_TOKEN')
        ?.trim();

    if (
      mode === 'subscribe' &&
      tokenEsperado &&
      verifyToken === tokenEsperado
    ) {
      this.logger.log(
        'Webhook de WhatsApp verificado correctamente.',
      );

      return response
        .status(200)
        .send(challenge);
    }

    this.logger.warn(
      'Intento de verificación de webhook rechazado.',
    );

    return response
      .status(403)
      .send('Token de verificación inválido.');
  }

  /*
    Meta enviará acá los estados reales de los mensajes:
    sent / delivered / read / failed.
  */
  @Post('webhook')
  recibirWebhook(
    @Body() body: any,
  ) {
    try {
      const entries = Array.isArray(body?.entry)
        ? body.entry
        : [];

      for (const entry of entries) {
        const changes = Array.isArray(entry?.changes)
          ? entry.changes
          : [];

        for (const change of changes) {
          const statuses =
            Array.isArray(
              change?.value?.statuses,
            )
              ? change.value.statuses
              : [];

          for (const status of statuses) {
            this.logger.log(
              [
                'WhatsApp status.',
                `id=${status?.id || 'sin-id'}`,
                `status=${status?.status || 'desconocido'}`,
                `recipient=${status?.recipient_id || 'desconocido'}`,
              ].join(' '),
            );

            if (
              status?.status === 'failed'
            ) {
              const errors =
                Array.isArray(status?.errors)
                  ? status.errors
                  : [];

              for (const error of errors) {
                this.logger.error(
                  [
                    'WhatsApp FAILED.',
                    error?.code
                      ? `code=${error.code}`
                      : null,
                    error?.title
                      ? `title=${error.title}`
                      : null,
                    error?.message
                      ? `message=${error.message}`
                      : null,
                    error?.error_data?.details
                      ? `details=${error.error_data.details}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' '),
                );
              }
            }
          }
        }
      }
    } catch (error) {
      this.logger.error(
        'Error procesando webhook de WhatsApp.',
        error instanceof Error
          ? error.stack
          : undefined,
      );
    }

    /*
      Aunque no haya status, respondemos 200.
      Meta necesita recibir respuesta exitosa para no
      reintentar innecesariamente el mismo evento.
    */
    return {
      received: true,
    };
  }

  /*
    Endpoint temporal para pruebas manuales.
    Solo lo puede utilizar un administrador.
  */
  @Post('test-recordatorio')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async testRecordatorio(
    @Body() body: TestRecordatorioDto,
  ) {
    const resultado =
      await this.whatsappService.sendTemplate({
        to: body.to,
        templateName:
          'recordatorio_reserva',
        languageCode: 'es_AR',
        parameters: [
          body.nombre,
          body.club,
          body.fecha,
          body.horario,
          body.cancha,
        ],
      });

    return {
      message:
        'Solicitud de WhatsApp enviada a Meta correctamente.',
      meta: resultado,
    };
  }
}