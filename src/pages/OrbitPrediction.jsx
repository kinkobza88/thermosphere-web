import { useState } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

const API_URL = 'http://127.0.0.1:8000/api/orbit-prediction/run'
const COMPARE_API_URL = 'http://127.0.0.1:8000/api/orbit-prediction/compare'
const DEFAULT_INPUTS = {
  satellite_name: 'Custom satellite',
  mass_kg: 1,
  area_m2: 1,
  cd: 2.2,
  dria_cd: null,
  epoch_utc: '2026-10-20T00:00:00Z',
  semi_major_axis_km: 7000,
  eccentricity: 0.001,
  inclination_deg: 51.6,
  raan_deg: 0,
  arg_perigee_deg: 0,
  true_anomaly_deg: 0,
  f107: 150,
  f107a: 150,
  ap: 10,
  duration_days: 7,
  output_step_minutes: 10,
  reentry_altitude_km: 120,
  include_j2: true,
    
  include_j2: true,

  solar_storm: {
    enabled: true,
    start_utc: '2026-10-22T00:00:00Z',
    end_utc: '2026-10-23T00:00:00Z',
    storm_f107: 250,
    storm_ap: 100
  }
}


const fields = [
  ['satellite_name', 'Satellite name', 'text'],
  ['mass_kg', 'Mass (kg)', 'number'],
  ['area_m2', 'Projected area (m²)', 'number'],
  ['cd', 'Drag coefficient (Cd)', 'number'],
  ['epoch_utc', 'Epoch (UTC, ISO-8601)', 'text'],
  ['semi_major_axis_km', 'Semi-major axis (km)', 'number'],
  ['eccentricity', 'Eccentricity', 'number'],
  ['inclination_deg', 'Inclination (deg)', 'number'],
  ['raan_deg', 'RAAN (deg)', 'number'],
  ['arg_perigee_deg', 'Argument of perigee (deg)', 'number'],
  ['true_anomaly_deg', 'True anomaly (deg)', 'number'],
  ['duration_days', 'Simulation duration (days, 1–30)', 'number'],
  ['output_step_minutes', 'Output step (minutes)', 'number'],
  ['reentry_altitude_km', 'Reentry threshold (km)', 'number']
]

function numberText(value, decimals = 3) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(decimals) : 'N/A'
}
function utcToDateTimeLocal(value) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toISOString().slice(0, 16);
}

function dateTimeLocalToUtc(value) {
  if (!value) return '';

  const date = new Date(`${value}Z`);
  if (Number.isNaN(date.getTime())) return '';

  return date.toISOString();
}

function prepareOrbitPayload(inputs) {
  if (!inputs.dria_cd?.enabled) {
    return {
      ...inputs,
      dria_cd: null
    }
  }

  const surfaceText = String(
    inputs.dria_cd.surface_temperature_K ?? ''
  ).trim()

  const accommodationText = String(
    inputs.dria_cd.energy_accommodation_coefficient ?? ''
  ).trim()

  if (surfaceText === '' || accommodationText === '') {
    throw new Error(
      'Please enter Surface Temperature and Energy Accommodation Coefficient.'
    )
  }

  const surfaceTemperature = Number(surfaceText)
  const accommodation = Number(accommodationText)

  if (
    !Number.isFinite(surfaceTemperature) ||
    surfaceTemperature <= 0 ||
    surfaceTemperature > 5000
  ) {
    throw new Error('Surface Temperature must be greater than 0 and at most 5000 K.')
  }

  if (
    !Number.isFinite(accommodation) ||
    accommodation < 0 ||
    accommodation > 1
  ) {
    throw new Error('Energy Accommodation Coefficient must be between 0 and 1.')
  }

  return {
    ...inputs,
    dria_cd: {
      enabled: true,
      surface_temperature_K: surfaceTemperature,
      energy_accommodation_coefficient: accommodation
    }
  }
}

