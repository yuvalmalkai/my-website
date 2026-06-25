const TZ = 'Asia/Jerusalem'

function israelParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]))
  return parts
}

export function israelHour(date = new Date()) {
  return Number(israelParts(date).hour)
}

export function israelDateString(date = new Date()) {
  const p = israelParts(date)
  return `${p.year}-${p.month}-${p.day}`
}

// The "smoking day" runs 7am -> 7am Israel time, not midnight -> midnight.
// Mirrors the get_smoking_day() Postgres function - this copy is just for
// instant UI feedback; the server is always the source of truth.
export function smokingDayString(date = new Date()) {
  const hour = israelHour(date)
  if (hour >= 7) {
    return israelDateString(date)
  }
  const yesterday = new Date(date.getTime() - 24 * 60 * 60 * 1000)
  return israelDateString(yesterday)
}

export function isPast7pm(date = new Date()) {
  return israelHour(date) >= 19
}

export function formatNiceDate(dateString) {
  const d = new Date(`${dateString}T12:00:00`)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}
