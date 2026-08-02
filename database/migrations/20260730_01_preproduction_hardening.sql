-- DameCancha - endurecimiento inicial de preproducción
-- Ejecutar UNA sola vez sobre una copia respaldada de la base existente.
-- Antes de ejecutar, correr 20260730_00_preflight.sql y resolver duplicados.

START TRANSACTION;

ALTER TABLE `user`
  MODIFY COLUMN `password_reset_code` VARCHAR(64) NULL,
  ADD COLUMN `password_reset_attempts` TINYINT NOT NULL DEFAULT 0 AFTER `password_reset_expires`;

CREATE INDEX `idx_user_tipo_estado`
  ON `user` (`tipo_usuario`, `estado_usuario`);
CREATE INDEX `idx_club_estado`
  ON `club` (`estado`);
CREATE INDEX `idx_cancha_activa`
  ON `cancha` (`activa`);
CREATE INDEX `idx_reserva_cancha_fecha_estado_horas`
  ON `reserva` (`id_cancha`, `fecha`, `estado`, `hora_inicio`, `hora_fin`);
CREATE INDEX `idx_reserva_usuario_fecha`
  ON `reserva` (`id_usuario`, `fecha`, `hora_inicio`);
CREATE INDEX `idx_reserva_estado_pago`
  ON `reserva` (`estado_pago`);
CREATE UNIQUE INDEX `ux_pago_referencia_externa`
  ON `pago` (`referencia_externa`);
CREATE INDEX `idx_disponibilidad_cancha_dia_horas`
  ON `disponibilidad` (`id_cancha`, `dia_semana`, `hora_inicio`, `hora_fin`);
CREATE INDEX `idx_bloqueo_cancha_fecha_activo_horas`
  ON `bloqueo_cancha` (`id_cancha`, `fecha`, `activo`, `hora_inicio`, `hora_fin`);
CREATE INDEX `idx_torneo_club_estado_fecha`
  ON `torneo` (`id_club`, `estado`, `fecha_inicio`);
CREATE INDEX `idx_disp_jugador_busqueda`
  ON `disponibilidad_jugador` (`id_deporte`, `estado`, `ciudad`, `fecha_desde`, `fecha_hasta`);
CREATE INDEX `idx_disp_jugador_usuario`
  ON `disponibilidad_jugador` (`id_usuario`, `estado`);
CREATE INDEX `idx_solicitud_disponibilidad_estado`
  ON `solicitud_jugador` (`id_disponibilidad`, `estado`);
CREATE INDEX `idx_solicitud_solicitante_estado`
  ON `solicitud_jugador` (`id_usuario_solicitante`, `estado`);

COMMIT;
