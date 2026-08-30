import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import {
  DataSource,
  Repository,
} from 'typeorm';

import { Reserva } from './entities/reserva.entity';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

@Injectable()
export class ReservaRecordatorioWhatsappService {
  private readonly logger = new Logger(
    ReservaRecordatorioWhatsappService.name,
  );

  /*
    Evita que dos ejecuciones del cron se superpongan
    dentro de la misma instancia de Railway.
  */
  private ejecutando = false;

  private readonly HORAS_ANTICIPACION = 3;

  constructor(
    @InjectRepository(Reserva)
    private readonly reservaRepository: Repository<Reserva>,

    private readonly dataSource: DataSource,

    private readonly configService: ConfigService,

    private readonly whatsappService: WhatsAppService,
  ) {}

  /*
    Devuelve YYYY-MM-DD usando horario argentino.
  */
  private fechaArgentina(
    fecha: Date,
  ): string {
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

  private normalizarFecha(
    fecha: string | Date,
  ): string {
    if (typeof fecha === 'string') {
      return fecha.slice(0, 10);
    }

    return this.fechaArgentina(fecha);
  }

  private normalizarHora(
    hora: string,
  ): string {
    const partes =
      String(hora || '').split(':');

    const horas = String(
      Number(partes[0] || 0),
    ).padStart(2, '0');

    const minutos = String(
      Number(partes[1] || 0),
    ).padStart(2, '0');

    const segundos = String(
      Number(partes[2] || 0),
    ).padStart(2, '0');

    return `${horas}:${minutos}:${segundos}`;
  }

  /*
    Construye el instante real de inicio de la reserva.

    DameCancha actualmente utiliza -03:00 para Argentina.
    Conservamos APP_TIMEZONE_OFFSET para mantener el mismo
    criterio que ya usa ReservaService.
  */
  private obtenerInicioReserva(
    reserva: Pick<
      Reserva,
      'fecha' | 'hora_inicio'
    >,
  ): Date {
    const offset =
      this.configService.get<string>(
        'APP_TIMEZONE_OFFSET',
      ) || '-03:00';

    const fecha =
      this.normalizarFecha(
        reserva.fecha,
      );

    const hora =
      this.normalizarHora(
        reserva.hora_inicio,
      );

    return new Date(
      `${fecha}T${hora}${offset}`,
    );
  }

  /*
    El recordatorio entra en cola cuando faltan
    como máximo 3 horas para el turno.

    Si Railway estuvo reiniciándose y vuelve cuando
    faltan, por ejemplo, 2h40, igualmente se envía.
  */
  private estaDentroDeVentana(
    reserva: Pick<
      Reserva,
      'fecha' | 'hora_inicio'
    >,
  ): boolean {
    const inicio =
      this.obtenerInicioReserva(reserva);

    if (
      Number.isNaN(inicio.getTime())
    ) {
      return false;
    }

    const ahora = Date.now();

    const limite =
      ahora +
      this.HORAS_ANTICIPACION *
        60 *
        60 *
        1000;

    return (
      inicio.getTime() > ahora &&
      inicio.getTime() <= limite
    );
  }

  /*
    Convierte teléfonos argentinos al formato
    internacional requerido por WhatsApp.

    Ejemplo:
    2983340902
      ->
    5492983340902
  */
  private normalizarTelefonoWhatsApp(
    telefono: string | null | undefined,
  ): string | null {
    let digitos = String(
      telefono || '',
    ).replace(/\D/g, '');

    if (!digitos) {
      return null;
    }

    if (digitos.startsWith('00')) {
      digitos = digitos.slice(2);
    }

    /*
      Ya viene como Argentina móvil:
      54 + 9 + número.
    */
    if (digitos.startsWith('549')) {
      return digitos;
    }

    /*
      Viene con 54 pero sin el 9 móvil.
    */
    if (digitos.startsWith('54')) {
      return `549${digitos.slice(2)}`;
    }

    /*
      Formato nacional con 0 inicial.
    */
    if (digitos.startsWith('0')) {
      digitos = digitos.slice(1);
    }

    return `549${digitos}`;
  }

  private nombreCliente(
    reserva: Reserva,
  ): string {
    const nombreUsuario =
      reserva.usuario
        ?.nombre_usuario
        ?.trim();

    if (nombreUsuario) {
      return nombreUsuario;
    }

    const nombreManual =
      reserva.nombre_cliente_manual
        ?.trim();

    if (nombreManual) {
      return nombreManual
        .split(/\s+/)[0];
    }

    return 'Usuario';
  }

  private telefonoCliente(
    reserva: Reserva,
  ): string | null {
    return this.normalizarTelefonoWhatsApp(
      reserva.usuario
        ?.telefono_usuario ||
        reserva.telefono_cliente_manual,
    );
  }

  private formatearFechaMensaje(
    fecha: string | Date,
  ): string {
    const normalizada =
      this.normalizarFecha(fecha);

    const [anio, mes, dia] =
      normalizada.split('-');

    if (!anio || !mes || !dia) {
      return normalizada;
    }

    return `${dia}/${mes}/${anio}`;
  }

  private formatearHorario(
    reserva: Reserva,
  ): string {
    const inicio =
      String(
        reserva.hora_inicio || '',
      ).slice(0, 5);

    const fin =
      String(
        reserva.hora_fin || '',
      ).slice(0, 5);

    return `${inicio} a ${fin}`;
  }

  /*
    Procesa UNA reserva de manera protegida.

    La fila se bloquea antes de enviar para evitar que
    dos ejecuciones simultáneas manden el mismo recordatorio.
  */
  private async procesarReserva(
    idReserva: number,
  ): Promise<boolean> {
    return this.dataSource.transaction(
      async (manager) => {
        const repo =
          manager.getRepository(Reserva);

        /*
          Primero bloqueamos solamente la fila Reserva.
          Después cargamos sus relaciones dentro de
          la misma transacción.
        */
        const bloqueada =
          await repo
            .createQueryBuilder(
              'reserva',
            )
            .where(
              'reserva.id_reserva = :idReserva',
              { idReserva },
            )
            .setLock(
              'pessimistic_write',
            )
            .getOne();

        if (!bloqueada) {
          return false;
        }

        /*
          Revalidamos todo DESPUÉS de obtener el lock.
        */
        if (
          bloqueada.estado !==
            'confirmada' ||
          bloqueada
            .recordatorio_whatsapp_enviado_at
        ) {
          return false;
        }

        if (
          !this.estaDentroDeVentana(
            bloqueada,
          )
        ) {
          return false;
        }

        const reserva =
          await repo.findOne({
            where: {
              id_reserva: idReserva,
            },
            relations: [
              'usuario',
              'cancha',
              'cancha.id_club',
            ],
          });

        if (!reserva) {
          return false;
        }

        const telefono =
          this.telefonoCliente(reserva);

        if (!telefono) {
          this.logger.warn(
            `Reserva ${idReserva}: el cliente no tiene teléfono para enviar el recordatorio.`,
          );

          return false;
        }

        const club =
          reserva.cancha
            ?.id_club
            ?.nombre_club;

        const cancha =
          reserva.cancha
            ?.nombre_cancha;

        if (!club || !cancha) {
          this.logger.warn(
            `Reserva ${idReserva}: faltan datos del club o de la cancha.`,
          );

          return false;
        }

        const resultado =
          await this.whatsappService.sendTemplate(
            {
              to: telefono,

              templateName:
                'recordatorio_reserva_v2',

              languageCode:
                'es_AR',

              parameters: [
                this.nombreCliente(
                  reserva,
                ),

                club,

                this.formatearFechaMensaje(
                  reserva.fecha,
                ),

                this.formatearHorario(
                  reserva,
                ),

                cancha,
              ],
            },
          );

        const messageId =
          resultado.messages?.[0]?.id;

        if (!messageId) {
          throw new Error(
            `Meta no devolvió messageId para la reserva ${idReserva}.`,
          );
        }

        /*
          Solo marcamos como enviado después de que
          Meta aceptó correctamente el mensaje.
        */
        bloqueada.recordatorio_whatsapp_enviado_at =
          new Date();

        bloqueada.recordatorio_whatsapp_message_id =
          messageId;

        await repo.save(bloqueada);

        this.logger.log(
          `Recordatorio WhatsApp enviado. reserva=${idReserva} messageId=${messageId}`,
        );

        return true;
      },
    );
  }

  /*
    Corre cada 10 minutos.

    No buscamos todas las reservas históricas:
    solamente las fechas que pueden caer dentro
    de las próximas 3 horas.
  */
  @Cron('0 */10 * * * *', {
    timeZone:
      'America/Argentina/Buenos_Aires',
  })
  async enviarRecordatoriosPendientes() {
    if (this.ejecutando) {
      this.logger.warn(
        'La ejecución anterior de recordatorios todavía está activa.',
      );

      return;
    }

    this.ejecutando = true;

    try {
      const ahora = new Date();

      const limite = new Date(
        ahora.getTime() +
          this.HORAS_ANTICIPACION *
            60 *
            60 *
            1000,
      );

      const fechas = Array.from(
        new Set([
          this.fechaArgentina(ahora),
          this.fechaArgentina(limite),
        ]),
      );

      const candidatas =
        await this.reservaRepository
          .createQueryBuilder(
            'reserva',
          )
          .where(
            'reserva.estado = :estado',
            {
              estado: 'confirmada',
            },
          )
          .andWhere(
            'reserva.recordatorio_whatsapp_enviado_at IS NULL',
          )
          .andWhere(
            'reserva.fecha IN (:...fechas)',
            { fechas },
          )
          .orderBy(
            'reserva.fecha',
            'ASC',
          )
          .addOrderBy(
            'reserva.hora_inicio',
            'ASC',
          )
          .getMany();

      let enviados = 0;

      for (const reserva of candidatas) {
        if (
          !this.estaDentroDeVentana(
            reserva,
          )
        ) {
          continue;
        }

        try {
          const enviado =
            await this.procesarReserva(
              reserva.id_reserva,
            );

          if (enviado) {
            enviados += 1;
          }
        } catch (error) {
          this.logger.error(
            `Falló el recordatorio de la reserva ${reserva.id_reserva}.`,
            error instanceof Error
              ? error.stack
              : String(error),
          );

          /*
            IMPORTANTE:
            si falla Meta NO marcamos el recordatorio
            como enviado. La próxima ejecución podrá
            volver a intentarlo.
          */
        }
      }

      if (enviados > 0) {
        this.logger.log(
          `Proceso de recordatorios finalizado. Enviados: ${enviados}.`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Falló el proceso automático de recordatorios de WhatsApp.',
        error instanceof Error
          ? error.stack
          : String(error),
      );
    } finally {
      this.ejecutando = false;
    }
  }
}