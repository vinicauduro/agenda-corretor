/* ===== Vitrine pública do loteamento — página que o cliente final abre ===== */
'use strict';

const $ = s => document.querySelector(s);
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function fmtNum(v, dec = 2) { return (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
function fmtMoney(v) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function num(v) { const n = parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')); return isNaN(n) ? 0 : n; }
function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function naturalCmp(a, b) { return String(a ?? '').localeCompare(String(b ?? ''), 'pt-BR', { numeric: true, sensitivity: 'base' }); }
function cmpLote(a, b) { return naturalCmp(a.quadra, b.quadra) || naturalCmp(a.numero, b.numero); }

const STATUS_LABEL = { disponivel: 'Disponível', reservado: 'Reservado', vendido: 'Vendido', indisponivel: 'Indisponível' };
const V = { dados: null, slug: '', lotes: [], filtro: { quadra: '', areaMin: 0, precoMax: 0, soDisp: true }, pv: null, enviando: false };

// ---------------------------------------------------------------- modal
function abrirModal({ title, body, footer = '' }) {
  $('#modalTitle').innerHTML = title;
  $('#modalBody').innerHTML = body;
  $('#modalFoot').innerHTML = footer;
  $('#modalFoot').style.display = footer ? 'flex' : 'none';
  $('#modalBody').scrollTop = 0;
  $('#modalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function fecharModal() { $('#modalOverlay').classList.remove('open'); document.body.style.overflow = ''; }
function toast(icon, title, body, isErr) {
  const t = document.createElement('div');
  t.className = 'toast' + (isErr ? ' err' : '');
  t.innerHTML = `<div class="t">${icon} ${esc(title)}</div>${body ? `<div>${esc(body)}</div>` : ''}`;
  $('#toastContainer').appendChild(t);
  setTimeout(() => t.remove(), 4200);
}

// ---------------------------------------------------------------- WhatsApp
function zapLink(texto) {
  const fone = String((V.dados && V.dados.whatsapp) || '').replace(/\D/g, '');
  if (!fone) return null;
  const full = fone.length <= 11 ? '55' + fone : fone;
  return 'https://wa.me/' + full + (texto ? '?text=' + encodeURIComponent(texto) : '');
}
function zapLote(l) {
  const nome = V.dados.loteamento.nome;
  return zapLink(l ? `Olá! Vi o ${nome} no site e tenho interesse no lote ${l.quadra}-${l.numero} (${fmtNum(l.area, 0)} m²).`
    : `Olá! Vi o ${nome} no site e gostaria de mais informações.`);
}

// ---------------------------------------------------------------- carga
async function carregar() {
  const par = new URLSearchParams(location.search);
  V.slug = (par.get('l') || par.get('lote') || location.hash.replace('#', '') || '').trim();
  const cfg = window.GL_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) return falha('Vitrine indisponível', 'Esta página funciona com a versão em nuvem do sistema.');
  if (!V.slug) return falha('Link incompleto', 'Peça ao corretor o link completo do loteamento.');
  try {
    const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: false } });
    V.client = client;
    const { data, error } = await client.rpc('vitrine_dados', { p_slug: V.slug });
    if (error) throw new Error(error.message);
    if (!data) return falha('Vitrine não encontrada', 'O link pode ter mudado ou a divulgação deste loteamento foi encerrada.');
    V.dados = data;
    V.lotes = (data.lotes || []).map(l => Object.assign({}, l, { area: Number(l.area) || 0, preco: l.preco == null ? null : Number(l.preco) }));
    render();
  } catch (e) {
    falha('Não foi possível carregar', e.message || 'Tente novamente em instantes.');
  }
}
function falha(titulo, msg) {
  $('#vApp').innerHTML = `<div class="v-carregando"><div style="font-size:2.4rem">🏘️</div><h1 style="font-size:1.2rem;margin:10px 0 6px;color:var(--text)">${esc(titulo)}</h1><p>${esc(msg)}</p></div>`;
}

// ---------------------------------------------------------------- render
function render() {
  const d = V.dados, lot = d.loteamento;
  document.title = d.titulo + (lot.cidade ? ' · ' + lot.cidade : '');
  const ogT = $('#ogTitle'), ogD = $('#ogDesc');
  if (ogT) ogT.setAttribute('content', document.title);
  if (ogD) ogD.setAttribute('content', d.chamada || `Lotes à venda no ${lot.nome}.`);

  const disp = V.lotes.filter(l => l.status === 'disponivel');
  const areas = disp.map(l => l.area).filter(a => a > 0).sort((a, b) => a - b);
  const precos = disp.map(l => l.preco).filter(p => p > 0).sort((a, b) => a - b);
  const quadras = [...new Set(V.lotes.map(l => l.quadra))].sort();
  const zap = zapLote(null);

  $('#vApp').innerHTML = `
    <div class="v-top">
      <div class="emp">🏘️ <span>${esc(d.empresa || lot.nome)}</span></div>
      ${zap ? `<a class="v-zap" href="${zap}" target="_blank" rel="noopener">💬 Falar no WhatsApp</a>` : ''}
    </div>
    <div class="v-hero"><div class="v-wrap">
      <h1>${esc(d.titulo)}</h1>
      <div class="local">${esc([lot.endereco, lot.cidade].filter(Boolean).join(' · ') || 'Lotes à venda')}</div>
      ${d.chamada ? `<p class="chamada">${esc(d.chamada)}</p>` : (lot.descricao ? `<p class="chamada">${esc(lot.descricao)}</p>` : '')}
      <div class="v-nums">
        <div class="v-num"><b>${disp.length}</b><small>lotes disponíveis</small></div>
        ${areas.length ? `<div class="v-num"><b>${fmtNum(areas[0], 0)} m²</b><small>a partir de</small></div>` : ''}
        ${precos.length ? `<div class="v-num"><b>${fmtMoney(precos[0])}</b><small>a partir de</small></div>` : ''}
        <div class="v-num"><b>${V.lotes.length}</b><small>lotes no total</small></div>
      </div>
    </div></div>

    ${V.lotes.some(l => l.pts && l.pts.length >= 3) || V.lotes.length ? `
    <div class="v-sec"><div class="v-wrap">
      <h2>🗺️ Planta do loteamento</h2>
      <div class="sub">Toque em um lote para ver os detalhes. Arraste para mover e use os botões para aproximar.</div>
      <div id="vPlanta"></div>
      <div class="v-legend">
        <span><i style="background:var(--st-disponivel)"></i>Disponível</span>
        <span><i style="background:var(--st-reservado)"></i>Reservado</span>
        <span><i style="background:var(--st-vendido)"></i>Vendido</span>
        <span><i style="background:var(--st-bloqueado)"></i>Indisponível</span>
      </div>
    </div></div>` : ''}

    <div class="v-sec"><div class="v-wrap">
      <h2>📋 Lotes</h2>
      <div class="sub" id="vResumo"></div>
      <div class="v-filtros">
        <div><label for="fQuadra">Quadra</label><select id="fQuadra"><option value="">Todas</option>${quadras.map(q => `<option value="${esc(q)}">${esc(q)}</option>`).join('')}</select></div>
        <div><label for="fArea">Área mínima (m²)</label><input id="fArea" type="number" inputmode="numeric" placeholder="qualquer"></div>
        ${d.mostrarPreco ? `<div><label for="fPreco">Valor até (R$)</label><input id="fPreco" type="number" inputmode="numeric" placeholder="qualquer"></div>` : ''}
        <div><label style="display:flex;align-items:center;gap:6px;text-transform:none;font-size:0.86rem;color:var(--text)"><input type="checkbox" id="fDisp" checked style="width:auto;min-width:0"> Só disponíveis</label></div>
      </div>
      <div class="v-grid" id="vGrid"></div>
    </div></div>

    <div class="v-foot"><div class="v-wrap">
      ${zap ? `<a class="v-zap" href="${zap}" target="_blank" rel="noopener" style="margin-bottom:14px">💬 Falar no WhatsApp</a><br>` : ''}
      ${esc(d.empresa || '')} · Valores e disponibilidade sujeitos a alteração sem aviso prévio.
    </div></div>`;

  const box = $('#vPlanta');
  if (box) {
    box.className = 'planta-wrap';
    V.pv = new PlantaView(box, { onLotClick: id => abrirLote(id) });
    V.pv.setData({ id: 'v', planta: lot.planta || null }, V.lotes, lot.planta && lot.planta.img ? 'imagem' : 'esquema');
  }
  ['fQuadra', 'fArea', 'fPreco', 'fDisp'].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('input', aplicarFiltro); });
  aplicarFiltro();
}

