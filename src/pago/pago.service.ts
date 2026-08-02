import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, timingSafeEqual } from 'crypto';
import { DataSource, Repository } from 'typeorm';

import { CreatePagoDto } from './dto/create-pago.dto';
import { UpdatePagoDto } from './dto/update-pago.dto';
import { Pago } from './entities/pago.entity';
import { Reserva } from '../reserva/entities/reserva.entity';

type WebhookInput = {
  dataId?: string;
  type?: string;
  xSignature?: string;
  xRequestId?: string;
};

@Injectable()
export class PagoService {
  private readonly logger = new Logger(PagoService.name);
  private readonly mercadoPagoTimeoutMs = 10_000;

  constructor(
    @InjectRepository(Pago)
    private readonly pagoRepository: Repository<Pago>,

    @InjectRepository(Reserva)
    private readonly reservaRepository: Repository<Reserva>,

    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  /*
    CRUD existente.
  */
  async create(createPagoDto: CreatePagoDto) {
    const pago = this.pagoRepository.create(createPagoDto);
    return this.pagoRepository.save(pago);
  }

  findAll() {
    return this.pagoRepository.find({
      relations: ['reserva'],
      order: { id_pago: 'DESC' },
    });
  }

  async findOne(id: number) {
    const pago = await this.pagoRepository.findOne({
      where: { id_pago: id },
      relations: ['reserva'],
    });

    if (!pago) throw new NotFoundException('Pago no encontrado.');
    return pago;
  }

  async update(id: number, updatePagoDto: UpdatePagoDto) {
    const pago = await this.findOne(id);
    Object.assign(pago, updatePagoDto);
    return this.pagoRepository.save(pago);
  }

  async remove(id: number) {
    const pago = await this.findOne(id);
    await this.pagoRepository.remove(pago);
    return { message: 'Pago eliminado correctamente.' };
  }

  private obtenerAccessToken(): string {
    const token = this.configService.get<string>('MERCADOPAGO_ACCESS_TOKEN');

    if (!token) {
      throw new BadRequestException(
        'Falta configurar MERCADOPAGO_ACCESS_TOKEN en el backend.',
      );
    }

    return token;
  }

  private obtenerFrontendUrl(): string {
    return (
      this.configService.get<string>('FRONTEND_URL') ||
      'http://localhost:5173'
    ).replace(/\/$/, '');
  }

  private obtenerBackendPublicUrl(): string {
    const url = this.configService.get<string>('BACKEND_PUBLIC_URL');

    if (!url) {
      throw new BadRequestException(
        'Falta configurar BACKEND_PUBLIC_URL con una URL HTTPS pública, por ejemplo la URL de ngrok.',
      );
    }

    return url.replace(/\/$/, '');
  }

  private async buscarReservaCompleta(idReserva: number): Promise<Reserva> {
    const reserva = await this.reservaRepository.findOne({
      where: { id_reserva: idReserva },
      relations: [
        'usuario',
        'cancha',
        'cancha.id_club',
        'cancha.id_deporte',
      ],
    });

    if (!reserva) {
      throw new NotFoundException('Reserva no encontrada.');
    }

    return reserva;
  }

  private normalizarMonto(valor: unknown): number {
    const monto = Number(valor);

    if (!Number.isFinite(monto)) return 0;

    return Math.round(monto * 100) / 100;
  }

  private mapearEstadoReservaPago(status: string): Reserva['estado_pago'] {
    if (status === 'approved') return 'pagado';

    if (
      status === 'rejected' ||
      status === 'cancelled' ||
      status === 'refunded' ||
      status === 'charged_back'
    ) {
      return 'rechazado';
    }

    return 'pendiente';
  }

  private mapearEstadoEntidadPago(status: string): Pago['estado'] {
    if (status === 'approved') return 'completado';

    if (
      status === 'rejected' ||
      status === 'cancelled' ||
      status === 'refunded' ||
      status === 'charged_back'
    ) {
      return 'rechazado';
    }

    return 'pendiente';
  }

  private async consultarPreferenciaMercadoPago(preferenceId: string) {
    const response = await fetch(
      `https://api.mercadopago.com/checkout/preferences/${encodeURIComponent(preferenceId)}`,
      {
        headers: {
          Authorization: `Bearer ${this.obtenerAccessToken()}`,
        },
        signal: AbortSignal.timeout(this.mercadoPagoTimeoutMs),
      },
    );

    if (!response.ok) return null;
    return response.json();
  }

  private construirRespuestaPreferencia(
    reserva: Reserva,
    data: Record<string, any>,
    monto: number,
  ) {
    const usarSandbox =
      this.configService.get<string>('MERCADOPAGO_USE_SANDBOX') === 'true';

    return {
      reservaId: reserva.id_reserva,
      preferenceId: data.id,
      amount: monto,
      checkout_url: usarSandbox
        ? data.sandbox_init_point || data.init_point
        : data.init_point || data.sandbox_init_point,
      init_point: data.init_point,
      sandbox_init_point: data.sandbox_init_point,
    };
  }

  /*
    Crea una preferencia real de Mercado Pago Checkout Pro.
  */
  async crearPreferenciaMercadoPago(idReserva: number) {
    const reserva = await this.buscarReservaCompleta(idReserva);

    if (reserva.estado === 'cancelada') {
      throw new BadRequestException(
        'No se puede pagar una reserva cancelada.',
      );
    }

    if (
      reserva.estado_pago === 'pagado' ||
      reserva.estado_pago === 'pago_en_club'
    ) {
      throw new BadRequestException(
        'La reserva ya se encuentra pagada.',
      );
    }

    const monto = this.normalizarMonto(reserva.monto_total);

    if (monto <= 0) {
      throw new BadRequestException(
        'La reserva no tiene un monto válido para cobrar.',
      );
    }

    // Reutiliza la preferencia ya creada para impedir cobros duplicados por
    // doble clic, reintentos de red o recargas de la pantalla.
    if (reserva.mercado_pago_preference_id) {
      const existente = await this.consultarPreferenciaMercadoPago(
        reserva.mercado_pago_preference_id,
      );
      if (existente?.id) {
        return this.construirRespuestaPreferencia(reserva, existente, monto);
      }
    }

    const accessToken = this.obtenerAccessToken();
    const backendPublicUrl = this.obtenerBackendPublicUrl();

    const preferencePayload = {
      items: [
        {
          id: String(reserva.id_reserva),
          title: `Reserva DameCancha #${reserva.id_reserva}`,
          description: [
            reserva.cancha?.nombre_cancha || 'Cancha',
            reserva.cancha?.id_club?.nombre_club || 'Club',
            String(reserva.fecha),
            reserva.hora_inicio?.slice(0, 5),
          ]
            .filter(Boolean)
            .join(' - '),
          quantity: 1,
          currency_id: 'ARS',
          unit_price: monto,
        },
      ],
      payer: {
        name: reserva.usuario?.nombre_usuario || '',
        surname: reserva.usuario?.apellido_usuario || '',
        email: reserva.usuario?.email_usuario || '',
      },
      external_reference: String(reserva.id_reserva),
      statement_descriptor: 'DAMECANCHA',
      /*
        Mercado Pago exige URLs públicas HTTPS para back_urls.
        Usamos el backend público como puente y luego el controller
        redirige al frontend local.
      */
      back_urls: {
        success: `${backendPublicUrl}/pago/mercadopago/retorno?payment=success&reservaId=${reserva.id_reserva}`,
        failure: `${backendPublicUrl}/pago/mercadopago/retorno?payment=failure&reservaId=${reserva.id_reserva}`,
        pending: `${backendPublicUrl}/pago/mercadopago/retorno?payment=pending&reservaId=${reserva.id_reserva}`,
      },
      auto_return: 'approved',
      notification_url: `${backendPublicUrl}/pago/mercadopago/webhook`,
      metadata: {
        reserva_id: reserva.id_reserva,
        usuario_id: reserva.usuario?.id_usuario,
        cancha_id: reserva.cancha?.id_cancha,
      },
    };

    const response = await fetch(
      'https://api.mercadopago.com/checkout/preferences',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `damecancha-reserva-${reserva.id_reserva}-${Math.round(monto * 100)}`,
        },
        body: JSON.stringify(preferencePayload),
        signal: AbortSignal.timeout(this.mercadoPagoTimeoutMs),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      this.logger.error(
        `Mercado Pago rechazó la creación de una preferencia (HTTP ${response.status}).`,
      );

      throw new BadRequestException(
        data?.message ||
          'Mercado Pago no pudo crear la preferencia de pago.',
      );
    }

    reserva.mercado_pago_preference_id = data.id || null;
    reserva.mercado_pago_status = 'preference_created';
    reserva.estado_pago = 'pendiente';

    await this.reservaRepository.save(reserva);

    return this.construirRespuestaPreferencia(reserva, data, monto);
  }

