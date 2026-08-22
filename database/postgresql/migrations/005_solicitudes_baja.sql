BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.solicitud_baja_codigo_seq;

CREATE TABLE IF NOT EXISTS public.solicitud_baja (
    id_solicitud BIGSERIAL PRIMARY KEY,

    codigo VARCHAR(40) NOT NULL UNIQUE
        DEFAULT (
            'BAJA-' ||
            TO_CHAR(CURRENT_DATE, 'YYYYMMDD') ||
            '-' ||
            LPAD(
                NEXTVAL('public.solicitud_baja_codigo_seq')::text,
                6,
                '0'
            )
        ),

    id_club INTEGER NOT NULL,

    id_usuario_solicitante INTEGER NOT NULL,

    motivo TEXT NULL,

    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    processed_at TIMESTAMPTZ NULL,

    id_admin_procesado INTEGER NULL,

    CONSTRAINT fk_solicitud_baja_club
        FOREIGN KEY (id_club)
        REFERENCES public.club(id_club)
        ON DELETE RESTRICT,

    CONSTRAINT fk_solicitud_baja_usuario
        FOREIGN KEY (id_usuario_solicitante)
        REFERENCES public."user"(id_usuario)
        ON DELETE RESTRICT,

    CONSTRAINT fk_solicitud_baja_admin
        FOREIGN KEY (id_admin_procesado)
        REFERENCES public."user"(id_usuario)
        ON DELETE SET NULL,

    CONSTRAINT chk_solicitud_baja_estado
        CHECK (
            estado IN (
                'pendiente',
                'procesada',
                'cancelada'
            )
        )
);

CREATE UNIQUE INDEX IF NOT EXISTS
    uq_solicitud_baja_pendiente_club
ON public.solicitud_baja (id_club)
WHERE estado = 'pendiente';

CREATE INDEX IF NOT EXISTS
    idx_solicitud_baja_estado_fecha
ON public.solicitud_baja (
    estado,
    created_at DESC
);

CREATE INDEX IF NOT EXISTS
    idx_solicitud_baja_club
ON public.solicitud_baja (
    id_club
);

COMMIT;
