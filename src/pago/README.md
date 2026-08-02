# Módulo Pago

Este módulo se encarga del registro y seguimiento de los pagos realizados, tanto por suscripciones de clubes como por otros servicios.

## Archivos y Funciones

- **pago.controller.ts**: Gestiona las solicitudes relacionadas con transacciones de pago.
- **pago.module.ts**: Configura la inyección de dependencias para el procesamiento de pagos.
- **pago.service.ts**: Contiene la lógica para registrar pagos en el sistema y verificar su estado.

### Carpeta `dto`
- **create-pago.dto.ts**: Esquema para registrar un nuevo pago (monto, fecha, referencia, etc.).
- **update-pago.dto.ts**: Esquema para actualizar información de un pago.

### Carpeta `entities`
- **pago.entity.ts**: Modelo de la tabla `pago` que registra el historial financiero del sistema.


