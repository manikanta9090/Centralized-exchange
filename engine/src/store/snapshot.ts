import {
  ORDER_BOOK,
  ORDERS,
  type Order,
  type OrderBook,
} from "./order-book.js";
import {
  BALANCES,
  type UserBalances,
} from "./exchange-store.js";

export interface EngineSnapshot {
  balances: Map<string, UserBalances>;
  orderBooks: Map<string, OrderBook>;
  orders: Map<string, Order>;
}

function cloneBalances(): Map<string, UserBalances> {
  const balances = new Map<string, UserBalances>();

  for (const [userId, assets] of BALANCES) {
    const clone: UserBalances = {};

    for (const [asset, balance] of Object.entries(assets)) {
      clone[asset] = {
        available: balance.available,
        locked: balance.locked,
      };
    }

    balances.set(userId, clone);
  }

  return balances;
}

/**
 * Capture the complete in-memory engine state.
 *
 * Phase 1 prioritizes correctness over throughput. Taking a full
 * snapshot per mutating command is O(users + orders); this can be
 * narrowed to affected accounts/orders in a later phase.
 */
export function createEngineSnapshot(): EngineSnapshot {
  const orders = new Map<string, Order>();

  for (const [orderId, order] of ORDERS) {
    orders.set(orderId, { ...order });
  }

  const orderBooks = new Map<string, OrderBook>();

  for (const [market, book] of ORDER_BOOK) {
    orderBooks.set(market, {
      bids: book.bids.map(
        (order) =>
          orders.get(order.orderId) ?? { ...order },
      ),
      asks: book.asks.map(
        (order) =>
          orders.get(order.orderId) ?? { ...order },
      ),
    });
  }

  return {
    balances: cloneBalances(),
    orderBooks,
    orders,
  };
}

export function restoreEngineSnapshot(
  snapshot: EngineSnapshot,
): void {
  BALANCES.clear();

  for (const [userId, assets] of snapshot.balances) {
    const clone: UserBalances = {};

    for (const [asset, balance] of Object.entries(assets)) {
      clone[asset] = {
        available: balance.available,
        locked: balance.locked,
      };
    }

    BALANCES.set(userId, clone);
  }

  ORDERS.clear();

  for (const [orderId, order] of snapshot.orders) {
    ORDERS.set(orderId, { ...order });
  }

  ORDER_BOOK.clear();

  for (const [market, book] of snapshot.orderBooks) {
    ORDER_BOOK.set(market, {
      bids: book.bids.map(
        (order) =>
          ORDERS.get(order.orderId) ?? { ...order },
      ),
      asks: book.asks.map(
        (order) =>
          ORDERS.get(order.orderId) ?? { ...order },
      ),
    });
  }
}
