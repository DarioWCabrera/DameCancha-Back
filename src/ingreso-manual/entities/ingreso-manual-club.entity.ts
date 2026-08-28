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

import { Club } from '../../club/entities/club.entity';

export type CategoriaIngresoManualClub =
  | 'buffet'
  | 'alquiler_equipamiento'
  | 'evento'
  | 'clase'
  | 'sponsor'
  | 'otro';

export type MetodoPagoIngresoManualClub =
  | 'efectivo'
  | 'electronico';

@Index('idx_ingreso_manual_club_fecha', ['fecha'])
@Index('idx_ingreso_manual_club_categoria', ['categoria'])
@Entity('ingreso_manual_club')
export class IngresoManualClub {
  @PrimaryGeneratedColumn({ name: 'id_ingreso_manual' })
  id_ingreso_manual!: number;

  @ManyToOne(() => Club, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_club' })
  club!: Club;

  @Column({ name: 'fecha', type: 'date' })
  fecha!: string;

  @Column({
    name: 'categoria',
    type: 'varchar',
    length: 40,
  })
  categoria!: CategoriaIngresoManualClub;

  @Column({
    name: 'concepto',
    type: 'varchar',
    length: 180,
  })
  concepto!: string;

  @Column({
    name: 'monto',
    type: 'decimal',
    precision: 14,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) => Number(value),
    },
  })
  monto!: number;

  @Column({
    name: 'metodo_pago',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  metodo_pago!: MetodoPagoIngresoManualClub | null;

  @Column({
    name: 'observaciones',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  observaciones!: string | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  created_at!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
  })
  updated_at!: Date;
}