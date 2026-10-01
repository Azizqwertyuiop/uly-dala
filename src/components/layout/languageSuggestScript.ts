import type { Locale } from "@/lib/i18n";

export const SUGGEST_DISMISS_KEY = "uly-dala:language-suggest";

/**
 * Скрипт в <head>: до первой отрисовки решает, предлагать ли язык (html[data-suggest]).
 * Первый из языков браузера, на котором есть сайт; если он не язык страницы и плашку
 * не закрывали — показать. Без него (нет JS) плашки нет.
 */
export function languageSuggestScript(current: Locale, offers: readonly Locale[]): string {
  return `(function(){try{var o=${JSON.stringify(offers)},c=${JSON.stringify(current)};try{if(localStorage.getItem(${JSON.stringify(SUGGEST_DISMISS_KEY)})==="1")return}catch(e){}var l=(navigator.languages||[navigator.language||""]).map(function(x){return String(x).slice(0,2).toLowerCase()}).filter(function(x){return x===c||o.indexOf(x)>=0})[0];if(l&&l!==c)document.documentElement.dataset.suggest=l}catch(e){}})();`;
}
