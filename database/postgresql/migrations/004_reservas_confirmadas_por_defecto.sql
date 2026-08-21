-- DameCancha: las reservas realizadas por usuarios se confirman automáticamente.
-- No existe un flujo de aprobación manual por parte del club.

UPDATE reserva
SET estado = 'confirmada'
WHERE estado = 'pendiente';

ALTER TABLE reserva
  ALTER COLUMN estado SET DEFAULT 'confirmada';
