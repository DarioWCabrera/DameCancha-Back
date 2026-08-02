# Estado de preproducción del backend

Esta copia forma parte de la auditoría del 30/07/2026.

## Antes de publicar

```bash
cp .env.example .env
npm ci
npm run lint
npm run build
npm run test:ci
```

En producción:

- `NODE_ENV=production`;
- `DB_SYNC=false`;
- URLs HTTPS;
- CORS restringido;
- secretos rotados;
- `UPLOAD_DIR` persistente;
- webhook de Mercado Pago firmado;
- backup y migración probados en staging.

## Base

Ejecutar primero `database/migrations/20260730_00_preflight.sql`. Resolver cualquier fila devuelta antes de ejecutar `20260730_01_preproduction_hardening.sql`.

## Restricción

No aceptar pagos reales hasta resolver y probar modificación, cancelación y reembolso de reservas pagadas.
