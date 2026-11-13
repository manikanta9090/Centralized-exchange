import {
  ORDER_BOOK,
  type Order,
} from "./store/order-book.js";

export interface Trade {
  market: string;
  price: number;
  quantity: number;
  buyerOrderId: string;
  sellerOrderId: string;
  buyerUserId: string;
  sellerUserId: string;
  /**
   * The buyer's limit price. The buyer's funds are reserved at this
   * price; any difference between it and the maker execution price
   * is refunded to the buyer's available balance.
   */
  buyerLimitPrice?: number;
  /**
   * The seller's limit price. Informational for Phase 1; sellers
   * receive the maker execution price.
   */
  sellerLimitPrice?: number;
}

export interface MatchingPlan {
  trades: Trade[];
  /** orderId -> quantity filled by this matching run. */
  fills: Map<string, number>;
  /** Resting orders removed by self-trade prevention. */
  cancelledOrderIds: string[];
}

interface WorkingOrder {
  order: Order;
  remaining: number;
}

function emptyPlan(): MatchingPlan {
  return {
    trades: [],
    fills: new Map<string, number>(),
    cancelledOrderIds: [],
  };
}

function isBidAggressor(
  bestBid: WorkingOrder,
  bestAsk: WorkingOrder,
  incomingOrderId?: string,
): boolean {
  if (incomingOrderId) {
    if (bestBid.order.orderId === incomingOrderId) {
      return true;
    }

    if (bestAsk.order.orderId === incomingOrderId) {
      return false;
    }
  }

  // Fallback for callers that do not identify the aggressor:
  // the newer order is the aggressor.
  return bestBid.order.sequence > bestAsk.order.sequence;
}

function addFill(
  fills: Map<string, number>,
  orderId: string,
  quantity: number,
): void {
  fills.set(
    orderId,
    (fills.get(orderId) ?? 0) + quantity,
  );
}

/**
 * Build a matching plan without mutating the order book, the orders
 * or any balances.
 *
 * Execution price is always the resting maker's price.
 *
 * Self-trade prevention policy: cancel the resting maker order and
 * release its remaining reserved funds, then continue matching. This
 * is deterministic and prevents a crossed book from being left
 * behind.
 */
export function matchOrders(
  market: string,
  incomingOrderId?: string,
): MatchingPlan {
  const book = ORDER_BOOK.get(market);

  if (!book) {
    return emptyPlan();
  }

  const bids: WorkingOrder[] = book.bids
    .filter(
      (order) =>
        order.quantity - order.filledQuantity > 0,
    )
    .map((order) => ({
      order,
      remaining:
        order.quantity - order.filledQuantity,
    }));

  const asks: WorkingOrder[] = book.asks
    .filter(
      (order) =>
        order.quantity - order.filledQuantity > 0,
    )
    .map((order) => ({
      order,
      remaining:
        order.quantity - order.filledQuantity,
    }));

  const plan = emptyPlan();

  while (bids.length > 0 && asks.length > 0) {
    const bestBid = bids[0];
    const bestAsk = asks[0];

    if (!bestBid || !bestAsk) {
      break;
    }

    if (bestBid.order.price < bestAsk.order.price) {
      break;
    }

    const aggressorIsBid = isBidAggressor(
      bestBid,
      bestAsk,
      incomingOrderId,
    );

    // Self-trade prevention: never trade a user with themselves.
    // Cancel the resting maker and continue with the remaining book.
    if (
      bestBid.order.userId ===
      bestAsk.order.userId
    ) {
      if (aggressorIsBid) {
        plan.cancelledOrderIds.push(
          bestAsk.order.orderId,
        );
        asks.shift();
      } else {
        plan.cancelledOrderIds.push(
          bestBid.order.orderId,
        );
        bids.shift();
      }

      continue;
    }

    const tradeQuantity = Math.min(
      bestBid.remaining,
      bestAsk.remaining,
    );

    if (
      !Number.isFinite(tradeQuantity) ||
      tradeQuantity <= 0
    ) {
      throw new Error(
        "invalid remaining quantity while matching",
      );
    }

    const trade: Trade = {
      market,
      price: aggressorIsBid
        ? bestAsk.order.price
        : bestBid.order.price,
      quantity: tradeQuantity,
      buyerOrderId: bestBid.order.orderId,
      sellerOrderId: bestAsk.order.orderId,
      buyerUserId: bestBid.order.userId,
      sellerUserId: bestAsk.order.userId,
      buyerLimitPrice: bestBid.order.price,
      sellerLimitPrice: bestAsk.order.price,
    };

    plan.trades.push(trade);

    addFill(
      plan.fills,
      bestBid.order.orderId,
      tradeQuantity,
    );
    addFill(
      plan.fills,
      bestAsk.order.orderId,
      tradeQuantity,
    );

    bestBid.remaining -= tradeQuantity;
    bestAsk.remaining -= tradeQuantity;

    if (bestBid.remaining <= 0) {
      bids.shift();
    }

    if (bestAsk.remaining <= 0) {
      asks.shift();
    }
  }

  return plan;
}
