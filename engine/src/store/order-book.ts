export interface Order {
  orderId: string;
  userId: string;
  market: string;
  side: "BUY" | "SELL";
  price: number;
  quantity: number;
  filledQuantity: number;
}

export const ORDER_BOOK = new Map<
  string,
  {
    bids: Order[];
    asks: Order[];
  }
>();