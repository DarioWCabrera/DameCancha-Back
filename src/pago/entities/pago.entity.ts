import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Reserva } from '../../reserva/entities/reserva.entity';

@Entity('pago')
export class Pago {
  @PrimaryGeneratedColumn({ name: 'id_pago' })
  id_pago!: number;

  @Column({ name: 'monto', type: 'decimal', precision: 10, scale: 2 })
  monto!: number;

  @Column({
    name: 'metodo',
    type: 'enum',
    enum: ['efectivo', 'tarjeta', 'transferencia', 'mercado_pago'],
  })
  metodo!: string;

  @Column({
    name: 'estado',
    type: 'enum',
    enum: ['pendiente', 'completado', 'rechazado'],
    default: 'pendiente',
  })
  estado!: string;

  /*
    Para Mercado Pago se guarda aquí el payment_id.
    También sigue siendo compatible con referencias de otros métodos de pago.
  */
  @Index('ux_pago_referencia_externa', { unique: true })
  @Column({
    name: 'referencia_externa',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  referencia_externa!: string | null;

  @Column({ name: 'fecha_pago', type: 'datetime', nullable: true })
  fecha_pago!: Date | null;

  @ManyToOne(() => Reserva, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_reserva' })
  reserva!: Reserva;
}
