import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as path from 'path';
import * as fs from 'fs';
import { MailDto } from './dto/create-mail.dto';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly recentMails = new Map<string, number>();

  private readonly resend: Resend;

constructor(
  private readonly configService: ConfigService,
) {
  const apiKey = this.configService.get<string>('RESEND_API_KEY');

  if (!apiKey) {
    throw new Error('Falta configurar RESEND_API_KEY.');
  }

  this.resend = new Resend(apiKey);
}

  private normalizarSubject(subject: string): string {
    if (subject === '¡Bienvenido a DameCancha!') return 'Bienvenido a DameCancha!';
    if (subject === 'Reserva actualizada') {
      return 'Reserva modificada';
    }

    if (subject === 'Reserva Exitosa') {
      return 'Reserva confirmada';
    }

    return subject;
  }

  private obtenerPlantilla(subject: string): string {
    switch (subject) {
      case 'Bienvenido a DameCancha!':
        return 'Bienvenida.html';

      case 'Club Registrado en DameCancha':
        return 'RegistroClub.html';

      case 'Reserva confirmada':
        return 'ReservaConfirmada.html';

      case 'Reserva modificada':
        return 'ReservaModificada.html';

      case 'Reserva cancelada':
        return 'ReservaCancelada.html';

      case 'Código de recuperación - DameCancha':
        return 'RecuperarPassword.html';

      default:
        throw new Error(`Subject no válido: ${subject}`);
    }
  }

  private obtenerEmojiDeporte(cancha?: string): string {
    const texto = (cancha || '').toLowerCase();

    if (texto.includes('futbol') || texto.includes('fútbol')) return '⚽';
    if (
      texto.includes('basquet') ||
      texto.includes('básquet') ||
      texto.includes('basket')
    ) {
      return '🏀';
    }
    if (texto.includes('tenis')) return '🎾';
    if (texto.includes('padel') || texto.includes('pádel')) return '🎾';
    if (texto.includes('voley') || texto.includes('vóley')) return '🏐';
    if (texto.includes('natacion') || texto.includes('natación')) return '🏊';
    if (texto.includes('golf')) return '⛳';

    return '🏟️';
  }

  private escapeHtml(value: unknown): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private reemplazarVariables(
    html: string,
    variables: Record<string, unknown>,
  ): string {
    let resultado = html;
    for (const [clave, valor] of Object.entries(variables)) {
      resultado = resultado
        .split(`{{${clave}}}`)
        .join(this.escapeHtml(valor));
    }
    return resultado;
  }

  private obtenerRemitente(): string {
    return (
      this.configService.get<string>('MAIL_FROM') ||
      'DameCancha <no-reply@localhost>'
    );
  }

  private async enviarConResend(
  destinatario: string,
  subject: string,
  html: string,
) {
  const { data, error } = await this.resend.emails.send({
    from: this.obtenerRemitente(),
    to: destinatario,
    subject,
    html,
  });

  if (error) {
    throw new Error(
      `Resend rechazó el envío: ${error.message || JSON.stringify(error)}`,
    );
  }

  return data;
}

  private crearClaveDuplicado(data: MailDto, subjectNormalizado: string): string {
    return [
      data.email || '',
      subjectNormalizado || '',
      data.fecha || '',
      data.hora || '',
      data.cancha || '',
      data.club || '',
    ].join('|');
  }

  private esMailDuplicado(clave: string): boolean {
    const ahora = Date.now();
    const ultimoEnvio = this.recentMails.get(clave);

    const TIEMPO_BLOQUEO_MS = 8000;

    if (ultimoEnvio && ahora - ultimoEnvio < TIEMPO_BLOQUEO_MS) {
      return true;
    }

    this.recentMails.set(clave, ahora);

    setTimeout(() => {
      this.recentMails.delete(clave);
    }, TIEMPO_BLOQUEO_MS);

    return false;
  }

  private cargarPlantilla(nombrePlantilla: string): string {
    const candidatos = [
      path.join(process.cwd(), 'dist', 'templates', nombrePlantilla),
      path.join(process.cwd(), 'src', 'templates', nombrePlantilla),
    ];
    const filePath = candidatos.find((candidate) => fs.existsSync(candidate));
    if (!filePath) {
      throw new Error(`No se encontró la plantilla ${nombrePlantilla}.`);
    }
    return fs.readFileSync(filePath, 'utf8');
  }

  async sendContactMail(data: MailDto) {
    try {
      const subjectNormalizado = this.normalizarSubject(data.subject);
      const plantillaHtml = this.obtenerPlantilla(subjectNormalizado);

      const claveDuplicado = this.crearClaveDuplicado(data, subjectNormalizado);

      if (this.esMailDuplicado(claveDuplicado)) {
        this.logger.warn(
          `Mail duplicado bloqueado para el asunto permitido: ${subjectNormalizado}`,
        );

        return;
      }

      const frontendUrl = (
        this.configService.get<string>('FRONTEND_URL') ||
        'http://localhost:5173'
      ).replace(/\/$/, '');
      const emojiDeporte = this.obtenerEmojiDeporte(data.cancha);
      const htmlContent = this.reemplazarVariables(
        this.cargarPlantilla(plantillaHtml),
        {
          nombre: data.nombre,
          razonSocial: data.razonSocial,
          email: data.email,
          fecha: data.fecha,
          hora: data.hora,
          cancha: data.cancha,
          club: data.club,
          message: data.message,
          emojiDeporte,
          frontendUrl,
        },
      );

      await this.enviarConResend(
  data.email,
  subjectNormalizado,
  htmlContent,
);

      this.logger.log(`Mail transaccional enviado: ${subjectNormalizado}`);
    } catch (error) {
  const detalle =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : String(error);

  this.logger.error(
    `Error al enviar mail transaccional: ${detalle}`,
  );

  throw error;
}
  }

