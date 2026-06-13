import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Admin() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('questions')
  const [deckFilter, setDeckFilter] = useState('visible')

  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState([])
  const [loading, setLoading] = useState(true)

  const [newText, setNewText] = useState('')
  const [newBlanks, setNewBlanks] = useState(1)
  const [newHidden, setNewHidden] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    setNewHidden(deckFilter === 'hidden')
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  async function loadAll() {
    setLoading(true)
    const [{ data: q }, { data: a }] = await Promise.all([
      supabase.from('cards_questions').select('*').order('created_at', { ascending: false }),
      supabase.from('cards_answers').select('*').order('created_at', { ascending: false }),
    ])
    setQuestions(q || [])
    setAnswers(a || [])
    setLoading(false)
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!newText.trim()) return
    setSaving(true)
    try {
      if (tab === 'questions') {
        const { error } = await supabase.from('cards_questions').insert({
          text: newText.trim(),
          blanks: newBlanks,
          hidden: newHidden,
        })
        if (error) throw error
      } else {
        const { error } = await supabase.from('cards_answers').insert({
          text: newText.trim(),
          hidden: newHidden,
        })
        if (error) throw error
      }
      setNewText('')
      await loadAll()
      showToast('Carte ajoutee.')
    } catch (err) {
      console.error(err)
      showToast('Erreur lors de l ajout.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(table, id) {
    try {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) throw error
      await loadAll()
      showToast('Carte supprimee.')
    } catch (err) {
      console.error(err)
      showToast('Erreur lors de la suppression.')
    }
  }

  async function handleToggleHidden(table, id, current) {
    try {
      const { error } = await supabase.from(table).update({ hidden: !current }).eq('id', id)
      if (error) throw error
      await loadAll()
    } catch (err) {
      console.error(err)
    }
  }

  const list = tab === 'questions' ? questions : answers
  const filtered = list.filter((c) => (deckFilter === 'hidden' ? c.hidden : !c.hidden))
  const table = tab === 'questions' ? 'cards_questions' : 'cards_answers'

  return (
    <div className="page">
      <div className="hazard-tape">
        <div className="hazard-tape__inner">
          <span>Espace admin</span>
          <span>Limite Limite</span>
          <span>Espace admin</span>
          <span>Limite Limite</span>
        </div>
      </div>

      <div className="page__content">
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 760 }}>
          <p className="section-title section-title--hazard" style={{ margin: 0 }}>Admin — Cartes</p>
          <button className="btn btn--ghost" onClick={() => navigate('/')}>Retour au jeu</button>
        </div>

        <div className="tabs">
          <button className={`tab ${tab === 'questions' ? 'tab--active' : ''}`} onClick={() => setTab('questions')}>
            Cartes Questions ({questions.length})
          </button>
          <button className={`tab ${tab === 'answers' ? 'tab--active' : ''}`} onClick={() => setTab('answers')}>
            Cartes Reponses ({answers.length})
          </button>
        </div>

        <div className="tabs">
          <button className={`tab ${deckFilter === 'visible' ? 'tab--active' : ''}`} onClick={() => setDeckFilter('visible')}>
            Deck visible
          </button>
          <button className={`tab ${deckFilter === 'hidden' ? 'tab--active' : ''}`} onClick={() => setDeckFilter('hidden')}>
            Deck cache (SBR)
          </button>
        </div>

        <form onSubmit={handleAdd} className="container panel" style={{ maxWidth: 760 }}>
          <p className="section-title" style={{ fontSize: '1.1rem' }}>
            Ajouter une carte {tab === 'questions' ? 'question' : 'reponse'} — deck {deckFilter === 'hidden' ? 'cache (SBR)' : 'visible'}
          </p>
          <div className="field" style={{ marginTop: '0.75rem' }}>
            <label htmlFor="card-text">Texte</label>
            <textarea
              id="card-text"
              className="input"
              style={{ minHeight: 80, fontFamily: 'var(--font-mono)', resize: 'vertical' }}
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder={tab === 'questions' ? 'Ex: ___ ca resume bien mon week-end' : 'Ex: Une raclette entre collegues'}
            />
          </div>
          {tab === 'questions' && (
            <div className="field" style={{ marginTop: '0.75rem' }}>
              <label htmlFor="card-blanks">Nombre de trous</label>
              <select
                id="card-blanks"
                className="input"
                value={newBlanks}
                onChange={(e) => setNewBlanks(Number(e.target.value))}
              >
                <option value={1}>1 trou</option>
                <option value={2}>2 trous</option>
              </select>
            </div>
          )}
          <div className="field" style={{ marginTop: '0.75rem', flexDirection: 'row', alignItems: 'center', gap: '0.6rem' }}>
            <input
              type="checkbox"
              id="card-hidden"
              checked={newHidden}
              onChange={(e) => setNewHidden(e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            <label htmlFor="card-hidden" style={{ margin: 0 }}>Carte du deck cache (SBR)</label>
          </div>
          <div className="btn-row" style={{ marginTop: '1rem' }}>
            <button type="submit" className="btn btn--hazard" disabled={saving}>
              {saving ? 'Ajout...' : 'Ajouter la carte'}
            </button>
          </div>
        </form>

        <div className="container panel" style={{ maxWidth: 760 }}>
          {loading ? (
            <div className="spinner" style={{ margin: '2rem auto' }} />
          ) : filtered.length === 0 ? (
            <p className="empty-state">Aucune carte dans ce deck pour l instant.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Texte</th>
                    {tab === 'questions' && <th>Trous</th>}
                    <th>Deck</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id}>
                      <td style={{ maxWidth: 400 }}>{c.text}</td>
                      {tab === 'questions' && <td>{c.blanks}</td>}
                      <td>
                        <button
                          className={`tag ${c.hidden ? 'tag--hidden' : 'tag--visible'}`}
                          style={{ border: 'none', cursor: 'pointer' }}
                          onClick={() => handleToggleHidden(table, c.id, c.hidden)}
                        >
                          {c.hidden ? 'Cache (SBR)' : 'Visible'}
                        </button>
                      </td>
                      <td>
                        <button className="btn--danger btn" style={{ fontSize: '0.75rem', padding: '0.35rem 0.8rem', boxShadow: 'none' }} onClick={() => handleDelete(table, c.id)}>
                          Suppr.
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
