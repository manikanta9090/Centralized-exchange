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
}

export function matchOrders(
  market: string,
): Trade[] {
  const book = ORDER_BOOK.get(market);

  if (!book) {
    return [];
  }

  const trades: Trade[] = [];

  while (
    book.bids.length > 0 &&
    book.asks.length > 0
  ) {
    const bestBid = book.bids[0];
    const bestAsk = book.asks[0];

    if (bestBid.price < bestAsk.price) {
      break;
    }

    const remainingBid =
      bestBid.quantity - bestBid.filledQuantity;

    const remainingAsk =
      bestAsk.quantity - bestAsk.filledQuantity;

    const tradeQuantity = Math.min(
      remainingBid,
      remainingAsk,
    );

    const trade: Trade = {
      market,
      price: bestAsk.price,
      quantity: tradeQuantity,
      buyerOrderId: bestBid.orderId,
      sellerOrderId: bestAsk.orderId,
      buyerUserId: bestBid.userId,
      sellerUserId: bestAsk.userId,
    };

    trades.push(trade);

    bestBid.filledQuantity += tradeQuantity;
    bestAsk.filledQuantity += tradeQuantity;

    if (
      bestBid.filledQuantity >=
      bestBid.quantity
    ) {
      book.bids.shift();
    }

    if (
      bestAsk.filledQuantity >=
      bestAsk.quantity
    ) {
      book.asks.shift();
    }
  }

  return trades;
}