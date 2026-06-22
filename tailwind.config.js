/** @type {import('tailwindcss').Config} */
const plugin = require('tailwindcss/plugin');

module.exports = {
    darkMode: 'class',
    content: [
        './index.html',
        './404.html',
        './pages/**/*.html',
        './js/**/*.js',
        './css/**/*.css',
    ],
    safelist: [
        'open',
        'hidden',
        'active',
        'auth-ready',
        'theme-transition',
        'opacity-0',
        'opacity-100',
        'is-open',
        'is-start',
        'is-error',
        'disabled',
        'flex',
    ],
    theme: {
        extend: {
            colors: {
                'dark-bg': '#0F172A',
                'dark-card': '#1E2937',
                'dark-text': '#F1F5F9',
                'dark-text-secondary': '#CBD5E1',
                'dark-border': '#334155',
                'light-bg': '#F8F4ED',
                'light-card': '#FFFFFF',
                'light-text': '#1E2937',
                'light-text-secondary': '#334155',
                'light-border': '#E6D9C2',
                'light-gold': '#D97706',
                'light-green': '#15803D',
                'yaziyo-gold': 'rgb(var(--yaziyo-gold-rgb) / <alpha-value>)',
                'yaziyo-green': 'rgb(var(--yaziyo-green-rgb) / <alpha-value>)',
                'yaziyo-bg': 'rgb(var(--yaziyo-bg-rgb) / <alpha-value>)',
                'yaziyo-card': 'rgb(var(--yaziyo-card-rgb) / <alpha-value>)',
                'yaziyo-text': 'rgb(var(--yaziyo-text-rgb) / <alpha-value>)',
                'yaziyo-text-secondary': 'rgb(var(--yaziyo-text-secondary-rgb) / <alpha-value>)',
                'yaziyo-border': 'rgb(var(--yaziyo-border-rgb) / <alpha-value>)',
            },
            fontFamily: {
                poppins: ['Poppins', 'sans-serif'],
                inter: ['Inter', 'sans-serif'],
            },
            boxShadow: {
                'glow-gold': '0 0 15px rgba(var(--yaziyo-gold-rgb), 0.3)',
            },
        },
    },
    plugins: [
        plugin(({ addVariant }) => {
            addVariant('light', '.light &');
        }),
    ],
};
