import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getLeadsRuntime } from "@/server/leads/runtime";

/*
 * Проверка живости для выкладки и отката (deploy/release.sh, docs/deploy.md):
 * сервер отвечает, база заявок открывается. Ответ — id релиза; данных о заявках нет.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function release(): string {
  try {
    return readFileSync(join(process.cwd(), "RELEASE"), "utf8").trim();
  } catch {
    return process.env.RELEASE ?? "dev";
  }
}

export function GET(): Response {
  const headers = { "cache-control": "no-store", "x-robots-tag": "noindex" };
  try {
    getLeadsRuntime();
    return Response.json({ status: "ok", release: release() }, { headers });
  } catch {
    return Response.json({ status: "error", release: release() }, { status: 503, headers });
  }
}
