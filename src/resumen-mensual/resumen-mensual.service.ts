import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { Club } from '../club/entities/club.entity';

import {
  ResumenMensualClub,
  ResumenMensualDestacados,
  ResumenMensualIngresosManuales,
} from './entities/resumen-mensual-club.entity';

type Periodo = {
  anio: number;
  mes: number;
  inicio: string;
  finExclusivo: string;
};

type CanchaBase = {
  id_cancha: number | string;
  nombre_cancha: string;
  id_deporte: number | string | null;
  nombre_deporte: string | null;
};

type DisponibilidadBase = {
  id_cancha: number | string;
  dia_semana: number | string;
  hora_inicio: string;
  hora_fin: string;
};

type ReservaBase = {
  id_reserva: number | string;
  fecha: string | Date;
  hora_inicio: string;
  hora_fin: string;
  monto_total: string | number;
  monto_pagado: string | number | null;
  estado: string;
  id_usuario: number | string;
  id_cancha: number | string;
  nombre_cancha: string;
  id_deporte: number | string | null;
  nombre_deporte: string | null;
};

type BloqueoBase = {
  id_bloqueo: number | string;
  id_cancha: number | string;
  fecha: string | Date;
  hora_inicio: string;
  hora_fin: string;
  tipo: string;
};

type TurnoFijoBase = {
  id_turno_fijo: number | string;
  id_cancha: number | string;
  dia_semana: number | string;
  hora_inicio: string;
  hora_fin: string | null;
  fecha_inicio: string | Date | null;
  fecha_fin: string | Date | null;
  estado: string;
};

type IngresoManualBase = {
  categoria: keyof ResumenMensualIngresosManuales;
  monto: string | number;
};

type SlotMes = {
  fecha: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
};

@Injectable()
export class ResumenMensualService {
  private readonly nombresDias = [
    'Domingo',
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
  ];

  constructor(
    @InjectRepository(ResumenMensualClub)
    private readonly resumenRepository: Repository<ResumenMensualClub>,

    @InjectRepository(Club)
    private readonly clubRepository: Repository<Club>,

    private readonly dataSource: DataSource,
  ) {}

  private serializarResumen(
    resumen: ResumenMensualClub,
  ) {
    return {
      id_resumen_mensual: resumen.id_resumen_mensual,

      club: {
        id_club: resumen.club.id_club,
        nombre_club: resumen.club.nombre_club,
      },

      anio: resumen.anio,
      mes: resumen.mes,
      periodo_inicio: resumen.periodo_inicio,
      periodo_fin_exclusivo: resumen.periodo_fin_exclusivo,

      total_reservas: resumen.total_reservas,
      reservas_pendientes: resumen.reservas_pendientes,
      reservas_confirmadas: resumen.reservas_confirmadas,
      reservas_completadas: resumen.reservas_completadas,
      reservas_canceladas: resumen.reservas_canceladas,
      usuarios_unicos: resumen.usuarios_unicos,

      monto_reservas_validas: Number(
        resumen.monto_reservas_validas,
      ),
      monto_reservas_completadas: Number(
        resumen.monto_reservas_completadas,
      ),
      monto_pagado_registrado: Number(
        resumen.monto_pagado_registrado,
      ),

      ingresos_manuales_total: Number(
        resumen.ingresos_manuales_total,
      ),
      detalle_ingresos_manuales:
        resumen.detalle_ingresos_manuales,
      total_consolidado_informado: Number(
        resumen.total_consolidado_informado,
      ),

      turnos_fijos_vigentes:
        resumen.turnos_fijos_vigentes,
      ocurrencias_turnos_fijos_mes:
        resumen.ocurrencias_turnos_fijos_mes,

      detalle_canchas: resumen.detalle_canchas,
      detalle_deportes: resumen.detalle_deportes,
      detalle_dias: resumen.detalle_dias,
      detalle_horas: resumen.detalle_horas,
      destacados: resumen.destacados,

      version_esquema: resumen.version_esquema,
      generado_at: resumen.generado_at,
    };
  }

