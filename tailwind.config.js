/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // حافظنا على الـ English Font الأساسي وضمنّا القاهرة للعربي بقوة
        sans:   ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        arabic: ['Cairo', '"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
      },
      colors: {
        // القاعدة والعمق للمنصة الفخمة
        background: "#0D1117",
        sapphire: {
          DEFAULT: "#3C507D",
          dark: "#1A2644",
          light: "#566C9E",
        },
        royal: {
          DEFAULT: "#112250",
          deep: "#081026",
          surface: "#162A60",
        },
        // الذهب الرايق لـ Premium CTAs أو البادجات الخاصة
        quicksand: {
          DEFAULT: "#E0C58F",   // Primary gold — active states, main CTAs
          dark:    "#C6AA73",   // Secondary gold — supporting buttons, labels
          light:   "#F0DFBF",   // Lightest gold — hover highlights
        },
        canvas: {
          white: "#F5F0E9",
          neutral: "#D9CBC2",
        },
        // سيستم الأسطح الزجاجية والنيون الراقي
        glass: {
          bg: "rgba(60, 80, 125, 0.15)",
          border: "rgba(60, 80, 125, 0.25)",
          hover: "rgba(60, 80, 125, 0.35)",
        },
        neon: {
          cyan: "rgba(18, 178, 193, 0.35)",
        },
        // ترحيل وتوحيد المتغيرات القديمة لتفادي أي تضارب بالأكواد الحالية
        cyber: {
          bg:      '#0D1117',   // تحويل الخلفية للون الداكن الفخم الجديد
          surface: 'rgba(60, 80, 125, 0.15)', // تحويل الأسطح لزجاج سافاير
          teal:    '#3C507D',   // ربط التيل القديم بالسافاير لضمان التوافقية
          cyan:    '#12B2C1',   // الأكسنت المضيء
          text:    '#F5F0E9',   // الأبيض الناعم
          muted:   '#D9CBC2',   // النيوترال المريح
          dim:     '#e1ebed',   // السافاير الفاتح كـ Placeholder
          border:  'rgba(60, 80, 125, 0.25)', 
        },
      },
      // تباعد الكلمات الفخم للإنجليزي (Tracking)
      letterSpacing: {
        lux: "0.08em",      // عناوين رئيسية تنبض بالفخامة
        sublux: "0.04em",   // عناوين فرعية
        bodylux: "0.02em",  // نصوص عادية
      },
      boxShadow: {
        "neon-sapphire": "0 0 15px -3px rgba(60, 80, 125, 0.25), 0 0 6px -2px rgba(60, 80, 125, 0.15)",
        "neon-cyan": "0 0 18px -4px rgba(18, 178, 193, 0.25), 0 0 8px -2px rgba(18, 178, 193, 0.15)",
      },
      // الحفاظ الكامل على الحركات والأنيميشنز الأصلية للمشروع عندك لعدم ضرب أي لوجيك
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