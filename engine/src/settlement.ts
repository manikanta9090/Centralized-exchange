import { BALANCES } from "./store/exchange-store.js";
import type { Trade } from "./matching-engine.js";

export function settleTrade(trade: Trade): void {
  const [baseAsset, quoteAsset] =
    trade.market.split("_");

  if (!baseAsset || !quoteAsset) {
    throw new Error(
      "market must use BASE_QUOTE format",
    );
  }

  const buyerBalances = BALANCES.get(
    trade.buyerUserId,
  );

  const sellerBalances = BALANCES.get(
    trade.sellerUserId,
  );

  if (!buyerBalances) {
    throw new Error("buyer balance not found");
  }

  if (!sellerBalances) {
    throw new Error("seller balance not found");
  }

  const tradeValue =
    trade.price * trade.quantity;

  const buyerQuoteBalance =
    buyerBalances[quoteAsset];

  const buyerBaseBalance =
    buyerBalances[baseAsset];

  const sellerBaseBalance =
    sellerBalances[baseAsset];

  const sellerQuoteBalance =
    sellerBalances[quoteAsset];

  if (!buyerQuoteBalance) {
    throw new Error(
      `buyer ${quoteAsset} balance not found`,
    );
  }

  if (!buyerBaseBalance) {
    throw new Error(
      `buyer ${baseAsset} balance not found`,
    );
  }

  if (!sellerBaseBalance) {
    throw new Error(
      `seller ${baseAsset} balance not found`,
    );
  }

  if (!sellerQuoteBalance) {
    throw new Error(
      `seller ${quoteAsset} balance not found`,
    );
  }

  if (
    buyerQuoteBalance.locked <
    tradeValue
  ) {
    throw new Error(
      "buyer locked balance is insufficient",
    );
  }

  if (
    sellerBaseBalance.locked <
    trade.quantity
  ) {
    throw new Error(
      "seller locked balance is insufficient",
    );
  }

  buyerQuoteBalance.locked -= tradeValue;
  buyerBaseBalance.available +=
    trade.quantity;

  sellerBaseBalance.locked -=
    trade.quantity;
  sellerQuoteBalance.available +=
    tradeValue;
}