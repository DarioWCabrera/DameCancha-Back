# Módulo Cancha

Este módulo gestiona la información de las canchas individuales que pertenecen a los clubes.

## Archivos y Funciones

- **cancha.controller.ts**: Maneja las peticiones HTTP para crear, listar, buscar y actualizar canchas.
- **cancha.module.ts**: Configura el módulo, inyectando el repositorio de la entidad `Cancha` y definiendo proveedores.
- **cancha.service.ts**: Implementa la lógica para gestionar canchas, incluyendo la asociación con un club y un deporte específico.

### Carpeta `dto`
- **create-cancha.dto.ts**: Define los campos necesarios para registrar una nueva cancha (precio, tipo, club, deporte, etc.).
- **update-cancha.dto.ts**: Define los campos permitidos para actualizar la información de una cancha.

### Carpeta `entities`
- **cancha.entity.ts**: Representa la tabla de canchas en la base de datos, con relaciones hacia `Club` y `Deporte`.
