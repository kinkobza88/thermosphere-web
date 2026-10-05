import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

import DensityAnalysis from './pages/DensityAnalysis'
import DragAnalysis from './pages/DragAnalysis'
import SpaceWeather from './pages/SpaceWeather'
import Dashboard from './pages/Dashboard'

import './App.css'

function App() {
  const [result, setResult] = useState(null)
  const [densitySeries, setDensitySeries] = useState([])

  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const [selectedDate, setSelectedDate] =
    useState('2024-05-11')

  const [activePage, setActivePage] =
    useState('dashboard')

  const selectedSatellite = 'Swarm-A'

  const PAGE_SIZE = 1000


  // ============================================================
  // LOAD DATA WHEN DATE CHANGES
  // ============================================================

  useEffect(() => {
    getDashboardData()
  }, [selectedDate])


  // ============================================================
  // LOAD ALL ROWS FROM SATELLITE_TIMESERIES
  // ============================================================

  async function loadSatelliteDay(startDate, endDate) {
    const allRows = []

    let from = 0

    while (true) {
      const { data, error } = await supabase
        .from('satellite_timeseries')
        .select('*')
        .eq('satellite', selectedSatellite)
        .gte('timestamp', startDate)
        .lt('timestamp', endDate)
        .order('timestamp', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)

      if (error) {
        throw error
      }

      if (!data || data.length === 0) {
        break
      }

      allRows.push(...data)

      if (data.length < PAGE_SIZE) {
        break
      }

      from += PAGE_SIZE
    }

    return allRows
  }


  // ============================================================
  // LOAD SPACE WEATHER
  // ============================================================

  async function loadSpaceWeatherDay(startDate, endDate) {
    const allRows = []

    let from = 0

    while (true) {
      const { data, error } = await supabase
        .from('space_weather')
        .select('*')
        .gte('timestamp', startDate)
        .lt('timestamp', endDate)
        .order('timestamp', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)

      if (error) {
        throw error
      }

      if (!data || data.length === 0) {
        break
      }

      allRows.push(...data)

      if (data.length < PAGE_SIZE) {
        break
      }

      from += PAGE_SIZE
    }

    return allRows
  }


  // ============================================================
  // MAIN DATABASE FUNCTION
  // ============================================================

  async function getDashboardData() {
    setLoading(true)
    setError(null)

    try {
      const startDate =
        `${selectedDate}T00:00:00Z`

      const nextDate =
        new Date(`${selectedDate}T00:00:00Z`)

      nextDate.setUTCDate(
        nextDate.getUTCDate() + 1
      )

      const endDate =
        nextDate.toISOString()


      const [
        satelliteRows,
        weatherRows
      ] = await Promise.all([
        loadSatelliteDay(
          startDate,
          endDate
        ),

        loadSpaceWeatherDay(
          startDate,
          endDate
        )
      ])


      console.log(
        'SATELLITE TIMESERIES:',
        satelliteRows
      )

      console.log(
        'SPACE WEATHER:',
        weatherRows
      )


      // ไม่มีข้อมูล
      if (
        !satelliteRows ||
        satelliteRows.length === 0
      ) {
        setResult(null)
        setDensitySeries([])

        setError(
          `No satellite data found for ${selectedDate}`
        )

        return
      }


      // ส่งข้อมูลทั้งวันให้หน้า Density / Drag
      setDensitySeries(
        satelliteRows
      )


      // ข้อมูลล่าสุดของวัน
      const latestSatellite =
        satelliteRows[
          satelliteRows.length - 1
        ]

      const latestWeather =
        weatherRows.length > 0
          ? weatherRows[
              weatherRows.length - 1
            ]
          : {}


      // ========================================================
      // SUMMARY OBJECT
      // ใช้ชื่อ field เดิมเพื่อให้หน้าอื่นยังทำงานได้
      // ========================================================

      const summary = {
        satellite:
          latestSatellite.satellite,

        timestamp:
          latestSatellite.timestamp,


        // POSITION
        altitude_km:
          latestSatellite.altitude_km,

        latitude:
          latestSatellite.latitude_deg,

        longitude:
          latestSatellite.longitude_deg,


        // DENSITY
        density_dns_kg_m3:
          latestSatellite.density_dns_kg_m3,

        density_nrl_kg_m3:
          latestSatellite.density_nrl_kg_m3,


        // DRAG
        drag_dns_n:
          latestSatellite.drag_dns_n,

        drag_nrl_n:
          latestSatellite.drag_nrl_n,


        // DRAG ACCELERATION
        drag_acceleration_dns_m_s2:
          latestSatellite.drag_accel_dns_m_s2,

        drag_acceleration_nrl_m_s2:
          latestSatellite.drag_accel_nrl_m_s2,


        // SPACE WEATHER
        f107:
          latestWeather.f107,

        f107a:
          latestWeather.f107a,

        kp:
          latestWeather.kp,

        ap:
          latestWeather.ap_daily,

        ap_3h:
          latestWeather.ap_3h,

        dst:
          latestWeather.dst_nt,

        sym_h:
          latestWeather.sym_h_nt,


        // ORBIT
        orbit_number:
          latestSatellite.orbit_number,

        relative_velocity_km_s:
          latestSatellite.relative_velocity_km_s,

        semi_major_axis_km:
          latestSatellite.semi_major_axis_km,

        eccentricity:
          latestSatellite.eccentricity,

        specific_orbital_energy_j_kg:
          latestSatellite.specific_orbital_energy_j_kg,

        perigee_altitude_km:
          latestSatellite.perigee_altitude_km,

        apogee_altitude_km:
          latestSatellite.apogee_altitude_km,


        // SATELLITE PROPERTIES
        mass_kg:
          latestSatellite.mass_kg,

        area_projected_m2:
          latestSatellite.projected_area_m2,

        cd:
          latestSatellite.cd,


        model_name:
          'NRLMSISE-00'
      }


      console.log(
        'FINAL RESULT:',
        summary
      )

      setResult(summary)

    } catch (err) {
      console.error(
        'DATABASE ERROR:',
        err
      )

      setResult(null)
      setDensitySeries([])

      setError(
        err?.message ||
        'Unable to load database'
      )

    } finally {
      setLoading(false)
    }
  }


  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="app-layout">

      {/* SIDEBAR */}

      <aside className="sidebar">

        <div className="logo">

          <div className="logo-icon">
            T
          </div>

          <div>
            <h2>
              THERMOSPHERE
            </h2>

            <p>
              Analysis System
            </p>
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


      {/* MAIN */}

      <main className="main-content">

        {loading && (
          <div className="status-message">
            Loading database...
          </div>
        )}


        {error && (
          <div className="error-message">
            {error}
          </div>
        )}


        {activePage === 'dashboard' && (
          <Dashboard
            result={result}
            densitySeries={densitySeries}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />
        )}


        {activePage === 'density' && (
          <DensityAnalysis
            result={result}
            densitySeries={densitySeries}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />
        )}


        {activePage === 'drag' && (
          <DragAnalysis
            result={result}
            densitySeries={densitySeries}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />
        )}


        {activePage === 'weather' && (
          <SpaceWeather
            result={result}
            densitySeries={densitySeries}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
          />
        )}

      </main>

    </div>
  )
}

export default App