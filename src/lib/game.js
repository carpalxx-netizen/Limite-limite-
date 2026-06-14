import { supabase } from './supabase'

export const HAND_SIZE = 7

function randomCode(len = 4) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export async function createRoom(useHiddenDeck = false) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode(4)
    const { data, error } = await supabase
      .from('rooms')
      .insert({ code, use_hidden_deck: useHiddenDeck })
      .select()
      .single()
    if (!error) return data
    if (error.code !== '23505') throw error
  }
  throw new Error('Impossible de créer la table, réessaie.')
}

export async function getRoomByCode(code) {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .maybeSingle()
  if (error) throw error
  return data
}

export async function joinRoom(roomId, pseudo, isHost = false) {
  const { data, error } = await supabase
    .from('players')
    .insert({ room_id: roomId, pseudo, is_host: isHost })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function leaveRoom(playerId) {
  await supabase.from('players').delete().eq('id', playerId)
}

export async function getPlayers(roomId) {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('room_id', roomId)
    .order('joined_at', { ascending: true })
  if (error) throw error
  return data
}

async function drawAnswerCards(count, useHiddenDeck) {
  const { data, error } = await supabase
    .from('cards_answers')
    .select('id')
    .eq('hidden', useHiddenDeck)
  if (error) throw error
  if (!data || data.length === 0) return []
  const shuffled = [...data].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

export async function dealHand(roomId, playerId, useHiddenDeck) {
  const cards = await drawAnswerCards(HAND_SIZE, useHiddenDeck)
  if (cards.length === 0) return
  const rows = cards.map((c) => ({ room_id: roomId, player_id: playerId, card_id: c.id }))
  const { error } = await supabase.from('player_hands').insert(rows)
  if (error) throw error
}

export async function getHand(playerId) {
  const { data, error } = await supabase
    .from('player_hands')
    .select('id, card_id, used, cards_answers(text)')
    .eq('player_id', playerId)
    .eq('used', false)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data.map((row) => ({
    handId: row.id,
    cardId: row.card_id,
    text: row.cards_answers?.text ?? '???',
  }))
}

export async function drawQuestion(roomId, useHiddenDeck) {
  const { data: used, error: usedErr } = await supabase
    .from('used_questions')
    .select('question_id')
    .eq('room_id', roomId)
  if (usedErr) throw usedErr
  const usedIds = new Set((used || []).map((u) => u.question_id))

  const { data: all, error } = await supabase
    .from('cards_questions')
    .select('*')
    .eq('hidden', useHiddenDeck)
  if (error) throw error

  let pool = all.filter((q) => !usedIds.has(q.id))
  if (pool.length === 0) pool = all
  if (pool.length === 0) return null

  const pick = pool[Math.floor(Math.random() * pool.length)]
  await supabase.from('used_questions').insert({ room_id: roomId, question_id: pick.id }).select()
  return pick
}

export async function startNextRound(room, players) {
  const question = await drawQuestion(room.id, room.use_hidden_deck)
  const nextJudgeIndex = players.length > 0 ? room.round_number % players.length : 0

  const { data, error } = await supabase
    .from('rooms')
    .update({
      status: 'playing',
      current_question_id: question?.id ?? null,
      judge_index: nextJudgeIndex,
      round_number: room.round_number + 1,
      phase: 'answering',
    })
    .eq('id', room.id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function submitCards(roomId, playerId, roundNumber, handIds, cardIds) {
  const { error } = await supabase.from('submissions').insert({
    room_id: roomId,
    player_id: playerId,
    round_number: roundNumber,
    card_ids: cardIds,
  })
  if (error) throw error
  await supabase.from('player_hands').update({ used: true }).in('id', handIds)
}

export async function getSubmissions(roomId, roundNumber) {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('room_id', roomId)
    .eq('round_number', roundNumber)
  if (error) throw error

  const allCardIds = [...new Set(data.flatMap((s) => s.card_ids))]
  let textMap = {}
  if (allCardIds.length > 0) {
    const { data: cards, error: cardsErr } = await supabase
      .from('cards_answers')
      .select('id, text')
      .in('id', allCardIds)
    if (cardsErr) throw cardsErr
    textMap = Object.fromEntries(cards.map((c) => [c.id, c.text]))
  }

  return data.map((s) => ({
    ...s,
    texts: s.card_ids.map((id) => textMap[id] ?? '???'),
  }))
}

export async function setRoomPhase(roomId, phase) {
  const { error } = await supabase.from('rooms').update({ phase }).eq('id', roomId)
  if (error) throw error
}

export async function judgeRound(room, winnerPlayerId) {
  await supabase.from('round_winners').insert({
    room_id: room.id,
    round_number: room.round_number,
    player_id: winnerPlayerId,
  })

  const { data: player, error: pErr } = await supabase
    .from('players')
    .select('score')
    .eq('id', winnerPlayerId)
    .single()
  if (pErr) throw pErr

  await supabase
    .from('players')
    .update({ score: player.score + 1 })
    .eq('id', winnerPlayerId)

  await supabase.from('rooms').update({ phase: 'results' }).eq('id', room.id)
}

export async function refillHand(roomId, playerId, useHiddenDeck) {
  await supabase
    .from('player_hands')
    .delete()
    .eq('player_id', playerId)
    .eq('used', true)

  const hand = await getHand(playerId)
  const missing = HAND_SIZE - hand.length
  if (missing > 0) {
    const cards = await drawAnswerCards(missing, useHiddenDeck)
    if (cards.length === 0) return
    const rows = cards.map((c) => ({ room_id: roomId, player_id: playerId, card_id: c.id }))
    await supabase.from('player_hands').insert(rows)
  }
}

export async function ping(playerId) {
  await supabase.from('players').update({ last_seen: new Date().toISOString() }).eq('id', playerId)
}
