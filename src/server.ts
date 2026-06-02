import { app } from './app';
import { env, validateEnv } from './config/env';

validateEnv();

app.listen(env.PORT, () => {
  console.log(`BiblioFlow API running on http://localhost:${env.PORT}`);
});
