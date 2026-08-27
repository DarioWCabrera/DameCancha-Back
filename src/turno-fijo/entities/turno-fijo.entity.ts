import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../../user/entities/user.entity';
import { Club } from '../../club/entities/club.entity';
import { Cancha } from '../../cancha/entities/cancha.entity';
import { Deporte } from '../../deporte/entities/deporte.entity';

export type TurnoFijoOrigen = 'usuario' | 'club';

export type TurnoFijoEstado =
  | 'pendiente'
  | 'activo'
  | 'rechazado'
  | 'cancelado';

export type TurnoFijoAlternativa = {
  dia_semana: number;
  hora_inicio: string;
  hora_fin?: string | null;
  id_cancha?: number | null;
};

@Index('idx_turno_fijo_estado', ['estado'])
@Index('idx_turno_fijo_dia_estado_horas', [
  'dia_semana',
  'estado',
  'hora_inicio',
  'hora_fin',
])
@Entity('turno_fijo')
export class TurnoFijo {
  @PrimaryGeneratedColumn({ name: 'id_turno_fijo' })
  id_turno_fijo!: number;

  @Column({
    name: 'origen',
    type: 'enum',
    enum: ['usuario', 'club'],
  })
  origen!: TurnoFijoOrigen;

  @Column({
    name: 'estado',
    type: 'enum',
    enum: ['pendiente', 'activo', 'rechazado', 'cancelado'],
    default: 'pendiente',
  })
  estado!: TurnoFijoEstado;

  /*
    0 = domingo
    1 = lunes
    ...
    6 = sábado
  */
  @Column({ name: 'dia_semana', type: 'smallint' })
  dia_semana!: number;

  /*
    El usuario solicita un día + hora de inicio.
    La hora final puede quedar pendiente hasta que el dueño
    asigne una cancha concreta, porque la duración es por cancha.
  */
  @Column({ name: 'hora_inicio', type: 'time' })
  hora_inicio!: string;

  @Column({ name: 'hora_fin', type: 'time', nullable: true })
  hora_fin!: string | null;

  /*
    Se completa cuando el turno fijo queda aprobado/activo.
    Mientras una solicitud está pendiente puede permanecer en null.
  */
  @Column({ name: 'fecha_inicio', type: 'date', nullable: true })
  fecha_inicio!: string | null;

  /*
    Si es null, el turno fijo no tiene una fecha de finalización programada.
  */
  @Column({ name: 'fecha_fin', type: 'date', nullable: true })
  fecha_fin!: string | null;

  /*
    Se completa cuando el club rechaza una solicitud.
    Puede contener el motivo y/o un comentario libre del dueño.
  */
  @Column({ name: 'motivo_rechazo', type: 'text', nullable: true })
  motivo_rechazo!: string | null;

  /*
    Horarios alternativos propuestos por el club al rechazar.
    Se guarda como JSON para poder ofrecer varias opciones sin otra tabla.
  */
  @Column({ name: 'alternativas', type: 'simple-json', nullable: true })
  alternativas!: TurnoFijoAlternativa[] | null;

  /*
    Estos campos permiten que el dueño cargue un turno fijo histórico
    aunque el cliente todavía no tenga usuario en DameCancha.
  */
  @Column({
    name: 'nombre_cliente_manual',
    type: 'varchar',
    length: 160,
    nullable: true,
  })
  nombre_cliente_manual!: string | null;

  @Column({
    name: 'telefono_cliente_manual',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  telefono_cliente_manual!: string | null;

  /*
    Usuario que solicitó el turno fijo.
    Puede ser null cuando el dueño lo carga manualmente para un cliente externo.
  */
  @Index('idx_turno_fijo_usuario')
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_usuario' })
  usuario!: User | null;

  @Index('idx_turno_fijo_club')
  @ManyToOne(() => Club, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_club' })
  club!: Club;

  @Index('idx_turno_fijo_deporte')
  @ManyToOne(() => Deporte, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_deporte' })
  deporte!: Deporte;

  /*
    Puede ser null mientras la solicitud está pendiente.
    El dueño puede asignar o cambiar la cancha al aprobarla.
  */
  @Index('idx_turno_fijo_cancha')
  @ManyToOne(() => Cancha, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_cancha' })
  cancha!: Cancha | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updated_at!: Date;
}