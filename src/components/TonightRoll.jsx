import { useEffect, useState } from 'react'
import { isPast7pm } from '../lib/time'

export default function TonightRoll({ rollNight, participants, profiles, userId, actions }) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  const past7pm = isPast7pm(now)
  const status = rollNight?.status || 'collecting'
  const diceCount = rollNight?.dice_count || null
  const myParticipant = participants.find((p) => p.user_id === userId)
  const isReady = myParticipant?.ready || false
  const readyCount = participants.filter((p) => p.ready).length

  function profileName(id) {
    return profiles.find((p) => p.id === id)?.username || 'Someone'
  }

  if (status === 'rolled') {
    return (
      <section className="card">
        <p className="card-eyebrow">Tonight's roll · done</p>
        <h2>Tomorrow is set</h2>
        <div className="ready-list">
          {participants
            .filter((p) => p.ready)
            .map((p) => (
              <span key={p.id} className="ready-chip is-ready">
                {profileName(p.user_id)} → {p.dice_total}
              </span>
            ))}
        </div>
        <button className="btn btn-ghost btn-block" onClick={actions.redoRoll}>
          Redo tonight's roll
        </button>
        <p className="card-note">
          This clears everyone's allowance and lets you roll again. It's blocked automatically
          the moment anyone logs a cigarette against it.
        </p>
      </section>
    )
  }

  return (
    <section className="card">
      <p className="card-eyebrow">Tonight's roll</p>
      <h2>How many dice tonight?</h2>
      <div className="dice-count-picker">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={diceCount === n ? 'active' : ''}
            onClick={() => actions.setDiceCount(n)}
          >
            {n}
          </button>
        ))}
      </div>

      <p className="card-note">
        {readyCount} {readyCount === 1 ? 'person' : 'people'} ready
        {diceCount ? ` · ${diceCount} ${diceCount === 1 ? 'die' : 'dice'} each` : ' · pick a dice count first'}
      </p>

      <div className="ready-list">
        {participants.map((p) => (
          <span key={p.id} className={`ready-chip ${p.ready ? 'is-ready' : ''}`}>
            {profileName(p.user_id)}
          </span>
        ))}
      </div>

      <button
        className={`btn btn-block ${isReady ? 'btn-secondary' : 'btn-primary'}`}
        onClick={isReady ? actions.unmarkReady : actions.markReady}
      >
        {isReady ? "I'm not ready after all" : "I'm ready to roll"}
      </button>

      <button
        className="btn btn-primary btn-block"
        style={{ marginTop: 10 }}
        disabled={!past7pm || !diceCount || readyCount === 0}
        onClick={actions.rollTonight}
      >
        {past7pm ? 'Roll the dice' : 'Rolling opens at 7pm'}
      </button>
    </section>
  )
}
