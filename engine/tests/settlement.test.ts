
import { describe, expect, test, beforeEach } from "bun:test";

import { BALANCES } from "../src/store/exchange-store.js";
import { settleTrade } from "../src/settlement.js";

describe("Trade Settlement", () => {
  beforeEach(() => {
    BALANCES.clear();
  });

  test("should create missing asset balances during settlement", () => {
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

    const trade = {
      market: "SOL_USD",
      price: 90,
      quantity: 2,
      buyerOrderId: "buy_1",
      sellerOrderId: "sell_1",
      buyerUserId: buyerId,
      sellerUserId: sellerId,
    };

    settleTrade(trade);

    const buyerBalances = BALANCES.get(buyerId)!;
    const sellerBalances = BALANCES.get(sellerId)!;

    expect(buyerBalances.SOL).toEqual({
      available: 2,
      locked: 0,
    });

    expect(buyerBalances.USD).toEqual({
      available: 820,
      locked: 0,
    });

    expect(sellerBalances.SOL).toEqual({
      available: 8,
      locked: 0,
    });

    expect(sellerBalances.USD).toEqual({
      available: 180,
      locked: 0,
    });
  });
});
