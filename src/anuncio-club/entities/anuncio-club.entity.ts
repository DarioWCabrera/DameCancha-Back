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

@Entity('anuncio_club')
@Index('idx_anuncio_club', ['club'])
@Index('idx_anuncio_club_activo', ['club', 'activo'])
export class AnuncioClub {
  @PrimaryGeneratedColumn({ name: 'id_anuncio' })
  id_anuncio!: number;

  @ManyToOne(() => Club, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_club' })
  club!: Club;

  @Column({
    name: 'titulo',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  titulo!: string | null;

  @Column({
    name: 'contenido',
    type: 'text',
  })
  contenido!: string;

  @Column({
    name: 'imagen_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  imagen_url!: string | null;

  @Column({
    name: 'activo',
    type: 'boolean',
    default: true,
  })
  activo!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updated_at!: Date;
}