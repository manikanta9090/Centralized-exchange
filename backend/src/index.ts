import cors from "cors";
import { appRouter } from "./routes/index.js";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { env } from "./utils/env.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use(appRouter);

app.get("/health", async (_req, res) => {
  res.json({ ok: true });
});

app.use(
  (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);

    res.status(500).json({
      error: err instanceof Error ? err.message : "internal_server_error",
    });
  },
);

app.listen(env.port, () => {
  console.log(`Backend running on http://localhost:${env.port}`);
});
