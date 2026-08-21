-- Catálogo base requerido por el registro de clubes y el banco de suplentes.
INSERT INTO deporte (nombre_deporte, descripcion_deporte)
SELECT v.nombre, v.descripcion
FROM (VALUES
  ('Fútbol 5',  'Fútbol 5 vs 5'),
  ('Fútbol 7',  'Fútbol 7 vs 7'),
  ('Fútbol 11', 'Fútbol 11 vs 11'),
  ('Básquet',    'Básquetbol'),
  ('Tenis',      'Tenis individual'),
  ('Vóley',      'Voleibol'),
  ('Pádel',      'Pádel tenis'),
  ('Natación',   'Natación'),
  ('Golf',       'Golf')
) AS v(nombre, descripcion)
WHERE NOT EXISTS (
  SELECT 1 FROM deporte d WHERE LOWER(d.nombre_deporte) = LOWER(v.nombre)
);
