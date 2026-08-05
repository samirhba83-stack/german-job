const BOOT_SCRIPT = `
(function () {
  try {
    var pref = localStorage.getItem('gje.theme');
    if (pref === 'light' || pref === 'dark') {
      document.documentElement.setAttribute('data-theme', pref);
    }
    // 'system' (or unset) intentionally sets nothing — globals.css's
    // @media (prefers-color-scheme: dark) already handles that case with no JS needed.
  } catch (e) {}
})();
`;

/**
 * Runs synchronously in <head>, before React hydrates and before first paint — the only way to
 * apply a stored dark/light preference without a visible flash of the wrong theme
 * (docs/interaction-framework/13-decision-records.md IDR-007). Mirrors lib/stores/theme-store.ts's
 * applyTheme() logic exactly; kept as a small, standalone string specifically because it must run
 * with zero dependencies (no Zustand, no React) before either has loaded.
 */
export function ThemeBootScript() {
  // eslint-disable-next-line react/no-danger -- must execute before hydration; no user input involved
  return <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />;
}
