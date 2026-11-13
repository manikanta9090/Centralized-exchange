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
import { handleOrder } from "../src/handlers/order-handler.js";
import {
  handleCancelOrder,
  handleGetOrder,
} from "../src/handlers/order-handler.js";
import { handleDeposit } from "../src/handlers/deposit-handler.js";
import {
  balanceOf,
  deposit,
  placeOrder,
  resetEngineState,
} from "./helpers.js";

describe("Input and market validation", () => {
  beforeEach(() => {
    resetEngineState();
  });

  test("rejects malformed market names without creating state", () => {
    deposit("user", "USD", 1000);

    for (const market of [
      "SOL",
      "SOL_USD_EXTRA",
      "SOL__USD",
      "_USD",
      "SOL_",
      "SOL-USD",
      "SOL_SOL",
      " SOL_USD",
    ]) {
      expect(() =>
        placeOrder("user", market, "BUY", 100, 1),
      ).toThrow();
    }

    expect(ORDER_BOOK.size).toBe(0);
    expect(ORDERS.size).toBe(0);

    expect(balanceOf("user", "USD")).toEqual({
      available: 1000,
      locked: 0,
    });
  });

  test("rejects invalid side, price and quantity", () => {
    deposit("user", "USD", 1000);
    deposit("user", "SOL", 10);

    expect(() =>
      handleOrder({
        userId: "user",
        market: "SOL_USD",
        side: "HOLD" as unknown as "BUY",
        price: 100,
        quantity: 1,
      }),
    ).toThrow("side must be BUY or SELL");

    for (const price of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() =>
        placeOrder("user", "SOL_USD", "BUY", price, 1),
      ).toThrow(/price/);
    }

    for (const quantity of [
      0,
      -1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      expect(() =>
        placeOrder(
          "user",
          "SOL_USD",
          "SELL",
          100,
          quantity,
        ),
      ).toThrow(/quantity/);
    }

    expect(ORDER_BOOK.size).toBe(0);
    expect(ORDERS.size).toBe(0);
  });

  test("rejects missing user id and invalid asset names", () => {
    expect(() =>
      handleOrder({
        userId: "",
        market: "SOL_USD",
        side: "BUY",
        price: 100,
        quantity: 1,
      }),
    ).toThrow("userId is required");

    expect(() =>
      handleDeposit({
        userId: "user",
        asset: "SO L",
        amount: 10,
      }),
    ).toThrow("asset must be alphanumeric");

    expect(() =>
      handleDeposit({
        userId: "user",
        asset: "USD",
        amount: Number.NaN,
      }),
    ).toThrow("amount must be greater than 0");
  });

  test("enforces order ownership and terminal order states", () => {
    const buyerId = "buyer";
    const sellerId = "seller";
    const outsiderId = "outsider";

    deposit(buyerId, "USD", 100);
    deposit(sellerId, "SOL", 1);
    deposit(outsiderId, "USD", 1);

    placeOrder(sellerId, "SOL_USD", "SELL", 100, 1);

    const buyResult = placeOrder(
      buyerId,
      "SOL_USD",
      "BUY",
      100,
      1,
    );

    expect(() =>
      handleGetOrder({
        userId: outsiderId,
        orderId: buyResult.order.orderId,
      }),
    ).toThrow("order not found");

    expect(() =>
      handleCancelOrder({
        userId: outsiderId,
        orderId: buyResult.order.orderId,
      }),
    ).toThrow("you do not own this order");

    expect(() =>
      handleCancelOrder({
        userId: buyerId,
        orderId: buyResult.order.orderId,
      }),
    ).toThrow("order is already completely filled");
  });

  test("leaves non-crossing limit orders open", () => {
    const buyerId = "buyer";
    const sellerId = "seller";

    deposit(buyerId, "USD", 90);
    deposit(sellerId, "SOL", 1);

    const buyResult = placeOrder(
      buyerId,
      "SOL_USD",
      "BUY",
      90,
      1,
    );

    const sellResult = placeOrder(
      sellerId,
      "SOL_USD",
      "SELL",
      100,
      1,
    );

    expect(buyResult.trades).toHaveLength(0);
    expect(sellResult.trades).toHaveLength(0);

    expect(buyResult.order.status).toBe("OPEN");
    expect(sellResult.order.status).toBe("OPEN");

    expect(buyResult.orderBook.bids).toHaveLength(1);
    expect(buyResult.orderBook.asks).toHaveLength(1);

    expect(balanceOf(buyerId, "USD")).toEqual({
      available: 0,
      locked: 90,
    });

    expect(balanceOf(sellerId, "SOL")).toEqual({
      available: 0,
      locked: 1,
    });
  });
});
