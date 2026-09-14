import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AppService {
  constructor(private readonly dataSource: DataSource) {}

  getInfo() {
    return {
      name: 'DameCancha API',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  getHealth() {
    return {
      status: 'ok',
      service: 'DameCancha API',
      timestamp: new Date().toISOString(),
    };
  }

  async getDatabaseHealth() {
    const startedAt = Date.now();

    await this.dataSource.query('SELECT 1');

    return {
      status: 'ok',
      database: 'up',
      responseTimeMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    };
  }
}