function OrbitPrediction() {
  const [inputs, setInputs] = useState(DEFAULT_INPUTS)
  const [result, setResult] = useState(null)
  const [comparisonResult, setComparisonResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function updateField(key, value, type) {
    setInputs(current => ({
      ...current,
      [key]: type === 'number' ? (value === '' ? '' : Number(value)) : value
    }))
  }

  function updateStormField(key, value, type = 'text') {
    setInputs(current => ({
      ...current,
    solar_storm: {
      ...current.solar_storm,
      [key]: type === 'number'
        ? (value === '' ? '' : Number(value))
        : type === 'checkbox'
          ? Boolean(value)
          : value
    }
  }))
}
async function compareScenarios() {
  if (!inputs.solar_storm?.enabled) {
    setError('Please enable Solar Storm before comparing.')
    return
  }

  setLoading(true)
  setError('')
  setComparisonResult(null)

  try {
    const response = await fetch(COMPARE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(prepareOrbitPayload(inputs))
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(
        typeof data.detail === 'string'
          ? data.detail
          : JSON.stringify(data.detail || 'Comparison failed')
      )
    }

    if (!data.baseline || !data.storm || !data.comparison) {
      throw new Error('Invalid comparison response from backend')
    }

    setComparisonResult(data)
    setResult(null)
  } catch (err) {
    setError(err.message || 'Could not compare scenarios')
  } finally {
    setLoading(false)
  }
}
  async function runPrediction(event) {
    event.preventDefault()
    setLoading(true)
    setComparisonResult(null)
    setError('')
    setResult(null)

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputs)
      })
      const body = await response.json()
      if (!response.ok) {
        const detail = body.detail
        const details = Array.isArray(detail)
          ? detail.map(item => `${(item.loc || []).join('.')}: ${item.msg}`).join('; ')
          : typeof detail === 'string' ? detail : JSON.stringify(detail)
        throw new Error(details || `API returned ${response.status}`)
      }
      if (!Array.isArray(body.points) || !body.summary) {
        throw new Error('Backend response does not contain points and summary')
      }
      setResult(body)
    } catch (err) {
      setError(err.message || 'Could not run prediction')
    } finally {
      setLoading(false)
    }
  }

  function makeChart(field, title, color) {
    const points = result?.points || []
    return {
      data: {
        labels: points.map(point => point.timestamp_utc),
        datasets: [{
          label: title,
          data: points.map(point => point[field]),
          borderColor: color,
          backgroundColor: color,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: true }, tooltip: { mode: 'index' } },
        scales: {
          x: { ticks: { maxTicksLimit: 7, callback(value) {
            const label = this.getLabelForValue(value)
            return label ? label.replace('T', ' ').slice(0, 16) : ''
          } } },
          y: { title: { display: true, text: title } }
        }
      }
    }
  }
  function makeComparisonChart(field, title) {
  const baselinePoints = comparisonResult?.baseline?.points || []
  const stormPoints = comparisonResult?.storm?.points || []

  const labels = baselinePoints.map(point => point.timestamp_utc)

  const stormByTime = new Map(
    stormPoints.map(point => [point.timestamp_utc, point[field]])
  )

  return {
    data: {
      labels,
      datasets: [
        {
          label: 'Baseline',
          data: baselinePoints.map(point => point[field]),
          borderColor: '#2563eb',
          backgroundColor: '#2563eb',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.1
        },
        {
          label: 'Solar Storm',
          data: labels.map(time => stormByTime.get(time) ?? null),
          borderColor: '#dc2626',
          backgroundColor: '#dc2626',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.1
        }
      ]
    },
    options: {
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
          type: 'category',
          ticks: {
            maxTicksLimit: 8
          }
        },
        y: {
        title: {
          display: true,
          text: title
         },
        ticks: {
        callback: function(value) {
        if (field === 'density_kg_m3' || field === 'drag_force_n') {
        return Number(value).toExponential(2)
        }
        return Number(value).toFixed(1)
    }
  }
}
      }
    }
  }
}

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Orbit Prediction</h1>
          <p>Satellite orbit decay and atmospheric drag prediction</p>
        </div>
      </div>

      <section className="analysis-card" style={{ marginBottom: 24 }}>
        <h2>Simulation inputs</h2>
        <p>Enter a future orbit scenario. Semi-major axis is measured from Earth's center, not altitude.</p>
        <form onSubmit={runPrediction}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16, marginTop: 16 }}>
            <div style={{ marginBottom: 16 }}>
  <label htmlFor="cd-mode-select">
    Drag Coefficient Model
  </label>

  <select
    id="cd-mode-select"
    value={inputs.dria_cd?.enabled ? 'dynamic_dria' : 'manual'}
    onChange={(e) => {
      const mode = e.target.value

      setInputs((current) => ({
        ...current,
        dria_cd:
          mode === 'manual'
            ? null
            : {
                enabled: true,
                surface_temperature_K: '',
                energy_accommodation_coefficient: ''
              }
      }))
    }}
    style={{
      display: 'block',
      width: '100%',
      padding: 10,
      marginTop: 6
    }}
  >
    <option value="manual">Manual Cd</option>
    <option value="dynamic_dria">Dynamic DRIA Cd</option>
  </select>
