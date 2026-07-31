import "dotenv/config";

function readRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required env variable: ${name}`);
  }

  return value;
}

export const env = {
  port: Number(process.env.PORT ?? "3000"),

  databaseUrl: readRequiredEnv("DATABASE_URL"),
  jwtSecret: readRequiredEnv("JWT_SECRET"),
  redisUrl: readRequiredEnv("REDIS_URL"),

  incomingQueue:
    process.env.INCOMING_QUEUE ??
    "backend-to-engine-broker",

  responseQueue:
    `response-queue-${
      process.env.BACKEND_QUEUE_ID ??
      crypto.randomUUID()
    }`,

  engineTimeoutMs: Number(
    process.env.ENGINE_TIMEOUT_MS ?? "30000",
  ),
};