import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

import DensityAnalysis from './pages/DensityAnalysis'
import DragAnalysis from './pages/DragAnalysis'
import ModelComparison from './pages/ModelComparison'
import SpaceWeather from './pages/SpaceWeather'
import Dashboard from './pages/Dashboard'
import './App.css'

function App() {
const [result, setResult] = useState(null)
const [densitySeries, setDensitySeries] = useState([])
const [error, setError] = useState(null)
const [loading, setLoading] = useState(true)
const [selectedDate, setSelectedDate] = useState('2026-01-01')

  // หน้าเว็บปัจจุบัน
  const [activePage, setActivePage] = useState('dashboard')

useEffect(() => {
  getLatestResult()
}, [selectedDate])

  async function getLatestResult() {
    setLoading(true)
    setError(null)

    // 1. Drag ล่าสุด
    const { data: drag, error: dragError } = await supabase
      .from('drag_result')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (dragError) {
      setError(dragError.message)
      setLoading(false)
      return
    }

    if (!drag) {
      setError('Drag data not found')
      setLoading(false)
      return
    }

    // 2. JB2008 Density ล่าสุด
const { data: density, error: densityError } = await supabase
  .from('jb2008_result')
  .select('*')
  .order('timestamp', { ascending: false })
  .limit(1)
  .maybeSingle()

console.log('JB2008 DATA:', density)
console.log('JB2008 ERROR:', densityError)

if (densityError) {
  setError(densityError.message)
  setLoading(false)
  return
}

if (!density) {
  setError('JB2008 density data not found')
  setLoading(false)
  return
}     


    // 3. Model
  

    setResult({
  ...drag,

  // ข้อมูลจาก JB2008
  density_kg_m3: density.density_kg_m3,
  altitude_km: density.altitude_km,
  latitude: density.latitude,
  longitude: density.longitude,
  timestamp: density.timestamp,

  // Space Weather จาก CSV
  ap: density.ap,
  f107_observed: density.f107_observed,
  f107_adjusted: density.f107_adjusted,
  local_solar_time: density.local_solar_time,
  validity_flag: density.validity_flag,

  // Model
  model_name: 'JB2008'
})
// ดึงข้อมูล Density Time Series สำหรับกราฟ
const startDate = `${selectedDate}T00:00:00Z`

const nextDate = new Date(`${selectedDate}T00:00:00Z`)
nextDate.setUTCDate(nextDate.getUTCDate() + 1)

const endDate = nextDate.toISOString()

let allSeries = []
let from = 0
const batchSize = 1000
let hasMore = true

while (hasMore) {
  const { data: batch, error: batchError } = await supabase
    .from('jb2008_result')
    .select('timestamp, altitude_km, density_kg_m3')
    .gte('timestamp', startDate)
    .lt('timestamp', endDate)
    .order('timestamp', { ascending: true })
    .range(from, from + batchSize - 1)

  if (batchError) {
    console.error('Density series error:', batchError)
    hasMore = false
    break
  }

  if (!batch || batch.length === 0) {
    hasMore = false
    break
  }

  allSeries = [...allSeries, ...batch]

  console.log(
    `Loaded ${allSeries.length} density records`
  )

  if (batch.length < batchSize) {
    hasMore = false
  } else {
    from += batchSize
  }
}

console.log('ALL DENSITY SERIES:', allSeries)
console.log('TOTAL POINTS:', allSeries.length)

setDensitySeries(allSeries)

    setLoading(false)
  }
  // --------------------------
  // ---------------------------
  
  return (
    <div className="app-layout">

      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon">T</div>

          <div>
            <h2>THERMOSPHERE</h2>
            <p>Analysis System</p>
          </div>
        </div>

        <nav>
          <button
            className={activePage === 'dashboard' ? 'active' : ''}
            onClick={() => setActivePage('dashboard')}
          >
            Dashboard
          </button>

          <button
            className={activePage === 'density' ? 'active' : ''}
            onClick={() => setActivePage('density')}
          >
            Density Analysis
          </button>

          <button
            className={activePage === 'drag' ? 'active' : ''}
            onClick={() => setActivePage('drag')}
          >
            Drag Analysis
          </button>

          <button
            className={activePage === 'comparison' ? 'active' : ''}
            onClick={() => setActivePage('comparison')}
          >
            Model Comparison
          </button>

          <button
            className={activePage === 'weather' ? 'active' : ''}
            onClick={() => setActivePage('weather')}
          >
            Space Weather
          </button>
        </nav>

        <div className="sidebar-footer">
          <span>Database</span>
          <strong>● Connected</strong>
        </div>
      </aside>

      <main className="main-content">
       {activePage === 'dashboard' && (
  <Dashboard
  result={result}
  densitySeries={densitySeries}
  selectedDate={selectedDate}
  setSelectedDate={setSelectedDate}
/>
)}
        {activePage === 'density' && (
  <DensityAnalysis  />
)}
        {activePage === 'drag' && (
  <DragAnalysis result={result} />
)}
       {activePage === 'comparison' && (
  <ModelComparison result={result} />
)}
        {activePage === 'weather' && <SpaceWeather />}
      </main>

    </div>
  )
}

export default App