</div>
{inputs.dria_cd?.enabled && (
  <div style={{ marginBottom: 16 }}>
    <label>
      Surface Temperature (K)
      <input
        type="number"
        min="0.01"
        max="5000"
        step="any"
        required
        value={inputs.dria_cd.surface_temperature_K}
        onChange={(e) =>
          setInputs((current) => ({
            ...current,
            dria_cd: {
              ...current.dria_cd,
              surface_temperature_K: e.target.value
            }
          }))
        }
        style={{
          display: 'block',
          width: '100%',
          padding: 10,
          marginTop: 6,
          marginBottom: 12,
          boxSizing: 'border-box'
        }}
      />
    </label>

    <label>
      Energy Accommodation Coefficient (0–1)
      <input
        type="number"
        min="0"
        max="1"
        step="any"
        required
        value={inputs.dria_cd.energy_accommodation_coefficient}
        onChange={(e) =>
          setInputs((current) => ({
            ...current,
            dria_cd: {
              ...current.dria_cd,
              energy_accommodation_coefficient: e.target.value
            }
          }))
        }
        style={{
          display: 'block',
          width: '100%',
          padding: 10,
          marginTop: 6,
          boxSizing: 'border-box'
        }}
      />
    </label>
  </div>
)}
            {fields.map(([key, label, type]) => (
              <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span>{label}</span>
                <input
                  type={key === 'epoch_utc' ? 'datetime-local' : type}
                  step={type === 'number' ? 'any' : undefined}
                  value={
                    key === 'epoch_utc'
                    ? utcToDateTimeLocal(inputs[key])
                    : inputs[key]
                }
                required
                onChange={event =>
                  updateField(
                    key,
                    key === 'epoch_utc'
                      ? dateTimeLocalToUtc(event.target.value)
                      : event.target.value,
                    type
                  )
                }
                onClick={event => {
                  if (key === 'epoch_utc') {
                    event.currentTarget.showPicker?.();
                  }
                }}
                style={{ width: '100%', boxSizing: 'border-box', padding: 9 }}
              />
              </label>
            ))}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={inputs.include_j2} onChange={event => updateField('include_j2', event.target.checked, 'checkbox')} />
              Include J2 perturbation
            </label>
          </div>
          <button
  className="plot-button"
  type="submit"
  disabled={loading}
  style={{ marginTop: 20 }}
>
  {loading ? 'Running prediction...' : 'Run Prediction'}
</button>

