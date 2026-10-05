import { useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
} from 'chart.js'

import { Line } from 'react-chartjs-2'


ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
)


// ============================================================
// SETTINGS
// ============================================================

const PAGE_SIZE = 1000


// ============================================================
// FORMAT FUNCTIONS
// ============================================================

function formatNumber(value, digits = 1) {

  if (
    value === null ||
    value === undefined ||
    Number.isNaN(Number(value))
  ) {
    return 'N/A'
  }

  return Number(value).toFixed(digits)
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


// ============================================================
// SPACE WEATHER
// ============================================================

function SpaceWeather() {

  // ==========================================================
  // USER INPUT
  // ==========================================================

  const [date, setDate] =
    useState('2024-05-11')

  const [startTime, setStartTime] =
    useState('00:00')

  const [endTime, setEndTime] =
    useState('06:00')


  // ==========================================================
  // DATA STATE
  // ==========================================================

  const [weatherData, setWeatherData] =
    useState([])

  const [loading, setLoading] =
    useState(false)

  const [error, setError] =
    useState(null)

  const [hasPlotted, setHasPlotted] =
    useState(false)


  // ==========================================================
  // TIME OPTIONS
  // ==========================================================

  const hours = Array.from(
    { length: 24 },
    (_, i) =>
      String(i).padStart(2, '0')
  )

  const minutes = Array.from(
    { length: 60 },
    (_, i) =>
      String(i).padStart(2, '0')
  )


  // ==========================================================
  // QUERY SUPABASE
  // ==========================================================

  const handlePlot = async () => {

    setLoading(true)
    setError(null)
    setWeatherData([])
    setHasPlotted(false)


    // --------------------------------------------------------
    // Validate time
    // --------------------------------------------------------

    if (endTime < startTime) {

      setError(
        'End Time must be later than Start Time.'
      )

      setLoading(false)

      return
    }


    // --------------------------------------------------------
    // UTC range
    // --------------------------------------------------------

    const startDateTime =
      `${date}T${startTime}:00Z`

    const endDateTime =
      `${date}T${endTime}:59.999Z`


    let allData = []
    let from = 0
    let hasMore = true


    try {

      // ======================================================
      // PAGINATION
      // ======================================================

      while (hasMore) {

        const {
          data,
          error: queryError
        } = await supabase

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

          .gte(
            'timestamp',
            startDateTime
          )

          .lte(
            'timestamp',
            endDateTime
          )

          .order(
            'timestamp',
            {
              ascending: true
            }
          )

          .range(
            from,
            from + PAGE_SIZE - 1
          )


        if (queryError) {
          throw queryError
        }


        const rows =
          data || []


        allData = [
          ...allData,
          ...rows
        ]


        if (
          rows.length <
          PAGE_SIZE
        ) {

          hasMore = false

        } else {

          from += PAGE_SIZE
        }
      }


      console.log(
        'SPACE WEATHER START:',
        startDateTime
      )

      console.log(
        'SPACE WEATHER END:',
        endDateTime
      )

      console.log(
        'SPACE WEATHER POINTS:',
        allData.length
      )

      console.log(
        'SPACE WEATHER SAMPLE:',
        allData.slice(0, 5)
      )


      setWeatherData(
        allData
      )

      setHasPlotted(true)


    } catch (queryError) {

      console.error(
        'Space Weather Query Error:',
        queryError
      )

      setError(
        queryError?.message ||
        'Unable to load space weather data.'
      )


    } finally {

      setLoading(false)
    }
  }


  // ==========================================================
  // LATEST SAMPLE
  // ==========================================================

  const latest =
    weatherData.length > 0
      ? weatherData[
          weatherData.length - 1
        ]
      : null


  // ==========================================================
  // SUMMARY
  // ==========================================================

  const summary =
    useMemo(() => {

      if (
        !weatherData ||
        weatherData.length === 0
      ) {
        return null
      }


      // ------------------------------------------------------
      // Helper
      // ------------------------------------------------------

      function validValues(column) {

        return weatherData

          .map(
            row =>
              Number(
                row[column]
              )
          )

          .filter(
            Number.isFinite
          )
      }


      function mean(values) {

        if (
          values.length === 0
        ) {
          return null
        }

        return (
          values.reduce(
            (sum, value) =>
              sum + value,
            0
          ) /
          values.length
        )
      }


      const kp =
        validValues('kp')

      const ap3h =
        validValues('ap_3h')

      const dst =
        validValues('dst_nt')

      const symh =
        validValues('sym_h_nt')

      const f107 =
        validValues('f107')

      const f107a =
        validValues('f107a')


      return {

        meanF107:
          mean(f107),

        meanF107A:
          mean(f107a),

        meanKp:
          mean(kp),

        maxKp:
          kp.length
            ? Math.max(...kp)
            : null,

        meanAp3h:
          mean(ap3h),

        maxAp3h:
          ap3h.length
            ? Math.max(...ap3h)
            : null,

        minDst:
          dst.length
            ? Math.min(...dst)
            : null,

        minSymH:
          symh.length
            ? Math.min(...symh)
            : null,

        count:
          weatherData.length
      }

    }, [weatherData])


  // ==========================================================
  // COMMON LABELS
  // ==========================================================

  const labels =
    useMemo(
      () =>
        weatherData.map(
          row =>
            formatUtcTime(
              row.timestamp
            )
        ),
      [weatherData]
    )


  // ==========================================================
  // SOLAR ACTIVITY CHART
  // ==========================================================

  const solarChartData =
    useMemo(() => {

      return {

        labels,

        datasets: [

          {
            label: 'F10.7',

            data:
              weatherData.map(
                row =>
                  row.f107
              ),

            borderWidth: 2,

            pointRadius: 0,

            pointHoverRadius: 5,

            tension: 0.15
          },


          {
            label:
              'F10.7A (81-day Average)',

            data:
              weatherData.map(
                row =>
                  row.f107a
              ),

            borderWidth: 2,

            pointRadius: 0,

            pointHoverRadius: 5,

            tension: 0.15
          }

        ]
      }

    }, [
      labels,
      weatherData
    ])


  // ==========================================================
  // KP / AP CHART
  // ==========================================================

  const geomagneticChartData =
    useMemo(() => {

      return {

        labels,

        datasets: [

          {
            label: 'Kp Index',

            data:
              weatherData.map(
                row =>
                  row.kp
              ),

            yAxisID: 'yKp',

            borderWidth: 2,

            pointRadius: 0,

            pointHoverRadius: 5,

            tension: 0.1
          },


          {
            label: 'Ap (3-hour)',

            data:
              weatherData.map(
                row =>
                  row.ap_3h
              ),

            yAxisID: 'yAp',

            borderWidth: 2,

            pointRadius: 0,

            pointHoverRadius: 5,

            tension: 0.1
          },


          {
            label: 'Ap Daily',

            data:
              weatherData.map(
                row =>
                  row.ap_daily
              ),

            yAxisID: 'yAp',

            borderWidth: 2,

            borderDash: [
              6,
              6
            ],

            pointRadius: 0,

            tension: 0
          }

        ]
      }

    }, [
      labels,
      weatherData
    ])


  // ==========================================================
  // DST / SYM-H CHART
  // ==========================================================

  const stormChartData =
    useMemo(() => {

      return {

        labels,

        datasets: [

          {
            label: 'Dst',

            data:
              weatherData.map(
                row =>
                  row.dst_nt
              ),

            borderWidth: 2,

            pointRadius: 0,

            pointHoverRadius: 5,

            tension: 0.15
          },


          {
            label: 'SYM-H',

            data:
              weatherData.map(
                row =>
                  row.sym_h_nt
              ),

            borderWidth: 2,

            pointRadius: 0,

            pointHoverRadius: 5,

            tension: 0.15
          }

        ]
      }

    }, [
      labels,
      weatherData
    ])


  // ==========================================================
  // COMMON OPTIONS
  // ==========================================================

  const commonOptions = {

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
      }
    },


    scales: {

      x: {

        title: {

          display: true,

          text: 'Time (UTC)'
        },


        ticks: {

          maxTicksLimit: 10,

          maxRotation: 0,

          autoSkip: true
        }
      }
    }
  }


  // ==========================================================
  // SOLAR OPTIONS
  // ==========================================================

  const solarChartOptions = {

    ...commonOptions,

    scales: {

      ...commonOptions.scales,


      y: {

        title: {

          display: true,

          text: 'Solar Flux (sfu)'
        }
      }
    }
  }


  // ==========================================================
  // KP / AP OPTIONS
  // ==========================================================

  const geomagneticChartOptions = {

    ...commonOptions,

    scales: {

      ...commonOptions.scales,


      yKp: {

        type: 'linear',

        position: 'left',

        min: 0,

        max: 9,

        title: {

          display: true,

          text: 'Kp Index'
        }
      },


      yAp: {

        type: 'linear',

        position: 'right',

        beginAtZero: true,

        title: {

          display: true,

          text: 'Ap Index'
        },


        grid: {

          drawOnChartArea: false
        }
      }
    }
  }


  // ==========================================================
  // DST / SYM-H OPTIONS
  // ==========================================================

  const stormChartOptions = {

    ...commonOptions,

    scales: {

      ...commonOptions.scales,


      y: {

        title: {

          display: true,

          text: 'Magnetic Disturbance (nT)'
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

          <h1>
            Space Weather
          </h1>

          <p>
            Solar and geomagnetic
            activity parameters
          </p>

        </div>

      </div>


      {/* ====================================================
          FILTER
      ==================================================== */}

      <section className="filter-panel">


        {/* DATE */}

        <div>

          <label>
            Date
          </label>

          <input
            type="date"

            value={date}

            onChange={
              e =>
                setDate(
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


        {/* START TIME */}

        <div>

          <label>
            Start Time
          </label>


          <div className="time-selector">

            <select

              value={
                startTime.split(':')[0]
              }

              onChange={
                e =>
                  setStartTime(
                    `${e.target.value}:${
                      startTime.split(':')[1]
                    }`
                  )
              }
            >

              {hours.map(
                hour => (

                  <option
                    key={hour}
                    value={hour}
                  >
                    {hour}
                  </option>

                )
              )}

            </select>


            <span>:</span>


            <select

              value={
                startTime.split(':')[1]
              }

              onChange={
                e =>
                  setStartTime(
                    `${
                      startTime.split(':')[0]
                    }:${e.target.value}`
                  )
              }
            >

              {minutes.map(
                minute => (

                  <option
                    key={minute}
                    value={minute}
                  >
                    {minute}
                  </option>

                )
              )}

            </select>

          </div>

        </div>


        {/* END TIME */}

        <div>

          <label>
            End Time
          </label>


          <div className="time-selector">

            <select

              value={
                endTime.split(':')[0]
              }

              onChange={
                e =>
                  setEndTime(
                    `${e.target.value}:${
                      endTime.split(':')[1]
                    }`
                  )
              }
            >

              {hours.map(
                hour => (

                  <option
                    key={hour}
                    value={hour}
                  >
                    {hour}
                  </option>

                )
              )}

            </select>


            <span>:</span>


            <select

              value={
                endTime.split(':')[1]
              }

              onChange={
                e =>
                  setEndTime(
                    `${
                      endTime.split(':')[0]
                    }:${e.target.value}`
                  )
              }
            >

              {minutes.map(
                minute => (

                  <option
                    key={minute}
                    value={minute}
                  >
                    {minute}
                  </option>

                )
              )}

            </select>

          </div>

        </div>


        {/* BUTTON */}

        <div>

          <label>
            &nbsp;
          </label>

          <button

            className="plot-button"

            type="button"

            onClick={
              handlePlot
            }

            disabled={
              loading
            }
          >

            {
              loading
                ? 'Loading...'
                : 'Plot Data'
            }

          </button>

        </div>

      </section>


      {/* ====================================================
          ERROR
      ==================================================== */}

      {error && (

        <section className="details">

          <p>
            Error: {error}
          </p>

        </section>

      )}


      {/* ====================================================
          CARDS
      ==================================================== */}

      <section className="cards">


        {/* F10.7 */}

        <div className="card">

          <h3>
            F10.7
          </h3>

          <div className="value">

            {
              formatNumber(
                latest?.f107,
                1
              )
            }

          </div>

          <span>
            sfu
          </span>

        </div>


        {/* F10.7A */}

        <div className="card">

          <h3>
            F10.7A
          </h3>

          <div className="value">

            {
              formatNumber(
                latest?.f107a,
                1
              )
            }

          </div>

          <span>
            sfu
          </span>

        </div>


        {/* AP */}

        <div className="card">

          <h3>
            Ap (3-hour)
          </h3>

          <div className="value">

            {
              formatNumber(
                latest?.ap_3h,
                0
              )
            }

          </div>

          <span>
            Geomagnetic Activity
          </span>

        </div>


        {/* KP */}

        <div className="card">

          <h3>
            Kp Index
          </h3>

          <div className="value">

            {
              formatNumber(
                latest?.kp,
                1
              )
            }

          </div>

          <span>
            Geomagnetic Activity
          </span>

        </div>

      </section>


      {/* ====================================================
          EXTRA CONDITIONS
      ==================================================== */}

      <section className="details">

        <h2>
          Current Conditions
        </h2>


        <div className="detail-grid">


          <p>

            <strong>
              Timestamp:
            </strong>{' '}

            {
              latest
                ? `${formatUtcTime(
                    latest.timestamp
                  )} UTC`
                : 'N/A'
            }

          </p>


          <p>

            <strong>
              F10.7:
            </strong>{' '}

            {
              formatNumber(
                latest?.f107,
                1
              )
            } sfu

          </p>


          <p>

            <strong>
              F10.7A:
            </strong>{' '}

            {
              formatNumber(
                latest?.f107a,
                1
              )
            } sfu

          </p>


          <p>

            <strong>
              Kp:
            </strong>{' '}

            {
              formatNumber(
                latest?.kp,
                1
              )
            }

          </p>


          <p>

            <strong>
              Ap Daily:
            </strong>{' '}

            {
              formatNumber(
                latest?.ap_daily,
                0
              )
            }

          </p>


          <p>

            <strong>
              Ap (3-hour):
            </strong>{' '}

            {
              formatNumber(
                latest?.ap_3h,
                0
              )
            }

          </p>


          <p>

            <strong>
              Dst:
            </strong>{' '}

            {
              formatNumber(
                latest?.dst_nt,
                0
              )
            } nT

          </p>


          <p>

            <strong>
              SYM-H:
            </strong>{' '}

            {
              formatNumber(
                latest?.sym_h_nt,
                0
              )
            } nT

          </p>

        </div>

      </section>


      {/* ====================================================
          SOLAR ACTIVITY GRAPH
      ==================================================== */}

      <section className="graph-box full-width">

        <div className="graph-header">

          <h2>
            Solar Activity
          </h2>

          <span>

            {
              hasPlotted
                ? `${weatherData.length} points`
                : 'Waiting for Data'
            }

          </span>

        </div>


        <div className="analysis-graph-placeholder">

          {hasPlotted &&
           weatherData.length > 0 ? (

            <div
              className="density-chart-container"
              style={{
                height: '340px'
              }}
            >

              <Line
                data={
                  solarChartData
                }

                options={
                  solarChartOptions
                }
              />

            </div>

          ) : (

            <div className="graph-waiting">

              <strong>
                Select date and time,
                then click Plot Data
              </strong>

              <span>
                F10.7 and F10.7A
                will appear here.
              </span>

            </div>

          )}

        </div>

      </section>


      {/* ====================================================
          GEOMAGNETIC KP / AP GRAPH
      ==================================================== */}

      <section className="graph-box full-width">

        <div className="graph-header">

          <h2>
            Geomagnetic Activity
          </h2>

          <span>
            Kp / Ap
          </span>

        </div>


        <div className="analysis-graph-placeholder">

          {hasPlotted &&
           weatherData.length > 0 ? (

            <div
              className="density-chart-container"
              style={{
                height: '340px'
              }}
            >

              <Line
                data={
                  geomagneticChartData
                }

                options={
                  geomagneticChartOptions
                }
              />

            </div>

          ) : (

            <div className="graph-waiting">

              <strong>
                Select date and time,
                then click Plot Data
              </strong>

              <span>
                Kp and Ap indices
                will appear here.
              </span>

            </div>

          )}

        </div>

      </section>


      {/* ====================================================
          DST / SYM-H GRAPH
      ==================================================== */}

      <section className="graph-box full-width">

        <div className="graph-header">

          <h2>
            Geomagnetic Storm Indices
          </h2>

          <span>
            Dst / SYM-H
          </span>

        </div>


        <div className="analysis-graph-placeholder">

          {hasPlotted &&
           weatherData.length > 0 ? (

            <div
              className="density-chart-container"
              style={{
                height: '340px'
              }}
            >

              <Line
                data={
                  stormChartData
                }

                options={
                  stormChartOptions
                }
              />

            </div>

          ) : (

            <div className="graph-waiting">

              <strong>
                Select date and time,
                then click Plot Data
              </strong>

              <span>
                Dst and SYM-H
                will appear here.
              </span>

            </div>

          )}

        </div>

      </section>


      {/* ====================================================
          SUMMARY
      ==================================================== */}

      <section className="comparison-summary">

        <div className="summary-heading">

          <div>

            <h2>
              Space Weather Summary
            </h2>

            <p>
              Summary of the selected period
            </p>

          </div>

        </div>


        <div className="summary-grid">


          <div className="summary-card">

            <span>
              Mean F10.7
            </span>

            <strong>
              {
                summary
                  ? formatNumber(
                      summary.meanF107,
                      1
                    )
                  : '—'
              }
            </strong>

            <small>
              sfu
            </small>

          </div>


          <div className="summary-card">

            <span>
              Maximum Kp
            </span>

            <strong>
              {
                summary
                  ? formatNumber(
                      summary.maxKp,
                      1
                    )
                  : '—'
              }
            </strong>

            <small>
              Kp index
            </small>

          </div>


          <div className="summary-card">

            <span>
              Maximum Ap (3-hour)
            </span>

            <strong>
              {
                summary
                  ? formatNumber(
                      summary.maxAp3h,
                      0
                    )
                  : '—'
              }
            </strong>

            <small>
              Ap index
            </small>

          </div>


          <div className="summary-card">

            <span>
              Minimum Dst
            </span>

            <strong>
              {
                summary
                  ? formatNumber(
                      summary.minDst,
                      0
                    )
                  : '—'
              }
            </strong>

            <small>
              nT
            </small>

          </div>


          <div className="summary-card">

            <span>
              Minimum SYM-H
            </span>

            <strong>
              {
                summary
                  ? formatNumber(
                      summary.minSymH,
                      0
                    )
                  : '—'
              }
            </strong>

            <small>
              nT
            </small>

          </div>


          <div className="summary-card">

            <span>
              Data Points
            </span>

            <strong>
              {
                summary
                  ? summary.count
                  : '—'
              }
            </strong>

            <small>
              samples
            </small>

          </div>

        </div>

      </section>


      {/* ====================================================
          PARAMETER INFORMATION
      ==================================================== */}

      <section className="analysis-card">

        <h2>
          Parameter Information
        </h2>


        <div className="parameter-row">

          <span>
            F10.7
          </span>

          <strong>
            Solar radio flux at 10.7 cm
          </strong>

        </div>


        <div className="parameter-row">

          <span>
            F10.7A
          </span>

          <strong>
            81-day centered average
            of F10.7 solar flux
          </strong>

        </div>


        <div className="parameter-row">

          <span>
            Kp
          </span>

          <strong>
            3-hour planetary
            geomagnetic activity index
          </strong>

        </div>


        <div className="parameter-row">

          <span>
            Ap (3-hour)
          </span>

          <strong>
            Linear 3-hour geomagnetic
            activity index derived from Kp
          </strong>

        </div>


        <div className="parameter-row">

          <span>
            Ap Daily
          </span>

          <strong>
            Daily planetary
            geomagnetic activity index
          </strong>

        </div>


        <div className="parameter-row">

          <span>
            Dst
          </span>

          <strong>
            Disturbance Storm Time index
          </strong>

        </div>


        <div className="parameter-row">

          <span>
            SYM-H
          </span>

          <strong>
            High-time-resolution
            geomagnetic disturbance index
          </strong>

        </div>

      </section>

    </>
  )
}


export default SpaceWeather