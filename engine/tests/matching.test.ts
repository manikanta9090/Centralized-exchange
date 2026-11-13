import {
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";

import {
  balanceOf,
  deposit,
  hasBalance,
  placeOrder,
  resetEngineState,
} from "./helpers.js";

describe("Matching engine", () => {
  beforeEach(() => {
    resetEngineState();
  });

  test("6. executes an incoming BUY at the resting maker price", () => {
    const buyerId = "buyer";
    const sellerId = "seller";

    deposit(sellerId, "SOL", 1);
    deposit(buyerId, "USD", 120);

    placeOrder(sellerId, "SOL_USD", "SELL", 100, 1);

    const result = placeOrder(
      buyerId,
      "SOL_USD",
      "BUY",
      120,
      1,
    );

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0]?.price).toBe(100);

    expect(balanceOf(buyerId, "USD")).toEqual({
      available: 20,
      locked: 0,
    });

    expect(balanceOf(sellerId, "USD")).toEqual({
      available: 100,
      locked: 0,
    });
  });

  test("7. executes an incoming SELL at the resting maker price", () => {
    const buyerId = "buyer";
    const sellerId = "seller";

    deposit(buyerId, "USD", 100);
    deposit(sellerId, "SOL", 1);

    placeOrder(buyerId, "SOL_USD", "BUY", 100, 1);

    const result = placeOrder(
      sellerId,
      "SOL_USD",
      "SELL",
      80,
      1,
    );

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0]?.price).toBe(100);

    expect(balanceOf(sellerId, "USD")).toEqual({
      available: 100,
      locked: 0,
    });

    expect(balanceOf(buyerId, "SOL")).toEqual({
      available: 1,
      locked: 0,
    });
  });

  test("10. matches across multiple price levels", () => {
    const buyerId = "buyer";
    const sellerOne = "seller_one";
    const sellerTwo = "seller_two";
    const sellerThree = "seller_three";

    deposit(buyerId, "USD", 360);
    deposit(sellerOne, "SOL", 1);
    deposit(sellerTwo, "SOL", 1);
    deposit(sellerThree, "SOL", 1);

    placeOrder(
      sellerOne,
      "SOL_USD",
      "SELL",
      100,
      1,
    );
    placeOrder(
      sellerTwo,
      "SOL_USD",
      "SELL",
      110,
      1,
    );
    placeOrder(
      sellerThree,
      "SOL_USD",
      "SELL",
      120,
      1,
    );

    const result = placeOrder(
      buyerId,
      "SOL_USD",
      "BUY",
      120,
      3,
    );

    expect(
      result.trades.map((trade) => trade.price),
    ).toEqual([100, 110, 120]);

    expect(balanceOf(buyerId, "USD")).toEqual({
      available: 30,
      locked: 0,
    });

    expect(balanceOf(buyerId, "SOL")).toEqual({
      available: 3,
      locked: 0,
    });

    expect(balanceOf(sellerOne, "USD")).toEqual({
      available: 100,
      locked: 0,
    });

    expect(balanceOf(sellerTwo, "USD")).toEqual({
      available: 110,
      locked: 0,
    });

    expect(balanceOf(sellerThree, "USD")).toEqual({
      available: 120,
      locked: 0,
    });

    expect(result.orderBook.bids).toHaveLength(0);
    expect(result.orderBook.asks).toHaveLength(0);
  });

  test("11. respects price priority", () => {
    const buyerId = "buyer";
    const expensiveSeller = "expensive_seller";
    const cheaperSeller = "cheaper_seller";

    deposit(buyerId, "USD", 120);
    deposit(expensiveSeller, "SOL", 1);
    deposit(cheaperSeller, "SOL", 1);

    placeOrder(
      expensiveSeller,
      "SOL_USD",
      "SELL",
      110,
      1,
    );

    placeOrder(
      cheaperSeller,
      "SOL_USD",
      "SELL",
      100,
      1,
    );

    const result = placeOrder(
      buyerId,
      "SOL_USD",
      "BUY",
      120,
      1,
    );

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0]?.price).toBe(100);
    expect(
      result.trades[0]?.sellerUserId,
    ).toBe(cheaperSeller);

    expect(balanceOf(cheaperSeller, "USD")).toEqual({
      available: 100,
      locked: 0,
    });

    expect(hasBalance(expensiveSeller, "USD")).toBe(
      false,
    );

    expect(
      balanceOf(expensiveSeller, "SOL"),
    ).toEqual({
      available: 0,
      locked: 1,
    });
  });

  test("12. respects FIFO time priority at the same price", () => {
    const buyerId = "buyer";
    const firstSeller = "first_seller";
    const secondSeller = "second_seller";

    deposit(buyerId, "USD", 100);
    deposit(firstSeller, "SOL", 1);
    deposit(secondSeller, "SOL", 1);

    const firstOrder = placeOrder(
      firstSeller,
      "SOL_USD",
      "SELL",
      100,
      1,
    ).order;

    const secondOrder = placeOrder(
      secondSeller,
      "SOL_USD",
      "SELL",
      100,
      1,
    ).order;

    const result = placeOrder(
      buyerId,
      "SOL_USD",
      "BUY",
      100,
      1,
    );

    expect(result.trades).toHaveLength(1);
    expect(
      result.trades[0]?.sellerOrderId,
    ).toBe(firstOrder.orderId);

    expect(firstOrder.status).toBe("FILLED");
    expect(secondOrder.status).toBe("OPEN");

    expect(balanceOf(firstSeller, "USD")).toEqual({
      available: 100,
      locked: 0,
    });

    expect(hasBalance(secondSeller, "USD")).toBe(false);
  });

  test("13. prevents self-trades by cancelling the resting maker", () => {
    const userId = "self_trader";

    deposit(userId, "SOL", 1);
    deposit(userId, "USD", 100);

    const sellResult = placeOrder(
      userId,
      "SOL_USD",
      "SELL",
      100,
      1,
    );

    const buyResult = placeOrder(
      userId,
      "SOL_USD",
      "BUY",
      100,
      1,
    );

    expect(buyResult.trades).toHaveLength(0);

    expect(sellResult.order.status).toBe(
      "CANCELLED",
    );

    expect(buyResult.order.status).toBe("OPEN");

    expect(balanceOf(userId, "SOL")).toEqual({
      available: 1,
      locked: 0,
    });

    expect(balanceOf(userId, "USD")).toEqual({
      available: 0,
      locked: 100,
    });

    expect(buyResult.orderBook.asks).toHaveLength(0);
    expect(buyResult.orderBook.bids).toHaveLength(1);
  });

  test("13b. self-trade prevention still matches other users' orders", () => {
    const selfTrader = "self_trader";
    const otherSeller = "other_seller";

    deposit(selfTrader, "SOL", 1);
    deposit(selfTrader, "USD", 100);
    deposit(otherSeller, "SOL", 1);

    const ownSell = placeOrder(
      selfTrader,
      "SOL_USD",
      "SELL",
      100,
      1,
    ).order;

    const otherSell = placeOrder(
      otherSeller,
      "SOL_USD",
      "SELL",
      100,
      1,
    ).order;

    const buyResult = placeOrder(
      selfTrader,
      "SOL_USD",
      "BUY",
      100,
      1,
    );

    expect(buyResult.trades).toHaveLength(1);
    expect(
      buyResult.trades[0]?.sellerUserId,
    ).toBe(otherSeller);

    expect(ownSell.status).toBe("CANCELLED");
    expect(otherSell.status).toBe("FILLED");
    expect(buyResult.order.status).toBe("FILLED");

    expect(balanceOf(selfTrader, "SOL")).toEqual({
      available: 2,
      locked: 0,
    });

    expect(balanceOf(selfTrader, "USD")).toEqual({
      available: 0,
      locked: 0,
    });

    expect(balanceOf(otherSeller, "USD")).toEqual({
      available: 100,
      locked: 0,
    });
  });

  test("14. refunds BUY price improvement to available quote", () => {
    const buyerId = "buyer";
    const sellerId = "seller";

    deposit(sellerId, "SOL", 1);
    deposit(buyerId, "USD", 100);

    placeOrder(sellerId, "SOL_USD", "SELL", 90, 1);

    const result = placeOrder(
      buyerId,
      "SOL_USD",
      "BUY",
      100,
      1,
    );

    expect(result.trades[0]?.price).toBe(90);

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
  });
});
