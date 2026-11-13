import {
  ORDER_BOOK,
  ORDERS,
  getRemainingQuantity,
  nextOrderSequence,
  type Order,
  type OrderBook,
} from "../store/order-book.js";
import {
  BALANCES,
  type UserBalances,
} from "../store/exchange-store.js";
import {
  createEngineSnapshot,
  restoreEngineSnapshot,
} from "../store/snapshot.js";
import { matchOrders } from "../matching-engine.js";
import {
  commitMatchingPlan,
  removeOrderFromBook,
  validateMatchingPlan,
} from "../matching-executor.js";
import { releaseOrderReservedFunds } from "../settlement.js";
import { parseMarket } from "../utils/market.js";

interface OrderPayload {
  userId: string;
  market: string;
  side: "BUY" | "SELL";
  price: number;
  quantity: number;
}

interface CancelOrderPayload {
  userId: string;
  orderId: string;
}

interface GetOrderPayload {
  userId: string;
  orderId: string;
}

function assertNonEmptyString(
  value: unknown,
  name: string,
): asserts value is string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new Error(`${name} is required`);
  }
}

function assertPayloadObject(
  payload: unknown,
  name: string,
): void {
  if (
    payload === null ||
    typeof payload !== "object"
  ) {
    throw new Error(`${name} payload is required`);
  }
}

function validateOrderPayload(
  payload: OrderPayload,
): {
  userId: string;
  market: string;
  side: "BUY" | "SELL";
  price: number;
  quantity: number;
} {
  assertPayloadObject(payload, "order");

  const userId = payload.userId as unknown;
  const market = payload.market;
  const side = payload.side as unknown;
  const price = payload.price as unknown;
  const quantity = payload.quantity as unknown;

  assertNonEmptyString(userId, "userId");

  if (side !== "BUY" && side !== "SELL") {
    throw new Error("side must be BUY or SELL");
  }

  if (
    typeof price !== "number" ||
    !Number.isFinite(price) ||
    price <= 0
  ) {
    throw new Error(
      "price must be a finite number greater than 0",
    );
  }

  if (
    typeof quantity !== "number" ||
    !Number.isFinite(quantity) ||
    quantity <= 0
  ) {
    throw new Error(
      "quantity must be a finite number greater than 0",
    );
  }

  parseMarket(market);

  return {
    userId,
    market,
    side,
    price,
    quantity,
  };
}

function getUserBalances(
  userId: string,
): UserBalances {
  const userBalances = BALANCES.get(userId);

  if (!userBalances) {
    throw new Error("user balance not found");
  }

  return userBalances;
}

function reserveOrderFunds(
  userBalances: UserBalances,
  side: "BUY" | "SELL",
  price: number,
  quantity: number,
  baseAsset: string,
  quoteAsset: string,
): void {
  if (side === "BUY") {
    const requiredAmount = price * quantity;

    if (
      !Number.isFinite(requiredAmount) ||
      requiredAmount <= 0
    ) {
      throw new Error(
        "order value must be a finite number greater than 0",
      );
    }

    const quoteBalance =
      userBalances[quoteAsset];

    if (!quoteBalance) {
      throw new Error(
        `No balance found for ${quoteAsset}`,
      );
    }

    if (quoteBalance.available < requiredAmount) {
      throw new Error(
        `insufficient ${quoteAsset} balance`,
      );
    }

    quoteBalance.available -= requiredAmount;
    quoteBalance.locked += requiredAmount;

    return;
  }

  const baseBalance = userBalances[baseAsset];

  if (!baseBalance) {
    throw new Error(
      `No balance found for ${baseAsset}`,
    );
  }

  if (baseBalance.available < quantity) {
    throw new Error(
      `insufficient ${baseAsset} balance`,
    );
  }

  baseBalance.available -= quantity;
  baseBalance.locked += quantity;
}

function getOrCreateBook(market: string): OrderBook {
  const existing = ORDER_BOOK.get(market);

  if (existing) {
    return existing;
  }

  const book: OrderBook = {
    bids: [],
    asks: [],
  };

  ORDER_BOOK.set(market, book);

  return book;
}

function addOrderToBook(
  book: OrderBook,
  order: Order,
): void {
  if (order.side === "BUY") {
    book.bids.push(order);

    book.bids.sort((a, b) => {
      if (a.price !== b.price) {
        return b.price - a.price;
      }

      return a.sequence - b.sequence;
    });

    return;
  }

  book.asks.push(order);

  book.asks.sort((a, b) => {
    if (a.price !== b.price) {
      return a.price - b.price;
    }

    return a.sequence - b.sequence;
  });
}

export function handleOrder(payload: OrderPayload) {
  const {
    userId,
    market,
    side,
    price,
    quantity,
  } = validateOrderPayload(payload);

  const { baseAsset, quoteAsset } =
    parseMarket(market);

  const userBalances = getUserBalances(userId);

  const snapshot = createEngineSnapshot();

  try {
    reserveOrderFunds(
      userBalances,
      side,
      price,
      quantity,
      baseAsset,
      quoteAsset,
    );

    const order: Order = {
      orderId: crypto.randomUUID(),
      userId,
      market,
      side,
      price,
      quantity,
      filledQuantity: 0,
      sequence: nextOrderSequence(),
      status: "OPEN",
      createdAt: Date.now(),
    };

    ORDERS.set(order.orderId, order);

    const book = getOrCreateBook(market);

    addOrderToBook(book, order);

    const matchingPlan = matchOrders(
      market,
      order.orderId,
    );

    validateMatchingPlan(matchingPlan);
    commitMatchingPlan(matchingPlan);

    return {
      order,
      trades: matchingPlan.trades,
      orderBook: book,
      balances:
        BALANCES.get(userId) ?? userBalances,
    };
  } catch (error) {
    restoreEngineSnapshot(snapshot);
    throw error;
  }
}

/**
 * Cancel an existing open or partially filled order.
 */
export function handleCancelOrder(
  payload: CancelOrderPayload,
) {
  assertPayloadObject(payload, "cancel order");

  const userId = payload.userId as unknown;
  const orderId = payload.orderId as unknown;

  assertNonEmptyString(userId, "userId");
  assertNonEmptyString(orderId, "orderId");

  const order = ORDERS.get(orderId);

  if (!order) {
    throw new Error("order not found");
  }

  if (order.userId !== userId) {
    throw new Error(
      "you do not own this order",
    );
  }

  const snapshot = createEngineSnapshot();

  try {
    const released = releaseOrderReservedFunds(order);

    order.status = "CANCELLED";

    if (
      !removeOrderFromBook(
        order.market,
        order.orderId,
      )
    ) {
      throw new Error(
        "order not found in the order book",
      );
    }

    return {
      order: {
        ...order,
        remainingQuantity:
          getRemainingQuantity(order),
      },
      released,
      balances: BALANCES.get(order.userId),
      orderBook: ORDER_BOOK.get(order.market),
    };
  } catch (error) {
    restoreEngineSnapshot(snapshot);
    throw error;
  }
}

/**
 * Get an existing order, including filled and cancelled orders, from
 * the in-memory order registry.
 */
export function handleGetOrder(
  payload: GetOrderPayload,
) {
  assertPayloadObject(payload, "get order");

  const userId = payload.userId as unknown;
  const orderId = payload.orderId as unknown;

  assertNonEmptyString(userId, "userId");
  assertNonEmptyString(orderId, "orderId");

  const order = ORDERS.get(orderId);

  if (!order || order.userId !== userId) {
    throw new Error("order not found");
  }

  return {
    order,
    remainingQuantity:
      getRemainingQuantity(order),
  };
}
