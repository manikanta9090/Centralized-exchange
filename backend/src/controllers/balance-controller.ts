import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth-middleware.js";
import { engineClient } from "../utils/engine-client.js";

interface BalanceResponse {
  userId: string;
  asset?: string;
  available?: number;
  locked?: number;
  balances?: Record<
    string,
    {
      available: number;
      locked: number;
    }
  >;
}

export async function getBalance(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.userId) {
    console.error("Balance request: unauthorized");

    res.status(401).json({
      error: "unauthorized",
    });

    return;
  }

  const asset =
    typeof req.query.asset === "string"
      ? req.query.asset.toUpperCase()
      : undefined;

  try {
    console.log(
      `Checking balance for user ${req.userId}${asset ? `, asset: ${asset}` : ""}`,
    );

    const result =
      await engineClient.sendRequest<BalanceResponse>(
        "BALANCE",
        {
          userId: req.userId,
          asset,
        },
      );

    console.log("Balance response:", result);

    res.status(200).json(result);
  } catch (error) {
    console.error("Balance request failed:", error);

    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "internal_server_error",
    });
  }
}