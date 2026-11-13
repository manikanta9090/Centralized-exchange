import { BALANCES } from "../src/store/exchange-store.js";
import { resetOrderBookState } from "../src/store/order-book.js";
import { handleDeposit } from "../src/handlers/deposit-handler.js";
import { handleOrder } from "../src/handlers/order-handler.js";
import type { Balance } from "../src/store/exchange-store.js";

export function resetEngineState(): void {
  BALANCES.clear();
  resetOrderBookState();
}

export function deposit(
  userId: string,
  asset: string,
  amount: number,
): void {
  handleDeposit({
    userId,
    asset,
    amount,
  });
}

export function placeOrder(
  userId: string,
  market: string,
  side: "BUY" | "SELL",
  price: number,
  quantity: number,
) {
  return handleOrder({
    userId,
    market,
    side,
    price,
    quantity,
  });
}

export function balanceOf(
  userId: string,
  asset: string,
): Balance {
  const userBalances = BALANCES.get(userId);

  if (!userBalances) {
    throw new Error(
      `No balances found for user ${userId}`,
    );
  }

  const balance = userBalances[asset];

  if (!balance) {
    throw new Error(
      `No ${asset} balance found for user ${userId}`,
    );
  }

  return balance;
}

export function hasBalance(
  userId: string,
  asset: string,
): boolean {
  return Boolean(BALANCES.get(userId)?.[asset]);
}

export interface BalanceEntry {
  userId: string;
  asset: string;
  balance: Balance;
}

export function allBalances(): BalanceEntry[] {
  const entries: BalanceEntry[] = [];

  for (const [userId, assets] of BALANCES) {
    for (const [asset, balance] of Object.entries(
      assets,
    )) {
      entries.push({
        userId,
        asset,
        balance,
      });
    }
  }

  return entries;
}
