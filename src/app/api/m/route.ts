import { handleClientError } from "@/server/telemetry/handlers";

/** Мониторинг ошибок фронта — src/server/telemetry/handlers.ts. */
export const runtime = "nodejs";

export function POST(request: Request): Promise<Response> {
  return handleClientError(request);
}
