/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'vscode-bg': '#1e1e1e',
        'vscode-panel': '#252526',
        'vscode-border': '#3c3c3c',
        'vscode-blue': '#569cd6',
        'vscode-button': '#0e639c',
        'vscode-button-hover': '#1177bb',
      },
    },
  },
  plugins: [],
}
