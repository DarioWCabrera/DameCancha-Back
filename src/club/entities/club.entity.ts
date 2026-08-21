import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { Cancha } from '../../cancha/entities/cancha.entity';
import { User } from '../../user/entities/user.entity';


@Index('idx_club_estado', ['estado'])
@Entity('club')
export class Club {
  @PrimaryGeneratedColumn({ name: 'id_club' })
  id_club!: number;

  @Column({ name: 'nombre_club', type: 'varchar', length: 150 })
  nombre_club!: string;

  @Column({ name: 'deportes_club', type: 'simple-json', nullable: true })
  deportes_club!: string[];

  @Column({ name: 'logo_club', type: 'varchar', length: 255, nullable: true })
  logo_club!: string;

  @Column({ name: 'direccion_club', type: 'varchar', length: 255 })
  direccion_club!: string;

  @Column({ name: 'ciudad_club', type: 'varchar', length: 100, nullable: true })
  ciudad_club!: string;

  @Column({ name: 'provincia_club', type: 'varchar', length: 100, nullable: true })
  provincia_club!: string;

  @Column({ name: 'cp_club', type: 'varchar', length: 20, nullable: true })
  cp_club!: string;

  @Column({ name: 'telefono_club', type: 'varchar', length: 20, nullable: true })
  telefono_club!: string;

  @Column({ name: 'descripcion_club', type: 'text', nullable: true })
  descripcion_club!: string;

  @Column({ name: 'servicios_club', type: 'text', nullable: true })
  servicios_club!: string | null;

  @Column({
    name: 'estado',
    type: 'enum',
    enum: ['activo', 'inactivo', 'pendiente_aprobacion'],
    default: 'activo'
  })
  estado!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_dueno' })
  dueno!: User;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_admin_aprobado' })
  admin_aprobado!: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at!: Date;


  @OneToMany(() => Cancha, (cancha) => cancha.id_club)
  canchas!: Cancha[];

}
