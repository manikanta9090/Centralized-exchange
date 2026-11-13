
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

  // Initialize missing asset balances.
  buyerBalances[baseAsset] ??= {
    available: 0,
    locked: 0,
  };

  buyerBalances[quoteAsset] ??= {
    available: 0,
    locked: 0,
  };

  sellerBalances[baseAsset] ??= {
    available: 0,
    locked: 0,
  };

  sellerBalances[quoteAsset] ??= {
    available: 0,
    locked: 0,
  };

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

  if (
    buyerQuoteBalance.locked < tradeValue
  ) {
    throw new Error(
      "buyer locked balance is insufficient",
    );
  }

  if (
    sellerBaseBalance.locked < trade.quantity
  ) {
    throw new Error(
      "seller locked balance is insufficient",
    );
  }

  // Transfer quote asset from buyer to seller.
  buyerQuoteBalance.locked -= tradeValue;
  sellerQuoteBalance.available += tradeValue;

  // Transfer base asset from seller to buyer.
  sellerBaseBalance.locked -= trade.quantity;
  buyerBaseBalance.available += trade.quantity;
}
