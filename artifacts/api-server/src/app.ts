import express, { type Express } from "express";
import session from "express-session";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import { PgSessionStore } from "./lib/pg-session-store";

export const sessionStore = new PgSessionStore(pool);

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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || "crypto-exchange-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
    },
  }),
);

// This app's frontend and API share one host. Reject credentialed state
// mutations initiated by another website, while allowing same-origin browser
// requests and non-browser clients that do not send Origin.
app.use((req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    next();
    return;
  }
  const origin = req.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== req.get("host")) {
        res.status(403).json({ error: "Cross-origin request rejected" });
        return;
      }
    } catch {
      res.status(403).json({ error: "Invalid request origin" });
      return;
    }
  }
  next();
});

app.use("/api", router);

export default app;
