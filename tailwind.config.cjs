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
                    bg: '#F8FAFC', // Slate 50
                    'dark-bg': '#0B1120', // Deep dark blue/slate
                    'dark-card': '#1E293B', // Slate 800
                    'dark-subtext': '#94A3B8', // Slate 400
                    atom: '#EF4444', // Red for ATOM
                    one: '#3B82F6', // Blue for ATOM ONE
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
