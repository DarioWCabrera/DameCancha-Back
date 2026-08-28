import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

import { Club } from './club.entity';
import { User } from '../../user/entities/user.entity';

@Index(
  'uq_club_cliente_alias_club_usuario',
  ['club', 'usuario'],
  { unique: true },
)
@Entity('club_cliente_alias')
export class ClubClienteAlias {
  @PrimaryGeneratedColumn({ name: 'id_club_cliente_alias' })
  id_club_cliente_alias!: number;

  @ManyToOne(() => Club, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_club' })
  club!: Club;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario!: User;

  @Column({
    name: 'alias',
    type: 'varchar',
    length: 120,
  })
  alias!: string;
}