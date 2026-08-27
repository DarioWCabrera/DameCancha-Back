import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Club } from '../../club/entities/club.entity';

export type ResumenMensualCancha = {
  id_cancha: number;
  nombre_cancha: string;
  id_deporte: number | null;
  nombre_deporte: string | null;
  reservas_total: number;
  reservas_completadas: number;
  reservas_canceladas: number;
  monto_reservas_validas: number;
  turnos_disponibles: number | null;
  turnos_ocupados: number | null;
  ocupacion_porcentaje: number | null;
};

export type ResumenMensualDeporte = {
  id_deporte: number;
  nombre_deporte: string;
  reservas_total: number;
  reservas_completadas: number;
  reservas_canceladas: number;
  monto_reservas_validas: number;
};

export type ResumenMensualDia = {
  dia_semana: number;
  nombre_dia: string;
  reservas_total: number;
};

export type ResumenMensualHora = {
  hora_inicio: string;
  reservas_total: number;
};

export type ResumenMensualDestacados = {
  cancha_mas_utilizada: {
    id_cancha: number;
    nombre_cancha: string;
    reservas_total: number;
  } | null;

  deporte_mas_reservado: {
    id_deporte: number;
    nombre_deporte: string;
    reservas_total: number;
  } | null;

  dia_mas_demandado: {
    dia_semana: number;
    nombre_dia: string;
    reservas_total: number;
  } | null;

  hora_mas_demandada: {
    hora_inicio: string;
    reservas_total: number;
  } | null;
};

export type ResumenMensualIngresosManuales = {
  buffet: number;
  alquiler_equipamiento: number;
  evento: number;
  clase: number;
  sponsor: number;
  otro: number;
};

@Index('uq_resumen_mensual_club_periodo', ['club', 'anio', 'mes'], {
  unique: true,
})
@Index('idx_resumen_mensual_periodo', ['anio', 'mes'])
@Entity('resumen_mensual_club')
export class ResumenMensualClub {
  @PrimaryGeneratedColumn({ name: 'id_resumen_mensual' })
  id_resumen_mensual!: number;

  @ManyToOne(() => Club, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_club' })
  club!: Club;

  @Column({ name: 'anio', type: 'smallint' })
  anio!: number;

  @Column({ name: 'mes', type: 'smallint' })
  mes!: number;

  @Column({ name: 'periodo_inicio', type: 'date' })
  periodo_inicio!: string;

  @Column({ name: 'periodo_fin_exclusivo', type: 'date' })
  periodo_fin_exclusivo!: string;

  @Column({ name: 'total_reservas', type: 'integer', default: 0 })
  total_reservas!: number;

  @Column({ name: 'reservas_pendientes', type: 'integer', default: 0 })
  reservas_pendientes!: number;

  @Column({ name: 'reservas_confirmadas', type: 'integer', default: 0 })
  reservas_confirmadas!: number;

  @Column({ name: 'reservas_completadas', type: 'integer', default: 0 })
  reservas_completadas!: number;

  @Column({ name: 'reservas_canceladas', type: 'integer', default: 0 })
  reservas_canceladas!: number;

  @Column({ name: 'usuarios_unicos', type: 'integer', default: 0 })
  usuarios_unicos!: number;

  @Column({
    name: 'monto_reservas_validas',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number | null | undefined) => value ?? 0,
      from: (value: string | number | null) => Number(value ?? 0),
    },
  })
  monto_reservas_validas!: number;

  @Column({
    name: 'monto_reservas_completadas',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number | null | undefined) => value ?? 0,
      from: (value: string | number | null) => Number(value ?? 0),
    },
  })
  monto_reservas_completadas!: number;

  @Column({
    name: 'monto_pagado_registrado',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number | null | undefined) => value ?? 0,
      from: (value: string | number | null) => Number(value ?? 0),
    },
  })
  monto_pagado_registrado!: number;

  @Column({
    name: 'ingresos_manuales_total',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number | null | undefined) => value ?? 0,
      from: (value: string | number | null) => Number(value ?? 0),
    },
  })
  ingresos_manuales_total!: number;

  @Column({
    name: 'detalle_ingresos_manuales',
    type: 'jsonb',
    default: () =>
      `'{
        "buffet": 0,
        "alquiler_equipamiento": 0,
        "evento": 0,
        "clase": 0,
        "sponsor": 0,
        "otro": 0
      }'::jsonb`,
  })
  detalle_ingresos_manuales!: ResumenMensualIngresosManuales;

  @Column({
    name: 'total_consolidado_informado',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number | null | undefined) => value ?? 0,
      from: (value: string | number | null) => Number(value ?? 0),
    },
  })
  total_consolidado_informado!: number;

  @Column({ name: 'turnos_fijos_vigentes', type: 'integer', default: 0 })
  turnos_fijos_vigentes!: number;

  @Column({
    name: 'ocurrencias_turnos_fijos_mes',
    type: 'integer',
    default: 0,
  })
  ocurrencias_turnos_fijos_mes!: number;

  @Column({
    name: 'detalle_canchas',
    type: 'jsonb',
    default: () => "'[]'::jsonb",
  })
  detalle_canchas!: ResumenMensualCancha[];

  @Column({
    name: 'detalle_deportes',
    type: 'jsonb',
    default: () => "'[]'::jsonb",
  })
  detalle_deportes!: ResumenMensualDeporte[];

  @Column({
    name: 'detalle_dias',
    type: 'jsonb',
    default: () => "'[]'::jsonb",
  })
  detalle_dias!: ResumenMensualDia[];

  @Column({
    name: 'detalle_horas',
    type: 'jsonb',
    default: () => "'[]'::jsonb",
  })
  detalle_horas!: ResumenMensualHora[];

  @Column({
    name: 'destacados',
    type: 'jsonb',
    default: () =>
      `'{
        "cancha_mas_utilizada": null,
        "deporte_mas_reservado": null,
        "dia_mas_demandado": null,
        "hora_mas_demandada": null
      }'::jsonb`,
  })
  destacados!: ResumenMensualDestacados;

  @Column({ name: 'version_esquema', type: 'smallint', default: 1 })
  version_esquema!: number;

  @CreateDateColumn({ name: 'generado_at', type: 'timestamptz' })
  generado_at!: Date;
}
