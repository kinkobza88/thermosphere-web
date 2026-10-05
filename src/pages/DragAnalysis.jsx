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

const SATELLITE = 'Swarm-A'
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


function formatNumber(value, digits = 3) {

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
// DRAG ANALYSIS
// ============================================================

function DragAnalysis() {

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

  const [dragData, setDragData] =
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
  // QUERY DATA
  // ==========================================================

  const handlePlot = async () => {

    setLoading(true)
    setError(null)
    setDragData([])
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
    // UTC time range
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
      // Supabase may return only 1000 rows per request.
      // One full day = about 1440 minute samples.
      // ======================================================

      while (hasMore) {

        const {
          data,
          error: queryError
        } = await supabase

          .from('satellite_timeseries')

          .select(`
            timestamp,
            satellite,
            orbit_number,

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
            SATELLITE
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
        'DRAG START:',
        startDateTime
      )

      console.log(
        'DRAG END:',
        endDateTime
      )

      console.log(
        'DRAG POINTS:',
        allData.length
      )

      console.log(
        'DRAG SAMPLE:',
        allData.slice(0, 5)
      )


      setDragData(
        allData
      )

      setHasPlotted(true)


    } catch (queryError) {

      console.error(
        'Drag query error:',
        queryError
      )

      setError(
        queryError?.message ||
        'Unable to load drag data.'
      )


    } finally {

      setLoading(false)
    }
  }


  // ==========================================================
  // LATEST SAMPLE
  //
  // ใช้แถวล่าสุดในช่วงเวลาที่เลือกสำหรับ Calculation Inputs
  // ==========================================================

  const latestSample =
    dragData.length > 0
      ? dragData[
          dragData.length - 1
        ]
      : null


  // ==========================================================
  // CALCULATE DRAG AGAIN FROM FORMULA
  //
  // Fd = 0.5 * rho * Cd * A * V^2
  //
  // V database = km/s
  // Formula      = m/s
  // ==========================================================

  const formulaResults =
    useMemo(() => {

      if (!latestSample) {
        return null
      }


      const cd =
        Number(
          latestSample.cd
        )

      const area =
        Number(
          latestSample.projected_area_m2
        )

      const velocityMps =
        Number(
          latestSample.relative_velocity_km_s
        ) * 1000


      const densityDns =
        Number(
          latestSample.density_dns_kg_m3
        )

      const densityNrl =
        Number(
          latestSample.density_nrl_kg_m3
        )


      if (
        !Number.isFinite(cd) ||
        !Number.isFinite(area) ||
        !Number.isFinite(velocityMps)
      ) {
        return null
      }


      const dnsDrag =
        0.5 *
        densityDns *
        cd *
        area *
        velocityMps ** 2


      const nrlDrag =
        0.5 *
        densityNrl *
        cd *
        area *
        velocityMps ** 2


      return {

        dnsDrag,
        nrlDrag,
        velocityMps
      }

    }, [latestSample])


  // ==========================================================
  // SUMMARY
  // ==========================================================

  const summary =
    useMemo(() => {

      if (
        !dragData ||
        dragData.length === 0
      ) {
        return null
      }


      const valid =
        dragData.filter(
          row =>

            Number.isFinite(
              Number(
                row.drag_dns_n
              )
            ) &&

            Number.isFinite(
              Number(
                row.drag_nrl_n
              )
            )
        )


      if (
        valid.length === 0
      ) {
        return null
      }


      // ------------------------------------------------------
      // Mean DNS drag
      // ------------------------------------------------------

      const meanDns =
        valid.reduce(
          (sum, row) =>
            sum +
            Number(
              row.drag_dns_n
            ),
          0
        ) / valid.length


      // ------------------------------------------------------
      // Mean NRL drag
      // ------------------------------------------------------

      const meanNrl =
        valid.reduce(
          (sum, row) =>
            sum +
            Number(
              row.drag_nrl_n
            ),
          0
        ) / valid.length


      // ------------------------------------------------------
      // Peak DNS
      // ------------------------------------------------------

      const peakDns =
        valid.reduce(
          (maxRow, row) =>

            Number(
              row.drag_dns_n
            ) >
            Number(
              maxRow.drag_dns_n
            )

              ? row
              : maxRow,

          valid[0]
        )


      // ------------------------------------------------------
      // Peak NRL
      // ------------------------------------------------------

      const peakNrl =
        valid.reduce(
          (maxRow, row) =>

            Number(
              row.drag_nrl_n
            ) >
            Number(
              maxRow.drag_nrl_n
            )

              ? row
              : maxRow,

          valid[0]
        )


      // ------------------------------------------------------
      // Difference
      //
      // Positive:
      // NRL drag > DNS drag
      // ------------------------------------------------------

      const differencePercent =
        meanDns !== 0
          ? (
              (
                meanNrl -
                meanDns
              ) /
              meanDns
            ) * 100
          : null


      return {

        count:
          valid.length,

        meanDns,

        meanNrl,

        peakDns:
          Number(
            peakDns.drag_dns_n
          ),

        peakDnsTime:
          peakDns.timestamp,

        peakNrl:
          Number(
            peakNrl.drag_nrl_n
          ),

        peakNrlTime:
          peakNrl.timestamp,

        differencePercent
      }

    }, [dragData])


  // ==========================================================
  // CHART DATA
  // ==========================================================

  const dragChartData =
    useMemo(() => {

      return {

        labels:
          dragData.map(
            item =>
              formatUtcTime(
                item.timestamp
              )
          ),


        datasets: [

          // --------------------------------------------------
          // DNS POD DRAG
          // --------------------------------------------------

          {
            label:
              'Drag from DNS POD',

            data:
              dragData.map(
                item =>
                  item.drag_dns_n
              ),

            borderWidth: 2,

            pointRadius:
              dragData.length > 300
                ? 0
                : 2,

            pointHoverRadius: 5,

            tension: 0.15
          },


          // --------------------------------------------------
          // NRLMSISE-00 DRAG
          // --------------------------------------------------

          {
            label:
              'Drag from NRLMSISE-00',

            data:
              dragData.map(
                item =>
                  item.drag_nrl_n
              ),

            borderWidth: 2,

            pointRadius:
              dragData.length > 300
                ? 0
                : 2,

            pointHoverRadius: 5,

            tension: 0.15
          },


          // --------------------------------------------------
          // DNS AVERAGE
          // --------------------------------------------------

          {
            label:
              'Average DNS Drag',

            data:
              dragData.map(
                () =>
                  summary?.meanDns ??
                  null
              ),

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
      dragData,
      summary
    ])


  // ==========================================================
  // CHART OPTIONS
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

        display: true,

        position: 'top'
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

          maxTicksLimit: 12,

          maxRotation: 0,

          autoSkip: true
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
            ).toExponential(2)
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

          <h1>
            Drag Analysis
          </h1>

          <p>
            Atmospheric drag calculation
            and comparison
          </p>

        </div>

      </div>


      {/* ====================================================
          FILTER
      ==================================================== */}

      <section className="filter-panel">


        {/* SATELLITE */}

        <div>

          <label>
            Satellite
          </label>

          <select
            value={SATELLITE}
            disabled
          >

            <option value="Swarm-A">
              Swarm-A
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
          SELECTED PERIOD
      ==================================================== */}

      {hasPlotted &&
       dragData.length > 0 && (

        <section className="analysis-selection-bar">

          <div>

            <span>
              Satellite
            </span>

            <strong>
              Swarm-A
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
              Data Points
            </span>

            <strong>
              {dragData.length}
            </strong>

          </div>


          <div>

            <span>
              Latest Sample
            </span>

            <strong>
              {
                formatUtcTime(
                  latestSample?.timestamp
                )
              } UTC
            </strong>

          </div>

        </section>

      )}


      {/* ====================================================
          CALCULATION INPUTS + RESULT
      ==================================================== */}

      <section className="drag-layout">


        {/* INPUTS */}

        <div className="analysis-card">

          <h2>
            Calculation Inputs
          </h2>


          <div className="parameter-row">

            <span>
              DNS POD Density
            </span>

            <strong>

              {
                formatScientific(
                  latestSample
                    ?.density_dns_kg_m3
                )
              } kg/m³

            </strong>

          </div>


          <div className="parameter-row">

            <span>
              NRLMSISE-00 Density
            </span>

            <strong>

              {
                formatScientific(
                  latestSample
                    ?.density_nrl_kg_m3
                )
              } kg/m³

            </strong>

          </div>


          <div className="parameter-row">

            <span>
              Drag Coefficient (Cd)
            </span>

            <strong>

              {
                formatNumber(
                  latestSample?.cd,
                  2
                )
              }

            </strong>

          </div>


          <div className="parameter-row">

            <span>
              Projected Area
            </span>

            <strong>

              {
                formatNumber(
                  latestSample
                    ?.projected_area_m2,
                  4
                )
              } m²

            </strong>

          </div>


          <div className="parameter-row">

            <span>
              Satellite Mass
            </span>

            <strong>

              {
                formatNumber(
                  latestSample
                    ?.mass_kg,
                  3
                )
              } kg

            </strong>

          </div>


          <div className="parameter-row">

            <span>
              Relative Velocity
            </span>

            <strong>

              {
                formatNumber(
                  formulaResults
                    ?.velocityMps,
                  2
                )
              } m/s

            </strong>

          </div>


          <div className="parameter-row">

            <span>
              Altitude
            </span>

            <strong>

              {
                formatNumber(
                  latestSample
                    ?.altitude_km,
                  3
                )
              } km

            </strong>

          </div>


          <div className="parameter-row">

            <span>
              Orbit Number
            </span>

            <strong>

              {
                latestSample
                  ?.orbit_number ??
                'N/A'
              }

            </strong>

          </div>

        </div>


        {/* ==================================================
            RESULT
        ================================================== */}

        <div className="analysis-card result-card">

          <h2>
            Drag Force
          </h2>


          {/* DNS */}

          <div
            style={{
              marginBottom: '24px'
            }}
          >

            <span>
              DNS POD
            </span>

            <div className="large-result">

              {
                formatScientific(
                  latestSample
                    ?.drag_dns_n
                )
              }

            </div>

            <p>N</p>

          </div>


          {/* NRL */}

          <div
            style={{
              marginBottom: '24px'
            }}
          >

            <span>
              NRLMSISE-00
            </span>

            <div className="large-result">

              {
                formatScientific(
                  latestSample
                    ?.drag_nrl_n
                )
              }

            </div>

            <p>N</p>

          </div>


          {/* FORMULA */}

          <div className="formula">

            F<sub>D</sub>
            {' = '}
            ½ ρ C<sub>D</sub> A V
            <sub>rel</sub>²

          </div>

        </div>

      </section>


      {/* ====================================================
          FORMULA VERIFICATION
      ==================================================== */}

      {latestSample &&
       formulaResults && (

        <section className="details">

          <h2>
            Drag Calculation Verification
          </h2>


          <div className="detail-grid">


            <p>

              <strong>
                DNS Database:
              </strong>{' '}

              {
                formatScientific(
                  latestSample
                    .drag_dns_n
                )
              } N

            </p>


            <p>

              <strong>
                DNS Formula:
              </strong>{' '}

              {
                formatScientific(
                  formulaResults
                    .dnsDrag
                )
              } N

            </p>


            <p>

              <strong>
                NRL Database:
              </strong>{' '}

              {
                formatScientific(
                  latestSample
                    .drag_nrl_n
                )
              } N

            </p>


            <p>

              <strong>
                NRL Formula:
              </strong>{' '}

              {
                formatScientific(
                  formulaResults
                    .nrlDrag
                )
              } N

            </p>


            <p>

              <strong>
                DNS Drag Acceleration:
              </strong>{' '}

              {
                formatScientific(
                  latestSample
                    .drag_accel_dns_m_s2
                )
              } m/s²

            </p>


            <p>

              <strong>
                NRL Drag Acceleration:
              </strong>{' '}

              {
                formatScientific(
                  latestSample
                    .drag_accel_nrl_m_s2
                )
              } m/s²

            </p>

          </div>

        </section>

      )}


      {/* ====================================================
          DRAG GRAPH
      ==================================================== */}

      <section className="graph-box full-width">

        <div className="graph-header">

          <h2>
            Drag Force Analysis
          </h2>

          <span>

            {
              hasPlotted
                ? `${dragData.length} points`
                : 'Select a time period'
            }

          </span>

        </div>


        <div className="analysis-graph-placeholder">

          {error ? (

            <div className="graph-waiting">

              <strong>
                Unable to load data
              </strong>

              <span>
                {error}
              </span>

            </div>

          ) : hasPlotted &&
              dragData.length > 0 ? (

            <div
              className="density-chart-container"
              style={{
                height: '380px'
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

          ) : hasPlotted ? (

            <div className="graph-waiting">

              <strong>
                No drag data found
              </strong>

              <span>
                No data available
                for the selected period.
              </span>

            </div>

          ) : (

            <div className="graph-waiting">

              <strong>
                Select date and time,
                then click Plot Data
              </strong>

              <span>
                Satellite drag force
                comparison will appear here.
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
              Drag Summary
            </h2>

            <p>
              Summary of atmospheric drag
              during the selected period
            </p>

          </div>

        </div>


        <div className="summary-grid">


          {/* MEAN DNS */}

          <div className="summary-card">

            <span>
              Mean DNS Drag
            </span>

            <strong>

              {
                summary
                  ? formatScientific(
                      summary.meanDns
                    )
                  : '—'
              }

            </strong>

            <small>
              N
            </small>

          </div>


          {/* MEAN NRL */}

          <div className="summary-card">

            <span>
              Mean NRL Drag
            </span>

            <strong>

              {
                summary
                  ? formatScientific(
                      summary.meanNrl
                    )
                  : '—'
              }

            </strong>

            <small>
              N
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
                summary.differencePercent !== null

                  ? `${formatNumber(
                      summary
                        .differencePercent,
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
              Peak DNS Drag
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
              N
            </small>

          </div>


          {/* PEAK DNS TIME */}

          <div className="summary-card">

            <span>
              DNS Peak Time
            </span>

            <strong>

              {
                summary
                  ? formatUtcTime(
                      summary
                        .peakDnsTime
                    )
                  : '—'
              }

            </strong>

            <small>
              UTC
            </small>

          </div>


          {/* DATA POINTS */}

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


export default DragAnalysis