# Base de datos DameCancha V5

DameCancha V5 utiliza **PostgreSQL**.

- `postgresql/migrations/`: migraciones vigentes. Ejecutar con `npm run db:migrate`.
- `mysql-legacy/`: scripts históricos de la etapa MySQL. Se conservan solo como referencia y **no deben ejecutarse en Neon**.

La aplicación usa `DATABASE_URL`. En producción `DB_SYNC` debe permanecer en `false`.
