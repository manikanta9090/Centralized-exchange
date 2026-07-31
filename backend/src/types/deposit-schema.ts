import { z } from "zod";

export const depositSchema = z.object({
  asset: z.string().trim().min(1, "asset is required"),
  amount: z.number().positive("amount must be greater than 0"),
});