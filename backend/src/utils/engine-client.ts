import { createClient, type RedisClientType } from "redis";
import { env } from "./env.js";

class EngineClient {
  private redis: RedisClientType;
  private subscriber: RedisClientType;

  private pendingRequests = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (reason?: unknown) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();

  constructor() {
    // Main Redis client — used for sending requests to the engine
    this.redis = createClient({
      url: env.redisUrl,
    });

    // Separate Redis client — will listen for engine responses
    this.subscriber = this.redis.duplicate();

    this.redis.on("error", (error) => {
      console.error("Redis client error:", error);
    });

    this.subscriber.on("error", (error) => {
      console.error("Redis subscriber error:", error);
    });
  }

 async connect(): Promise<void> {
  if (!this.redis.isOpen) {
    await this.redis.connect();
  }

  if (!this.subscriber.isOpen) {
    await this.subscriber.connect();
  }

  await this.listenForResponses();

  console.log("Connected to Redis");
}

  async sendRequest<T>(
    type: string,
    payload: unknown,
  ): Promise<T> {
    const correlationId = crypto.randomUUID();

    const message = {
      correlationId,
      responseQueue: env.responseQueue,
      type,
      payload,
    };

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(correlationId);

        reject(
          new Error(
            `Engine request timed out after ${env.engineTimeoutMs}ms`,
          ),
        );
      }, env.engineTimeoutMs);

      this.pendingRequests.set(correlationId, {
        resolve: (value) => resolve(value as T),
        reject,
        timeout,
      });

      this.redis
        .rPush(
          env.incomingQueue,
          JSON.stringify(message),
        )
        .catch((error) => {
          clearTimeout(timeout);
          this.pendingRequests.delete(correlationId);
          reject(error);
        });
    });
  }
}

export const engineClient = new EngineClient();