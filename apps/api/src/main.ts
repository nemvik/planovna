import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApiApp } from './bootstrap';
import { resolveTokenSecret } from './modules/auth/auth.service';

async function bootstrap() {
  resolveTokenSecret();

  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  configureApiApp(app);

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exit(1);
});
