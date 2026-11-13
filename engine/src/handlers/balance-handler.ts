import { BALANCES } from "../store/exchange-store.js";
import { assertAssetName } from "../utils/market.js";

export interface BalancePayload {
  userId: string;
  asset?: string;
}

export function handleBalance(
  payload: BalancePayload,
) {
  const { userId, asset } = payload;

  if (!userId) {
    throw new Error("userId is required");
  }

  const userBalances = BALANCES.get(userId);

  if (!userBalances) {
    throw new Error("user balance not found");
  }

  // If a specific asset was requested
  if (asset) {
    const requestedAsset = assertAssetName(asset);
    const balance = userBalances[requestedAsset];

    if (!balance) {
      return {
        userId,
        asset: requestedAsset,
        available: 0,
        locked: 0,
      };
    }

    return {
      userId,
      asset: requestedAsset,
      available: balance.available,
      locked: balance.locked,
    };
  }

  // Return all balances
  return {
    userId,
    balances: userBalances,
  };
}