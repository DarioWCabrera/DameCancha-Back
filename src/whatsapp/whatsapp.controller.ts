import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';

import { WhatsAppService } from './whatsapp.service';

import { AuthGuard } from '../auth/guard/auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

import { TestRecordatorioDto } from './dto/test-recordatorio.dto';

@Controller('whatsapp')
export class WhatsAppController {
  constructor(
    private readonly whatsappService: WhatsAppService,
  ) {}

  @Post('test-recordatorio')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  async testRecordatorio(
    @Body() body: TestRecordatorioDto,
  ) {
    const resultado =
      await this.whatsappService.sendTemplate({
        to: body.to,

        templateName: 'recordatorio_reserva',

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