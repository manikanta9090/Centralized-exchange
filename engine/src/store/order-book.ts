export type OrderSide = "BUY" | "SELL";

export type OrderStatus =
  | "OPEN"
  | "PARTIALLY_FILLED"
  | "FILLED"
  | "CANCELLED";

export interface Order {
  orderId: string;
  userId: string;
  market: string;
  side: OrderSide;
  price: number;
  quantity: number;
  filledQuantity: number;
  /**
   * Monotonically increasing placement sequence.
   * Used as the deterministic FIFO tie-breaker for orders
   * resting at the same price.
   */
  sequence: number;
  status: OrderStatus;
  createdAt: number;
}

export interface OrderBook {
  bids: Order[];
  asks: Order[];
}

export const ORDER_BOOK = new Map<string, OrderBook>();

/**
 * Every order ever accepted by the engine, including filled and
 * cancelled orders. Phase 1 keeps this in memory only; it is not
 * a replacement for durable order history.
 */
export const ORDERS = new Map<string, Order>();

let orderSequence = 0;

export function nextOrderSequence(): number {
  orderSequence += 1;
  return orderSequence;
}

export function getRemainingQuantity(order: Order): number {
  return order.quantity - order.filledQuantity;
}

export function resetOrderBookState(): void {
  ORDER_BOOK.clear();
  ORDERS.clear();
  orderSequence = 0;
}
