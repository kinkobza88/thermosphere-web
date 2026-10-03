import { useState } from 'react'                              // ใช้ State สำหรับเก็บค่าที่ผู้ใช้เลือกและข้อมูลที่ Query
import { supabase } from '../supabaseClient'                  // เชื่อม Supabase

import {
  Chart as ChartJS,                                           // ตัวหลักของ Chart.js
  CategoryScale,                                              // ใช้สำหรับแกน X แบบหมวดหมู่/เวลา
  LinearScale,                                                // ใช้สำหรับแกน Y แบบตัวเลข
  PointElement,                                               // ใช้สำหรับจุดบนกราฟ
  LineElement,                                                // ใช้สำหรับเส้นกราฟ
  Title,                                                      // รองรับ title ของกราฟ
  Tooltip,                                                    // แสดงข้อมูลเมื่อ hover
  Legend                                                      // แสดง legend ของกราฟ
} from 'chart.js'

import { Line } from 'react-chartjs-2'                        // Component สำหรับวาด Line Chart

ChartJS.register(
  CategoryScale,                                              // ลงทะเบียนแกน X
  LinearScale,                                                // ลงทะเบียนแกน Y
  PointElement,                                               // ลงทะเบียนจุด
  LineElement,                                                // ลงทะเบียนเส้น
  Title,                                                      // ลงทะเบียน title
  Tooltip,                                                    // ลงทะเบียน tooltip
  Legend                                                      // ลงทะเบียน legend
)// เชื่อมต่อกับ Supabase เพื่อ Query ข้อมูล JB2008
function DensityAnalysis() {
  const [satellite, setSatellite] = useState('Swarm-A')
  const [date, setDate] = useState('2026-01-01')
  const [startTime, setStartTime] = useState('00:00')
  const [endTime, setEndTime] = useState('06:00')
  const [model, setModel] = useState('JB2008')
  const [hasPlotted, setHasPlotted] = useState(false)
  const [plotData, setPlotData] = useState([])         // เก็บข้อมูล Density ที่ Query ได้ตามช่วงเวลาที่เลือก
  const [plotLoading, setPlotLoading] = useState(false) // ใช้แสดงสถานะระหว่างกำลังดึงข้อมูล
  const [plotError, setPlotError] = useState(null)      // เก็บข้อความ Error หาก Query ไม่สำเร็จ
  const hours = Array.from(
  { length: 24 },                                      // กำหนดให้มีทั้งหมด 24 ค่า
  (_, i) => String(i).padStart(2, '0')                 // สร้างชั่วโมงตั้งแต่ 00 ถึง 23
)

const minutes = Array.from(
  { length: 60 },                                      // กำหนดให้มีทั้งหมด 60 ค่า
  (_, i) => String(i).padStart(2, '0')                 // สร้างนาทีตั้งแต่ 00 ถึง 59
)

const handlePlot = async () => {
  setPlotLoading(true)                                      // เริ่มสถานะกำลังโหลดข้อมูล
  setPlotError(null)                                        // ล้าง Error จากครั้งก่อน
  setPlotData([])                                           // ล้างข้อมูล Plot ครั้งก่อน
  setHasPlotted(false)                                      // ซ่อนผลเดิมระหว่าง Query ข้อมูลใหม่

  const startDateTime = `${date}T${startTime}:00Z`          // สร้าง timestamp เวลาเริ่มต้นแบบ UTC
  const endDateTime = `${date}T${endTime}:59.999Z`          // รวมทั้งนาทีสุดท้ายที่ผู้ใช้เลือก

  let allData = []                                          // เก็บข้อมูลทั้งหมดจากทุก batch
  let from = 0                                              // ตำแหน่งเริ่มต้นของ batch
  const batchSize = 1000                                    // ดึงข้อมูลครั้งละ 1,000 records
  let hasMore = true                                        // ใช้ตรวจว่ายังมีข้อมูลเหลือหรือไม่

  try {
    while (hasMore) {
      const { data, error } = await supabase
        .from('swarm_drag_result')                              // เลือกตาราง JB2008
        .select('timestamp, altitude_km, density_kg_m3, drag_force_n')    // เลือกเฉพาะข้อมูลที่ต้องใช้
        .gte('timestamp', startDateTime)                    // เริ่มจาก Date + Start Time
        .lte('timestamp', endDateTime)                      // สิ้นสุดที่ Date + End Time
        .order('timestamp', { ascending: true })            // เรียงข้อมูลตามเวลา
        .range(from, from + batchSize - 1)                  // ดึงข้อมูลทีละ 1,000 records

      if (error) {
        throw error                                         // ส่ง Error ไปจัดการใน catch
      }

      allData = [...allData, ...(data || [])]               // รวมข้อมูล batch ใหม่เข้ากับข้อมูลเดิม

      if (!data || data.length < batchSize) {
        hasMore = false                                     // ถ้าไม่ถึง 1,000 แสดงว่าเป็น batch สุดท้าย
      } else {
        from += batchSize                                   // เลื่อนไปยัง batch ถัดไป
      }
    }

    console.log('START:', startDateTime)                     // ตรวจสอบเวลาเริ่มต้นที่ใช้ Query
    console.log('END:', endDateTime)                         // ตรวจสอบเวลาสิ้นสุดที่ใช้ Query
    console.log('PLOT POINTS:', allData.length)              // ตรวจสอบจำนวน records ที่ได้ทั้งหมด
    console.log('PLOT DATA:', allData.slice(0, 10))          // แสดงตัวอย่าง 10 records แรก

    setPlotData(allData)                                     // เก็บข้อมูลทั้งหมดสำหรับใช้ในขั้นต่อไป
    setHasPlotted(true)                                      // แจ้งว่า Query สำเร็จแล้ว
  } catch (error) {
    console.error('Plot query error:', error)                // แสดงรายละเอียด Error ใน Console
    setPlotError(error.message)                              // เก็บ Error สำหรับแสดงหน้าเว็บ
  } finally {
    setPlotLoading(false)                                    // หยุด Loading ไม่ว่าจะสำเร็จหรือ Error
  }
}
const densityChartData = {
  labels: plotData.map((item) =>
    new Date(item.timestamp).toLocaleTimeString('en-GB', {
      timeZone: 'UTC',                                      // แสดงเวลาเป็น UTC
      hour: '2-digit',                                      // แสดงชั่วโมง
      minute: '2-digit'                                     // แสดงนาที
    })
  ),

  datasets: [
  {
    label: 'Swarm-A Density',                             // ชื่อข้อมูลที่แสดงบน Legend
    data: plotData.map((item) => item.density_kg_m3),     // ค่า Density จาก swarm_drag_result

    borderColor: '#0f172a',                               // สีเส้นกราฟเป็นน้ำเงินดำให้เห็นชัด
    backgroundColor: '#0f172a',                           // สีจุดบนกราฟ
    pointBackgroundColor: '#0f172a',                      // สีภายในจุด
    pointBorderColor: '#ffffff',                          // ขอบจุดสีขาวเพื่อแยกจากเส้น

    borderWidth: 3,                                       // เพิ่มความหนาของเส้น
    pointRadius: 4,                                       // เพิ่มขนาดจุดข้อมูล
    pointHoverRadius: 6,                                  // ขยายจุดเมื่อเอาเมาส์ไปชี้
    pointBorderWidth: 2,                                  // ความหนาขอบจุด

    tension: 0.25                                         // ทำให้เส้นโค้งเล็กน้อย
  }
  ]
}
const dragChartData = {
  labels: plotData.map((item) =>
    new Date(item.timestamp).toLocaleTimeString('en-GB', {
      timeZone: 'UTC',                                      // แสดงเวลาเป็น UTC
      hour: '2-digit',                                      // แสดงชั่วโมง
      minute: '2-digit'                                     // แสดงนาที
    })
  ),

  datasets: [
    {
      label: 'Swarm-A Drag Force',                          // ชื่อเส้นกราฟ Drag
      data: plotData.map((item) => item.drag_force_n),      // ดึงค่า Drag Force จาก swarm_drag_result

      borderColor: '#0891b2',                               // สีเส้นกราฟ Drag
      backgroundColor: '#0891b2',                           // สีจุดบนกราฟ
      pointBackgroundColor: '#0891b2',                      // สีด้านในจุด
      pointBorderColor: '#ffffff',                          // ขอบจุดสีขาว

      borderWidth: 3,                                       // ความหนาของเส้นกราฟ
      pointRadius: 4,                                       // ขนาดจุดข้อมูล
      pointHoverRadius: 6,                                  // ขนาดจุดเมื่อเอาเมาส์ชี้
      pointBorderWidth: 2,                                  // ความหนาขอบจุด
      tension: 0.25                                         // ทำให้เส้นโค้งเล็กน้อย
    }
  ]
}
const densityChartOptions = {
  responsive: true,                                        // ให้กราฟปรับขนาดตาม container
  maintainAspectRatio: false,                              // ให้ใช้ความสูงของ container ได้เต็ม

  plugins: {
    legend: {
      display: true                                        // แสดงชื่อเส้นกราฟ
    }
  },

  scales: {
  x: {
    title: {
      display: true,                                     // แสดงชื่อแกน X
      text: 'Time (UTC)'                                 // ชื่อแกนเวลา
    },
    grid: {
      color: '#e5e7eb'                                   // สีเส้นตารางให้จางกว่ากราฟ
    },
    ticks: {
      color: '#475569'                                   // สีตัวเลขแกน X ให้เข้มขึ้น
    }
  },

 y: {
  title: {
    display: true,                                     // แสดงชื่อแกน Y
    text: 'Density (kg/m³)'                            // หน่วย Density
  },

  grid: {
    color: '#e5e7eb'                                   // สีเส้นตารางแนวนอน
  },

  ticks: {
    color: '#475569',                                  // สีตัวเลขแกน Y
    callback: (value) => {
      return `${(Number(value) / 1e-12).toFixed(2)}e-12` // ย่อเลขให้อ่านง่าย
    }
  }
}
}
}
const dragChartOptions = {
  responsive: true,                                        // ให้กราฟปรับขนาดตาม container
  maintainAspectRatio: false,                              // ให้กราฟใช้ความสูงของ container ได้เต็ม

  plugins: {
    legend: {
      display: true                                        // แสดงชื่อเส้นกราฟ
    }
  },

  scales: {
    x: {
      title: {
        display: true,                                     // แสดงชื่อแกน X
        text: 'Time (UTC)'                                 // ชื่อแกนเวลา
      },
      grid: {
        color: '#e5e7eb'                                   // สีเส้นตารางแนวตั้ง
      },
      ticks: {
        color: '#475569'                                   // สีตัวเลขแกน X
      }
    },

    y: {
      title: {
        display: true,                                     // แสดงชื่อแกน Y
        text: 'Drag Force (N)'                             // หน่วยแรงต้านอากาศ
      },
      grid: {
        color: '#e5e7eb'                                   // สีเส้นตารางแนวนอน
      },
      ticks: {
        color: '#475569',                                  // สีตัวเลขแกน Y
        callback: (value) => Number(value).toExponential(2) // แสดงค่า Drag เป็น scientific notation
      }
    }
  }
}
  return (
    <>
      <div className="page-header analysis-page-header">
        <div>
          <h1>Thermosphere Analysis</h1>
          <p>
            Compare Swarm satellite observations with atmospheric models
          </p>
        </div>
      </div>

      {/* Analysis Parameters */}
      <section className="analysis-control-panel">
        <div className="analysis-control-title">
          <div>
            <h2>Analysis Parameters</h2>
            <p>Select satellite, time period and atmospheric model</p>
          </div>

          <span className="prototype-badge">Analysis Workspace</span>
        </div>

        <div className="analysis-filter-grid">
          <div className="analysis-field">
            <label>Satellite</label>
            <select
              value={satellite}
              onChange={(e) => setSatellite(e.target.value)}
            >
              <option>Swarm-A</option>
              <option>Swarm-B</option>
              <option>Swarm-C</option>
            </select>
          </div>

          <div className="analysis-field">
  <label>Date</label>

  <input
    type="date"                                         // แสดงปฏิทินสำหรับเลือกวันที่
    value={date}                                        // วันที่ปัจจุบันที่ผู้ใช้เลือก
    onChange={(e) => setDate(e.target.value)}           // บันทึกวันที่ใหม่เมื่อเลือกจากปฏิทิน
    onKeyDown={(e) => e.preventDefault()}               // ป้องกันการพิมพ์วันที่เอง
    onClick={(e) => e.currentTarget.showPicker?.()}     // คลิกช่องแล้วเปิดปฏิทินทันที
  />
</div>

         <div className="analysis-field">
  <label>Start Time</label>

  <div className="time-selector">
    <select
      value={startTime.split(':')[0]}                                    // แสดงชั่วโมงของเวลาเริ่มต้น
      onChange={(e) =>
        setStartTime(`${e.target.value}:${startTime.split(':')[1]}`)      // เปลี่ยนเฉพาะชั่วโมง โดยเก็บค่านาทีเดิมไว้
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
      value={startTime.split(':')[1]}                                    // แสดงนาทีของเวลาเริ่มต้น
      onChange={(e) =>
        setStartTime(`${startTime.split(':')[0]}:${e.target.value}`)      // เปลี่ยนเฉพาะนาที โดยเก็บค่าชั่วโมงเดิมไว้
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

         <div className="analysis-field">
  <label>End Time</label>

  <div className="time-selector">
    <select
      value={endTime.split(':')[0]}                                      // แสดงชั่วโมงของเวลาสิ้นสุด
      onChange={(e) =>
        setEndTime(`${e.target.value}:${endTime.split(':')[1]}`)          // เปลี่ยนเฉพาะชั่วโมง
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
      value={endTime.split(':')[1]}                                      // แสดงนาทีของเวลาสิ้นสุด
      onChange={(e) =>
        setEndTime(`${endTime.split(':')[0]}:${e.target.value}`)          // เปลี่ยนเฉพาะนาที
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

          <div className="analysis-field">
            <label>Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              <option>JB2008</option>
              <option>NRLMSIS 2.0</option>
              <option>NRLMSISE-00</option>
            </select>
          </div>

          <button
  className="plot-button"                              // ใช้รูปแบบ CSS ของปุ่มเดิม
  type="button"                                        // กำหนดให้เป็นปุ่มทั่วไป ไม่ใช่ Submit
  onClick={handlePlot}                                 // กดแล้วเรียกฟังก์ชัน handlePlot
  disabled={plotLoading}                               // ระหว่างโหลดข้อมูลจะกดซ้ำไม่ได้
>
  {plotLoading ? 'Loading...' : 'Plot Data'}           {/* ระหว่าง Query จะแสดง Loading... */}
</button>
        </div>
      </section>

      {/* Selected Analysis */}
      <section className="analysis-selection-bar">
        <div>
          <span>Satellite</span>
          <strong>{satellite}</strong>
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
          <strong>{model}</strong>
        </div>
      </section>

      {/* Density Graph */}
      <section className="analysis-graph-card">
        <div className="analysis-graph-heading">
          <div>
            <p className="graph-category">ATMOSPHERIC ANALYSIS</p>
            <h2>Thermospheric Density</h2>
            <p>
              {satellite} observation compared with {model}
            </p>
          </div>

          <span className="graph-unit">kg/m³</span>
        </div>

        <div className="analysis-legend">
          <span>
            <i className="legend-line swarm-line"></i>
            {satellite}
          </span>

          <span>
            <i className="legend-line average-line"></i>
            {satellite} Average
          </span>

          <span>
            <i className="legend-line model-line"></i>
            {model} Model
          </span>
        </div>

        <div className="analysis-graph-placeholder">
  {hasPlotted && plotData.length > 0 ? (                     // ถ้า Query สำเร็จและมีข้อมูลจาก swarm_drag_result
  <div className="density-chart-container">
    <Line
      data={densityChartData}                              // นำข้อมูล Density ที่ Query ได้ไปสร้างกราฟ
      options={densityChartOptions}                        // ใช้การตั้งค่าของกราฟ Density
    />
  </div>
) : (
            <div className="graph-waiting">
              <strong>Select parameters and click Plot Data</strong>
              <span>
                Thermospheric density comparison will appear here.
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Drag Graph */}
      <section className="analysis-graph-card">
        <div className="analysis-graph-heading">
          <div>
            <p className="graph-category">SATELLITE RESPONSE</p>
            <h2>Satellite Drag</h2>
            <p>
              Preliminary drag comparison for the selected period
            </p>
          </div>

          <span className="graph-unit">Preliminary</span>
        </div>

        <div className="analysis-legend">
          <span>
            <i className="legend-line swarm-line"></i>
            {satellite} Drag
          </span>

          <span>
            <i className="legend-line average-line"></i>
            Average Drag
          </span>

          <span>
            <i className="legend-line model-line"></i>
            Model Drag
          </span>
        </div>

        <div className="analysis-graph-placeholder">
  {hasPlotted && plotData.length > 0 ? (                   // ถ้ามีข้อมูลแล้วให้แสดงกราฟ Drag
    <div className="density-chart-container">
      <Line
        data={dragChartData}                               // ใช้ข้อมูล Drag Force
        options={dragChartOptions}                         // ใช้การตั้งค่ากราฟ Drag
      />
    </div>
  ) : (
    <div className="graph-waiting">
      <strong>Select parameters and click Plot Data</strong>
      <span>Satellite drag data will appear here.</span>
    </div>
  )}
</div>
      </section>

      {/* Comparison Summary */}
      <section className="comparison-summary">
        <div className="summary-heading">
          <div>
            <h2>Comparison Summary</h2>
            <p>Summary of the selected analysis period</p>
          </div>
        </div>

        <div className="summary-grid">
          <div className="summary-card">
            <span>Mean Density</span>
            <strong>—</strong>
            <small>kg/m³</small>
          </div>

          <div className="summary-card">
            <span>Model Difference</span>
            <strong>—</strong>
            <small>%</small>
          </div>

          <div className="summary-card">
            <span>Peak Density</span>
            <strong>—</strong>
            <small>kg/m³</small>
          </div>

          <div className="summary-card">
            <span>Peak Time</span>
            <strong>—</strong>
            <small>UTC</small>
          </div>
        </div>
      </section>
    </>
  )
}

export default DensityAnalysis