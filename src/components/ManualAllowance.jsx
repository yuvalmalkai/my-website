import { useState } from 'react'

export default function ManualAllowance({ currentValue, onSet }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  if (!editing) {
    return (
      <button
        className="btn btn-ghost btn-block"
        onClick={() => {
          setValue(currentValue != null ? String(currentValue) : '')
          setEditing(true)
        }}
      >
        {currentValue == null ? "Set today's number by hand" : 'Edit by hand'}
      </button>
    )
  }

  return (
    <div className="manual-edit-row">
      <input
        type="number"
        min="0"
        inputMode="numeric"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
      />
      <button
        className="btn btn-primary"
        disabled={saving}
        onClick={async () => {
          const n = parseInt(value, 10)
          if (Number.isNaN(n) || n < 0) return
          setSaving(true)
          await onSet(n)
          setSaving(false)
          setEditing(false)
        }}
      >
        Save
      </button>
      <button className="btn btn-ghost" onClick={() => setEditing(false)}>
        Cancel
      </button>
    </div>
  )
}