function filtrados() {
  const f = V.filtro;
  return V.lotes.filter(l => {
    if (f.soDisp && l.status !== 'disponivel') return false;
    if (f.quadra && l.quadra !== f.quadra) return false;
    if (f.areaMin && l.area < f.areaMin) return false;
    if (f.precoMax && !(l.preco > 0 && l.preco <= f.precoMax)) return false;
    return true;
  });
}
function aplicarFiltro() {
  V.filtro = { quadra: val('fQuadra'), areaMin: num(val('fArea')), precoMax: num(val('fPreco')), soDisp: !!(document.getElementById('fDisp') || {}).checked };
  const lista = filtrados();
  const resumo = $('#vResumo');
  if (resumo) resumo.textContent = `${lista.length} lote(s) ${V.filtro.soDisp ? 'disponíveis' : ''} ${V.filtro.quadra ? 'na quadra ' + V.filtro.quadra : ''}`.replace(/\s+/g, ' ').trim();
  if (V.pv) V.pv.setHighlight(lista.length === V.lotes.length ? null : lista.map(l => l.id));
  const grid = $('#vGrid');
  if (!grid) return;
  grid.innerHTML = lista.length ? lista.map(l => `
    <div class="v-card ${esc(l.status)}">
      <div class="tit"><span>${esc(l.quadra)} · ${esc(l.numero)}</span><span class="v-tag ${esc(l.status)}">${STATUS_LABEL[l.status] || ''}</span></div>
      <div class="med">${l.area ? fmtNum(l.area, 0) + ' m²' : 'Área sob consulta'}${l.frente ? ' · ' + fmtNum(l.frente, 1) + ' m de frente' : ''}</div>
      ${l.preco > 0 ? `<div class="preco">${fmtMoney(l.preco)}</div>` : '<div class="preco" style="font-size:0.95rem">Valor sob consulta</div>'}
      <button onclick="abrirLote('${esc(l.id)}')"${l.status === 'vendido' || l.status === 'indisponivel' ? ' disabled' : ''}>${l.status === 'disponivel' ? 'Tenho interesse' : l.status === 'reservado' ? 'Entrar na fila' : 'Indisponível'}</button>
    </div>`).join('') : '<div class="v-vazio">Nenhum lote com esses filtros. Tente ampliar a busca ou fale com a gente pelo WhatsApp.</div>';
}

