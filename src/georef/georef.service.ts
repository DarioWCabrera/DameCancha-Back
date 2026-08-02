import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class GeorefService {
  private readonly logger = new Logger(GeorefService.name);

  constructor(private readonly http: HttpService) {}

  private readonly baseUrl = 'https://apis.datos.gob.ar/georef/api';

  private normalizarProvincia(provincia: string): string {
    const valor = String(provincia || '').trim();
    if (!valor || valor.length > 100 || !/^[\p{L}\d .'-]+$/u.test(valor)) {
      throw new BadRequestException('La provincia indicada no es válida.');
    }
    return valor;
  }

  async getProvincias() {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.baseUrl}/provincias`, {
          params: {
            campos: 'id,nombre',
            max: 24,
          },
          timeout: 10000,
        }),
      );

      return {
        provincias: data.provincias || [],
      };
    } catch (error: any) {
      this.logger.error('Falló la consulta de provincias a la API Georef.');

      throw new InternalServerErrorException(
        'No se pudieron obtener las provincias.',
      );
    }
  }

  async getMunicipios(provincia: string) {
    const provinciaNormalizada = this.normalizarProvincia(provincia);

    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.baseUrl}/municipios`, {
          params: {
            provincia: provinciaNormalizada,
            campos: 'id,nombre',
            max: 500,
          },
          timeout: 10000,
        }),
      );

      return {
        municipios: data.municipios || [],
      };
    } catch (error: any) {
      this.logger.error('Falló la consulta de municipios a la API Georef.');

      throw new InternalServerErrorException(
        'No se pudieron obtener los municipios.',
      );
    }
  }

  async getLocalidades(provincia: string) {
    const provinciaNormalizada = this.normalizarProvincia(provincia);

    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.baseUrl}/localidades`, {
          params: {
            provincia: provinciaNormalizada,
            campos: 'id,nombre',
            max: 5000,
          },
          timeout: 10000,
        }),
      );

      return {
        localidades: data.localidades || [],
      };
    } catch (error: any) {
      this.logger.error('Falló la consulta de localidades a la API Georef.');

      throw new InternalServerErrorException(
        'No se pudieron obtener las localidades.',
      );
    }
  }
}