const required = (config: Record<string, unknown>, key: string): string => {
  const value = String(config[key] ?? '').trim();
  if (!value) throw new Error(`Falta la variable de entorno obligatoria ${key}.`);
  return value;
};


const positivePort = (config: Record<string, unknown>, key: string, fallback?: number): number => {
  const raw = config[key] ?? fallback;
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`${key} debe ser un puerto válido.`);
  }
  return port;
};

const requireHttpsUrl = (config: Record<string, unknown>, key: string): string => {
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

const booleanValue = (value: unknown, fallback = false): boolean => {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
};

export function validateEnvironment(config: Record<string, unknown>) {
  const nodeEnv = String(config.NODE_ENV || 'development');
  const production = nodeEnv === 'production';

  required(config, 'DB_HOST');
  const port = positivePort(config, 'PORT', 3000);
  const dbPort = positivePort(config, 'DB_PORT');
  required(config, 'DB_USER');
  required(config, 'DB_NAME');

  const jwtSecret = required(config, 'JWT_SECRET');
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres.');
  }

  if (production && booleanValue(config.DB_SYNC)) {
    throw new Error('DB_SYNC no puede estar habilitado en producción.');
  }

  if (production) {
    required(config, 'CORS_ORIGINS');
    requireHttpsUrl(config, 'FRONTEND_URL');
    requireHttpsUrl(config, 'BACKEND_PUBLIC_URL');

    required(config, 'MAIL_HOST');
    positivePort(config, 'MAIL_PORT');
    required(config, 'MAIL_USER');
    required(config, 'MAIL_PASS');
    required(config, 'MAIL_FROM');
  }

  const mpToken = String(config.MERCADOPAGO_ACCESS_TOKEN || '').trim();
  if (mpToken) {
    required(config, 'BACKEND_PUBLIC_URL');
    if (production) required(config, 'MERCADOPAGO_WEBHOOK_SECRET');
  }

  return {
    ...config,
    NODE_ENV: nodeEnv,
    PORT: port,
    DB_PORT: dbPort,
    DB_SYNC: booleanValue(config.DB_SYNC, false),
    DB_LOGGING: booleanValue(config.DB_LOGGING, false),
  };
}