// ---------------------------------------------------------------- lote + interesse
function abrirLote(id) {
  const l = V.lotes.find(x => x.id === id); if (!l) return;
  const zap = zapLote(l);
  const disp = l.status === 'disponivel' || l.status === 'reservado';
  abrirModal({
    title: `Lote ${esc(l.quadra)} · ${esc(l.numero)}`,
    body: `
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px"><span class="v-tag ${esc(l.status)}">${STATUS_LABEL[l.status] || ''}</span>
      ${l.preco > 0 ? `<b style="font-size:1.2rem;color:var(--primary-dark)">${fmtMoney(l.preco)}</b>` : '<b>Valor sob consulta</b>'}</div>
      <div class="med" style="color:var(--muted);margin-bottom:14px">
        ${l.area ? fmtNum(l.area, 0) + ' m² de área' : 'Área sob consulta'}${l.frente ? ' · ' + fmtNum(l.frente, 1) + ' m de frente' : ''}${l.fundos ? ' · ' + fmtNum(l.fundos, 1) + ' m de fundos' : ''}
      </div>
      ${disp ? `<div class="v-form">
        <div><label for="iNome">Seu nome *</label><input id="iNome" autocomplete="name" placeholder="Nome completo"></div>
        <div><label for="iFone">WhatsApp / telefone *</label><input id="iFone" type="tel" inputmode="tel" autocomplete="tel" placeholder="(48) 99999-9999"></div>
        <div><label for="iEmail">E-mail (opcional)</label><input id="iEmail" type="email" autocomplete="email" placeholder="voce@email.com"></div>
        <div><label for="iMsg">Mensagem (opcional)</label><textarea id="iMsg" placeholder="Quero saber as condições de parcelamento"></textarea></div>
        <div id="iErro"></div>
        <small style="color:var(--muted)">Seus dados vão direto para a equipe de vendas e são usados só para este atendimento.</small>
      </div>` : '<p>Este lote não está disponível no momento. Fale com a gente para conhecer outras opções.</p>'}`,
    footer: `${zap ? `<a class="btn btn-wa" href="${zap}" target="_blank" rel="noopener" style="text-decoration:none;text-align:center">💬 WhatsApp</a>` : ''}
      ${disp ? `<button class="btn btn-primary" id="iEnviar" onclick="enviarInteresse('${esc(l.id)}')">Enviar interesse</button>` : '<button class="btn btn-secondary" onclick="fecharModal()">Fechar</button>'}`
  });
  if (V.pv) { V.pv.selectedId = id; V.pv.render(); }
  setTimeout(() => { const n = document.getElementById('iNome'); if (n) n.focus(); }, 80);
}

