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

import { Club } from '../../club/entities/club.entity';
import { Deporte } from '../../deporte/entities/deporte.entity';

export enum EstadoTorneo {
  BORRADOR = 'borrador',
  PUBLICADO = 'publicado',
  FINALIZADO = 'finalizado',
  CANCELADO = 'cancelado',
}

@Index('idx_torneo_estado_fecha', ['estado', 'fecha_inicio'])
@Entity('torneo')
export class Torneo {
  @PrimaryGeneratedColumn({ name: 'id_torneo' })
  id_torneo!: number;

  @Index('idx_torneo_club')
  @ManyToOne(() => Club, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_club' })
  club!: Club;

  @ManyToOne(() => Deporte, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_deporte' })
  deporte!: Deporte;

  @Column({ name: 'titulo', type: 'varchar', length: 180 })
  titulo!: string;

  @Column({ name: 'descripcion', type: 'text' })
  descripcion!: string;

  @Column({ name: 'fecha_inicio', type: 'date' })
  fecha_inicio!: string;

  @Column({ name: 'fecha_fin', type: 'date' })
  fecha_fin!: string;

  @Column({ name: 'contacto', type: 'varchar', length: 180, nullable: true })
  contacto!: string | null;

  @Column({ name: 'flyer_url', type: 'varchar', length: 255 })
  flyer_url!: string;

  @Column({
    name: 'estado',
    type: 'enum',
    enum: EstadoTorneo,
    default: EstadoTorneo.BORRADOR,
  })
  estado!: EstadoTorneo;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updated_at!: Date;
}
