import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { requestId?: string }>();
    const response = http.getResponse<Response>();
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () =>
          this.log(request, response.statusCode, Date.now() - start),
        error: (error: unknown) => {
          const status =
            typeof error === 'object' && error && 'status' in error
              ? Number((error as { status: number }).status)
              : 500;
          this.log(request, status, Date.now() - start);
        },
      }),
    );
  }

  private log(
    request: Request & { requestId?: string },
    status: number,
    durationMs: number,
  ) {
    const payload = {
      requestId: request.requestId,
      method: request.method,
      path: request.originalUrl,
      status,
      durationMs,
    };

    if (status >= 500) this.logger.error(JSON.stringify(payload));
    else if (status >= 400) this.logger.warn(JSON.stringify(payload));
    else this.logger.log(JSON.stringify(payload));
  }
}
