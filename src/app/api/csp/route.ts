import { handleCspReport } from "@/server/telemetry/handlers";

/** Отчёты о нарушениях CSP (report-uri и Reporting API) — src/server/telemetry/handlers.ts. */
export const runtime = "nodejs";

export function POST(request: Request): Promise<Response> {
  return handleCspReport(request);
}
