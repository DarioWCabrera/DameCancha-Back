import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../../user/entities/user.entity';
import { DisponibilidadJugador } from './disponibilidad-jugador.entity';

export enum EstadoSolicitudJugador {
  PENDIENTE = 'pendiente',
  ACEPTADA = 'aceptada',
  RECHAZADA = 'rechazada',
  CANCELADA = 'cancelada',
}

@Entity('solicitud_jugador')
export class SolicitudJugador {
  @PrimaryGeneratedColumn({ name: 'id_solicitud' })
  id_solicitud!: number;

  @ManyToOne(
    () => DisponibilidadJugador,
    (disponibilidad) => disponibilidad.solicitudes,
    { nullable: false, onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'id_disponibilidad' })
  disponibilidad!: DisponibilidadJugador;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario_solicitante' })
  solicitante!: User;

  @Column({ name: 'mensaje', type: 'text', nullable: true })
  mensaje!: string | null;

  @Column({
    name: 'fecha_propuesta',
    type: 'date',
    nullable: true,
  })
  fecha_propuesta!: string | null;

  @Column({
    name: 'hora_propuesta',
    type: 'time',
    nullable: true,
  })
  hora_propuesta!: string | null;

  @Column({
    name: 'estado',
    type: 'enum',
    enum: EstadoSolicitudJugador,
    default: EstadoSolicitudJugador.PENDIENTE,
  })
  estado!: EstadoSolicitudJugador;

  @Column({ name: 'oculta_para_solicitante', type: 'boolean', default: false })
  oculta_para_solicitante!: boolean;

  @Column({ name: 'oculta_para_propietario', type: 'boolean', default: false })
  oculta_para_propietario!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updated_at!: Date;
}
