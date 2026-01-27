/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            color: '#d1d5db',
            a: {
              color: '#60a5fa',
              '&:hover': {
                color: '#93c5fd',
              },
            },
            strong: {
              color: '#f9fafb',
            },
            code: {
              color: '#f9fafb',
              backgroundColor: '#374151',
              padding: '0.25rem 0.5rem',
              borderRadius: '0.25rem',
              fontSize: '0.875rem',
            },
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
            pre: {
              backgroundColor: '#111827',
              color: '#f9fafb',
              overflowX: 'auto',
              borderRadius: '0.5rem',
              padding: '1rem',
            },
            blockquote: {
              borderLeftColor: '#3b82f6',
              backgroundColor: '#1f2937',
              borderRadius: '0.25rem',
              padding: '0.5rem 1rem',
            },
            table: {
              borderColor: '#4b5563',
            },
            th: {
              borderColor: '#4b5563',
              backgroundColor: '#1f2937',
            },
            td: {
              borderColor: '#4b5563',
            },
            hr: {
              borderColor: '#4b5563',
            },
          },
        },
      },
    },
  },
  plugins: [],
} 