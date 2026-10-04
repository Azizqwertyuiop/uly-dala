/*
 * Проверка выкладки и отката (шаг 20, docs/deploy.md) — те же deploy/bin/release.sh и rollback.sh,
 * что на сервере, на настоящем релизе (.next/standalone). Вместо systemd — локальный запуск
 * `node server.js`, вместо Caddy — маленький прокси, который читает тот же файл upstream.
 * Всё время проверки по сайту идут запросы (каждые 50 мс): считаем сбои и время переключений.
 *
 * Сценарии:
 *   1. выкладка A → выкладка B (A остаётся во втором слоте);
 *   2. откат без аргументов → снова A (тёплый слот: секунды);
 *   3. выкладка C, откат на B по id (B не запущен: холодный старт);
 *   4. сломанный релиз → выкладка прервана, трафик не переключён;
 *   5. перезапуск без простоя (restart.sh — после правки переменных сервера).
 * Запуск: npm run build && npm run verify:rollback
 */
import { execFile } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const STANDALONE = join(ROOT, ".next/standalone");
const work = mkdtempSync(join(tmpdir(), "uly-rollback-"));
const uly = join(work, "srv");
const PROXY_PORT = 3400;
const upstreamFile = join(work, "upstream.caddy");

// --- «systemd»: запуск и остановка слота ------------------------------------------------------
const service = join(work, "service.sh");
writeFileSync(
  service,
  `#!/usr/bin/env bash
set -eu
action="$1"; port="$2"; dir="$3"; pidfile="${work}/slot-$port.pid"
if [ -f "$pidfile" ]; then kill "$(cat "$pidfile")" 2>/dev/null || true; rm -f "$pidfile"; sleep 0.3; fi
if [ "$action" = "start" ]; then
  cd "$dir"
  PORT="$port" HOSTNAME=127.0.0.1 LEADS_SQLITE_PATH="${work}/leads.sqlite" NODE_ENV=production \\
    nohup node server.js > "${work}/slot-$port.log" 2>&1 &
  echo $! > "$pidfile"
fi
`,
);
chmodSync(service, 0o755);

// --- «Caddy»: прокси на порт из файла upstream -------------------------------------------------
const proxy = http.createServer((req, res) => {
  let port;
  try {
    port = /127\.0\.0\.1:(\d+)/.exec(readFileSync(upstreamFile, "utf8"))[1];
  } catch {
    res.writeHead(503).end();
    return;
  }
  const up = http.request(
    { host: "127.0.0.1", port, path: req.url, method: req.method, headers: req.headers },
    (r) => {
      res.writeHead(r.statusCode ?? 502, r.headers);
      r.pipe(res);
    },
  );
  up.on("error", () => res.writeHead(502).end());
  req.pipe(up);
});
await new Promise((r) => proxy.listen(PROXY_PORT, "127.0.0.1", r));

// --- Релизы A, B, C и сломанный ----------------------------------------------------------------
function makeRelease(id, { broken = false } = {}) {
  const dir = join(work, `build-${id}`);
  cpSync(STANDALONE, dir, { recursive: true, verbatimSymlinks: true });
  writeFileSync(join(dir, "RELEASE"), id + "\n");
  if (broken) writeFileSync(join(dir, "server.js"), "process.exit(1);\n");
  const tgz = join(work, `${id}.tgz`);
  return run("tar", ["-czf", tgz, "-C", dir, "."]).then(() => {
    rmSync(dir, { recursive: true, force: true });
    return tgz;
  });
}

const env = {
  ...process.env,
  ULY_ROOT: uly,
  ULY_SERVICE: service,
  ULY_PROXY_FILE: upstreamFile,
  ULY_PROXY_RELOAD: "true",
  HEALTH_TIMEOUT: "20",
};
const sh = (script, args) =>
  run("bash", [join(ROOT, "deploy/bin", script), ...args], { env, maxBuffer: 1 << 20 });

