function SpaceWeather() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Space Weather</h1>
          <p>Solar and geomagnetic activity parameters</p>
        </div>
      </div>

      <section className="cards">
        <div className="card">
          <h3>F10.7</h3>
          <div className="value">--</div>
          <span>sfu</span>
        </div>

        <div className="card">
          <h3>F10.7A</h3>
          <div className="value">--</div>
          <span>sfu</span>
        </div>

        <div className="card">
          <h3>Ap Index</h3>
          <div className="value">--</div>
          <span>Geomagnetic Activity</span>
        </div>

        <div className="card">
          <h3>Kp Index</h3>
          <div className="value">--</div>
          <span>Geomagnetic Activity</span>
        </div>
      </section>

      <section className="graph-box full-width">
        <div className="graph-header">
          <h2>Space Weather Data</h2>
          <span>Waiting for Data</span>
        </div>

        <div className="graph-placeholder">
          Space weather data will be displayed here
        </div>
      </section>

      <section className="analysis-card">
        <h2>Parameter Information</h2>

        <div className="parameter-row">
          <span>F10.7</span>
          <strong>Solar radio flux at 10.7 cm</strong>
        </div>

        <div className="parameter-row">
          <span>F10.7A</span>
          <strong>81-day average solar flux</strong>
        </div>

        <div className="parameter-row">
          <span>Ap</span>
          <strong>Planetary geomagnetic activity index</strong>
        </div>

        <div className="parameter-row">
          <span>Kp</span>
          <strong>Planetary K-index</strong>
        </div>
      </section>
    </>
  )
}

export default SpaceWeather