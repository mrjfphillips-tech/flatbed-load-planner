/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ptv: {
          red:     '#E31E24',
          'red-dark': '#C4161C',
          orange:  '#F26522',
          pink:    '#C2185B',
          purple:  '#7B1FA2',
          bg:      '#f5f5f5',
          surface: '#ffffff',
          surface2:'#f2f2f2',
          border:  '#e0e0e0',
          text:    '#1a1a1a',
          text2:   '#333333',
          text3:   '#666666',
        },
      },
      backgroundImage: {
        'ptv-gradient': 'linear-gradient(135deg, #F26522 0%, #E31E24 35%, #C2185B 65%, #7B1FA2 100%)',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
