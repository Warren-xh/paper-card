// Reading settings: theme (incl. a sepia 护眼 theme), font, text size, page
// width, line spacing and whether library terms are marked while reading.
// Kept on this device; index.html applies them before the page draws.

export const READING_KEY = "pc-reading";

export const OPTIONS = {
  theme: [["auto", "跟随系统"], ["light", "浅色"], ["sepia", "护眼"], ["dark", "深色"]],
  font: [["system", "系统字体"], ["wenkai", "霞鹜文楷"], ["serif", "思源宋体"], ["sans", "思源黑体"]],
  size: [["s", "小"], ["m", "标准"], ["l", "大"], ["xl", "特大"]],
  width: [["narrow", "窄"], ["normal", "标准"], ["wide", "宽"]],
  leading: [["normal", "标准"], ["loose", "宽松"]],
};
export const DEFAULTS = { theme: "auto", font: "system", size: "m", width: "normal", leading: "normal", autoTerms: true };

// Web fonts are only loaded when chosen; each loads just the characters a page uses.
export const FONT_CSS = {
  wenkai: [
    "https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/lxgwwenkai-regular.css",
    "https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/lxgwwenkai-bold.css",
  ],
  serif: ["https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&display=swap"],
  sans: ["https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap"],
};

const valid = (key, v) => OPTIONS[key].some(([k]) => k === v);

// Settings from storage; the theme from before v4.4 ("pc-theme") is kept.
export function normalizeReading(raw, oldTheme = "") {
  const r = raw && typeof raw === "object" ? raw : {};
  const out = { ...DEFAULTS };
  for (const k of Object.keys(OPTIONS)) if (valid(k, r[k])) out[k] = r[k];
  if (!valid("theme", r.theme) && (oldTheme === "light" || oldTheme === "dark")) out.theme = oldTheme;
  if (typeof r.autoTerms === "boolean") out.autoTerms = r.autoTerms;
  return out;
}

// The theme actually shown: "auto" follows the system's light or dark setting.
export const effectiveTheme = (theme, systemDark = false) => (theme === "auto" ? (systemDark ? "dark" : "light") : theme);
const THEME_COLORS = { light: "#f1efe8", dark: "#14181d", sepia: "#efe4cb" };

// While the theme is "auto", the page follows the system when it switches.
let shown = null;
let following = false;
function followSystem(doc) {
  if (following || typeof matchMedia !== "function") return;
  following = true;
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (shown?.theme === "auto") applyReading(shown, doc); });
}
const systemDark = () => typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;

// Puts the settings on <html> (data-theme, data-font, …) and loads a chosen web font.
// data-theme is always set (light, dark or sepia), so the stylesheet has one rule set per theme.
export function applyReading(s, doc = document) {
  const root = doc.documentElement;
  shown = s;
  followSystem(doc);
  const theme = effectiveTheme(s.theme, systemDark());
  root.dataset.theme = theme;
  for (const k of ["font", "size", "width", "leading"]) {
    if (s[k] === DEFAULTS[k]) delete root.dataset[k];
    else root.dataset[k] = s[k];
  }
  for (const [font, urls] of Object.entries(FONT_CSS))
    if (font === s.font)
      urls.forEach((href, i) => {
        const id = "font-" + font + "-" + i;
        if (doc.getElementById(id)) return;
        const link = Object.assign(doc.createElement("link"), { rel: "stylesheet", href, id });
        doc.head.append(link);
      });
  const meta = doc.querySelector('meta[name="theme-color"]:not([media])') || Object.assign(doc.createElement("meta"), { name: "theme-color" });
  if (!meta.isConnected) doc.head.prepend(meta);
  meta.content = THEME_COLORS[theme];
}

// The settings form: a panel under the top bar button, and a section of the settings page.
export function readingFormHtml(s, h) {
  const seg = (key, label) => `<div class="rs-row"><span class="rs-label" id="rs-${key}">${label}</span>
    <div class="rs-seg" role="radiogroup" aria-labelledby="rs-${key}">${OPTIONS[key].map(([v, t]) =>
      `<button type="button" role="radio" data-rs="${key}" data-v="${v}" aria-checked="${s[key] === v}"${key === "theme" ? ` class="rs-theme t-${v}"` : key === "font" ? ` class="rs-font f-${v}"` : ""}>${key === "font" ? `<b>文 Aa</b>` : ""}<span>${h(t)}</span></button>`).join("")}</div></div>`;
  return `<div class="reading-form">
    ${seg("theme", "主题")}${seg("font", "字体")}${seg("size", "字号")}${seg("width", "行宽")}${seg("leading", "行距")}
    <label class="rs-check"><input type="checkbox" data-rs="autoTerms"${s.autoTerms ? " checked" : ""}> 阅读时自动标出词库里的术语</label>
  </div>`;
}

// Wires a reading form; `onChange(next)` gets the new settings.
export function bindReadingForm(el, get, onChange) {
  el.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-rs]");
    if (!b) return;
    const next = { ...get(), [b.dataset.rs]: b.dataset.v };
    el.querySelectorAll(`button[data-rs="${b.dataset.rs}"]`).forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    onChange(next);
  });
  el.addEventListener("change", (e) => {
    if (e.target.matches('input[data-rs="autoTerms"]')) onChange({ ...get(), autoTerms: e.target.checked });
  });
}
