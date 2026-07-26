import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(helmet());

const allowedOrigins = new Set<string>();

const devDomain = process.env.REPLIT_DEV_DOMAIN;
let replitBaseDomain: string | null = null;
if (devDomain) {
  allowedOrigins.add(`https://${devDomain}`);
  const dotIdx = devDomain.indexOf(".");
  if (dotIdx !== -1) {
    replitBaseDomain = devDomain.slice(dotIdx + 1);
  }
}

const replitDomains = process.env.REPLIT_DOMAINS;
if (replitDomains) {
  for (const d of replitDomains.split(",")) {
    const trimmed = d.trim();
    if (trimmed) {
      allowedOrigins.add(`https://${trimmed}`);
    }
  }
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      if (replitBaseDomain && origin.endsWith(`.${replitBaseDomain}`)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS: origin not allowed: ${origin}`));
    },
    credentials: true,
  }),
);

app.use(
  express.json({
    verify: (req: Request & { rawBody?: Buffer }, _res: Response, buf: Buffer) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