async sendNewClubRequestToAdmins(
  adminEmails: string[],
  data: {
    club: string;
    nombre: string;
    email: string;
    telefono?: string;
    ciudad?: string;
    provincia?: string;
  },
) {
  if (!adminEmails.length) {
    this.logger.warn(
      'Se registró un club pendiente pero no hay administradores activos para notificar.',
    );
    return;
  }

  const subject = 'Nueva solicitud de club - DameCancha';

  const frontendUrl = (
    this.configService.get<string>('FRONTEND_URL') ||
    'http://localhost:5173'
  ).replace(/\/$/, '');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#1f2937;">
      <div style="background:#1f4ea6;padding:24px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:26px;">
          DameCancha
        </h1>
      </div>

      <div style="padding:28px;border:1px solid #e5e7eb;">
        <h2 style="margin-top:0;color:#1f4ea6;">
          Nueva solicitud de club
        </h2>

        <p>
          Se recibió una nueva solicitud de alta de un club en DameCancha.
        </p>

        <table style="width:100%;border-collapse:collapse;margin:24px 0;">
          <tr>
            <td style="padding:8px 0;font-weight:bold;">Club:</td>
            <td style="padding:8px 0;">
              ${this.escapeHtml(data.club)}
            </td>
          </tr>

          <tr>
            <td style="padding:8px 0;font-weight:bold;">Responsable:</td>
            <td style="padding:8px 0;">
              ${this.escapeHtml(data.nombre)}
            </td>
          </tr>

          <tr>
            <td style="padding:8px 0;font-weight:bold;">Email:</td>
            <td style="padding:8px 0;">
              ${this.escapeHtml(data.email)}
            </td>
          </tr>

          <tr>
            <td style="padding:8px 0;font-weight:bold;">Teléfono:</td>
            <td style="padding:8px 0;">
              ${this.escapeHtml(data.telefono || '-')}
            </td>
          </tr>

          <tr>
            <td style="padding:8px 0;font-weight:bold;">Ciudad:</td>
            <td style="padding:8px 0;">
              ${this.escapeHtml(data.ciudad || '-')}
            </td>
          </tr>

          <tr>
            <td style="padding:8px 0;font-weight:bold;">Provincia:</td>
            <td style="padding:8px 0;">
              ${this.escapeHtml(data.provincia || '-')}
            </td>
          </tr>
        </table>

        <p>
          La solicitud quedó
          <strong>pendiente de aprobación</strong>.
        </p>

        <div style="text-align:center;margin-top:28px;">
          <a
            href="${frontendUrl}"
            style="
              display:inline-block;
              background:#1f4ea6;
              color:#ffffff;
              text-decoration:none;
              padding:12px 22px;
              border-radius:8px;
              font-weight:bold;
            "
          >
            Ir a DameCancha
          </a>
        </div>
      </div>
    </div>
  `;

  const resultados = await Promise.allSettled(
    adminEmails.map((email) =>
      this.enviarConResend(
        email,
        subject,
        html,
      ),
    ),
  );

  const fallidos = resultados.filter(
    (resultado) => resultado.status === 'rejected',
  );

  if (fallidos.length) {
    this.logger.warn(
      `No se pudieron enviar ${fallidos.length} notificaciones de solicitud de club.`,
    );
  }

  this.logger.log(
    `Solicitud de club notificada a ${adminEmails.length - fallidos.length} administrador/es.`,
  );
}


  async sendPasswordRecoveryCode(data: {
    email: string;
    nombre: string;
    codigo: string;
    minutos?: number;
  }) {
    try {
      const subject = 'Código de recuperación - DameCancha';
      const plantillaHtml = this.obtenerPlantilla(subject);

      const frontendUrl = (
        this.configService.get<string>('FRONTEND_URL') ||
        'http://localhost:5173'
      ).replace(/\/$/, '');
      const htmlContent = this.reemplazarVariables(
        this.cargarPlantilla(plantillaHtml),
        {
          nombre: data.nombre,
          email: data.email,
          codigo: data.codigo,
          minutos: data.minutos || 10,
          frontendUrl,
        },
      );

      await this.enviarConResend(
  data.email,
  subject,
  htmlContent,
);

      this.logger.log('Código de recuperación enviado.');
    } catch (error) {
      this.logger.error('Error al enviar código de recuperación.', error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }
}
