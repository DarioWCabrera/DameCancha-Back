import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Cancha } from '../../cancha/entities/cancha.entity';

@Index('idx_disponibilidad_dia_horas', ['dia_semana', 'hora_inicio', 'hora_fin'])
@Entity('disponibilidad')
export class Disponibilidad {
  @PrimaryGeneratedColumn({ name: 'id_disponibilidad' })
  id_disponibilidad!: number;

  @Column({ name: 'dia_semana', type: 'tinyint' })
  dia_semana!: number;

  @Column({ name: 'hora_inicio', type: 'time' })
  hora_inicio!: string;

  @Column({ name: 'hora_fin', type: 'time' })
  hora_fin!: string;

  @Index('idx_disponibilidad_cancha')
  @ManyToOne(() => Cancha, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_cancha' })
  cancha!: Cancha;
}
