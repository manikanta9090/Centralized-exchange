import type {
  NextFunction,
  Request,
  Response,
} from "express";
import jwt from "jsonwebtoken";
import { env } from "../utils/env.js";

interface TokenPayload {
  userId: string;
}

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    res.status(401).json({
      error: "unauthorized",
    });
    return;
  }

  const token = authorization.slice(7);

  try {
    const decoded = jwt.verify(
      token,
      env.jwtSecret,
    ) as TokenPayload;

    if (!decoded.userId) {
      res.status(401).json({
        error: "invalid_token",
      });
      return;
    }

    req.userId = decoded.userId;

    next();
  } catch {
    res.status(401).json({
      error: "invalid_token",
    });
  }
}