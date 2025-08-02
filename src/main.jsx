import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// PDF configuration happens in pdfService.js
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
