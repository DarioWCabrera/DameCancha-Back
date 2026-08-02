import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import {
  RATE_LIMIT_KEY,
  type RateLimitOptions,
} from './rate-limit.decorator';

type Bucket = { count: number; resetAt: number };

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const now = Date.now();
    // Express ya normaliza request.ip según la configuración trust proxy.
    // No confiamos directamente en X-Forwarded-For porque el cliente podría falsificarlo.
    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    const route = `${request.method}:${request.baseUrl}${request.route?.path || request.path}`;
    const key = `${ip}:${route}`;
    const existing = this.buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, {
        count: 1,
        resetAt: now + options.windowMs,
      });
      this.cleanup(now);
      return true;
    }

    if (existing.count >= options.limit) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((existing.resetAt - now) / 1000),
      );
      throw new HttpException(
        `Demasiados intentos. Volvé a probar en ${retryAfterSeconds} segundos.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    existing.count += 1;
    return true;
  }

  private cleanup(now: number) {
    if (this.buckets.size < 5000) return;
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}
