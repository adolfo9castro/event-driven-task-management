import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global Exception Filter to standardize HTTP error responses across the API.
 * Intercepts all exceptions thrown by route handlers and formats them into a consistent JSON structure.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        // Determine the HTTP status code
        const status =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        // Extract the error message or validation details
        const message =
            exception instanceof HttpException
                ? exception.getResponse()
                : 'Internal server error';

        // Log the error for internal debugging (hiding stack traces from the client)
        this.logger.error(
            `[${request.method}] ${request.url} - Status: ${status}`,
            exception instanceof Error ? exception.stack : String(exception),
        );

        // Construct the standardized API error response
        response.status(status).json({
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            method: request.method,
            error: typeof message === 'string' ? { message } : message,
        });
    }
}