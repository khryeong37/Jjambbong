/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./hooks/**/*.{js,ts,jsx,tsx}",
        "./utils/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        fontFamily: {
            sans: ['"Google Sans Flex"', 'sans-serif'],
        },
        extend: {
            colors: {
                aether: {
                    // Light Mode
                    bg: '#F8FAFC',
                    // Dark Mode - Navy-Based Unified Palette
                    'dark-bg': '#090C12', // Base deep navy-black
                    'dark-bg-alt': '#0A0E16', // Alternative navy
                    'dark-bg-gradient-start': '#0B0F17', // Gradient start
                    'dark-bg-gradient-end': '#0D121A', // Gradient end
                    'dark-surface': '#0E1118', // Surface layer
                    'dark-card': '#0F1219', // Card/panel background
                    'dark-card-elevated': '#10131A', // Elevated card
                    // Text Hierarchy - WCAG AA+ compliant
                    'dark-text': '#FFFFFF', // Primary text
                    'dark-text-secondary': '#9FB0C3', // Secondary text
                    'dark-text-tertiary': '#6B7A8F', // Tertiary text
                    'dark-text-muted': '#4A5568', // Muted text
                    // Glass Surface Colors (6-12% range)
                    'dark-glass': 'rgba(255, 255, 255, 0.06)', // Base glass (6%)
                    'dark-glass-elevated': 'rgba(255, 255, 255, 0.09)', // Elevated glass (9%)
                    'dark-glass-highlight': 'rgba(255, 255, 255, 0.12)', // Highlight glass (12%)
                    // Glass Borders & Rim Lights
                    'dark-border': 'rgba(200, 215, 232, 0.14)', // Glass stroke border
                    'dark-border-rim': 'rgba(200, 215, 232, 0.18)', // Rim light border
                    'dark-glow': 'rgba(255, 255, 255, 0.02)', // Ambient glow (subtle)
                    // Accent Color - Single Cyan (Accent only)
                    'accent-cyan': '#4ED6E6', // Primary accent (Cyan)
                    // Brand Colors (Preserved - for Impact Map charts)
                    atom: '#f87171', // Red for ATOM (DO NOT CHANGE)
                    one: '#60a5fa', // Blue for ATOM ONE (DO NOT CHANGE)
                    mixed: '#A855F7', // Purple for MIXED (DO NOT CHANGE)
                }
            },
            animation: {
                'blob-1': 'blob 7s infinite',
                'blob-2': 'blob 7s infinite 2s',
                'blob-3': 'blob 7s infinite 4s',
                'blob-4': 'blob 7s infinite 6s',
                'aurora': 'aurora 60s linear infinite',
            },
            keyframes: {
                blob: {
                    '0%': { transform: 'translate(0px, 0px) scale(1)' },
                    '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
                    '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
                    '100%': { transform: 'translate(0px, 0px) scale(1)' },
                },
                aurora: {
                    from: {
                        backgroundPosition: '50% 50%, 50% 50%',
                    },
                    to: {
                        backgroundPosition: '350% 50%, 350% 50%',
                    },
                }
            }
        },
    },
    plugins: [],
}
