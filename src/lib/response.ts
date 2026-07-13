import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (message: string) => new ApiError(404, 'not_found', message);
export const badRequest = (message: string) => new ApiError(400, 'bad_request', message);
export const conflict = (message: string) => new ApiError(409, 'conflict', message);

export function json(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

type Handler = (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2>;

/** Wraps a handler with uniform error handling: ApiError -> its status, anything else -> 500. */
export function withErrorHandling(handler: Handler): Handler {
  return async (event) => {
    try {
      return await handler(event);
    } catch (err) {
      if (err instanceof ApiError) {
        return json(err.statusCode, { error: { code: err.code, message: err.message } });
      }
      console.error('Unhandled error', err);
      return json(500, { error: { code: 'internal_error', message: 'Internal server error' } });
    }
  };
}

export function parseBody(event: APIGatewayProxyEventV2): unknown {
  if (!event.body) throw badRequest('Request body is required');
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    return JSON.parse(raw);
  } catch {
    throw badRequest('Request body must be valid JSON');
  }
}
