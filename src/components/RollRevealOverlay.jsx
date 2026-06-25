import { useEffect, useState } from 'react'
import Die from './Die'

const SPIN_MS = 700

export default function RollRevealOverlay({ rolledData, profiles, onClose }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [spinning, setSpinning] = useState(true)
  const [liveDice, setLiveDice] = useState([])

  const participants = (rolledData?.participants || []).filter((p) => p.ready)
  const diceCount = rolledData?.rollNight?.dice_count || 0
  const current = participants[stepIndex]

  function name(id) {
    return profiles.find((p) => p.id === id)?.username || 'Someone'
  }

  useEffect(() => {
    if (!current || diceCount === 0) return

    setSpinning(true)
    setLiveDice(Array.from({ length: diceCount }, () => 1 + Math.floor(Math.random() * 6)))

    const spinInterval = setInterval(() => {
      setLiveDice(Array.from({ length: diceCount }, () => 1 + Math.floor(Math.random() * 6)))
    }, 80)

    const settleTimeout = setTimeout(() => {
      clearInterval(spinInterval)
      setLiveDice(current.dice_results || [])
      setSpinning(false)
    }, SPIN_MS)

    return () => {
      clearInterval(spinInterval)
      clearTimeout(settleTimeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, current?.id, diceCount])

  if (!current) {
    return (
      <div className="overlay">
        <div className="overlay-card">
          <h2>Nobody was ready tonight</h2>
          <p className="card-note">No allowances were set for tomorrow.</p>
          <button className="btn btn-primary btn-block" onClick={onClose} style={{ marginTop: 16 }}>
            Close
          </button>
        </div>
      </div>
    )
  }

  const isLast = stepIndex >= participants.length - 1

  function next() {
    if (isLast) {
      onClose()
    } else {
      setStepIndex(stepIndex + 1)
    }
  }

  return (
    <div className="overlay">
      <div className="overlay-card">
        <p className="card-eyebrow">
          Tonight's roll · {stepIndex + 1} / {participants.length}
        </p>
        <h2>{name(current.user_id)}</h2>

        <div className="dice-row" style={{ justifyContent: 'center', margin: '20px 0' }}>
          {liveDice.map((v, i) => (
            <Die key={i} value={v} delay={i * 60} />
          ))}
        </div>

        {!spinning && (
          <div className="dice-total" style={{ textAlign: 'center' }}>
            {current.dice_total}
          </div>
        )}

        <button
          className="btn btn-primary btn-block"
          disabled={spinning}
          onClick={next}
          style={{ marginTop: 20 }}
        >
          {spinning ? 'Rolling…' : isLast ? 'Done' : 'Next person'}
        </button>
      </div>
    </div>
  )
}
