import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { Club } from '../../club/entities/club.entity';
import { Cancha } from '../../cancha/entities/cancha.entity';
import { Reserva } from '../../reserva/entities/reserva.entity';

@Index('idx_user_tipo_estado', ['tipo_usuario', 'estado_usuario'])
@Entity('user')
export class User {
    @PrimaryGeneratedColumn({ name: 'id_usuario' })
    id_usuario!: number;

    @Column({ name: 'nombre_usuario', type: 'varchar', length: 100 })
    nombre_usuario!: string;

    @Column({ name: 'apellido_usuario', type: 'varchar', length: 100 })
    apellido_usuario!: string;

    @Column({ name: 'email_usuario', type: 'varchar', length: 150, unique: true })
    email_usuario!: string;

    @Column({ name: 'dni_usuario', type: 'varchar', length: 20, unique: true, nullable: true })
    dni_usuario!: string | null;

    @Column({ name: 'CUIT_usuario', type: 'varchar', length: 20, nullable: true, unique: true })
    CUIT_usuario!: string | null;

    @Column({ name: 'password_usuario', type: 'varchar', length: 255 })
    password_usuario!: string;

    @Column({ name: 'password_reset_code', type: 'varchar', length: 64, nullable: true })
    password_reset_code!: string | null;

    @Column({ name: 'password_reset_expires', type: 'datetime', nullable: true })
    password_reset_expires!: Date | null;

    @Column({ name: 'password_reset_attempts', type: 'tinyint', default: 0 })
    password_reset_attempts!: number;

    @Column({ name: 'telefono_usuario', type: 'varchar', length: 20, nullable: true })
    telefono_usuario!: string;

    @Column({ name: 'direccion_usuario', type: 'varchar', length: 255, nullable: true })
    direccion_usuario!: string;

    @Column({ name: 'ciudad_usuario', type: 'varchar', length: 100, nullable: true })
    ciudad_usuario!: string;

    @Column({ name: 'provincia_usuario', type: 'varchar', length: 100, nullable: true })
    provincia_usuario!: string;

    @Column({ name: 'cp_usuario', type: 'varchar', length: 20, nullable: true })
    cp_usuario!: string;

    @Column({
        name: 'estado_usuario',
        type: 'enum',
        enum: ['activo', 'inactivo', 'pendiente_aprobacion'],
        default: 'pendiente_aprobacion'
    })
    estado_usuario!: string;

    @Column({
        name: 'tipo_usuario',
        type: 'enum',
        enum: ['usuario', 'dueno', 'admin'],
        default: 'usuario'
    })
    tipo_usuario!: string;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'id_admin_aprobado' })
    admin_aprobado!: User | null;

    @CreateDateColumn({ name: 'created_at', type: 'datetime' })
    created_at!: Date;

    canchas!: Cancha[];

    @OneToMany(() => Reserva, (reserva) => reserva.usuario)
    reservas!: Reserva[];

    @OneToMany(() => Club, (club) => club.dueno)
    clubs!: Club[];
}
