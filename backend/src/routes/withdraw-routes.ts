import { Router } from "express";
import { withdraw } from "../controllers/withdraw-controller.js";
import { authMiddleware } from "../middleware/auth-middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

export const withdrawRouter = Router();

withdrawRouter.post(
  "/withdraw",
  authMiddleware,
  asyncHandler(withdraw),
);