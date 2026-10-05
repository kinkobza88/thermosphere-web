import { useState } from 'react'

import Dashboard from './pages/Dashboard'
import DensityAnalysis from './pages/DensityAnalysis'
import DragAnalysis from './pages/DragAnalysis'
import SpaceWeather from './pages/SpaceWeather'

import './App.css'

function App() {
  const [activePage, setActivePage] = useState('dashboard')

  const [selectedDate, setSelectedDate] = useState('2024-05-11')

  return (
    <div className="app-layout">

      {/* =========================
          SIDEBAR
      ========================= */}

      <aside className="sidebar">

        <div className="logo">
          <div className="logo-icon">
            T
          </div>

          <div>
            <h2>THERMOSPHERE</h2>
            <p>Analysis System</p>
          </div>
        </div>


        <nav>

          <button
            className={
              activePage === 'dashboard'
                ? 'active'
                : ''
            }
            onClick={() =>
              setActivePage('dashboard')
            }
          >
            Dashboard
          </button>


          <button
            className={
              activePage === 'density'
                ? 'active'
                : ''
            }
            onClick={() =>
              setActivePage('density')
            }
          >
            Density Analysis
          </button>


          <button
            className={
              activePage === 'drag'
                ? 'active'
                : ''
            }
            onClick={() =>
              setActivePage('drag')
            }
          >
            Drag Analysis
          </button>


          <button
            className={
              activePage === 'weather'
                ? 'active'
                : ''
            }
            onClick={() =>
              setActivePage('weather')
            }
          >
            Space Weather
          </button>

        </nav>


        <div className="sidebar-footer">
          <span>
            Database
          </span>

          <strong>
            ● Connected
          </strong>
        </div>

      </aside>


      {/* =========================
          MAIN CONTENT
      ========================= */}

      <main className="main-content">

        {activePage === 'dashboard' && (
          <Dashboard
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />
        )}


        {activePage === 'density' && (
          <DensityAnalysis
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />
        )}


        {activePage === 'drag' && (
          <DragAnalysis
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />
        )}


        {activePage === 'weather' && (
          <SpaceWeather
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />
        )}

      </main>

    </div>
  )
}

export default App