  /*
    Valida x-signature si MERCADOPAGO_WEBHOOK_SECRET está configurado.
    En producción la variable debe ser obligatoria.
  */
  private validarFirmaWebhook({
    dataId,
    xSignature,
    xRequestId,
  }: {
    dataId: string;
    xSignature?: string;
    xRequestId?: string;
  }) {
    const secret = this.configService.get<string>(
      'MERCADOPAGO_WEBHOOK_SECRET',
    );

    if (!secret) {
      this.logger.warn(
        'MERCADOPAGO_WEBHOOK_SECRET no está configurado. El webhook se procesa sin validación de firma.',
      );
      return;
    }

    if (!xSignature || !xRequestId) {
      throw new UnauthorizedException(
        'La notificación no contiene la firma requerida.',
      );
    }

    const partes = Object.fromEntries(
      xSignature.split(',').map((parte) => {
        const [clave, valor] = parte.trim().split('=');
        return [clave, valor];
      }),
    );

    const ts = partes.ts;
    const firmaRecibida = partes.v1;

    if (!ts || !firmaRecibida) {
      throw new UnauthorizedException(
        'Firma de webhook inválida.',
      );
    }

    const idNormalizado = String(dataId).toLowerCase();
    const manifest = `id:${idNormalizado};request-id:${xRequestId};ts:${ts};`;

    const firmaEsperada = createHmac('sha256', secret)
      .update(manifest)
      .digest('hex');

    const recibidaBuffer = Buffer.from(firmaRecibida, 'hex');
    const esperadaBuffer = Buffer.from(firmaEsperada, 'hex');

    if (
      recibidaBuffer.length !== esperadaBuffer.length ||
      !timingSafeEqual(recibidaBuffer, esperadaBuffer)
    ) {
      throw new UnauthorizedException(
        'La firma del webhook no es válida.',
      );
    }
  }

