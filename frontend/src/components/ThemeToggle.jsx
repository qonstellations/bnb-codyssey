import { Switch, useComputedColorScheme, useMantineColorScheme } from "@mantine/core";

const icon = { width: 10, height: 10, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", "aria-hidden": true };

const Sun = () => (
  <svg {...icon}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

const Moon = () => (
  <svg {...icon}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// shadcn-style switch: follows the system until flipped, then remembers the choice
// (Mantine persists it to localStorage; index.html re-applies it before paint).
export default function ThemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const dark = useComputedColorScheme("light", { getInitialValueInEffect: false }) === "dark";

  // Plain CSS transitions on background/text get silently dropped on any element that
  // already declares its own `transition` (cards, pills, flow nodes — shorthand collision,
  // not additive). The View Transitions API cross-fades a snapshot of the whole page
  // instead, so the switch is smooth everywhere without touching every stylesheet.
  function toggle(next) {
    if (reducedMotion() || !document.startViewTransition) {
      setColorScheme(next);
      return;
    }
    document.startViewTransition(() => setColorScheme(next));
  }

  return (
    <Switch
      size="md"
      color="ink"
      checked={dark}
      onChange={(e) => toggle(e.currentTarget.checked ? "dark" : "light")}
      thumbIcon={dark ? <Moon /> : <Sun />}
      aria-label="Dark mode"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      styles={{ track: { cursor: "pointer" }, thumb: { color: "var(--app-ink)", background: "var(--app-bg)" } }}
    />
  );
}
