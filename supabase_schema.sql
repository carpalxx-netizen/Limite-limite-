-- ============================================
-- LIMITE LIMITE - Schéma Supabase
-- ============================================

-- Activer l'extension UUID si besoin
create extension if not exists "uuid-ossp";

-- ============================================
-- TABLE: cards_questions (cartes bleues - phrases à trou)
-- ============================================
create table cards_questions (
  id uuid primary key default uuid_generate_v4(),
  text text not null,
  blanks int not null default 1, -- nombre de trous (1 ou 2)
  hidden boolean not null default false, -- true = deck caché "SBR"
  created_at timestamptz default now()
);

-- ============================================
-- TABLE: cards_answers (cartes rouges - réponses)
-- ============================================
create table cards_answers (
  id uuid primary key default uuid_generate_v4(),
  text text not null,
  hidden boolean not null default false, -- true = deck caché "SBR"
  created_at timestamptz default now()
);

-- ============================================
-- TABLE: rooms (les "tables" / parties)
-- ============================================
create table rooms (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null, -- code court pour rejoindre (ex: "ABCD")
  status text not null default 'lobby', -- lobby | playing | finished
  use_hidden_deck boolean not null default false, -- deck SBR activé pour cette table
  current_question_id uuid references cards_questions(id),
  judge_index int not null default 0, -- index du joueur juge actuel
  round_number int not null default 0,
  phase text not null default 'waiting', -- waiting | answering | judging | results
  created_at timestamptz default now()
);

-- ============================================
-- TABLE: players (joueurs dans une table)
-- ============================================
create table players (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references rooms(id) on delete cascade not null,
  pseudo text not null,
  score int not null default 0,
  is_host boolean not null default false,
  joined_at timestamptz default now(),
  last_seen timestamptz default now()
);

-- ============================================
-- TABLE: player_hands (cartes en main de chaque joueur)
-- ============================================
create table player_hands (
  id uuid primary key default uuid_generate_v4(),
  player_id uuid references players(id) on delete cascade not null,
  room_id uuid references rooms(id) on delete cascade not null,
  card_id uuid references cards_answers(id) not null,
  used boolean not null default false,
  created_at timestamptz default now()
);

-- ============================================
-- TABLE: submissions (cartes posées pour la manche en cours)
-- ============================================
create table submissions (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references rooms(id) on delete cascade not null,
  player_id uuid references players(id) on delete cascade not null,
  round_number int not null,
  card_ids uuid[] not null, -- 1 ou 2 cartes selon le nombre de trous
  created_at timestamptz default now(),
  unique(room_id, player_id, round_number)
);

-- ============================================
-- TABLE: round_winners (historique des manches gagnées)
-- ============================================
create table round_winners (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references rooms(id) on delete cascade not null,
  round_number int not null,
  player_id uuid references players(id) on delete cascade not null,
  created_at timestamptz default now()
);

-- ============================================
-- TABLE: used_questions (pour ne pas répéter les questions dans une partie)
-- ============================================
create table used_questions (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references rooms(id) on delete cascade not null,
  question_id uuid references cards_questions(id) not null,
  unique(room_id, question_id)
);

-- ============================================
-- INDEXES
-- ============================================
create index idx_players_room on players(room_id);
create index idx_hands_player on player_hands(player_id);
create index idx_hands_room on player_hands(room_id);
create index idx_submissions_room_round on submissions(room_id, round_number);
create index idx_rooms_code on rooms(code);

-- ============================================
-- ROW LEVEL SECURITY
-- On laisse ouvert (accès public anon) car pas d'auth utilisateur:
-- le jeu est anonyme, accès via code de table.
-- ============================================
alter table cards_questions enable row level security;
alter table cards_answers enable row level security;
alter table rooms enable row level security;
alter table players enable row level security;
alter table player_hands enable row level security;
alter table submissions enable row level security;
alter table round_winners enable row level security;
alter table used_questions enable row level security;

-- Policies: lecture publique pour cartes non cachées
create policy "Public read non-hidden questions" on cards_questions
  for select using (true); -- on filtre le hidden côté appli selon le flag de room

create policy "Public read non-hidden answers" on cards_answers
  for select using (true);

-- Policies CRUD ouvertes pour admin (protégé côté front par code 6000)
create policy "Public insert questions" on cards_questions for insert with check (true);
create policy "Public update questions" on cards_questions for update using (true);
create policy "Public delete questions" on cards_questions for delete using (true);

create policy "Public insert answers" on cards_answers for insert with check (true);
create policy "Public update answers" on cards_answers for update using (true);
create policy "Public delete answers" on cards_answers for delete using (true);

-- Policies ouvertes pour le jeu (anonyme)
create policy "Public all rooms" on rooms for all using (true) with check (true);
create policy "Public all players" on players for all using (true) with check (true);
create policy "Public all hands" on player_hands for all using (true) with check (true);
create policy "Public all submissions" on submissions for all using (true) with check (true);
create policy "Public all round_winners" on round_winners for all using (true) with check (true);
create policy "Public all used_questions" on used_questions for all using (true) with check (true);

-- ============================================
-- REALTIME: activer le realtime sur les tables clés
-- ============================================
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table submissions;
alter publication supabase_realtime add table player_hands;
alter publication supabase_realtime add table round_winners;
