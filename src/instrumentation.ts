import type { Instrumentation } from "next";

/*
 * Мониторинг ошибок сервера (CLAUDE.md, раздел 14): необработанная ошибка рендера, Server Action
 * или route handler → структурированный лог + Sentry (если задан SENTRY_DSN).
 * Путь — без query; заголовки запроса (IP, cookie, UA) не передаются.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  // Только в Node.js-рантайме: там есть node:crypto для пересылки.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { captureError } = await import("@/server/telemetry/log");
  const err = error instanceof Error ? error : new Error(String(error));
  const digest = (error as { digest?: string }).digest;
  await captureError({
    level: "error",
    scope: "server",
    platform: "node",
    message: `${err.name}: ${err.message}`.slice(0, 300),
    stack: err.stack?.split("\n").slice(0, 12).join("\n"),
    tags: {
      tag: "server",
      route: context.routePath,
      routeType: context.routeType,
      method: request.method,
      path: request.path.split("?")[0]!.slice(0, 120),
    },
    extra: digest ? { digest } : undefined,
  });
};
