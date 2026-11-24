import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "var(--brand-primary, #10457C)",
          red: "var(--chilli-red, #DA2C38)",
        },
        chilli: {
          navy: {
            DEFAULT: "#10457C",
            50: "#F0F5FA",
            100: "#E1EDF7",
            200: "#C4DBEF",
            300: "#97C1E4",
            400: "#5A9FD4",
            500: "#185EA5",
            600: "#10457C",
            700: "#0D3763",
            800: "#0A2B4E",
            900: "#08203B",
            950: "#051426",
          },
          red: {
            DEFAULT: "#DA2C38",
            50: "#FDF2F3",
            100: "#FCE5E6",
            200: "#F9CED1",
            300: "#F4A6AC",
            400: "#EC737D",
            500: "#E04652",
            600: "#DA2C38",
            700: "#B81D28",
            800: "#981B24",
            900: "#7E1C23",
            950: "#450A0E",
          },
        },
      },
      boxShadow: {
        bespoke: "0 4px 20px -2px rgba(16, 69, 124, 0.08), 0 2px 6px -1px rgba(16, 69, 124, 0.04)",
        "bespoke-hover": "0 10px 25px -3px rgba(16, 69, 124, 0.12), 0 4px 10px -2px rgba(16, 69, 124, 0.06)",
        "chilli-glow": "0 0 15px -3px rgba(218, 44, 56, 0.3)",
        "navy-glow": "0 0 20px -3px rgba(16, 69, 124, 0.25)",
      },
    },
  },
  plugins: [],
};
export default config;
