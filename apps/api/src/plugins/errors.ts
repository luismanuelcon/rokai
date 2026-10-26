import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { ZodError } from 'zod';
import { HttpError } from '../lib/http-error.js';

export const errorsPlugin = fp(function errorsPlugin(app: FastifyInstance) {
  app.setNotFoundHandler((_req, reply) => {
    void reply.status(404).send({ error: 'Recurso no encontrado.' });
  });

  app.setErrorHandler((error: unknown, req, reply) => {
    if (error instanceof HttpError) {
      void reply.status(error.status).send({ error: error.message, code: error.code });
      return;
    }
    if (error instanceof ZodError) {
      const first = error.issues[0];
      void reply.status(400).send({
        error: first?.message ?? 'Solicitud no válida.',
        code: 'validation_error',
        details: { path: first?.path.join('.') ?? '' },
      });
      return;
    }
    const status = (error as { statusCode?: number }).statusCode;
    if (typeof status === 'number' && status < 500) {
      void reply.status(status).send({ error: (error as Error).message });
      return;
    }
    req.log.error({ err: error }, 'Error no controlado');
    void reply.status(500).send({ error: 'No pudimos completar la solicitud.' });
  });
});
