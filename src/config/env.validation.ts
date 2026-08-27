const required = (
  config: Record<string, unknown>,
  key: string,
): string => {
  const value = String(config[key] ?? '').trim();

  if (!value) {
    throw new Error(`Falta la variable de entorno obligatoria ${key}.`);
  }

  return value;
};

const positiveInteger = (
  config: Record<string, unknown>,
  key: string,
  fallback: number,
  max = Number.MAX_SAFE_INTEGER,
): number => {
  const raw = config[key] ?? fallback;
  const value = Number(raw);

  if (!Number.isInteger(value) || value <= 0 || value > max) {
    throw new Error(`${key} debe ser un entero positivo válido.`);
  }

  return value;
};

const requireHttpsUrl = (
  config: Record<string, unknown>,
  key: string,
): string => {
  const value = required(config, key);

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${key} debe ser una URL válida.`);
  }

  if (url.protocol !== 'https:') {
    throw new Error(`${key} debe utilizar HTTPS en producción.`);
  }

  return value;
};

const booleanValue = (
  value: unknown,
  fallback = false,
): boolean => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return String(value).toLowerCase() === 'true';
};

const validateDatabaseUrl = (
  config: Record<string, unknown>,
  production: boolean,
): string => {
  const value = required(config, 'DATABASE_URL');

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error('DATABASE_URL debe ser una URL PostgreSQL válida.');
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error(
      'DATABASE_URL debe usar el protocolo postgres:// o postgresql://.',
    );
  }

  if (
    production &&
    !/sslmode=(?:require|verify-full)/i.test(url.search)
  ) {
    throw new Error(
      'En producción DATABASE_URL debe exigir TLS con sslmode=require o sslmode=verify-full.',
    );
  }

  return value;
};

const validateNumericId = (
  config: Record<string, unknown>,
  key: string,
): string => {
  const value = required(config, key);

  if (!/^\d+$/.test(value)) {
    throw new Error(`${key} debe contener solamente números.`);
  }

  return value;
};

const validateGraphVersion = (
  config: Record<string, unknown>,
): string => {
  const value = required(config, 'WHATSAPP_GRAPH_VERSION');

  if (!/^v\d+\.\d+$/.test(value)) {
    throw new Error(
      'WHATSAPP_GRAPH_VERSION debe tener un formato válido, por ejemplo v25.0.',
    );
  }

  return value;
};

export function validateEnvironment(
  config: Record<string, unknown>,
) {
  const nodeEnv = String(config.NODE_ENV || 'development');
  const production = nodeEnv === 'production';

  const databaseUrl = validateDatabaseUrl(config, production);

  const port = positiveInteger(
    config,
    'PORT',
    3000,
    65535,
  );

  const dbPoolSize = positiveInteger(
    config,
    'DB_POOL_SIZE',
    5,
    50,
  );

  const dbConnectTimeoutMs = positiveInteger(
    config,
    'DB_CONNECT_TIMEOUT_MS',
    10000,
    120000,
  );

  const jwtSecret = required(config, 'JWT_SECRET');

  if (jwtSecret.length < 32) {
    throw new Error(
      'JWT_SECRET debe tener al menos 32 caracteres.',
    );
  }

  if (production && booleanValue(config.DB_SYNC)) {
    throw new Error(
      'DB_SYNC no puede estar habilitado en producción.',
    );
  }

  if (production) {
    required(config, 'CORS_ORIGINS');

    requireHttpsUrl(config, 'FRONTEND_URL');
    requireHttpsUrl(config, 'BACKEND_PUBLIC_URL');

    required(config, 'MAIL_HOST');
    positiveInteger(config, 'MAIL_PORT', 587, 65535);
    required(config, 'MAIL_USER');
    required(config, 'MAIL_PASS');
    required(config, 'MAIL_FROM');

    required(config, 'WHATSAPP_ACCESS_TOKEN');

    validateNumericId(
      config,
      'WHATSAPP_PHONE_NUMBER_ID',
    );

    validateNumericId(
      config,
      'WHATSAPP_WABA_ID',
    );

    validateGraphVersion(config);
  }

  return {
    ...config,

    NODE_ENV: nodeEnv,

    PORT: port,

    DATABASE_URL: databaseUrl,

    DB_POOL_SIZE: dbPoolSize,

    DB_CONNECT_TIMEOUT_MS: dbConnectTimeoutMs,

    DB_SYNC: booleanValue(config.DB_SYNC, false),

    DB_LOGGING: booleanValue(
      config.DB_LOGGING,
      false,
    ),
  };
}