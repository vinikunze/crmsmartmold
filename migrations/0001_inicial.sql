-- em dia.: água e refeições do Vini e da Sophia.
-- Dia e hora em texto, no horário de Brasília (o aparelho manda): "o copo das
-- 23h50" fica no dia certo. Momento do registro em ISO UTC.
-- Lição do app de finanças: CHECK com NULL passa. Toda coluna que não pode
-- faltar é NOT NULL.

CREATE TABLE pessoas (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE CHECK (email = lower(trim(email)) AND email LIKE '%_@_%'),
  nome TEXT NOT NULL CHECK (length(trim(nome)) BETWEEN 1 AND 30),
  meta_agua_ml INTEGER NOT NULL DEFAULT 2000 CHECK (meta_agua_ml BETWEEN 500 AND 8000),
  copo_ml INTEGER NOT NULL DEFAULT 250 CHECK (copo_ml BETWEEN 50 AND 2000),
  garrafa_ml INTEGER NOT NULL DEFAULT 500 CHECK (garrafa_ml BETWEEN 50 AND 2000),
  meta_kcal INTEGER CHECK (meta_kcal IS NULL OR meta_kcal BETWEEN 800 AND 6000),
  -- Só para sugerir a meta de água (35 ml por quilo).
  peso_g INTEGER CHECK (peso_g IS NULL OR peso_g BETWEEN 30000 AND 300000),
  ordem INTEGER NOT NULL DEFAULT 0
);

-- Plano de horários: a refeição que tem horário aparece no dia como
-- "prevista". Sem linha aqui = não faz parte do plano daquela pessoa.
CREATE TABLE horarios (
  pessoa_id INTEGER NOT NULL REFERENCES pessoas (id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('cafe', 'lanche_manha', 'almoco', 'lanche_tarde', 'jantar', 'ceia')),
  hora TEXT NOT NULL CHECK (hora GLOB '[0-2][0-9]:[0-5][0-9]' AND hora < '24:00'),
  PRIMARY KEY (pessoa_id, tipo)
);

CREATE TABLE refeicoes (
  id INTEGER PRIMARY KEY,
  -- Gerada no aparelho. Se a rede falhar e o app reenviar, o banco devolve a
  -- refeição já criada em vez de lançar duas vezes.
  chave TEXT NOT NULL UNIQUE CHECK (length(chave) BETWEEN 8 AND 64),
  pessoa_id INTEGER NOT NULL REFERENCES pessoas (id),
  dia TEXT NOT NULL CHECK (dia GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  hora TEXT NOT NULL CHECK (hora GLOB '[0-2][0-9]:[0-5][0-9]' AND hora < '24:00'),
  tipo TEXT NOT NULL CHECK (tipo IN ('cafe', 'lanche_manha', 'almoco', 'lanche_tarde', 'jantar', 'ceia', 'outro')),
  descricao TEXT NOT NULL CHECK (length(trim(descricao)) BETWEEN 1 AND 300),
  kcal INTEGER CHECK (kcal IS NULL OR kcal BETWEEN 1 AND 5000),
  obs TEXT CHECK (obs IS NULL OR length(obs) <= 300),
  criado_por TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  atualizado_em TEXT
);

CREATE INDEX refeicoes_dia ON refeicoes (dia, pessoa_id);

CREATE TABLE agua (
  id INTEGER PRIMARY KEY,
  chave TEXT NOT NULL UNIQUE CHECK (length(chave) BETWEEN 8 AND 64),
  pessoa_id INTEGER NOT NULL REFERENCES pessoas (id),
  dia TEXT NOT NULL CHECK (dia GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  hora TEXT NOT NULL CHECK (hora GLOB '[0-2][0-9]:[0-5][0-9]' AND hora < '24:00'),
  ml INTEGER NOT NULL CHECK (ml BETWEEN 10 AND 3000),
  criado_por TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX agua_dia ON agua (dia, pessoa_id);

INSERT INTO pessoas (email, nome, ordem) VALUES
  ('vinihkunze@gmail.com', 'Vini', 1),
  ('sluise981@gmail.com', 'Sophia', 2);

-- Plano inicial igual para os dois; cada um ajusta em Ajustes.
INSERT INTO horarios (pessoa_id, tipo, hora)
  SELECT p.id, h.tipo, h.hora FROM pessoas p,
    (SELECT 'cafe' AS tipo, '07:30' AS hora UNION ALL SELECT 'almoco', '12:00'
     UNION ALL SELECT 'lanche_tarde', '16:00' UNION ALL SELECT 'jantar', '20:00') h;
