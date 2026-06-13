import './GameCard.css'

/**
 * Carte de jeu avec animation de flip.
 * type: 'question' (bleue) | 'answer' (rouge)
 * flipped: si true, montre la face avant (texte)
 */
export default function GameCard({
  text,
  type = 'answer',
  flipped = true,
  selectable = false,
  selected = false,
  winner = false,
  size = 'md',
  onClick,
  dealIndex = 0,
}) {
  const classes = [
    'gamecard',
    type === 'question' ? 'gamecard--question' : 'gamecard--answer',
    flipped ? 'gamecard--flipped' : '',
    selectable ? 'gamecard--selectable' : '',
    selected ? 'gamecard--selected' : '',
    winner ? 'gamecard--winner' : '',
    size === 'sm' ? 'gamecard--sm' : '',
    'gamecard--deal',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={classes}
      style={{ animationDelay: `${dealIndex * 0.07}s` }}
      onClick={onClick}
      role={selectable ? 'button' : undefined}
      tabIndex={selectable ? 0 : undefined}
      onKeyDown={selectable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.() } : undefined}
    >
      <div className="gamecard__inner">
        <div className="gamecard__face gamecard__face--front">
          <span className="gamecard__brand">LL</span>
        </div>
        <div className="gamecard__face gamecard__face--back">
          <span>{text}</span>
          <span className="gamecard__badge">{type === 'question' ? 'Limite Limite' : 'Réponse'}</span>
        </div>
      </div>
    </div>
  )
}
