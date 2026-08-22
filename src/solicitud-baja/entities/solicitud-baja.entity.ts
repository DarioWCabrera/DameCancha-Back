import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('solicitud_baja')
export class SolicitudBaja {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    name: 'id_solicitud',
  })
  id_solicitud!: string;

  @Column({
    name: 'codigo',
    type: 'varchar',
    length: 40,
    insert: false,
  })
  codigo!: string;

  @Column({
    name: 'id_club',
    type: 'integer',
  })
  id_club!: number;

  @Column({
    name: 'id_usuario_solicitante',
    type: 'integer',
  })
  id_usuario_solicitante!: number;

  @Column({
    name: 'motivo',
    type: 'text',
    nullable: true,
  })
  motivo!: string | null;

  @Column({
    name: 'estado',
    type: 'varchar',
    length: 20,
    default: 'pendiente',
  })
  estado!: 'pendiente' | 'procesada' | 'cancelada';

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  created_at!: Date;

  @Column({
    name: 'processed_at',
    type: 'timestamptz',
    nullable: true,
  })
  processed_at!: Date | null;

  @Column({
    name: 'id_admin_procesado',
    type: 'integer',
    nullable: true,
  })
  id_admin_procesado!: number | null;
}