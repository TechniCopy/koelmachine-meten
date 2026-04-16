import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import KoelmachineGame from './KoelmachineGame.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <KoelmachineGame />
  </StrictMode>,
)
