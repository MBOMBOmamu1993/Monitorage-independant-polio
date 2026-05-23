import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // Palette OMS (World Health Organization)
        oms: {
          50:  "#e6f5fc",
          100: "#cce9f7",
          200: "#99d4ef",
          300: "#66bee7",
          400: "#33a9df",
          500: "#0093d5", // Bleu OMS officiel
          600: "#0078ae",
          700: "#005a82",
          800: "#003d57",
          900: "#001f2c"
        },
        brand: {
          50: "#eef6ff",
          100: "#d9ebff",
          200: "#b6d6ff",
          300: "#84b9ff",
          400: "#4e93ff",
          500: "#1f6bff",
          600: "#0b50e6",
          700: "#073dbb",
          800: "#0a3591",
          900: "#0d2f73"
        },
        danger: {
          50: "#fff1f1",
          100: "#ffdede",
          500: "#e23636",
          600: "#c81e1e",
          700: "#9b1616"
        },
        warn: {
          50: "#fff8eb",
          100: "#feecc5",
          500: "#f29e0b",
          600: "#c87b04"
        },
        good: {
          50: "#effdf3",
          100: "#d6f9e0",
          500: "#22b457",
          600: "#178a44"
        },
        surface: {
          0: "#ffffff",
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a"
        }
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Inter", "Helvetica", "Arial", "sans-serif"]
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(15, 23, 42, 0.04), 0 2px 8px -2px rgba(15, 23, 42, 0.08)"
      },
      borderRadius: {
        xl: "0.9rem"
      }
    }
  },
  plugins: []
};

export default config;
