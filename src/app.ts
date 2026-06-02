import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { errorHandler } from './middlewares/errorHandler';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { booksRouter } from './routes/books';
import { rentalsRouter } from './routes/rentals';
import { donationsRouter } from './routes/donations';
import { openapiSpec } from './docs/openapi';

const app = express();

app.use(express.json());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, { explorer: true }));

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/books', booksRouter);
app.use('/api/v1/rentals', rentalsRouter);
app.use('/api/v1/donations', donationsRouter);

app.use(errorHandler);

export { app };
