import express from "express";
import cors from "cors";

import { env } from "./utils/env.js";
import { appRouter } from "./routes/index.js";
import { engineClient } from "./utils/engine-client.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use(appRouter);

app.use((req, res) => {
  console.error(
    `Route not found: ${req.method} ${req.originalUrl}`,
  );

  res.status(404).json({
    error: "route_not_found",
    method: req.method,
    path: req.originalUrl,
  });
});

app.use(
  (
    error: unknown,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(
      `Request failed: ${req.method} ${req.originalUrl}`,
    );

    console.error(error);

    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "internal_server_error",
    });
  },
);

async function startServer(): Promise<void> {
  try {
    await engineClient.connect();

    app.listen(env.port, () => {
      console.log(
        `Backend running on http://localhost:${env.port}`,
      );
    });
  } catch (error) {
    console.error(
      "Failed to start backend:",
      error,
    );

    process.exit(1);
  }
}

startServer();