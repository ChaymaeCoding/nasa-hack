/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aerospace: {
          dark: '#030712',
          panel: 'rgba(15, 23, 42, 0.75)',
          border: 'rgba(56, 189, 248, 0.25)',
          cyan: '#38bdf8',
          emerald: '#10b981',
          amber: '#f59e0b',
          crimson: '#ef4444'
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace']
      }
    },
  },
  plugins: [],
}
