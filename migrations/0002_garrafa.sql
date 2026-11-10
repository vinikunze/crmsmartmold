-- Cada um escolhe a sua garrafa: o formato do recipiente e a cor da pessoa
-- (a cor também pinta as iniciais dela nas telas).
ALTER TABLE pessoas ADD COLUMN recipiente TEXT NOT NULL DEFAULT 'garrafa'
  CHECK (recipiente IN ('garrafa', 'squeeze', 'copo', 'garrafao'));
ALTER TABLE pessoas ADD COLUMN cor TEXT NOT NULL DEFAULT 'azul'
  CHECK (cor IN ('azul', 'rosa', 'verde', 'roxo', 'laranja', 'grafite'));

-- Como no app de finanças: Vini azul, Sophia rosa.
UPDATE pessoas SET cor = 'rosa' WHERE email = 'sluise981@gmail.com';
