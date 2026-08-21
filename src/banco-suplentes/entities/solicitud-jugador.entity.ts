import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

import { User } from '../../user/entities/user.entity';
import { DisponibilidadJugador } from './disponibilidad-jugador.entity';

export enum EstadoSolicitudJugador {
  PENDIENTE = 'pendiente',
  ACEPTADA = 'aceptada',
  RECHAZADA = 'rechazada',
  CANCELADA = 'cancelada',
}

@Index('idx_solicitud_estado', ['estado'])
@Entity('solicitud_jugador')
export class SolicitudJugador {
  @PrimaryGeneratedColumn({ name: 'id_solicitud' })
  id_solicitud!: number;

  @Index('idx_solicitud_disponibilidad')
  @ManyToOne(
    () => DisponibilidadJugador,
    (disponibilidad) => disponibilidad.solicitudes,
    { nullable: false, onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'id_disponibilidad' })
  disponibilidad!: DisponibilidadJugador;

  @Index('idx_solicitud_solicitante')
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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updated_at!: Date;
}
