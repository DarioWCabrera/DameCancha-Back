-- DameCancha V5 - Esquema inicial PostgreSQL / Neon
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Base limpia. Ejecutar mediante: npm run db:migrate

CREATE TYPE user_estado_enum AS ENUM ('activo', 'inactivo', 'pendiente_aprobacion');
CREATE TYPE user_tipo_enum AS ENUM ('usuario', 'dueno', 'admin');
CREATE TYPE club_estado_enum AS ENUM ('activo', 'inactivo', 'pendiente_aprobacion');
CREATE TYPE reserva_estado_enum AS ENUM ('pendiente', 'confirmada', 'cancelada', 'completada');
CREATE TYPE reserva_estado_pago_enum AS ENUM ('pendiente', 'pagado', 'pago_en_club', 'rechazado');
CREATE TYPE pago_metodo_enum AS ENUM ('efectivo', 'tarjeta', 'transferencia', 'mercado_pago');
CREATE TYPE pago_estado_enum AS ENUM ('pendiente', 'completado', 'rechazado');
CREATE TYPE bloqueo_tipo_enum AS ENUM ('torneo', 'mantenimiento', 'evento', 'cierre', 'otro');
CREATE TYPE torneo_estado_enum AS ENUM ('borrador', 'publicado', 'finalizado', 'cancelado');
CREATE TYPE disponibilidad_jugador_estado_enum AS ENUM ('activa', 'pausada', 'vencida', 'eliminada');
CREATE TYPE solicitud_jugador_estado_enum AS ENUM ('pendiente', 'aceptada', 'rechazada', 'cancelada');

CREATE TABLE "user" (
  id_usuario SERIAL PRIMARY KEY,
  nombre_usuario VARCHAR(100) NOT NULL,
  apellido_usuario VARCHAR(100) NOT NULL,
  email_usuario VARCHAR(150) NOT NULL UNIQUE,
  dni_usuario VARCHAR(20) UNIQUE,
  "CUIT_usuario" VARCHAR(20) UNIQUE,
  password_usuario VARCHAR(255) NOT NULL,
  password_reset_code VARCHAR(64),
  password_reset_expires TIMESTAMPTZ,
  password_reset_attempts SMALLINT NOT NULL DEFAULT 0,
  telefono_usuario VARCHAR(20),
  direccion_usuario VARCHAR(255),
  ciudad_usuario VARCHAR(100),
  provincia_usuario VARCHAR(100),
  cp_usuario VARCHAR(20),
  estado_usuario user_estado_enum NOT NULL DEFAULT 'activo',
  tipo_usuario user_tipo_enum NOT NULL DEFAULT 'usuario',
  id_admin_aprobado INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_user_password_reset_attempts CHECK (password_reset_attempts >= 0),
  CONSTRAINT fk_user_admin FOREIGN KEY (id_admin_aprobado)
    REFERENCES "user"(id_usuario) ON DELETE SET NULL
);

CREATE TABLE deporte (
  id_deporte SERIAL PRIMARY KEY,
  nombre_deporte VARCHAR(100) NOT NULL,
  descripcion_deporte TEXT
);

CREATE TABLE club (
  id_club SERIAL PRIMARY KEY,
  nombre_club VARCHAR(150) NOT NULL,
  deportes_club TEXT,
  logo_club VARCHAR(255),
  direccion_club VARCHAR(255) NOT NULL,
  ciudad_club VARCHAR(100),
  provincia_club VARCHAR(100),
  cp_club VARCHAR(20),
  telefono_club VARCHAR(20),
  descripcion_club TEXT,
  servicios_club TEXT,
  estado club_estado_enum NOT NULL DEFAULT 'activo',
  id_dueno INTEGER,
  id_admin_aprobado INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_club_dueno FOREIGN KEY (id_dueno)
    REFERENCES "user"(id_usuario) ON DELETE CASCADE,
  CONSTRAINT fk_club_admin FOREIGN KEY (id_admin_aprobado)
    REFERENCES "user"(id_usuario) ON DELETE SET NULL
);

CREATE TABLE cancha (
  id_cancha SERIAL PRIMARY KEY,
  nombre_cancha VARCHAR(100) NOT NULL,
  descripcion_cancha TEXT,
  precio_por_hora NUMERIC(10,2) NOT NULL DEFAULT 0,
  tipo_suelo VARCHAR(80),
  activa SMALLINT NOT NULL DEFAULT 1,
  direccion_cancha VARCHAR(255),
  ciudad_cancha VARCHAR(100),
  provincia_cancha VARCHAR(100),
  cp_cancha VARCHAR(20),
  id_club INTEGER,
  id_deporte INTEGER,
  CONSTRAINT chk_cancha_activa CHECK (activa IN (0, 1)),
  CONSTRAINT chk_cancha_precio CHECK (precio_por_hora >= 0),
  CONSTRAINT fk_cancha_club FOREIGN KEY (id_club)
    REFERENCES club(id_club) ON DELETE CASCADE,
  CONSTRAINT fk_cancha_deporte FOREIGN KEY (id_deporte)
    REFERENCES deporte(id_deporte) ON DELETE CASCADE
);

