import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { Club } from '../club/entities/club.entity';

import { CreateIngresoManualClubDto } from './dto/create-ingreso-manual-club.dto';
import { UpdateIngresoManualClubDto } from './dto/update-ingreso-manual-club.dto';
import {
  CategoriaIngresoManualClub,
  IngresoManualClub,
} from './entities/ingreso-manual-club.entity';

@Injectable()
export class IngresoManualService {
  constructor(
    @InjectRepository(IngresoManualClub)
    private readonly ingresoRepository: Repository<IngresoManualClub>,

    @InjectRepository(Club)
    private readonly clubRepository: Repository<Club>,
  ) { }

  private serializarIngreso(
    ingreso: IngresoManualClub,
  ) {
    return {
      id_ingreso_manual: ingreso.id_ingreso_manual,

      club: {
        id_club: ingreso.club.id_club,
        nombre_club: ingreso.club.nombre_club,
      },

      fecha: ingreso.fecha,
      categoria: ingreso.categoria,
      concepto: ingreso.concepto,
      monto: Number(ingreso.monto),
      observaciones: ingreso.observaciones,
      created_at: ingreso.created_at,
      updated_at: ingreso.updated_at,
    };
  }

  private obtenerHoyArgentina(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  private obtenerPeriodoActual(): {
    anio: number;
    mes: number;
    inicio: string;
    finExclusivo: string;
    hoy: string;
  } {
    const hoy = this.obtenerHoyArgentina();
    const [anio, mes] = hoy.split('-').map(Number);

    const siguiente =
      mes === 12
        ? { anio: anio + 1, mes: 1 }
        : { anio, mes: mes + 1 };

    return {
      anio,
      mes,
      inicio: `${anio}-${String(mes).padStart(2, '0')}-01`,
      finExclusivo: `${siguiente.anio}-${String(siguiente.mes).padStart(
        2,
        '0',
      )}-01`,
      hoy,
    };
  }

  private construirPeriodo(
    anioValor?: string | number,
    mesValor?: string | number,
  ): {
    anio: number;
    mes: number;
    inicio: string;
    finExclusivo: string;
  } {
    const actual = this.obtenerPeriodoActual();

    const anio =
      anioValor === undefined || anioValor === ''
        ? actual.anio
        : Number(anioValor);

    const mes =
      mesValor === undefined || mesValor === ''
        ? actual.mes
        : Number(mesValor);

    if (
      !Number.isInteger(anio) ||
      anio < 2020 ||
      anio > 2200 ||
      !Number.isInteger(mes) ||
      mes < 1 ||
      mes > 12
    ) {
      throw new BadRequestException('El período indicado no es válido.');
    }

    const siguiente =
      mes === 12
        ? { anio: anio + 1, mes: 1 }
        : { anio, mes: mes + 1 };

    return {
      anio,
      mes,
      inicio: `${anio}-${String(mes).padStart(2, '0')}-01`,
      finExclusivo: `${siguiente.anio}-${String(siguiente.mes).padStart(
        2,
        '0',
      )}-01`,
    };
  }

  private esFechaISOValida(fecha: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return false;
    }

    const [anio, mes, dia] = fecha.split('-').map(Number);
    const valor = new Date(Date.UTC(anio, mes - 1, dia));

    return (
      valor.getUTCFullYear() === anio &&
      valor.getUTCMonth() === mes - 1 &&
      valor.getUTCDate() === dia
    );
  }

  private validarFechaEditable(fecha: string): void {
    if (!this.esFechaISOValida(fecha)) {
      throw new BadRequestException('La fecha indicada no es válida.');
    }

    const actual = this.obtenerPeriodoActual();

    if (fecha < actual.inicio || fecha >= actual.finExclusivo) {
      throw new BadRequestException(
        'Solo se pueden cargar o modificar ingresos correspondientes al mes actual.',
      );
    }

    if (fecha > actual.hoy) {
      throw new BadRequestException(
        'No se pueden registrar ingresos con una fecha futura.',
      );
    }
  }

  private async obtenerClubAdministrable(
    idClub: number,
    usuario: AuthenticatedUser,
  ): Promise<Club> {
    const id = Number(idClub);

    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('El club indicado no es válido.');
    }

    const club = await this.clubRepository.findOne({
      where: { id_club: id },
      relations: ['dueno'],
    });

    if (!club) {
      throw new NotFoundException('El club indicado no existe.');
    }

    if (usuario.tipo !== 'admin') {
      const esResponsable =
        usuario.tipo === 'dueno' || usuario.tipo === 'club';

      if (!esResponsable) {
        throw new ForbiddenException(
          'Solo el responsable del club puede administrar ingresos manuales.',
        );
      }

      if (Number(club.dueno?.id_usuario) !== Number(usuario.sub)) {
        throw new ForbiddenException(
          'No tenés permiso para administrar este club.',
        );
      }
    }

    if (club.estado !== 'activo') {
      throw new ForbiddenException(
        'El club se encuentra inactivo y no puede operar.',
      );
    }

