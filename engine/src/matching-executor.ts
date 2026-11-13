import type {
  MatchingPlan,
  Trade,
} from "./matching-engine.js";
import { BALANCES } from "./store/exchange-store.js";
import {
  ORDER_BOOK,
  ORDERS,
  getRemainingQuantity,
} from "./store/order-book.js";
import {
  balanceTolerance,
  releaseOrderReservedFunds,
  settleTrade,
  validateOrderCancellation,
  validateTrade,
} from "./settlement.js";
import { parseMarket } from "./utils/market.js";

interface LockRequirement {
  userId: string;
  asset: string;
  amount: number;
}

function requirementKey(
  userId: string,
  asset: string,
): string {
  return `${userId}\u0000${asset}`;
}

function addRequirement(
  requirements: Map<string, LockRequirement>,
  userId: string,
  asset: string,
  amount: number,
): void {
  const key = requirementKey(userId, asset);
  const existing = requirements.get(key);

  if (existing) {
    existing.amount += amount;
    return;
  }

  requirements.set(key, {
    userId,
    asset,
    amount,
  });
}

function assertLockedBalanceAvailable(
  requirement: LockRequirement,
): void {
  const userBalances = BALANCES.get(
    requirement.userId,
  );

  if (!userBalances) {
    throw new Error(
      `balance not found for user ${requirement.userId}`,
    );
  }

  const balance =
    userBalances[requirement.asset];

  if (!balance) {
    throw new Error(
      `balance not found for ${requirement.asset}`,
    );
  }

  if (
    balance.locked +
      balanceTolerance(requirement.amount) <
    requirement.amount
  ) {
    throw new Error(
      `locked ${requirement.asset} balance is insufficient`,
    );
  }
}

export function orderExistsInBook(
  market: string,
  orderId: string,
): boolean {
  const book = ORDER_BOOK.get(market);

  if (!book) {
    return false;
  }

  return (
    book.bids.some(
      (order) => order.orderId === orderId,
    ) ||
    book.asks.some(
      (order) => order.orderId === orderId,
    )
  );
}

export function removeOrderFromBook(
  market: string,
  orderId: string,
): boolean {
  const book = ORDER_BOOK.get(market);

  if (!book) {
    return false;
  }

  const bidIndex = book.bids.findIndex(
    (order) => order.orderId === orderId,
  );

  if (bidIndex !== -1) {
    book.bids.splice(bidIndex, 1);
    return true;
  }

  const askIndex = book.asks.findIndex(
    (order) => order.orderId === orderId,
  );

  if (askIndex !== -1) {
    book.asks.splice(askIndex, 1);
    return true;
  }

  return false;
}

/**
 * Validate all trades, fills and self-trade cancellations before any
 * state is committed.
 */
export function validateMatchingPlan(
  plan: MatchingPlan,
): void {
  const requirements = new Map<
    string,
    LockRequirement
  >();

  for (const trade of plan.trades) {
    validateTrade(trade);

    if (
      trade.buyerUserId === trade.sellerUserId
    ) {
      throw new Error(
        "self-trades are not allowed",
      );
    }

    const { baseAsset, quoteAsset } = parseMarket(
      trade.market,
    );

    const buyerLimitPrice =
      trade.buyerLimitPrice ?? trade.price;

    addRequirement(
      requirements,
      trade.buyerUserId,
      quoteAsset,
      buyerLimitPrice * trade.quantity,
    );

    addRequirement(
      requirements,
      trade.sellerUserId,
      baseAsset,
      trade.quantity,
    );
  }

  for (const requirement of requirements.values()) {
    assertLockedBalanceAvailable(requirement);
  }

  for (const [orderId, filledQuantity] of plan.fills) {
    const order = ORDERS.get(orderId);

    if (!order) {
      throw new Error(
        `filled order ${orderId} not found`,
      );
    }

    if (
      !Number.isFinite(filledQuantity) ||
      filledQuantity <= 0
    ) {
      throw new Error(
        "invalid fill quantity",
      );
    }

    const remainingQuantity =
      getRemainingQuantity(order);

    if (
      filledQuantity >
      remainingQuantity +
        balanceTolerance(remainingQuantity)
    ) {
      throw new Error(
        `fill quantity exceeds remaining quantity for order ${orderId}`,
      );
    }

    if (!orderExistsInBook(order.market, orderId)) {
      throw new Error(
        `filled order ${orderId} is not in the order book`,
      );
    }
  }

  for (const orderId of plan.cancelledOrderIds) {
    const order = ORDERS.get(orderId);

    if (!order) {
      throw new Error(
        `cancelled order ${orderId} not found`,
      );
    }

    validateOrderCancellation(order);

    if (!orderExistsInBook(order.market, orderId)) {
      throw new Error(
        `order ${orderId} is not in the order book`,
      );
    }
  }
}

function applyFills(plan: MatchingPlan): void {
  for (const [orderId, filledQuantity] of plan.fills) {
    const order = ORDERS.get(orderId);

    if (!order) {
      throw new Error(
        `filled order ${orderId} not found`,
      );
    }

    order.filledQuantity += filledQuantity;

    const remainingQuantity =
      getRemainingQuantity(order);

    if (
      remainingQuantity <=
      balanceTolerance(order.quantity)
    ) {
      order.filledQuantity = order.quantity;
      order.status = "FILLED";

      if (
        !removeOrderFromBook(
          order.market,
          order.orderId,
        )
      ) {
        throw new Error(
          `filled order ${order.orderId} is missing from the order book`,
        );
      }

      continue;
    }

    order.status = "PARTIALLY_FILLED";
  }
}

/**
 * Commit a previously validated matching plan.
 *
 * The caller is expected to wrap this in a snapshot/restore boundary
 * so that an unexpected failure cannot leave partial state behind.
 */
export function commitMatchingPlan(
  plan: MatchingPlan,
): void {
  // Settle every trade before removing or cancelling any order.
  for (const trade of plan.trades) {
    settleTrade(trade);
  }

  for (const orderId of plan.cancelledOrderIds) {
    const order = ORDERS.get(orderId);

    if (!order) {
      throw new Error(
        `cancelled order ${orderId} not found`,
      );
    }

    releaseOrderReservedFunds(order);

    order.status = "CANCELLED";

    if (
      !removeOrderFromBook(
        order.market,
        order.orderId,
      )
    ) {
      throw new Error(
        `cancelled order ${order.orderId} is missing from the order book`,
      );
    }
  }

  applyFills(plan);
}

export type { Trade };
