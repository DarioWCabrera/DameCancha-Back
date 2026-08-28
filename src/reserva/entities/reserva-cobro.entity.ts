import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

import { Reserva } from './reserva.entity';

@Index('idx_reserva_cobro_reserva', ['reserva'])
@Entity('reserva_cobro')
export class ReservaCobro {
  @PrimaryGeneratedColumn({ name: 'id_reserva_cobro' })
  id_reserva_cobro!: number;

  /*
    Reserva a la que pertenece este movimiento de cobro.
    Una reserva puede tener uno o varios cobros.
  */
  @ManyToOne(() => Reserva, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_reserva' })
  reserva!: Reserva;

  /*
    Importe correspondiente a este cobro.
    Puede representar el turno completo o solamente una parte.
  */
  @Column({
    name: 'monto',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  monto!: number;

  /*
    Para la rendición del club solo necesitamos distinguir
    dinero físico de dinero ingresado por medios electrónicos.
  */
  @Column({
    name: 'metodo_pago',
    type: 'enum',
    enum: ['efectivo', 'electronico'],
  })
  metodo_pago!: 'efectivo' | 'electronico';

  /*
    Es opcional porque si una persona paga el turno completo
    no necesitamos identificar jugadores individualmente.

    En un pago dividido puede contener, por ejemplo:
    "Juanchi - 7ma", "Pedro", etc.
  */
  @Column({
    name: 'participante_nombre',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  participante_nombre!: string | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  created_at!: Date;
}