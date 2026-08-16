import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Features from './pages/Features'
import Pricing from './pages/Pricing'
import Demo from './pages/Demo'
import Signup from './pages/Signup'
export default function App() {
    return (
        <Routes>
            <Route path="/" element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="features" element={<Features />} />
                <Route path="pricing" element={<Pricing />} />
                <Route path="demo" element={<Demo />} />
            </Route>
            <Route path="/signup" element={<Signup />} />
        </Routes>
    )
}
