import { BALANCES } from "./store/exchange-store.js";
import type { Trade } from "./matching-engine.js";
import {
  getRemainingQuantity,
  type Order,
} from "./store/order-book.js";
import { parseMarket } from "./utils/market.js";

/**
 * Tolerance used only to absorb binary floating-point noise while
 * validating otherwise exact balances. Phase 2 should replace
 * floating-point amounts with a decimal representation.
 */
export const BALANCE_EPSILON = 1e-9;

export function balanceTolerance(value: number): number {
  return Math.max(
    BALANCE_EPSILON,
    Math.abs(value) * Number.EPSILON * 16,
  );
}

function toNonNegative(
  value: number,
  reference: number,
): number {
  if (value >= 0) {
    return value;
  }

  if (value > -balanceTolerance(reference)) {
    return 0;
  }

  throw new Error("balance underflow");
}

function assertPositiveFinite(
  value: number,
  name: string,
): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(
      `${name} must be a finite number greater than 0`,
    );
  }
}

/**
 * Validate a single trade without mutating any state.
 */
export function validateTrade(trade: Trade): void {
  const { baseAsset, quoteAsset } = parseMarket(
    trade.market,
  );

  assertPositiveFinite(trade.price, "trade price");
  assertPositiveFinite(
    trade.quantity,
    "trade quantity",
  );

  if (!trade.buyerUserId || !trade.sellerUserId) {
    throw new Error(
      "buyer and seller user ids are required",
    );
  }

  if (trade.buyerUserId === trade.sellerUserId) {
    throw new Error(
      "self-trades are not allowed",
    );
  }

  const buyerLimitPrice =
    trade.buyerLimitPrice ?? trade.price;

  const sellerLimitPrice =
    trade.sellerLimitPrice ?? trade.price;

  assertPositiveFinite(
    buyerLimitPrice,
    "buyer limit price",
  );
  assertPositiveFinite(
    sellerLimitPrice,
    "seller limit price",
  );

  if (
    trade.price >
    buyerLimitPrice +
      balanceTolerance(buyerLimitPrice)
  ) {
    throw new Error(
      "execution price exceeds buyer limit",
    );
  }

  if (
    trade.price <
    sellerLimitPrice -
      balanceTolerance(sellerLimitPrice)
  ) {
    throw new Error(
      "execution price is below seller limit",
    );
  }

  const buyerBalances = BALANCES.get(
    trade.buyerUserId,
  );

  const sellerBalances = BALANCES.get(
    trade.sellerUserId,
  );

  if (!buyerBalances) {
    throw new Error("buyer balance not found");
  }

  if (!sellerBalances) {
    throw new Error("seller balance not found");
  }

  const buyerQuoteBalance =
    buyerBalances[quoteAsset];

  const sellerBaseBalance =
    sellerBalances[baseAsset];

  if (!buyerQuoteBalance) {
    throw new Error(
      `buyer ${quoteAsset} balance not found`,
    );
  }

  if (!sellerBaseBalance) {
    throw new Error(
      `seller ${baseAsset} balance not found`,
    );
  }

  const reservedQuote =
    buyerLimitPrice * trade.quantity;

  const reservedBase = trade.quantity;

  assertPositiveFinite(
    reservedQuote,
    "reserved quote amount",
  );

  if (
    buyerQuoteBalance.locked +
      balanceTolerance(reservedQuote) <
    reservedQuote
  ) {
    throw new Error(
      "buyer locked balance is insufficient",
    );
  }

  if (
    sellerBaseBalance.locked +
      balanceTolerance(reservedBase) <
    reservedBase
  ) {
    throw new Error(
      "seller locked balance is insufficient",
    );
  }
}

/**
 * Validate a cancellation before mutating balances.
 */
export function validateOrderCancellation(
  order: Order,
): void {
  const remainingQuantity =
    getRemainingQuantity(order);

  if (remainingQuantity <= 0) {
    throw new Error(
      "order is already completely filled",
    );
  }

  if (
    order.status === "CANCELLED" ||
    order.status === "FILLED"
  ) {
    throw new Error(
      `order is already ${order.status.toLowerCase()}`,
    );
  }

  const { baseAsset, quoteAsset } = parseMarket(
    order.market,
  );

  const userBalances = BALANCES.get(order.userId);

  if (!userBalances) {
    throw new Error("user balance not found");
  }

  if (order.side === "BUY") {
    assertPositiveFinite(
      order.price,
      "order price",
    );

    const quoteBalance =
      userBalances[quoteAsset];

    if (!quoteBalance) {
      throw new Error(
        `No balance found for ${quoteAsset}`,
      );
    }

    const required =
      order.price * remainingQuantity;

    assertPositiveFinite(
      required,
      "remaining locked amount",
    );

    if (
      quoteBalance.locked +
        balanceTolerance(required) <
      required
    ) {
      throw new Error(
        "locked balance is insufficient for cancellation",
      );
    }
  }

  if (order.side === "SELL") {
    const baseBalance = userBalances[baseAsset];

    if (!baseBalance) {
      throw new Error(
        `No balance found for ${baseAsset}`,
      );
    }

    if (
      baseBalance.locked +
        balanceTolerance(remainingQuantity) <
      remainingQuantity
    ) {
      throw new Error(
        "locked balance is insufficient for cancellation",
      );
    }
  }
}

