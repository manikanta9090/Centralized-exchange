const ASSET_PATTERN = /^[A-Za-z0-9]+$/;

export interface MarketAssets {
  baseAsset: string;
  quoteAsset: string;
}

/**
 * Parse a market in the exact BASE_QUOTE format.
 *
 * Markets with extra separators (for example "A_B_C") are rejected
 * instead of silently being interpreted as "A_B".
 */
export function parseMarket(market: unknown): MarketAssets {
  if (typeof market !== "string" || market.length === 0) {
    throw new Error("market is required");
  }

  if (market.trim() !== market) {
    throw new Error(
      "market must use BASE_QUOTE format without surrounding whitespace",
    );
  }

  const parts = market.split("_");

  if (parts.length !== 2) {
    throw new Error("market must use BASE_QUOTE format");
  }

  const baseAsset = parts[0];
  const quoteAsset = parts[1];

  if (!baseAsset || !quoteAsset) {
    throw new Error("market must use BASE_QUOTE format");
  }

  if (
    !ASSET_PATTERN.test(baseAsset) ||
    !ASSET_PATTERN.test(quoteAsset)
  ) {
    throw new Error(
      "market assets must be alphanumeric",
    );
  }

  if (baseAsset === quoteAsset) {
    throw new Error(
      "base and quote assets must be different",
    );
  }

  return {
    baseAsset,
    quoteAsset,
  };
}

export function assertAssetName(asset: unknown): string {
  if (typeof asset !== "string" || asset.length === 0) {
    throw new Error("asset is required");
  }

  if (asset.trim() !== asset) {
    throw new Error(
      "asset must not contain surrounding whitespace",
    );
  }

  if (!ASSET_PATTERN.test(asset)) {
    throw new Error("asset must be alphanumeric");
  }

  return asset;
}
