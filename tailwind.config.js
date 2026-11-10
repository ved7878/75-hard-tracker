/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        hard: {
          bg: '#0a0a0c',
          card: '#121318',
          border: '#1f222e',
          accent: '#e11d48', // bold athletic crimson red
          emerald: '#10b981', // completed green
          amber: '#f59e0b', // warning/travel yellow
          blue: '#3b82f6', // info/exemption
          muted: '#8e96a8',
          light: '#f8fafc',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      boxShadow: {
        'glow-red': '0 0 25px -5px rgba(225, 29, 72, 0.4)',
        'glow-green': '0 0 25px -5px rgba(16, 185, 129, 0.35)',
        'card': '0 4px 20px -2px rgba(0, 0, 0, 0.5)',
      }
    },
  },
  plugins: [],
}

