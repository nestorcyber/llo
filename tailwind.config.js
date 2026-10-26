/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        linkedin: {
          light: '#378fe9',
          DEFAULT: '#0a66c2',
          dark: '#004182',
          navy: '#0b2545',
        },
        brand: {
          primary: '#0a66c2',
          accent: '#f59e0b',
          success: '#10b981',
          danger: '#ef4444',
          warning: '#f59e0b',
          neutral: '#1e293b',
          surface: '#f8fafc',
        }
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 2px 8px -1px rgba(0, 0, 0, 0.08), 0 1px 4px -1px rgba(0, 0, 0, 0.04)',
        hover: '0 8px 16px -2px rgba(10, 102, 194, 0.12), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      }
    },
  },
  plugins: [],
}
