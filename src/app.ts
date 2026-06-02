import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import { authRateLimiter } from './middlewares/rateLimit';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { booksRouter } from './routes/books';
import { rentalsRouter } from './routes/rentals';
import { donationsRouter } from './routes/donations';
import { openapiSpec } from './docs/openapi';

const app = express();

// Swagger UI é montado antes do helmet: a CSP padrão do helmet bloquearia os
// assets inline da interface. A API abaixo permanece protegida pelo helmet.
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, { explorer: true }));

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());

app.use('/api/v1/auth', authRateLimiter, authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/books', booksRouter);
app.use('/api/v1/rentals', rentalsRouter);
app.use('/api/v1/donations', donationsRouter);

app.use(errorHandler);

export { app };
