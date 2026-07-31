import { BALANCES } from "../store/exchange-store.js";

interface DepositPayload {
  userId: string;
  asset: string;
  amount: number;
}

export function handleDeposit(payload: DepositPayload) {
  const { userId, asset, amount } = payload;

  if (!userId) {
    throw new Error("userId is required");
  }

  if (!asset) {
    throw new Error("asset is required");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("amount must be greater than 0");
  }

  let userBalances = BALANCES.get(userId);

  if (!userBalances) {
    userBalances = {};
    BALANCES.set(userId, userBalances);
  }

  const currentBalance = userBalances[asset] ?? {
    available: 0,
    locked: 0,
  };

  currentBalance.available += amount;

  userBalances[asset] = currentBalance;

  return {
    userId,
    asset,
    available: currentBalance.available,
    locked: currentBalance.locked,
  };
}