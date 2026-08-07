import { createClient, type RedisClientType } from "redis";
import { env } from "./utils/env.js";
import { handleDeposit } from "./handlers/deposit-handler.js";
import { handleWithdraw } from "./handlers/withdraw-handler.js";
import { handleOrder } from "./handlers/order-handler.js";

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
      const result = await this.client.blPop(
        env.incomingQueue,
        0,
      );

      if (!result) {
        continue;
      }

      let message: EngineRequest;

      try {
        message = JSON.parse(result.element);
      } catch (error) {
        console.error("Invalid request:", error);
        continue;
      }

      try {
        console.log("Received engine request:");
        console.log(message);

        if (
          !message.correlationId ||
          !message.responseQueue
        ) {
          throw new Error(
            "Missing correlationId or responseQueue",
          );
        }

        let data: unknown;

        switch (message.type) {
  case "DEPOSIT":
    data = handleDeposit(
      message.payload as {
        userId: string;
        asset: string;
        amount: number;
      },
    );
    break;

  case "WITHDRAW":
    data = handleWithdraw(
      message.payload as {
        userId: string;
        asset: string;
        amount: number;
      },
    );
    break;

    case "PLACE_ORDER":
  data = handleOrder(
    message.payload as {
      userId: string;
      market: string;
      side: "BUY" | "SELL";
      price: number;
      quantity: number;
    },
  );
  break;

    default:
            throw new Error(
              `Unknown request type: ${message.type}`,
            );
        }

        await this.client.publish(
          message.responseQueue,
          JSON.stringify({
            correlationId: message.correlationId,
            data,
          }),
        );
      } catch (error) {
        console.error(error);

        if (
          message.correlationId &&
          message.responseQueue
        ) {
          await this.client.publish(
            message.responseQueue,
            JSON.stringify({
              correlationId: message.correlationId,
              error:
                error instanceof Error
                  ? error.message
                  : "unknown_error",
            }),
          );
        }
      }
    }
  }
}

export const redisManager = new RedisManager();