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
function Dashboard({
  result,
  densitySeries,
  selectedDate,
  setSelectedDate
}) {
    console.log('DASHBOARD SERIES:', densitySeries)
    const densityChartData = {
  labels: densitySeries.map((item) =>
    new Date(item.timestamp).toLocaleTimeString()
  ),
  datasets: [
    {
      label: 'Density (kg/m³)',
      data: densitySeries.map((item) => item.density_kg_m3),
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.2
    }
  ]
}

const densityChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true
    },
    title: {
      display: false
    }
  },
  scales: {
    x: {
      title: {
        display: true,
        text: 'Time'
      }
    },
    y: {
      title: {
        display: true,
        text: 'Density (kg/m³)'
      }
    }
  }
}
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Thermospheric Density Overview</p>
        </div>
      </div>

      <section className="filter-panel">
        <div>
          <label>Satellite</label>
          <select>
            <option>Swarm-A</option>
          </select>
        </div>

        <div>
          <label>Model</label>
          <select>
            <option>{result?.model_name || 'JB2008'}</option>
          </select>
        </div>

        <div>
          <label>Altitude</label>
          <input
            value={result?.altitude_km ?? ''}
            readOnly
          />
        </div>

       <div>
  <label>Date</label>

  <input
    type="date"                                        // ใช้ช่องเลือกวันที่แบบปฏิทินของ Browser
    value={selectedDate}                               // แสดงวันที่ที่เลือกอยู่ในปัจจุบัน
    onChange={(e) => setSelectedDate(e.target.value)}  // เมื่อกดเลือกวันใหม่ ให้เก็บวันนั้นลง selectedDate
    onKeyDown={(e) => e.preventDefault()}              // ป้องกันไม่ให้ผู้ใช้พิมพ์วันที่จาก Keyboard
    onClick={(e) => e.currentTarget.showPicker?.()}     // เมื่อคลิกช่อง ให้เปิดปฏิทินขึ้นมาทันที
  />
</div>
      </section>

      <section className="cards">
        <div className="card">
          <p className="card-title">Density</p>

          <div className="value">
            {result?.density_kg_m3 !== undefined
              ? Number(result.density_kg_m3).toExponential(3)
              : 'N/A'}
          </div>

          <span>kg/m³</span>
        </div>

        <div className="card">
          <p className="card-title">Altitude</p>

          <div className="value">
            {result?.altitude_km ?? 'N/A'}
          </div>

          <span>km</span>
        </div>

        <div className="card">
          <p className="card-title">F10.7</p>

          <div className="value">
            {result?.f107_observed ?? 'N/A'}
          </div>

          <span>sfu</span>
        </div>

        <div className="card">
          <p className="card-title">Model</p>

          <div className="model-value">
            {result?.model_name || 'Unknown'}
          </div>

          <span>Atmospheric Model</span>
        </div>
      </section>

      <section className="details">
        <h2>Satellite Information</h2>

        <div className="detail-grid">
          <p>
            <strong>Satellite:</strong> Swarm-A
          </p>

          <p>
            <strong>Orbit:</strong> Low Earth Orbit (LEO)
          </p>

          <p>
            <strong>Altitude:</strong> {result?.altitude_km ?? 'N/A'} km
          </p>

          <p>
            <strong>Latitude:</strong> {result?.latitude ?? 'N/A'}°
          </p>

          <p>
            <strong>Longitude:</strong> {result?.longitude ?? 'N/A'}°
          </p>

          <p>
            <strong>Local Solar Time:</strong>{' '}
            {result?.local_solar_time ?? 'N/A'}
          </p>
        </div>
      </section>

      <section className="graph-grid">
       <div className="graph-box">
  <div className="graph-header">
    <h2>Density vs Time</h2>
    <span>{densitySeries.length} points</span>
  </div>

  <div style={{ height: '260px', marginTop: '20px' }}>
    <Line
      data={densityChartData}
      options={densityChartOptions}
    />
  </div>
</div>

<div className="graph-box">
  <div className="graph-header">
    <h2>Satellite Drag vs Time</h2>                   {/* ชื่อกราฟแรงต้านของดาวเทียม */}
    <span>Waiting for Drag Data</span>                {/* แจ้งว่ายังรอข้อมูล Drag จริง */}
  </div>

  <div className="graph-placeholder">
    Satellite Drag vs Time graph will be displayed here  {/* พื้นที่สำหรับกราฟ Drag ในขั้นต่อไป */}
  </div>
</div>
      </section>

      <section className="details">
        <h2>Latest Density Result</h2>

        <div className="detail-grid">
          <p>
            <strong>Time:</strong> {result?.timestamp || 'N/A'}
          </p>

          <p>
            <strong>Model:</strong> {result?.model_name || 'Unknown'}
          </p>

          <p>
            <strong>Density:</strong>{' '}
            {result?.density_kg_m3 !== undefined
              ? `${Number(result.density_kg_m3).toExponential(3)} kg/m³`
              : 'N/A'}
          </p>

          <p>
            <strong>F10.7 Observed:</strong>{' '}
            {result?.f107_observed ?? 'N/A'} sfu
          </p>

          <p>
            <strong>F10.7 Adjusted:</strong>{' '}
            {result?.f107_adjusted ?? 'N/A'} sfu
          </p>

          <p>
            <strong>Ap:</strong> {result?.ap ?? 'N/A'}
          </p>

          <p>
            <strong>Validity Flag:</strong>{' '}
            {result?.validity_flag ?? 'N/A'}
          </p>
        </div>
      </section>
    </>
  )
}

export default Dashboard