  private obtenerHoyArgentina(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  private obtenerFechaAltaClubArgentina(
    club: Club,
  ): string {
    const fechaAlta = new Date(club.created_at);

    if (Number.isNaN(fechaAlta.getTime())) {
      throw new BadRequestException(
        'No se pudo determinar la fecha de alta del club.',
      );
    }

    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(fechaAlta);
  }

  private validarPeriodoDesdeAltaClub(
    club: Club,
    periodo: Periodo,
  ): string {
    const fechaAltaClub =
      this.obtenerFechaAltaClubArgentina(club);

    /*
      Si el club se dio de alta después de que terminó el período,
      ese mes no pertenece a su historial dentro de DameCancha.
    */
    if (fechaAltaClub >= periodo.finExclusivo) {
      throw new BadRequestException(
        'No se puede generar ni consultar un resumen de un período anterior al alta del club en DameCancha.',
      );
    }

    return fechaAltaClub;
  }

  private obtenerInicioOcupacion(
    club: Club,
    periodo: Periodo,
  ): string {
    const fechaAltaClub =
      this.validarPeriodoDesdeAltaClub(
        club,
        periodo,
      );

    /*
      En el primer mes del club no contamos como "disponibles"
      días anteriores a su incorporación a DameCancha.
    */
    return fechaAltaClub > periodo.inicio
      ? fechaAltaClub
      : periodo.inicio;
  }

  private periodoActual(): Periodo {
    const hoy = this.obtenerHoyArgentina();
    const [anio, mes] = hoy.split('-').map(Number);

    return this.construirPeriodo(anio, mes);
  }

  private construirPeriodo(
    anioValor: string | number,
    mesValor: string | number,
  ): Periodo {
    const anio = Number(anioValor);
    const mes = Number(mesValor);

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
        ? { anio: anio + 1, mes: 1 }
        : { anio, mes: mes + 1 };

    return {
      anio,
      mes,
      inicio: `${anio}-${String(mes).padStart(2, '0')}-01`,
      finExclusivo:
        `${siguiente.anio}-${String(
          siguiente.mes,
        ).padStart(2, '0')}-01`,
    };
  }

  private periodoDesdeOpcionales(
    anio?: string | number,
    mes?: string | number,
  ): Periodo {
    const actual = this.periodoActual();

    return this.construirPeriodo(
      anio === undefined || anio === ''
        ? actual.anio
        : anio,
      mes === undefined || mes === ''
        ? actual.mes
        : mes,
    );
  }

  private fechaComoISO(
    valor: string | Date | null,
  ): string | null {
    if (valor === null || valor === undefined) {
      return null;
    }

    if (valor instanceof Date) {
      return valor.toISOString().slice(0, 10);
    }

    return String(valor).slice(0, 10);
  }

  private obtenerDiaSemana(fecha: string): number {
    const [anio, mes, dia] =
      fecha.split('-').map(Number);

    return new Date(
      Date.UTC(anio, mes - 1, dia),
    ).getUTCDay();
  }

  private listarFechasPeriodo(
    periodo: Periodo,
  ): string[] {
    const fechas: string[] = [];

    const [anioInicio, mesInicio, diaInicio] =
      periodo.inicio.split('-').map(Number);

    const [anioFin, mesFin, diaFin] =
      periodo.finExclusivo.split('-').map(Number);

    const cursor = new Date(
      Date.UTC(
        anioInicio,
        mesInicio - 1,
        diaInicio,
      ),
    );

    const fin = new Date(
      Date.UTC(
        anioFin,
        mesFin - 1,
        diaFin,
      ),
    );

    while (cursor < fin) {
      fechas.push(
        cursor.toISOString().slice(0, 10),
      );

      cursor.setUTCDate(
        cursor.getUTCDate() + 1,
      );
    }

    return fechas;
  }

  private normalizarHora(valor: string): string {
    const limpia =
      String(valor || '').trim();

    if (/^24:00(?::00)?$/.test(limpia)) {
      return '24:00';
    }

    const [hora = '0', minuto = '0'] =
      limpia.split(':');

    return `${String(Number(hora)).padStart(
      2,
      '0',
    )}:${String(Number(minuto)).padStart(
      2,
      '0',
    )}`;
  }

  private sumarMinutos(
    horaInicio: string,
    cantidad: number,
  ): string {
    const [hora, minuto] =
      horaInicio.split(':').map(Number);

    const total =
      hora * 60 + minuto + cantidad;

    if (total === 24 * 60) {
      return '24:00';
    }

    return `${String(
      Math.floor(total / 60),
    ).padStart(2, '0')}:${String(
      total % 60,
    ).padStart(2, '0')}`;
  }

  private horaAMinutos(hora: string): number {
    const normalizada =
      this.normalizarHora(hora);

    if (normalizada === '24:00') {
      return 24 * 60;
    }

    const [h, m] =
      normalizada.split(':').map(Number);

    return h * 60 + m;
  }

  private seSuperponen(
    inicioA: string,
    finA: string,
    inicioB: string,
    finB: string,
  ): boolean {
    const aInicio =
      this.horaAMinutos(inicioA);
    const aFin =
      this.horaAMinutos(finA);
    const bInicio =
      this.horaAMinutos(inicioB);
    const bFin =
      this.horaAMinutos(finB);

    return (
      aInicio < bFin &&
      aFin > bInicio
    );
  }

  private async obtenerClubAdministrable(
    idClub: number,
    usuario: AuthenticatedUser,
  ): Promise<Club> {
    const id = Number(idClub);

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      throw new BadRequestException(
        'El club indicado no es válido.',
      );
    }

    const club =
      await this.clubRepository.findOne({
        where: {
          id_club: id,
        },
        relations: ['dueno'],
      });

    if (!club) {
      throw new NotFoundException(
        'El club indicado no existe.',
      );
    }

    if (usuario.tipo !== 'admin') {
      const esResponsable =
        usuario.tipo === 'dueno' ||
        usuario.tipo === 'club';

      if (!esResponsable) {
        throw new ForbiddenException(
          'Solo el responsable del club puede consultar sus resúmenes.',
        );
      }

      if (
        Number(
          club.dueno?.id_usuario,
        ) !== Number(usuario.sub)
      ) {
        throw new ForbiddenException(
          'No tenés permiso para consultar este club.',
        );
      }
    }

    return club;
  }

