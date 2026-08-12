import { Router } from "express";
import {
  placeOrder,
  cancelOrder,
  getOrder,
} from "../controllers/order-controller.js";
import { authMiddleware } from "../middleware/auth-middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

export const orderRouter = Router();

orderRouter.post(
  "/order",
  authMiddleware,
  asyncHandler(placeOrder),
);

orderRouter.delete(
  "/order/:orderId",
  authMiddleware,
  asyncHandler(cancelOrder),
);
orderRouter.get(
  "/order/:orderId",
  authMiddleware,
  asyncHandler(getOrder),
);