// Leads: o funil do corretor (Novo → Negociando → Fechado → Perdido), a ficha do
// lead com o que ele procura, e a tela "Minha conta" com a equipe.
let leads = [];
let editingLeadId = null;
let filtroEtapa = 'ativos';
let filtroCorretor = '';
let buscaLead = '';

const ETAPAS = [
  { id: 'novo', nome: 'Novo', cor: '#0ea5e9' },
  { id: 'negociando', nome: 'Negociando', cor: '#f59e0b' },
  { id: 'fechado', nome: 'Fechado', cor: '#22c55e' },
  { id: 'perdido', nome: 'Perdido', cor: '#94a3b8' }
];
const PAGAMENTOS = [
  ['avista', 'À vista'], ['financiamento', 'Financiamento'], ['fgts', 'FGTS'],
  ['permuta', 'Permuta'], ['parcelamento', 'Parcelamento direto'], ['consorcio', 'Consórcio']
];
const telaLarga = matchMedia('(min-width: 900px)');
telaLarga.addEventListener('change', () => renderLeads());

// ===== utilitários =====
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function meuId() { return Nuvem.ativa && Nuvem.usuario ? Nuvem.usuario.id : null; }
function meuNome() {
  if (!Nuvem.ativa || !Nuvem.usuario) return '';
  return (Nuvem.membro && Nuvem.membro.nome) || Nuvem.usuario.nome || '';
}
function podeUsarLeads() { return !Nuvem.ativa || !!Nuvem.membro; }
function podeExcluirLead(l) {
  if (!Nuvem.ativa || Nuvem.ehAdmin) return true;
  return l.corretorId === meuId() && (!l.criadoPor || l.criadoPor === meuId());
}
function nomeCorretor(id) {
  if (!id) return 'Sem corretor';
  const m = Nuvem.membros.find(x => x.user_id === id);
  return m ? (m.nome || m.email) : 'Ex-membro';
}
function fmtValor(n) {
  if (n == null || n === '') return '';
  n = Number(n);
  if (n >= 1e6) return 'R$ ' + (n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' mi';
  if (n >= 1e3) return 'R$ ' + (n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';
  return 'R$ ' + n.toLocaleString('pt-BR');
}
function faixaValor(l) {
  const a = l.valorMin, b = l.valorMax;
  if (a != null && b != null) return fmtValor(a) + ' a ' + fmtValor(b).replace('R$ ', '');
  if (b != null) return 'até ' + fmtValor(b);
  if (a != null) return 'a partir de ' + fmtValor(a);
  return '';
}
function resumoBusca(l) {
  const pag = (l.pagamento || []).map(p => (PAGAMENTOS.find(x => x[0] === p) || [p, p])[1]);
  return [l.finalidade === 'locacao' ? 'Locação' : 'Compra', l.tipoImovel, l.regiao, faixaValor(l), pag.join(', ')]
    .filter(Boolean).join(' · ');
}
function diasDesde(iso) {
  if (!iso) return '';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? 'hoje' : d === 1 ? 'há 1 dia' : 'há ' + d + ' dias';
}
function soDigitos(s) { return String(s || '').replace(/\D/g, ''); }
function lerValor(id) {
  const d = soDigitos(document.getElementById(id).value);
  return d ? Number(d) : null;
}
function formatarCampoValor(el) {
  const d = soDigitos(el.value);
  el.value = d ? Number(d).toLocaleString('pt-BR') : '';
}
function linkWhats(tel, texto) {
  let n = soDigitos(tel).replace(/^0+/, '');
  if (n.length === 10 || n.length === 11) n = '55' + n;
  return 'https://wa.me/' + n + (texto ? '?text=' + encodeURIComponent(texto) : '');
}

// ===== lista / funil =====
function leadsFiltrados() {
  const q = buscaLead.trim().toLowerCase();
  const qDig = soDigitos(q);
  return leads.filter(l => {
    if (Nuvem.ehAdmin && filtroCorretor) {
      if (filtroCorretor === '-' ? l.corretorId : l.corretorId !== filtroCorretor) return false;
    }
    if (!q) return true;
    return (l.nome || '').toLowerCase().includes(q)
      || (qDig && soDigitos(l.telefone).includes(qDig))
      || (l.regiao || '').toLowerCase().includes(q)
      || (l.tipoImovel || '').toLowerCase().includes(q)
      || (l.obs || '').toLowerCase().includes(q);
  }).sort((a, b) => (b.atualizadoEm || b.criadoEm || '').localeCompare(a.atualizadoEm || a.criadoEm || ''));
}

function renderLeads() {
  const area = document.getElementById('leadsArea');
  if (!area) return;
  if (Nuvem.ativa && !Nuvem.usuario) { area.innerHTML = ''; return; }
  if (!podeUsarLeads()) { area.innerHTML = htmlSemEquipe(); return; }

  const lista = leadsFiltrados();
  let html = `<div class="leads-toolbar">
    <input class="leads-busca" type="search" placeholder="🔍 Buscar nome, telefone, bairro…" value="${esc(buscaLead)}"
      oninput="buscaLead=this.value;renderLeadsLista()">`;
  if (Nuvem.ehAdmin) {
    html += `<select class="leads-filtro" onchange="filtroCorretor=this.value;renderLeadsLista()">
      <option value="">Todos os corretores</option>
      <option value="-" ${filtroCorretor === '-' ? 'selected' : ''}>Sem corretor (a distribuir)</option>
      ${Nuvem.membros.map(m => `<option value="${m.user_id}" ${filtroCorretor === m.user_id ? 'selected' : ''}>${esc(m.nome || m.email)}${m.ativo ? '' : ' (inativo)'}</option>`).join('')}
    </select>`;
  }
  html += `</div><div id="leadsLista"></div>`;
  area.innerHTML = html;
  renderLeadsLista(lista);
}

function renderLeadsLista(lista) {
  const el = document.getElementById('leadsLista');
  if (!el) return;
  lista = lista || leadsFiltrados();
  const por = id => lista.filter(l => l.etapa === id);

  if (!leads.length) {
    el.innerHTML = `<div class="empty-state"><div class="icon">🎯</div><p>Nenhum lead ainda.<br>Toque em + para cadastrar o primeiro.</p></div>`;
    return;
  }

  if (telaLarga.matches) {
    el.innerHTML = `<div class="kanban">${ETAPAS.map(e => {
      const itens = por(e.id);
      return `<div class="kanban-col" data-etapa="${e.id}" ondragover="event.preventDefault();this.classList.add('over')"
          ondragleave="this.classList.remove('over')" ondrop="soltarLead(event,'${e.id}')">
        <div class="kanban-titulo" style="border-color:${e.cor}">${e.nome} <span>${itens.length}</span></div>
        ${itens.map(cardLead).join('') || '<div class="kanban-vazio">—</div>'}
      </div>`;
    }).join('')}</div>`;
    return;
  }

  const ativos = lista.filter(l => l.etapa === 'novo' || l.etapa === 'negociando');
  const chips = [['ativos', 'Ativos', ativos.length], ...ETAPAS.map(e => [e.id, e.nome, por(e.id).length]), ['todos', 'Todos', lista.length]];
  const mostrados = filtroEtapa === 'ativos' ? ativos : filtroEtapa === 'todos' ? lista : por(filtroEtapa);
  el.innerHTML = `<div class="chips">${chips.map(([id, nome, n]) =>
      `<button class="chip ${filtroEtapa === id ? 'active' : ''}" onclick="filtroEtapa='${id}';renderLeadsLista()">${nome}<span class="n">${n}</span></button>`).join('')}</div>
    ${mostrados.map(cardLead).join('') || '<div class="empty-state"><p>Nenhum lead nesta etapa.</p></div>'}`;
}

function cardLead(l) {
  const etapa = ETAPAS.find(e => e.id === l.etapa) || ETAPAS[0];
  const resumo = resumoBusca(l);
  const meta = [Nuvem.ehAdmin ? '👤 ' + esc(nomeCorretor(l.corretorId)) : '', diasDesde(l.criadoEm)].filter(Boolean).join(' · ');
  return `<div class="lead-card" style="border-left-color:${etapa.cor}" draggable="${telaLarga.matches}"
      ondragstart="event.dataTransfer.setData('text/plain','${l.id}')" onclick="openLeadModal('${l.id}')">
    <div class="lead-info">
      <div class="lead-nome">${esc(l.nome)}</div>
      ${resumo ? `<div class="lead-resumo">${esc(resumo)}</div>` : ''}
      <div class="lead-meta">${telaLarga.matches ? '' : `<span class="etapa-tag" style="background:${etapa.cor}">${etapa.nome}</span> `}${meta}</div>
    </div>
    ${l.telefone ? `<a class="btn-icon btn-wa" href="${linkWhats(l.telefone, textoWhats(l))}" target="_blank" rel="noopener"
        onclick="event.stopPropagation()" title="WhatsApp">💬</a>` : ''}
  </div>`;
}

function soltarLead(ev, etapa) {
  ev.preventDefault();
  ev.currentTarget.classList.remove('over');
  moverEtapa(ev.dataTransfer.getData('text/plain'), etapa);
}

function moverEtapa(id, etapa) {
  const l = leads.find(x => x.id === id);
  if (!l || l.etapa === etapa) return;
  if (etapa === 'perdido') {
    const motivo = prompt('Motivo da perda (opcional):', l.motivoPerda || '');
    if (motivo === null) return;
    l.motivoPerda = motivo.trim();
  }
  l.etapa = etapa;
  l.atualizadoEm = new Date().toISOString();
  saveData();
  renderLeads();
}

function htmlSemEquipe() {
  if (Nuvem.desativado) {
    return `<div class="card setup-card"><div class="icon">🔒</div><h3>Acesso aos leads desativado</h3>
      <p>O administrador da sua equipe desativou seu acesso. Fale com ele para voltar a usar os leads.</p></div>`;
  }
  return `<div class="card setup-card">
    <div class="icon">🤝</div>
    <h3>Monte sua equipe</h3>
    <p>Os leads ficam na nuvem da sua equipe. Crie a equipe agora (você será o administrador e poderá convidar corretores),
      ou abra o link de convite que o seu administrador enviou.</p>
    <div class="form-group"><label>Nome da equipe / imobiliária</label>
      <input type="text" id="novaEquipeNome" placeholder="Ex: Cocal Imóveis"></div>
    <button class="btn btn-primary" id="btnCriarEquipe" onclick="criarEquipeUI()">Criar minha equipe</button>
  </div>`;
}

async function criarEquipeUI() {
  const nome = document.getElementById('novaEquipeNome').value.trim();
  if (!nome) { alert('Informe o nome da equipe'); return; }
  const btn = document.getElementById('btnCriarEquipe');
  btn.disabled = true;
  try {
    await Nuvem.criarEquipe(nome);
    showToast('🎉', 'Equipe criada!', 'Convide corretores em 👤 Minha conta');
  } catch (e) {
    alert(e.message);
    btn.disabled = false;
  }
}

// ===== ficha do lead =====
function textoWhats(l) {
  const primeiro = (l.nome || '').trim().split(/\s+/)[0] || '';
  const eu = meuNome();
  return `Olá${primeiro ? ', ' + primeiro : ''}! Tudo bem?` + (eu ? ` Aqui é ${eu.split(/\s+/)[0]}, corretor de imóveis.` : '');
}

function openLeadModal(id) {
  if (typeof id !== 'string') id = null;
  if (!podeUsarLeads()) { showToast('🤝', 'Crie sua equipe primeiro', 'Na aba Leads'); switchTab('leads'); return; }
  const l = id ? leads.find(x => x.id === id) : null;
  editingLeadId = l ? l.id : null;
  const v = (campo, padrao) => (l && l[campo] != null ? l[campo] : padrao);

  document.getElementById('leadModalTitle').textContent = l ? l.nome : 'Novo lead';
  document.getElementById('ldNome').value = v('nome', '');
  document.getElementById('ldTelefone').value = v('telefone', '');
  document.getElementById('ldEmail').value = v('email', '');
  document.getElementById('ldEtapa').value = v('etapa', 'novo');
  document.getElementById('ldMotivo').value = v('motivoPerda', '');
  document.getElementById('ldFinalidade').value = v('finalidade', 'compra');
  document.getElementById('ldTipo').value = v('tipoImovel', '');
  document.getElementById('ldRegiao').value = v('regiao', '');
  document.getElementById('ldValorMin').value = l && l.valorMin != null ? Number(l.valorMin).toLocaleString('pt-BR') : '';
  document.getElementById('ldValorMax').value = l && l.valorMax != null ? Number(l.valorMax).toLocaleString('pt-BR') : '';
  document.getElementById('ldObs').value = v('obs', '');
  const pag = v('pagamento', []);
  document.getElementById('ldPagamento').innerHTML = PAGAMENTOS.map(([k, nome]) =>
    `<label class="check"><input type="checkbox" value="${k}" ${pag.includes(k) ? 'checked' : ''}> ${nome}</label>`).join('');

  // corretor responsável: só o admin escolhe
  const grupoCorretor = document.getElementById('ldCorretorGrupo');
  if (Nuvem.ehAdmin) {
    const atual = l ? l.corretorId : meuId();
    const opcoes = Nuvem.membros.filter(m => m.ativo || m.user_id === atual);
    document.getElementById('ldCorretor').innerHTML = `<option value="">Sem corretor (a distribuir)</option>` +
      opcoes.map(m => `<option value="${m.user_id}">${esc(m.nome || m.email)}${m.ativo ? '' : ' (inativo)'}</option>`).join('');
    document.getElementById('ldCorretor').value = atual || '';
    grupoCorretor.style.display = 'block';
  } else {
    grupoCorretor.style.display = 'none';
  }

  alternarMotivo();
  document.getElementById('ldExcluir').style.display = l && podeExcluirLead(l) ? 'block' : 'none';
  document.getElementById('ldAcoes').innerHTML = l ? htmlAcoesLead(l) : '';
  document.getElementById('ldCompromissos').innerHTML = l ? htmlCompromissos(l) : '';
  document.getElementById('leadModal').classList.add('open');
  if (!l) setTimeout(() => document.getElementById('ldNome').focus(), 100);
}

function htmlAcoesLead(l) {
  const tel = soDigitos(l.telefone);
  return `<div class="lead-acoes">
    ${tel ? `<a class="acao acao-wa" href="${linkWhats(l.telefone, textoWhats(l))}" target="_blank" rel="noopener">💬 WhatsApp</a>
             <a class="acao" href="tel:${tel}">📞 Ligar</a>` : ''}
    <button class="acao" onclick="agendarDoLead('${l.id}')">📅 Agendar</button>
    <button class="acao" onclick="lembreteDoLead('${l.id}')">🔔 Lembrete</button>
  </div>`;
}

function htmlCompromissos(l) {
  const evs = events.filter(e => e.leadId === l.id).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  const rems = reminders.filter(r => r.leadId === l.id && !r.done);
  if (!evs.length && !rems.length) return '';
  return `<div class="form-group"><label>Compromissos com este lead</label>
    ${evs.map(e => `<div class="lead-compromisso" onclick="closeLeadModal();editEvent('${e.id}')">📅 ${formatDateDisplay(e.date)} ${esc(e.time || '')} — ${esc(e.title)}</div>`).join('')}
    ${rems.map(r => `<div class="lead-compromisso" onclick="closeLeadModal();switchTab('lembretes')">🔔 ${r.date ? formatDateDisplay(r.date) : ''} ${esc(r.time || '')} — ${esc(r.title)}</div>`).join('')}
  </div>`;
}

function alternarMotivo() {
  document.getElementById('ldMotivoGrupo').style.display = document.getElementById('ldEtapa').value === 'perdido' ? 'block' : 'none';
}

function closeLeadModal() {
  document.getElementById('leadModal').classList.remove('open');
}

function saveLead() {
  const nome = document.getElementById('ldNome').value.trim();
  if (!nome) { alert('Informe o nome do lead'); return; }
  const antigo = editingLeadId ? leads.find(x => x.id === editingLeadId) : null;
  const agora = new Date().toISOString();
  const etapa = document.getElementById('ldEtapa').value;
  let corretorId = null;
  if (Nuvem.ativa) corretorId = Nuvem.ehAdmin ? (document.getElementById('ldCorretor').value || null) : (antigo ? antigo.corretorId : meuId());

  const l = {
    ...(antigo || {}),
    id: antigo ? antigo.id : genId(),
    nome,
    telefone: document.getElementById('ldTelefone').value.trim(),
    email: document.getElementById('ldEmail').value.trim(),
    etapa,
    motivoPerda: etapa === 'perdido' ? document.getElementById('ldMotivo').value.trim() : '',
    finalidade: document.getElementById('ldFinalidade').value,
    tipoImovel: document.getElementById('ldTipo').value,
    regiao: document.getElementById('ldRegiao').value.trim(),
    valorMin: lerValor('ldValorMin'),
    valorMax: lerValor('ldValorMax'),
    pagamento: [...document.querySelectorAll('#ldPagamento input:checked')].map(i => i.value),
    obs: document.getElementById('ldObs').value.trim(),
    corretorId,
    criadoPor: antigo ? antigo.criadoPor : meuId(),
    criadoEm: antigo ? antigo.criadoEm : agora,
    atualizadoEm: agora
  };

  const i = antigo ? leads.findIndex(x => x.id === antigo.id) : -1;
  if (i >= 0) leads[i] = l; else leads.push(l);
  saveData();
  closeLeadModal();
  renderLeads();
  if (Nuvem.ativa && Nuvem.ehAdmin && corretorId && corretorId !== meuId() && (!antigo || antigo.corretorId !== corretorId)) {
    showToast('➡️', 'Lead encaminhado', 'para ' + esc(nomeCorretor(corretorId)));
  } else {
    showToast('✅', 'Lead salvo!', esc(l.nome));
  }
}

function deleteLead() {
  const l = leads.find(x => x.id === editingLeadId);
  if (!l || !confirm('Excluir o lead "' + l.nome + '"?')) return;
  leads = leads.filter(x => x.id !== l.id);
  saveData();
  closeLeadModal();
  renderLeads();
  showToast('🗑️', 'Lead excluído', '');
}

function agendarDoLead(id) {
  const l = leads.find(x => x.id === id);
  if (!l) return;
  closeLeadModal();
  switchTab('agenda');
  openEventModal(null, {
    title: 'Visita — ' + l.nome,
    type: 'cliente',
    desc: [l.telefone, resumoBusca(l)].filter(Boolean).join('\n'),
    leadId: l.id
  });
}

function lembreteDoLead(id) {
  const l = leads.find(x => x.id === id);
  if (!l) return;
  closeLeadModal();
  switchTab('lembretes');
  openReminderModal('Retornar para ' + l.nome, l.id);
}

function nomeDoLead(id) {
  const l = id && leads.find(x => x.id === id);
  return l ? l.nome : '';
}

// ===== minha conta e equipe =====
function openContaModal() {
  renderConta();
  document.getElementById('contaModal').classList.add('open');
}
function closeContaModal() { document.getElementById('contaModal').classList.remove('open'); }

function renderConta() {
  const el = document.getElementById('contaConteudo');
  const u = Nuvem.usuario;
  if (!u) { el.innerHTML = ''; return; }
  const m = Nuvem.membro;
  let html = `<div class="form-group"><label>Nome</label><input type="text" id="contaNome" value="${esc(meuNome())}"></div>
    ${m ? `<div class="form-group"><label>Telefone</label><input type="tel" id="contaTelefone" value="${esc(m.telefone || '')}"></div>` : ''}
    <div class="form-group"><label>E-mail</label><input type="email" value="${esc(u.email)}" disabled></div>
    <button class="btn btn-primary" onclick="salvarContaUI()">Salvar meus dados</button>`;

  html += `<h3 class="conta-secao">Equipe</h3>`;
  if (!m) {
    html += `<p class="conta-nota">${Nuvem.desativado ? 'Seu acesso à equipe foi desativado pelo administrador.' :
      'Você ainda não faz parte de uma equipe. Crie a sua na aba 🎯 Leads ou abra um link de convite.'}</p>`;
  } else {
    html += `<p class="conta-nota"><b>${esc(Nuvem.equipe ? Nuvem.equipe.nome : '')}</b> · você é ${m.papel === 'admin' ? 'administrador' : 'corretor'}</p>`;
    if (Nuvem.ehAdmin) {
      html += `<div class="membros">${Nuvem.membros.map(x => `<div class="membro ${x.ativo ? '' : 'inativo'}">
          <div class="membro-info"><b>${esc(x.nome || '(sem nome)')}</b><span>${esc(x.email)}</span></div>
          <select onchange="alterarMembroUI('${x.id}',{papel:this.value})" ${x.user_id === u.id ? 'disabled' : ''}>
            <option value="corretor" ${x.papel === 'corretor' ? 'selected' : ''}>Corretor</option>
            <option value="admin" ${x.papel === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
          ${x.user_id === u.id ? '' : `<button class="btn-icon ${x.ativo ? 'btn-delete' : 'btn-edit'}" title="${x.ativo ? 'Desativar' : 'Reativar'}"
            onclick="alterarMembroUI('${x.id}',{ativo:${!x.ativo}})">${x.ativo ? '⛔' : '↩️'}</button>`}
        </div>`).join('')}</div>
        <button class="btn btn-secondary btn-convite" onclick="gerarConviteUI()">➕ Convidar corretor</button>
        <div id="conviteBox"></div>`;
    }
  }
  html += `<div class="btn-row"><button class="btn btn-secondary" onclick="closeContaModal()">Fechar</button>
    <button class="btn btn-danger" onclick="Nuvem.sair()">Sair</button></div>`;
  el.innerHTML = html;
}

async function salvarContaUI() {
  const nome = document.getElementById('contaNome').value.trim();
  const telEl = document.getElementById('contaTelefone');
  try {
    await Nuvem.salvarPerfil(nome, telEl ? telEl.value.trim() : '');
    showToast('✅', 'Dados salvos', '');
    renderConta();
  } catch (e) { alert(e.message); }
}

async function alterarMembroUI(id, campos) {
  if (campos.ativo === false && !confirm('Desativar este membro? Ele perde o acesso aos leads; os leads dele continuam com você para redistribuir.')) {
    renderConta();
    return;
  }
  try { await Nuvem.atualizarMembro(id, campos); renderConta(); renderLeads(); }
  catch (e) { alert(e.message); renderConta(); }
}

async function gerarConviteUI() {
  const box = document.getElementById('conviteBox');
  box.innerHTML = '<p class="conta-nota">Gerando link…</p>';
  try {
    const link = await Nuvem.gerarConvite('corretor');
    const texto = `Olá! Estou te convidando para a equipe ${Nuvem.equipe ? Nuvem.equipe.nome : ''} na Agenda Corretor. Abra o link e crie sua conta: ${link}`;
    box.innerHTML = `<div class="convite-link"><input type="text" value="${esc(link)}" readonly onclick="this.select()">
      <div class="btn-row">
        <button class="btn btn-secondary" onclick="navigator.clipboard.writeText('${esc(link)}').then(()=>showToast('📋','Link copiado',''))">📋 Copiar</button>
        <a class="btn btn-primary btn-link" href="https://wa.me/?text=${encodeURIComponent(texto)}" target="_blank" rel="noopener">💬 Enviar</a>
      </div>
      <p class="conta-nota">O link vale para uma pessoa e expira em 7 dias.</p></div>`;
  } catch (e) {
    box.innerHTML = `<p class="conta-nota" style="color:var(--danger)">${esc(e.message)}</p>`;
  }
}

function aoMudarEquipe() {
  renderLeads();
  if (document.getElementById('contaModal').classList.contains('open')) renderConta();
}
