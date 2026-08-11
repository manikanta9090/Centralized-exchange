import { Router } from "express";
import { getBalance } from "../controllers/balance-controller.js";
import { authMiddleware } from "../middleware/auth-middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

export const balanceRouter = Router();

balanceRouter.get(
  "/balance",
  authMiddleware,
  asyncHandler(getBalance),
);