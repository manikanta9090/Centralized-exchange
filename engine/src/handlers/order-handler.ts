import { ORDER_BOOK, type Order } from "../store/order-book.js";
import { BALANCES } from "../store/exchange-store.js";

interface OrderPayload {
  userId: string;
  market: string;
  side: "BUY" | "SELL";
  price: number;
  quantity: number;
}

export function handleOrder(payload: OrderPayload) {
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
    throw new Error("price must be greater than 0");
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("quantity must be greater than 0");
  }

  const userBalances = BALANCES.get(userId);

  if (!userBalances) {
    throw new Error("user balance not found");
  }

  const [baseAsset, quoteAsset] = market.split("_");

  if (!baseAsset || !quoteAsset) {
    throw new Error(
      "market must use BASE_QUOTE format",
    );
  }

  if (side === "BUY") {
    const requiredAmount = price * quantity;

    const quoteBalance = userBalances[quoteAsset];

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
  }

  if (side === "SELL") {
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

  if (side === "BUY") {
    book.bids.push(order);

    book.bids.sort((a, b) => {
      if (b.price !== a.price) {
        return b.price - a.price;
      }

      return a.orderId.localeCompare(b.orderId);
    });
  } else {
    book.asks.push(order);

    book.asks.sort((a, b) => {
      if (a.price !== b.price) {
        return a.price - b.price;
      }

      return a.orderId.localeCompare(b.orderId);
    });
  }

  return {
    order,
    orderBook: book,
    balances: userBalances,
  };
}