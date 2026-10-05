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


// ============================================================
// REGISTER CHART.JS
// ============================================================

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
// DASHBOARD
// ============================================================

function Dashboard({
  result,
  densitySeries = [],
  selectedDate,
  setSelectedDate
}) {

  console.log('DASHBOARD RESULT:', result)
  console.log('DASHBOARD SERIES:', densitySeries)


  // ==========================================================
  // FORMAT FUNCTIONS
  // ==========================================================

  const scientific = (value, digits = 3) => {

    if (
      value === null ||
      value === undefined ||
      value === '' ||
      Number.isNaN(Number(value))
    ) {
      return 'N/A'
    }

    return Number(value).toExponential(digits)
  }


  const fixed = (value, digits = 3) => {

    if (
      value === null ||
      value === undefined ||
      value === '' ||
      Number.isNaN(Number(value))
    ) {
      return 'N/A'
    }

    return Number(value).toFixed(digits)
  }


  const formatTime = (timestamp) => {

    if (!timestamp) {
      return ''
    }

    const date = new Date(timestamp)

    if (Number.isNaN(date.getTime())) {
      return ''
    }

    return date.toLocaleTimeString(
      'en-GB',
      {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'UTC'
      }
    )
  }


  const formatTimestamp = (timestamp) => {

    if (!timestamp) {
      return 'N/A'
    }

    const date = new Date(timestamp)

    if (Number.isNaN(date.getTime())) {
      return timestamp
    }

    return date.toLocaleString(
      'en-GB',
      {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }
    ) + ' UTC'
  }


  // ==========================================================
  // CURRENT / SUMMARY VALUES
  // ==========================================================

  const altitude =
    result?.altitude_km


  // DNS POD density
  const densityDNS =
    result?.density_dns_kg_m3 ??
    result?.dns_density_kg_m3 ??
    result?.density_kg_m3


  // NRLMSISE-00 density
  const densityNRL =
    result?.density_nrl_kg_m3 ??
    result?.nrlmsise_density_kg_m3 ??
    result?.nrlmsise00_density_kg_m3


  // Drag calculated from DNS density
  const dragDNS =
    result?.drag_dns_n


  // Drag calculated from NRLMSISE density
  const dragNRL =
    result?.drag_nrl_n ??
    result?.drag_force_n


  // Latitude / Longitude
  const latitude =
    result?.latitude_deg ??
    result?.latitude


  const longitude =
    result?.longitude_deg ??
    result?.longitude


  // ==========================================================
  // CHART LABELS
  // ==========================================================

  const chartLabels = densitySeries.map(
    (item) => formatTime(item.timestamp)
  )


  // ==========================================================
  // DENSITY CHART
  // ==========================================================

  const densityChartData = {

    labels: chartLabels,

    datasets: [

      {
        label: 'Swarm DNS POD',

        data: densitySeries.map(
          (item) =>
            item.density_dns_kg_m3 ??
            item.dns_density_kg_m3 ??
            item.density_kg_m3 ??
            null
        ),

        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.2,
        spanGaps: true
      },

      {
        label: 'NRLMSISE-00',

        data: densitySeries.map(
          (item) =>
            item.density_nrl_kg_m3 ??
            item.nrlmsise_density_kg_m3 ??
            item.nrlmsise00_density_kg_m3 ??
            null
        ),

        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.2,
        spanGaps: true
      }

    ]
  }


  const densityChartOptions = {

    responsive: true,

    maintainAspectRatio: false,

    interaction: {
      mode: 'index',
      intersect: false
    },

    plugins: {

      legend: {
        display: true,
        position: 'top'
      },

      title: {
        display: false
      },

      tooltip: {

        callbacks: {

          label: (context) => {

            const value = context.parsed.y

            if (
              value === null ||
              value === undefined
            ) {
              return `${context.dataset.label}: N/A`
            }

            return (
              `${context.dataset.label}: ` +
              `${Number(value).toExponential(3)} kg/m³`
            )
          }
        }
      }
    },

    scales: {

      x: {

        title: {
          display: true,
          text: 'UTC Time'
        },

        ticks: {
          maxTicksLimit: 12
        }
      },

      y: {

        title: {
          display: true,
          text: 'Density (kg/m³)'
        },

        ticks: {

          callback: (value) => {

            if (value === 0) {
              return '0'
            }

            return Number(value).toExponential(1)
          }
        }
      }
    }
  }


  // ==========================================================
  // DRAG CHART
  // ==========================================================

  const dragChartData = {

    labels: chartLabels,

    datasets: [

      {
        label: 'Drag from DNS POD',

        data: densitySeries.map(
          (item) =>
            item.drag_dns_n ??
            null
        ),

        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.2,
        spanGaps: true
      },

      {
        label: 'Drag from NRLMSISE-00',

        data: densitySeries.map(
          (item) =>
            item.drag_nrl_n ??
            item.drag_force_n ??
            null
        ),

        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.2,
        spanGaps: true
      }

    ]
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
        display: true,
        position: 'top'
      },

      title: {
        display: false
      },

      tooltip: {

        callbacks: {

          label: (context) => {

            const value = context.parsed.y

            if (
              value === null ||
              value === undefined
            ) {
              return `${context.dataset.label}: N/A`
            }

            return (
              `${context.dataset.label}: ` +
              `${Number(value).toExponential(3)} N`
            )
          }
        }
      }
    },

    scales: {

      x: {

        title: {
          display: true,
          text: 'UTC Time'
        },

        ticks: {
          maxTicksLimit: 12
        }
      },

      y: {

        title: {
          display: true,
          text: 'Drag Force (N)'
        },

        ticks: {

          callback: (value) => {

            if (value === 0) {
              return '0'
            }

            return Number(value).toExponential(1)
          }
        }
      }
    }
  }


  // ==========================================================
  // CHECK IF DRAG DATA EXISTS
  // ==========================================================

  const hasDragData = densitySeries.some(
    (item) =>
      item.drag_dns_n !== undefined ||
      item.drag_nrl_n !== undefined ||
      item.drag_force_n !== undefined
  )


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <>

      {/* =====================================================
          PAGE HEADER
      ===================================================== */}

      <div className="page-header">

        <div>

          <h1>
            Satellite Drag Dashboard
          </h1>

          <p>
            Thermospheric Density, Atmospheric Drag
            and Orbital Environment
          </p>

        </div>

      </div>


      {/* =====================================================
          FILTER PANEL
      ===================================================== */}

      <section className="filter-panel">


        {/* SATELLITE */}

        <div>

          <label>
            Satellite
          </label>

          <select>

            <option value="Swarm-A">
              Swarm-A
            </option>

          </select>

        </div>


        {/* MODEL */}

        <div>

          <label>
            Atmospheric Model
          </label>

          <select>

            <option value="NRLMSISE-00">
              NRLMSISE-00
            </option>

          </select>

        </div>


        {/* DATE */}

        <div>

          <label>
            Date
          </label>

          <input
            type="date"

            value={
              selectedDate || ''
            }

            onChange={
              (e) =>
                setSelectedDate?.(
                  e.target.value
                )
            }

            onKeyDown={
              (e) =>
                e.preventDefault()
            }

            onClick={
              (e) =>
                e.currentTarget.showPicker?.()
            }
          />

        </div>


        {/* ALTITUDE */}

        <div>

          <label>
            Current Altitude
          </label>

          <input
            value={
              altitude !== undefined &&
              altitude !== null
                ? `${fixed(altitude, 2)} km`
                : 'N/A'
            }

            readOnly
          />

        </div>


      </section>


      {/* =====================================================
          MAIN SUMMARY CARDS
      ===================================================== */}

      <section className="cards">


        {/* ALTITUDE */}

        <div className="card">

          <p className="card-title">
            Altitude
          </p>

          <div className="value">

            {fixed(
              altitude,
              2
            )}

          </div>

          <span>
            km
          </span>

        </div>


        {/* DNS DENSITY */}

        <div className="card">

          <p className="card-title">
            DNS Density
          </p>

          <div className="value">

            {scientific(
              densityDNS
            )}

          </div>

          <span>
            kg/m³
          </span>

        </div>


        {/* NRL DENSITY */}

        <div className="card">

          <p className="card-title">
            NRLMSISE-00 Density
          </p>

          <div className="value">

            {scientific(
              densityNRL
            )}

          </div>

          <span>
            kg/m³
          </span>

        </div>


        {/* DRAG */}

        <div className="card">

          <p className="card-title">
            Atmospheric Drag
          </p>

          <div className="value">

            {scientific(
              dragNRL
            )}

          </div>

          <span>
            N
          </span>

        </div>


      </section>


      {/* =====================================================
          DENSITY + DRAG GRAPHS
      ===================================================== */}

      <section className="graph-grid">


        {/* ===================================================
            DENSITY GRAPH
        =================================================== */}

        <div className="graph-box">

          <div className="graph-header">

            <div>

              <h2>
                Density vs Time
              </h2>

              <p>
                DNS POD vs NRLMSISE-00
              </p>

            </div>


            <span>

              {densitySeries.length}
              {' '}
              points

            </span>

          </div>


          <div
            style={{
              height: '300px',
              marginTop: '20px'
            }}
          >

            {
              densitySeries.length > 0
                ? (

                  <Line
                    data={
                      densityChartData
                    }

                    options={
                      densityChartOptions
                    }
                  />

                )
                : (

                  <div className="graph-placeholder">

                    No density data available

                  </div>

                )
            }

          </div>

        </div>


        {/* ===================================================
            DRAG GRAPH
        =================================================== */}

        <div className="graph-box">

          <div className="graph-header">

            <div>

              <h2>
                Satellite Drag vs Time
              </h2>

              <p>
                DNS POD vs NRLMSISE-00
              </p>

            </div>


            <span>

              {
                hasDragData
                  ? `${densitySeries.length} points`
                  : 'Waiting for Drag Data'
              }

            </span>

          </div>


          <div
            style={{
              height: '300px',
              marginTop: '20px'
            }}
          >

            {
              hasDragData
                ? (

                  <Line
                    data={
                      dragChartData
                    }

                    options={
                      dragChartOptions
                    }
                  />

                )
                : (

                  <div className="graph-placeholder">

                    Drag data will be displayed
                    after backend calculation

                  </div>

                )
            }

          </div>

        </div>


      </section>


      {/* =====================================================
          SPACE WEATHER
      ===================================================== */}

      <section className="details">

        <h2>
          Space Weather Conditions
        </h2>


        <div className="detail-grid">


          {/* F10.7 */}

          <p>

            <strong>
              F10.7:
            </strong>
            {' '}

            {
              result?.f107 !== undefined
                ? `${fixed(result.f107, 1)} sfu`
                : result?.f107_observed !== undefined
                  ? `${fixed(result.f107_observed, 1)} sfu`
                  : 'N/A'
            }

          </p>


          {/* F10.7A */}

          <p>

            <strong>
              F10.7A:
            </strong>
            {' '}

            {
              result?.f107a !== undefined
                ? `${fixed(result.f107a, 1)} sfu`
                : 'N/A'
            }

          </p>


          {/* KP */}

          <p>

            <strong>
              Kp:
            </strong>
            {' '}

            {fixed(
              result?.kp,
              1
            )}

          </p>


          {/* AP */}

          <p>

            <strong>
              Ap:
            </strong>
            {' '}

            {fixed(
              result?.ap,
              1
            )}

          </p>


          {/* AP 3H */}

          <p>

            <strong>
              Ap (3-hour):
            </strong>
            {' '}

            {fixed(
              result?.ap_3h,
              1
            )}

          </p>


          {/* DST */}

          <p>

            <strong>
              Dst:
            </strong>
            {' '}

            {
              result?.dst !== undefined
                ? `${fixed(result.dst, 0)} nT`
                : 'N/A'
            }

          </p>


          {/* SYM-H */}

          <p>

            <strong>
              SYM-H:
            </strong>
            {' '}

            {
              result?.sym_h !== undefined
                ? `${fixed(result.sym_h, 0)} nT`
                : 'N/A'
            }

          </p>


        </div>

      </section>


      {/* =====================================================
          ORBITAL STATE
      ===================================================== */}

      <section className="details">

        <h2>
          Orbital State
        </h2>


        <div className="detail-grid">


          {/* SATELLITE */}

          <p>

            <strong>
              Satellite:
            </strong>
            {' '}

            {result?.satellite || 'Swarm-A'}

          </p>


          {/* ORBIT TYPE */}

          <p>

            <strong>
              Orbit Type:
            </strong>
            {' '}

            Low Earth Orbit (LEO)

          </p>


          {/* ORBIT NUMBER */}

          <p>

            <strong>
              Orbit Number:
            </strong>
            {' '}

            {result?.orbit_number ?? 'N/A'}

          </p>


          {/* ALTITUDE */}

          <p>

            <strong>
              Altitude:
            </strong>
            {' '}

            {
              altitude !== undefined
                ? `${fixed(altitude, 3)} km`
                : 'N/A'
            }

          </p>


          {/* LATITUDE */}

          <p>

            <strong>
              Latitude:
            </strong>
            {' '}

            {
              latitude !== undefined
                ? `${fixed(latitude, 3)}°`
                : 'N/A'
            }

          </p>


          {/* LONGITUDE */}

          <p>

            <strong>
              Longitude:
            </strong>
            {' '}

            {
              longitude !== undefined
                ? `${fixed(longitude, 3)}°`
                : 'N/A'
            }

          </p>


          {/* VELOCITY */}

          <p>

            <strong>
              Relative Velocity:
            </strong>
            {' '}

            {
              result?.relative_velocity_km_s !== undefined
                ? `${fixed(
                    result.relative_velocity_km_s,
                    3
                  )} km/s`
                : 'N/A'
            }

          </p>


          {/* SMA */}

          <p>

            <strong>
              Semi-Major Axis:
            </strong>
            {' '}

            {
              result?.semi_major_axis_km !== undefined
                ? `${fixed(
                    result.semi_major_axis_km,
                    3
                  )} km`
                : 'N/A'
            }

          </p>


          {/* ECCENTRICITY */}

          <p>

            <strong>
              Eccentricity:
            </strong>
            {' '}

            {
              result?.eccentricity !== undefined
                ? fixed(
                    result.eccentricity,
                    7
                  )
                : 'N/A'
            }

          </p>


          {/* ENERGY */}

          <p>

            <strong>
              Specific Orbital Energy:
            </strong>
            {' '}

            {
              result?.specific_orbital_energy_j_kg !== undefined
                ? `${scientific(
                    result.specific_orbital_energy_j_kg
                  )} J/kg`
                : 'N/A'
            }

          </p>


          {/* PERIGEE */}

          <p>

            <strong>
              Perigee:
            </strong>
            {' '}

            {
              result?.perigee_altitude_km !== undefined
                ? `${fixed(
                    result.perigee_altitude_km,
                    3
                  )} km`
                : 'N/A'
            }

          </p>


          {/* APOGEE */}

          <p>

            <strong>
              Apogee:
            </strong>
            {' '}

            {
              result?.apogee_altitude_km !== undefined
                ? `${fixed(
                    result.apogee_altitude_km,
                    3
                  )} km`
                : 'N/A'
            }

          </p>


        </div>

      </section>


      {/* =====================================================
          ATMOSPHERIC DRAG CALCULATION
      ===================================================== */}

      <section className="details">

        <h2>
          Atmospheric Drag Calculation
        </h2>


        <div className="detail-grid">


          {/* TIMESTAMP */}

          <p>

            <strong>
              Timestamp:
            </strong>
            {' '}

            {formatTimestamp(
              result?.timestamp
            )}

          </p>


          {/* MODEL */}

          <p>

            <strong>
              Atmospheric Model:
            </strong>
            {' '}

            NRLMSISE-00

          </p>


          {/* DNS DENSITY */}

          <p>

            <strong>
              DNS Density:
            </strong>
            {' '}

            {
              densityDNS !== undefined
                ? `${scientific(
                    densityDNS
                  )} kg/m³`
                : 'N/A'
            }

          </p>


          {/* NRL DENSITY */}

          <p>

            <strong>
              NRLMSISE-00 Density:
            </strong>
            {' '}

            {
              densityNRL !== undefined
                ? `${scientific(
                    densityNRL
                  )} kg/m³`
                : 'N/A'
            }

          </p>


          {/* DNS DRAG */}

          <p>

            <strong>
              DNS Drag:
            </strong>
            {' '}

            {
              dragDNS !== undefined
                ? `${scientific(
                    dragDNS
                  )} N`
                : 'N/A'
            }

          </p>


          {/* NRL DRAG */}

          <p>

            <strong>
              NRLMSISE Drag:
            </strong>
            {' '}

            {
              dragNRL !== undefined
                ? `${scientific(
                    dragNRL
                  )} N`
                : 'N/A'
            }

          </p>


          {/* MASS */}

          <p>

            <strong>
              Satellite Mass:
            </strong>
            {' '}

            {
              result?.mass_kg !== undefined
                ? `${fixed(
                    result.mass_kg,
                    3
                  )} kg`
                : 'N/A'
            }

          </p>


          {/* AREA */}

          <p>

            <strong>
              Projected Area:
            </strong>
            {' '}

            {
              result?.area_projected_m2 !== undefined
                ? `${fixed(
                    result.area_projected_m2,
                    3
                  )} m²`
                : 'N/A'
            }

          </p>


          {/* CD */}

          <p>

            <strong>
              Drag Coefficient:
            </strong>
            {' '}

            {fixed(
              result?.cd,
              2
            )}

          </p>


          {/* RELATIVE VELOCITY */}

          <p>

            <strong>
              Relative Velocity:
            </strong>
            {' '}

            {
              result?.relative_velocity_km_s !== undefined
                ? `${fixed(
                    result.relative_velocity_km_s,
                    3
                  )} km/s`
                : 'N/A'
            }

          </p>


          {/* DRAG ACCELERATION DNS */}

          <p>

            <strong>
              DNS Drag Acceleration:
            </strong>
            {' '}

            {
              result?.drag_acceleration_dns_m_s2 !== undefined
                ? `${scientific(
                    result.drag_acceleration_dns_m_s2
                  )} m/s²`
                : 'N/A'
            }

          </p>


          {/* DRAG ACCELERATION NRL */}

          <p>

            <strong>
              NRL Drag Acceleration:
            </strong>
            {' '}

            {
              result?.drag_acceleration_nrl_m_s2 !== undefined
                ? `${scientific(
                    result.drag_acceleration_nrl_m_s2
                  )} m/s²`
                : 'N/A'
            }

          </p>


        </div>

      </section>


    </>

  )
}


export default Dashboard