CREATE TABLE disponibilidad (
  id_disponibilidad SERIAL PRIMARY KEY,
  dia_semana SMALLINT NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  id_cancha INTEGER,
  CONSTRAINT chk_disponibilidad_dia CHECK (dia_semana BETWEEN 0 AND 6),
  CONSTRAINT chk_disponibilidad_horas CHECK (hora_fin > hora_inicio),
  CONSTRAINT fk_disponibilidad_cancha FOREIGN KEY (id_cancha)
    REFERENCES cancha(id_cancha) ON DELETE CASCADE
);

CREATE TABLE reserva (
  id_reserva SERIAL PRIMARY KEY,
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  monto_total NUMERIC(10,2) NOT NULL,
  estado reserva_estado_enum NOT NULL DEFAULT 'pendiente',
  estado_pago reserva_estado_pago_enum NOT NULL DEFAULT 'pago_en_club',
  mercado_pago_preference_id VARCHAR(120),
  mercado_pago_payment_id VARCHAR(120),
  mercado_pago_status VARCHAR(80),
  monto_pagado NUMERIC(10,2),
  fecha_pago TIMESTAMPTZ,
  id_usuario INTEGER,
  id_cancha INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_reserva_horas CHECK (hora_fin > hora_inicio),
  CONSTRAINT chk_reserva_monto CHECK (monto_total >= 0),
  CONSTRAINT chk_reserva_monto_pagado CHECK (monto_pagado IS NULL OR monto_pagado >= 0),
  CONSTRAINT fk_reserva_usuario FOREIGN KEY (id_usuario)
    REFERENCES "user"(id_usuario) ON DELETE CASCADE,
  CONSTRAINT fk_reserva_cancha FOREIGN KEY (id_cancha)
    REFERENCES cancha(id_cancha) ON DELETE CASCADE
);

-- Se conserva por compatibilidad histórica aunque Mercado Pago ya no forme parte
-- del flujo activo de reservas.
CREATE TABLE pago (
  id_pago SERIAL PRIMARY KEY,
  monto NUMERIC(10,2) NOT NULL,
  metodo pago_metodo_enum NOT NULL,
  estado pago_estado_enum NOT NULL DEFAULT 'pendiente',
  referencia_externa VARCHAR(120),
  fecha_pago TIMESTAMPTZ,
  id_reserva INTEGER,
  CONSTRAINT chk_pago_monto CHECK (monto >= 0),
  CONSTRAINT fk_pago_reserva FOREIGN KEY (id_reserva)
    REFERENCES reserva(id_reserva) ON DELETE CASCADE
);

CREATE TABLE bloqueo_cancha (
  id_bloqueo SERIAL PRIMARY KEY,
  id_cancha INTEGER NOT NULL,
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  tipo bloqueo_tipo_enum NOT NULL DEFAULT 'otro',
  motivo VARCHAR(255),
  activo SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_bloqueo_activo CHECK (activo IN (0, 1)),
  CONSTRAINT chk_bloqueo_horas CHECK (hora_fin > hora_inicio),
  CONSTRAINT fk_bloqueo_cancha FOREIGN KEY (id_cancha)
    REFERENCES cancha(id_cancha) ON DELETE CASCADE
);

CREATE TABLE torneo (
  id_torneo SERIAL PRIMARY KEY,
  id_club INTEGER NOT NULL,
  id_deporte INTEGER NOT NULL,
  titulo VARCHAR(180) NOT NULL,
  descripcion TEXT NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  contacto VARCHAR(180),
  flyer_url VARCHAR(255) NOT NULL,
  estado torneo_estado_enum NOT NULL DEFAULT 'borrador',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_torneo_fechas CHECK (fecha_fin >= fecha_inicio),
  CONSTRAINT fk_torneo_club FOREIGN KEY (id_club)
    REFERENCES club(id_club) ON DELETE CASCADE,
  CONSTRAINT fk_torneo_deporte FOREIGN KEY (id_deporte)
    REFERENCES deporte(id_deporte) ON DELETE RESTRICT
);

CREATE TABLE disponibilidad_jugador (
  id_disponibilidad SERIAL PRIMARY KEY,
  id_usuario INTEGER NOT NULL,
  id_deporte INTEGER NOT NULL,
  nivel VARCHAR(60) NOT NULL,
  modalidad VARCHAR(80),
  posicion VARCHAR(80),
  ciudad VARCHAR(100) NOT NULL,
  dias_disponibles TEXT NOT NULL,
  hora_desde TIME NOT NULL,
  hora_hasta TIME NOT NULL,
  fecha_desde DATE NOT NULL,
  fecha_hasta DATE NOT NULL,
  descripcion TEXT NOT NULL,
  contacto_visible BOOLEAN NOT NULL DEFAULT FALSE,
  estado disponibilidad_jugador_estado_enum NOT NULL DEFAULT 'activa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_disp_jugador_horas CHECK (hora_hasta > hora_desde),
  CONSTRAINT chk_disp_jugador_fechas CHECK (fecha_hasta >= fecha_desde),
  CONSTRAINT fk_disp_jugador_usuario FOREIGN KEY (id_usuario)
    REFERENCES "user"(id_usuario) ON DELETE CASCADE,
  CONSTRAINT fk_disp_jugador_deporte FOREIGN KEY (id_deporte)
    REFERENCES deporte(id_deporte) ON DELETE RESTRICT
);

