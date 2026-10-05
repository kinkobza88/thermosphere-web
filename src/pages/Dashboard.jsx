import { useEffect, useMemo, useState } from 'react'

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'

import { Line } from 'react-chartjs-2'
import { supabase } from '../supabaseClient'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)


// ============================================================
// SETTINGS
// ============================================================

const SATELLITE = 'Swarm-A'
const MODEL = 'NRLMSISE-00'

const PAGE_SIZE = 1000


// ============================================================
// FORMAT FUNCTIONS
// ============================================================

function formatNumber(value, digits = 3) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'N/A'
  }

  return Number(value).toFixed(digits)
}


function formatScientific(value, digits = 3) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'N/A'
  }

  return Number(value).toExponential(digits)
}


function formatUtcTime(timestamp) {
  if (!timestamp) {
    return 'N/A'
  }

  return new Date(timestamp).toLocaleTimeString(
    'en-GB',
    {
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit'
    }
  )
}


function formatUtcDateTime(timestamp) {
  if (!timestamp) {
    return 'N/A'
  }

  return new Date(timestamp).toLocaleString(
    'en-GB',
    {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }
  ) + ' UTC'
}


// ============================================================
// READ ALL ROWS
//
// Supabase/PostgREST commonly returns max 1000 rows per request.
// One full day has 1440 minute samples.
//
// Therefore we fetch page-by-page.
// ============================================================

