import { handleAnalytics } from "@/server/telemetry/handlers";

/** Аналитика (события без персональных данных) — src/server/telemetry/handlers.ts. */
export const runtime = "nodejs";

export function POST(request: Request): Promise<Response> {
  return handleAnalytics(request);
}
