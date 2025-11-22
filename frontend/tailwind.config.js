/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "node_modules/flowbite-react/lib/esm/**/*.js"
  ],
  darkMode: 'class', // Use class-based dark mode (dark only if .dark class is present, which we never add)
  theme: {
    extend: {},
  },
  plugins: [
    require('flowbite/plugin')
  ],
}
