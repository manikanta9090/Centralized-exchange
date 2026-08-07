import { z } from "zod";

export const orderSchema = z.object({
  market: z.string().trim().min(1, "market is required"),

  side: z.enum(["BUY", "SELL"], {
    message: "side must be BUY or SELL",
  }),

  price: z.number().positive("price must be greater than 0"),

  quantity: z
    .number()
    .positive("quantity must be greater than 0"),
});