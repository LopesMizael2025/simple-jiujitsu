import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // paleta extraída da logo da Simple
        tinta: "#232020",   // preto da marca
        sangue: "#ED1F25",  // vermelho da marca
        fundo: "#0A0E13",
        painel: "#121A23",
        cartao: "#18222E",
        borda: "#243244",
        borda2: "#2F4157",
        texto: "#E8EEF5",
        texto2: "#8EA2B8",
        texto3: "#5D738C",
        ok: "#2EE6A8",
        atencao: "#FFB547",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
