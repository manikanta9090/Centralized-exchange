import {
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";

import {
  ORDER_BOOK,
  ORDERS,
} from "../src/store/order-book.js";
import {
  balanceOf,
  deposit,
  hasBalance,
  placeOrder,
  resetEngineState,
} from "./helpers.js";

describe("Atomic matching and settlement", () => {
  beforeEach(() => {
    resetEngineState();
  });

  test("19. rolls back balances and the book when settlement validation fails", () => {
    const buyerId = "buyer";
    const sellerId = "seller";

    deposit(sellerId, "SOL", 1);

    const sellResult = placeOrder(
      sellerId,
      "SOL_USD",
      "SELL",
      100,
      1,
    );

    // Simulate corrupted state: the resting sell no longer has its
    // base funds locked.
    balanceOf(sellerId, "SOL").locked = 0;

    deposit(buyerId, "USD", 100);

    expect(() =>
      placeOrder(
        buyerId,
        "SOL_USD",
        "BUY",
        100,
        1,
      ),
    ).toThrow(
      "seller locked balance is insufficient",
    );

    // The buyer's lock and order must have been rolled back.
    expect(balanceOf(buyerId, "USD")).toEqual({
      available: 100,
      locked: 0,
    });

    expect(hasBalance(buyerId, "SOL")).toBe(false);

    // The seller's state is exactly what it was before the attempt.
    expect(balanceOf(sellerId, "SOL")).toEqual({
      available: 0,
      locked: 0,
    });

    expect(ORDERS.size).toBe(1);
    expect(ORDERS.has(sellResult.order.orderId)).toBe(
      true,
    );

    expect(
      sellResult.order.filledQuantity,
    ).toBe(0);
  });

  test("20. keeps the order book consistent after a failed placement", () => {
    const buyerId = "buyer";
    const sellerId = "seller";

    deposit(sellerId, "SOL", 1);

    const sellResult = placeOrder(
      sellerId,
      "SOL_USD",
      "SELL",
      100,
      1,
    );

    balanceOf(sellerId, "SOL").locked = 0;

    deposit(buyerId, "USD", 100);

    expect(() =>
      placeOrder(
        buyerId,
        "SOL_USD",
        "BUY",
        100,
        1,
      ),
    ).toThrow();

    const book = ORDER_BOOK.get("SOL_USD");

    expect(book).toBeDefined();
    expect(book?.bids).toHaveLength(0);
    expect(book?.asks).toHaveLength(1);
    expect(book?.asks[0]?.orderId).toBe(
      sellResult.order.orderId,
    );
    expect(book?.asks[0]?.filledQuantity).toBe(0);

    // Repair the simulated corruption and verify the unchanged book
    // can still process a valid order.
    balanceOf(sellerId, "SOL").locked = 1;

    const result = placeOrder(
      buyerId,
      "SOL_USD",
      "BUY",
      100,
      1,
    );

    expect(result.trades).toHaveLength(1);
    expect(result.orderBook.bids).toHaveLength(0);
    expect(result.orderBook.asks).toHaveLength(0);

    expect(balanceOf(buyerId, "SOL")).toEqual({
      available: 1,
      locked: 0,
    });

    expect(balanceOf(sellerId, "USD")).toEqual({
      available: 100,
      locked: 0,
    });
  });
});
