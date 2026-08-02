# Módulo Disponibilidad

Este módulo gestiona los horarios en los que una cancha está disponible para ser reservada.

## Archivos y Funciones

- **disponibilidad.controller.ts**: Define las rutas para crear, consultar y actualizar los horarios de disponibilidad de las canchas.
- **disponibilidad.module.ts**: Gestiona las dependencias y la integración del módulo de disponibilidad en el sistema.
- **disponibilidad.service.ts**: Contiene la lógica para verificar y asignar bloques horarios a las canchas.

### Carpeta `dto`
- **create-disponibilidad.dto.ts**: Define la estructura de datos para establecer un nuevo horario de disponibilidad (hora inicio, hora fin, día, etc.).
- **update-disponibilidad.dto.ts**: Define los datos necesarios para modificar un horario existente.

### Carpeta `entities`
- **disponibilidad.entity.ts**: Define la tabla de disponibilidad, vinculando rangos horarios con canchas específicas.
