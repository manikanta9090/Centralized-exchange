import {
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";

import { BALANCES } from "../src/store/exchange-store.js";
import { settleTrade } from "../src/settlement.js";
import type { Trade } from "../src/matching-engine.js";
import {
  balanceOf,
  hasBalance,
  resetEngineState,
} from "./helpers.js";

describe("Trade Settlement", () => {
  beforeEach(() => {
    resetEngineState();
  });

  test("1. creates missing asset balances during settlement", () => {
    const buyerId = "buyer_test";
    const sellerId = "seller_test";

    // Buyer has only USD.
    BALANCES.set(buyerId, {
      USD: {
        available: 820,
        locked: 180,
      },
    });

    // Seller has only SOL.
    BALANCES.set(sellerId, {
      SOL: {
        available: 8,
        locked: 2,
      },
    });

    const trade: Trade = {
      market: "SOL_USD",
      price: 90,
      quantity: 2,
      buyerOrderId: "buy_1",
      sellerOrderId: "sell_1",
      buyerUserId: buyerId,
      sellerUserId: sellerId,
      buyerLimitPrice: 90,
      sellerLimitPrice: 90,
    };

    settleTrade(trade);

    expect(hasBalance(buyerId, "SOL")).toBe(true);
    expect(hasBalance(sellerId, "USD")).toBe(true);

    expect(balanceOf(buyerId, "SOL")).toEqual({
      available: 2,
      locked: 0,
    });

    expect(balanceOf(buyerId, "USD")).toEqual({
      available: 820,
      locked: 0,
    });

    expect(balanceOf(sellerId, "SOL")).toEqual({
      available: 8,
      locked: 0,
    });

    expect(balanceOf(sellerId, "USD")).toEqual({
      available: 180,
      locked: 0,
    });
  });

  test("settles at execution price and refunds buyer price improvement", () => {
    const buyerId = "buyer_improvement";
    const sellerId = "seller_improvement";

    BALANCES.set(buyerId, {
      USD: {
        available: 0,
        locked: 100,
      },
    });

    BALANCES.set(sellerId, {
      SOL: {
        available: 0,
        locked: 1,
      },
    });

    settleTrade({
      market: "SOL_USD",
      price: 90,
      quantity: 1,
      buyerOrderId: "buy_1",
      sellerOrderId: "sell_1",
      buyerUserId: buyerId,
      sellerUserId: sellerId,
      buyerLimitPrice: 100,
      sellerLimitPrice: 90,
    });

    expect(balanceOf(buyerId, "USD")).toEqual({
      available: 10,
      locked: 0,
    });

    expect(balanceOf(buyerId, "SOL")).toEqual({
      available: 1,
      locked: 0,
    });

    expect(balanceOf(sellerId, "USD")).toEqual({
      available: 90,
      locked: 0,
    });

    expect(balanceOf(sellerId, "SOL")).toEqual({
      available: 0,
      locked: 0,
    });
  });

  test("settlement failure does not mutate any balance", () => {
    const buyerId = "buyer_failure";
    const sellerId = "seller_failure";

    BALANCES.set(buyerId, {
      USD: {
        available: 0,
        locked: 100,
      },
    });

    BALANCES.set(sellerId, {
      SOL: {
        available: 1,
        locked: 0,
      },
    });

    expect(() =>
      settleTrade({
        market: "SOL_USD",
        price: 90,
        quantity: 1,
        buyerOrderId: "buy_1",
        sellerOrderId: "sell_1",
        buyerUserId: buyerId,
        sellerUserId: sellerId,
        buyerLimitPrice: 100,
        sellerLimitPrice: 90,
      }),
    ).toThrow("seller locked balance is insufficient");

    expect(balanceOf(buyerId, "USD")).toEqual({
      available: 0,
      locked: 100,
    });

    expect(balanceOf(sellerId, "SOL")).toEqual({
      available: 1,
      locked: 0,
    });

    expect(hasBalance(buyerId, "SOL")).toBe(false);
    expect(hasBalance(sellerId, "USD")).toBe(false);
  });
});