  private crearSlotsCancha(
    cancha: CanchaBase,
    fechas: string[],
    disponibilidades: DisponibilidadBase[],
  ): SlotMes[] {
    const idCancha =
      Number(cancha.id_cancha);

    const configuradas =
      disponibilidades
        .filter(
          (item) =>
            Number(item.id_cancha) ===
            idCancha,
        )
        .map((item) => ({
          dia_semana:
            Number(item.dia_semana),
          hora_inicio:
            this.normalizarHora(
              item.hora_inicio,
            ),
          hora_fin:
            this.normalizarHora(
              item.hora_fin,
            ),
        }));

    const slots: SlotMes[] = [];

    for (const fecha of fechas) {
      const diaSemana =
        this.obtenerDiaSemana(fecha);

      /*
        Sin configuración propia conservamos la regla histórica
        de DameCancha: todos los días, inicios de 09:00 a 22:00,
        turnos de 60 minutos.
      */
      if (configuradas.length === 0) {
        for (
          let hora = 9;
          hora <= 22;
          hora += 1
        ) {
          const inicio =
            `${String(hora).padStart(
              2,
              '0',
            )}:00`;

          slots.push({
            fecha,
            dia_semana: diaSemana,
            hora_inicio: inicio,
            hora_fin:
              this.sumarMinutos(
                inicio,
                60,
              ),
          });
        }

        continue;
      }

      for (const item of configuradas) {
        if (
          item.dia_semana !== diaSemana
        ) {
          continue;
        }

        slots.push({
          fecha,
          dia_semana: diaSemana,
          hora_inicio:
            item.hora_inicio,
          hora_fin:
            item.hora_fin,
        });
      }
    }

    return slots;
  }

  private turnoFijoVigenteEnFecha(
    turno: TurnoFijoBase,
    fecha: string,
    diaSemana: number,
  ): boolean {
    if (
      !['activo', 'cancelado'].includes(
        turno.estado,
      ) ||
      !turno.hora_fin ||
      Number(turno.dia_semana) !==
        diaSemana
    ) {
      return false;
    }

    const inicio =
      this.fechaComoISO(
        turno.fecha_inicio,
      );

    const fin =
      this.fechaComoISO(
        turno.fecha_fin,
      );

    if (
      turno.estado === 'cancelado' &&
      !fin
    ) {
      return false;
    }

    if (
      !inicio ||
      fecha < inicio
    ) {
      return false;
    }

    if (
      fin &&
      fecha > fin
    ) {
      return false;
    }

    return true;
  }

