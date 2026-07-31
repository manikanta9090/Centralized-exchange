import { Router } from "express";
import { authRouter } from "./auth-routes.js";

export const appRouter = Router();

appRouter.use(authRouter);