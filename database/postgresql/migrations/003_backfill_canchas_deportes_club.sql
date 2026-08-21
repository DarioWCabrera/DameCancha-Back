-- DameCancha V5.1
-- Repara clubes creados con deportes seleccionados pero sin filas de cancha.
-- La columna deportes_club se guarda como JSON serializado en TEXT por TypeORM simple-json.

-- 1) Asegurar que todos los deportes declarados por los clubes existan en el catálogo.
WITH club_sports AS (
  SELECT DISTINCT btrim(sport) AS sport
  FROM club c
  CROSS JOIN LATERAL jsonb_array_elements_text(c.deportes_club::jsonb) AS sport
  WHERE c.deportes_club IS NOT NULL
    AND btrim(c.deportes_club) <> ''
    AND left(ltrim(c.deportes_club), 1) = '['
)
INSERT INTO deporte (nombre_deporte, descripcion_deporte)
SELECT cs.sport, cs.sport
FROM club_sports cs
WHERE cs.sport <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM deporte d
    WHERE lower(d.nombre_deporte) = lower(cs.sport)
  );

-- 2) Crear una cancha inicial por cada deporte seleccionado cuando el club todavía
-- no tiene ninguna cancha activa para ese deporte.
WITH club_sports AS (
  SELECT
    c.id_club,
    c.nombre_club,
    c.direccion_club,
    c.ciudad_club,
    c.provincia_club,
    c.cp_club,
    btrim(sport) AS sport
  FROM club c
  CROSS JOIN LATERAL jsonb_array_elements_text(c.deportes_club::jsonb) AS sport
  WHERE c.deportes_club IS NOT NULL
    AND btrim(c.deportes_club) <> ''
    AND left(ltrim(c.deportes_club), 1) = '['
)
INSERT INTO cancha (
  nombre_cancha,
  descripcion_cancha,
  precio_por_hora,
  activa,
  direccion_cancha,
  ciudad_cancha,
  provincia_cancha,
  cp_cancha,
  id_club,
  id_deporte
)
SELECT
  'Cancha ' || d.nombre_deporte,
  'Cancha de ' || d.nombre_deporte || ' del club ' || cs.nombre_club,
  0,
  1,
  cs.direccion_club,
  cs.ciudad_club,
  cs.provincia_club,
  cs.cp_club,
  cs.id_club,
  d.id_deporte
FROM club_sports cs
JOIN deporte d
  ON lower(d.nombre_deporte) = lower(cs.sport)
WHERE cs.sport <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM cancha ca
    WHERE ca.id_club = cs.id_club
      AND ca.id_deporte = d.id_deporte
      AND ca.activa = 1
  );
