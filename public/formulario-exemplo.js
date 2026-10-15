document.getElementById('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const dados = Object.fromEntries(new FormData(e.target));
  dados._origem = 'teste';
  const box = document.getElementById('resultado');
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  try {
    const res = await fetch('/api/public/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
    });
    const r = await res.json();
    box.className = `alert ${res.ok ? 'ok' : 'error'}`;
    box.textContent = res.ok ? `${r.mensagem} (veja o lead no painel do CRM)` : r.erro;
    if (res.ok) e.target.reset();
  } catch {
    box.className = 'alert error';
    box.textContent = 'Falha de conexão.';
  } finally {
    btn.disabled = false;
  }
});
