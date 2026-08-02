import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Deporte } from '../../deporte/entities/deporte.entity';
import { User } from '../../user/entities/user.entity';
import { SolicitudJugador } from './solicitud-jugador.entity';

export enum EstadoDisponibilidadJugador {
  ACTIVA = 'activa',
  PAUSADA = 'pausada',
  VENCIDA = 'vencida',
  ELIMINADA = 'eliminada',
}

@Entity('disponibilidad_jugador')
export class DisponibilidadJugador {
  @PrimaryGeneratedColumn({ name: 'id_disponibilidad' })
  id_disponibilidad!: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario!: User;

  @ManyToOne(() => Deporte, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_deporte' })
  deporte!: Deporte;

  @Column({ name: 'nivel', type: 'varchar', length: 60 })
  nivel!: string;

  @Column({
    name: 'modalidad',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  modalidad!: string | null;

  @Column({
    name: 'posicion',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  posicion!: string | null;

  @Column({ name: 'ciudad', type: 'varchar', length: 100 })
  ciudad!: string;

  @Column({ name: 'dias_disponibles', type: 'simple-json' })
  dias_disponibles!: string[];

  @Column({ name: 'hora_desde', type: 'time' })
  hora_desde!: string;

  @Column({ name: 'hora_hasta', type: 'time' })
  hora_hasta!: string;

  @Column({ name: 'fecha_desde', type: 'date' })
  fecha_desde!: string;

  @Column({ name: 'fecha_hasta', type: 'date' })
  fecha_hasta!: string;

  @Column({ name: 'descripcion', type: 'text' })
  descripcion!: string;

  @Column({ name: 'contacto_visible', type: 'boolean', default: false })
  contacto_visible!: boolean;

  @Column({
    name: 'estado',
    type: 'enum',
    enum: EstadoDisponibilidadJugador,
    default: EstadoDisponibilidadJugador.ACTIVA,
  })
  estado!: EstadoDisponibilidadJugador;

  @Column({ name: 'oculta_para_creador', type: 'boolean', default: false })
  oculta_para_creador!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updated_at!: Date;

  @OneToMany(
    () => SolicitudJugador,
    (solicitud) => solicitud.disponibilidad,
  )
  solicitudes!: SolicitudJugador[];
}
