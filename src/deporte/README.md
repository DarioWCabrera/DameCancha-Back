# Módulo Deporte

Este módulo gestiona el catálogo de deportes disponibles en la plataforma (Fútbol, Tenis, Pádel, etc.).

## Archivos y Funciones

- **deporte.controller.ts**: Expone los endpoints para listar los deportes, crear nuevos tipos de deportes o modificar los existentes.
- **deporte.module.ts**: Configura la inyección de dependencias para el módulo de deportes.
- **deporte.service.ts**: Contiene la lógica para interactuar con la tabla de deportes, permitiendo su gestión administrativa.

### Carpeta `dto`
- **create-deporte.dto.ts**: Define el esquema para crear un deporte (ej. nombre del deporte).
- **update-deporte.dto.ts**: Define los campos actualizables de un deporte.

### Carpeta `entities`
- **deporte.entity.ts**: Representa la entidad `Deporte` en la base de datos, utilizada para clasificar las canchas.
