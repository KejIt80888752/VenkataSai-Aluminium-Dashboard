/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0f5b8f',
          light:   '#2b8fd4',
          dark:    '#093a5c',
          50:      '#eef6fc',
          100:     '#cbe4f6',
          200:     '#9dcbec',
        },
        steel: {
          DEFAULT: '#64748b',
          light:   '#cbd5e1',
        },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Barlow Condensed', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
