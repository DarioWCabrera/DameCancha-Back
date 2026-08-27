import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Club } from '../club/entities/club.entity';
import { ResumenMensualService } from './resumen-mensual.service';

type PeriodoSimple = {
  anio: number;
  mes: number;
};

type ErrorCierreClub = {
  id_club: number;
  nombre_club: string;
  error: string;
};

@Injectable()
export class ResumenMensualCierreService {
  private readonly logger = new Logger(
    ResumenMensualCierreService.name,
  );

  constructor(
    @InjectRepository(Club)
    private readonly clubRepository: Repository<Club>,

    private readonly resumenMensualService: ResumenMensualService,
  ) {}

  private obtenerPeriodoActualArgentina(): PeriodoSimple {
    const hoy = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const [anio, mes] = hoy.split('-').map(Number);

    return {
      anio,
      mes,
    };
  }

  private obtenerPeriodoAnteriorArgentina(): PeriodoSimple {
    const actual = this.obtenerPeriodoActualArgentina();

    if (actual.mes === 1) {
      return {
        anio: actual.anio - 1,
        mes: 12,
      };
    }

    return {
      anio: actual.anio,
      mes: actual.mes - 1,
    };
  }

  private construirFinExclusivo(
    anio: number,
    mes: number,
  ): string {
    if (
      !Number.isInteger(anio) ||
      anio < 2020 ||
      anio > 2200 ||
      !Number.isInteger(mes) ||
      mes < 1 ||
      mes > 12
    ) {
      throw new BadRequestException(
        'El período indicado no es válido.',
      );
    }

    const siguiente =
      mes === 12
        ? {
            anio: anio + 1,
            mes: 1,
          }
        : {
            anio,
            mes: mes + 1,
          };

    return `${siguiente.anio}-${String(
      siguiente.mes,
    ).padStart(2, '0')}-01`;
  }

  private validarMesCerrado(
    anio: number,
    mes: number,
  ) {
    this.construirFinExclusivo(
      anio,
      mes,
    );

    const actual =
      this.obtenerPeriodoActualArgentina();

    if (
      anio > actual.anio ||
      (
        anio === actual.anio &&
        mes >= actual.mes
      )
    ) {
      throw new BadRequestException(
        'El cierre automático solo puede ejecutarse para un mes ya cerrado.',
      );
    }
  }

  private fechaAltaClubArgentina(
    club: Club,
  ): string {
    const valor = club.created_at;

    if (valor instanceof Date) {
      return new Intl.DateTimeFormat(
        'en-CA',
        {
          timeZone:
            'America/Argentina/Buenos_Aires',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        },
      ).format(valor);
    }

    const fecha = new Date(
      valor as unknown as string,
    );

    if (
      !Number.isNaN(
        fecha.getTime(),
      )
    ) {
      return new Intl.DateTimeFormat(
        'en-CA',
        {
          timeZone:
            'America/Argentina/Buenos_Aires',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        },
      ).format(fecha);
    }

    return String(valor).slice(
      0,
      10,
    );
  }

  private esViolacionUnica(
    error: unknown,
  ): boolean {
    const posible = error as {
      code?: string;
      driverError?: {
        code?: string;
      };
    };

    return (
      posible?.code === '23505' ||
      posible?.driverError?.code ===
        '23505'
    );
  }

  private mensajeError(
    error: unknown,
  ): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Error desconocido al generar el resumen mensual.';
  }

  async generarPeriodo(
    anio: number,
    mes: number,
  ) {
    this.validarMesCerrado(
      anio,
      mes,
    );

    const finExclusivo =
      this.construirFinExclusivo(
        anio,
        mes,
      );

    const clubes =
      await this.clubRepository.find({
        order: {
          id_club: 'ASC',
        },
      });

    let elegibles = 0;
    let generados = 0;
    let yaExistentes = 0;
    let omitidosAltaPosterior = 0;

    const errores: ErrorCierreClub[] =
      [];

    for (const club of clubes) {
      const fechaAlta =
        this.fechaAltaClubArgentina(
          club,
        );

      /*
        Si el club todavía no existía al terminar el período,
        ese mes no forma parte de su historia en DameCancha.
      */
      if (
        fechaAlta >=
        finExclusivo
      ) {
        omitidosAltaPosterior += 1;
        continue;
      }

      elegibles += 1;

      try {
        const resultado =
          await this.resumenMensualService
            .generarSnapshotClubSinAuth(
              Number(
                club.id_club,
              ),
              anio,
              mes,
            );

        if (
          resultado.message ===
          'El resumen mensual ya había sido generado.'
        ) {
          yaExistentes += 1;
        } else {
          generados += 1;
        }

        this.logger.log(
          `Resumen mensual ${anio}-${String(
            mes,
          ).padStart(2, '0')} procesado para club ${club.id_club} - ${club.nombre_club}.`,
        );
      } catch (error) {
        /*
          La restricción UNIQUE (club, año, mes) es la última
          defensa si dos procesos intentan cerrar el mismo mes
          al mismo tiempo.
        */
        if (
          this.esViolacionUnica(
            error,
          )
        ) {
          yaExistentes += 1;

          this.logger.log(
            `El resumen ${anio}-${String(
              mes,
            ).padStart(2, '0')} ya existía para club ${club.id_club} - ${club.nombre_club}.`,
          );

          continue;
        }

        const mensaje =
          this.mensajeError(
            error,
          );

        errores.push({
          id_club: Number(
            club.id_club,
          ),
          nombre_club:
            club.nombre_club,
          error: mensaje,
        });

        this.logger.error(
          `Error generando resumen ${anio}-${String(
            mes,
          ).padStart(2, '0')} para club ${club.id_club} - ${club.nombre_club}: ${mensaje}`,
        );
      }
    }

    return {
      periodo: {
        anio,
        mes,
      },

      total_clubes:
        clubes.length,

      clubes_elegibles:
        elegibles,

      resumenes_generados:
        generados,

      resumenes_ya_existentes:
        yaExistentes,

      clubes_omitidos_por_alta_posterior:
        omitidosAltaPosterior,

      errores,
    };
  }

  /*
    03:10 del día 1 de cada mes, hora Argentina.
    Se cierra el mes inmediatamente anterior.
  */
  @Cron('0 10 3 1 * *', {
    timeZone:
      'America/Argentina/Buenos_Aires',
  })
  async generarMesAnteriorAutomaticamente() {
    const periodo =
      this.obtenerPeriodoAnteriorArgentina();

    this.logger.log(
      `Iniciando cierre mensual automático ${periodo.anio}-${String(
        periodo.mes,
      ).padStart(2, '0')}.`,
    );

    try {
      const resultado =
        await this.generarPeriodo(
          periodo.anio,
          periodo.mes,
        );

      this.logger.log(
        `Cierre mensual automático finalizado. Generados: ${resultado.resumenes_generados}. Ya existentes: ${resultado.resumenes_ya_existentes}. Omitidos por alta posterior: ${resultado.clubes_omitidos_por_alta_posterior}. Errores: ${resultado.errores.length}.`,
      );
    } catch (error) {
      this.logger.error(
        'Falló el cierre mensual automático.',
        error instanceof Error
          ? error.stack
          : String(error),
      );
    }
  }
}