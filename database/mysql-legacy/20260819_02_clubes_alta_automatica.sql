-- DameCancha V4.2 - alta automática de clubes
-- Nueva política: un club puede registrarse e ingresar sin aprobación previa.
-- El administrador conserva la capacidad de inactivar/reactivar clubes.

START TRANSACTION;

UPDATE `user`
SET `estado_usuario` = 'activo'
WHERE `tipo_usuario` = 'dueno'
  AND `estado_usuario` = 'pendiente_aprobacion';

UPDATE `club`
SET `estado` = 'activo'
WHERE `estado` = 'pendiente_aprobacion';

ALTER TABLE `user`
  MODIFY `estado_usuario` ENUM('activo','inactivo','pendiente_aprobacion')
  NOT NULL DEFAULT 'activo';

ALTER TABLE `club`
  MODIFY `estado` ENUM('activo','inactivo','pendiente_aprobacion')
  NOT NULL DEFAULT 'activo';

COMMIT;
