import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { israelDateString, smokingDayString } from '../lib/time'

export function useAppData(session) {
  const userId = session.user.id

  const [profiles, setProfiles] = useState([])
  const [rollNight, setRollNight] = useState(null)
  const [participants, setParticipants] = useState([])
  const [todayEntries, setTodayEntries] = useState([])
  const [cigaretteCounts, setCigaretteCounts] = useState({})
  const [streaks, setStreaks] = useState({})
  const [presentIds, setPresentIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState('')
  const [justRolledNight, setJustRolledNight] = useState(null)
  const prevStatusRef = useRef(undefined)

  const smokingDay = smokingDayString()
  const tonightDate = israelDateString()

  const loadAll = useCallback(async () => {
    const [profilesRes, rollNightRes, entriesRes, logsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('username'),
      supabase.from('roll_nights').select('*').eq('roll_date', tonightDate).maybeSingle(),
      supabase.from('daily_entries').select('*').eq('entry_date', smokingDay),
      supabase.from('cigarette_logs').select('user_id').eq('entry_date', smokingDay),
    ])

    if (profilesRes.data) setProfiles(profilesRes.data)
    if (entriesRes.data) setTodayEntries(entriesRes.data)

    const counts = {}
    ;(logsRes.data || []).forEach((row) => {
      counts[row.user_id] = (counts[row.user_id] || 0) + 1
    })
    setCigaretteCounts(counts)

    const night = rollNightRes.data || null
    setRollNight(night)

    if (night) {
      const partsRes = await supabase
        .from('roll_participants')
        .select('*')
        .eq('roll_night_id', night.id)
      setParticipants(partsRes.data || [])
    } else {
      setParticipants([])
    }

    if (profilesRes.data) {
      const streakResults = await Promise.all(
        profilesRes.data.map((p) =>
          supabase.rpc('get_current_streak', { p_user_id: p.id }).then((r) => [p.id, r.data ?? 0])
        )
      )
      setStreaks(Object.fromEntries(streakResults))
    }

    setLoading(false)
  }, [smokingDay, tonightDate])

  useEffect(() => {
    loadAll()

    const channel = supabase
      .channel('quit-buddy-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'roll_nights' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'roll_participants' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_entries' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cigarette_logs' }, loadAll)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadAll])

  // Presence: who has the app open right now.
  useEffect(() => {
    const presenceChannel = supabase.channel('quit-buddy-presence', {
      config: { presence: { key: userId } },
    })

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState()
        setPresentIds(new Set(Object.keys(state)))
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          presenceChannel.track({ online_at: new Date().toISOString() })
        }
      })

    return () => {
      supabase.removeChannel(presenceChannel)
    }
  }, [userId])

  // Detect the live moment a roll flips from "collecting" to "rolled",
  // so we can show the reveal animation to everyone watching right now.
  useEffect(() => {
    if (rollNight) {
      if (prevStatusRef.current === 'collecting' && rollNight.status === 'rolled') {
        setJustRolledNight({ rollNight, participants })
      }
      prevStatusRef.current = rollNight.status
    }
  }, [rollNight, participants])

  async function runAction(fn) {
    setActionError('')
    const { error } = await fn()
    if (error) {
      setActionError(error.message)
      return false
    }
    await loadAll()
    return true
  }

  const actions = {
    setDiceCount: (count) => runAction(() => supabase.rpc('set_dice_count', { p_dice_count: count })),
    markReady: () => runAction(() => supabase.rpc('mark_ready')),
    unmarkReady: () => runAction(() => supabase.rpc('unmark_ready')),
    rollTonight: () => runAction(() => supabase.rpc('roll_tonight')),
    redoRoll: () => runAction(() => supabase.rpc('redo_tonights_roll')),
    logCigarette: () => runAction(() => supabase.rpc('log_cigarette')),
    undoLastCigarette: () => runAction(() => supabase.rpc('undo_last_cigarette')),
    setExceeded: (value) => runAction(() => supabase.rpc('set_exceeded_flag', { p_value: value })),
    setManualAllowance: (value) => runAction(() => supabase.rpc('set_manual_allowance', { p_value: value })),
  }

  const myEntry = todayEntries.find((e) => e.user_id === userId) || null
  const myParticipant = participants.find((p) => p.user_id === userId) || null

  return {
    loading,
    actionError,
    smokingDay,
    tonightDate,
    profiles,
    rollNight,
    participants,
    todayEntries,
    cigaretteCounts,
    streaks,
    presentIds,
    myEntry,
    myParticipant,
    justRolledNight,
    clearJustRolledNight: () => setJustRolledNight(null),
    actions,
  }
}