async function fetchSatelliteDay(startTime, endTime) {

  const allRows = []

  let from = 0

  while (true) {

    const { data, error } = await supabase
      .from('satellite_timeseries')
      .select(`
        timestamp,
        satellite,
        orbit_number,

        latitude_deg,
        longitude_deg,
        altitude_km,
        relative_velocity_km_s,

        mass_kg,
        projected_area_m2,
        cd,

        density_dns_kg_m3,
        density_nrl_kg_m3,

        drag_dns_n,
        drag_nrl_n,

        drag_accel_dns_m_s2,
        drag_accel_nrl_m_s2,

        semi_major_axis_km,
        eccentricity,
        specific_orbital_energy_j_kg,

        perigee_altitude_km,
        apogee_altitude_km
      `)
      .eq('satellite', SATELLITE)
      .gte('timestamp', startTime)
      .lt('timestamp', endTime)
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
// SPACE WEATHER
// ============================================================

async function fetchSpaceWeatherDay(startTime, endTime) {

  const allRows = []

  let from = 0

  while (true) {

    const { data, error } = await supabase
      .from('space_weather')
      .select(`
        timestamp,
        f107,
        f107a,
        ap_daily,
        ap_3h,
        kp,
        dst_nt,
        sym_h_nt
      `)
      .gte('timestamp', startTime)
      .lt('timestamp', endTime)
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
// DASHBOARD
// ============================================================

function Dashboard({
  selectedDate: selectedDateProp,
  setSelectedDate: setSelectedDateProp
}) {

  // ----------------------------------------------------------
  // Local date fallback
  //
  // 11 May 2024 is useful as default because it contains
  // the major May 2024 geomagnetic storm.
  // ----------------------------------------------------------

  const [localSelectedDate, setLocalSelectedDate] =
    useState('2024-05-11')

  const selectedDate =
    selectedDateProp || localSelectedDate

  const setSelectedDate =
    setSelectedDateProp || setLocalSelectedDate


  // ----------------------------------------------------------
  // State
  // ----------------------------------------------------------

  const [satelliteData, setSatelliteData] = useState([])
  const [spaceWeather, setSpaceWeather] = useState([])

  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')


  // ==========================================================
  // LOAD DATA
  // ==========================================================

  useEffect(() => {

    async function loadDashboard() {

      if (!selectedDate) {
        return
      }

      setLoading(true)
      setErrorMessage('')

      try {

        // ----------------------------------------------
        // UTC day range
        // ----------------------------------------------

        const start = new Date(
          `${selectedDate}T00:00:00Z`
        )

        const end = new Date(start)

        end.setUTCDate(
          end.getUTCDate() + 1
        )

        const startTime =
          start.toISOString()

        const endTime =
          end.toISOString()


        // ----------------------------------------------
        // Query both tables
        // ----------------------------------------------

        const [
          satelliteRows,
          weatherRows
        ] = await Promise.all([
          fetchSatelliteDay(
            startTime,
            endTime
          ),

          fetchSpaceWeatherDay(
            startTime,
            endTime
          )
        ])


        console.log(
          'SATELLITE ROWS:',
          satelliteRows.length
        )

        console.log(
          'SPACE WEATHER ROWS:',
          weatherRows.length
        )


        setSatelliteData(
          satelliteRows
        )

        setSpaceWeather(
          weatherRows
        )

      } catch (error) {

        console.error(
          'Dashboard load error:',
          error
        )

        setErrorMessage(
          error?.message ||
          'Unable to load dashboard data'
        )

        setSatelliteData([])
        setSpaceWeather([])

      } finally {

        setLoading(false)
      }
    }


    loadDashboard()

  }, [selectedDate])


  // ==========================================================
  // LATEST DATA
  // ==========================================================

  const latestSatellite =
    satelliteData.length > 0
      ? satelliteData[satelliteData.length - 1]
      : null


  const latestWeather =
    spaceWeather.length > 0
      ? spaceWeather[spaceWeather.length - 1]
      : null


  // ==========================================================
  // DENSITY CHART
  // ==========================================================

  const densityChartData = useMemo(() => {

    return {

      labels: satelliteData.map(
        item => formatUtcTime(item.timestamp)
      ),

      datasets: [

        {
          label: 'DNS POD',
          data: satelliteData.map(
            item => item.density_dns_kg_m3
          ),
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.15
        },

        {
          label: 'NRLMSISE-00',
          data: satelliteData.map(
            item => item.density_nrl_kg_m3
          ),
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.15
        }

      ]
    }

  }, [satelliteData])


  // ==========================================================
  // DRAG CHART
  // ==========================================================

  const dragChartData = useMemo(() => {

    return {

      labels: satelliteData.map(
        item => formatUtcTime(item.timestamp)
      ),

      datasets: [

        {
          label: 'Drag from DNS POD',
          data: satelliteData.map(
            item => item.drag_dns_n
          ),
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.15
        },

        {
          label: 'Drag from NRLMSISE-00',
          data: satelliteData.map(
            item => item.drag_nrl_n
          ),
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.15
        }

      ]
    }

  }, [satelliteData])


  // ==========================================================
  // CHART OPTIONS
  // ==========================================================

  const densityChartOptions = {

    responsive: true,

    maintainAspectRatio: false,

    interaction: {
      mode: 'index',
      intersect: false
    },

    plugins: {

      legend: {
        display: true
      },

      tooltip: {

        callbacks: {

          label(context) {

            const value =
              context.parsed.y

            return (
              `${context.dataset.label}: ` +
              `${Number(value).toExponential(4)} kg/mÂ³`
            )
          }
        }
      }
    },

    scales: {

      x: {

        title: {
          display: true,
          text: 'Time (UTC)'
        },

        ticks: {
          maxTicksLimit: 8
        }
      },

      y: {

        title: {
          display: true,
          text: 'Density (kg/mÂ³)'
        },

        ticks: {

          callback(value) {

            return Number(value)
              .toExponential(1)
          }
        }
      }
    }
  }


  const dragChartOptions = {

    responsive: true,

    maintainAspectRatio: false,

    interaction: {
      mode: 'index',
      intersect: false
    },

    plugins: {

      legend: {
        display: true
      },

      tooltip: {

        callbacks: {

          label(context) {

            const value =
              context.parsed.y

            return (
              `${context.dataset.label}: ` +
              `${Number(value).toExponential(4)} N`
            )
          }
        }
      }
    },

    scales: {

      x: {

        title: {
          display: true,
          text: 'Time (UTC)'
        },

        ticks: {
          maxTicksLimit: 8
        }
      },

      y: {

        title: {
          display: true,
          text: 'Drag Force (N)'
        },

        ticks: {

          callback(value) {

            return Number(value)
              .toExponential(1)
          }
        }
      }
    }
  }


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <>

      {/* ====================================================
          HEADER
      ==================================================== */}

      <div className="page-header">

        <div>

          <h1>Dashboard</h1>

          <p>
            Thermospheric Density and
            Satellite Drag Overview
          </p>

        </div>

      </div>


      {/* ====================================================
          FILTER
      ==================================================== */}

      <section className="filter-panel">

        <div>

          <label>Satellite</label>

          <select value={SATELLITE} disabled>
            <option value={SATELLITE}>
              Swarm-A
            </option>
          </select>

        </div>


        <div>

          <label>Atmospheric Model</label>

          <select value={MODEL} disabled>
            <option value={MODEL}>
              NRLMSISE-00
            </option>
          </select>

        </div>


        <div>

          <label>Date</label>

          <input
            type="date"
            value={selectedDate}
            onChange={
              e =>
                setSelectedDate(
                  e.target.value
                )
            }
            onKeyDown={
              e =>
                e.preventDefault()
            }
            onClick={
              e =>
                e.currentTarget
                  .showPicker?.()
            }
          />

        </div>


        <div>

          <label>Current Altitude</label>

          <input
            value={
              latestSatellite
                ? `${formatNumber(
                    latestSatellite.altitude_km,
                    3
                  )} km`
                : ''
            }
            readOnly
          />

        </div>

      </section>


      {/* ====================================================
          STATUS
      ==================================================== */}

      {loading && (

        <section className="details">
          <p>
            Loading data...
          </p>
        </section>

      )}


      {errorMessage && (

        <section className="details">

          <p>
            Error: {errorMessage}
          </p>

        </section>

      )}


      {!loading &&
       !errorMessage &&
       satelliteData.length === 0 && (

        <section className="details">

          <p>
            No satellite data available for{' '}
            {selectedDate}.
          </p>

        </section>

      )}


      {/* ====================================================
          SUMMARY CARDS
      ==================================================== */}

      <section className="cards">

        <div className="card">

          <p className="card-title">
            Altitude
          </p>

          <div className="value">

            {formatNumber(
              latestSatellite?.altitude_km,
              3
            )}

          </div>

          <span>km</span>

        </div>


        <div className="card">

          <p className="card-title">
            DNS Density
          </p>

          <div className="value">

            {formatScientific(
              latestSatellite
                ?.density_dns_kg_m3
            )}

          </div>

          <span>kg/mÂ³</span>

        </div>


        <div className="card">

          <p className="card-title">
            NRLMSISE-00 Density
          </p>

          <div className="value">

            {formatScientific(
              latestSatellite
                ?.density_nrl_kg_m3
            )}

          </div>

          <span>kg/mÂ³</span>

        </div>


        <div className="card">

          <p className="card-title">
            Atmospheric Drag
          </p>

          <div className="value">

            {formatScientific(
              latestSatellite
                ?.drag_dns_n
            )}

          </div>

          <span>DNS POD â€¢ N</span>

        </div>

      </section>


      {/* ====================================================
          GRAPHS
      ==================================================== */}

      <section className="graph-grid">


        {/* DENSITY */}

        <div className="graph-box">

          <div className="graph-header">

            <h2>
              Density vs Time
            </h2>

            <span>
              {satelliteData.length} points
            </span>

          </div>


          <div
            style={{
              height: '300px',
              marginTop: '20px'
            }}
          >

            <Line
              data={densityChartData}
              options={densityChartOptions}
            />

          </div>

        </div>


        {/* DRAG */}

        <div className="graph-box">

          <div className="graph-header">

            <h2>
              Satellite Drag vs Time
            </h2>

            <span>
              {satelliteData.length} points
            </span>

          </div>


          <div
            style={{
              height: '300px',
              marginTop: '20px'
            }}
          >

            <Line
              data={dragChartData}
              options={dragChartOptions}
            />

          </div>

        </div>

      </section>


      {/* ====================================================
          SPACE WEATHER
      ==================================================== */}

      <section className="details">

        <h2>
          Space Weather Conditions
        </h2>

        <div className="detail-grid">

          <p>
            <strong>F10.7:</strong>{' '}
            {formatNumber(
              latestWeather?.f107,
              1
            )} sfu
          </p>

          <p>
            <strong>F10.7A:</strong>{' '}
            {formatNumber(
              latestWeather?.f107a,
              1
            )} sfu
          </p>

          <p>
            <strong>Kp:</strong>{' '}
            {formatNumber(
              latestWeather?.kp,
              1
            )}
          </p>

          <p>
            <strong>Ap Daily:</strong>{' '}
            {formatNumber(
              latestWeather?.ap_daily,
              1
            )}
          </p>

          <p>
            <strong>Ap (3-hour):</strong>{' '}
            {formatNumber(
              latestWeather?.ap_3h,
              1
            )}
          </p>

          <p>
            <strong>Dst:</strong>{' '}
            {formatNumber(
              latestWeather?.dst_nt,
              0
            )} nT
          </p>

          <p>
            <strong>SYM-H:</strong>{' '}
            {formatNumber(
              latestWeather?.sym_h_nt,
              0
            )} nT
          </p>

        </div>

      </section>


      {/* ====================================================
          ORBITAL STATE
      ==================================================== */}

      <section className="details">

        <h2>
          Orbital State
        </h2>

        <div className="detail-grid">

          <p>
            <strong>Timestamp:</strong>{' '}
            {formatUtcDateTime(
              latestSatellite?.timestamp
            )}
          </p>

          <p>
            <strong>Satellite:</strong>{' '}
            {latestSatellite?.satellite ??
              'N/A'}
          </p>

          <p>
            <strong>Orbit Number:</strong>{' '}
            {latestSatellite
              ?.orbit_number ?? 'N/A'}
          </p>

          <p>
            <strong>Latitude:</strong>{' '}
            {formatNumber(
              latestSatellite
                ?.latitude_deg,
              4
            )}Â°
          </p>

          <p>
            <strong>Longitude:</strong>{' '}
            {formatNumber(
              latestSatellite
                ?.longitude_deg,
              4
            )}Â°
          </p>

          <p>
            <strong>Altitude:</strong>{' '}
            {formatNumber(
              latestSatellite
                ?.altitude_km,
              3
            )} km
          </p>

          <p>
            <strong>
              Relative Velocity:
            </strong>{' '}

            {formatNumber(
              latestSatellite
                ?.relative_velocity_km_s,
              4
            )} km/s
          </p>

          <p>
            <strong>
              Semi-Major Axis:
            </strong>{' '}

            {formatNumber(
              latestSatellite
                ?.semi_major_axis_km,
              3
            )} km
          </p>

          <p>
            <strong>
              Eccentricity:
            </strong>{' '}

            {formatNumber(
              latestSatellite
                ?.eccentricity,
              7
            )}
          </p>

          <p>
            <strong>
              Specific Orbital Energy:
            </strong>{' '}

            {formatScientific(
              latestSatellite
                ?.specific_orbital_energy_j_kg
            )} J/kg
          </p>

          <p>
            <strong>Perigee:</strong>{' '}

            {formatNumber(
              latestSatellite
                ?.perigee_altitude_km,
              3
            )} km
          </p>

          <p>
            <strong>Apogee:</strong>{' '}

            {formatNumber(
              latestSatellite
                ?.apogee_altitude_km,
              3
            )} km
          </p>

        </div>

      </section>


      {/* ====================================================
          DRAG CALCULATION
      ==================================================== */}

      <section className="details">

        <h2>
          Atmospheric Drag Calculation
        </h2>

        <div className="detail-grid">

          <p>
            <strong>
              DNS Density:
            </strong>{' '}

            {formatScientific(
              latestSatellite
                ?.density_dns_kg_m3
            )} kg/mÂ³
          </p>


          <p>
            <strong>
              NRLMSISE-00 Density:
            </strong>{' '}

            {formatScientific(
              latestSatellite
                ?.density_nrl_kg_m3
            )} kg/mÂ³
          </p>


          <p>
            <strong>
              DNS Drag:
            </strong>{' '}

            {formatScientific(
              latestSatellite
                ?.drag_dns_n
            )} N
          </p>


          <p>
            <strong>
              NRLMSISE-00 Drag:
            </strong>{' '}

            {formatScientific(
              latestSatellite
                ?.drag_nrl_n
            )} N
          </p>


          <p>
            <strong>Mass:</strong>{' '}

            {formatNumber(
              latestSatellite
                ?.mass_kg,
              3
            )} kg
          </p>


          <p>
            <strong>
              Projected Area:
            </strong>{' '}

            {formatNumber(
              latestSatellite
                ?.projected_area_m2,
              4
            )} mÂ²
          </p>


          <p>
            <strong>
              Drag Coefficient:
            </strong>{' '}

            {formatNumber(
              latestSatellite?.cd,
              2
            )}
          </p>


          <p>
            <strong>
              Relative Velocity:
            </strong>{' '}

            {formatNumber(
              latestSatellite
                ?.relative_velocity_km_s,
              4
            )} km/s
          </p>


          <p>
            <strong>
              DNS Drag Acceleration:
            </strong>{' '}

            {formatScientific(
              latestSatellite
                ?.drag_accel_dns_m_s2
            )} m/sÂ²
          </p>


          <p>
            <strong>
              NRL Drag Acceleration:
            </strong>{' '}

            {formatScientific(
              latestSatellite
                ?.drag_accel_nrl_m_s2
            )} m/sÂ²
          </p>

        </div>

      </section>

    </>
  )
}

export default Dashboard