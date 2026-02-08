import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module';
import cors from 'cors';
import express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as any).rawBody = buf.toString();
      }
    })
  );
  app.use(
    express.urlencoded({
      extended: true,
      verify: (req, _res, buf) => {
        (req as any).rawBody = buf.toString();
      }
    })
  );
  app.use(cors({ origin: true, credentials: true }));
  const port = Number(process.env.PORT) || 4000;
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}`);
}

bootstrap();
