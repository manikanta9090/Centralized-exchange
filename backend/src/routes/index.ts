import { Router } from "express";
import { authRouter } from "./auth-routes.js";
import { depositRouter } from "./deposit-routes.js";

export const appRouter = Router();

appRouter.use(authRouter);
appRouter.use(depositRouter);