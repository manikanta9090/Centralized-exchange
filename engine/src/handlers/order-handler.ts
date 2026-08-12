import {
  ORDER_BOOK,
  type Order,
} from "../store/order-book.js";
import { BALANCES } from "../store/exchange-store.js";
import { matchOrders } from "../matching-engine.js";
import { settleTrade } from "../settlement.js";

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

export function handleOrder(
  payload: OrderPayload,
) {
  const {
    userId,
    market,
    side,
    price,
    quantity,
  } = payload;

  if (!userId) {
    throw new Error("userId is required");
  }

  if (!market) {
    throw new Error("market is required");
  }

  if (side !== "BUY" && side !== "SELL") {
    throw new Error("side must be BUY or SELL");
  }

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(
      "price must be greater than 0",
    );
  }

  if (
    !Number.isFinite(quantity) ||
    quantity <= 0
  ) {
    throw new Error(
      "quantity must be greater than 0",
    );
  }

  const userBalances = BALANCES.get(userId);

  if (!userBalances) {
    throw new Error("user balance not found");
  }

  const [baseAsset, quoteAsset] =
    market.split("_");

  if (!baseAsset || !quoteAsset) {
    throw new Error(
      "market must use BASE_QUOTE format",
    );
  }

  // Lock funds before placing the order
  if (side === "BUY") {
    const requiredAmount =
      price * quantity;

    const quoteBalance =
      userBalances[quoteAsset];

    if (!quoteBalance) {
      throw new Error(
        `No balance found for ${quoteAsset}`,
      );
    }

    if (
      quoteBalance.available <
      requiredAmount
    ) {
      throw new Error(
        `insufficient ${quoteAsset} balance`,
      );
    }

    quoteBalance.available -=
      requiredAmount;

    quoteBalance.locked +=
      requiredAmount;
  }

  if (side === "SELL") {
    const baseBalance =
      userBalances[baseAsset];

    if (!baseBalance) {
      throw new Error(
        `No balance found for ${baseAsset}`,
      );
    }

    if (
      baseBalance.available <
      quantity
    ) {
      throw new Error(
        `insufficient ${baseAsset} balance`,
      );
    }

    baseBalance.available -= quantity;

    baseBalance.locked += quantity;
  }

  // Get or create order book
  let book = ORDER_BOOK.get(market);

  if (!book) {
    book = {
      bids: [],
      asks: [],
    };

    ORDER_BOOK.set(market, book);
  }

  const order: Order = {
    orderId: crypto.randomUUID(),
    userId,
    market,
    side,
    price,
    quantity,
    filledQuantity: 0,
  };

  // Add order to order book
  if (side === "BUY") {
    book.bids.push(order);

    book.bids.sort((a, b) => {
      if (b.price !== a.price) {
        return b.price - a.price;
      }

      return a.orderId.localeCompare(
        b.orderId,
      );
    });
  } else {
    book.asks.push(order);

    book.asks.sort((a, b) => {
      if (a.price !== b.price) {
        return a.price - b.price;
      }

      return a.orderId.localeCompare(
        b.orderId,
      );
    });
  }

  // Try to match orders
  const trades = matchOrders(market);

  // Settle every matched trade
  for (const trade of trades) {
    settleTrade(trade);
  }

  return {
    order,
    trades,
    orderBook: book,
    balances: userBalances,
  };
}

/**
 * Cancel an existing open order.
 */
export function handleCancelOrder(
  payload: CancelOrderPayload,
) {
  const {
    userId,
    orderId,
  } = payload;

  if (!userId) {
    throw new Error("userId is required");
  }

  if (!orderId) {
    throw new Error("orderId is required");
  }

  // Find the order in all markets.
  for (const [market, book] of ORDER_BOOK) {
    const bidIndex = book.bids.findIndex(
      (order) =>
        order.orderId === orderId,
    );

    if (bidIndex !== -1) {
      const order =
        book.bids[bidIndex];

      if (order.userId !== userId) {
        throw new Error(
          "you do not own this order",
        );
      }

      return cancelOrderFromBook(
        market,
        book.bids,
        bidIndex,
        order,
      );
    }

    const askIndex = book.asks.findIndex(
      (order) =>
        order.orderId === orderId,
    );

    if (askIndex !== -1) {
      const order =
        book.asks[askIndex];

      if (order.userId !== userId) {
        throw new Error(
          "you do not own this order",
        );
      }

      return cancelOrderFromBook(
        market,
        book.asks,
        askIndex,
        order,
      );
    }
  }

  throw new Error(
    "order not found or already filled",
  );
}

function cancelOrderFromBook(
  market: string,
  orders: Order[],
  index: number,
  order: Order,
) {
  const userBalances =
    BALANCES.get(order.userId);

  if (!userBalances) {
    throw new Error(
      "user balance not found",
    );
  }

  const [baseAsset, quoteAsset] =
    market.split("_");

  if (!baseAsset || !quoteAsset) {
    throw new Error(
      "market must use BASE_QUOTE format",
    );
  }

  const remainingQuantity =
    order.quantity -
    order.filledQuantity;

  if (remainingQuantity <= 0) {
    throw new Error(
      "order is already completely filled",
    );
  }

  /*
   * Release the funds belonging to
   * the remaining unfilled quantity.
   */
  if (order.side === "BUY") {
    const quoteBalance =
      userBalances[quoteAsset];

    if (!quoteBalance) {
      throw new Error(
        `No balance found for ${quoteAsset}`,
      );
    }

    const remainingLockedAmount =
      order.price *
      remainingQuantity;

    if (
      quoteBalance.locked <
      remainingLockedAmount
    ) {
      throw new Error(
        "locked balance is insufficient for cancellation",
      );
    }

    quoteBalance.locked -=
      remainingLockedAmount;

    quoteBalance.available +=
      remainingLockedAmount;
  }

  if (order.side === "SELL") {
    const baseBalance =
      userBalances[baseAsset];

    if (!baseBalance) {
      throw new Error(
        `No balance found for ${baseAsset}`,
      );
    }

    if (
      baseBalance.locked <
      remainingQuantity
    ) {
      throw new Error(
        "locked balance is insufficient for cancellation",
      );
    }

    baseBalance.locked -=
      remainingQuantity;

    baseBalance.available +=
      remainingQuantity;
  }

  // Remove the order from the order book.
  orders.splice(index, 1);

  console.log(
    `Order cancelled: ${order.orderId}`,
  );

  console.log(
    `Released remaining quantity: ${remainingQuantity}`,
  );

  return {
    order: {
      ...order,
      status: "CANCELLED",
      remainingQuantity,
    },
    balances: userBalances,
    orderBook:
      ORDER_BOOK.get(market),
  };
}