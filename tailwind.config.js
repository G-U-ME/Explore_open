/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    // 保持您原有的 fontSize 配置不变
    fontSize: {
      'xs': ['12px', '18px'],
      'sm': ['14px', '20px'],
      'base': ['16px', '24px'],
      'lg': ['18px', '28px'],
      'xl': ['22px', '32px'],
      '2xl': ['26px', '36px'],
      'title': ['28px', '36px'],
      'content': ['20px', '28px'],
      'small': ['14px', '20px'],
    },
    extend: {
      fontFamily: {
        'inter': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        'bruno-ace': ['Bruno Ace', 'sans-serif'],
      },
      colors: {
        'dark-bg': '#101010',
        'card-bg': '#222222',
        'secondary-card': '#313131',
        'neon-green': '#13E425',
        'gray-custom': {
          400: '#4C4C4C',
          500: '#5C5C5C',
          600: '#666666',
          700: '#888888',
          800: '#999999',
          900: '#CCCCCC',
        }
      },
      boxShadow: {
        'card': '-4px 8px 24px rgba(0, 0, 0, 0.3)',
        'card-light': '-4px 8px 24px rgba(0, 0, 0, 0.15)',
        'neon': '0 0 12px #13E425',
      },
      borderRadius: {
        'card': '24px',
        'button': '20px',
        'project': '10px',
      },
      spacing: {
        'card-padding': '16px',
        'button-padding': '8px 16px',
      },
      width: {
        'card': '380px',
        'sidebar': '220px',
        'tree': '260px',
      },
      height: {
        'card': '260px',
      }
    },
  },
  plugins: [],
}