import { createTheme, defaultVariantColorsResolver } from "@mantine/core";

// App-wide Mantine theme matching the landing page: ink pill buttons,
// Google Sans, tight large headings, soft 24px cards.
export const theme = createTheme({
  fontFamily: '"Google Sans Flex", Inter, system-ui, -apple-system, sans-serif',
  headings: {
    fontFamily: '"Google Sans Flex", Inter, system-ui, sans-serif',
    fontWeight: "450",
    sizes: {
      h1: { fontSize: "clamp(2.25rem, 5vw, 3.5rem)", lineHeight: "1.05" },
      h2: { fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", lineHeight: "1.1" },
      h3: { fontSize: "1.375rem", lineHeight: "1.2" },
    },
  },
  colors: {
    ink: ["#f8f9fa", "#f1f3f4", "#e8eaed", "#dadce0", "#bdc1c6", "#9aa0a6", "#5f6368", "#3c4043", "#1f1f1f", "#000000"],
    // Dark scheme, true black. Mantine reads: 0 text, 2 dimmed, 3 placeholder, 4 borders,
    // 5 hover, 6 inputs / default buttons, 7 body + cards. Mirrors --app-* in index.css.
    dark: ["#fafafa", "#d4d4d4", "#a1a1a1", "#737373", "#262626", "#171717", "#0a0a0a", "#000000", "#000000", "#000000"],
  },
  primaryColor: "ink",
  primaryShade: 8,
  // Only the ink-filled button (primary action) tracks our --app-ink token, which flips
  // itself in dark mode via [data-mantine-color-scheme="dark"] in index.css — so this one
  // resolver result is correct in both schemes. Every other color (red delete, etc.) keeps
  // the default resolver; primaryShade:{dark:0} used to leak the inversion into those too.
  variantColorResolver: (input) => {
    const base = defaultVariantColorsResolver(input);
    if (input.color !== "ink" || input.variant !== "filled") return base;
    return { ...base, background: "var(--app-ink)", hover: "var(--app-ink-2)", color: "var(--app-bg)", border: "none" };
  },
  defaultRadius: "lg",
  radius: { lg: "16px", xl: "24px" },
  components: {
    // Mantine only writes the --button-bg/-bd/-hover CSS vars when `color` or `variant` is
    // passed explicitly — it always writes --button-color regardless. Every plain <Button>
    // (no color/variant prop) was therefore getting our dark-mode-flipped text color paired
    // with a background that never flips, e.g. black text on a dark bg. Forcing `variant`
    // here makes Mantine treat it as explicit, so bg/text always come from the resolver together.
    Button: { defaultProps: { radius: "xl", variant: "filled" } },
    Badge: { defaultProps: { radius: "xl", variant: "light" } },
    Card: { defaultProps: { radius: "xl", withBorder: true } },
    Paper: { defaultProps: { radius: "xl" } },
    TextInput: { defaultProps: { radius: "md" } },
    PasswordInput: { defaultProps: { radius: "md" } },
    Textarea: { defaultProps: { radius: "md" } },
    Select: { defaultProps: { radius: "md" } },
    NumberInput: { defaultProps: { radius: "md" } },
    Modal: { defaultProps: { radius: "xl" } },
    Menu: { defaultProps: { radius: "lg", shadow: "md" } },
  },
});
