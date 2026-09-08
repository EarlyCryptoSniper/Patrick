/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Twitter/X "Dim" dark-mode palette, plus the classic Twitter
        // accent trio (blue/green/red) for status semantics.
        ink: {
          950: "#15202B", // Dim achtergrond
          900: "#192734", // Dim kaart
          800: "#22303C",
          700: "#38444D", // Twitter's documented dim-mode divider color
          600: "#8899A6", // Dim tekst
        },
        paper: "#F5F8FA",
        status: {
          draft: "#8899A6",
          locked: "#1D9BF0", // X accentblauw
          completed: "#17BF63", // klassiek Twitter-groen
          failed: "#E0245E", // klassiek Twitter-rood/roze
        },
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
