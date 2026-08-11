import {
  createClient,
  type RedisClientType,
} from "redis";
import { env } from "./env.js";

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timeout: ReturnType<typeof setTimeout>;
}

interface EngineResponse {
  correlationId: string;
  data?: unknown;
  error?: string;
}

class EngineClient {
  private redis: RedisClientType;
  private subscriber: RedisClientType;

  private pendingRequests = new Map<
    string,
    PendingRequest
  >();

  private responseListenerStarted = false;

  constructor() {
    this.redis = createClient({
      url: env.redisUrl,
    });

    this.subscriber = this.redis.duplicate();

    this.redis.on("error", (error) => {
      console.error(
        "Redis client error:",
        error,
      );
    });

    this.subscriber.on("error", (error) => {
      console.error(
        "Redis subscriber error:",
        error,
      );
    });

    this.redis.on("connect", () => {
      console.log("Redis client connecting...");
    });

    this.redis.on("ready", () => {
      console.log("Redis client ready");
    });

    this.redis.on("end", () => {
      console.log("Redis client connection closed");
    });

    this.subscriber.on("ready", () => {
      console.log("Redis subscriber ready");
    });
  }

  async connect(): Promise<void> {
    if (!this.redis.isOpen) {
      await this.redis.connect();
    }

    if (!this.subscriber.isOpen) {
      await this.subscriber.connect();
    }

    console.log("Connected to Redis");

    if (!this.responseListenerStarted) {
      this.responseListenerStarted = true;

      await this.listenForResponses();
    }
  }

  private async listenForResponses(): Promise<void> {
    console.log(
      `Listening for engine responses on: ${env.responseQueue}`,
    );

    await this.subscriber.subscribe(
      env.responseQueue,
      (message) => {
        try {
          const response =
            JSON.parse(message) as EngineResponse;

          console.log(
            "Received engine response:",
            response,
          );

          const pending =
            this.pendingRequests.get(
              response.correlationId,
            );

          if (!pending) {
            console.warn(
              `No pending request found for correlationId: ${response.correlationId}`,
            );

            return;
          }

          clearTimeout(pending.timeout);

          this.pendingRequests.delete(
            response.correlationId,
          );

          if (response.error) {
            pending.reject(
              new Error(response.error),
            );

            return;
          }

          pending.resolve(response.data);
        } catch (error) {
          console.error(
            "Failed to process engine response:",
            error,
          );
        }
      },
    );
  }

  async sendRequest<T>(
    type: string,
    payload: unknown,
  ): Promise<T> {
    /*
     * Safety check:
     * If the backend somehow tries to send a request
     * before Redis is connected, connect first.
     */
    if (!this.redis.isOpen) {
      console.log(
        "Redis client is closed. Connecting...",
      );

      await this.connect();
    }

    const correlationId =
      crypto.randomUUID();

    const message = {
      correlationId,
      responseQueue: env.responseQueue,
      type,
      payload,
    };

    console.log(
      `Sending engine request: ${type}`,
    );

    return new Promise<T>(
      async (resolve, reject) => {
        const timeout = setTimeout(() => {
          this.pendingRequests.delete(
            correlationId,
          );

          reject(
            new Error(
              `Engine request timed out after ${env.engineTimeoutMs}ms`,
            ),
          );
        }, env.engineTimeoutMs);

        this.pendingRequests.set(
          correlationId,
          {
            resolve: (value) =>
              resolve(value as T),
            reject,
            timeout,
          },
        );

        try {
          await this.redis.rPush(
            env.incomingQueue,
            JSON.stringify(message),
          );

          console.log(
            `Engine request sent: ${type}`,
          );
        } catch (error) {
          clearTimeout(timeout);

          this.pendingRequests.delete(
            correlationId,
          );

          console.error(
            "Failed to send engine request:",
            error,
          );

          reject(error);
        }
      },
    );
  }
}

export const engineClient =
  new EngineClient();