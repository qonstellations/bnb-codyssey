import { createTheme } from "@mantine/core";

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
  },
  primaryColor: "ink",
  primaryShade: 8,
  defaultRadius: "lg",
  radius: { lg: "16px", xl: "24px" },
  components: {
    Button: { defaultProps: { radius: "xl" } },
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
