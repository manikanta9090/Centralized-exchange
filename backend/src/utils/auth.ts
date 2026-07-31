import jwt from "jsonwebtoken";
import { env } from "./env.js";

export interface TokenPayload {
  userId: string;
}

export function createToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: "7d",
  });
}