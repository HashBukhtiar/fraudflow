import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/components/Layout'
import ConsumerDashboard from '@/views/ConsumerDashboard'
import AnalystDashboard from '@/views/AnalystDashboard'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/consumer" replace />} />
          <Route path="consumer" element={<ConsumerDashboard />} />
          <Route path="analyst" element={<AnalystDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
