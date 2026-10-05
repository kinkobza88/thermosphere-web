import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

import DensityAnalysis from './pages/DensityAnalysis'
import DragAnalysis from './pages/DragAnalysis'
import SpaceWeather from './pages/SpaceWeather'
import Dashboard from './pages/Dashboard'

import './App.css'

function App() {
  // ============================================================
  // STATE
  // ============================================================

  const [result, setResult] = useState(null)
  const [densitySeries, setDensitySeries] = useState([])

  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  // ข้อมูลของเรามีปี 2024
  const [selectedDate, setSelectedDate] = useState('2024-01-01')

  // ดาวเทียมที่ใช้
  const [selectedSatellite] = useState('Swarm-A')

  // หน้าปัจจุบัน
  const [activePage, setActivePage] = useState('dashboard')

  // ============================================================
  // LOAD DATA WHEN DATE CHANGES
  // ============================================================

  useEffect(() => {
    getDashboardData()
  }, [selectedDate])

  // ============================================================
  // HELPER
  // ============================================================

  function firstValue(...values) {
    for (const value of values) {
      if (
        value !== undefined &&
        value !== null &&
        value !== ''
      ) {
        return value
      }
    }

    return null
  }

  // ============================================================
  // LOAD ONE FULL DAY WITH PAGINATION
  // ============================================================

  async function loadDailyTable(
    tableName,
    startDate,
    endDate,
    satellite = null
  ) {
    let allRows = []
    let from = 0

    const batchSize = 1000

    while (true) {
      let query = supabase
        .from(tableName)
        .select('*')
        .gte('timestamp', startDate)
        .lt('timestamp', endDate)
        .order('timestamp', { ascending: true })
        .range(from, from + batchSize - 1)

      if (satellite) {
        query = query.eq('satellite', satellite)
      }

      const { data, error } = await query

      if (error) {
        console.error(`${tableName} ERROR:`, error)
        throw error
      }

      if (!data || data.length === 0) {
        break
      }

      allRows = [...allRows, ...data]

      if (data.length < batchSize) {
        break
      }

      from += batchSize
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
      // --------------------------------------------------------
      // Date range
      // --------------------------------------------------------

      const startDate =
        `${selectedDate}T00:00:00Z`

      const nextDate =
        new Date(`${selectedDate}T00:00:00Z`)

      nextDate.setUTCDate(
        nextDate.getUTCDate() + 1
      )

      const endDate =
        nextDate.toISOString()

      console.log(
        'DATE RANGE:',
        startDate,
        endDate
      )

      // ========================================================
      // 1. SWARM DENSITY
      // ========================================================

      const swarmDensity =
        await loadDailyTable(
          'swarm_density',
          startDate,
          endDate,
          selectedSatellite
        )

      console.log(
        'SWARM DENSITY:',
        swarmDensity
      )

      // ========================================================
      // 2. SATELLITE ORBIT
      // ========================================================

      const orbitData =
        await loadDailyTable(
          'satellite_orbit',
          startDate,
          endDate,
          selectedSatellite
        )

      console.log(
        'ORBIT DATA:',
        orbitData
      )

      // ========================================================
      // 3. SPACE WEATHER
      // ========================================================

      const weatherData =
        await loadDailyTable(
          'space_weather',
          startDate,
          endDate
        )

      console.log(
        'SPACE WEATHER:',
        weatherData
      )

      // ========================================================
      // 4. SATELLITE ADYN / DRAG
      // ========================================================

      const adynData =
        await loadDailyTable(
          'satellite_adyn',
          startDate,
          endDate,
          selectedSatellite
        )

      console.log(
        'ADYN DATA:',
        adynData
      )

      // ========================================================
      // 5. SATELLITE PROPERTIES
      // ========================================================

      const {
        data: properties,
        error: propertiesError
      } = await supabase
        .from('satellite_properties')
        .select('*')
        .eq('satellite', selectedSatellite)
        .maybeSingle()

      if (propertiesError) {
        console.warn(
          'SATELLITE PROPERTIES ERROR:',
          propertiesError
        )
      }

      console.log(
        'SATELLITE PROPERTIES:',
        properties
      )

      // ========================================================
      // CHECK DENSITY
      // ========================================================

      if (
        !swarmDensity ||
        swarmDensity.length === 0
      ) {
        setResult(null)
        setDensitySeries([])
        setError(
          `No density data found for ${selectedDate}`
        )
        setLoading(false)
        return
      }

      // ========================================================
      // CREATE LOOKUP MAPS USING TIMESTAMP
      // ========================================================

      const orbitMap = new Map()

      orbitData.forEach((item) => {
        orbitMap.set(
          item.timestamp,
          item
        )
      })

      const weatherMap = new Map()

      weatherData.forEach((item) => {
        weatherMap.set(
          item.timestamp,
          item
        )
      })

      const adynMap = new Map()

      adynData.forEach((item) => {
        adynMap.set(
          item.timestamp,
          item
        )
      })

      // ========================================================
      // MERGE DATA FOR GRAPH
      // ========================================================

      const mergedSeries =
        swarmDensity.map((densityRow) => {
          const timestamp =
            densityRow.timestamp

          const orbit =
            orbitMap.get(timestamp) || {}

          const weather =
            weatherMap.get(timestamp) || {}

          const adyn =
            adynMap.get(timestamp) || {}

          return {
            ...densityRow,
            ...orbit,
            ...weather,
            ...adyn,

            timestamp,

            // --------------------------------------------------
            // DNS / SWARM DENSITY
            // --------------------------------------------------

            density_dns_kg_m3:
              firstValue(
                densityRow.density_dns_kg_m3,
                densityRow.dns_density_kg_m3,
                densityRow.density_kg_m3,
                densityRow.density,
                densityRow.rho
              ),

            // --------------------------------------------------
            // NRLMSISE DENSITY
            // --------------------------------------------------

            density_nrl_kg_m3:
              firstValue(
                adyn.density_nrl_kg_m3,
                adyn.nrlmsise_density_kg_m3,
                adyn.nrlmsise00_density_kg_m3,
                adyn.model_density_kg_m3
              ),

            // --------------------------------------------------
            // DRAG DNS
            // --------------------------------------------------

            drag_dns_n:
              firstValue(
                adyn.drag_dns_n,
                adyn.drag_force_dns_n,
                adyn.drag_observed_n
              ),

            // --------------------------------------------------
            // DRAG NRL
            // --------------------------------------------------

            drag_nrl_n:
              firstValue(
                adyn.drag_nrl_n,
                adyn.drag_force_nrl_n,
                adyn.drag_force_n
              )
          }
        })

      console.log(
        'MERGED SERIES:',
        mergedSeries
      )

      console.log(
        'TOTAL POINTS:',
        mergedSeries.length
      )

      setDensitySeries(
        mergedSeries
      )

      // ========================================================
      // LATEST RESULT OF SELECTED DAY
      // ========================================================

      const latestDensity =
        swarmDensity[
          swarmDensity.length - 1
        ] || {}

      const latestOrbit =
        orbitData[
          orbitData.length - 1
        ] || {}

      const latestWeather =
        weatherData[
          weatherData.length - 1
        ] || {}

      const latestAdyn =
        adynData[
          adynData.length - 1
        ] || {}

      // ========================================================
      // CREATE SUMMARY OBJECT
      // ========================================================

      const summary = {
        // ------------------------------------------------------
        // BASIC
        // ------------------------------------------------------

        satellite:
          selectedSatellite,

        timestamp:
          firstValue(
            latestDensity.timestamp,
            latestOrbit.timestamp
          ),

        // ------------------------------------------------------
        // POSITION
        // ------------------------------------------------------

        altitude_km:
          firstValue(
            latestOrbit.altitude_km,
            latestDensity.altitude_km,
            latestAdyn.altitude_km
          ),

        latitude:
          firstValue(
            latestOrbit.latitude,
            latestOrbit.latitude_deg,
            latestDensity.latitude,
            latestDensity.latitude_deg
          ),

        longitude:
          firstValue(
            latestOrbit.longitude,
            latestOrbit.longitude_deg,
            latestDensity.longitude,
            latestDensity.longitude_deg
          ),

        // ------------------------------------------------------
        // DENSITY
        // ------------------------------------------------------

        density_dns_kg_m3:
          firstValue(
            latestDensity.density_dns_kg_m3,
            latestDensity.dns_density_kg_m3,
            latestDensity.density_kg_m3,
            latestDensity.density,
            latestDensity.rho
          ),

        density_nrl_kg_m3:
          firstValue(
            latestAdyn.density_nrl_kg_m3,
            latestAdyn.nrlmsise_density_kg_m3,
            latestAdyn.nrlmsise00_density_kg_m3,
            latestAdyn.model_density_kg_m3
          ),

        // ------------------------------------------------------
        // DRAG
        // ------------------------------------------------------

        drag_dns_n:
          firstValue(
            latestAdyn.drag_dns_n,
            latestAdyn.drag_force_dns_n,
            latestAdyn.drag_observed_n
          ),

        drag_nrl_n:
          firstValue(
            latestAdyn.drag_nrl_n,
            latestAdyn.drag_force_nrl_n,
            latestAdyn.drag_force_n
          ),

        // ------------------------------------------------------
        // DRAG ACCELERATION
        // ------------------------------------------------------

        drag_acceleration_dns_m_s2:
          firstValue(
            latestAdyn.drag_acceleration_dns_m_s2,
            latestAdyn.acceleration_dns_m_s2
          ),

        drag_acceleration_nrl_m_s2:
          firstValue(
            latestAdyn.drag_acceleration_nrl_m_s2,
            latestAdyn.acceleration_nrl_m_s2
          ),

        // ------------------------------------------------------
        // SPACE WEATHER
        // ------------------------------------------------------

        f107:
          firstValue(
            latestWeather.f107,
            latestWeather.f10_7,
            latestWeather.f107_observed
          ),

        f107a:
          firstValue(
            latestWeather.f107a,
            latestWeather.f10_7a,
            latestWeather.f107_adjusted
          ),

        kp:
          firstValue(
            latestWeather.kp,
            latestWeather.kp_index
          ),

        ap:
          firstValue(
            latestWeather.ap,
            latestWeather.ap_index
          ),

        ap_3h:
          firstValue(
            latestWeather.ap_3h,
            latestWeather.ap3h
          ),

        dst:
          firstValue(
            latestWeather.dst,
            latestWeather.dst_nt
          ),

        sym_h:
          firstValue(
            latestWeather.sym_h,
            latestWeather.symh
          ),

        // ------------------------------------------------------
        // ORBIT
        // ------------------------------------------------------

        orbit_number:
          firstValue(
            latestOrbit.orbit_number,
            latestOrbit.orbit
          ),

        relative_velocity_km_s:
          firstValue(
            latestOrbit.relative_velocity_km_s,
            latestAdyn.relative_velocity_km_s,
            latestAdyn.velocity_relative_km_s
          ),

        semi_major_axis_km:
          firstValue(
            latestOrbit.semi_major_axis_km,
            latestOrbit.sma_km
          ),

        eccentricity:
          latestOrbit.eccentricity,

        specific_orbital_energy_j_kg:
          firstValue(
            latestOrbit.specific_orbital_energy_j_kg,
            latestOrbit.orbital_energy_j_kg
          ),

        perigee_altitude_km:
          firstValue(
            latestOrbit.perigee_altitude_km,
            latestOrbit.perigee_km
          ),

        apogee_altitude_km:
          firstValue(
            latestOrbit.apogee_altitude_km,
            latestOrbit.apogee_km
          ),

        // ------------------------------------------------------
        // SATELLITE PROPERTIES
        // ------------------------------------------------------

        mass_kg:
          firstValue(
            properties?.default_mass_kg,
            properties?.mass_kg,
            latestAdyn.mass_kg
          ),

        area_projected_m2:
          firstValue(
            latestAdyn.area_projected_m2,
            latestAdyn.projected_area_m2,
            properties?.default_area_m2
          ),

        cd:
          firstValue(
            latestAdyn.cd,
            properties?.cd
          ),

        // ------------------------------------------------------
        // OTHER
        // ------------------------------------------------------

        local_solar_time:
          firstValue(
            latestDensity.local_solar_time,
            latestOrbit.local_solar_time
          ),

        validity_flag:
          firstValue(
            latestDensity.validity_flag,
            latestDensity.quality_flag
          ),

        model_name:
          'NRLMSISE-00'
      }

      console.log(
        'FINAL DASHBOARD RESULT:',
        summary
      )

      setResult(summary)

      setLoading(false)

    } catch (err) {
      console.error(
        'DASHBOARD ERROR:',
        err
      )

      setError(
        err?.message ||
        'Unable to load dashboard data'
      )

      setLoading(false)
    }
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="app-layout">

      {/* ========================================================
          SIDEBAR
      ======================================================== */}

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

      {/* ========================================================
          MAIN CONTENT
      ======================================================== */}

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
          />
        )}

        {activePage === 'drag' && (
          <DragAnalysis
            result={result}
            densitySeries={densitySeries}
          />
        )}


        {activePage === 'weather' && (
          <SpaceWeather
            result={result}
          />
        )}

      </main>

    </div>
  )
}

export default App