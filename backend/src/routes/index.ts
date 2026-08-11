import { Router } from "express";
import { authRouter } from "./auth-routes.js";
import { depositRouter } from "./deposit-routes.js";
import { withdrawRouter } from "./withdraw-routes.js";
import { orderRouter } from "./order-routes.js";
import { balanceRouter } from "./balance-routes.js";

export const appRouter = Router();

appRouter.use(authRouter);
appRouter.use(depositRouter);
appRouter.use(withdrawRouter);
appRouter.use(orderRouter);
appRouter.use(balanceRouter);