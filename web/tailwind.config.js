/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Space Grotesk'", "Manrope", "sans-serif"],
        sans: ["Manrope", "system-ui", "sans-serif"],
      },
      colors: {
        ink: "#0b0f14",
        mist: "#e6eef5",
        ocean: "#0b3d91",
        coral: "#ff6b4a",
        teal: "#00c2a8",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,255,255,0.06), 0 18px 60px rgba(10, 20, 40, 0.5)",
      },
    },
  },
  plugins: [],
}
