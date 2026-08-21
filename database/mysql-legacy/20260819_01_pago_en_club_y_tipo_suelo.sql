-- DameCancha - pago presencial y persistencia de tipo de suelo
-- Fecha: 2026-08-19
-- Ejecutar una sola vez en staging/producción antes de desplegar esta versión.
-- En desarrollo con DB_SYNC=true TypeORM puede crear tipo_suelo automáticamente,
-- pero este script deja el cambio reproducible para producción.

START TRANSACTION;

-- Agrega tipo_suelo solo si todavía no existe.
SET @col_tipo_suelo := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'cancha'
    AND COLUMN_NAME = 'tipo_suelo'
);

SET @sql_tipo_suelo := IF(
  @col_tipo_suelo = 0,
  'ALTER TABLE `cancha` ADD COLUMN `tipo_suelo` VARCHAR(80) NULL AFTER `descripcion_cancha`',
  'SELECT 1'
);

PREPARE stmt_tipo_suelo FROM @sql_tipo_suelo;
EXECUTE stmt_tipo_suelo;
DEALLOCATE PREPARE stmt_tipo_suelo;

-- Alinea el valor por defecto de la base con la nueva regla comercial.
ALTER TABLE `reserva`
  MODIFY COLUMN `estado_pago`
  ENUM('pendiente', 'pagado', 'pago_en_club', 'rechazado')
  NOT NULL DEFAULT 'pago_en_club';

-- Las reservas que todavía no tenían un pago real registrado pasan a modalidad
-- "pago en club". Las históricas que ya estaban pagadas se conservan intactas.
UPDATE `reserva`
SET `estado_pago` = 'pago_en_club'
WHERE `estado_pago` IN ('pendiente', 'rechazado')
  AND `mercado_pago_payment_id` IS NULL
  AND `estado` IN ('pendiente', 'confirmada');

COMMIT;
