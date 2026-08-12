import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth-middleware.js";
import { orderSchema } from "../types/order-schema.js";
import { engineClient } from "../utils/engine-client.js";
import { sendValidationError } from "../utils/validation.js";

interface OrderResponse {
  order: {
    orderId: string;
    userId: string;
    market: string;
    side: "BUY" | "SELL";
    price: number;
    quantity: number;
    filledQuantity: number;
  };
  orderBook: {
    bids: OrderResponse["order"][];
    asks: OrderResponse["order"][];
  };
}

export async function placeOrder(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const parsedBody = orderSchema.safeParse(req.body);

  if (!parsedBody.success) {
    sendValidationError(res, parsedBody.error);
    return;
  }

  if (!req.userId) {
    res.status(401).json({
      error: "unauthorized",
    });
    return;
  }

  const {
    market,
    side,
    price,
    quantity,
  } = parsedBody.data;

  const result =
    await engineClient.sendRequest<OrderResponse>(
      "PLACE_ORDER",
      {
        userId: req.userId,
        market,
        side,
        price,
        quantity,
      },
    );

  res.status(200).json(result);
}

export async function cancelOrder(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({
      error: "unauthorized",
    });
    return;
  }

  const { orderId } = req.params;

  if (!orderId) {
    res.status(400).json({
      error: "orderId is required",
    });
    return;
  }

  try {
    console.log(
      `Cancelling order ${orderId} for user ${req.userId}`,
    );

    const result =
      await engineClient.sendRequest(
        "CANCEL_ORDER",
        {
          userId: req.userId,
          orderId,
        },
      );

    console.log(
      "Order cancellation response:",
      result,
    );

    res.status(200).json(result);
  } catch (error) {
    console.error(
      "Order cancellation failed:",
      error,
    );

    res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "order_cancellation_failed",
    });
  }
}