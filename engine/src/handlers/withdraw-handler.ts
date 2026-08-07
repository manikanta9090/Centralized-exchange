import { BALANCES } from "../store/exchange-store.js";

interface WithdrawPayload {
  userId: string;
  asset: string;
  amount: number;
}

export function handleWithdraw(
  payload: WithdrawPayload,
) {
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

  const userBalances = BALANCES.get(userId);

  if (!userBalances) {
    throw new Error("user balance not found");
  }

  const balance = userBalances[asset];

  if (!balance) {
    throw new Error(`No balance found for ${asset}`);
  }

  if (balance.available < amount) {
    throw new Error("insufficient available balance");
  }

  balance.available -= amount;

  userBalances[asset] = balance;

  return {
    userId,
    asset,
    available: balance.available,
    locked: balance.locked,
  };
}