// --- Нагрузка: запросы каждые 50 мс ------------------------------------------------------------
const samples = [];
let loadOn = true;
async function load() {
  while (loadOn) {
    const t = Date.now();
    const result = await new Promise((resolve) => {
      const req = http.get(
        { host: "127.0.0.1", port: PROXY_PORT, path: "/api/health", timeout: 3000 },
        (res) => {
          let body = "";
          res.on("data", (c) => (body += c));
          res.on("end", () => {
            let release = "";
            try {
              release = JSON.parse(body).release;
            } catch {
              // не JSON
            }
            resolve({ status: res.statusCode, release });
          });
        },
      );
      req.on("error", () => resolve({ status: 0, release: "" }));
      req.on("timeout", () => req.destroy());
    });
    samples.push({ t, ...result });
    await new Promise((r) => setTimeout(r, 50));
  }
}

const serving = async () => {
  const s = samples.at(-1);
  return s ? s.release : "";
};
async function timed(label, fn, expectRelease) {
  const t0 = Date.now();
  let error = null;
  try {
    await fn();
  } catch (e) {
    error = e;
  }
  // Время до первого ответа нового релиза через «Caddy».
  while (expectRelease && (await serving()) !== expectRelease && Date.now() - t0 < 60_000)
    await new Promise((r) => setTimeout(r, 20));
  const ms = Date.now() - t0;
  const from = samples.findIndex((s) => s.t >= t0);
  const failed = samples.slice(from).filter((s) => s.status !== 200).length;
  return { label, ms, failed, error: error ? String(error.stderr || error.message).trim() : "" };
}

const results = [];
let ok = true;
try {
  console.log("Сборка архивов релизов…");
  const [a, b, c, broken] = await Promise.all([
    makeRelease("verify-a"),
    makeRelease("verify-b"),
    makeRelease("verify-c"),
    makeRelease("verify-broken", { broken: true }),
  ]);
  // Нагрузка — с самого начала; сбои считаются с момента, когда сайт уже работает (после A).
  const loading = load();
  results.push(await timed("выкладка A (первая)", () => sh("release.sh", [a]), "verify-a"));
  results[0].failed = 0;
  const live = samples.length;
  results.push(await timed("выкладка B", () => sh("release.sh", [b]), "verify-b"));
  results.push(
    await timed("ОТКАТ на прежний (A, тёплый слот)", () => sh("rollback.sh", []), "verify-a"),
  );
  results.push(await timed("выкладка C", () => sh("release.sh", [c]), "verify-c"));
  results.push(
    await timed(
      "ОТКАТ на B по id (холодный старт)",
      () => sh("rollback.sh", ["verify-b"]),
      "verify-b",
    ),
  );
  const bad = await timed("сломанный релиз", () => sh("release.sh", [broken]), null);
  bad.label += " (должен быть отклонён)";
  bad.stillServing = await serving();
  results.push(bad);
  results.push(
    await timed("перезапуск без простоя (restart.sh)", () => sh("restart.sh", []), "verify-b"),
  );
  await new Promise((r) => setTimeout(r, 500));
  loadOn = false;
  await loading;

  console.log("\nШаг                                          время     сбоев запросов");
  for (const r of results)
    console.log(`${r.label.padEnd(44)} ${(r.ms / 1000).toFixed(1).padStart(5)} с   ${r.failed}`);
  const failedTotal = samples.slice(live).filter((s) => s.status !== 200).length;
  console.log(
    `\nЗапросов к работающему сайту: ${samples.length - live}, неуспешных: ${failedTotal}`,
  );
  console.log(
    `Сломанный релиз: ${bad.error ? "отклонён" : "НЕ отклонён"}; сайт отдаёт: ${bad.stillServing}`,
  );

  const rollbacks = results.filter((r) => r.label.startsWith("ОТКАТ"));
  ok =
    failedTotal === 0 &&
    rollbacks.every((r) => r.ms < 60_000 && !r.error) &&
    Boolean(bad.error) &&
    bad.stillServing === "verify-b" &&
    !results.at(-1).error;
  console.log(ok ? "\nОТКАТ ПРОВЕРЕН ✓" : "\nПРОВЕРКА НЕ ПРОЙДЕНА ✗");
  console.log(`\nЖурнал выкладок:\n${readFileSync(join(uly, "deploys.log"), "utf8")}`);
} finally {
  loadOn = false;
  for (const port of [3001, 3002]) await run(service, ["stop", String(port), "."]).catch(() => {});
  proxy.close();
  rmSync(work, { recursive: true, force: true });
}
process.exit(ok ? 0 : 1);
