import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import Landing from '@/views/Landing'
import ConsumerDashboard from '@/views/ConsumerDashboard'
import AnalystDashboard from '@/views/AnalystDashboard'
import DemoScenarios from '@/views/Demo'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Landing />} />
          <Route path="consumer" element={<ConsumerDashboard />} />
          <Route path="analyst" element={<AnalystDashboard />} />
          <Route path="demo" element={<DemoScenarios />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
