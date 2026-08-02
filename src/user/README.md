# Módulo Dueño de Cancha

Este módulo gestiona la información de los propietarios de los clubes y canchas.

## Archivos y Funciones

- **dueno_cancha.controller.ts**: Define los endpoints para el registro, login y gestión del perfil de los dueños de canchas.
- **dueno_cancha.module.ts**: Configura el módulo de dueños, incluyendo la seguridad y el acceso a los repositorios correspondientes.
- **dueno_cancha.service.ts**: Contiene la lógica compleja para el manejo de dueños, incluyendo validaciones de cuenta, estados de pago y vinculación con clubes.

### Carpeta `dto`
- **create-dueno_cancha.dto.ts**: Datos requeridos para registrar un nuevo dueño (nombre, apellido, email, contraseña, etc.).
- **update-dueno_cancha.dto.ts**: Datos permitidos para actualizar el perfil de un dueño.

### Carpeta `entities`
- **dueno_cancha.entity.ts**: Estructura de la tabla `dueno_cancha` que almacena los datos personales y de acceso de los propietarios.

