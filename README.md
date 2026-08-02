# DameCancha — backend

API REST construida con NestJS, TypeORM y MySQL para usuarios, clubes, canchas, disponibilidades, bloqueos, reservas, pagos, torneos y banco de suplentes.

## Requisitos

- Node.js 22
- MySQL 8 compatible
- Variables definidas a partir de `.env.example`

## Desarrollo local

```bash
cp .env.example .env
npm ci
npm run start:dev
```

Para desarrollo inicial puede utilizarse `DB_SYNC=true`. No utilizar sincronización automática en producción.

## Validación

```bash
npm ci
npm run lint
npm run build
npm run test:ci
```

## Producción

```bash
npm run build
NODE_ENV=production npm run start:prod
```

También se incluye un `Dockerfile` multietapa. El servicio publica:

- `GET /` — identificación básica
- `GET /health` — verificación operativa

## Base de datos

Los scripts de endurecimiento están en `database/migrations/`. Deben probarse primero en staging y ejecutarse solamente después de un backup verificado.

## Archivos subidos

`UPLOAD_DIR` debe apuntar a almacenamiento persistente. Un disco efímero puede borrar logos y flyers al reiniciar o redeployar el servicio.

## Secretos

No subir al repositorio:

- `JWT_SECRET`
- credenciales MySQL
- credenciales SMTP
- Access Token o secreto de webhook de Mercado Pago
- certificados o claves privadas

## Preproducción

Leer `PREPRODUCCION.md` y el paquete de auditoría. No habilitar cobros reales hasta resolver la política de modificación, cancelación y reembolso de reservas pagadas.
