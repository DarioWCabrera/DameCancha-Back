# Código Fuente del Backend (src)

Esta carpeta contiene el núcleo de la aplicación NestJS y los módulos que componen el sistema.

## Archivos Principales

- **main.ts**: Es el punto de entrada de la aplicación. Aquí se inicializa el servidor NestJS, se configuran los prefijos globales de la API (`/api`) y se habilita el CORS para permitir peticiones desde el frontend.
- **app.module.ts**: Es el módulo raíz de la aplicación. Aquí se importan todos los demás módulos (Admin, Club, Cancha, etc.) y se configura la conexión global a la base de datos mediante TypeORM.
- **app.controller.ts**: Controlador básico que suele utilizarse para pruebas de conectividad inicial o rutas de salud del sistema.
- **app.service.ts**: Servicio básico asociado al controlador raíz.
- **generate.js**: Script de utilidad, posiblemente utilizado para la generación de datos de prueba o configuración inicial.

## Módulos del Sistema

Cada carpeta dentro de `src` representa un módulo funcional del backend:

- **admin**: Gestión de administradores.
- **cancha**: Gestión de canchas individuales.
- **club**: Gestión de complejos deportivos (clubes).
- **cron**: Tareas automáticas programadas.
- **deporte**: Catálogo de tipos de deportes.
- **disponibilidad**: Gestión de horarios de canchas.
- **dueno_cancha**: Gestión de los propietarios de clubes.
- **pago**: Registro de transacciones financieras.
- **reserva**: Sistema central de reservas.
- **usuario**: Gestión de clientes finales.
