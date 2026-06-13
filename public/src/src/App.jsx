import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Room from './pages/Room'
import Admin from './pages/Admin'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/table/:code" element={<Room />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  )
}
