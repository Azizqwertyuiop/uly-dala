import type { WebGLRenderer } from "three";

/*
 * Проверка сборки шейдеров в продакшене (CLAUDE.md, раздел 14: тег webgl — падение шейдера).
 * renderer.debug.checkShaderErrors выключен (синхронный getProgramInfoLog на каждой программе),
 * поэтому после compileAsync программы проверяются здесь: LINK_STATUS готовой программы
 * не ждёт видеокарту. Каждая программа проверяется один раз.
 */

type ProgramInfo = { program: WebGLProgram; name: string; type: string; isReady?: () => boolean };

const checked = new WeakSet<WebGLProgram>();

export function failedPrograms(renderer: WebGLRenderer): { name: string; type: string }[] {
  const ctx = renderer.getContext();
  if (ctx.isContextLost()) return [];
  const programs = (renderer.info.programs ?? []) as unknown as ProgramInfo[];
  const failed: { name: string; type: string }[] = [];
  for (const p of programs) {
    if (checked.has(p.program)) continue;
    // Ещё собирается параллельно (KHR_parallel_shader_compile) — проверим в следующий раз.
    if (p.isReady && !p.isReady()) continue;
    checked.add(p.program);
    if (ctx.getProgramParameter(p.program, ctx.LINK_STATUS) === false)
      failed.push({ name: p.name || "unnamed", type: p.type || "" });
  }
  return failed;
}
