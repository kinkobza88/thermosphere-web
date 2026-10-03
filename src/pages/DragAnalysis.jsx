import { useState } from 'react'                              // ใช้เก็บวันที่ เวลา และข้อมูลกราฟที่เลือก
import { supabase } from '../supabaseClient'                  // ใช้ Query ข้อมูลจาก Supabase

import {
  Chart as ChartJS,                                           // ตัวหลักของ Chart.js
  CategoryScale,                                              // ใช้สำหรับแกน X
  LinearScale,                                                // ใช้สำหรับแกน Y
  PointElement,                                               // ใช้แสดงจุดข้อมูล
  LineElement,                                                // ใช้แสดงเส้นกราฟ
  Tooltip,                                                    // ใช้แสดงค่าตอนชี้กราฟ
  Legend                                                      // ใช้แสดงชื่อชุดข้อมูล
} from 'chart.js'

import { Line } from 'react-chartjs-2'                        // ใช้สร้างกราฟเส้น
ChartJS.register(
  CategoryScale,                                              // ลงทะเบียนแกน X
  LinearScale,                                                // ลงทะเบียนแกน Y
  PointElement,                                               // ลงทะเบียนจุด
  LineElement,                                                // ลงทะเบียนเส้น
  Tooltip,                                                    // ลงทะเบียน Tooltip
  Legend                                                      // ลงทะเบียน Legend
)
function DragAnalysis({ result }) {
  const [date, setDate] = useState('2026-01-01')              // เก็บวันที่ที่ผู้ใช้เลือก
  const [startTime, setStartTime] = useState('00:00')         // เก็บเวลาเริ่มต้น
  const [endTime, setEndTime] = useState('23:00')             // เก็บเวลาสิ้นสุด
  const hours = Array.from(
  { length: 24 },                                      // สร้างตัวเลือกชั่วโมงทั้งหมด 24 ชั่วโมง
  (_, i) => String(i).padStart(2, '0')                 // ได้ค่า 00 ถึง 23
)

const minutes = Array.from(
  { length: 60 },                                      // สร้างตัวเลือกนาทีทั้งหมด 60 นาที
  (_, i) => String(i).padStart(2, '0')                 // ได้ค่า 00 ถึง 59
)
  const [dragData, setDragData] = useState([])                 // เก็บข้อมูล Drag ที่ Query ได้
  const [loading, setLoading] = useState(false)                // ใช้แสดงสถานะ Loading
  const [error, setError] = useState(null)                     // เก็บ Error หาก Query ไม่สำเร็จ
  const [hasPlotted, setHasPlotted] = useState(false)          // ตรวจว่ากด Plot แล้วหรือยัง
    const handlePlot = async () => {
    setLoading(true)                                          // เริ่มโหลดข้อมูล
    setError(null)                                            // ล้าง Error เดิม
    setHasPlotted(false)                                      // ซ่อนผลเดิมระหว่าง Query

    const startDateTime = `${date}T${startTime}:00Z`          // รวมวันที่และเวลาเริ่มต้น
    const endDateTime = `${date}T${endTime}:59.999Z`          // รวมวันที่และเวลาสิ้นสุด

    const { data, error } = await supabase
      .from('swarm_drag_result')                              // Query ตาราง Swarm Drag
      .select('timestamp, drag_force_n, density_kg_m3')       // ดึงเวลา Drag และ Density
      .gte('timestamp', startDateTime)                        // เริ่มตามเวลาที่ผู้ใช้เลือก
      .lte('timestamp', endDateTime)                          // สิ้นสุดตามเวลาที่ผู้ใช้เลือก
      .order('timestamp', { ascending: true })                // เรียงตามเวลา

    if (error) {
      console.error('Drag query error:', error)               // แสดง Error ใน Console
      setError(error.message)                                 // เก็บข้อความ Error
      setLoading(false)                                       // หยุด Loading
      return
    }

    console.log('DRAG DATA:', data)                            // ตรวจสอบข้อมูล Drag
    console.log('DRAG POINTS:', data?.length)                  // ตรวจสอบจำนวนจุด

    setDragData(data || [])                                   // เก็บข้อมูลสำหรับสร้างกราฟ
    setHasPlotted(true)                                       // แจ้งว่า Query เสร็จแล้ว
    setLoading(false)                                         // หยุด Loading
  }
    const dragChartData = {
    labels: dragData.map((item) =>
      new Date(item.timestamp).toLocaleTimeString('en-GB', {
        timeZone: 'UTC',                                      // แสดงเวลาเป็น UTC
        hour: '2-digit',                                      // แสดงชั่วโมง
        minute: '2-digit'                                     // แสดงนาที
      })
    ),

    datasets: [
  {
    label: 'Swarm-A Drag Force',                        // ชื่อเส้นกราฟ
    data: dragData.map((item) => item.drag_force_n),    // ค่า Drag Force จากฐานข้อมูล

    borderColor: '#0f766e',                             // สีเส้นให้เข้มและอ่านง่าย
    backgroundColor: 'rgba(15, 118, 110, 0.12)',        // สีพื้นจาง ๆ ใต้เส้น
    borderWidth: 3,                                     // ความหนาเส้น
    pointRadius: 2,                                     // ลดขนาดจุด ไม่ให้รก
    pointHoverRadius: 5,                                // ขยายจุดตอนชี้เมาส์
    tension: 0.25,                                      // ทำเส้นให้นุ่มขึ้น
    fill: true                                          // เติมพื้นที่ใต้เส้นเล็กน้อย
  }
]
  }
   const dragChartOptions = {
  responsive: true,                                    // ให้กราฟปรับตามขนาด container
  maintainAspectRatio: false,                          // ให้ใช้ความสูงของกรอบเต็ม

  interaction: {
    mode: 'index',                                     // ชี้จุดแล้วอ่านค่าตามเวลาได้ง่าย
    intersect: false                                   // ไม่ต้องชี้ตรงจุดเป๊ะ ๆ
  },

  plugins: {
    legend: {
      display: true,                                   // แสดงชื่อเส้นกราฟ
      position: 'top'                                  // วาง legend ด้านบน
    },

    tooltip: {
      callbacks: {
        label: (context) =>
          `Drag Force: ${Number(context.raw).toExponential(3)} N` // แสดงค่าตอน hover ให้อ่านง่าย
      }
    }
  },

  scales: {
    x: {
      title: {
        display: true,                                 // แสดงชื่อแกน X
        text: 'Time (UTC)'                             // ชื่อแกนเวลา
      },

      grid: {
        display: false                                 // ซ่อนเส้นตารางแนวตั้ง ลดความรก
      },

      ticks: {
        maxTicksLimit: 12,                             // จำกัดจำนวน label บนแกน X
        maxRotation: 0,                                // ไม่เอียงตัวเลขเวลา
        autoSkip: true                                 // ข้าม label บางตัวอัตโนมัติ
      }
    },

    y: {
      title: {
        display: true,                                 // แสดงชื่อแกน Y
        text: 'Drag Force (N)'                         // หน่วย Drag
      },

      grid: {
        color: '#e5e7eb'                               // ใช้เส้นแนวนอนสีอ่อน
      },

      ticks: {
        callback: (value) => Number(value).toExponential(2) // ย่อเลข เช่น 1.20e-4
      }
    }
  }
}
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Drag Analysis</h1>
          <p>Atmospheric drag calculation parameters</p>
        </div>
      </div>
      <section className="filter-panel">
  <div>
    <label>Date</label>

    <input
      type="date"                                            // เลือกวันที่จากปฏิทิน
      value={date}                                           // วันที่ที่เลือกอยู่
      onChange={(e) => setDate(e.target.value)}              // เปลี่ยนวันที่
      onKeyDown={(e) => e.preventDefault()}               // ป้องกันการพิมพ์วันที่จากคีย์บอร์ด
      onClick={(e) => e.currentTarget.showPicker?.()}     // คลิกช่องแล้วเปิดปฏิทินทันที
    />
  </div>

<div>
  <label>Start Time</label>

  <div className="time-selector">
    <select
      value={startTime.split(':')[0]}                                  // ชั่วโมงที่เลือกอยู่
      onChange={(e) =>
        setStartTime(`${e.target.value}:${startTime.split(':')[1]}`)    // เปลี่ยนเฉพาะชั่วโมง
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
      value={startTime.split(':')[1]}                                  // นาทีที่เลือกอยู่
      onChange={(e) =>
        setStartTime(`${startTime.split(':')[0]}:${e.target.value}`)    // เปลี่ยนเฉพาะนาที
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

  <div>
  <label>End Time</label>

  <div className="time-selector">
    <select
      value={endTime.split(':')[0]}                                    // ชั่วโมงสิ้นสุดที่เลือกอยู่
      onChange={(e) =>
        setEndTime(`${e.target.value}:${endTime.split(':')[1]}`)        // เปลี่ยนเฉพาะชั่วโมง
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
      value={endTime.split(':')[1]}                                    // นาทีสิ้นสุดที่เลือกอยู่
      onChange={(e) =>
        setEndTime(`${endTime.split(':')[0]}:${e.target.value}`)        // เปลี่ยนเฉพาะนาที
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

  <div>
    <label>&nbsp;</label>

    <button
      className="plot-button"                                // ใช้ CSS ปุ่มเดิม
      type="button"                                          // ปุ่มทั่วไป
      onClick={handlePlot}                                   // กดแล้ว Query ข้อมูล
      disabled={loading}                                     // กันกดซ้ำขณะโหลด
    >
      {loading ? 'Loading...' : 'Plot Data'}                 {/* เปลี่ยนข้อความขณะโหลด */}
    </button>
  </div>
</section>  
      <section className="drag-layout">
        <div className="analysis-card">
          <h2>Calculation Inputs</h2>

          <div className="parameter-row">
            <span>Density</span>
            <strong>
              {result?.density_kg_m3
                ? Number(result.density_kg_m3).toExponential(3)
                : 'N/A'}{' '}
              kg/m³
            </strong>
          </div>

          <div className="parameter-row">
            <span>Drag Coefficient (Cd)</span>
            <strong>{result?.cd ?? 'N/A'}</strong>
          </div>

          <div className="parameter-row">
            <span>Area</span>
            <strong>{result?.area_m2 ?? 'N/A'} m²</strong>
          </div>

          <div className="parameter-row">
            <span>Mass</span>
            <strong>{result?.mass_kg ?? 'N/A'} kg</strong>
          </div>

          <div className="parameter-row">
            <span>Relative Velocity</span>
            <strong>
              {result?.velocity_relative_m_s ?? 'N/A'} m/s
            </strong>
          </div>
        </div>

        <div className="analysis-card result-card">
          <h2>Drag Force</h2>

          <div className="large-result">
            {result?.drag_force_n
              ? Number(result.drag_force_n).toExponential(3)
              : 'N/A'}
          </div>

          <p>N</p>

          <div className="formula">
            F<sub>D</sub> = ½ ρ C<sub>D</sub> A V²
          </div>
        </div>
      </section>

      <section className="graph-box full-width">
        <div className="graph-header">
          <h2>Drag Force Analysis</h2>
          <span>Waiting for Python Results</span>
        </div>

<div className="analysis-graph-placeholder">
  {error ? (
    <div className="graph-waiting">
      <strong>Unable to load data</strong>
      <span>{error}</span>
    </div>
  ) : hasPlotted && dragData.length > 0 ? (
    <div className="density-chart-container">
      <Line
        data={dragChartData}                                 // ส่งข้อมูล Drag เข้า Chart.js
        options={dragChartOptions}                           // ส่งการตั้งค่ากราฟ
      />
    </div>
  ) : hasPlotted ? (
    <div className="graph-waiting">
      <strong>No drag data found</strong>
      <span>No data available for the selected period.</span>
    </div>
  ) : (
    <div className="graph-waiting">
      <strong>Select date and time, then click Plot Data</strong>
      <span>Satellite Drag Force will appear here.</span>
    </div>
  )}
</div>
      </section>
    </>
  )
}

export default DragAnalysis