CREATE TABLE solicitud_jugador (
  id_solicitud SERIAL PRIMARY KEY,
  id_disponibilidad INTEGER NOT NULL,
  id_usuario_solicitante INTEGER NOT NULL,
  mensaje TEXT,
  fecha_propuesta DATE,
  hora_propuesta TIME,
  estado solicitud_jugador_estado_enum NOT NULL DEFAULT 'pendiente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_solicitud_disponibilidad FOREIGN KEY (id_disponibilidad)
    REFERENCES disponibilidad_jugador(id_disponibilidad) ON DELETE CASCADE,
  CONSTRAINT fk_solicitud_solicitante FOREIGN KEY (id_usuario_solicitante)
    REFERENCES "user"(id_usuario) ON DELETE CASCADE
);

-- Índices operativos
CREATE INDEX idx_user_tipo_estado ON "user" (tipo_usuario, estado_usuario);
CREATE INDEX idx_club_estado ON club (estado);
CREATE INDEX idx_club_dueno ON club (id_dueno);
CREATE INDEX idx_cancha_activa ON cancha (activa);
CREATE INDEX idx_cancha_club ON cancha (id_club);
CREATE INDEX idx_cancha_deporte ON cancha (id_deporte);
CREATE INDEX idx_disponibilidad_dia_horas ON disponibilidad (dia_semana, hora_inicio, hora_fin);
CREATE INDEX idx_disponibilidad_cancha ON disponibilidad (id_cancha);
CREATE INDEX idx_disponibilidad_cancha_dia_horas ON disponibilidad (id_cancha, dia_semana, hora_inicio, hora_fin);
CREATE INDEX idx_reserva_fecha_estado_horas ON reserva (fecha, estado, hora_inicio, hora_fin);
CREATE INDEX idx_reserva_estado_pago ON reserva (estado_pago);
CREATE INDEX idx_reserva_usuario ON reserva (id_usuario);
CREATE INDEX idx_reserva_cancha ON reserva (id_cancha);
CREATE INDEX idx_reserva_usuario_fecha ON reserva (id_usuario, fecha, hora_inicio);
CREATE INDEX idx_reserva_cancha_fecha_estado_horas ON reserva (id_cancha, fecha, estado, hora_inicio, hora_fin);

-- Segunda barrera contra dobles reservas: PostgreSQL rechaza cualquier solapamiento
-- activo para la misma cancha aunque dos instancias del backend compitan al mismo tiempo.
ALTER TABLE reserva
  ADD CONSTRAINT ex_reserva_no_solapada
  EXCLUDE USING gist (
    id_cancha WITH =,
    tsrange(fecha + hora_inicio, fecha + hora_fin, '[)') WITH &&
  )
  WHERE (estado <> 'cancelada' AND id_cancha IS NOT NULL);
CREATE UNIQUE INDEX ux_pago_referencia_externa ON pago (referencia_externa) WHERE referencia_externa IS NOT NULL;
CREATE INDEX idx_bloqueo_fecha_activo_horas ON bloqueo_cancha (fecha, activo, hora_inicio, hora_fin);
CREATE INDEX idx_bloqueo_cancha ON bloqueo_cancha (id_cancha);
CREATE INDEX idx_bloqueo_cancha_fecha_activo_horas ON bloqueo_cancha (id_cancha, fecha, activo, hora_inicio, hora_fin);
CREATE INDEX idx_torneo_estado_fecha ON torneo (estado, fecha_inicio);
CREATE INDEX idx_torneo_club ON torneo (id_club);
CREATE INDEX idx_torneo_club_estado_fecha ON torneo (id_club, estado, fecha_inicio);
CREATE INDEX idx_disp_jugador_filtros ON disponibilidad_jugador (estado, ciudad, fecha_desde, fecha_hasta);
CREATE INDEX idx_disp_jugador_usuario ON disponibilidad_jugador (id_usuario);
CREATE INDEX idx_disp_jugador_deporte ON disponibilidad_jugador (id_deporte);
CREATE INDEX idx_disp_jugador_busqueda ON disponibilidad_jugador (id_deporte, estado, ciudad, fecha_desde, fecha_hasta);
CREATE INDEX idx_solicitud_estado ON solicitud_jugador (estado);
CREATE INDEX idx_solicitud_disponibilidad ON solicitud_jugador (id_disponibilidad);
CREATE INDEX idx_solicitud_solicitante ON solicitud_jugador (id_usuario_solicitante);
CREATE INDEX idx_solicitud_disponibilidad_estado ON solicitud_jugador (id_disponibilidad, estado);
CREATE INDEX idx_solicitud_solicitante_estado ON solicitud_jugador (id_usuario_solicitante, estado);
