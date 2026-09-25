/*
 * Скрипт в <head> для «проявления светом»: включает приглушение текста до первой отрисовки,
 * если анимация уместна (нет prefers-reduced-motion, не выбран режим «Коротко»).
 * Он же ставит data-cinematic — «кинорежим» раскладки (глава 1 — 150vh с закреплённым экраном).
 * Без JS этот скрипт не выполняется — текст виден сразу, раскладка обычная.
 * TODO(security): при включении CSP (шаг 19) — добавить хэш этого скрипта.
 */
export const REVEAL_HEAD_SCRIPT = `(function(){try{var d=document.documentElement;if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;var m=null;try{m=localStorage.getItem('uly-dala:ui-mode')}catch(e){}if(m==='brief')return;d.dataset.reveal='on';d.dataset.cinematic=''}catch(e){}})();`;
