/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./hooks/**/*.{js,ts,jsx,tsx}",
        "./utils/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        fontFamily: {
            sans: ['"Google Sans Flex"', 'sans-serif'],
        },
        extend: {
            colors: {
                aether: {
                    // Light Mode
                    bg: '#F8FAFC',
                    // Dark Mode - Night-Navy Based Palette
                    'dark-bg': '#080A10', // Primary deep navy-black background
                    'dark-bg-alt': '#0C1018', // Alternative navy background
                    'dark-bg-gradient-start': '#0C111A', // Gradient start
                    'dark-bg-gradient-end': '#0D1422', // Gradient end
                    'dark-surface': '#0F1419', // Surface layer
                    'dark-card': '#11161D', // Card/panel background
                    'dark-card-elevated': '#141A22', // Elevated card
                    // Text Hierarchy - WCAG AA+ compliant (Pure White & Soft Gray)
                    'dark-text': '#FFFFFF', // Primary text - Pure White
                    'dark-text-secondary': '#C9D0DA', // Secondary text - Soft Gray
                    'dark-text-tertiary': '#8FA0B5', // Tertiary text - Muted Blue-Gray
                    'dark-text-muted': '#6B7A8F', // Muted text
                    // Glass Surface Colors
                    'dark-glass': 'rgba(255, 255, 255, 0.08)', // Base glass (8%)
                    'dark-glass-elevated': 'rgba(255, 255, 255, 0.12)', // Elevated glass (12%)
                    'dark-glass-highlight': 'rgba(255, 255, 255, 0.14)', // Highlight glass (14%)
                    // Glass Borders & Rim Lights
                    'dark-border': 'rgba(255, 255, 255, 0.10)', // Subtle border
                    'dark-border-rim': 'rgba(255, 255, 255, 0.15)', // Rim light border
                    'dark-glow': 'rgba(255, 255, 255, 0.04)', // Ambient glow
                    // Point Colors - Blue-Violet Spectrum
                    'point-primary': '#5A7FFF', // Blue-Violet
                    'point-secondary': '#4ED6E6', // Cyan-Aqua
                    // Brand Colors (Preserved)
                    atom: '#f87171', // Red for ATOM
                    one: '#60a5fa', // Blue for ATOM ONE
                    mixed: '#A855F7', // Purple for MIXED
                }
            },
            animation: {
                'blob-1': 'blob 7s infinite',
                'blob-2': 'blob 7s infinite 2s',
                'blob-3': 'blob 7s infinite 4s',
                'blob-4': 'blob 7s infinite 6s',
            },
            keyframes: {
                blob: {
                    '0%': { transform: 'translate(0px, 0px) scale(1)' },
                    '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
                    '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
                    '100%': { transform: 'translate(0px, 0px) scale(1)' },
                }
            }
        },
    },
    plugins: [],
}
