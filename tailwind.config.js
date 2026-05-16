/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:   ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        arabic: ['"IBM Plex Sans Arabic"', 'Cairo', 'system-ui', 'sans-serif'],
      },
      colors: {
        cyber: {
          bg:      '#1F2B2D',   // Main canvas
          surface: '#253335',   // Elevated card surface
          teal:    '#0D8A9E',   // Primary brand
          cyan:    '#12B2C1',   // Electric accent
          text:    '#E5F9F8',   // Primary text
          muted:   '#7AAFB0',   // Secondary text
          dim:     '#4A7A7A',   // Tertiary / placeholder
          border:  '#1C4D4D',   // Hard border (solid)
        },
      },
      animation: {
        'float':       'float 6s ease-in-out infinite',
        'scan':        'scan 3s linear infinite',
        'pulse-slow':  'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-up':     'fadeUp 0.6s ease-out forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-12px)' },
        },
        scan: {
          '0%':   { top: '0%',   opacity: '0' },
          '10%':  { opacity: '1' },
          '90%':  { opacity: '1' },
          '100%': { top: '100%', opacity: '0' },
        },
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
