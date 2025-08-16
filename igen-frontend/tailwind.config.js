/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
       colors: {
        brand: '#456576',
        igen:'#0042D6',
        shadow:'#9CD7E5',
        btn_log:'#6CB9D8',
        
      },
      keyframes: {
         'fade-in': {
      '0%': { opacity: '0' },
      '100%': { opacity: '1' },
    },
    'fade-in-slow': {
      '0%': { opacity: '0' },
      '100%': { opacity: '1' },
    },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'gradient-xy': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      animation: {
        'fade-in': 'fade-in 1s ease-out forwards',
        'fade-in-slow': 'fade-in 2s ease-out forwards',
        'slide-up': 'slide-up 0.6s ease-out forwards',
        'slide-down': 'slide-down 0.6s ease-out forwards',
        'gradient-xy': 'gradient-xy 15s ease infinite',
        'fade-in': 'fade-in 0.6s ease-out forwards',
    'fade-in-slow': 'fade-in-slow 1.2s ease-out forwards',
      },
      backgroundSize: {
        '400': '400% 400%',
      },
    },
  },
  plugins: [],
};