# Módulo Club

Este módulo gestiona la información de los clubes registrados en la plataforma.

## Archivos y Funciones

- **club.controller.ts**: Define las rutas para gestionar clubes, permitiendo su creación, actualización y consulta por ID o por dueño.
- **club.module.ts**: Integra el controlador y el servicio del club, y registra los repositorios de `Club` y `DuenoCancha`.
- **club.service.ts**: Contiene la lógica para operar sobre los clubes, incluyendo una función especial para crear un club asociado directamente a un dueño de cancha.

### Carpeta `dto`
- **create-club.dto.ts**: Define el esquema de datos para registrar un club (nombre, dirección, ciudad, etc.).
- **update-club.dto.ts**: Define los campos que pueden ser modificados en un club.

### Carpeta `entities`
- **club.entity.ts**: Estructura de la tabla `club` en la base de datos, con una relación de muchos a uno hacia `DuenoCancha` y uno a muchos hacia `Cancha`.
