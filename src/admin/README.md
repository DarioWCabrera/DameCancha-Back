# Módulo Admin

Este módulo se encarga de la gestión de los administradores del sistema.

## Archivos y Funciones

- **admin.controller.ts**: Define los puntos de entrada (endpoints) de la API para las operaciones relacionadas con los administradores, como la creación, consulta, actualización y eliminación.
- **admin.module.ts**: Organiza y agrupa los componentes del módulo (controlador, servicio y entidades) para su integración en la aplicación principal de NestJS.
- **admin.service.ts**: Contiene la lógica de negocio para gestionar los datos de los administradores, interactuando con la base de datos a través de TypeORM.

### Carpeta `dto` (Data Transfer Objects)
- **create-admin.dto.ts**: Define la estructura y las reglas de validación para los datos enviados al crear un nuevo administrador.
- **update-admin.dto.ts**: Define la estructura y validaciones para actualizar la información de un administrador existente.

### Carpeta `entities`
- **admin.entity.ts**: Define el modelo de datos de la tabla `admin` en la base de datos, especificando las columnas y sus tipos.
