export default function FriendsList({ profiles, userId, todayEntries, cigaretteCounts, streaks, presentIds }) {
  const others = profiles.filter((p) => p.id !== userId)

  function entryFor(id) {
    return todayEntries.find((e) => e.user_id === id)
  }

  return (
    <section className="card">
      <p className="card-eyebrow">Friends</p>
      <h2>How's everyone doing</h2>

      {others.length === 0 && <p className="card-note">No one else has joined yet.</p>}

      {others.map((p) => {
        const entry = entryFor(p.id)
        const count = cigaretteCounts[p.id] || 0
        const streak = streaks[p.id] || 0
        const online = presentIds.has(p.id)
        const exceeded = entry && (entry.manually_exceeded || count > entry.dice_total)

        return (
          <div className="friend-row" key={p.id}>
            <span className={`presence-dot ${online ? 'online' : ''}`} />
            <div className="friend-info">
              <div className="friend-name">{p.username}</div>
              <div className="friend-meta">
                {entry ? `${count} / ${entry.dice_total} today` : 'no allowance today'}
                {exceeded ? ' · over' : ''}
              </div>
            </div>
            {streak > 0 && <span className="streak-badge">👑 {streak}</span>}
          </div>
        )
      })}
    </section>
  )
}
