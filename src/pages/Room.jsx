import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  getRoomByCode, getPlayers, joinRoom, leaveRoom, dealHand, getHand,
  startNextRound, submitCards, getSubmissions, judgeRound, refillHand,
  setRoomPhase, ping, HAND_SIZE,
} from '../lib/game'
import GameCard from '../components/GameCard'

const SBR_TAPS_NEEDED = 5

export default function Room() {
  const { code } = useParams()
  const navigate = useNavigate()

  const [room, setRoom] = useState(null)
  const [players, setPlayers] = useState([])
  const [hand, setHand] = useState([])
  const [question, setQuestion] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [selectedHandIds, setSelectedHandIds] = useState([])
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(true)
  const [pseudoModal, setPseudoModal] = useState(false)
  const [pseudoInput, setPseudoInput] = useState('')

  const [sbrTaps, setSbrTaps] = useState(0)
  const [showSbrPrompt, setShowSbrPrompt] = useState(false)
  const [sbrCodeInput, setSbrCodeInput] = useState('')
  const sbrTimer = useRef(null)

  const playerId = sessionStorage.getItem('ll_player_id')
  const roomRef = useRef(room)
  roomRef.current = room

  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function init() {
      setLoading(true)
      try {
        const r = await getRoomByCode(code)
        if (!r) { showToast('Table introuvable.'); navigate('/'); return }
        if (cancelled) return
        setRoom(r)
        let pid = sessionStorage.getItem('ll_player_id')
        let validPlayer = null
        if (pid) {
          const { data } = await supabase.from('players').select('*').eq('id', pid).maybeSingle()
          if (data && data.room_id === r.id) validPlayer = data
        }
        if (!validPlayer) { setPseudoModal(true); setLoading(false); return }
        await loadPlayers(r.id)
        await loadHand(validPlayer.id)
        if (r.current_question_id) await loadQuestion(r.current_question_id)
        if (r.round_number > 0) await loadSubmissions(r.id, r.round_number)
      } catch (err) {
        console.error(err)
        showToast('Erreur de chargement.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    init()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  async function loadPlayers(roomId) {
    const p = await getPlayers(roomId)
    setPlayers(p)
  }

  async function loadHand(pid) {
    const h = await getHand(pid)
    setHand(h)
  }

  async function loadQuestion(questionId) {
    const { data } = await supabase.from('cards_questions').select('*').eq('id', questionId).maybeSingle()
    setQuestion(data)
  }

  async function loadSubmissions(roomId, roundNumber) {
    const subs = await getSubmissions(roomId, roundNumber)
    setSubmissions(subs)
  }

  useEffect(() => {
    if (!room) return
    const channel = supabase
      .channel(`room-${room.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` },
        (payload) => {
          const updated = payload.new
          setRoom(updated)
          if (updated.current_question_id) loadQuestion(updated.current_question_id)
          if (updated.phase === 'answering') {
            setSubmissions([])
            setSelectedHandIds([])
          }
          if (updated.round_number > 0) loadSubmissions(updated.id, updated.round_number)
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${room.id}` },
        () => loadPlayers(room.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions', filter: `room_id=eq.${room.id}` },
        () => { const r = roomRef.current; if (r) loadSubmissions(r.id, r.round_number) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_hands', filter: `player_id=eq.${playerId}` },
        () => { if (playerId) loadHand(playerId) })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id])

  const myPlayer = players.find((p) => p.id === playerId)
  const judgeId = players.length > 0 ? players[room?.judge_index % players.length]?.id : null
  const isJudge = judgeId === playerId
  const blanksNeeded = question?.blanks ?? 1

  useEffect(() => {
    if (!playerId) return
    const interval = setInterval(() => ping(playerId), 30000)
    return () => clearInterval(interval)
  }, [playerId])

  useEffect(() => {
    if (!room || !myPlayer?.is_host) return
    if (room.phase !== 'answering') return
    if (players.length < 2) return
    const expected = players.length - 1
    const currentRoundSubs = submissions.filter(s => s.round_number === room.round_number)
    if (expected > 0 && currentRoundSubs.length >= expected) {
      setRoomPhase(room.id, 'judging').catch((err) => console.error(err))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissions.length, room?.phase, room?.round_number, players.length, myPlayer?.is_host])

  async function handleJoinPseudo(e) {
    e.preventDefault()
    if (!pseudoInput.trim() || !room) return
    try {
      const player = await joinRoom(room.id, pseudoInput.trim(), false)
      sessionStorage.setItem('ll_player_id', player.id)
      sessionStorage.setItem('ll_pseudo', pseudoInput.trim())
      setPseudoModal(false)
      await loadPlayers(room.id)
      await loadHand(player.id)
      if (room.current_question_id) await loadQuestion(room.current_question_id)
      if (room.round_number > 0) await loadSubmissions(room.id, room.round_number)
    } catch (err) {
      console.error(err)
      showToast('Impossible de rejoindre.')
    }
  }

  async function handleStartGame() {
    if (!room || players.length < 2) return showToast('Il faut au moins 2 joueurs.')
    try {
      for (const p of players) {
        await dealHand(room.id, p.id, room.use_hidden_deck)
      }
      const updated = await startNextRound(room, players)
      setRoom(updated)
      if (playerId) await loadHand(playerId)
    } catch (err) {
      console.error(err)
      showToast('Erreur au lancement.')
    }
  }

  function toggleSelectCard(handId) {
    if (isJudge || room?.phase !== 'answering') return
    setSelectedHandIds((prev) => {
      if (prev.includes(handId)) return prev.filter((id) => id !== handId)
      if (prev.length >= blanksNeeded) {
        if (blanksNeeded === 1) return [handId]
        return [...prev.slice(1), handId]
      }
      return [...prev, handId]
    })
  }

  async function handleSubmit() {
    if (!room || selectedHandIds.length !== blanksNeeded) return
    const cardIds = selectedHandIds.map((hid) => hand.find((h) => h.handId === hid)?.cardId)
    try {
      await submitCards(room.id, playerId, room.round_number, selectedHandIds, cardIds)
      setSelectedHandIds([])
    } catch (err) {
      console.error(err)
      showToast('Tu as deja repondu, ou une erreur est survenue.')
    }
  }

  async function handleJudgePick(winnerPlayerId) {
    if (!room || !isJudge) return
    try {
      await judgeRound(room, winnerPlayerId)
    } catch (err) {
      console.error(err)
      showToast('Erreur lors du choix.')
    }
  }

  async function handleNextRound() {
    if (!room) return
    try {
      for (const p of players) {
        await refillHand(room.id, p.id, room.use_hidden_deck)
      }
      const updated = await startNextRound(room, players)
      setRoom(updated)
      if (playerId) await loadHand(playerId)
    } catch (err) {
      console.error(err)
      showToast('Erreur au tour suivant.')
    }
  }

  async function handleLeave() {
    if (playerId) await leaveRoom(playerId)
    sessionStorage.removeItem('ll_player_id')
    sessionStorage.removeItem('ll_pseudo')
    navigate('/')
  }

  function handleSbrTap() {
    const next = sbrTaps + 1
    setSbrTaps(next)
    clearTimeout(sbrTimer.current)
    if (next >= SBR_TAPS_NEEDED) {
      setShowSbrPrompt(true)
      setSbrTaps(0)
    } else {
      sbrTimer.current = setTimeout(() => setSbrTaps(0), 1200)
    }
  }

  async function handleSbrSubmit(e) {
    e.preventDefault()
    if (sbrCodeInput.trim().toUpperCase() !== 'SBR' || !room) {
      setSbrCodeInput('')
      return
    }
    try {
      const { data, error } = await supabase
        .from('rooms')
        .update({ use_hidden_deck: !room.use_hidden_deck })
        .eq('id', room.id)
        .select()
        .single()
      if (error) throw error
      setRoom(data)
      setShowSbrPrompt(false)
      setSbrCodeInput('')
      showToast(data.use_hidden_deck ? 'Deck cache active' : 'Deck cache desactive')
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) {
    return (
      <div className="page page__content" style={{ justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (pseudoModal) {
    return (
      <div className="page page__content" style={{ justifyContent: 'center' }}>
        <form onSubmit={handleJoinPseudo} className="container panel" style={{ maxWidth: 380 }}>
          <p className="section-title section-title--hazard">Rejoindre la table {code}</p>
          <div className="field" style={{ marginTop: '1rem' }}>
            <label htmlFor="pseudo-room">Ton pseudo</label>
            <input
              id="pseudo-room"
              className="input"
              value={pseudoInput}
              onChange={(e) => setPseudoInput(e.target.value)}
              maxLength={20}
              autoFocus
              placeholder="Ex: Mathieu33"
            />
          </div>
          <div className="btn-row" style={{ marginTop: '1.25rem' }}>
            <button type="submit" className="btn btn--hazard">Entrer</button>
          </div>
        </form>
      </div>
    )
  }

  if (!room) return null

  const phase = room.phase
  const mySubmission = submissions.find((s) => s.player_id === playerId)

  return (
    <div className="page">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem' }}>
        <div className="brand" onClick={handleSbrTap} style={{ transformOrigin: 'left center' }}>
          <span className="brand__line brand__line--limite" style={{ fontSize: '1.5rem' }}>Limite</span>
          <span className="brand__line brand__line--limite2" style={{ fontSize: '1.5rem' }}>Limite</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="room-code" style={{ fontSize: '0.9rem', padding: '0.35rem 0.7rem' }}>{room.code}</span>
          <button className="btn--danger btn" style={{ fontSize: '0.8rem', padding: '0.5rem 1rem', boxShadow: 'none' }} onClick={handleLeave}>
            Quitter
          </button>
        </div>
      </header>

      {showSbrPrompt && (
        <div className="container" style={{ maxWidth: 320, alignSelf: 'center' }}>
          <form onSubmit={handleSbrSubmit} className="panel field" style={{ gap: '0.6rem' }}>
            <label htmlFor="sbr-code">Code secret</label>
            <input
              id="sbr-code"
              className="input input--code"
              value={sbrCodeInput}
              onChange={(e) => setSbrCodeInput(e.target.value)}
              maxLength={3}
              autoFocus
              placeholder="???"
            />
            <div className="btn-row">
              <button type="submit" className="btn btn--hazard">OK</button>
              <button type="button" className="btn btn--ghost" onClick={() => { setShowSbrPrompt(false); setSbrCodeInput('') }}>Annuler</button>
