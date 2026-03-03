/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        deep: '#0A0A0F',
        base: '#111118',
        surface: '#1A1A24',
        elevated: '#24242F',
        border: '#2E2E3A',
        blood: { DEFAULT: '#8B1A1A', light: '#B22222', glow: '#FF3333' },
        gold: { DEFAULT: '#C9A84C', light: '#E8CC6E' },
        infernal: { DEFAULT: '#6B2FA0', light: '#9B59B6' },
        iron: '#B0592A',
        essence: '#6E44AA',
        souls: '#3CA66B',
        parchment: '#F0E6D2',
        muted: '#9B8E7E',
      },
      fontFamily: {
        display: ['MedievalSharp', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
