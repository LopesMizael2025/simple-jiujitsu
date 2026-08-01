import type { Config } from "tailwindcss";

/**
 * Preto, cinza e vermelho — no espírito do Liquid Glass.
 *
 * Três decisões que sustentam o resto:
 *
 * 1. O VERMELHO É DA MARCA E DO PERIGO, e de mais nada. Se ele também fosse o
 *    botão de confirmar, "revogar biometria" e "confirmar presença" gritariam
 *    igual — e aí nada mais chama atenção.
 *
 * 2. A AÇÃO PRINCIPAL É OSSO: um branco quente, preenchido. Maior contraste
 *    possível sobre preto, e harmoniza com o vermelho por temperatura.
 *
 * 3. OS CINZAS SÃO NEUTROS, sem o azul de antes. Azul é frio e vermelho é
 *    quente: juntos brigam. Neutro deixa o vermelho pertencer à paleta.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ---------------------------------------------------------- marca --
        tinta: "#232020",
        sangue: "#ED1F25", // vermelho da logo: marca + destrutivo + alerta
        brasa: "#F5333A", // um tom acima, para brilho de borda

        // ----------------------------------------------------- superfície --
        fundo: "#0B0A0C", // preto levemente quente, não azulado
        painel: "#141317",
        cartao: "#1A181D",
        borda: "#2A272E",
        borda2: "#3A363F",

        // ---------------------------------------------------------- texto --
        texto: "#F2F0EE",
        texto2: "#A8A4AC",
        texto3: "#827E88",

        // --------------------------------------------------------- sinais --
        // "ok" continua se chamando ok nos 70 lugares que já o usam: o que
        // mudou foi o que ele é. Agora é osso — confirmado, reconhecido, ativo.
        ok: "#F0E9DF",
        okEscuro: "#17151A", // o texto que vai por cima do osso
        atencao: "#FFB547", // o único aviso morno; separa "confira" de "erro"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
