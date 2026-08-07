import { Router } from "express";
import { placeOrder } from "../controllers/order-controller.js";
import { authMiddleware } from "../middleware/auth-middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

export const orderRouter = Router();

orderRouter.post(
  "/order",
  authMiddleware,
  asyncHandler(placeOrder),
);