<section style={{ marginTop: 24 }}>
  <h2>Solar Storm Scenario</h2>

  <p>
    User-defined solar storm scenario for comparison.
    Values are assumptions, not an operational forecast.
  </p>

  <label style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
    <input
      type="checkbox"
      checked={inputs.solar_storm.enabled}
      onChange={e =>
        updateStormField('enabled', e.target.checked, 'checkbox')
      }
    />
    Enable Solar Storm
  </label>

  {inputs.solar_storm.enabled && (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
      gap: 16
    }}>
      {[
        ['start_utc', 'Storm Start (UTC)', 'datetime-local'],
        ['end_utc', 'Storm End (UTC)', 'datetime-local'],
        ['storm_f107', 'Storm F10.7', 'number'],
        ['storm_ap', 'Storm Ap', 'number']
      ].map(([key, label, type]) => (
        <label
          key={key}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}
        >
          <span>{label}</span>
          <input
  type={type}
  step={type === 'number' ? 'any' : undefined}
  value={
    type === 'datetime-local'
      ? utcToDateTimeLocal(inputs.solar_storm[key])
      : inputs.solar_storm[key]
  }
  required
  onChange={e => {
    updateStormField(
      key,
      type === 'datetime-local'
        ? dateTimeLocalToUtc(e.target.value)
        : e.target.value,
      type
    );
  }}
  onClick={e => {
    if (type === 'datetime-local') {
      e.currentTarget.showPicker?.();
    }
  }}
  style={{
    width: '100%',
    boxSizing: 'border-box',
    padding: 9
  }}
/>
        </label>
      ))}
    </div>
  )}

  <button
    type="button"
    className="plot-button"
    disabled={loading || !inputs.solar_storm.enabled}
    onClick={compareScenarios}
    style={{ marginTop: 20 }}
  >
    {loading
      ? 'Comparing scenarios...'
      : 'Compare Baseline vs Solar Storm'}
  </button>
  
</section>
</form>
</section>

      {error && <section className="details" role="alert"><strong>Prediction error:</strong> {error}</section>}
      {comparisonResult && (
  <section
    className="analysis-card"
    style={{ marginBottom: 24 }}
  >
    <h2>Baseline vs Solar Storm Comparison</h2>
    <p style={{
  marginTop: 12,
  padding: 14,
  borderLeft: '4px solid #d97706',
  backgroundColor: '#fffbeb',
  color: '#78350f',
  borderRadius: 6,
  lineHeight: 1.6
}}>
  <strong>Simulation limitations:</strong>
  {' '}This is a preliminary numerical orbit simulation,
  not a validated operational forecast. Solar storm
  F10.7 and Ap values are user-defined assumptions.
  Atmospheric density is calculated using NRLMSISE-00.
  The model does not include all orbital perturbations
  or uncertainties. If the reentry threshold is not
  reached during the simulation, the total orbital
  lifetime remains undetermined.
</p>

    <p>
      Comparison of two simulations using identical initial
      orbital conditions. Solar storm values are user-defined.
    </p>

    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
        marginTop: 20
      }}
    >
      <div className="summary-card">
        <h3>Baseline Final Altitude</h3>
        <p>
          {comparisonResult.baseline.summary.end_altitude_km.toFixed(3)} km
        </p>
      </div>

      <div className="summary-card">
        <h3>Solar Storm Final Altitude</h3>
        <p>
          {comparisonResult.storm.summary.end_altitude_km.toFixed(3)} km
        </p>
      </div>

      <div className="summary-card">
        <h3>Altitude Difference</h3>
        <p>
          {comparisonResult.comparison.final_altitude_difference_m.toFixed(3)} m
        </p>
      </div>
    </div>
    
    <div style={{ marginTop: 24 }}>
  <h3>Orbit Lifetime / Reentry Threshold Comparison</h3>

  <div style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16,
    marginTop: 16
  }}>
    {[
      ['Baseline', comparisonResult.baseline.lifetime],
      ['Solar Storm', comparisonResult.storm.lifetime]
    ].map(([label, lifetime]) => (
      <div className="summary-card" key={label}>
        <h3>{label}</h3>

        <p>
          {lifetime.threshold_crossed &&
           lifetime.time_to_threshold_days != null
            ? `${Number(lifetime.time_to_threshold_days).toFixed(3)} days`
            : 'Not reached within simulation window'}
        </p>
      </div>
    ))}
  </div>

  <p style={{ marginTop: 12, fontSize: 13 }}>
    If the reentry threshold is not reached, satellite lifetime
    cannot be determined from this simulation window.
  </p>
