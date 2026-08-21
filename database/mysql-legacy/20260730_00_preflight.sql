-- No debe devolver filas antes de crear el índice único de pagos.
SELECT referencia_externa, COUNT(*) AS cantidad
FROM pago
WHERE referencia_externa IS NOT NULL AND referencia_externa <> ''
GROUP BY referencia_externa
HAVING COUNT(*) > 1;

-- Revisar usuarios cuyo email difiere solo por mayúsculas/espacios.
SELECT LOWER(TRIM(email_usuario)) AS email_normalizado, COUNT(*) AS cantidad
FROM `user`
GROUP BY LOWER(TRIM(email_usuario))
HAVING COUNT(*) > 1;

-- Reservas solapadas existentes (revisión manual; pueden ser históricas canceladas).
SELECT r1.id_reserva AS reserva_1, r2.id_reserva AS reserva_2,
       r1.id_cancha, r1.fecha, r1.hora_inicio, r1.hora_fin,
       r2.hora_inicio AS hora_inicio_2, r2.hora_fin AS hora_fin_2
FROM reserva r1
JOIN reserva r2
  ON r1.id_cancha = r2.id_cancha
 AND r1.fecha = r2.fecha
 AND r1.id_reserva < r2.id_reserva
 AND r1.estado <> 'cancelada'
 AND r2.estado <> 'cancelada'
 AND r1.hora_inicio < r2.hora_fin
 AND r1.hora_fin > r2.hora_inicio;