async function enviarInteresse(loteId) {
  if (V.enviando) return;
  const nome = val('iNome'), fone = val('iFone');
  const erro = $('#iErro');
  const mostra = m => { if (erro) erro.innerHTML = `<div class="v-erro">${esc(m)}</div>`; };
  if (nome.length < 3) return mostra('Informe seu nome completo.');
  if (fone.replace(/\D/g, '').length < 10) return mostra('Informe um telefone com DDD.');
  const btn = document.getElementById('iEnviar');
  V.enviando = true; if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }
  try {
    const { error } = await V.client.rpc('registrar_lead', {
      p_slug: V.slug,
      p_dados: { nome, telefone: fone, email: val('iEmail'), msg: val('iMsg'), loteId }
    });
    if (error) throw new Error(error.message);
    const l = V.lotes.find(x => x.id === loteId);
    const zap = zapLote(l);
    abrirModal({
      title: 'Recebemos seu interesse',
      body: `<div class="v-ok"><div class="ic">✅</div>
        <p style="margin:10px 0 6px"><b>Obrigado, ${esc(nome.split(' ')[0])}!</b></p>
        <p style="color:var(--muted)">A equipe de vendas vai entrar em contato pelo telefone informado.</p>
        ${zap ? '<p style="margin-top:14px">Quer falar agora mesmo?</p>' : ''}</div>`,
      footer: `${zap ? `<a class="btn btn-wa" href="${zap}" target="_blank" rel="noopener" style="text-decoration:none;text-align:center">💬 Chamar no WhatsApp</a>` : ''}<button class="btn btn-secondary" onclick="fecharModal()">Fechar</button>`
    });
    toast('✅', 'Interesse enviado', 'Logo entramos em contato.');
  } catch (e) {
    mostra(e.message || 'Não foi possível enviar agora. Tente pelo WhatsApp.');
    if (btn) { btn.disabled = false; btn.textContent = 'Enviar interesse'; }
  } finally { V.enviando = false; }
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharModal(); });
$('#modalOverlay').addEventListener('click', e => { if (e.target.id === 'modalOverlay') fecharModal(); });
carregar();
