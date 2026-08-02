# Corrección de compilación

Esta versión corrige los 16 errores reportados al ejecutar `npm run start:dev`:

- helper de uploads faltante;
- tipos de `Express.Multer.File`;
- tipo de expiración JWT;
- nulabilidad de `CUIT_usuario`.

Validar localmente con:

```bash
npm run build
npm run start:dev
```
