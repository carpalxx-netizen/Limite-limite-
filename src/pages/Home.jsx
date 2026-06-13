import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { createRoom, getRoomByCode, joinRoom } from '../lib/game'

const LOGO_TAPS_NEEDED = 4
const ADMIN_CODE = '6000'

export default function Home() {
  const navigate = useNavigate()
  const [pseudo, setPseudo] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [mode, setMode] = useState(null) // 'create' | 'join' | null
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [logoTaps, setLogoTaps] = useState(0)
  const [showAdminPrompt, setShowAdminPrompt] = useState(false)
  const [adminCodeInput, setAdminCodeInput] = useState('')
  const [adminError, setAdminError] = useState('')
  const tapTimer = useRef(null)

  function handleLogoTap() {
    const next = logoTaps + 1
    setLogoTaps(next)
    clearTimeout(tapTimer.current)
    if (next >= LOGO_TAPS_NEEDED) {
      setShowAdminPrompt(true)
      setLogoTaps(0)
    } else {
      tapTimer.current = setTimeout(() => setLogoTaps(0), 1200)
    }
  }

  function checkAdminCode(e) {
    e.preventDefault()
    if (adminCodeInput === ADMIN_CODE) {
      navigate('/admin')
    } else {
      setAdminError('Code incorrect.')
      setAdminCodeInput('')
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!pseudo.trim()) return setError('Choisis un pseudo.')
    setLoading(true)
    setError('')
    try {
      const room = await createRoom(false)
      const player = await joinRoom(room.id, pseudo.trim(), true)
      sessionStorage.setItem('ll_player_id', player.id)
      sessionStorage.setItem('ll_pseudo', pseudo.trim())
      navigate(`/table/${room.code}`)
    } catch (err) {
      console.error(err)
      setError('Impossible de creer la table. Reessaie.')
      setLoading(false)
    }
  }

  async function handleJoin(e) {
    e.preventDefault()
    if (!pseudo.trim()) return setError('Choisis un pseudo.')
    if (!joinCode.trim()) return setError('Entre le code de la table.')
    setLoading(true)
    setError('')
    try {
      const room = await getRoomByCode(joinCode.trim())
      if (!room) {
        setError('Aucune table avec ce code.')
        setLoading(false)
        return
      }
      const player = await joinRoom(room.id, pseudo.trim(), false)
      sessionStorage.setItem('ll_player_id', player.id)
      sessionStorage.setItem('ll_pseudo', pseudo.trim())
      navigate(`/table/${room.code}`)
    } catch (err) {
      console.error(err)
      setError('Impossible de rejoindre la table. Reessaie.')
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="hazard-tape">
        <div className="hazard-tape__inner">
          <span>Risque de derapage</span>
          <span>+18 ans</span>
          <span>Risque de derapage</span>
          <span>+18 ans</span>
          <span>Risque de derapage</span>
          <span>+18 ans</span>
        </div>
      </div>

      <div className="page__content">
        <div className="brand" onClick={handleLogoTap} aria-label="Logo Limite Limite">
          <span className="brand__line brand__line--limite">Limite</span>
          <span className="brand__line brand__line--limite2">Limite</span>
          <div className="brand__tagline">Le jeu qui n'a pas de limite</div>
        </div>

        {showAdminPrompt && (
          <div className="panel panel--center container" style={{ maxWidth: 360 }}>
            <form onSubmit={checkAdminCode} className="field">
              <label htmlFor="admin-code">Code admin</label>
              <input
                id="admin-code"
                className="input input--code"
                value={adminCodeInput}
                onChange={(e) => setAdminCodeInput(e.target.value)}
                maxLength={4}
                inputMode="numeric"
                autoFocus
                placeholder="****"
              />
              {adminError && <p className="text-blood" style={{ margin: 0 }}>{adminError}</p>}
              <div className="btn-row">
                <button type="submit" className="btn btn--hazard">Valider</button>
                <button type="button" className="btn btn--ghost" onClick={() => { setShowAdminPrompt(false); setAdminError(''); setAdminCodeInput('') }}>
                  Annuler
                </button>
              </div>
            </form>
          </div>
        )}

        {!mode && (
          <div className="container panel panel--center" style={{ maxWidth: 420 }}>
            <p className="section-title">Cree ou rejoins une table</p>
            <p className="text-ash" style={{ marginTop: '-0.5rem' }}>
              Jeu de cartes entre potes, 100% en ligne et en temps reel.
            </p>
            <div className="btn-row" style={{ marginTop: '1rem' }}>
              <button className="btn" onClick={() => setMode('create')}>Creer une table</button>
              <button className="btn btn--secondary" onClick={() => setMode('join')}>Rejoindre</button>
            </div>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreate} className="container panel" style={{ maxWidth: 420 }}>
            <p className="section-title section-title--hazard">Nouvelle table</p>
            <div className="field" style={{ marginTop: '1rem' }}>
              <label htmlFor="pseudo-create">Ton pseudo</label>
              <input
                id="pseudo-create"
                className="input"
                value={pseudo}
                onChange={(e) => setPseudo(e.target.value)}
                maxLength={20}
                placeholder="Ex: Kevin69"
                autoFocus
              />
            </div>
            {error && <p className="text-blood">{error}</p>}
            <div className="btn-row" style={{ marginTop: '1.25rem' }}>
              <button type="submit" className="btn btn--hazard" disabled={loading}>
                {loading ? 'Creation...' : 'Creer la table'}
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => { setMode(null); setError('') }}>
                Retour
              </button>
            </div>
          </form>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoin} className="container panel" style={{ maxWidth: 420 }}>
            <p className="section-title section-title--hazard">Rejoindre une table</p>
            <div className="field" style={{ marginTop: '1rem' }}>
              <label htmlFor="code-join">Code de la table</label>
              <input
                id="code-join"
                className="input input--code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={4}
                placeholder="XXXX"
                autoFocus
              />
            </div>
            <div className="field" style={{ marginTop: '0.75rem' }}>
              <label htmlFor="pseudo-join">Ton pseudo</label>
              <input
                id="pseudo-join"
                className="input"
                value={pseudo}
                onChange={(e) => setPseudo(e.target.value)}
                maxLength={20}
                placeholder="Ex: Sarah_92"
              />
            </div>
            {error && <p className="text-blood">{error}</p>}
            <div className="btn-row" style={{ marginTop: '1.25rem' }}>
              <button type="submit" className="btn btn--hazard" disabled={loading}>
                {loading ? 'Connexion...' : 'Rejoindre'}
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => { setMode(null); setError('') }}>
                Retour
              </button>
            </div>
          </form>
        )}

        <p className="text-ash" style={{ fontSize: '0.8rem', textAlign: 'center', maxWidth: 380 }}>
          Jeu reserve a un public averti (+18). En continuant, tu confirmes etre majeur et consentant
          a du contenu humoristique vulgaire et explicite.
        </p>
      </div>
    </div>
  )
}