    return club;
  }

  private async obtenerIngresoAdministrable(
    idIngreso: number,
    usuario: AuthenticatedUser,
  ): Promise<IngresoManualClub> {
    const id = Number(idIngreso);

    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('El ingreso indicado no es válido.');
    }

    const ingreso = await this.ingresoRepository.findOne({
      where: { id_ingreso_manual: id },
      relations: ['club', 'club.dueno'],
    });

    if (!ingreso) {
      throw new NotFoundException('El ingreso manual no existe.');
    }

    await this.obtenerClubAdministrable(
      ingreso.club.id_club,
      usuario,
    );

    return ingreso;
  }

  async crear(
    dto: CreateIngresoManualClubDto,
    usuario: AuthenticatedUser,
  ) {
    const club = await this.obtenerClubAdministrable(dto.id_club, usuario);

    const fecha = String(dto.fecha || '').trim();
    this.validarFechaEditable(fecha);

    const concepto = String(dto.concepto || '').trim();
    const observaciones =
      dto.observaciones === null
        ? null
        : String(dto.observaciones || '').trim() || null;

    const ingreso = this.ingresoRepository.create({
      club,
      fecha,
      categoria: dto.categoria,
      concepto,
      monto: Number(dto.monto),
      observaciones,
    });

    const guardado = await this.ingresoRepository.save(ingreso);

    return {
      message: 'Ingreso manual registrado correctamente.',
      ingreso: this.serializarIngreso(guardado),
    };
  }

  async listarPorClub(
    idClub: number,
    usuario: AuthenticatedUser,
    anio?: string | number,
    mes?: string | number,
  ) {
    const club = await this.obtenerClubAdministrable(idClub, usuario);
    const periodo = this.construirPeriodo(anio, mes);

    const ingresos = await this.ingresoRepository
      .createQueryBuilder('ingreso')
      .innerJoinAndSelect('ingreso.club', 'club')
      .where('club.id_club = :idClub', {
        idClub: club.id_club,
      })
      .andWhere('ingreso.fecha >= :inicio', {
        inicio: periodo.inicio,
      })
      .andWhere('ingreso.fecha < :finExclusivo', {
        finExclusivo: periodo.finExclusivo,
      })
      .orderBy('ingreso.fecha', 'DESC')
      .addOrderBy('ingreso.created_at', 'DESC')
      .getMany();

    const subtotales: Record<CategoriaIngresoManualClub, number> = {
      buffet: 0,
      alquiler_equipamiento: 0,
      evento: 0,
      clase: 0,
      sponsor: 0,
      otro: 0,
    };

    let total = 0;

    for (const ingreso of ingresos) {
      const monto = Number(ingreso.monto || 0);
      total += monto;
      subtotales[ingreso.categoria] += monto;
    }

    const actual = this.obtenerPeriodoActual();

    return {
      periodo: {
        anio: periodo.anio,
        mes: periodo.mes,
        cerrado:
          periodo.anio < actual.anio ||
          (periodo.anio === actual.anio &&
            periodo.mes < actual.mes),
      },
      cantidad: ingresos.length,
      total,
      subtotales,
      ingresos: ingresos.map((ingreso) =>
        this.serializarIngreso(ingreso),
      ),
    };
  }

  async actualizar(
    idIngreso: number,
    dto: UpdateIngresoManualClubDto,
    usuario: AuthenticatedUser,
  ) {
    const ingreso = await this.obtenerIngresoAdministrable(
      idIngreso,
      usuario,
    );

    /*
      El período se determina por la fecha actualmente guardada.
      Si el mes ya terminó, el movimiento queda histórico y no puede editarse.
    */
    this.validarFechaEditable(ingreso.fecha);

    if (dto.fecha !== undefined) {
      const nuevaFecha = String(dto.fecha).trim();
      this.validarFechaEditable(nuevaFecha);
      ingreso.fecha = nuevaFecha;
    }

    if (dto.categoria !== undefined) {
      ingreso.categoria = dto.categoria;
    }

    if (dto.concepto !== undefined) {
      ingreso.concepto = String(dto.concepto).trim();
    }

    if (dto.monto !== undefined) {
      ingreso.monto = Number(dto.monto);
    }

    if (dto.observaciones !== undefined) {
      ingreso.observaciones =
        dto.observaciones === null
          ? null
          : String(dto.observaciones).trim() || null;
    }

    const guardado = await this.ingresoRepository.save(ingreso);

    return {
      message: 'Ingreso manual actualizado correctamente.',
      ingreso: this.serializarIngreso(guardado),
    };
  }

  async eliminar(
    idIngreso: number,
    usuario: AuthenticatedUser,
  ) {
    const ingreso = await this.obtenerIngresoAdministrable(
      idIngreso,
      usuario,
    );

    this.validarFechaEditable(ingreso.fecha);

    await this.ingresoRepository.remove(ingreso);

    return {
      message: 'Ingreso manual eliminado correctamente.',
      id_ingreso_manual: Number(idIngreso),
    };
  }
}