  private async calcular(
    club: Club,
    periodo: Periodo,
  ) {
    const idClub =
      Number(club.id_club);

    const inicioOcupacion =
      this.obtenerInicioOcupacion(
        club,
        periodo,
      );

    const fechas =
      this.listarFechasPeriodo({
        ...periodo,
        inicio: inicioOcupacion,
      });

    const canchas: CanchaBase[] =
      await this.dataSource.query(
        `
          SELECT
            c.id_cancha,
            c.nombre_cancha,
            d.id_deporte,
            d.nombre_deporte
          FROM cancha c
          LEFT JOIN deporte d
            ON d.id_deporte = c.id_deporte
          WHERE c.id_club = $1
          ORDER BY c.id_cancha ASC
        `,
        [idClub],
      );

    const disponibilidades:
      DisponibilidadBase[] =
      canchas.length === 0
        ? []
        : await this.dataSource.query(
            `
              SELECT
                d.id_cancha,
                d.dia_semana,
                d.hora_inicio,
                d.hora_fin
              FROM disponibilidad d
              INNER JOIN cancha c
                ON c.id_cancha = d.id_cancha
              WHERE c.id_club = $1
              ORDER BY
                d.id_cancha,
                d.dia_semana,
                d.hora_inicio
            `,
            [idClub],
          );

    const reservas: ReservaBase[] =
      await this.dataSource.query(
        `
          SELECT
            r.id_reserva,
            r.fecha,
            r.hora_inicio,
            r.hora_fin,
            r.monto_total,
            r.monto_pagado,
            r.estado,
            r.id_usuario,
            c.id_cancha,
            c.nombre_cancha,
            d.id_deporte,
            d.nombre_deporte
          FROM reserva r
          INNER JOIN cancha c
            ON c.id_cancha = r.id_cancha
          LEFT JOIN deporte d
            ON d.id_deporte = c.id_deporte
          WHERE c.id_club = $1
            AND r.fecha >= $2
            AND r.fecha < $3
          ORDER BY
            r.fecha,
            r.hora_inicio
        `,
        [
          idClub,
          periodo.inicio,
          periodo.finExclusivo,
        ],
      );

    const bloqueos: BloqueoBase[] =
      await this.dataSource.query(
        `
          SELECT
            b.id_bloqueo,
            b.id_cancha,
            b.fecha,
            b.hora_inicio,
            b.hora_fin,
            b.tipo
          FROM bloqueo_cancha b
          INNER JOIN cancha c
            ON c.id_cancha = b.id_cancha
          WHERE c.id_club = $1
            AND b.activo = 1
            AND b.fecha >= $2
            AND b.fecha < $3
          ORDER BY
            b.fecha,
            b.hora_inicio
        `,
        [
          idClub,
          periodo.inicio,
          periodo.finExclusivo,
        ],
      );

    const turnosFijos: TurnoFijoBase[] =
      await this.dataSource.query(
        `
          SELECT
            t.id_turno_fijo,
            t.id_cancha,
            t.dia_semana,
            t.hora_inicio,
            t.hora_fin,
            t.fecha_inicio,
            t.fecha_fin,
            t.estado
          FROM turno_fijo t
          WHERE t.id_club = $1
            AND t.id_cancha IS NOT NULL
            AND t.hora_fin IS NOT NULL
            AND (
              t.estado = 'activo'
              OR (
                t.estado = 'cancelado'
                AND t.fecha_fin IS NOT NULL
              )
            )
            AND t.fecha_inicio IS NOT NULL
            AND t.fecha_inicio < $3
            AND (
              t.fecha_fin IS NULL
              OR t.fecha_fin >= $2
            )
          ORDER BY t.id_turno_fijo
        `,
        [
          idClub,
          periodo.inicio,
          periodo.finExclusivo,
        ],
      );

    const ingresos:
      IngresoManualBase[] =
      await this.dataSource.query(
        `
          SELECT
            categoria,
            monto
          FROM ingreso_manual_club
          WHERE id_club = $1
            AND fecha >= $2
            AND fecha < $3
          ORDER BY
            fecha,
            id_ingreso_manual
        `,
        [
          idClub,
          periodo.inicio,
          periodo.finExclusivo,
        ],
      );

    const totalReservas =
      reservas.length;

    const reservasPendientes =
      reservas.filter(
        (r) =>
          r.estado === 'pendiente',
      ).length;

    const reservasConfirmadas =
      reservas.filter(
        (r) =>
          r.estado === 'confirmada',
      ).length;

    const reservasCompletadas =
      reservas.filter(
        (r) =>
          r.estado === 'completada',
      ).length;

    const reservasCanceladas =
      reservas.filter(
        (r) =>
          r.estado === 'cancelada',
      ).length;

    const reservasValidas =
      reservas.filter(
        (r) =>
          r.estado !== 'cancelada',
      );

    const usuariosUnicos =
      new Set(
        reservasValidas.map(
          (r) =>
            Number(r.id_usuario),
        ),
      ).size;

    const montoReservasValidas =
      reservasValidas.reduce(
        (acc, r) =>
          acc +
          Number(
            r.monto_total || 0,
          ),
        0,
      );

    const montoReservasCompletadas =
      reservas
        .filter(
          (r) =>
            r.estado === 'completada',
        )
        .reduce(
          (acc, r) =>
            acc +
            Number(
              r.monto_total || 0,
            ),
          0,
        );

    const montoPagadoRegistrado =
      reservas
        .filter(
          (r) =>
            r.estado !== 'cancelada' &&
            r.monto_pagado !== null &&
            r.monto_pagado !==
              undefined,
        )
        .reduce(
          (acc, r) =>
            acc +
            Number(
              r.monto_pagado || 0,
            ),
          0,
        );

    const detalleIngresos:
      ResumenMensualIngresosManuales =
      {
        buffet: 0,
        alquiler_equipamiento: 0,
        evento: 0,
        clase: 0,
        sponsor: 0,
        otro: 0,
      };

    for (const ingreso of ingresos) {
      if (
        Object.prototype
          .hasOwnProperty.call(
            detalleIngresos,
            ingreso.categoria,
          )
      ) {
        detalleIngresos[
          ingreso.categoria
        ] += Number(
          ingreso.monto || 0,
        );
      }
    }

    const ingresosManualesTotal =
      Object.values(
        detalleIngresos,
      ).reduce(
        (acc, monto) =>
          acc + monto,
        0,
      );

    const detalleCanchas =
      canchas.map((cancha) => {
        const idCancha =
          Number(
            cancha.id_cancha,
          );

        const reservasCancha =
          reservas.filter(
            (r) =>
              Number(
                r.id_cancha,
              ) === idCancha,
          );

        const reservasValidasCancha =
          reservasCancha.filter(
            (r) =>
              r.estado !==
              'cancelada',
          );

        const slots =
          this.crearSlotsCancha(
            cancha,
            fechas,
            disponibilidades,
          );

        const bloqueosCancha =
          bloqueos.filter(
            (b) =>
              Number(
                b.id_cancha,
              ) === idCancha,
          );

        const turnosCancha =
          turnosFijos.filter(
            (t) =>
              Number(
                t.id_cancha,
              ) === idCancha,
          );

        let turnosOfrecidos = 0;
        let turnosOcupados = 0;

        for (const slot of slots) {
          const bloqueado =
            bloqueosCancha.some(
              (bloqueo) =>
                this.fechaComoISO(
                  bloqueo.fecha,
                ) ===
                  slot.fecha &&
                this.seSuperponen(
                  slot.hora_inicio,
                  slot.hora_fin,
                  bloqueo.hora_inicio,
                  bloqueo.hora_fin,
                ),
            );

          /*
            Un bloqueo se excluye del denominador de ocupación.
            Puede ser mantenimiento, cierre, evento, torneo, etc.;
            no lo interpretamos automáticamente como demanda comercial.
          */
          if (bloqueado) {
            continue;
          }

          turnosOfrecidos += 1;

          const reserva =
            reservasValidasCancha.some(
              (r) =>
                this.fechaComoISO(
                  r.fecha,
                ) ===
                  slot.fecha &&
                this.seSuperponen(
                  slot.hora_inicio,
                  slot.hora_fin,
                  r.hora_inicio,
                  r.hora_fin,
                ),
            );

          const turnoFijo =
            turnosCancha.some(
              (turno) =>
                this.turnoFijoVigenteEnFecha(
                  turno,
                  slot.fecha,
                  slot.dia_semana,
                ) &&
                this.seSuperponen(
                  slot.hora_inicio,
                  slot.hora_fin,
                  turno.hora_inicio,
                  turno.hora_fin ||
                    '',
                ),
            );

          if (
            reserva ||
            turnoFijo
          ) {
            turnosOcupados += 1;
          }
        }

        const ocupacion =
          turnosOfrecidos > 0
            ? Number(
                (
                  (
                    turnosOcupados /
                    turnosOfrecidos
                  ) *
                  100
                ).toFixed(2),
              )
            : null;

        return {
          id_cancha: idCancha,
          nombre_cancha:
            cancha.nombre_cancha,
          id_deporte:
            cancha.id_deporte ===
            null
              ? null
              : Number(
                  cancha.id_deporte,
                ),
          nombre_deporte:
            cancha.nombre_deporte,

          reservas_total:
            reservasCancha.length,

          reservas_completadas:
            reservasCancha.filter(
              (r) =>
                r.estado ===
                'completada',
            ).length,

          reservas_canceladas:
            reservasCancha.filter(
              (r) =>
                r.estado ===
                'cancelada',
            ).length,

          monto_reservas_validas:
            reservasValidasCancha.reduce(
              (acc, r) =>
                acc +
                Number(
                  r.monto_total ||
                    0,
                ),
              0,
            ),

          turnos_disponibles:
            turnosOfrecidos,

          turnos_ocupados:
            turnosOcupados,

          ocupacion_porcentaje:
            ocupacion,
        };
      });

    const deportes =
      new Map<
        number,
        {
          id_deporte: number;
          nombre_deporte: string;
          reservas_total: number;
          reservas_completadas: number;
          reservas_canceladas: number;
          monto_reservas_validas: number;
        }
      >();

    for (const reserva of reservas) {
      if (
        reserva.id_deporte === null
      ) {
        continue;
      }

      const idDeporte =
        Number(
          reserva.id_deporte,
        );

      const actual =
        deportes.get(idDeporte) ||
        {
          id_deporte: idDeporte,

          nombre_deporte:
            reserva.nombre_deporte ||
            'Sin nombre',

          reservas_total: 0,

          reservas_completadas: 0,

          reservas_canceladas: 0,

          monto_reservas_validas: 0,
        };

      actual.reservas_total += 1;

      if (
        reserva.estado ===
        'completada'
      ) {
        actual.reservas_completadas +=
          1;
      }

      if (
        reserva.estado ===
        'cancelada'
      ) {
        actual.reservas_canceladas +=
          1;
      } else {
        actual.monto_reservas_validas +=
          Number(
            reserva.monto_total || 0,
          );
      }

      deportes.set(
        idDeporte,
        actual,
      );
    }

    const detalleDeportes =
      Array.from(
        deportes.values(),
      ).sort(
        (a, b) =>
          b.reservas_total -
            a.reservas_total ||
          a.nombre_deporte.localeCompare(
            b.nombre_deporte,
          ),
      );

    const diasMap =
      new Map<
        number,
        number
      >();

    for (
      const reserva of
      reservasValidas
    ) {
      const fecha =
        this.fechaComoISO(
          reserva.fecha,
        );

      if (!fecha) {
        continue;
      }

      const dia =
        this.obtenerDiaSemana(
          fecha,
        );

      diasMap.set(
        dia,
        (diasMap.get(dia) || 0) +
          1,
      );
    }

    const detalleDias =
      Array.from(
        diasMap.entries(),
      )
        .map(
          ([dia, cantidad]) => ({
            dia_semana: dia,
            nombre_dia:
              this.nombresDias[
                dia
              ],
            reservas_total:
              cantidad,
          }),
        )
        .sort(
          (a, b) =>
            a.dia_semana -
            b.dia_semana,
        );

    const horasMap =
      new Map<
        string,
        number
      >();

    for (
      const reserva of
      reservasValidas
    ) {
      const hora =
        this.normalizarHora(
          reserva.hora_inicio,
        );

      horasMap.set(
        hora,
        (horasMap.get(hora) ||
          0) + 1,
      );
    }

    const detalleHoras =
      Array.from(
        horasMap.entries(),
      )
        .map(
          ([hora, cantidad]) => ({
            hora_inicio: hora,
            reservas_total:
              cantidad,
          }),
        )
        .sort(
          (a, b) =>
            a.hora_inicio.localeCompare(
              b.hora_inicio,
            ),
        );

    const canchaMasUtilizada =
      [...detalleCanchas]
        .filter(
          (cancha) =>
            cancha.reservas_total >
            0,
        )
        .sort(
          (a, b) =>
            b.reservas_total -
            a.reservas_total,
        )[0] || null;

    const deporteMasReservado =
      [...detalleDeportes]
        .sort(
          (a, b) =>
            b.reservas_total -
            a.reservas_total,
        )[0] || null;

    const diaMasDemandado =
      [...detalleDias]
        .sort(
          (a, b) =>
            b.reservas_total -
            a.reservas_total,
        )[0] || null;

    const horaMasDemandada =
      [...detalleHoras]
        .sort(
          (a, b) =>
            b.reservas_total -
            a.reservas_total,
        )[0] || null;

    const destacados:
      ResumenMensualDestacados =
      {
        cancha_mas_utilizada:
          canchaMasUtilizada
            ? {
                id_cancha:
                  canchaMasUtilizada.id_cancha,

                nombre_cancha:
                  canchaMasUtilizada.nombre_cancha,

                reservas_total:
                  canchaMasUtilizada.reservas_total,
              }
            : null,

        deporte_mas_reservado:
          deporteMasReservado
            ? {
                id_deporte:
                  deporteMasReservado.id_deporte,

                nombre_deporte:
                  deporteMasReservado.nombre_deporte,

                reservas_total:
                  deporteMasReservado.reservas_total,
              }
            : null,

        dia_mas_demandado:
          diaMasDemandado
            ? {
                dia_semana:
                  diaMasDemandado.dia_semana,

                nombre_dia:
                  diaMasDemandado.nombre_dia,

                reservas_total:
                  diaMasDemandado.reservas_total,
              }
            : null,

        hora_mas_demandada:
          horaMasDemandada
            ? {
                hora_inicio:
                  horaMasDemandada.hora_inicio,

                reservas_total:
                  horaMasDemandada.reservas_total,
              }
            : null,
      };

    let ocurrenciasTurnosFijosMes =
      0;

    const idsTurnosFijosVigentes =
      new Set<number>();

    for (
      const turno of
      turnosFijos
    ) {
      for (const fecha of fechas) {
        if (
          this.turnoFijoVigenteEnFecha(
            turno,
            fecha,
            this.obtenerDiaSemana(
              fecha,
            ),
          )
        ) {
          ocurrenciasTurnosFijosMes +=
            1;

          idsTurnosFijosVigentes.add(
            Number(
              turno.id_turno_fijo,
            ),
          );
        }
      }
    }

    return {
      club: {
        id_club:
          club.id_club,
        nombre_club:
          club.nombre_club,
      },

      periodo: {
        anio: periodo.anio,
        mes: periodo.mes,
        inicio: periodo.inicio,
        fin_exclusivo:
          periodo.finExclusivo,
        ocupacion_desde:
          inicioOcupacion,
      },

      total_reservas:
        totalReservas,

      reservas_pendientes:
        reservasPendientes,

      reservas_confirmadas:
        reservasConfirmadas,

      reservas_completadas:
        reservasCompletadas,

      reservas_canceladas:
        reservasCanceladas,

      usuarios_unicos:
        usuariosUnicos,

      monto_reservas_validas:
        montoReservasValidas,

      monto_reservas_completadas:
        montoReservasCompletadas,

      monto_pagado_registrado:
        montoPagadoRegistrado,

      ingresos_manuales_total:
        ingresosManualesTotal,

      detalle_ingresos_manuales:
        detalleIngresos,

      total_consolidado_informado:
        montoReservasValidas +
        ingresosManualesTotal,

      turnos_fijos_vigentes:
        idsTurnosFijosVigentes.size,

      ocurrencias_turnos_fijos_mes:
        ocurrenciasTurnosFijosMes,

      detalle_canchas:
        detalleCanchas,

      detalle_deportes:
        detalleDeportes,

      detalle_dias:
        detalleDias,

      detalle_horas:
        detalleHoras,

      destacados,

      /*
        Estas aclaraciones viajan en preview y luego pueden
        mostrarse textual/visualmente en el PDF.
      */
      aclaraciones: [
        'Los importes de reservas corresponden exclusivamente a operaciones registradas en DameCancha.',
        'Los ingresos manuales son información declarada por el club y no son verificados por DameCancha.',
        'La ocupación se estima según la disponibilidad configurada al momento del cálculo; los bloqueos activos se excluyen de los turnos ofrecidos.',
        'En el primer mes del club, la ocupación se calcula únicamente desde su fecha de alta en DameCancha.',
      ],
    };
  }