export interface ReleasedFunds {
  userId: string;
  asset: string;
  amount: number;
}

/**
 * Release all funds reserved for the unfilled portion of an order.
 * Validation happens before any mutation.
 */
export function releaseOrderReservedFunds(
  order: Order,
): ReleasedFunds {
  validateOrderCancellation(order);

  const remainingQuantity =
    getRemainingQuantity(order);

  const { baseAsset, quoteAsset } = parseMarket(
    order.market,
  );

  const userBalances = BALANCES.get(order.userId);

  if (!userBalances) {
    throw new Error("user balance not found");
  }

  if (order.side === "BUY") {
    const quoteBalance =
      userBalances[quoteAsset];

    if (!quoteBalance) {
      throw new Error(
        `No balance found for ${quoteAsset}`,
      );
    }

    const released =
      order.price * remainingQuantity;

    quoteBalance.locked = toNonNegative(
      quoteBalance.locked - released,
      quoteBalance.locked,
    );

    quoteBalance.available += released;

    return {
      userId: order.userId,
      asset: quoteAsset,
      amount: released,
    };
  }

  const baseBalance = userBalances[baseAsset];

  if (!baseBalance) {
    throw new Error(
      `No balance found for ${baseAsset}`,
    );
  }

  baseBalance.locked = toNonNegative(
    baseBalance.locked - remainingQuantity,
    baseBalance.locked,
  );

  baseBalance.available += remainingQuantity;

  return {
    userId: order.userId,
    asset: baseAsset,
    amount: remainingQuantity,
  };
}

/**
 * Settle one trade atomically.
 *
 * Buyer funds were reserved at the buyer's limit price. The buyer is
 * debited the execution value and the price improvement (limit price
 * minus execution price) is returned to available balance.
 *
 * All validation and arithmetic checks happen before any balance is
 * mutated.
 */
export function settleTrade(trade: Trade): void {
  validateTrade(trade);

  const { baseAsset, quoteAsset } = parseMarket(
    trade.market,
  );

  const buyerBalances = BALANCES.get(
    trade.buyerUserId,
  );

  const sellerBalances = BALANCES.get(
    trade.sellerUserId,
  );

  if (!buyerBalances || !sellerBalances) {
    throw new Error(
      "buyer or seller balance not found",
    );
  }

  const buyerQuoteBalance =
    buyerBalances[quoteAsset];

  const sellerBaseBalance =
    sellerBalances[baseAsset];

  if (!buyerQuoteBalance) {
    throw new Error(
      `buyer ${quoteAsset} balance not found`,
    );
  }

  if (!sellerBaseBalance) {
    throw new Error(
      "seller base balance not found",
    );
  }

  const buyerLimitPrice =
    trade.buyerLimitPrice ?? trade.price;

  const reservedQuote =
    buyerLimitPrice * trade.quantity;

  const tradeValue =
    trade.price * trade.quantity;

  const rawPriceImprovement =
    reservedQuote - tradeValue;

  if (
    rawPriceImprovement <
    -balanceTolerance(reservedQuote)
  ) {
    throw new Error(
      "execution price exceeds buyer limit",
    );
  }

  const priceImprovement =
    Math.max(0, rawPriceImprovement);

  const buyerLockedAfter =
    buyerQuoteBalance.locked - reservedQuote;

  const sellerLockedAfter =
    sellerBaseBalance.locked - trade.quantity;

  if (
    buyerLockedAfter <
      -balanceTolerance(buyerQuoteBalance.locked) ||
    sellerLockedAfter <
      -balanceTolerance(sellerBaseBalance.locked)
  ) {
    throw new Error(
      "settlement would produce a negative locked balance",
    );
  }

  // All checks passed. Commit all transfers together.
  buyerQuoteBalance.locked = toNonNegative(
    buyerLockedAfter,
    buyerQuoteBalance.locked,
  );

  buyerQuoteBalance.available += priceImprovement;

  sellerBaseBalance.locked = toNonNegative(
    sellerLockedAfter,
    sellerBaseBalance.locked,
  );

  const buyerBaseBalance =
    buyerBalances[baseAsset] ?? {
      available: 0,
      locked: 0,
    };

  buyerBaseBalance.available += trade.quantity;

  buyerBalances[baseAsset] = buyerBaseBalance;

  const sellerQuoteBalance =
    sellerBalances[quoteAsset] ?? {
      available: 0,
      locked: 0,
    };

  sellerQuoteBalance.available += tradeValue;

  sellerBalances[quoteAsset] = sellerQuoteBalance;
}
