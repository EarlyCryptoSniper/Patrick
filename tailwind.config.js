/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0B0F14",
          900: "#11161D",
          800: "#1A212B",
          700: "#293240",
          600: "#3C4859",
        },
        paper: "#E9ECEF",
        status: {
          draft: "#8B96A5",
          locked: "#D9A441",
          completed: "#3FAE7A",
          failed: "#D9534F",
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
