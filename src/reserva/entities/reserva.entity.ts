import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Cancha } from '../../cancha/entities/cancha.entity';

@Index('idx_reserva_fecha_estado_horas', ['fecha', 'estado', 'hora_inicio', 'hora_fin'])
@Index('idx_reserva_estado_pago', ['estado_pago'])
@Entity('reserva')
export class Reserva {
  @PrimaryGeneratedColumn({ name: 'id_reserva' })
  id_reserva!: number;

  @Column({ name: 'fecha', type: 'date' })
  fecha!: string;

  @Column({ name: 'hora_inicio', type: 'time' })
  hora_inicio!: string;

  @Column({ name: 'hora_fin', type: 'time' })
  hora_fin!: string;

  @Column({ name: 'monto_total', type: 'decimal', precision: 10, scale: 2 })
  monto_total!: number;

  @Column({
    name: 'estado',
    type: 'enum',
    enum: ['pendiente', 'confirmada', 'cancelada', 'completada'],
    default: 'pendiente',
  })
  estado!: string;

  /*
    Estado administrativo del cobro.
    Las reservas nuevas se abonan presencialmente en el club. Los valores
    históricos se conservan para no perder información de reservas anteriores.
  */
  @Column({
    name: 'estado_pago',
    type: 'enum',
    enum: ['pendiente', 'pagado', 'pago_en_club', 'rechazado'],
    default: 'pago_en_club',
  })
  estado_pago!: string;

  @Column({
    name: 'mercado_pago_preference_id',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  mercado_pago_preference_id!: string | null;

  @Column({
    name: 'mercado_pago_payment_id',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  mercado_pago_payment_id!: string | null;

  @Column({
    name: 'mercado_pago_status',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  mercado_pago_status!: string | null;

  @Column({
    name: 'monto_pagado',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  monto_pagado!: number | null;

  @Column({
    name: 'fecha_pago',
    type: 'timestamptz',
    nullable: true,
  })
  fecha_pago!: Date | null;

  @Index('idx_reserva_usuario')
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario!: User;

  @Index('idx_reserva_cancha')
  @ManyToOne(() => Cancha, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_cancha' })
  cancha!: Cancha;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at!: Date;
}
