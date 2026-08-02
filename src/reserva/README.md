# Módulo Reserva

Este es uno de los módulos centrales del sistema, encargado de gestionar las reservas de canchas por parte de los usuarios.

## Archivos y Funciones

- **reserva.controller.ts**: Expone los endpoints para realizar reservas, cancelarlas y consultar el historial de reservas.
- **reserva.module.ts**: Integra los componentes necesarios para el flujo de reservas, incluyendo el acceso a canchas y usuarios.
- **reserva.service.ts**: Contiene la lógica crítica para evitar solapamientos de horarios, validar la disponibilidad de la cancha y procesar la creación de reservas.

### Carpeta `dto`
- **create-reserva.dto.ts**: Define los datos necesarios para una reserva (ID de cancha, fecha, hora, usuario, etc.).
- **update-reserva.dto.ts**: Define qué campos pueden modificarse en una reserva existente.

### Carpeta `entities`
- **reserva.entity.ts**: Representa la tabla `reserva` en la base de datos, con relaciones hacia `Usuario` y `Cancha`.
