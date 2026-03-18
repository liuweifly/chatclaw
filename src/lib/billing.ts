export const DEFAULT_CREEM_PRODUCT_ID = "prod_3anPiH9opJYivargJPlZTV";
export const DEFAULT_CREEM_BASE_URL = "https://test-api.creem.io";

export type BillingPlan = "free" | "pro" | "team";

export function resolveCreemBaseUrl() {
  return process.env.NEXT_PUBLIC_CREEM_BASE_URL || DEFAULT_CREEM_BASE_URL;
}

export function resolveCreemProductId() {
  return process.env.CREEM_PRODUCT_ID || DEFAULT_CREEM_PRODUCT_ID;
}

export function normalizePlan(value: string | null | undefined): BillingPlan {
  if (value === "pro" || value === "team") {
    return value;
  }
  return "free";
}
