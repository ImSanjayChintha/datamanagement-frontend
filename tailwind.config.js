/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', "'Segoe UI'", 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', "'Open Sans'", "'Helvetica Neue'", 'sans-serif'],
      },
      colors: {
        primary: { DEFAULT: '#2563eb', hover: '#1d4ed8' },
      },
    },
  },
  plugins: [],
};
