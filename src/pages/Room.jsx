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
