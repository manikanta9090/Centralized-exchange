import { createClient, type RedisClientType } from "redis";
import { env } from "./utils/env.js";

interface EngineRequest {
  correlationId?: string;
  responseQueue?: string;
  type?: string;
  payload?: unknown;
}

class RedisManager {
  private client: RedisClientType;

  constructor() {
    this.client = createClient({
      url: env.redisUrl,
    });

    this.client.on("error", (error) => {
      console.error("Engine Redis error:", error);
    });
  }

  async connect(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
    }

    console.log("Matching engine connected to Redis");
  }

  async listenForRequests(): Promise<void> {
    console.log(
      `Engine listening on queue: ${env.incomingQueue}`,
    );

    while (true) {
      try {
        const result = await this.client.blPop(
          env.incomingQueue,
          0,
        );

        if (!result) {
          continue;
        }

        const message: EngineRequest = JSON.parse(
          result.element,
        );

        console.log("Received engine request:");
        console.log(message);

        if (
          !message.correlationId ||
          !message.responseQueue
        ) {
          console.log(
            "Request has no correlationId/responseQueue; skipping response",
          );
          continue;
        }

        const response = {
          correlationId: message.correlationId,
          data: {
            ok: true,
            type: message.type,
            payload: message.payload,
          },
        };

        await this.client.publish(
          message.responseQueue,
          JSON.stringify(response),
        );

        console.log(
          `Response sent for: ${message.correlationId}`,
        );
      } catch (error) {
        console.error(
          "Failed to process engine request:",
          error,
        );
      }
    }
  }
}

export const redisManager = new RedisManager();