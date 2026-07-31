export interface Balance {
  available: number;
  locked: number;
}

export type UserBalances = Record<string, Balance>;

export const BALANCES = new Map<string, UserBalances>();