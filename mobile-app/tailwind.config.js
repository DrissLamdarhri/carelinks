/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#0D0870",
        accent: "#5BB8D4",
        surface: "#EDE5CC",
      },
    },
  },
  plugins: [],
};
