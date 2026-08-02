import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Cancha } from '../../cancha/entities/cancha.entity';

@Entity('deporte')
export class Deporte {
  @PrimaryGeneratedColumn({ name: 'id_deporte' })
  id_deporte: number;

  @Column({ name: 'nombre_deporte', type: 'varchar', length: 100 })
  nombre_deporte: string;

  @Column({ name: 'descripcion_deporte', type: 'text', nullable: true })
  descripcion_deporte: string;

  @OneToMany(() => Cancha, (cancha) => cancha.id_deporte)
  canchas: Cancha[];
}
