import { useState } from 'react'                              // ใช้เก็บวันที่ เวลา และข้อมูลที่ Query ได้
import { supabase } from '../supabaseClient'                  // เชื่อมต่อ Supabase

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
} from 'chart.js'

import { Line } from 'react-chartjs-2'                        // ใช้สร้างกราฟเส้น


ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
)


function ModelComparison() {

  const [date, setDate] = useState('2026-01-19')              // วันที่ที่ต้องการเปรียบเทียบ
  const [startTime, setStartTime] = useState('00:00')         // เวลาเริ่มต้น
  const [endTime, setEndTime] = useState('23:00')             // เวลาสิ้นสุด

  const [swarmData, setSwarmData] = useState([])              // เก็บ Density จาก Swarm-A
  const [jbData, setJbData] = useState([])                    // เก็บ Density จาก JB2008

  const [loading, setLoading] = useState(false)               // สถานะกำลังโหลด
  const [error, setError] = useState(null)                    // เก็บ Error
  const [hasCompared, setHasCompared] = useState(false)       // ตรวจว่ากด Compare แล้วหรือยัง


  const hours = Array.from(
    { length: 24 },                                           // ชั่วโมงทั้งหมด 24 ชั่วโมง
    (_, i) => String(i).padStart(2, '0')                      // 00 ถึง 23
  )

  const minutes = Array.from(
    { length: 60 },                                           // นาทีทั้งหมด 60 นาที
    (_, i) => String(i).padStart(2, '0')                      // 00 ถึง 59
  )


  const handleCompare = async () => {

    setLoading(true)                                          // เริ่ม Loading
    setError(null)                                            // ล้าง Error เดิม
    setHasCompared(false)                                     // ซ่อนผลเดิมระหว่าง Query

    const startDateTime = `${date}T${startTime}:00Z`          // สร้างเวลาเริ่มต้นแบบ UTC
    const endDateTime = `${date}T${endTime}:59.999Z`          // สร้างเวลาสิ้นสุดแบบ UTC


    // -----------------------------
    // 1. ดึงข้อมูล Swarm-A
    // -----------------------------

    const { data: swarm, error: swarmError } = await supabase
      .from('swarm_drag_result')                              // ตารางข้อมูล Swarm-A
      .select('timestamp, density_kg_m3')                     // ใช้เวลาและ Density
      .gte('timestamp', startDateTime)                        // ตั้งแต่เวลาเริ่มต้น
      .lte('timestamp', endDateTime)                          // ถึงเวลาสิ้นสุด
      .order('timestamp', { ascending: true })                // เรียงตามเวลา


    if (swarmError) {
      setError(swarmError.message)                            // แสดง Error จาก Swarm
      setLoading(false)
      return
    }


    if (!swarm || swarm.length === 0) {
      setSwarmData([])                                       // ไม่มีข้อมูล Swarm
      setJbData([])
      setHasCompared(true)
      setLoading(false)
      return
    }


// -----------------------------
// 2. ดึงข้อมูล JB2008
//    ตามช่วงเวลาเดียวกับ Swarm-A
// -----------------------------

let allJbData = []                                      // เก็บข้อมูล JB2008 ทั้งหมด
let from = 0                                            // จุดเริ่มต้นของ batch
const batchSize = 1000                                  // ดึงครั้งละ 1,000 records
let hasMore = true                                      // เช็กว่ายังมีข้อมูลอีกหรือไม่

while (hasMore) {

  const { data: batch, error: jbError } = await supabase
    .from('jb2008_result')                              // ตาราง JB2008
    .select('timestamp, density_kg_m3')                 // ดึงเวลาและ Density
    .gte('timestamp', startDateTime)                    // เริ่มตามเวลาที่เลือก
    .lte('timestamp', endDateTime)                      // สิ้นสุดตามเวลาที่เลือก
    .order('timestamp', { ascending: true })            // เรียงข้อมูลตามเวลา
    .range(from, from + batchSize - 1)                  // ดึงข้อมูลทีละ 1,000 แถว

  if (jbError) {
    setError(jbError.message)                           // แสดง Error
    setLoading(false)                                   // หยุด Loading
    return
  }

  if (!batch || batch.length === 0) {
    hasMore = false                                     // ไม่มีข้อมูลเพิ่มแล้ว
    break
  }

  allJbData = [...allJbData, ...batch]                  // รวมข้อมูลแต่ละ batch

  if (batch.length < batchSize) {
    hasMore = false                                     // เป็น batch สุดท้าย
  } else {
    from += batchSize                                   // ไป batch ถัดไป
  }
}


    console.log('SWARM DATA:', swarm)                         // ตรวจสอบข้อมูล Swarm
    console.log('SWARM POINTS:', swarm.length)                // จำนวนจุด Swarm

console.log('JB2008 DATA:', allJbData)                  // ดูข้อมูล JB2008 ทั้งหมด
console.log('JB2008 POINTS:', allJbData.length)         // ดูจำนวนข้อมูลทั้งหมด

    setSwarmData(swarm)                                       // เก็บข้อมูล Swarm
    setJbData(allJbData)                                       // เก็บข้อมูล JB2008

    setHasCompared(true)                                      // Query เสร็จแล้ว
    setLoading(false)                                         // หยุด Loading
  }


  // สร้าง Map เพื่อจับคู่ JB2008 ตาม timestamp
const jbMap = new Map(
  jbData.map((item) => [
    Math.floor(new Date(item.timestamp).getTime() / 1000),  // แปลงเวลา JB2008 เป็นวินาที
    item.density_kg_m3                                      // เก็บค่า Density ของ JB2008
  ])
)


  const comparisonChartData = {

    labels: swarmData.map((item) =>
      new Date(item.timestamp).toLocaleTimeString('en-GB', {
        timeZone: 'UTC',                                      // ใช้เวลา UTC
        hour: '2-digit',
        minute: '2-digit'
      })
    ),

    datasets: [

      {
        label: 'Swarm-A',                                     // เส้นข้อมูล Swarm
        data: swarmData.map(
          (item) => item.density_kg_m3
        ),

        borderColor: '#0891b2',                               // สีเส้น Swarm
        backgroundColor: '#0891b2',
        borderWidth: 3,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.25
      },

      {
        label: 'JB2008 Model',                                // เส้นข้อมูล JB2008
      data: swarmData.map((item) => {
        const swarmSecond = Math.floor(
          new Date(item.timestamp).getTime() / 1000                // แปลงเวลา Swarm เป็นวินาที
  )

  return jbMap.get(swarmSecond) ?? null                       // ดึง JB2008 ที่เวลาเดียวกัน
}),
        borderColor: '#7c3aed',                               // สีเส้น Model
        backgroundColor: '#7c3aed',
        borderWidth: 3,
        pointRadius: 3,
        pointHoverRadius: 6,
        tension: 0.25,
        borderDash: [8, 5]                                    // เส้นประเพื่อแยก Model
      }

    ]
  }


  const comparisonChartOptions = {

    responsive: true,                                        // ปรับขนาดตามหน้าจอ
    maintainAspectRatio: false,                              // ใช้พื้นที่ container เต็ม

    interaction: {
      mode: 'index',                                         // Hover แล้วดูทั้งสองค่า
      intersect: false
    },

    plugins: {

      legend: {
        display: true,
        position: 'top'                                      // Legend อยู่ด้านบน
      },

      tooltip: {
        callbacks: {
          label: (context) =>
            `${context.dataset.label}: ${Number(
              context.raw
            ).toExponential(3)} kg/m³`                       // แสดงค่า Density ใน Tooltip
        }
      }
    },

    scales: {

      x: {

        title: {
          display: true,
          text: 'Time (UTC)'                                 // ชื่อแกน X
        },

        grid: {
          display: false                                     // ซ่อนเส้นตั้ง ลดความรก
        },

        ticks: {
          maxTicksLimit: 12,                                 // จำกัดจำนวนเวลา
          autoSkip: true,
          maxRotation: 0
        }
      },

      y: {

        title: {
          display: true,
          text: 'Density (kg/m³)'                            // ชื่อแกน Y
        },

        grid: {
          color: '#e5e7eb'                                   // Grid แนวนอน
        },

        ticks: {
          callback: (value) =>
            Number(value).toExponential(2)                    // เช่น 3.20e-12
        }
      }
    }
  }


  return (

    <>

      <div className="page-header">

        <div>

          <h1>Model Comparison</h1>

          <p>
            Compare Swarm-A observations with atmospheric models
          </p>

        </div>

      </div>


      {/* ---------------- Analysis Parameters ---------------- */}

      <section className="analysis-control-panel">

        <div className="analysis-control-title">

          <div>

            <h2>Comparison Parameters</h2>

            <p>
              Select date and time range for model comparison
            </p>

          </div>

          <span className="prototype-badge">
            Swarm-A vs JB2008
          </span>

        </div>


        <div className="analysis-filter-grid">


          {/* Date */}

          <div className="analysis-field">

            <label>Date</label>

            <input
              type="date"                                      // เลือกวันที่จากปฏิทิน
              value={date}
              onChange={(e) => setDate(e.target.value)}
              onKeyDown={(e) => e.preventDefault()}            // ไม่ให้พิมพ์วันที่เอง
              onClick={(e) => e.currentTarget.showPicker?.()}  // คลิกแล้วเปิดปฏิทิน
            />

          </div>


          {/* Start Time */}

          <div className="analysis-field">

            <label>Start Time</label>

            <div className="time-selector">

              <select
                value={startTime.split(':')[0]}
                onChange={(e) =>
                  setStartTime(
                    `${e.target.value}:${startTime.split(':')[1]}`
                  )
                }
              >

                {hours.map((hour) => (

                  <option key={hour} value={hour}>
                    {hour}
                  </option>

                ))}

              </select>


              <span>:</span>


              <select
                value={startTime.split(':')[1]}
                onChange={(e) =>
                  setStartTime(
                    `${startTime.split(':')[0]}:${e.target.value}`
                  )
                }
              >

                {minutes.map((minute) => (

                  <option key={minute} value={minute}>
                    {minute}
                  </option>

                ))}

              </select>

            </div>

          </div>


          {/* End Time */}

          <div className="analysis-field">

            <label>End Time</label>

            <div className="time-selector">

              <select
                value={endTime.split(':')[0]}
                onChange={(e) =>
                  setEndTime(
                    `${e.target.value}:${endTime.split(':')[1]}`
                  )
                }
              >

                {hours.map((hour) => (

                  <option key={hour} value={hour}>
                    {hour}
                  </option>

                ))}

              </select>


              <span>:</span>


              <select
                value={endTime.split(':')[1]}
                onChange={(e) =>
                  setEndTime(
                    `${endTime.split(':')[0]}:${e.target.value}`
                  )
                }
              >

                {minutes.map((minute) => (

                  <option key={minute} value={minute}>
                    {minute}
                  </option>

                ))}

              </select>

            </div>

          </div>


          {/* Model */}

          <div className="analysis-field">

            <label>Model</label>

            <select>

              <option>JB2008</option>

            </select>

          </div>


          <button
            className="plot-button"
            type="button"
            onClick={handleCompare}                            // Query ข้อมูลเมื่อกด Compare
            disabled={loading}
          >

            {loading ? 'Loading...' : 'Compare Models'}

          </button>

        </div>

      </section>


      {/* ---------------- Selected Period ---------------- */}

      <section className="analysis-selection-bar">

        <div>
          <span>Satellite</span>
          <strong>Swarm-A</strong>
        </div>

        <div>
          <span>Date</span>
          <strong>{date}</strong>
        </div>

        <div>
          <span>Time Range</span>
          <strong>
            {startTime} – {endTime}
          </strong>
        </div>

        <div>
          <span>Model</span>
          <strong>JB2008</strong>
        </div>

      </section>


      {/* ---------------- Comparison Graph ---------------- */}

      <section className="analysis-graph-card">

        <div className="analysis-graph-heading">

          <div>

            <p className="graph-category">
              ATMOSPHERIC MODEL COMPARISON
            </p>

            <h2>
              Thermospheric Density Comparison
            </h2>

            <p>
              Swarm-A observation compared with JB2008 model
            </p>

          </div>

          <span className="graph-unit">
            kg/m³
          </span>

        </div>


        <div className="analysis-graph-placeholder">

          {error ? (

            <div className="graph-waiting">

              <strong>Unable to load data</strong>

              <span>{error}</span>

            </div>

          ) : hasCompared && swarmData.length > 0 ? (

            <div className="density-chart-container">

              <Line
                data={comparisonChartData}                     // กราฟ Swarm-A และ JB2008
                options={comparisonChartOptions}
              />

            </div>

          ) : hasCompared ? (

            <div className="graph-waiting">

              <strong>No data available</strong>

              <span>
                No data was found for the selected period.
              </span>

            </div>

          ) : (

            <div className="graph-waiting">

              <strong>
                Select parameters and click Compare Models
              </strong>

              <span>
                Swarm-A and JB2008 comparison will appear here.
              </span>

            </div>

          )}

        </div>

      </section>


      {/* ---------------- Model Status ---------------- */}

      <section className="analysis-card full-width">

        <h2>Available Models</h2>


        <div className="parameter-row">

          <span>JB2008</span>

          <strong className="available">
            Available
          </strong>

        </div>


        <div className="parameter-row">

          <span>NRLMSIS 2.0</span>

          <strong className="pending">
            Planned
          </strong>

        </div>


        <div className="parameter-row">

          <span>NRLMSISE-00</span>

          <strong className="pending">
            Planned
          </strong>

        </div>

      </section>

    </>

  )

}

export default ModelComparison