  async preview(
    idClub: number,
    anio:
      | string
      | number
      | undefined,
    mes:
      | string
      | number
      | undefined,
    usuario: AuthenticatedUser,
  ) {
    const club =
      await this.obtenerClubAdministrable(
        idClub,
        usuario,
      );

    const periodo =
      this.periodoDesdeOpcionales(
        anio,
        mes,
      );

    this.validarPeriodoDesdeAltaClub(
      club,
      periodo,
    );

    return this.calcular(
      club,
      periodo,
    );
  }

  async obtenerGuardado(
    idClub: number,
    anio: string | number,
    mes: string | number,
    usuario: AuthenticatedUser,
  ) {
    const club =
      await this.obtenerClubAdministrable(
        idClub,
        usuario,
      );

    const periodo =
      this.construirPeriodo(
        anio,
        mes,
      );

    this.validarPeriodoDesdeAltaClub(
      club,
      periodo,
    );

    const resumen =
      await this.resumenRepository.findOne(
        {
          where: {
            club: {
              id_club:
                club.id_club,
            },
            anio: periodo.anio,
            mes: periodo.mes,
          },
          relations: ['club'],
        },
      );

    if (!resumen) {
      throw new NotFoundException(
        'No existe un resumen mensual cerrado para ese período.',
      );
    }

    return this.serializarResumen(
      resumen,
    );
  }

