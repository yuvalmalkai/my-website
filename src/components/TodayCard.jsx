import { useState } from 'react'
import Die from './Die'
import ManualAllowance from './ManualAllowance'
import SmokedAnimation from './SmokedAnimation'

export default function TodayCard({ myEntry, myCount, diceResults, actions }) {
  const [showSmoke, setShowSmoke] = useState(false)

  function handleSmoked() {
    actions.logCigarette()
    setShowSmoke(true)
  }

  if (!myEntry) {
    return (
      <section className="card">
        <p className="card-eyebrow">Today</p>
        <h2>No allowance yet</h2>
        <p className="card-note">
          You weren't part of last night's roll, so there's no number set for today. Mark
          yourself ready below before 7pm tonight to get tomorrow's allowance - or set one by
          hand for today.
        </p>
        <div style={{ marginTop: 14 }}>
          <ManualAllowance currentValue={null} onSet={actions.setManualAllowance} />
        </div>
      </section>
    )
  }

  const count = myCount || 0
  const overByCount = count > myEntry.dice_total
  const exceeded = myEntry.manually_exceeded || overByCount

  return (
    <section className="card">
      <p className="card-eyebrow">Today's allowance</p>

      {diceResults && diceResults.length > 0 && (
        <div className="dice-row" style={{ marginBottom: 10 }}>
          {diceResults.map((v, i) => (
            <Die key={i} value={v} delay={i * 80} />
          ))}
        </div>
      )}

      <div className="dice-total">{myEntry.dice_total}</div>
      <p className="card-note" style={{ marginTop: 0 }}>
        cigarettes allowed today
      </p>

      <div className="counter-row">
        <span className="counter-value">{count}</span>
        <span className="counter-of">smoked so far</span>
      </div>

      <span className={`status-pill ${exceeded ? 'over' : 'ok'}`}>
        {exceeded ? '⚠ over the limit' : '✓ on track'}
      </span>

      <div className="btn-row" style={{ marginTop: 16 }}>
        <button className="btn btn-primary" onClick={handleSmoked}>
          + Smoked one
        </button>
        <button className="icon-btn" title="Undo last cigarette" onClick={actions.undoLastCigarette}>
          ↺
        </button>
      </div>

      <button
        className={`btn btn-block ${myEntry.manually_exceeded ? 'btn-danger' : 'btn-ghost'}`}
        style={{ marginTop: 10 }}
        onClick={() => actions.setExceeded(!myEntry.manually_exceeded)}
      >
        {myEntry.manually_exceeded ? '✕ Clear "went over" flag' : 'Flag today as "went over"'}
      </button>

      <div style={{ marginTop: 10 }}>
        <ManualAllowance currentValue={myEntry.dice_total} onSet={actions.setManualAllowance} />
      </div>

      {overByCount && !myEntry.manually_exceeded && (
        <p className="card-note">Your logged cigarettes already passed today's limit.</p>
      )}

      {showSmoke && <SmokedAnimation onDone={() => setShowSmoke(false)} />}
    </section>
  )
}