</div>
    <p style={{ marginTop: 16, fontSize: 13 }}>
      Negative difference means the storm scenario ends at a
      lower altitude than the baseline. These results are
      preliminary simulations, not validated forecasts.
    </p>
    <div style={{ marginTop: 24 }}>
  <h3>Altitude Comparison: Baseline vs Solar Storm</h3>

  <div style={{ height: 350, marginTop: 16 }}>
    <Line
      data={
        makeComparisonChart(
          'altitude_km',
          'Altitude (km)'
        ).data
      }
      options={
        makeComparisonChart(
          'altitude_km',
          'Altitude (km)'
        ).options
      }
    />
  </div>
</div>
<div style={{ marginTop: 32 }}>
  <h3>Atmospheric Density Comparison: Baseline vs Solar Storm</h3>

  <div style={{ height: 350, marginTop: 16 }}>
    <Line
      data={
        makeComparisonChart(
          'density_kg_m3',
          'Atmospheric Density (kg/m³)'
        ).data
      }
      options={
        makeComparisonChart(
          'density_kg_m3',
          'Atmospheric Density (kg/m³)'
        ).options
      }
    />
  </div>
</div>
<div style={{ marginTop: 32 }}>
  <h3>Drag Force Comparison: Baseline vs Solar Storm</h3>

  <div style={{ height: 350, marginTop: 16 }}>
    <Line
      data={
        makeComparisonChart(
          'drag_force_n',
          'Drag Force (N)'
        ).data
      }
      options={
        makeComparisonChart(
          'drag_force_n',
          'Drag Force (N)'
        ).options
      }
    />
  </div>
</div>
<div className="graph-box full-width" style={{ marginBottom: 24 }}>
  <div className="graph-header">
    <h2>Drag Coefficient (Cd) Comparison</h2>
  </div>

  <div style={{ height: 340, padding: 16 }}>
    <Line
      data={
        makeComparisonChart(
          'cd_used',
          'Drag Coefficient (Cd)'
        ).data
      }
      options={
        makeComparisonChart(
          'cd_used',
          'Drag Coefficient (Cd)'
        ).options
      }
    />
  </div>
</div>
  </section>
)}

      {result && (
        <>
          <section className="comparison-summary" style={{ marginBottom: 24 }}>
            <div className="summary-heading"><h2>Prediction Summary</h2></div>
            <div className="summary-grid">
              {[
                ['Cd Model', result.satellite?.cd_mode === 'dynamic_dria' ? 'Dynamic DRIA Cd' : 'Manual Cd'],
                ['Start altitude', `${numberText(result.summary.start_altitude_km)} km`],
                ['End altitude', `${numberText(result.summary.end_altitude_km)} km`],
                ['Altitude change', `${numberText(result.summary.altitude_change_km)} km`],
                ['Maximum drag force', `${Number(result.summary.maximum_drag_force_n).toExponential(3)} N`],
                ['Data points', String(result.points.length)],
                ['Reentry threshold', result.lifetime?.threshold_crossed
                  ? `Reached after ${numberText(result.lifetime.time_to_threshold_days)} days`
                  : 'Not reached in simulation window']
              ].map(([label, value]) => (
                <div className="summary-card" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <p style={{ marginTop: 16 }}>{result.lifetime?.note}</p>
          </section>

          {[
            ['altitude_km', 'Altitude (km)', '#2563eb'],
            ['density_kg_m3', 'Atmospheric density (kg/m³)', '#16a34a'],
            ['drag_force_n', 'Drag force (N)', '#e05252'],
            ['cd_used', 'Drag Coefficient (Cd)', '#9333ea']
          ].map(([key, title, color]) => {
            const chart = makeChart(key, title, color)
            return (
              <section className="graph-box full-width" key={key} style={{ marginBottom: 24 }}>
                <div className="graph-header"><h2>{title}</h2></div>
                <div style={{ height: 340, padding: 16 }}>
                  <Line data={chart.data} options={chart.options} />
                </div>
              </section>
            )
          })}
          <section className="details">
            <h2>Model limitations</h2>
            <p>This is a research prototype, not a validated operational lifetime prediction.</p>
            {(result.warnings || []).map((warning, index) => <p key={index}>{warning}</p>)}
          </section>
        </>
      )}
    </>
  )
}

export default OrbitPrediction
