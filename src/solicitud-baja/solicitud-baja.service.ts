import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Club } from '../club/entities/club.entity';
import { SolicitudBaja } from './entities/solicitud-baja.entity';

export interface UsuarioAutenticado {
  sub: number;
  tipo: string;
}

@Injectable()
export class SolicitudBajaService {
  constructor(
    @InjectRepository(SolicitudBaja)
    private readonly solicitudBajaRepository: Repository<SolicitudBaja>,

    @InjectRepository(Club)
    private readonly clubRepository: Repository<Club>,
  ) { }

  /*
    Crea una solicitud de baja.

    Seguridad:
    - Solo un dueño puede solicitarla.
    - El club debe existir.
    - El club debe pertenecer al usuario autenticado.
    - No permitimos dos solicitudes pendientes para el mismo club.
  */
  async crearSolicitud(
    idClub: number,
    motivo: string | undefined,
    usuario: UsuarioAutenticado,
  ) {
    const esResponsableClub =
      usuario.tipo === 'club' ||
      usuario.tipo === 'dueno';

    if (!esResponsableClub) {
      throw new ForbiddenException(
        'Solo el responsable de un club puede solicitar la baja del servicio.',
      );
    }

    const idClubNumerico = Number(idClub);

    if (!Number.isInteger(idClubNumerico) || idClubNumerico <= 0) {
      throw new BadRequestException('El club indicado no es válido.');
    }

    /*
      Buscamos también al dueño para comprobar propiedad.
      Nunca confiamos solamente en el id_club enviado por el frontend.
    */
    const club = await this.clubRepository.findOne({
      where: {
        id_club: idClubNumerico,
      },
      relations: ['dueno'],
    });

    if (!club) {
      throw new NotFoundException('El club indicado no existe.');
    }

    const idDuenoClub = club.dueno?.id_usuario;

    if (
      !idDuenoClub ||
      Number(idDuenoClub) !== Number(usuario.sub)
    ) {
      throw new ForbiddenException(
        'No tenés permiso para solicitar la baja de este club.',
      );
    }

    /*
      Evitamos que el mismo club genere varias solicitudes
      pendientes.
    */
    const solicitudPendiente =
      await this.solicitudBajaRepository.findOne({
        where: {
          id_club: idClubNumerico,
          estado: 'pendiente',
        },
      });

    if (solicitudPendiente) {
      throw new ConflictException(
        `Ya existe una solicitud de baja pendiente para este club (${solicitudPendiente.codigo}).`,
      );
    }

    const motivoLimpio = String(motivo || '').trim();

    if (motivoLimpio.length > 1000) {
      throw new BadRequestException(
        'El motivo no puede superar los 1000 caracteres.',
      );
    }

    const nuevaSolicitud =
      this.solicitudBajaRepository.create({
        id_club: idClubNumerico,
        id_usuario_solicitante: Number(usuario.sub),
        motivo: motivoLimpio || null,
        estado: 'pendiente',
        processed_at: null,
        id_admin_procesado: null,
      });

    const guardada =
      await this.solicitudBajaRepository.save(
        nuevaSolicitud,
      );

    /*
      Volvemos a leerla para recuperar también el código
      BAJA-... generado automáticamente por PostgreSQL.
    */
    const solicitudCompleta =
      await this.solicitudBajaRepository.findOne({
        where: {
          id_solicitud: guardada.id_solicitud,
        },
      });

    return {
      message: 'Solicitud de baja registrada correctamente.',
      solicitud: solicitudCompleta,
    };
  }

  /*
    Listado para el panel administrativo.
  */
  async listarSolicitudes(
    usuario: UsuarioAutenticado,
  ) {
    if (usuario.tipo !== 'admin') {
      throw new ForbiddenException(
        'Solo un administrador puede consultar las solicitudes de baja.',
      );
    }

    return this.solicitudBajaRepository.find({
      order: {
        created_at: 'DESC',
      },
    });
  }

  /*
    El admin marca la solicitud como procesada.

    IMPORTANTE:
    En esta V1 esto NO desactiva automáticamente el club.
  */
  async procesarSolicitud(
    idSolicitud: string,
    usuario: UsuarioAutenticado,
  ) {
    if (usuario.tipo !== 'admin') {
      throw new ForbiddenException(
        'Solo un administrador puede procesar solicitudes de baja.',
      );
    }

    const solicitud =
      await this.solicitudBajaRepository.findOne({
        where: {
          id_solicitud: idSolicitud,
        },
      });

    if (!solicitud) {
      throw new NotFoundException(
        'La solicitud de baja no existe.',
      );
    }

    if (solicitud.estado === 'procesada') {
      throw new ConflictException(
        'Esta solicitud ya fue procesada.',
      );
    }

    if (solicitud.estado === 'cancelada') {
      throw new ConflictException(
        'Una solicitud cancelada no puede procesarse.',
      );
    }

    solicitud.estado = 'procesada';
    solicitud.processed_at = new Date();
    solicitud.id_admin_procesado =
      Number(usuario.sub);

    const actualizada =
      await this.solicitudBajaRepository.save(
        solicitud,
      );

    return {
      message: 'Solicitud de baja procesada correctamente.',
      solicitud: actualizada,
    };
  }
}