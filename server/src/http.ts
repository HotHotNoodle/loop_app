import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express'
import { z } from 'zod'

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}

export const notFound = (what = 'Resource') => new HttpError(404, 'not_found', `${what} not found`)

/** Validates `data` against a zod schema; throws a 400 with field-level details on failure. */
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw Object.assign(new HttpError(400, 'invalid_request', 'Request validation failed'), {
      details: z.flattenError(result.error).fieldErrors,
    })
  }
  return result.data
}

export const errorHandler: ErrorRequestHandler = (err, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.code, message: err.message, ...('details' in err ? { details: err.details } : {}) })
    return
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'invalid_json', message: 'Malformed JSON body' })
    return
  }
  // Never leak internals to the client.
  console.error(err)
  res.status(500).json({ error: 'internal_error', message: 'Something went wrong' })
}
