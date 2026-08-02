import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { Club } from '../../club/entities/club.entity';
import { Deporte } from '../../deporte/entities/deporte.entity';
import { Reserva } from '../../reserva/entities/reserva.entity';
import { Disponibilidad } from '../../disponibilidad/entities/disponibilidad.entity';


@Index('idx_cancha_activa', ['activa'])
@Entity('cancha')
export class Cancha {
  @PrimaryGeneratedColumn({ name: 'id_cancha' })
  id_cancha!: number;

  @Column({ name: 'nombre_cancha', type: 'varchar', length: 100 })
  nombre_cancha!: string;

  @Column({ name: 'descripcion_cancha', type: 'text', nullable: true })
  descripcion_cancha!: string;

  @Column({ name: 'precio_por_hora', type: 'decimal', precision: 10, scale: 2, default: 0 })
  precio_por_hora?: number;

  @Column({ name: 'activa', type: 'tinyint', default: 1 })
  activa?: number;

  @Column({ name: 'direccion_cancha', type: 'varchar', length: 255, nullable: true })
  direccion_cancha!: string;

  @Column({ name: 'ciudad_cancha', type: 'varchar', length: 100, nullable: true })
  ciudad_cancha!: string;

  @Column({ name: 'provincia_cancha', type: 'varchar', length: 100, nullable: true })
  provincia_cancha!: string;

  @Column({ name: 'cp_cancha', type: 'varchar', length: 20, nullable: true })
  cp_cancha!: string;

  @ManyToOne(() => Club, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_club' })
  id_club!: Club;

  @ManyToOne(() => Deporte, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_deporte' })
  id_deporte!: Deporte;

  @OneToMany(() => Reserva, (reserva) => reserva.cancha)
  reservas!: Reserva[];

  @OneToMany(() => Disponibilidad, (disponibilidad) => disponibilidad.cancha)
  disponibilidades!: Disponibilidad[];
}