  private async consultarPagoMercadoPago(paymentId: string) {
    const accessToken = this.obtenerAccessToken();

    const response = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        signal: AbortSignal.timeout(this.mercadoPagoTimeoutMs),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      this.logger.error(
        `Mercado Pago rechazó la consulta de un pago (HTTP ${response.status}).`,
      );

      throw new BadRequestException(
        data?.message ||
          'No se pudo consultar el pago en Mercado Pago.',
      );
    }

    return data;
  }

  private async persistirResultadoPago(payment: Record<string, any>) {
    const idReserva = Number(
      payment?.external_reference || payment?.metadata?.reserva_id,
    );

    if (!Number.isInteger(idReserva) || idReserva <= 0) {
      throw new BadRequestException(
        'El pago no contiene una referencia de reserva válida.',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const reservaRepository = manager.getRepository(Reserva);
      const pagoRepository = manager.getRepository(Pago);

      const reserva = await reservaRepository
        .createQueryBuilder('reserva')
        .setLock('pessimistic_write')
        .leftJoinAndSelect('reserva.usuario', 'usuario')
        .leftJoinAndSelect('reserva.cancha', 'cancha')
        .leftJoinAndSelect('cancha.id_club', 'club')
        .where('reserva.id_reserva = :idReserva', { idReserva })
        .getOne();

      if (!reserva) throw new NotFoundException('Reserva no encontrada.');

      const montoEsperado = this.normalizarMonto(reserva.monto_total);
      const montoRecibido = this.normalizarMonto(payment?.transaction_amount);
      const status = String(payment?.status || 'pending');
      const paymentId = String(payment?.id || '');

      if (!paymentId) {
        throw new BadRequestException('Mercado Pago no informó un payment_id.');
      }

      if (
        status === 'approved' &&
        Math.abs(montoEsperado - montoRecibido) > 0.01
      ) {
        this.logger.error(
          `El pago ${paymentId} informó un monto distinto para la reserva ${idReserva}.`,
        );
        throw new BadRequestException(
          'El monto aprobado no coincide con el monto de la reserva.',
        );
      }

      reserva.estado_pago = this.mapearEstadoReservaPago(status);
      reserva.mercado_pago_payment_id = paymentId;
      reserva.mercado_pago_status = status;
      reserva.monto_pagado = status === 'approved' ? montoRecibido : null;
      reserva.fecha_pago =
        status === 'approved'
          ? new Date(payment?.date_approved || Date.now())
          : null;

      await reservaRepository.save(reserva);

      let pago = await pagoRepository.findOne({
        where: { referencia_externa: paymentId },
        relations: ['reserva'],
      });

      const datosPago = {
        monto: montoRecibido || montoEsperado,
        metodo: 'mercado_pago',
        estado: this.mapearEstadoEntidadPago(status),
        referencia_externa: paymentId,
        fecha_pago:
          status === 'approved'
            ? new Date(payment?.date_approved || Date.now())
            : null,
        reserva,
      } as Partial<Pago>;

      if (!pago) pago = pagoRepository.create(datosPago);
      else Object.assign(pago, datosPago);

      await pagoRepository.save(pago);

      return {
        id_reserva: reserva.id_reserva,
        estado_pago: reserva.estado_pago,
        mercado_pago_status: reserva.mercado_pago_status,
        mercado_pago_payment_id: reserva.mercado_pago_payment_id,
        monto_pagado: reserva.monto_pagado,
        fecha_pago: reserva.fecha_pago,
      };
    });
  }

  construirUrlRetornoFrontend(
    payment: string,
    reservaId?: string | number,
  ): string {
    const frontendUrl = this.obtenerFrontendUrl();
    const estadoPermitido = ['success', 'failure', 'pending'].includes(payment)
      ? payment
      : 'pending';

    const params = new URLSearchParams({
      payment: estadoPermitido,
    });

    if (reservaId !== undefined && reservaId !== null && String(reservaId)) {
      params.set('reservaId', String(reservaId));
    }

    return `${frontendUrl}/dashboardUsuario?${params.toString()}`;
  }

  async procesarWebhookMercadoPago(input: WebhookInput) {
    const { dataId, type, xSignature, xRequestId } = input;

    /*
      Checkout Pro envía notificaciones del tópico payment.
      Otros tópicos se aceptan con 200 pero no modifican reservas.
    */
    if (type && type !== 'payment') {
      return {
        received: true,
        ignored: true,
        type,
      };
    }

    if (!dataId) {
      return {
        received: true,
        ignored: true,
        reason: 'La notificación no contiene data.id.',
      };
    }

    this.validarFirmaWebhook({
      dataId,
      xSignature,
      xRequestId,
    });

    const payment = await this.consultarPagoMercadoPago(dataId);
    const resultado = await this.persistirResultadoPago(payment);

    return {
      received: true,
      ...resultado,
    };
  }

  async obtenerEstadoMercadoPago(idReserva: number) {
    let reserva = await this.buscarReservaCompleta(idReserva);

    /*
      Si ya tenemos un payment_id, consultamos nuevamente a Mercado Pago.
      Esto permite recuperar el estado aunque el webhook se demore.
    */
    if (
      reserva.mercado_pago_payment_id &&
      reserva.estado_pago !== 'pagado'
    ) {
      try {
        const payment = await this.consultarPagoMercadoPago(
          reserva.mercado_pago_payment_id,
        );

        await this.persistirResultadoPago(payment);
        reserva = await this.buscarReservaCompleta(idReserva);
      } catch (error) {
        this.logger.warn(
          `No se pudo resincronizar el pago de la reserva ${idReserva}. Se devuelve el estado persistido.`,
        );
      }
    }

    return {
      id_reserva: reserva.id_reserva,
      estado_pago: reserva.estado_pago,
      mercado_pago_status: reserva.mercado_pago_status,
      mercado_pago_payment_id: reserva.mercado_pago_payment_id,
      monto_pagado: reserva.monto_pagado,
      fecha_pago: reserva.fecha_pago,
    };
  }
}
