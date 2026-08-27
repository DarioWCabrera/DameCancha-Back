import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { HttpService } from '@nestjs/axios';

import { AxiosError } from 'axios';

import { firstValueFrom } from 'rxjs';

interface SendTemplateOptions {
  to: string;
  templateName: string;
  languageCode: string;
  parameters?: string[];
}

export interface WhatsAppApiResponse {
  messaging_product?: string;

  contacts?: Array<{
    input: string;
    wa_id: string;
  }>;

  messages?: Array<{
    id: string;
    message_status?: string;
  }>;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
  private readonly configService: ConfigService,
  private readonly httpService: HttpService,
) {}

  async sendTemplate(
    options: SendTemplateOptions,
  ): Promise<WhatsAppApiResponse> {
    const accessToken =
  this.configService
    .get<string>('WHATSAPP_ACCESS_TOKEN')
    ?.trim();

const phoneNumberId =
  this.configService
    .get<string>('WHATSAPP_PHONE_NUMBER_ID')
    ?.trim();

const graphVersion =
  this.configService
    .get<string>('WHATSAPP_GRAPH_VERSION')
    ?.trim();

if (
  !accessToken ||
  !phoneNumberId ||
  !graphVersion
) {
  this.logger.warn(
    'WhatsApp no está configurado en este entorno.',
  );

  throw new ServiceUnavailableException(
    'WhatsApp no está configurado en este entorno.',
  );
}
    const url =
  `https://graph.facebook.com/` +
  `${graphVersion}/` +
  `${phoneNumberId}/messages`;

    const components =
      options.parameters &&
      options.parameters.length > 0
        ? [
            {
              type: 'body',
              parameters: options.parameters.map(
                (value) => ({
                  type: 'text',
                  text: value,
                }),
              ),
            },
          ]
        : undefined;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: options.to,
      type: 'template',

      template: {
        name: options.templateName,

        language: {
          code: options.languageCode,
        },

        ...(components ? { components } : {}),
      },
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post<WhatsAppApiResponse>(
          url,
          payload,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },

            timeout: 15000,
          },
        ),
      );

      const messageId =
        response.data.messages?.[0]?.id;

      this.logger.log(
        messageId
          ? `WhatsApp aceptado por Meta. messageId=${messageId}`
          : 'WhatsApp aceptado por Meta.',
      );

      return response.data;
    } catch (error) {
      const axiosError =
        error as AxiosError<{
          error?: {
            message?: string;
            code?: number;
            error_subcode?: number;
          };
        }>;

      const metaError =
        axiosError.response?.data?.error;

      this.logger.error(
        [
          'Error enviando WhatsApp.',
          metaError?.code
            ? `code=${metaError.code}`
            : null,
          metaError?.error_subcode
            ? `subcode=${metaError.error_subcode}`
            : null,
          metaError?.message
            ? `message=${metaError.message}`
            : axiosError.message,
        ]
          .filter(Boolean)
          .join(' '),
      );

      throw new ServiceUnavailableException(
        'No fue posible enviar el mensaje de WhatsApp.',
      );
    }
  }
}