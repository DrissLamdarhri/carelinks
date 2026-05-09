/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    // Point vers les sources uniquement, pas node_modules
    "../shared/src/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary:   "#0D0870",
        cream:     "#EDE5CC",
        sky:       "#5BB8D4",
        skyLight:  "#8ECFDF",
      },
      borderRadius: {
        carelink: "16px",
      },
    },
  },
  plugins: [],
};