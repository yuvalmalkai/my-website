import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAppData } from '../hooks/useAppData'
import { usePushNotifications } from '../hooks/usePushNotifications'
import TonightRoll from './TonightRoll'
import TodayCard from './TodayCard'
import FriendsList from './FriendsList'
import HistoryView from './HistoryView'
import RollRevealOverlay from './RollRevealOverlay'
import { formatNiceDate } from '../lib/time'

const ALERT_LABELS = {
  idle: '🔔 Enable alerts',
  enabling: 'Enabling…',
  enabled: '🔔 Alerts on',
  denied: '🔕 Permission denied',
  unsupported: '🔕 Not supported here',
  error: '🔕 Something went wrong',
}

export default function Dashboard({ session }) {
  const userId = session.user.id
  const data = useAppData(session)
  const push = usePushNotifications(userId)
  const [tab, setTab] = useState('today')

  if (data.loading) {
    return <p className="loading-text">Loading your group…</p>
  }

  const myDiceResults = data.myParticipant?.dice_results || null

  return (
    <>
      <header className="app-header">
        <div>
          <h1>Quit Buddy</h1>
          <div className="today-date">{formatNiceDate(data.smokingDay)}</div>
        </div>
        <button className="sign-out" onClick={() => supabase.auth.signOut()}>
          sign out
        </button>
      </header>

      <button
        className="btn btn-ghost btn-block"
        style={{ marginBottom: 16 }}
        disabled={push.status === 'enabling' || push.status === 'enabled'}
        onClick={push.enable}
      >
        {ALERT_LABELS[push.status]}
      </button>

      {data.actionError && <p className="error-text">{data.actionError}</p>}

      <nav className="tab-bar">
        <button className={tab === 'today' ? 'active' : ''} onClick={() => setTab('today')}>
          Today
        </button>
        <button className={tab === 'friends' ? 'active' : ''} onClick={() => setTab('friends')}>
          Friends
        </button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
          History
        </button>
      </nav>

      {tab === 'today' && (
        <>
          <TodayCard
            myEntry={data.myEntry}
            myCount={data.cigaretteCounts[userId]}
            diceResults={myDiceResults}
            actions={data.actions}
          />
          <TonightRoll
            rollNight={data.rollNight}
            participants={data.participants}
            profiles={data.profiles}
            userId={userId}
            actions={data.actions}
          />
        </>
      )}

      {tab === 'friends' && (
        <FriendsList
          profiles={data.profiles}
          userId={userId}
          todayEntries={data.todayEntries}
          cigaretteCounts={data.cigaretteCounts}
          streaks={data.streaks}
          presentIds={data.presentIds}
        />
      )}

      {tab === 'history' && <HistoryView profiles={data.profiles} userId={userId} />}

      {data.justRolledNight && (
        <RollRevealOverlay
          rolledData={data.justRolledNight}
          profiles={data.profiles}
          onClose={data.clearJustRolledNight}
        />
      )}
    </>
  )
}
