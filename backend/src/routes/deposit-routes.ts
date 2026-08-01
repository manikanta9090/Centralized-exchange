import { Router } from "express";
import { deposit } from "../controllers/deposit-controller.js";
import { authMiddleware } from "../middleware/auth-middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

export const depositRouter = Router();

depositRouter.post(
  "/deposit",
  authMiddleware,
  asyncHandler(deposit),
);