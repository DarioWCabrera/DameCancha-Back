import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RecaptchaService {
  constructor(
    private readonly configService: ConfigService,
  ) {}

  async verify(token: string): Promise<boolean> {
    if (!token) {
      return false;
    }

    const secretKey =
      this.configService.get<string>('RECAPTCHA_SECRET_KEY');

    if (!secretKey) {
      throw new InternalServerErrorException(
        'RECAPTCHA_SECRET_KEY no está configurada.',
      );
    }

    const body = new URLSearchParams();

    body.append('secret', secretKey);
    body.append('response', token);

    try {
      const response = await fetch(
        'https://www.google.com/recaptcha/api/siteverify',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/x-www-form-urlencoded',
          },
          body,
        },
      );

      if (!response.ok) {
        return false;
      }

      const result = (await response.json()) as {
        success?: boolean;
        hostname?: string;
        'error-codes'?: string[];
      };

      return result.success === true;
    } catch (error) {
      console.error(
        'Error verificando reCAPTCHA:',
        error,
      );

      return false;
    }
  }
}