  private async generarSnapshotConClub(
    club: Club,
    anio: number,
    mes: number,
  ) {
    const periodo =
      this.construirPeriodo(
        anio,
        mes,
      );

    this.validarPeriodoDesdeAltaClub(
      club,
      periodo,
    );

    const actual =
      this.periodoActual();

    /*
      El snapshot definitivo solo se genera cuando el mes ya terminó.
    */
    if (
      periodo.anio > actual.anio ||
      (
        periodo.anio === actual.anio &&
        periodo.mes >= actual.mes
      )
    ) {
      throw new BadRequestException(
        'El resumen definitivo solo puede generarse para un mes ya cerrado.',
      );
    }

    const existente =
      await this.resumenRepository.findOne(
        {
          where: {
            club: {
              id_club:
                club.id_club,
            },
            anio: periodo.anio,
            mes: periodo.mes,
          },
          relations: ['club'],
        },
      );

    if (existente) {
      return {
        message:
          'El resumen mensual ya había sido generado.',

        resumen:
          this.serializarResumen(
            existente,
          ),
      };
    }

    const calculado =
      await this.calcular(
        club,
        periodo,
      );

    const resumen =
      this.resumenRepository.create({
        club,

        anio: periodo.anio,

        mes: periodo.mes,

        periodo_inicio:
          periodo.inicio,

        periodo_fin_exclusivo:
          periodo.finExclusivo,

        total_reservas:
          calculado.total_reservas,

        reservas_pendientes:
          calculado.reservas_pendientes,

        reservas_confirmadas:
          calculado.reservas_confirmadas,

        reservas_completadas:
          calculado.reservas_completadas,

        reservas_canceladas:
          calculado.reservas_canceladas,

        usuarios_unicos:
          calculado.usuarios_unicos,

        monto_reservas_validas:
          calculado.monto_reservas_validas,

        monto_reservas_completadas:
          calculado.monto_reservas_completadas,

        monto_pagado_registrado:
          calculado.monto_pagado_registrado,

        ingresos_manuales_total:
          calculado.ingresos_manuales_total,

        detalle_ingresos_manuales:
          calculado.detalle_ingresos_manuales,

        total_consolidado_informado:
          calculado.total_consolidado_informado,

        turnos_fijos_vigentes:
          calculado.turnos_fijos_vigentes,

        ocurrencias_turnos_fijos_mes:
          calculado.ocurrencias_turnos_fijos_mes,

        detalle_canchas:
          calculado.detalle_canchas,

        detalle_deportes:
          calculado.detalle_deportes,

        detalle_dias:
          calculado.detalle_dias,

        detalle_horas:
          calculado.detalle_horas,

        destacados:
          calculado.destacados,

        version_esquema: 1,
      });

    const guardado =
      await this.resumenRepository.save(
        resumen,
      );

    return {
      message:
        'Resumen mensual generado correctamente.',

      resumen:
        this.serializarResumen(
          guardado,
        ),

      aclaraciones:
        calculado.aclaraciones,
    };
  }

  async generarSnapshotClubSinAuth(
    idClub: number,
    anio: number,
    mes: number,
  ) {
    const id =
      Number(idClub);

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      throw new BadRequestException(
        'El club indicado no es válido.',
      );
    }

    const club =
      await this.clubRepository.findOne(
        {
          where: {
            id_club: id,
          },
        },
      );

    if (!club) {
      throw new NotFoundException(
        'El club indicado no existe.',
      );
    }

    return this.generarSnapshotConClub(
      club,
      anio,
      mes,
    );
  }

  async generar(
    idClub: number,
    anio: number,
    mes: number,
    usuario: AuthenticatedUser,
  ) {
    const club =
      await this.obtenerClubAdministrable(
        idClub,
        usuario,
      );

    return this.generarSnapshotConClub(
      club,
      anio,
      mes,
    );
  }
}