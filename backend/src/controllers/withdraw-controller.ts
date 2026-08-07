import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth-middleware.js";
import { withdrawSchema } from "../types/withdraw-schema.js";
import { engineClient } from "../utils/engine-client.js";
import { sendValidationError } from "../utils/validation.js";

interface WithdrawResponse {
  userId: string;
  asset: string;
  available: number;
  locked: number;
}

export async function withdraw(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const parsedBody = withdrawSchema.safeParse(req.body);

  if (!parsedBody.success) {
    sendValidationError(res, parsedBody.error);
    return;
  }

  if (!req.userId) {
    res.status(401).json({
      error: "unauthorized",
    });
    return;
  }

  const { asset, amount } = parsedBody.data;

  const result =
    await engineClient.sendRequest<WithdrawResponse>(
      "WITHDRAW",
      {
        userId: req.userId,
        asset,
        amount,
      },
    );

  res.status(200).json(result);
}