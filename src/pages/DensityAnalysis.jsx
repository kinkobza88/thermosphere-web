import { useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'

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

function formatScientific(value, digits = 3) {

  if (
    value === null ||
    value === undefined ||
    Number.isNaN(Number(value))
  ) {
    return 'N/A'
  }

  return Number(value).toExponential(digits)
}


function formatNumber(value, digits = 2) {

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
// DENSITY ANALYSIS
// ============================================================

function DensityAnalysis() {

  // ==========================================================
  // USER INPUT
  // ==========================================================

  const [satellite] = useState(SATELLITE)

  // ใช้วันที่ช่วง May 2024 storm เป็นค่าเริ่มต้น
  const [date, setDate] =
    useState('2024-05-11')

  const [startTime, setStartTime] =
    useState('00:00')

  const [endTime, setEndTime] =
    useState('06:00')

  const [model] =
    useState(MODEL)


  // ==========================================================
  // DATA STATE
  // ==========================================================

  const [hasPlotted, setHasPlotted] =
    useState(false)

  const [plotData, setPlotData] =
    useState([])

  const [plotLoading, setPlotLoading] =
    useState(false)

  const [plotError, setPlotError] =
    useState(null)


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

    setPlotLoading(true)
    setPlotError(null)
    setPlotData([])
    setHasPlotted(false)


    // --------------------------------------------------------
    // Validate time
    // --------------------------------------------------------

    if (endTime < startTime) {

      setPlotError(
        'End Time must be later than Start Time.'
      )

      setPlotLoading(false)

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
      //
      // ช่วงเวลายาว ๆ อาจเกิน 1,000 records
      // ======================================================

      while (hasMore) {

        const {
          data,
          error
        } = await supabase

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
            eccentricity
          `)

          .eq(
            'satellite',
            satellite
          )

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


        if (error) {
          throw error
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
        'START:',
        startDateTime
      )

      console.log(
        'END:',
        endDateTime
      )

      console.log(
        'PLOT POINTS:',
        allData.length
      )

      console.log(
        'PLOT SAMPLE:',
        allData.slice(0, 5)
      )


      setPlotData(
        allData
      )

      setHasPlotted(true)


    } catch (error) {

      console.error(
        'Density Analysis Query Error:',
        error
      )

      setPlotError(
        error?.message ||
        'Unable to load data.'
      )


    } finally {

      setPlotLoading(false)
    }
  }


  // ==========================================================
  // CALCULATE SUMMARY
  // ==========================================================

  const summary = useMemo(() => {

    if (
      !plotData ||
      plotData.length === 0
    ) {

      return null
    }


    // --------------------------------------------------------
    // Valid density rows
    // --------------------------------------------------------

    const valid = plotData.filter(
      item =>
        item.density_dns_kg_m3 !== null &&
        item.density_nrl_kg_m3 !== null &&
        Number.isFinite(
          Number(
            item.density_dns_kg_m3
          )
        ) &&
        Number.isFinite(
          Number(
            item.density_nrl_kg_m3
          )
        )
    )


    if (valid.length === 0) {
      return null
    }


    // --------------------------------------------------------
    // DNS mean
    // --------------------------------------------------------

    const dnsMean =
      valid.reduce(
        (sum, item) =>
          sum +
          Number(
            item.density_dns_kg_m3
          ),
        0
      ) / valid.length


    // --------------------------------------------------------
    // NRL mean
    // --------------------------------------------------------

    const nrlMean =
      valid.reduce(
        (sum, item) =>
          sum +
          Number(
            item.density_nrl_kg_m3
          ),
        0
      ) / valid.length


    // --------------------------------------------------------
    // Mean difference
    //
    // Positive:
    // NRL > DNS
    //
    // Negative:
    // NRL < DNS
    // --------------------------------------------------------

    const modelDifferencePercent =
      dnsMean !== 0
        ? (
            (
              nrlMean -
              dnsMean
            ) /
            dnsMean
          ) * 100
        : null


    // --------------------------------------------------------
    // Peak DNS density
    // --------------------------------------------------------

    const peakDns =
      valid.reduce(
        (maxRow, row) =>

          Number(
            row.density_dns_kg_m3
          ) >
          Number(
            maxRow.density_dns_kg_m3
          )

            ? row
            : maxRow,

        valid[0]
      )


    // --------------------------------------------------------
    // Peak NRL density
    // --------------------------------------------------------

    const peakNrl =
      valid.reduce(
        (maxRow, row) =>

          Number(
            row.density_nrl_kg_m3
          ) >
          Number(
            maxRow.density_nrl_kg_m3
          )

            ? row
            : maxRow,

        valid[0]
      )


    return {

      dnsMean,
      nrlMean,

      modelDifferencePercent,

      peakDns:
        Number(
          peakDns.density_dns_kg_m3
        ),

      peakDnsTime:
        peakDns.timestamp,

      peakNrl:
        Number(
          peakNrl.density_nrl_kg_m3
        ),

      peakNrlTime:
        peakNrl.timestamp,

      count:
        valid.length
    }

  }, [plotData])


  // ==========================================================
  // DENSITY CHART
  // ==========================================================

  const densityChartData =
    useMemo(() => {

      const dnsMean =
        summary?.dnsMean ?? null


      return {

        labels: plotData.map(
          item =>
            formatUtcTime(
              item.timestamp
            )
        ),


        datasets: [

          // --------------------------------------------------
          // DNS POD
          // --------------------------------------------------

          {
            label:
              'Swarm-A DNS POD',

            data:
              plotData.map(
                item =>
                  item.density_dns_kg_m3
              ),

            borderWidth: 2,

            pointRadius:
              plotData.length > 300
                ? 0
                : 2,

            pointHoverRadius: 5,

            tension: 0.15
          },


          // --------------------------------------------------
          // DNS mean
          // --------------------------------------------------

          {
            label:
              'Swarm-A Average',

            data:
              plotData.map(
                () => dnsMean
              ),

            borderWidth: 2,

            borderDash: [
              6,
              6
            ],

            pointRadius: 0,

            tension: 0
          },


          // --------------------------------------------------
          // NRLMSISE-00
          // --------------------------------------------------

          {
            label:
              'NRLMSISE-00 Model',

            data:
              plotData.map(
                item =>
                  item.density_nrl_kg_m3
              ),

            borderWidth: 2,

            pointRadius:
              plotData.length > 300
                ? 0
                : 2,

            pointHoverRadius: 5,

            tension: 0.15
          }

        ]
      }

    }, [
      plotData,
      summary
    ])


  // ==========================================================
  // DRAG CHART
  // ==========================================================

  const dragChartData =
    useMemo(() => {

      if (
        !plotData ||
        plotData.length === 0
      ) {

        return {
          labels: [],
          datasets: []
        }
      }


      const validDnsDrag =
        plotData
          .map(
            item =>
              Number(
                item.drag_dns_n
              )
          )
          .filter(
            Number.isFinite
          )


      const meanDnsDrag =
        validDnsDrag.length > 0
          ? validDnsDrag.reduce(
              (sum, value) =>
                sum + value,
              0
            ) /
            validDnsDrag.length
          : null


      return {

        labels: plotData.map(
          item =>
            formatUtcTime(
              item.timestamp
            )
        ),


        datasets: [

          {
            label:
              'Drag from DNS POD',

            data:
              plotData.map(
                item =>
                  item.drag_dns_n
              ),

            borderWidth: 2,

            pointRadius:
              plotData.length > 300
                ? 0
                : 2,

            pointHoverRadius: 5,

            tension: 0.15
          },


          {
            label:
              'Average DNS Drag',

            data:
              plotData.map(
                () => meanDnsDrag
              ),

            borderWidth: 2,

            borderDash: [
              6,
              6
            ],

            pointRadius: 0,

            tension: 0
          },


          {
            label:
              'Drag from NRLMSISE-00',

            data:
              plotData.map(
                item =>
                  item.drag_nrl_n
              ),

            borderWidth: 2,

            pointRadius:
              plotData.length > 300
                ? 0
                : 2,

            pointHoverRadius: 5,

            tension: 0.15
          }

        ]
      }

    }, [plotData])


  // ==========================================================
  // DENSITY CHART OPTIONS
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


            if (
              value === null ||
              value === undefined
            ) {

              return (
                `${context.dataset.label}: N/A`
              )
            }


            return (
              `${context.dataset.label}: ` +
              `${Number(value).toExponential(4)} kg/m³`
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
          maxTicksLimit: 10
        }
      },


      y: {

        title: {
          display: true,
          text: 'Density (kg/m³)'
        },

        ticks: {

          callback(value) {

            return Number(
              value
            ).toExponential(1)
          }
        }
      }
    }
  }


  // ==========================================================
  // DRAG OPTIONS
  // ==========================================================

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


            if (
              value === null ||
              value === undefined
            ) {

              return (
                `${context.dataset.label}: N/A`
              )
            }


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
          maxTicksLimit: 10
        }
      },


      y: {

        title: {
          display: true,
          text: 'Drag Force (N)'
        },

        ticks: {

          callback(value) {

            return Number(
              value
            ).toExponential(1)
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
          PAGE HEADER
      ==================================================== */}

      <div className="page-header analysis-page-header">

        <div>

          <h1>
            Thermosphere Analysis
          </h1>

          <p>
            Compare Swarm satellite observations
            with atmospheric models
          </p>

        </div>

      </div>


      {/* ====================================================
          ANALYSIS PARAMETERS
      ==================================================== */}

      <section className="analysis-control-panel">

        <div className="analysis-control-title">

          <div>

            <h2>
              Analysis Parameters
            </h2>

            <p>
              Select satellite and time period
              for density analysis
            </p>

          </div>


          <span className="prototype-badge">
            Analysis Workspace
          </span>

        </div>


        <div className="analysis-filter-grid">


          {/* SATELLITE */}

          <div className="analysis-field">

            <label>
              Satellite
            </label>

            <select
              value={satellite}
              disabled
            >

              <option value="Swarm-A">
                Swarm-A
              </option>

            </select>

          </div>


          {/* DATE */}

          <div className="analysis-field">

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

          <div className="analysis-field">

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

          <div className="analysis-field">

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


          {/* MODEL */}

          <div className="analysis-field">

            <label>
              Model
            </label>

            <select
              value={model}
              disabled
            >

              <option value="NRLMSISE-00">
                NRLMSISE-00
              </option>

            </select>

          </div>


          {/* PLOT BUTTON */}

          <button

            className="plot-button"

            type="button"

            onClick={
              handlePlot
            }

            disabled={
              plotLoading
            }
          >

            {
              plotLoading
                ? 'Loading...'
                : 'Plot Data'
            }

          </button>

        </div>

      </section>


      {/* ====================================================
          ERROR
      ==================================================== */}

      {plotError && (

        <section className="details">

          <p>
            Error: {plotError}
          </p>

        </section>

      )}


      {/* ====================================================
          SELECTED ANALYSIS
      ==================================================== */}

      <section className="analysis-selection-bar">

        <div>

          <span>
            Satellite
          </span>

          <strong>
            {satellite}
          </strong>

        </div>


        <div>

          <span>
            Date
          </span>

          <strong>
            {date}
          </strong>

        </div>


        <div>

          <span>
            Time Range
          </span>

          <strong>
            {startTime} – {endTime} UTC
          </strong>

        </div>


        <div>

          <span>
            Model
          </span>

          <strong>
            {model}
          </strong>

        </div>


        {hasPlotted && (

          <div>

            <span>
              Data Points
            </span>

            <strong>
              {plotData.length}
            </strong>

          </div>

        )}

      </section>


      {/* ====================================================
          DENSITY GRAPH
      ==================================================== */}

      <section className="analysis-graph-card">

        <div className="analysis-graph-heading">

          <div>

            <p className="graph-category">
              ATMOSPHERIC ANALYSIS
            </p>

            <h2>
              Thermospheric Density
            </h2>

            <p>
              Swarm-A DNS POD observation
              compared with NRLMSISE-00
            </p>

          </div>


          <span className="graph-unit">
            kg/m³
          </span>

        </div>


        <div className="analysis-graph-placeholder">

          {hasPlotted &&
           plotData.length > 0 ? (

            <div
              className="density-chart-container"
              style={{
                height: '360px'
              }}
            >

              <Line
                data={
                  densityChartData
                }

                options={
                  densityChartOptions
                }
              />

            </div>

          ) : (

            <div className="graph-waiting">

              <strong>

                {hasPlotted
                  ? 'No data found for the selected period'
                  : 'Select parameters and click Plot Data'
                }

              </strong>

              <span>
                Thermospheric density
                comparison will appear here.
              </span>

            </div>

          )}

        </div>

      </section>


      {/* ====================================================
          DRAG GRAPH
      ==================================================== */}

      <section className="analysis-graph-card">

        <div className="analysis-graph-heading">

          <div>

            <p className="graph-category">
              SATELLITE RESPONSE
            </p>

            <h2>
              Satellite Drag
            </h2>

            <p>
              Drag calculated using DNS POD
              and NRLMSISE-00 densities
            </p>

          </div>


          <span className="graph-unit">
            N
          </span>

        </div>


        <div className="analysis-graph-placeholder">

          {hasPlotted &&
           plotData.length > 0 ? (

            <div
              className="density-chart-container"
              style={{
                height: '360px'
              }}
            >

              <Line
                data={
                  dragChartData
                }

                options={
                  dragChartOptions
                }
              />

            </div>

          ) : (

            <div className="graph-waiting">

              <strong>

                {hasPlotted
                  ? 'No data found for the selected period'
                  : 'Select parameters and click Plot Data'
                }

              </strong>

              <span>
                Satellite drag comparison
                will appear here.
              </span>

            </div>

          )}

        </div>

      </section>


      {/* ====================================================
          COMPARISON SUMMARY
      ==================================================== */}

      <section className="comparison-summary">

        <div className="summary-heading">

          <div>

            <h2>
              Comparison Summary
            </h2>

            <p>
              Summary of the selected
              analysis period
            </p>

          </div>

        </div>


        <div className="summary-grid">


          {/* DNS MEAN */}

          <div className="summary-card">

            <span>
              Mean DNS Density
            </span>

            <strong>
              {
                summary
                  ? formatScientific(
                      summary.dnsMean
                    )
                  : '—'
              }
            </strong>

            <small>
              kg/m³
            </small>

          </div>


          {/* NRL MEAN */}

          <div className="summary-card">

            <span>
              Mean NRL Density
            </span>

            <strong>
              {
                summary
                  ? formatScientific(
                      summary.nrlMean
                    )
                  : '—'
              }
            </strong>

            <small>
              kg/m³
            </small>

          </div>


          {/* DIFFERENCE */}

          <div className="summary-card">

            <span>
              Model Difference
            </span>

            <strong>

              {
                summary &&
                summary.modelDifferencePercent !== null

                  ? `${formatNumber(
                      summary.modelDifferencePercent,
                      2
                    )}%`

                  : '—'
              }

            </strong>

            <small>
              (NRL − DNS) / DNS
            </small>

          </div>


          {/* PEAK DNS */}

          <div className="summary-card">

            <span>
              Peak DNS Density
            </span>

            <strong>
              {
                summary
                  ? formatScientific(
                      summary.peakDns
                    )
                  : '—'
              }
            </strong>

            <small>
              kg/m³
            </small>

          </div>


          {/* PEAK TIME */}

          <div className="summary-card">

            <span>
              DNS Peak Time
            </span>

            <strong>
              {
                summary
                  ? formatUtcTime(
                      summary.peakDnsTime
                    )
                  : '—'
              }
            </strong>

            <small>
              UTC
            </small>

          </div>


          {/* POINT COUNT */}

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

    </>
  )
}


export default DensityAnalysis