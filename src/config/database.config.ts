import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * Configuración única de PostgreSQL para DameCancha.
 *
 * Neon entrega una DATABASE_URL completa. El parámetro sslmode=require debe
 * permanecer en esa URL para que la conexión viaje cifrada.
 */
export function createDatabaseOptions(config: ConfigService): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    url: config.getOrThrow<string>('DATABASE_URL'),
    autoLoadEntities: true,
    synchronize: config.get<boolean>('DB_SYNC') === true,
    logging: config.get<boolean>('DB_LOGGING') === true,
    poolSize: config.get<number>('DB_POOL_SIZE') || 5,
    connectTimeoutMS: config.get<number>('DB_CONNECT_TIMEOUT_MS') || 10000,
    extra: {
      enableChannelBinding: true,
    },
  };
}
