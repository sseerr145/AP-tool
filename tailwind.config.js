/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html", 
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.jsx",
    "./src/components/*.jsx"
  ],
  theme: { 
    extend: {} 
  },
  plugins: [],
  safelist: [
    // Safelist commonly used classes that might not be detected
    'bg-blue-50', 'bg-blue-100', 'bg-blue-600', 'bg-blue-700',
    'bg-green-50', 'bg-green-100', 'bg-green-600', 'bg-green-700',
    'bg-gray-50', 'bg-gray-100', 'bg-gray-900',
    'border-blue-200', 'border-blue-300', 'border-blue-500',
    'text-blue-600', 'text-blue-800', 'text-white', 'text-gray-500', 'text-gray-600', 'text-gray-700', 'text-gray-900',
    'hover:bg-blue-100', 'hover:bg-blue-700', 'hover:bg-gray-100',
    'ring-2', 'ring-blue-500',
    'p-3', 'p-4', 'p-6', 'px-2', 'px-3', 'px-4', 'px-6', 'py-1', 'py-2', 'py-3',
    'mb-2', 'mb-3', 'mb-4', 'mb-6', 'mt-1', 'mt-2', 'mt-3', 'mt-4',
    'rounded', 'rounded-lg', 'rounded-md', 'rounded-full',
    'shadow-sm', 'shadow-lg', 'shadow-md',
    'font-medium', 'font-semibold', 'font-bold',
    'text-sm', 'text-lg', 'text-xl', 'text-2xl', 'text-xs'
  ]
};