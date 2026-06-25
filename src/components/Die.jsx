const PIP_MAP = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
}

export default function Die({ value, delay = 0, size = 'md' }) {
  const active = new Set(PIP_MAP[value] || [])
  const sizeClass = size === 'sm' ? 'die-sm' : size === 'lg' ? 'die-lg' : ''
  return (
    <div className={`die ${sizeClass}`} style={{ animationDelay: `${delay}ms` }}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={active.has(i + 1) ? 'pip' : ''} />
      ))}
    </div>
  )
}
