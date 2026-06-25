import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { formatNiceDate } from '../lib/time'

export default function HistoryView({ profiles, userId }) {
  const [selected, setSelected] = useState(userId)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    supabase
      .from('day_results')
      .select('*')
      .eq('user_id', selected)
      .order('entry_date', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (active) {
          setRows(data || [])
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [selected])

  return (
    <section className="card">
      <p className="card-eyebrow">History</p>
      <h2>Day by day</h2>

      <div className="field">
        <label htmlFor="history-user">Showing</label>
        <select id="history-user" value={selected} onChange={(e) => setSelected(e.target.value)}>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id === userId ? `${p.username} (you)` : p.username}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="card-note">Loading…</p>}
      {!loading && rows.length === 0 && <p className="card-note">No history yet.</p>}

      {rows.map((row) => (
        <div className="history-row" key={row.entry_date}>
          <span>{formatNiceDate(row.entry_date)}</span>
          <span>
            {row.cigarettes_count} / {row.dice_total}
          </span>
          <span className="history-mark">{row.succeeded ? '👑' : '✕'}</span>
        </div>
      ))}
    </section>
  )
}
