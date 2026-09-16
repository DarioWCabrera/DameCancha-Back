import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

import { User } from './user.entity';

@Entity('push_device')
@Index('uq_push_device_fcm_token', ['fcm_token'], {
  unique: true,
})
export class PushDevice {
  @PrimaryGeneratedColumn({
    name: 'id_push_device',
  })
  id_push_device!: number;

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'id_usuario',
  })
  usuario!: User;

  @Column({
    name: 'fcm_token',
    type: 'text',
  })
  fcm_token!: string;

  @Column({
    name: 'plataforma',
    type: 'varchar',
    length: 20,
    default: 'android',
  })
  plataforma!: string;

  @Column({
    name: 'activo',
    type: 'boolean',
    default: true,
  })
  activo!: boolean;

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