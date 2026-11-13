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
  handleCancelOrder,
  handleGetOrder,
} from "../src/handlers/order-handler.js";
import {
  allBalances,
  balanceOf,
  deposit,
  hasBalance,
  placeOrder,
  resetEngineState,
} from "./helpers.js";

describe("Order lifecycle and balance accounting", () => {
  beforeEach(() => {
    resetEngineState();
  });

  test("2. settles a BUY trade between quote-only buyer and base-only seller", () => {
    const buyerId = "buyer";
    const sellerId = "seller";

    deposit(buyerId, "USD", 200);
    deposit(sellerId, "SOL", 2);

    placeOrder(sellerId, "SOL_USD", "SELL", 100, 2);

    const result = placeOrder(
      buyerId,
      "SOL_USD",
      "BUY",
      100,
      2,
    );

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0]?.price).toBe(100);

    expect(balanceOf(buyerId, "USD")).toEqual({
      available: 0,
      locked: 0,
    });

    expect(balanceOf(buyerId, "SOL")).toEqual({
      available: 2,
      locked: 0,
    });

    expect(balanceOf(sellerId, "USD")).toEqual({
      available: 200,
      locked: 0,
    });

    expect(balanceOf(sellerId, "SOL")).toEqual({
      available: 0,
      locked: 0,
    });
  });

  test("3. settles a SELL trade against a resting BUY", () => {
    const buyerId = "buyer";
    const sellerId = "seller";

    deposit(buyerId, "USD", 200);
    deposit(sellerId, "SOL", 2);

    placeOrder(buyerId, "SOL_USD", "BUY", 100, 2);

    const result = placeOrder(
      sellerId,
      "SOL_USD",
      "SELL",
      100,
      2,
    );

    expect(result.trades).toHaveLength(1);

    expect(balanceOf(buyerId, "USD")).toEqual({
      available: 0,
      locked: 0,
    });

    expect(balanceOf(buyerId, "SOL")).toEqual({
      available: 2,
      locked: 0,
    });

    expect(balanceOf(sellerId, "USD")).toEqual({
      available: 200,
      locked: 0,
    });

    expect(balanceOf(sellerId, "SOL")).toEqual({
      available: 0,
      locked: 0,
    });
  });

  test("4. creates the buyer base balance when the buyer only has quote currency", () => {
    const buyerId = "quote_only_buyer";
    const sellerId = "seller";

    deposit(buyerId, "USD", 100);
    deposit(sellerId, "SOL", 1);

    expect(hasBalance(buyerId, "SOL")).toBe(false);

    placeOrder(sellerId, "SOL_USD", "SELL", 100, 1);
    placeOrder(buyerId, "SOL_USD", "BUY", 100, 1);

    expect(hasBalance(buyerId, "SOL")).toBe(true);
    expect(balanceOf(buyerId, "SOL")).toEqual({
      available: 1,
      locked: 0,
    });
  });

  test("5. creates the seller quote balance when the seller only has base currency", () => {
    const buyerId = "buyer";
    const sellerId = "base_only_seller";

    deposit(buyerId, "USD", 100);
    deposit(sellerId, "SOL", 1);

    expect(hasBalance(sellerId, "USD")).toBe(false);

    placeOrder(buyerId, "SOL_USD", "BUY", 100, 1);
    placeOrder(sellerId, "SOL_USD", "SELL", 100, 1);

    expect(hasBalance(sellerId, "USD")).toBe(true);
    expect(balanceOf(sellerId, "USD")).toEqual({
      available: 100,
      locked: 0,
    });
  });

  test("8. fully filled orders are marked FILLED and removed from the book", () => {
    const buyerId = "buyer";
    const sellerId = "seller";

    deposit(sellerId, "SOL", 2);
    deposit(buyerId, "USD", 200);

    const sellOrder = placeOrder(
      sellerId,
      "SOL_USD",
      "SELL",
      100,
      2,
    ).order;

    const buyResult = placeOrder(
      buyerId,
      "SOL_USD",
      "BUY",
      100,
      2,
    );

    const buyOrder = buyResult.order;

    expect(buyOrder.status).toBe("FILLED");
    expect(buyOrder.filledQuantity).toBe(2);
    expect(buyResult.orderBook.bids).toHaveLength(0);
    expect(buyResult.orderBook.asks).toHaveLength(0);

    const fetchedBuy = handleGetOrder({
      userId: buyerId,
      orderId: buyOrder.orderId,
    });

    const fetchedSell = handleGetOrder({
      userId: sellerId,
      orderId: sellOrder.orderId,
    });

    expect(fetchedBuy.order.status).toBe("FILLED");
    expect(fetchedBuy.remainingQuantity).toBe(0);
    expect(fetchedSell.order.status).toBe("FILLED");
    expect(fetchedSell.remainingQuantity).toBe(0);
  });

  test("9. partially filled orders keep their remaining quantity in the book", () => {
    const buyerId = "buyer";
    const sellerId = "seller";

    deposit(sellerId, "SOL", 1);
    deposit(buyerId, "USD", 300);

    placeOrder(sellerId, "SOL_USD", "SELL", 100, 1);

    const result = placeOrder(
      buyerId,
      "SOL_USD",
      "BUY",
      100,
      3,
    );

    expect(result.order.status).toBe(
      "PARTIALLY_FILLED",
    );
    expect(result.order.filledQuantity).toBe(1);
    expect(
      result.order.quantity -
        result.order.filledQuantity,
    ).toBe(2);

    expect(
      handleGetOrder({
        userId: buyerId,
        orderId: result.order.orderId,
      }).remainingQuantity,
    ).toBe(2);

    expect(result.orderBook.bids).toHaveLength(1);
    expect(result.orderBook.asks).toHaveLength(0);

    expect(balanceOf(buyerId, "USD")).toEqual({
      available: 0,
      locked: 200,
    });

    expect(balanceOf(buyerId, "SOL")).toEqual({
      available: 1,
      locked: 0,
    });
  });

  test("15. cancelling a partially filled BUY releases all remaining locked quote", () => {
    const buyerId = "buyer";
    const sellerId = "seller";

    deposit(sellerId, "SOL", 1);
    deposit(buyerId, "USD", 240);

    placeOrder(sellerId, "SOL_USD", "SELL", 100, 1);

    const buyResult = placeOrder(
      buyerId,
      "SOL_USD",
      "BUY",
      120,
      2,
    );

    expect(buyResult.order.filledQuantity).toBe(1);

    expect(balanceOf(buyerId, "USD")).toEqual({
      available: 20,
      locked: 120,
    });

    const cancelResult = handleCancelOrder({
      userId: buyerId,
      orderId: buyResult.order.orderId,
    });

    expect(cancelResult.order.status).toBe(
      "CANCELLED",
    );
    expect(cancelResult.order.remainingQuantity).toBe(
      1,
    );

    expect(balanceOf(buyerId, "USD")).toEqual({
      available: 140,
      locked: 0,
    });

    expect(balanceOf(buyerId, "SOL")).toEqual({
      available: 1,
      locked: 0,
    });

    expect(
      buyResult.orderBook.bids,
    ).toHaveLength(0);

    const fetchedCancelled = handleGetOrder({
      userId: buyerId,
      orderId: buyResult.order.orderId,
    });

    expect(fetchedCancelled.order.status).toBe(
      "CANCELLED",
    );
    expect(
      fetchedCancelled.remainingQuantity,
    ).toBe(1);
  });

  test("16. cancelling a partially filled SELL releases all remaining locked base", () => {
    const buyerId = "buyer";
    const sellerId = "seller";

    deposit(buyerId, "USD", 100);
    deposit(sellerId, "SOL", 2);

    placeOrder(buyerId, "SOL_USD", "BUY", 100, 1);

    const sellResult = placeOrder(
      sellerId,
      "SOL_USD",
      "SELL",
      100,
      2,
    );

    expect(sellResult.order.filledQuantity).toBe(1);

    expect(balanceOf(sellerId, "SOL")).toEqual({
      available: 0,
      locked: 1,
    });

    const cancelResult = handleCancelOrder({
      userId: sellerId,
      orderId: sellResult.order.orderId,
    });

    expect(cancelResult.order.status).toBe(
      "CANCELLED",
    );

    expect(balanceOf(sellerId, "SOL")).toEqual({
      available: 1,
      locked: 0,
    });

    expect(balanceOf(sellerId, "USD")).toEqual({
      available: 100,
      locked: 0,
    });

    expect(
      sellResult.orderBook.asks,
    ).toHaveLength(0);
  });

  test("17. rejects orders with insufficient balance without mutating state", () => {
    const buyerId = "poor_buyer";
    const sellerId = "poor_seller";

    deposit(buyerId, "USD", 50);
    deposit(sellerId, "SOL", 0.5);

    expect(() =>
      placeOrder(
        buyerId,
        "SOL_USD",
        "BUY",
        100,
        1,
      ),
    ).toThrow("insufficient USD balance");

    expect(() =>
      placeOrder(
        sellerId,
        "SOL_USD",
        "SELL",
        100,
        1,
      ),
    ).toThrow("insufficient SOL balance");

    expect(ORDER_BOOK.size).toBe(0);
    expect(ORDERS.size).toBe(0);

    expect(balanceOf(buyerId, "USD")).toEqual({
      available: 50,
      locked: 0,
    });

    expect(balanceOf(sellerId, "SOL")).toEqual({
      available: 0.5,
      locked: 0,
    });
  });

  test("18. available and locked balances never become negative", () => {
    const buyerId = "buyer";
    const sellerOne = "seller_one";
    const sellerTwo = "seller_two";

    deposit(buyerId, "USD", 300);
    deposit(sellerOne, "SOL", 1);
    deposit(sellerTwo, "SOL", 1);

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
      100,
      1,
    );

    const result = placeOrder(
      buyerId,
      "SOL_USD",
      "BUY",
      100,
      3,
    );

    handleCancelOrder({
      userId: buyerId,
      orderId: result.order.orderId,
    });

    for (const entry of allBalances()) {
      expect(
        entry.balance.available,
      ).toBeGreaterThanOrEqual(0);

      expect(
        entry.balance.locked,
      ).toBeGreaterThanOrEqual(0);
    }

    expect(balanceOf(buyerId, "USD")).toEqual({
      available: 100,
      locked: 0,
    });

    expect(balanceOf(buyerId, "SOL")).toEqual({
      available: 2,
      locked: 0,
    });
  });
});
