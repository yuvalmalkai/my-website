import { useEffect, useState } from 'react'
import Die from './Die'

const SPIN_MS = 1400
const SETTLE_MS = 900
const SETTLE_MS_ON_ONE = 2000

const ONE_CAPTIONS = ['😬 Wow… tough day tomorrow', '😅 Rough one coming up', '💀 Ouch. Good luck with that one']

export default function RollRevealOverlay({ rolledData, profiles, onClose }) {
  const participants = (rolledData?.participants || []).filter((p) => p.ready)
  const diceCount = rolledData?.rollNight?.dice_count || 0
  const n = participants.length
  const totalSteps = n * diceCount

  const [stepIndex, setStepIndex] = useState(0)
  const [phase, setPhase] = useState('spinning') // 'spinning' | 'settled' | 'done'
  const [spinValue, setSpinValue] = useState(1)
  const [caption, setCaption] = useState(null)

  const round = n > 0 ? Math.floor(stepIndex / n) : 0
  const participantIndex = n > 0 ? stepIndex % n : 0
  const currentParticipant = participants[participantIndex]
  const currentValue = currentParticipant?.dice_results?.[round]

  function name(id) {
    return profiles.find((p) => p.id === id)?.username || 'Someone'
  }

  useEffect(() => {
    if (!currentParticipant || n === 0 || diceCount === 0) return

    setPhase('spinning')
    setCaption(null)

    const spinInterval = setInterval(() => {
      setSpinValue(1 + Math.floor(Math.random() * 6))
    }, 90)

    const settleTimeout = setTimeout(() => {
      clearInterval(spinInterval)
      setSpinValue(currentValue)
      setPhase('settled')

      if (currentValue === 1) {
        setCaption(ONE_CAPTIONS[Math.floor(Math.random() * ONE_CAPTIONS.length)])
      }

      const pause = currentValue === 1 ? SETTLE_MS_ON_ONE : SETTLE_MS
      const advanceTimeout = setTimeout(() => {
        setStepIndex((i) => {
          if (i + 1 >= totalSteps) {
            setPhase('done')
            return i
          }
          return i + 1
        })
      }, pause)

      return () => clearTimeout(advanceTimeout)
    }, SPIN_MS)

    return () => {
      clearInterval(spinInterval)
      clearTimeout(settleTimeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex])

  if (n === 0 || diceCount === 0) {
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

  function dieStatus(pi, r) {
    if (phase === 'done') return 'revealed'
    if (r < round) return 'revealed'
    if (r > round) return 'pending'
    if (pi < participantIndex) return 'revealed'
    if (pi > participantIndex) return 'pending'
    return phase === 'settled' ? 'revealed' : 'active'
  }

  return (
    <div className="overlay">
      <div className="overlay-card overlay-card-wide">
        {phase !== 'done' ? (
          <>
            <p className="card-eyebrow">
              Round {Math.min(round + 1, diceCount)} of {diceCount}
            </p>
            <h2>{name(currentParticipant.user_id)}</h2>
            <div
              className={`dice-row roll-spotlight ${caption ? 'dramatic' : ''}`}
              style={{ justifyContent: 'center', margin: '18px 0 6px' }}
            >
              <Die value={spinValue} size="lg" />
            </div>
            <p className="roll-caption">{caption || '\u00A0'}</p>
          </>
        ) : (
          <>
            <p className="card-eyebrow">Tonight's roll · done</p>
            <h2>Tomorrow is set</h2>
          </>
        )}

        <div className="roll-scoreboard">
          {participants.map((p, pi) => (
            <div key={p.id} className={`roll-score-row ${pi === participantIndex && phase !== 'done' ? 'is-current' : ''}`}>
              <span className="roll-score-name">{name(p.user_id)}</span>
              <div className="roll-score-dice">
                {Array.from({ length: diceCount }, (_, r) => {
                  const status = dieStatus(pi, r)
                  const value =
                    status === 'active' ? spinValue : status === 'revealed' ? p.dice_results?.[r] : undefined
                  return <Die key={r} value={value} size="sm" />
                })}
              </div>
              {phase === 'done' && <span className="roll-score-total">{p.dice_total}</span>}
            </div>
          ))}
        </div>

        {phase === 'done' ? (
          <button className="btn btn-primary btn-block" onClick={onClose} style={{ marginTop: 18 }}>
            Done
          </button>
        ) : (
          <button
            className="btn btn-ghost btn-block"
            style={{ marginTop: 18 }}
            onClick={() => {
              setStepIndex(totalSteps - 1)
              setPhase('done')
            }}
          >
            Skip ▶
          </button>
        )}
      </div>
    </div>
  )
}
