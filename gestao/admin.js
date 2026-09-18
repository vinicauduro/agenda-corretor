/* ===== Gestão de Loteamento — administração ===== */
'use strict';

function renderAdminTab() {
  updateTopbars();
  const pend = db.reservas.filter(r => r.status === 'pendente').length;
  const b = $('#aBadgeReservas'); b.style.display = pend ? '' : 'none'; b.textContent = pend;
  const lotAtual = curLot();
  const novos = lotAtual ? leadsDo(lotAtual.id).filter(l => (l.status || 'novo') === 'novo').length : 0;
  const bl = $('#aBadgeLeads'); if (bl) { bl.style.display = novos ? '' : 'none'; bl.textContent = novos; }
  const fab = $('#fab'); fab.classList.remove('show');
  const tab = state.tab;
  if (!db.loteamentos.length && tab !== 'cadastros' && tab !== 'emp') {
    $('#av-' + tab).innerHTML = `<div class="card"><div class="empty"><div class="ic">🏗️</div><p><b>Bem-vindo!</b> Cadastre o seu primeiro empreendimento para começar.</p><div class="btn-row" style="justify-content:center"><button class="btn btn-primary" style="flex:none" onclick="abrirLoteamentoForm()">＋ Cadastrar empreendimento</button><button class="btn btn-secondary" style="flex:none" onclick="carregarDemo()">✨ Ver com dados de exemplo</button></div></div></div>`;
    return;
  }
  aplicarPermissoesNasAbas();
  const bloqueia = (chave, oQue) => { if (pode(chave)) return false; $('#av-' + state.tab).innerHTML = semPermissaoHtml(oQue); return true; };
  if (tab === 'painel') renderPainel();
  else if (tab === 'emp') renderEmpreendimentos();
  else if (tab === 'vendas') { if (!bloqueia('vendas.criar', 'vendas')) { renderAVendas(); if (pode('vendas.criar')) fabShow('novaVendaEscolhendoEmp()'); } }
  else if (tab === 'recebiveis') { if (!bloqueia('financeiro.ver', 'recebíveis')) { if (state.sub.rec === 'cobranca') renderCobranca(); else renderRecebiveis(); } }
  else if (tab === 'relatorios') renderRelatorios();
  else if (tab === 'cadastros') renderCadastros();
}

/* ================================================================ EMPREENDIMENTOS
   Aqui mora tudo que é de um empreendimento só: planta, lotes, reservas, obra e vitrine.
   Vendas, recebíveis e relatórios ficam de fora, porque são da empresa inteira. */
const EMP_SUBS = [
  ['resumo', '📋 Resumo', null],
  ['planta', '🗺️ Planta', 'planta.editar'],
  ['lotes', '📦 Lotes', 'lotes.editar'],
  ['reservas', '📝 Reservas', 'reservas.aprovar'],
  ['custos', '🧾 Obra e custos', 'custos.ver'],
  ['leads', '🎯 Leads', 'leads.ver']
];
/* Numa carteira de imóveis de terceiros não existe planta, lote, reserva nem obra: o imóvel
   não é seu, você só administra o recebível. A aba de custos só reaparece se a carteira já
   tiver lançamento, para não esconder dado que alguém já registrou. */
function empSubsVisiveis(lot) {
  if (!lot) return EMP_SUBS.filter(([, , chave]) => !chave || pode(chave));
  const fora = ehCarteira(lot) ? ['planta', 'lotes', 'reservas'].concat(custosDo(lot.id).length ? [] : ['custos']) : [];
  return EMP_SUBS.filter(([k, , chave]) => (!chave || pode(chave)) && !fora.includes(k));
}
function abrirEmpreendimento(id, sub) {
  state.empAberto = id; if (id) setCurLotSilencioso(id);
  if (sub) state.empSub = sub;
  switchTab('emp');
}
function fecharEmpreendimento() { state.empAberto = null; renderEmpreendimentos(); }
function renderEmpreendimentos() {
  const v = $('#av-emp');
  const aberto = state.empAberto ? getLoteamento(state.empAberto) : null;
  if (!aberto) { v.innerHTML = listaEmpreendimentosHtml(); return; }
  const subs = empSubsVisiveis(aberto);
  if (!subs.some(s => s[0] === state.empSub)) state.empSub = subs.length ? subs[0][0] : 'resumo';
  v.innerHTML = `
    <div class="row-between mb">
      <div><button class="btn btn-secondary btn-sm" onclick="fecharEmpreendimento()">‹ Empreendimentos</button></div>
      <div class="small muted"><b>${esc(aberto.nome)}</b> · ${esc(empLabel(aberto))}${aberto.cidade ? ' · ' + esc(aberto.cidade) : ''}</div>
    </div>
    <div class="subtabs">${subs.map(([k, rot]) => `<div class="chip ${state.empSub === k ? 'active' : ''}" onclick="state.empSub='${k}';renderEmpreendimentos()">${rot}</div>`).join('')}</div>
    <div id="empConteudo"></div>`;
  const alvo = $('#empConteudo');
  const fab = $('#fab'); fab.classList.remove('show');
  if (state.empSub === 'resumo') alvo.innerHTML = cadLoteamentoHtml();
  else if (state.empSub === 'planta') renderPlantaEditor(alvo);
  else if (state.empSub === 'lotes') { renderALotes(alvo); fabShow('abrirLoteForm()'); }
  else if (state.empSub === 'reservas') { renderAReservas(alvo); fabShow('abrirReservaAdminForm()'); }
  else if (state.empSub === 'custos') { renderCustos(alvo); if (pode('custos.editar')) fabShow('abrirCustoForm()'); }
  else if (state.empSub === 'leads') renderLeads(alvo);
}
function listaEmpreendimentosHtml() {
  const podeCriar = pode('config.editar') || pode('lotes.editar');
  return `<div class="card"><h3>🏗️ Empreendimentos ${podeCriar ? '<span class="h-actions"><button class="btn btn-primary btn-sm" onclick="abrirLoteamentoForm()">＋ Novo</button></span>' : ''}</h3>
    <p class="help mb">Cada empreendimento tem a sua planta, os seus lotes, a sua obra e a sua conta de cobrança. Vendas, recebíveis e relatórios ficam nas abas de cima, com todos os empreendimentos juntos.</p>
    ${db.loteamentos.map(l => {
      const ls = lotesDo(l.id);
      const vend = db.vendas.filter(v => v.loteamentoId === l.id && v.status !== 'distrato');
      const pend = db.reservas.filter(r => r.loteamentoId === l.id && reservaStatus(r) === 'pendente').length;
      return `<div class="item" onclick="abrirEmpreendimento('${l.id}')"><div class="info">
        <div class="title">${ehCarteira(l) ? '🏠' : '🏘️'} ${esc(l.nome)} <span class="badge neutral">${esc(empLabel(l))}</span>${pend ? ` <span class="badge pendente">${pend} reserva(s) a aprovar</span>` : ''}</div>
        <div class="meta">${esc(l.cidade || '')}${ehCarteira(l) ? `<span>· ${vend.length} venda(s)</span>` : `<span>· ${ls.length} lotes</span><span>· ${ls.filter(x => x.status === 'vendido').length} vendidos</span><span>· ${ls.filter(x => x.status === 'disponivel').length} disponíveis</span>`}</div>
      </div><div class="side"><div class="value">${fmtMoneyShort(vend.reduce((s, x) => s + num(x.valorTotal), 0))}</div><span class="tiny muted">vendido</span></div></div>`;
    }).join('') || `<div class="empty"><div class="ic">🏗️</div><p><b>Nenhum empreendimento ainda.</b></p><p class="small">Cadastre um loteamento, com planta e lotes, ou uma carteira para imóveis avulsos.</p></div>`}</div>`;
}
function fabShow(action) { const f = $('#fab'); f.classList.add('show'); f.setAttribute('onclick', action); }

// ================================================================ PAINEL
function renderPainel() {
  const esc0 = escopoAtual(); const v = $('#av-painel');
  /* O painel é da empresa inteira; o filtro em cima restringe a um empreendimento. */
  const emps = esc0 ? db.loteamentos.filter(l => l.id === esc0) : db.loteamentos;
  const lot = esc0 ? getLoteamento(esc0) : (db.loteamentos.length === 1 ? db.loteamentos[0] : null);
  const ls = db.lotes.filter(l => noEscopo(l, esc0));
  const cnt = s => ls.filter(l => l.status === s).length;
  const vgv = ls.reduce((s, l) => s + num(l.preco), 0);
  const vendas = vendasDo(esc0).filter(x => x.status !== 'distrato');
  const vendido = vendas.reduce((s, x) => s + num(x.valorTotal), 0);
  const recs = recebiveisDo(esc0);
  const recebido = recs.reduce((s, r) => s + num(r.valorPago), 0);
  const aReceber = recs.reduce((s, r) => s + recRestante(r), 0);
  const atrasados = recs.filter(r => recStatus(r) === 'atrasado');
  const atrasado = atrasados.reduce((s, r) => s + recRestante(r), 0);
  const cs = custosDo(esc0);
  const custoTotal = cs.reduce((s, c) => s + num(c.valor), 0);
  const custoPago = cs.filter(c => c.status === 'pago').reduce((s, c) => s + num(c.valor), 0);
  const custosAtr = cs.filter(c => custoStatus(c) === 'atrasado');
  const comissoesPend = vendas.filter(x => !x.comissaoPaga).reduce((s, x) => s + num(x.comissaoValor), 0);
  const orcTotal = emps.reduce((s, e) => s + Object.values(e.orcamento || {}).reduce((a, x) => a + num(x), 0), 0);
  const resPend = db.reservas.filter(r => noEscopo(r, esc0) && r.status === 'pendente');
  const resExp = db.reservas.filter(r => noEscopo(r, esc0) && reservaStatus(r) === 'expirada');
  const resVencendo = db.reservas.filter(r => noEscopo(r, esc0) && reservaStatus(r) === 'aprovada' && daysBetween(todayStr(), r.validade) <= 2);
  const mesKey = todayStr().slice(0, 7);
  const prevMes = recs.filter(r => monthKey(r.vencimento) === mesKey).reduce((s, r) => s + recRestante(r), 0);
  const custosMes = cs.filter(c => c.status !== 'pago' && monthKey(c.vencimento || c.dataCompetencia) === mesKey).reduce((s, c) => s + num(c.valor), 0);
  const pctVend = ls.length ? Math.round(cnt('vendido') / ls.length * 100) : 0;

  let alerts = '';
  if (resPend.length) alerts += `<div class="alert warn" onclick="abrirEmpreendimento('${resPend[0].loteamentoId}','reservas')"><span><b>${resPend.length} reserva(s) aguardando aprovação</b></span><span>›</span></div>`;
  if (resExp.length) alerts += `<div class="alert" onclick="aSetFiltroRes('expirada')"><span><b>${resExp.length} reserva(s) vencida(s)</b> — libere o lote ou renove</span><span>›</span></div>`;
  if (resVencendo.length) alerts += `<div class="alert info" onclick="abrirEmpreendimento('${resVencendo[0].loteamentoId}','reservas')"><span><b>${resVencendo.length} reserva(s) vencem em até 2 dias</b></span><span>›</span></div>`;
  if (atrasados.length) alerts += `<div class="alert" onclick="abrirPainelCobranca()"><span><b>${atrasados.length} parcela(s) em atraso</b> — ${fmtMoney(atrasado)} · cobrar</span><span>›</span></div>`;
  if (custosAtr.length) alerts += `<div class="alert" onclick="aSetFiltroCusto('atrasado')"><span><b>${custosAtr.length} conta(s) a pagar vencida(s)</b> — ${fmtMoney(custosAtr.reduce((s, c) => s + num(c.valor), 0))}</span><span>›</span></div>`;
  const semPreco = ls.filter(l => !num(l.preco)).length;
  if (semPreco) alerts += `<div class="alert info" onclick="abrirEmpreendimento('${(ls.find(l => !num(l.preco)) || {}).loteamentoId}','lotes')"><span><b>${semPreco} lote(s) sem preço</b></span><span>›</span></div>`;
  if (!alerts) alerts = `<div class="alert ok"><span>Tudo em dia. 👍</span></div>`;

  v.innerHTML = `
    ${db.loteamentos.length > 1 ? `<div class="filters">${escopoSelectHtml('renderPainel()')}</div>` : ''}
    ${alerts}
    <div class="status-strip">
      <div class="pill"><span class="dot disponivel"></span><div><b>${cnt('disponivel')}</b><br>disponíveis</div></div>
      <div class="pill"><span class="dot reservado"></span><div><b>${cnt('reservado')}</b><br>reservados</div></div>
      <div class="pill"><span class="dot vendido"></span><div><b>${cnt('vendido')}</b><br>vendidos</div></div>
      <div class="pill"><span class="dot bloqueado"></span><div><b>${cnt('bloqueado')}</b><br>indispon.</div></div>
    </div>
    <div class="kpi-grid">
      <div class="kpi c-primary"><div class="lbl">VGV (tabela)</div><div class="val">${fmtMoneyShort(vgv)}</div><div class="sub">${ls.length} lotes · ${pctVend}% vendido</div></div>
      <div class="kpi c-blue"><div class="lbl">Vendido</div><div class="val">${fmtMoneyShort(vendido)}</div><div class="sub">${vendas.length} venda(s)</div></div>
      <div class="kpi c-green"><div class="lbl">Recebido</div><div class="val">${fmtMoneyShort(recebido)}</div><div class="sub">${vendido ? Math.round(recebido / vendido * 100) : 0}% do vendido</div></div>
      <div class="kpi c-amber"><div class="lbl">A receber</div><div class="val">${fmtMoneyShort(aReceber)}</div><div class="sub">${fmtMoneyShort(prevMes)} previsto no mês</div></div>
      <div class="kpi c-red" onclick="abrirPainelCobranca()" style="cursor:pointer"><div class="lbl">Em atraso</div><div class="val">${fmtMoneyShort(atrasado)}</div><div class="sub">${atrasados.length} parcela(s) · cobrar ›</div></div>
      <div class="kpi c-red"><div class="lbl">Custos</div><div class="val">${fmtMoneyShort(custoTotal)}</div><div class="sub">${fmtMoneyShort(custoPago)} pagos · ${fmtMoneyShort(custosMes)} a pagar no mês</div></div>
      <div class="kpi ${recebido - custoPago >= 0 ? 'c-green' : 'c-red'}"><div class="lbl">Caixa (receb. − pagos)</div><div class="val">${fmtMoneyShort(recebido - custoPago)}</div><div class="sub">Comissões a pagar ${fmtMoneyShort(comissoesPend)}</div></div>
      <div class="kpi ${vgv - (orcTotal || custoTotal) >= 0 ? 'c-green' : 'c-red'}"><div class="lbl">Resultado projetado</div><div class="val">${fmtMoneyShort(vgv - Math.max(orcTotal, custoTotal))}</div><div class="sub">VGV − ${orcTotal ? 'orçamento' : 'custos'} (${fmtMoneyShort(Math.max(orcTotal, custoTotal))})</div></div>
    </div>
    <div class="grid2">
      <div class="card"><h3>📈 Fluxo previsto (12 meses)</h3><canvas class="chart" id="chartFluxo" height="200"></canvas><div class="legend-list" style="flex-direction:row;gap:14px"><div><span class="dot" style="background:#2563eb"></span>Recebimentos previstos</div><div><span class="dot" style="background:#f97316"></span>Custos previstos</div></div></div>
      <div class="card"><h3>🥧 Situação dos lotes</h3><canvas class="chart" id="chartLotes" height="200"></canvas><div class="legend-list" id="chartLotesLegend"></div></div>
    </div>
    <div class="grid2">
      <div class="card"><h3>📅 Próximos vencimentos (a receber)</h3>${recs.filter(r => recStatus(r) !== 'pago').sort((a, b) => a.vencimento.localeCompare(b.vencimento)).slice(0, 6).map(r => recRowHtml(r)).join('') || '<p class="help">Nenhum recebível pendente.</p>'}</div>
      <div class="card"><h3>🕒 Atividade recente</h3><div class="act-log">${db.log.slice(-10).reverse().map(e => `<div><span class="when">${fmtDateTime(e.ts)}</span><span>${esc(e.msg)}</span></div>`).join('') || '<p class="help">Sem atividades.</p>'}</div></div>
    </div>`;
  drawFluxoChart($('#chartFluxo'), recs, cs);
  drawDonut($('#chartLotes'), $('#chartLotesLegend'), [
    { label: 'Disponíveis', value: cnt('disponivel'), color: '#22c55e' }, { label: 'Reservados', value: cnt('reservado'), color: '#f59e0b' },
    { label: 'Vendidos', value: cnt('vendido'), color: '#ef4444' }, { label: 'Indisponíveis', value: cnt('bloqueado'), color: '#94a3b8' }
  ]);
}

// ================================================================ PLANTA (editor)
function renderPlantaEditor(alvo) {
  const lot = curLot(); const v = alvo || alvoDoEmp('av-planta');
  const ls = lotesDo(lot.id);
  const hasImg = !!(lot.planta && lot.planta.img);
  if (!state.plantaAdmin || !v.querySelector('.planta-wrap')) {
    v.innerHTML = `
      <div class="toolbar">
        <label class="btn btn-primary btn-sm" style="cursor:pointer">📄 ${hasImg ? 'Importar outro PDF/DXF' : 'Importar planta (PDF ou DXF)'}<input type="file" accept=".pdf,.dxf,application/pdf" style="display:none" onchange="importarPlantaPDF(this)"></label>
        <label class="btn btn-outline btn-sm" style="cursor:pointer">🖼️ ${hasImg ? 'Trocar por imagem' : 'Enviar imagem (JPG/PNG)'}<input type="file" accept="image/*" style="display:none" onchange="uploadPlanta(this)"></label>
        ${hasImg ? `<button class="btn btn-outline-danger btn-sm" onclick="removerPlanta()">Remover imagem</button>` : ''}
        <select id="aPlantaModo" onchange="aTrocarModo(this.value)" style="width:auto;flex:none;padding:6px 10px;font-size:0.8rem"><option value="imagem" ${!hasImg ? 'disabled' : ''}>🗺️ Planta real</option><option value="esquema">▦ Esquemática</option></select>
      </div>
      <div class="planta-layout">
        <div>
          <div class="tools" id="aTools"></div>
          <div id="aPlantaBox" class="planta-wrap tall"></div>
          <div class="legend"><span><span class="dot disponivel"></span>Disponível</span><span><span class="dot reservado"></span>Reservado</span><span><span class="dot vendido"></span>Vendido</span><span><span class="dot bloqueado"></span>Indisponível</span></div>
        </div>
        <div>
          <div class="card" style="padding:10px 12px"><h3 style="margin-bottom:6px">Lotes <span class="small muted" id="aPosInfo"></span></h3>
            <div class="filters" style="margin-bottom:8px"><input type="text" id="aPickBusca" placeholder="🔎 Filtrar" oninput="renderLotePicker()"><button class="btn btn-primary btn-sm" onclick="abrirLoteForm()" title="Cadastrar um lote novo e posicionar na planta">＋ Lote</button></div>
            <label class="check small" style="margin-bottom:8px"><input type="checkbox" id="aPickSemPos" onchange="renderLotePicker()"> Só lotes sem posição</label>
            <div class="lote-picker" id="lotePicker"></div>
            <p class="help mt" id="aEditorHelp"></p>
          </div>
        </div>
      </div>`;
    state.plantaAdmin = new PlantaView($('#aPlantaBox'), { editable: true, onLotClick: id => selecionarLoteEditor(id), onShape: pts => salvarForma(pts) });
  }
  const sel = $('#aPlantaModo');
  const modo = prefs.aModo && (prefs.aModo === 'esquema' || hasImg) ? prefs.aModo : (hasImg ? 'imagem' : 'esquema');
  sel.value = modo;
  const pv = state.plantaAdmin;
  pv.setData(lot, ls, modo);
  if (state.editorLoteId && !ls.find(l => l.id === state.editorLoteId)) state.editorLoteId = null;
  pv.setSelected(state.editorLoteId);
  renderEditorTools();
  renderLotePicker();
}
function aTrocarModo(m) { prefs.aModo = m; savePrefs(); state.plantaAdmin.setTool('select'); renderPlantaEditor(); }
function renderEditorTools() {
  const pv = state.plantaAdmin; const lot = curLot();
  const hasImg = !!(lot.planta && lot.planta.img);
  const box = $('#aTools'); const help = $('#aEditorHelp');
  if (pv.mode !== 'imagem') {
    box.innerHTML = `<span class="small muted">Modo esquemático: os lotes são organizados automaticamente por quadra. ${hasImg ? 'Mude para "Planta real" para desenhar sobre a imagem.' : 'Importe a planta em PDF (os lotes são detectados sozinhos) ou envie uma imagem para posicionar os lotes sobre ela.'}</span>`;
    pv.setHint(''); help.textContent = 'Toque em um lote para ver ou editar.';
    return;
  }
  const sel = state.editorLoteId ? getLote(state.editorLoteId) : null;
  box.innerHTML = `
    <div class="chip ${pv.tool === 'select' ? 'active' : ''}" onclick="setTool('select')">✋ Mover / selecionar</div>
    <div class="chip ${pv.tool === 'rect' ? 'active' : ''}" onclick="setTool('rect')">▭ Retângulo</div>
    <div class="chip ${pv.tool === 'poly' ? 'active' : ''}" onclick="setTool('poly')">⬠ Polígono</div>
    ${pv.tool === 'poly' ? `<div class="chip" onclick="state.plantaAdmin.finishPoly()">✔ Concluir</div><div class="chip" onclick="state.plantaAdmin.undoPoint()">↶ Desfazer ponto</div>` : ''}
    ${sel && sel.pts && sel.pts.length ? `<div class="chip" onclick="apagarForma('${sel.id}')">🗑 Apagar forma</div>` : ''}
    ${sel ? `<div class="chip" onclick="abrirLoteAdmin('${sel.id}')">✏️ ${esc(loteShort(sel))}</div>` : ''}`;
  if (!sel) { help.innerHTML = 'Selecione um lote na lista ao lado (ou toque em um lote já desenhado), escolha <b>Retângulo</b> ou <b>Polígono</b> e desenhe sobre a planta.'; pv.setHint(pv.tool !== 'select' ? 'Selecione um lote na lista primeiro' : ''); }
  else if (pv.tool === 'rect') { help.innerHTML = `Arraste sobre a planta para desenhar o retângulo do lote <b>${esc(loteShort(sel))}</b>.`; pv.setHint(`Arraste para desenhar ${loteShort(sel)}`); }
  else if (pv.tool === 'poly') { help.innerHTML = `Toque nos cantos do lote <b>${esc(loteShort(sel))}</b>; feche tocando no primeiro ponto ou em Concluir.`; pv.setHint(`Toque nos cantos de ${loteShort(sel)}`); }
  else { help.innerHTML = `Lote <b>${esc(loteShort(sel))}</b> selecionado. Escolha uma ferramenta para ${sel.pts && sel.pts.length ? 'redesenhar' : 'desenhar'} a forma. Arraste para mover a planta, use a roda ou dois dedos para zoom.`; pv.setHint(''); }
}
function setTool(t) {
  if (t !== 'select' && !state.editorLoteId) { toast('👆', 'Selecione um lote na lista primeiro', ''); }
  state.plantaAdmin.setTool(t); renderEditorTools();
}
function selecionarLoteEditor(id) {
  state.editorLoteId = id;
  const pv = state.plantaAdmin; pv.setSelected(id);
  renderEditorTools(); renderLotePicker();
  if (pv.mode === 'esquema' || pv.tool === 'select') abrirLoteAdmin(id);
}
function renderLotePicker() {
  const lot = curLot(); const ls = lotesDo(lot.id); const q = (val('aPickBusca') || '').toLowerCase();
  const box = $('#lotePicker'); if (!box) return;
  const soSem = checked('aPickSemPos');
  const list = ls.filter(l => (!q || loteLabel(l).toLowerCase().includes(q)) && (!soSem || !(l.pts && l.pts.length >= 3)));
  const pos = ls.filter(l => l.pts && l.pts.length >= 3).length;
  $('#aPosInfo').textContent = state.plantaAdmin.mode === 'imagem' ? `${pos}/${ls.length} posicionados` : `${ls.length}`;
  box.innerHTML = list.map(l => `<div class="row ${state.editorLoteId === l.id ? 'sel' : ''}" onclick="pickLote('${l.id}')"><span class="dot ${l.status}"></span>${esc(loteLabel(l))}<span class="pos ${l.pts && l.pts.length >= 3 ? 'ok' : ''}">${l.pts && l.pts.length >= 3 ? '✓ na planta' : (state.plantaAdmin.mode === 'imagem' ? 'sem posição' : '')}</span></div>`).join('') || '<div class="row muted">Nenhum lote. Cadastre em "Lotes".</div>';
  const selRow = box.querySelector('.row.sel'); if (selRow && selRow.scrollIntoView) selRow.scrollIntoView({ block: 'nearest' });
}
function pickLote(id) {
  state.editorLoteId = id; const pv = state.plantaAdmin;
  pv.setSelected(id); renderLotePicker(); renderEditorTools();
  const l = getLote(id);
  if (l.pts && l.pts.length >= 3 && pv.mode === 'imagem') pv.zoomToLote(id);
  else if (pv.mode === 'esquema') pv.zoomToLote(id);
  else if (pv.tool === 'select') pv.setTool('rect'), renderEditorTools();
}
function salvarForma(pts) {
  const l = getLote(state.editorLoteId);
  if (!l) { toast('👆', 'Selecione um lote na lista antes de desenhar', '', true); return; }
  upsert('lotes', Object.assign({}, l, { pts }));
  toast('✅', `${loteShort(l)} posicionado`, '');
  // avança automaticamente para o próximo lote sem posição
  const ls = lotesDo(l.loteamentoId); const i = ls.findIndex(x => x.id === l.id);
  const prox = ls.slice(i + 1).find(x => !(x.pts && x.pts.length >= 3)) || null;
  state.editorLoteId = prox ? prox.id : null;
  const pv = state.plantaAdmin; pv.setData(curLot(), ls); pv.setSelected(state.editorLoteId);
  if (!prox) pv.setTool('select');
  renderEditorTools(); renderLotePicker();
}
function apagarForma(id) {
  const l = getLote(id); if (!l) return;
  const u = Object.assign({}, l); delete u.pts; u.pts = null;
  upsert('lotes', u); renderPlantaEditor();
}
async function uploadPlanta(input) {
  const f = input.files[0]; if (!f) return;
  try {
    const raw = await readFileAsDataURL(f);
    const { dataUrl, w, h } = await resizeImage(raw, 2200);
    if (dataUrl.length > 3.5 * 1024 * 1024) { toast('⚠️', 'Imagem muito grande', 'Use uma imagem menor (até ~3 MB).', true); return; }
    const lot = curLot();
    let img = dataUrl;
    if (Cloud.active) { toast('☁️', 'Enviando imagem…', ''); img = await Cloud.uploadPlanta(lot.id, dataUrl); }
    upsert('loteamentos', Object.assign({}, lot, { planta: { img, w, h } }));
    prefs.aModo = 'imagem'; savePrefs();
    state.plantaAdmin = null;
    toast('🖼️', 'Planta enviada', 'Agora selecione cada lote e desenhe sua posição.');
    renderPlantaEditor();
  } catch (e) { toast('⚠️', 'Falha ao carregar imagem', e.message, true); }
  input.value = '';
}
function removerPlanta() {
  if (!confirm('Remover a imagem da planta? As formas desenhadas serão mantidas, mas ficarão ocultas até enviar outra imagem.')) return;
  const lot = curLot(); const u = Object.assign({}, lot); u.planta = null;
  upsert('loteamentos', u); state.plantaAdmin = null; prefs.aModo = 'esquema'; savePrefs(); renderPlantaEditor();
}

// ================================================================ LOTES (admin)
function renderALotes(alvo) {
  const lot = curLot(); const v = alvo || alvoDoEmp('av-lotes');
  const f = state.filters.alotes = state.filters.alotes || { quadra: 'all', status: 'all', busca: '' };
  const ls = lotesDo(lot.id); const quadras = quadrasDo(lot.id);
  const list = ls.filter(l => (f.quadra === 'all' || l.quadra === f.quadra) && (f.status === 'all' || l.status === f.status) && (!f.busca || loteLabel(l).toLowerCase().includes(f.busca.toLowerCase())));
  const cnt = s => ls.filter(l => l.status === s).length;
  const vgvFiltro = list.reduce((s, l) => s + num(l.preco), 0), areaFiltro = list.reduce((s, l) => s + num(l.area), 0);
  v.innerHTML = `
    <div class="toolbar">
      <button class="btn btn-primary btn-sm" onclick="abrirLoteForm()">＋ Lote</button>
      <button class="btn btn-outline btn-sm" onclick="abrirGerarLotes()">⚡ Gerar em massa</button>
      <button class="btn btn-outline btn-sm" onclick="abrirImportarLotes()">📥 Importar CSV</button>
      <button class="btn btn-outline btn-sm" onclick="abrirReajuste()">💲 Reajustar preços</button>
      <button class="btn btn-secondary btn-sm" onclick="exportarLotesCSV()">⬇️ Exportar</button>
    </div>
    <div class="chips">
      ${[['all', 'Todos', ls.length], ['disponivel', 'Disponíveis', cnt('disponivel')], ['reservado', 'Reservados', cnt('reservado')], ['vendido', 'Vendidos', cnt('vendido')], ['bloqueado', 'Indisponíveis', cnt('bloqueado')]].map(([k, l, n]) => `<div class="chip ${f.status === k ? 'active' : ''}" onclick="aSetFiltro('alotes','status','${k}',renderALotes)">${l}<span class="n">${n}</span></div>`).join('')}
    </div>
    <div class="filters">
      <select onchange="aSetFiltro('alotes','quadra',this.value,renderALotes)"><option value="all">Todas as quadras</option>${quadras.map(q => `<option value="${esc(q)}" ${f.quadra === q ? 'selected' : ''}>Quadra ${esc(q)}</option>`).join('')}</select>
      <input type="text" placeholder="🔎 Buscar" value="${esc(f.busca)}" oninput="aSetFiltro('alotes','busca',this.value,renderALotes,this)">
    </div>
    <p class="small muted mb">${list.length} lote(s) · ${fmtNum(areaFiltro, 0)} m² · ${fmtMoney(vgvFiltro)}</p>
    ${list.length ? `<div class="card" style="padding:0"><div class="table-wrap"><table class="tbl">
      <thead><tr><th>Quadra</th><th>Lote</th><th class="num">Área m²</th><th class="num">Preço</th><th class="num">R$/m²</th><th>Status</th><th>Cliente</th><th></th></tr></thead>
      <tbody>${list.map(l => { const r = reservaAtiva(l.id); const vd = vendaAtiva(l.id); const cli = vd ? vd.cliente.nome : r ? r.cliente.nome : ''; return `<tr class="clickable" onclick="abrirLoteAdmin('${l.id}')"><td>${esc(l.quadra)}</td><td><b>${esc(l.numero)}</b>${l.tipo === 'comercial' ? ' <span class="tiny muted">com.</span>' : ''}</td><td class="num">${fmtNum(l.area, 0)}</td><td class="num"><b>${fmtMoney(l.preco)}</b></td><td class="num">${l.area ? fmtNum(l.preco / l.area, 0) : '—'}</td><td><span class="badge ${l.status}">${statusLabel(l.status)}</span></td><td>${esc(cli)}</td><td onclick="event.stopPropagation()"><button class="btn-icon" onclick="abrirLoteForm('${l.id}')">✏️</button></td></tr>`; }).join('')}</tbody>
    </table></div></div>` : `<div class="empty"><div class="ic">📦</div><p>Nenhum lote.<br>Use <b>Gerar em massa</b> para criar as quadras rapidamente.</p></div>`}`;
}
function aSetFiltro(group, k, v, fn, inputEl) {
  state.filters[group][k] = v;
  if (inputEl) { const pos = inputEl.selectionStart; fn(); const n = $(`#av-${state.tab} input[type=text]`); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } }
  else fn();
}
function abrirLoteAdmin(id) {
  const l = getLote(id); if (!l) return;
  const r = reservaAtiva(l.id); const vd = vendaAtiva(l.id);
  const m2 = l.area ? l.preco / l.area : 0;
  let vinc = '';
  if (vd) { const res = vendaResumo(vd); vinc = `<div class="alert info" onclick="abrirVendaAdmin('${vd.id}')"><span><b>Venda</b> para ${esc(vd.cliente.nome)} em ${fmtDate(vd.dataVenda)} · ${fmtMoney(vd.valorTotal)} · recebido ${fmtMoney(res.pago)}</span><span>›</span></div>`; }
  else if (r) { vinc = `<div class="alert warn" onclick="abrirReservaAdmin('${r.id}')"><span><b>Reserva ${statusLabel(reservaStatus(r)).toLowerCase()}</b> · ${esc(r.cliente.nome)} · corretor ${esc(r.corretor.nome)} · até ${fmtDate(r.validade)}</span><span>›</span></div>`; }
  const body = `${vinc}
    <div class="row-between mb"><div><div class="price-big">${fmtMoney(l.preco)}</div><div class="price-sub">${m2 ? fmtMoney(m2) + ' por m²' : 'sem preço definido'}</div></div><span class="badge ${l.status}" style="font-size:0.75rem">${statusLabel(l.status)}</span></div>
    <div class="detail-grid">
      <div><div class="k">Área</div><div class="v">${fmtNum(l.area, 2)} m²</div></div><div><div class="k">Tipo</div><div class="v">${l.tipo === 'comercial' ? 'Comercial' : 'Residencial'}</div></div>
      <div><div class="k">Frente</div><div class="v">${l.frente ? fmtNum(l.frente, 2) + ' m' : '—'}</div></div><div><div class="k">Fundos / lateral</div><div class="v">${l.fundos ? fmtNum(l.fundos, 2) + ' m' : '—'}</div></div>
      <div><div class="k">Matrícula</div><div class="v">${esc(l.matricula) || '—'}</div></div><div><div class="k">Na planta</div><div class="v">${l.pts && l.pts.length >= 3 ? '✓ posicionado' : 'sem posição'}</div></div>
      ${l.obs ? `<div class="full"><div class="k">Observações</div><div class="v">${esc(l.obs)}</div></div>` : ''}
    </div>`;
  let footer = `<button class="btn btn-secondary" onclick="abrirLoteForm('${l.id}')">✏️ Editar</button>`;
  if (l.status === 'disponivel') footer += `<button class="btn btn-accent" onclick="abrirReservaAdminForm('${l.id}')">📝 Reservar</button><button class="btn btn-success" onclick="abrirVendaForm(null,'${l.id}')">💰 Vender</button><button class="btn btn-outline-danger" onclick="bloquearLote('${l.id}',true)">Bloquear</button>`;
  else if (l.status === 'bloqueado') footer += `<button class="btn btn-success" onclick="bloquearLote('${l.id}',false)">Liberar para venda</button>`;
  else if (l.status === 'reservado' && r) footer += `<button class="btn btn-success" onclick="abrirVendaForm(null,'${l.id}','${r.id}')">💰 Converter em venda</button>`;
  openModal({ title: `📍 ${esc(loteLabel(l))}`, body, footer });
}
function bloquearLote(id, bloquear) {
  const l = getLote(id); if (!l) return;
  const obs = bloquear ? (prompt('Motivo (opcional): área institucional, permuta, uso próprio…', l.obs || '') ?? null) : l.obs;
  if (bloquear && obs === null) return;
  upsert('lotes', Object.assign({}, l, { status: bloquear ? 'bloqueado' : 'disponivel', obs: bloquear ? obs : l.obs }));
  logAct(`${loteLabel(l)} ${bloquear ? 'bloqueado' : 'liberado para venda'}`);
  closeModal(); renderCurrent();
}
function abrirLoteForm(id) {
  const lot = curLot(); const l = id ? getLote(id) : null;
  const body = `
    <div class="frow"><div class="fg"><label>Quadra *</label><input type="text" id="lfQuadra" value="${esc(l ? l.quadra : (quadrasDo(lot.id).slice(-1)[0] || 'A'))}" list="quadrasList"><datalist id="quadrasList">${quadrasDo(lot.id).map(q => `<option value="${esc(q)}">`).join('')}</datalist></div>
      <div class="fg"><label>Número do lote *</label><input type="text" id="lfNumero" value="${esc(l ? l.numero : '')}"></div></div>
    <div class="frow3"><div class="fg"><label>Área (m²) *</label><input type="number" id="lfArea" step="0.01" min="0" value="${l ? l.area : ''}" oninput="lfCalc()"></div>
      <div class="fg"><label>Frente (m)</label><input type="number" id="lfFrente" step="0.01" min="0" value="${l && l.frente ? l.frente : ''}"></div>
      <div class="fg"><label>Fundos (m)</label><input type="number" id="lfFundos" step="0.01" min="0" value="${l && l.fundos ? l.fundos : ''}"></div></div>
    <div class="frow"><div class="fg"><label>Preço (R$) *</label><input type="number" id="lfPreco" step="0.01" min="0" value="${l ? l.preco : ''}" oninput="lfCalc()"><div class="hint" id="lfM2"></div></div>
      <div class="fg"><label>Tipo</label><select id="lfTipo"><option value="residencial" ${!l || l.tipo !== 'comercial' ? 'selected' : ''}>Residencial</option><option value="comercial" ${l && l.tipo === 'comercial' ? 'selected' : ''}>Comercial</option></select></div></div>
    <div class="frow"><div class="fg"><label>Matrícula</label><input type="text" id="lfMatricula" value="${esc(l ? l.matricula || '' : '')}"></div>
      <div class="fg"><label>Status</label><select id="lfStatus" ${l && (l.status === 'vendido' || l.status === 'reservado') ? 'disabled' : ''}><option value="disponivel" ${!l || l.status === 'disponivel' ? 'selected' : ''}>Disponível</option><option value="bloqueado" ${l && l.status === 'bloqueado' ? 'selected' : ''}>Indisponível / bloqueado</option>${l && l.status === 'reservado' ? '<option value="reservado" selected>Reservado</option>' : ''}${l && l.status === 'vendido' ? '<option value="vendido" selected>Vendido</option>' : ''}</select></div></div>
    <details class="qualif"><summary>📋 Qualificação do imóvel para contrato e escritura</summary>
      <div class="fg"><label>Descrição conforme a matrícula</label><textarea id="lfDescMat" rows="3" placeholder="Copie do registro, com as confrontações, exatamente como está na matrícula.">${esc(l ? l.descricaoMatricula || '' : '')}</textarea>
        <div class="hint">O contrato descreve o imóvel com as mesmas palavras da matrícula; qualquer diferença vira exigência no cartório.</div></div>
      <div class="frow3"><div class="fg"><label>CEP</label><input type="text" id="lfCep" value="${esc(l ? l.cep || '' : '')}"></div>
        <div class="fg" style="grid-column:span 2"><label>Logradouro</label><input type="text" id="lfLogr" value="${esc(l ? l.logradouro || '' : '')}" placeholder="${esc(lot.logradouro || lot.endereco || 'Rua do loteamento')}"></div></div>
      <div class="frow"><div class="fg"><label>Número</label><input type="text" id="lfNum" value="${esc(l ? l.numeroEnd || '' : '')}"></div>
        <div class="fg"><label>Bairro</label><input type="text" id="lfBairro" value="${esc(l ? l.bairro || '' : '')}" placeholder="${esc(lot.bairro || '')}"></div></div>
      <p class="help">Em branco, o contrato usa o endereço do empreendimento.</p></details>
    <div class="fg"><label>Observações</label><textarea id="lfObs">${esc(l ? l.obs || '' : '')}</textarea></div>`;
  openModal({ title: l ? `✏️ Editar ${esc(loteShort(l))}` : '＋ Novo lote', body, footer: `${l ? `<button class="btn btn-outline-danger" onclick="excluirLote('${l.id}')">Excluir</button>` : ''}<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="salvarLote('${l ? l.id : ''}')">Salvar</button>` });
  lfCalc();
}
function lfCalc() { const a = num(val('lfArea')), p = num(val('lfPreco')); const el = $('#lfM2'); if (el) el.textContent = a && p ? `${fmtMoney(p / a)} por m²` : ''; }
function salvarLote(id) {
  const lot = curLot();
  const quadra = val('lfQuadra').toUpperCase(), numero = val('lfNumero');
  if (!quadra || !numero) { toast('⚠️', 'Informe quadra e número', '', true); return; }
  const dup = db.lotes.find(l => l.loteamentoId === lot.id && l.id !== id && l.quadra.toUpperCase() === quadra && String(l.numero) === numero);
  if (dup) { toast('⚠️', 'Já existe esse lote nesta quadra', '', true); return; }
  const prev = id ? getLote(id) : null;
  const rec = Object.assign({}, prev || { id: genId(), loteamentoId: lot.id, status: 'disponivel', criadoEm: new Date().toISOString() }, {
    quadra, numero, area: num(val('lfArea')), frente: num(val('lfFrente')) || null, fundos: num(val('lfFundos')) || null, preco: num(val('lfPreco')),
    tipo: val('lfTipo'), matricula: val('lfMatricula'), obs: val('lfObs'),
    descricaoMatricula: val('lfDescMat'), cep: val('lfCep'), logradouro: val('lfLogr'), numeroEnd: val('lfNum'), bairro: val('lfBairro')
  });
  const stEl = $('#lfStatus'); if (stEl && !stEl.disabled) rec.status = stEl.value;
  upsert('lotes', rec);
  if (!prev) logAct(`Lote cadastrado: ${loteLabel(rec)} — ${fmtMoney(rec.preco)}`);
  closeModal();
  if (state.tab === 'planta' && state.role === 'admin') {
    state.editorLoteId = rec.id; renderCurrent();
    const pv = state.plantaAdmin;
    if (pv && pv.mode === 'imagem' && !(rec.pts && rec.pts.length >= 3)) { pv.setTool('rect'); renderEditorTools(); toast('▭', 'Agora desenhe o lote', `Arraste sobre a planta para marcar ${loteShort(rec)}.`); }
    else toast('✅', 'Lote salvo', loteLabel(rec));
    return;
  }
  renderCurrent(); toast('✅', 'Lote salvo', loteLabel(rec));
}
function excluirLote(id) {
  const l = getLote(id); if (!l) return;
  if (l.status === 'vendido' || l.status === 'reservado') { toast('⚠️', 'Lote com reserva ou venda não pode ser excluído', '', true); return; }
  if (!confirm(`Excluir ${loteLabel(l)}?`)) return;
  removeRec('lotes', id); closeModal(); renderCurrent();
}
function abrirGerarLotes() {
  const lot = curLot();
  const body = `<p class="help mb">Cria vários lotes de uma vez em uma quadra. Você pode ajustar cada lote depois.</p>
    <div class="frow3"><div class="fg"><label>Quadra *</label><input type="text" id="glQuadra" value="${esc(String.fromCharCode(65 + Math.min(25, quadrasDo(lot.id).length)))}"></div><div class="fg"><label>Do lote nº</label><input type="number" id="glDe" value="1" min="1"></div><div class="fg"><label>Até o lote nº</label><input type="number" id="glAte" value="10" min="1"></div></div>
    <div class="frow3"><div class="fg"><label>Área padrão (m²)</label><input type="number" id="glArea" value="360" step="0.01"></div><div class="fg"><label>Frente (m)</label><input type="number" id="glFrente" value="12" step="0.01"></div><div class="fg"><label>Fundos (m)</label><input type="number" id="glFundos" value="30" step="0.01"></div></div>
    <div class="frow"><div class="fg"><label>Preço por m² (R$)</label><input type="number" id="glM2" value="400" step="0.01" oninput="glCalc()"></div><div class="fg"><label>ou preço fixo por lote (R$)</label><input type="number" id="glPreco" step="0.01" placeholder="deixe vazio p/ usar R$/m²" oninput="glCalc()"></div></div>
    <div class="sim-result" id="glPreview"></div>`;
  openModal({ title: '⚡ Gerar lotes em massa', body, footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="gerarLotes()">Gerar</button>` });
  glCalc();
}
function glCalc() { const a = num(val('glArea')), m2 = num(val('glM2')), fixo = num(val('glPreco')); const de = Math.round(num(val('glDe'))), ate = Math.round(num(val('glAte'))); const preco = fixo || a * m2; const n = Math.max(0, ate - de + 1); const el = $('#glPreview'); if (el) el.innerHTML = `<b>${n}</b> lote(s) de ${fmtNum(a, 0)} m² a <b>${fmtMoney(preco)}</b> cada · VGV ${fmtMoney(preco * n)}`; }
function gerarLotes() {
  const lot = curLot(); const quadra = val('glQuadra').toUpperCase();
  const de = Math.round(num(val('glDe'))), ate = Math.round(num(val('glAte')));
  if (!quadra || !de || !ate || ate < de || ate - de > 500) { toast('⚠️', 'Verifique quadra e numeração', '', true); return; }
  const a = num(val('glArea')), preco = num(val('glPreco')) || a * num(val('glM2'));
  let criados = 0, pulados = 0;
  for (let i = de; i <= ate; i++) {
    if (db.lotes.find(l => l.loteamentoId === lot.id && l.quadra.toUpperCase() === quadra && String(l.numero) === String(i))) { pulados++; continue; }
    upsert('lotes', { id: genId(), loteamentoId: lot.id, quadra, numero: String(i), area: a, frente: num(val('glFrente')) || null, fundos: num(val('glFundos')) || null, preco, tipo: 'residencial', status: 'disponivel', obs: '', matricula: '', criadoEm: new Date().toISOString() });
    criados++;
  }
  logAct(`${criados} lote(s) gerados na quadra ${quadra}`);
  closeModal(); renderCurrent(); toast('✅', `${criados} lote(s) criados`, pulados ? `${pulados} já existiam` : '');
}
function abrirImportarLotes() {
  const body = `<p class="help mb">Cole abaixo uma lista com <b>uma linha por lote</b>, colunas separadas por <b>;</b> (ponto e vírgula) ou tabulação, na ordem:<br><code>quadra; lote; área; preço; frente; fundos; tipo; matrícula</code> — só as 2 primeiras são obrigatórias. Pode copiar direto de uma planilha.</p>
    <div class="fg"><textarea id="impTexto" style="min-height:160px;font-family:monospace;font-size:0.8rem" placeholder="A;1;360;150000;12;30\nA;2;360;150000\nB;1;420;170000"></textarea></div>
    <label class="check"><input type="checkbox" id="impAtualiza" checked> Atualizar lotes que já existem (mesma quadra e número)</label>`;
  openModal({ title: '📥 Importar lotes', body, footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="importarLotes()">Importar</button>` });
}
function importarLotes() {
  const lot = curLot(); const linhas = val('impTexto').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  let criados = 0, atualizados = 0, erros = 0;
  linhas.forEach((ln, i) => {
    const c = ln.split(/;|\t/).map(s => s.trim());
    if (i === 0 && /quadra/i.test(c[0])) return; // cabeçalho
    const [quadra, numero, area, preco, frente, fundos, tipo, matricula] = c;
    if (!quadra || !numero) { erros++; return; }
    const ex = db.lotes.find(l => l.loteamentoId === lot.id && l.quadra.toUpperCase() === quadra.toUpperCase() && String(l.numero) === numero);
    if (ex && !checked('impAtualiza')) return;
    const rec = Object.assign({}, ex || { id: genId(), loteamentoId: lot.id, status: 'disponivel', obs: '', criadoEm: new Date().toISOString() }, {
      quadra: quadra.toUpperCase(), numero, area: area ? num(area) : (ex ? ex.area : 0), preco: preco ? num(preco) : (ex ? ex.preco : 0),
      frente: frente ? num(frente) : (ex ? ex.frente : null), fundos: fundos ? num(fundos) : (ex ? ex.fundos : null),
      tipo: tipo ? (/com/i.test(tipo) ? 'comercial' : 'residencial') : (ex ? ex.tipo : 'residencial'), matricula: matricula || (ex ? ex.matricula : '')
    });
    upsert('lotes', rec); ex ? atualizados++ : criados++;
  });
  logAct(`Importação de lotes: ${criados} criados, ${atualizados} atualizados`);
  closeModal(); renderCurrent(); toast('✅', 'Importação concluída', `${criados} criados · ${atualizados} atualizados${erros ? ' · ' + erros + ' linha(s) ignoradas' : ''}`);
}
function abrirReajuste() {
  const lot = curLot();
  const body = `<p class="help mb">Aplica um reajuste percentual ou um novo valor por m² nos lotes selecionados. Lotes vendidos não são alterados.</p>
    <div class="frow"><div class="fg"><label>Quadra</label><select id="rjQuadra"><option value="all">Todas</option>${quadrasDo(lot.id).map(q => `<option value="${esc(q)}">Quadra ${esc(q)}</option>`).join('')}</select></div>
      <div class="fg"><label>Aplicar em</label><select id="rjStatus"><option value="disponivel">Somente disponíveis</option><option value="all">Disponíveis, reservados e bloqueados</option></select></div></div>
    <div class="frow"><div class="fg"><label>Reajuste (%)</label><input type="number" id="rjPct" step="0.1" placeholder="ex.: 5 ou -3"></div><div class="fg"><label>ou novo preço por m² (R$)</label><input type="number" id="rjM2" step="0.01" placeholder="ex.: 450"></div></div>
    <label class="check"><input type="checkbox" id="rjArredonda" checked> Arredondar para centena (R$ 100)</label>`;
  openModal({ title: '💲 Reajustar preços', body, footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="aplicarReajuste()">Aplicar</button>` });
}
function aplicarReajuste() {
  const lot = curLot(); const q = val('rjQuadra'), st = val('rjStatus'); const pct = num(val('rjPct')), m2 = num(val('rjM2'));
  if (!pct && !m2) { toast('⚠️', 'Informe o percentual ou o valor por m²', '', true); return; }
  const alvo = lotesDo(lot.id).filter(l => l.status !== 'vendido' && (q === 'all' || l.quadra === q) && (st === 'all' || l.status === 'disponivel'));
  if (!confirm(`Reajustar ${alvo.length} lote(s)?`)) return;
  alvo.forEach(l => { let p = m2 ? l.area * m2 : l.preco * (1 + pct / 100); if (checked('rjArredonda')) p = Math.round(p / 100) * 100; upsert('lotes', Object.assign({}, l, { preco: Math.round(p * 100) / 100 })); });
  logAct(`Reajuste de preços em ${alvo.length} lote(s): ${m2 ? fmtMoney(m2) + '/m²' : pct + '%'}`);
  closeModal(); renderCurrent(); toast('✅', 'Preços reajustados', `${alvo.length} lote(s)`);
}
function exportarLotesCSV() {
  const lot = curLot(); const rows = [['Quadra', 'Lote', 'Área m²', 'Frente', 'Fundos', 'Preço', 'R$/m²', 'Tipo', 'Status', 'Cliente', 'Corretor', 'Matrícula', 'Obs']];
  lotesDo(lot.id).forEach(l => { const vd = vendaAtiva(l.id), r = reservaAtiva(l.id); const p = vd || r; rows.push([l.quadra, l.numero, fmtNum(l.area), l.frente ? fmtNum(l.frente) : '', l.fundos ? fmtNum(l.fundos) : '', fmtNum(l.preco), l.area ? fmtNum(l.preco / l.area) : '', l.tipo, statusLabel(l.status), p ? p.cliente.nome : '', p ? p.corretor.nome : '', l.matricula || '', l.obs || '']); });
  download(`lotes-${lot.nome.replace(/\W+/g, '-')}.csv`, toCSV(rows), 'text/csv');
}

// ================================================================ RESERVAS (admin)
function aSetFiltroRes(st) { state.filters.ares = { status: st }; switchTab('reservas'); }
function renderAReservas(alvo) {
  const lot = curLot(); const v = alvo || alvoDoEmp('av-reservas');
  const f = state.filters.ares = state.filters.ares || { status: 'ativas' };
  const all = db.reservas.filter(r => r.loteamentoId === lot.id);
  const grupos = { ativas: r => ['pendente', 'aprovada'].includes(reservaStatus(r)), pendente: r => r.status === 'pendente', aprovada: r => reservaStatus(r) === 'aprovada', expirada: r => reservaStatus(r) === 'expirada', historico: r => ['recusada', 'cancelada', 'convertida', 'expirada'].includes(r.status) || (reservaStatus(r) === 'expirada') };
  const list = all.filter(grupos[f.status] || (() => true)).sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
  v.innerHTML = `
    <div class="chips">${[['ativas', 'Ativas'], ['pendente', 'Aguardando'], ['aprovada', 'Aprovadas'], ['expirada', 'Vencidas'], ['historico', 'Histórico']].map(([k, l]) => `<div class="chip ${f.status === k ? 'active' : ''}" onclick="state.filters.ares.status='${k}';renderAReservas()">${l}<span class="n">${all.filter(grupos[k]).length}</span></div>`).join('')}</div>
    ${list.length ? list.map(r => reservaCardHtml(r, true)).join('') : `<div class="empty"><div class="ic">📝</div><p>Nenhuma reserva nesta lista.</p></div>`}`;
}
function abrirReservaAdmin(id) {
  const r = getReserva(id); if (!r) return; const l = getLote(r.loteId); const st = reservaStatus(r);
  const body = reservaDetalheHtml(r);
  let footer = '';
  if (r.status === 'pendente' && pode('reservas.aprovar')) footer += `<button class="btn btn-success" onclick="aprovarReserva('${r.id}')">✔ Aprovar</button><button class="btn btn-outline-danger" onclick="encerrarReserva('${r.id}','recusada')">Recusar</button>`;
  if (['pendente', 'aprovada'].includes(r.status)) footer += `<button class="btn btn-primary" onclick="abrirVendaForm(null,'${r.loteId}','${r.id}')">💰 Converter em venda</button><button class="btn btn-secondary" onclick="renovarReserva('${r.id}')">🔁 Renovar prazo</button>${r.status === 'aprovada' ? `<button class="btn btn-outline-danger" onclick="encerrarReserva('${r.id}','cancelada')">Liberar lote</button>` : ''}`;
  footer += `<button class="btn btn-secondary" onclick="editarReservaAdmin('${r.id}')">✏️ Editar dados</button>`;
  if (r.corretor.telefone) footer += `<a class="btn btn-wa" target="_blank" href="${waLink(r.corretor.telefone, `Olá ${r.corretor.nome.split(' ')[0]}, sobre a reserva do ${l ? loteLabel(l) : 'lote'} para ${r.cliente.nome}: `)}">💬 Corretor</a>`;
  openModal({ title: `📝 Reserva · ${l ? esc(loteShort(l)) : ''}`, body, footer });
}
function aprovarReserva(id) {
  const r = getReserva(id); if (!r) return;
  const hoje = todayStr();
  upsert('reservas', Object.assign({}, r, { status: 'aprovada', aprovadaEm: hoje, validade: addDays(hoje, Number(db.config.reservaDias) || 7) }));
  const l = getLote(r.loteId); if (l) upsert('lotes', Object.assign({}, l, { status: 'reservado', reservaId: r.id }));
  logAct(`Reserva aprovada: ${l ? loteLabel(l) : ''} — ${r.cliente.nome}`);
  closeModal(); renderCurrent(); toast('✅', 'Reserva aprovada', `Válida até ${fmtDate(addDays(hoje, Number(db.config.reservaDias) || 7))}`);
}
function renovarReserva(id) {
  const r = getReserva(id); if (!r) return;
  const dias = prompt('Renovar por quantos dias a partir de hoje?', db.config.reservaDias); if (dias === null) return;
  upsert('reservas', Object.assign({}, r, { validade: addDays(todayStr(), Math.max(1, Math.round(num(dias)))) }));
  const l = getLote(r.loteId); logAct(`Reserva renovada: ${l ? loteLabel(l) : ''} — ${r.cliente.nome}`);
  closeModal(); renderCurrent(); toast('🔁', 'Prazo renovado', '');
}
function encerrarReserva(id, status) {
  const r = getReserva(id); if (!r) return;
  const motivo = prompt(status === 'recusada' ? 'Motivo da recusa (opcional):' : 'Motivo da liberação (opcional):', '');
  if (motivo === null) return;
  liberarReserva(r, status, motivo);
  closeModal(); renderCurrent(); toast('↩️', status === 'recusada' ? 'Reserva recusada' : 'Lote liberado', '');
}
function editarReservaAdmin(id) {
  const r = getReserva(id); if (!r) return; const c = r.cliente, k = r.corretor, p = r.proposta || {};
  const body = `
    <div class="fieldset"><span class="lg">🧑‍🤝‍🧑 Cliente</span>
      <div class="fg"><label>Nome *</label><input type="text" id="erNome" value="${esc(c.nome)}"></div>
      <div class="frow"><div class="fg"><label>CPF/CNPJ</label><input type="text" id="erCpf" value="${esc(c.cpf)}"></div><div class="fg"><label>Telefone *</label><input type="tel" id="erTel" value="${esc(c.telefone)}"></div></div>
      <div class="frow"><div class="fg"><label>E-mail</label><input type="email" id="erEmail" value="${esc(c.email)}"></div><div class="fg"><label>Cidade</label><input type="text" id="erCidade" value="${esc(c.cidade)}"></div></div>
      <div class="fg"><label>Endereço</label><input type="text" id="erEnd" value="${esc(c.endereco)}"></div></div>
    <div class="fieldset"><span class="lg">🧑‍💼 Corretor</span>
      <div class="fg"><label>Nome *</label><input type="text" id="ekNome" value="${esc(k.nome)}"></div>
      <div class="frow"><div class="fg"><label>CRECI</label><input type="text" id="ekCreci" value="${esc(k.creci)}"></div><div class="fg"><label>Telefone</label><input type="tel" id="ekTel" value="${esc(k.telefone)}"></div></div>
      <div class="frow"><div class="fg"><label>E-mail</label><input type="email" id="ekEmail" value="${esc(k.email)}"></div><div class="fg"><label>Imobiliária</label><input type="text" id="ekImob" value="${esc(k.imobiliaria)}"></div></div></div>
    <div class="fieldset"><span class="lg">💰 Proposta / prazo</span>
      <div class="frow3"><div class="fg"><label>Valor</label><input type="number" id="epValor" value="${p.valor || ''}"></div><div class="fg"><label>Entrada</label><input type="number" id="epEntrada" value="${p.entrada || ''}"></div><div class="fg"><label>Parcelas</label><input type="number" id="epParc" value="${p.nParcelas || ''}"></div></div>
      <div class="frow"><div class="fg"><label>Validade</label><input type="date" id="epValidade" value="${r.validade || ''}"></div><div class="fg"><label>Data do pedido</label><input type="date" id="epData" value="${r.dataReserva || ''}"></div></div>
      <div class="fg"><label>Observações</label><textarea id="epObs">${esc(r.obs || '')}</textarea></div></div>`;
  openModal({ title: '✏️ Editar reserva', body, footer: `<button class="btn btn-secondary" onclick="abrirReservaAdmin('${r.id}')">Voltar</button><button class="btn btn-primary" onclick="salvarReservaAdmin('${r.id}')">Salvar</button>` });
}
function salvarReservaAdmin(id) {
  const r = getReserva(id); if (!r) return;
  if (!val('erNome') || !val('erTel') || !val('ekNome')) { toast('⚠️', 'Preencha nome/telefone do cliente e nome do corretor', '', true); return; }
  const upd = Object.assign({}, r, {
    cliente: Object.assign({}, r.cliente, { nome: val('erNome'), cpf: val('erCpf'), telefone: val('erTel'), email: val('erEmail'), cidade: val('erCidade'), endereco: val('erEnd') }),
    corretor: { nome: val('ekNome'), creci: val('ekCreci'), telefone: val('ekTel'), email: val('ekEmail'), imobiliaria: val('ekImob') },
    proposta: { valor: num(val('epValor')), entrada: num(val('epEntrada')), nParcelas: Math.round(num(val('epParc'))) },
    validade: val('epValidade') || r.validade, dataReserva: val('epData') || r.dataReserva, obs: val('epObs')
  });
  upsert('reservas', upd); registrarCorretor(upd.corretor);
  abrirReservaAdmin(id); renderCurrent(); toast('✅', 'Reserva atualizada', '');
}
function abrirReservaAdminForm(loteId) {
  const lot = curLot();
  const disp = lotesDo(lot.id).filter(l => l.status === 'disponivel');
  if (!disp.length) { toast('⚠️', 'Nenhum lote disponível', '', true); return; }
  const corrs = db.corretores.filter(c => c.ativo !== false);
  const body = `<p class="help mb">Registre uma reserva feita diretamente com você ou por um corretor. Ela já entra como <b>aprovada</b>.</p>
    <div class="fg"><label>Lote *</label><select id="raLote">${optionsHtml(disp, loteId || disp[0].id, l => `${loteLabel(l)} — ${fmtMoney(l.preco)}`)}</select></div>
    <div class="fieldset"><span class="lg">🧑‍💼 Corretor</span>
      <div class="fg"><label>Corretor cadastrado</label><select id="raCorr" onchange="raPreencheCorr()"><option value="">— Venda direta / digitar —</option>${optionsHtml(corrs, '', c => c.nome + (c.imobiliaria ? ' (' + c.imobiliaria + ')' : ''))}</select></div>
      <div class="frow"><div class="fg"><label>Nome</label><input type="text" id="rkNome" value="${esc(db.config.empresa || 'Venda direta')}"></div><div class="fg"><label>CRECI</label><input type="text" id="rkCreci"></div></div>
      <div class="frow"><div class="fg"><label>Telefone</label><input type="tel" id="rkTel"></div><div class="fg"><label>Imobiliária</label><input type="text" id="rkImob"></div></div></div>
    <div class="fieldset"><span class="lg">🧑‍🤝‍🧑 Cliente</span>
      <div class="fg"><label>Nome *</label><input type="text" id="rlNome"></div>
      <div class="frow"><div class="fg"><label>CPF/CNPJ</label><input type="text" id="rlCpf"></div><div class="fg"><label>Telefone *</label><input type="tel" id="rlTel"></div></div>
      <div class="frow"><div class="fg"><label>E-mail</label><input type="email" id="rlEmail"></div><div class="fg"><label>Cidade</label><input type="text" id="rlCidade"></div></div>
      <div class="fg"><label>Endereço</label><input type="text" id="rlEnd"></div></div>
    <div class="frow"><div class="fg"><label>Validade (dias)</label><input type="number" id="raDias" value="${db.config.reservaDias}"></div><div class="fg"><label>Observações</label><input type="text" id="raObs"></div></div>`;
  openModal({ title: '📝 Nova reserva', body, footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="salvarReservaAdminNova()">Reservar</button>` });
}
function raPreencheCorr() { const c = db.corretores.find(x => x.id === val('raCorr')); if (!c) return; setVal('rkNome', c.nome); setVal('rkCreci', c.creci); setVal('rkTel', c.telefone); setVal('rkImob', c.imobiliaria); }
function corretorSelecionado(selId) { const c = db.corretores.find(x => x.id === val(selId)); return c || null; }
function salvarReservaAdminNova() {
  const l = getLote(val('raLote')); if (!l || l.status !== 'disponivel') { toast('⚠️', 'Lote indisponível', '', true); return; }
  if (!val('rlNome') || !val('rlTel')) { toast('⚠️', 'Informe nome e telefone do cliente', '', true); return; }
  const hoje = todayStr(); const dias = Math.max(1, Math.round(num(val('raDias')) || 7));
  const cSel = corretorSelecionado('raCorr');
  const corretor = { nome: val('rkNome') || 'Venda direta', creci: val('rkCreci'), telefone: val('rkTel'), email: cSel ? cSel.email || '' : '', imobiliaria: val('rkImob'), userId: cSel ? cSel.userId || null : null };
  const r = { id: genId(), loteId: l.id, loteamentoId: l.loteamentoId, corretor, corretorUserId: corretor.userId || null, cliente: { nome: val('rlNome'), cpf: val('rlCpf'), telefone: val('rlTel'), email: val('rlEmail'), cidade: val('rlCidade'), endereco: val('rlEnd') },
    dataReserva: hoje, validade: addDays(hoje, dias), status: 'aprovada', aprovadaEm: hoje, proposta: { valor: l.preco, entrada: 0, nParcelas: 0 }, obs: val('raObs'), criadoEm: new Date().toISOString() };
  upsert('reservas', r); upsert('lotes', Object.assign({}, l, { status: 'reservado', reservaId: r.id }));
  if (corretor.telefone || corretor.creci) registrarCorretor(corretor);
  logAct(`Reserva registrada pelo admin: ${loteLabel(l)} — ${r.cliente.nome}`);
  closeModal(); renderCurrent(); toast('✅', 'Reserva registrada', '');
}

// ================================================================ VENDAS
function renderAVendas() {
  const esc0 = escopoAtual(); const v = $('#av-vendas');
  const f = state.filters.avendas = state.filters.avendas || { sub: 'vendas', status: 'all', busca: '' };
  if (f.sub === 'comissoes') { renderComissoes(v, f); return; }
  const all = vendasDo(esc0).sort((a, b) => (b.dataVenda || '').localeCompare(a.dataVenda || ''));
  const list = all.filter(x => (f.status === 'all' || x.status === f.status) && (!f.busca || x.cliente.nome.toLowerCase().includes(f.busca.toLowerCase()) || imovelLabel(x).toLowerCase().includes(f.busca.toLowerCase())));
  const ativas = all.filter(x => x.status !== 'distrato');
  const tot = ativas.reduce((s, x) => s + num(x.valorTotal), 0);
  v.innerHTML = `
    <div class="subtabs"><div class="chip active">💰 Vendas</div><div class="chip" onclick="state.filters.avendas.sub='comissoes';renderAVendas()">🤝 Comissões</div></div>
    <div class="kpi-grid cols3">
      <div class="kpi c-blue"><div class="lbl">Vendas</div><div class="val">${ativas.length}</div><div class="sub">${fmtMoneyShort(tot)}</div></div>
      <div class="kpi c-green"><div class="lbl">Quitadas</div><div class="val">${all.filter(x => x.status === 'quitada').length}</div></div>
      <div class="kpi c-primary"><div class="lbl">Ticket médio</div><div class="val">${fmtMoneyShort(ativas.length ? tot / ativas.length : 0)}</div></div>
    </div>
    <div class="chips">${[['all', 'Todas'], ['ativa', 'Ativas'], ['quitada', 'Quitadas'], ['distrato', 'Distratos']].map(([k, l]) => `<div class="chip ${f.status === k ? 'active' : ''}" onclick="state.filters.avendas.status='${k}';renderAVendas()">${l}<span class="n">${k === 'all' ? all.length : all.filter(x => x.status === k).length}</span></div>`).join('')}</div>
    <div class="filters">${escopoSelectHtml('renderAVendas()')}<input type="text" placeholder="🔎 Cliente ou imóvel" value="${esc(f.busca)}" oninput="aSetFiltro('avendas','busca',this.value,renderAVendas,this)"><button class="btn btn-primary btn-sm" onclick="novaVendaEscolhendoEmp()">＋ Nova venda</button></div>
    ${list.length ? list.map(x => vendaCardHtml(x)).join('') : `<div class="empty"><div class="ic">💰</div><p>Nenhuma venda registrada.<br>Converta uma reserva ou registre uma venda direta.</p></div>`}`;
}
function vendaCardHtml(x) {
  const r = vendaResumo(x); const pct = r.total ? Math.round(r.pago / r.total * 100) : 0;
  return `<div class="item ${x.status === 'distrato' ? 'cancelada' : x.status}" onclick="abrirVendaAdmin('${x.id}')">
    <div class="info"><div class="title">${esc(imovelLabel(x))} · ${esc(x.cliente.nome)}${!escopoAtual() ? ` <span class="tiny muted">· ${esc((getLoteamento(x.loteamentoId) || {}).nome || '')}</span>` : ''}</div>
      <div class="meta"><span>📅 ${fmtDate(x.dataVenda)}</span><span>· 🧑‍💼 ${esc(x.corretor.nome)}</span><span>· ${x.nParcelas}× ${fmtMoney(x.valorParcela)}</span>${r.atrasado ? `<span style="color:var(--danger)">· ${fmtMoney(r.atrasado)} em atraso</span>` : ''}</div>
      ${x.status !== 'distrato' ? `<div class="progress"><div style="width:${pct}%"></div></div><div class="tiny muted">${r.nPagas}/${r.n} parcelas · ${fmtMoney(r.pago)} recebido (${pct}%)</div>` : ''}</div>
    <div class="side"><div class="value">${fmtMoney(x.valorTotal)}</div><span class="badge ${x.status === 'distrato' ? 'distrato' : x.status}">${statusLabel(x.status)}</span></div></div>`;
}
function abrirVendaAdmin(id) {
  const x = getVenda(id); if (!x) return; const l = getLote(x.loteId); const r = vendaResumo(x); const c = x.cliente; const recs = recebiveisDe(x.id);
  const body = `
    <div class="row-between mb"><div><div class="price-big">${fmtMoney(x.valorTotal)}</div><div class="price-sub">Recebido ${fmtMoney(r.pago)} · Restante ${fmtMoney(r.restante)}${r.atrasado ? ` · <span style="color:var(--danger)">Atrasado ${fmtMoney(r.atrasado)}</span>` : ''}</div></div><span class="badge ${x.status === 'distrato' ? 'distrato' : x.status}" style="font-size:0.75rem">${statusLabel(x.status)}</span></div>
    <div class="progress mb"><div style="width:${r.total ? Math.round(r.pago / r.total * 100) : 0}%"></div></div>
    <div class="detail-grid">
      <div><div class="k">Imóvel</div><div class="v">${esc(imovelLabel(x))}</div></div><div><div class="k">Data da venda</div><div class="v">${fmtDate(x.dataVenda)}</div></div>
      <div><div class="k">Cliente</div><div class="v">${esc(c.nome)}</div></div><div><div class="k">CPF/CNPJ</div><div class="v">${esc(fmtCPF(c.cpf)) || '—'}</div></div>
      <div><div class="k">Telefone</div><div class="v"><a href="${waLink(c.telefone, '')}" target="_blank">${esc(fmtPhone(c.telefone))}</a></div></div><div><div class="k">E-mail</div><div class="v">${esc(c.email) || '—'}</div></div>
      <div class="full"><div class="k">Endereço</div><div class="v">${esc([c.endereco, c.cidade].filter(Boolean).join(' · ')) || '—'}</div></div>
      <div><div class="k">Corretor</div><div class="v">${esc(x.corretor.nome)}${x.corretor.creci ? ' · ' + esc(x.corretor.creci) : ''}</div></div><div><div class="k">Comissão</div><div class="v">${fmtMoney(x.comissaoValor)} (${fmtNum(x.comissaoPct, 1)}%) <span class="badge ${x.comissaoPaga ? 'paga' : 'pendente'}">${x.comissaoPaga ? 'paga' : 'a pagar'}</span></div></div>
      <div><div class="k">Entrada</div><div class="v">${fmtMoney(x.entrada)}</div></div><div><div class="k">Parcelas</div><div class="v">${x.nParcelas}× ${fmtMoney(x.valorParcela)}${x.baloes && x.baloes.length ? ` + ${x.baloes.length} reforço(s)` : ''}</div></div>
      ${x.obs ? `<div class="full"><div class="k">Observações</div><div class="v">${esc(x.obs)}</div></div>` : ''}
    </div>
    ${correcaoResumoVenda(x)}
    <h3 class="small" style="margin:8px 0 6px;font-weight:800">📆 Parcelas</h3>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>Parcela</th><th>Venc.</th><th class="num">Valor</th><th class="num">Pago</th><th>Status</th><th></th></tr></thead>
    <tbody>${recs.map(rc => { const st = recStatus(rc); return `<tr><td>${esc(rc.descricao)}</td><td>${fmtDate(rc.vencimento)}</td><td class="num">${fmtMoney(recValor(rc))}${recCorrecao(rc) > 0.005 ? `<br><span class="tiny muted">base ${fmtMoney(rc.valor)}</span>` : ''}</td><td class="num">${rc.valorPago ? fmtMoney(rc.valorPago) + (rc.dataPagamento ? `<br><span class="tiny muted">${fmtDate(rc.dataPagamento)}</span>` : '') : '—'}</td><td><span class="badge ${st}">${statusLabel(st)}</span>${st === 'atrasado' ? `<br><span class="tiny" style="color:var(--danger)">atual. ${fmtMoney(recAtualizado(rc))}</span>` : ''}</td><td>${x.status !== 'distrato' ? (!pode('financeiro.baixar') ? '' : st === 'pago' ? `<button class="btn-icon" title="Estornar" onclick="estornarPagamento('${rc.id}','${x.id}')">↩</button>` : `<button class="btn-icon ok" title="Registrar pagamento" onclick="abrirPagamento('${rc.id}','${x.id}')">💵</button>`) : ''} <button class="btn-icon" title="Boleto" onclick="abrirBoleto('${rc.id}')">🏦</button> <button class="btn-icon" title="Editar parcela" onclick="editarRecebivel('${rc.id}','${x.id}')">✏️</button></td></tr>`; }).join('')}</tbody>
    <tfoot><tr><td colspan="2">Total</td><td class="num">${fmtMoney(r.total)}</td><td class="num">${fmtMoney(r.pago)}</td><td colspan="2"></td></tr></tfoot></table></div>`;
  let footer = `${pode('vendas.editar') ? `<button class="btn btn-secondary" onclick="abrirVendaForm('${x.id}')">✏️ Editar</button>` : ''}<button class="btn btn-outline" onclick="imprimirExtrato('${x.id}')">🖨️ Extrato</button><button class="btn btn-outline" onclick="gerarContratoVenda('${x.id}')">📄 Contrato</button>${x.status !== 'distrato' && vendaResumo(x).restante > 0.005 && pode('financeiro.antecipar') ? `<button class="btn btn-success" onclick="abrirAntecipacao('${x.id}')">💸 Antecipar / quitar</button>` : ''}`;
  if (c.telefone) footer += `<a class="btn btn-wa" target="_blank" href="${waLink(c.telefone, extratoTexto(x))}">💬 Enviar resumo</a>`;
  if (x.status !== 'distrato' && pode('vendas.distrato')) footer += `<button class="btn btn-outline-danger" onclick="distratoVenda('${x.id}')">Distrato</button>`;
  openModal({ title: `💰 Venda · ${esc(imovelShort(x))}`, body, footer, wide: true });
}
/* Venda nova a partir da aba global: primeiro o empreendimento, depois o formulário. */
function novaVendaEscolhendoEmp() {
  comEmpreendimento('💰 Nova venda', 'Em qual empreendimento entra esta venda?', () => abrirVendaForm());
}
function abrirVendaForm(id, loteId, reservaId) {
  const lot = curLot(); const x = id ? getVenda(id) : null;
  const res = reservaId ? getReserva(reservaId) : null;
  const cond = lot.cond || {};
  window.vfReservaId = reservaId || null;
  const carteira = ehCarteira(lot);
  const lotes = carteira ? [] : lotesDo(lot.id).filter(l => l.status === 'disponivel' || (x && l.id === x.loteId) || (loteId && l.id === loteId));
  if (!carteira && !x && !lotes.length) { toast('⚠️', 'Nenhum lote disponível para venda', '', true); return; }
  const c = x ? x.cliente : (res ? res.cliente : {}); const k = x ? x.corretor : (res ? res.corretor : { nome: db.config.empresa || 'Venda direta' });
  const sel = carteira ? '' : (x ? x.loteId : (loteId || lotes[0].id)); const lsel = sel ? getLote(sel) : null;
  const im = (x && x.imovel) || {};
  const vsel = x ? (x.vendedorId || '') : '';
  const pv = res && res.proposta ? res.proposta : {};
  const total = x ? x.valorTotal : (pv.valor || (lsel ? lsel.preco : 0));
  const entrada = x ? x.entrada : (pv.entrada != null ? pv.entrada : Math.round(total * (num(cond.entradaMinPct) || 10) / 100));
  const n = x ? x.nParcelas : (pv.nParcelas || Math.min(60, Number(cond.maxParcelas) || 60));
  const hoje = todayStr();
  const temPagos = x && recebiveisDe(x.id).some(r => num(r.valorPago) > 0);
  const corrs = db.corretores.filter(cc => cc.ativo !== false);
  const body = `
    ${res ? `<div class="alert info" style="cursor:default"><span>Convertendo a reserva de <b>${esc(res.cliente.nome)}</b> (corretor ${esc(res.corretor.nome)}).</span></div>` : ''}
    ${carteira ? `<div class="fieldset"><span class="lg">🏠 Imóvel</span>
      <div class="fg"><label>Descrição *</label><input type="text" id="vfImDesc" value="${esc(im.descricao || '')}" placeholder="Ex.: Apartamento 302, Ed. Aurora"></div>
      <div class="frow"><div class="fg"><label>Endereço</label><input type="text" id="vfImEnd" value="${esc(im.endereco || '')}"></div>
        <div class="fg"><label>Matrícula</label><input type="text" id="vfImMat" value="${esc(im.matricula || '')}"></div></div>
      <details class="qualif"><summary>📋 Qualificação do imóvel para contrato e escritura</summary>
        <div class="fg"><label>Descrição conforme a matrícula</label><textarea id="vfImDescMat" rows="3" placeholder="Copie do registro, com as confrontações, exatamente como está na matrícula.">${esc(im.descricaoMatricula || '')}</textarea></div>
        <div class="frow"><div class="fg"><label>Cartório de Registro de Imóveis</label><input type="text" id="vfImCart" value="${esc(im.cartorio || '')}"></div>
          <div class="fg"><label>Área (m²)</label><input type="number" id="vfImArea" step="0.01" value="${im.area || ''}"></div></div>
        <div class="frow3"><div class="fg"><label>CEP</label><input type="text" id="vfImCep" value="${esc(im.cep || '')}"></div>
          <div class="fg"><label>Bairro</label><input type="text" id="vfImBairro" value="${esc(im.bairro || '')}"></div>
          <div class="fg"><label>Cidade</label><input type="text" id="vfImCidade" value="${esc(im.cidade || '')}"></div></div></details></div>`
    : `<div class="fg"><label>Lote *</label><select id="vfLote" onchange="vfLoteChange()" ${x ? 'disabled' : ''}>${optionsHtml(lotes, sel, l => `${loteLabel(l)} — ${fmtMoney(l.preco)}`)}</select></div>`}
    <div class="fieldset"><span class="lg">🧑‍🤝‍🧑 Comprador</span>
      ${pessoaFormHtml('vc', c, { recolher: true, conjuge: true, telObrigatorio: true })}</div>
    <div class="fieldset"><span class="lg">✍️ Vendedor</span>
      <div class="fg"><label>Quem vende neste contrato</label><select id="vfVendedor">
        <option value="">${esc(vendedorPadrao().nome || 'Empresa do cadastro')} — padrão</option>
        ${db.vendedores.map(vd => `<option value="${esc(vd.id)}" ${vsel === vd.id ? 'selected' : ''}>${esc(vd.nome)}${vd.cpf ? ' — ' + esc(fmtCPF(vd.cpf)) : ''}</option>`).join('')}</select>
        <p class="help">Cadastre outros CNPJs do grupo em Cadastros › Vendedores. O contrato sai com a qualificação de quem você escolher aqui.</p></div></div>
    <div class="fieldset"><span class="lg">🧑‍💼 Corretor</span>
      ${!x && !res ? `<div class="fg"><label>Corretor cadastrado</label><select id="vkSel" onchange="vkPreenche()"><option value="">— Venda direta / digitar —</option>${optionsHtml(corrs, '', cc => cc.nome + (cc.imobiliaria ? ' (' + cc.imobiliaria + ')' : ''))}</select></div>` : ''}
      <div class="frow"><div class="fg"><label>Nome</label><input type="text" id="vkNome" value="${esc(k.nome || '')}"></div><div class="fg"><label>CRECI</label><input type="text" id="vkCreci" value="${esc(k.creci || '')}"></div></div>
      <div class="frow"><div class="fg"><label>Telefone</label><input type="tel" id="vkTel" value="${esc(k.telefone || '')}"></div><div class="fg"><label>Imobiliária</label><input type="text" id="vkImob" value="${esc(k.imobiliaria || '')}"></div></div>
      <div class="frow"><div class="fg"><label>Comissão (%)</label><input type="number" id="vkPct" step="0.1" value="${x ? x.comissaoPct : db.config.comissaoPct}" oninput="vfCalc()"></div><div class="fg"><label>Comissão (R$)</label><input type="number" id="vkVal" step="0.01" value="${x ? x.comissaoValor : ''}" oninput="vfCalcPct()"></div></div></div>
    <div class="fieldset"><span class="lg">💰 Condições de pagamento</span>
      <div class="frow"><div class="fg"><label>Data da venda *</label><input type="date" id="vfData" value="${x ? x.dataVenda : hoje}"></div><div class="fg"><label>Valor da venda (R$) *</label><input type="number" id="vfTotal" step="0.01" value="${total}" oninput="vfCalc()"></div></div>
      <div class="frow"><div class="fg"><label>Entrada (R$)</label><input type="number" id="vfEntrada" step="0.01" value="${entrada}" oninput="vfCalc()"></div><div class="fg"><label>Data da entrada</label><input type="date" id="vfDataEntrada" value="${x ? x.dataEntrada || x.dataVenda : hoje}"></div></div>
      <div class="frow3"><div class="fg"><label>Nº parcelas</label><input type="number" id="vfN" min="0" value="${n}" oninput="vfCalc()"></div><div class="fg"><label>Juros (% a.m.)</label><input type="number" id="vfJuros" step="0.01" value="${x ? (x.jurosMes || 0) : (cond.jurosMes || 0)}" oninput="vfCalc()"></div><div class="fg"><label>1º vencimento</label><input type="date" id="vfPrimeiro" value="${x ? x.primeiroVencimento : addMonths(hoje, 1)}"></div></div>
      <div class="fg"><label>Valor da parcela (R$) <span class="tiny muted">— calculado; pode ajustar</span></label><input type="number" id="vfParcela" step="0.01" value="${x ? x.valorParcela : ''}" oninput="vfManual=true;vfCalc()"></div>
      ${indiceSelectHtml(x ? x.indiceId : '', x ? x.indiceBase : '', x ? x.dataVenda : hoje)}
      <div class="fg"><label>Reforços / balões (opcional)</label><div id="vfBaloes"></div><button class="btn btn-secondary btn-sm" onclick="addBalao()">＋ Adicionar reforço</button></div>
      <div class="sim-result" id="vfResumo"></div>
      ${temPagos ? '<p class="tiny muted mt">⚠️ Esta venda já tem pagamentos registrados: as parcelas <b>não serão regeradas</b> ao salvar. Edite parcelas individualmente na tela da venda.</p>' : ''}
    </div>
    <div class="fg"><label>Observações / contrato</label><textarea id="vfObs">${esc(x ? x.obs || '' : (res && res.obs ? res.obs : ''))}</textarea></div>`;
  openModal({ title: x ? '✏️ Editar venda' : '💰 Registrar venda', body, footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="salvarVenda('${x ? x.id : ''}','${reservaId || ''}')">Salvar venda</button>`, wide: true });
  window.vfManual = !!x; window.vfBaloes = x ? (x.baloes || []).map(b => ({ ...b })) : [];
  renderBaloes(); vfCalc();
}
/* Comprador e cônjuge saem do mesmo formulário; o registro anterior entra como base para
   não perder campo que a tela do momento não mostrou. */
function compradorDoForm(x, res) {
  const antigo = (x && x.cliente) || (res && res.cliente) || {};
  const c = pessoaDoForm('vc', antigo);
  c.conjuge = conjugeDoForm('vc', c, antigo.conjuge);
  return c;
}
function vendedorEscolhido(id) {
  const v = id ? db.vendedores.find(y => y.id === id) : null;
  return v ? Object.assign({}, v) : vendedorPadrao();
}
function vkPreenche() { const c = db.corretores.find(x => x.id === val('vkSel')); if (!c) return; setVal('vkNome', c.nome); setVal('vkCreci', c.creci); setVal('vkTel', c.telefone); setVal('vkImob', c.imobiliaria); }
function vfLoteChange() { const l = getLote(val('vfLote')); if (l) { setVal('vfTotal', l.preco); window.vfManual = false; vfCalc(); } }
function addBalao() { window.vfBaloes.push({ data: addMonths(val('vfPrimeiro') || todayStr(), 12), valor: 0 }); renderBaloes(); vfCalc(); }
function delBalao(i) { window.vfBaloes.splice(i, 1); renderBaloes(); vfCalc(); }
function renderBaloes() {
  const box = $('#vfBaloes'); if (!box) return;
  box.innerHTML = (window.vfBaloes || []).map((b, i) => `<div class="frow" style="grid-template-columns:1fr 1fr auto;margin-bottom:6px"><input type="date" value="${b.data || ''}" onchange="vfBaloes[${i}].data=this.value;vfCalc()"><input type="number" step="0.01" placeholder="Valor" value="${b.valor || ''}" oninput="vfBaloes[${i}].valor=num(this.value);vfCalc()"><button class="btn-icon del" onclick="delBalao(${i})">🗑</button></div>`).join('');
}
function vfCalc() {
  const total = num(val('vfTotal')), entrada = num(val('vfEntrada')), n = Math.max(0, Math.round(num(val('vfN')))), juros = num(val('vfJuros')) / 100;
  const baloes = (window.vfBaloes || []).reduce((s, b) => s + num(b.valor), 0);
  const saldo = Math.max(0, total - entrada - baloes);
  if (!window.vfManual) setVal('vfParcela', n ? (Math.round(pmt(juros, n, saldo) * 100) / 100) : 0);
  const parcela = num(val('vfParcela'));
  const soma = entrada + baloes + parcela * n;
  const pct = num(val('vkPct')); if (document.activeElement && document.activeElement.id !== 'vkVal') setVal('vkVal', Math.round(total * pct) / 100);
  const el = $('#vfResumo'); if (!el) return;
  const diff = soma - total;
  el.innerHTML = `Entrada <b>${fmtMoney(entrada)}</b>${baloes ? ` + reforços <b>${fmtMoney(baloes)}</b>` : ''} + <b>${n}×</b> ${fmtMoney(parcela)} = <b>${fmtMoney(soma)}</b><br><span class="tiny ${Math.abs(diff) > 1 ? (diff > 0 ? '' : '') : 'muted'}" style="${Math.abs(diff) > 1 ? 'color:' + (diff > 0 ? '#1d4ed8' : '#b45309') : ''}">${Math.abs(diff) <= 1 ? 'Soma confere com o valor da venda.' : diff > 0 ? `Soma ${fmtMoney(diff)} acima do valor da venda (juros do parcelamento).` : `Faltam ${fmtMoney(-diff)} para fechar o valor da venda — ajuste entrada, parcelas ou reforços.`}</span>`;
}
function vfCalcPct() { const total = num(val('vfTotal')), v = num(val('vkVal')); if (total) setVal('vkPct', Math.round(v / total * 1000) / 10); }
function salvarVenda(id, reservaId) {
  const lot = curLot(); const x = id ? getVenda(id) : null; const res = reservaId ? getReserva(reservaId) : null;
  const carteira = ehCarteira(lot);
  const l = carteira ? null : getLote(x ? x.loteId : val('vfLote'));
  if (!carteira) {
    if (!l) { toast('⚠️', 'Selecione o lote', '', true); return; }
    if (!x && l.status !== 'disponivel' && !(reservaId && l.status === 'reservado')) { toast('⚠️', 'Lote não está disponível', '', true); return; }
  } else if (!val('vfImDesc')) { toast('⚠️', 'Descreva o imóvel', 'Ex.: Apartamento 302, Ed. Aurora', true); return; }
  if (!val('vcNome') || !val('vcTel')) { toast('⚠️', 'Informe nome e telefone do comprador', '', true); return; }
  const total = num(val('vfTotal')); if (!total || !val('vfData')) { toast('⚠️', 'Informe valor e data da venda', '', true); return; }
  const n = Math.max(0, Math.round(num(val('vfN'))));
  if (n && !val('vfPrimeiro')) { toast('⚠️', 'Informe o 1º vencimento', '', true); return; }
  const baloes = (window.vfBaloes || []).filter(b => b.data && num(b.valor) > 0);
  const venda = Object.assign({}, x || { id: genId(), loteId: l ? l.id : null, loteamentoId: lot.id, status: 'ativa', reservaId: reservaId || null, criadoEm: new Date().toISOString(), comissaoPaga: false, comissaoData: null }, {
    imovel: carteira ? {
      descricao: val('vfImDesc'), endereco: val('vfImEnd'), matricula: val('vfImMat'), descricaoMatricula: val('vfImDescMat'),
      cartorio: val('vfImCart'), area: num(val('vfImArea')) || null, cep: val('vfImCep'), bairro: val('vfImBairro'), cidade: val('vfImCidade')
    } : null,
    cliente: compradorDoForm(x, res),
    vendedorId: val('vfVendedor') || null,
    /* O vendedor é congelado na venda: se o cadastro mudar depois, o contrato já assinado
       continua contando a história que foi assinada. */
    vendedor: vendedorEscolhido(val('vfVendedor')),
    corretor: { nome: val('vkNome') || 'Venda direta', creci: val('vkCreci'), telefone: val('vkTel'), imobiliaria: val('vkImob'), email: (x && x.corretor.email) || '', userId: (x && x.corretor.userId) || (res && res.corretor && res.corretor.userId) || (corretorSelecionado('vkSel') || {}).userId || null },
    corretorUserId: (x && x.corretorUserId) || (res && res.corretorUserId) || (corretorSelecionado('vkSel') || {}).userId || null,
    dataVenda: val('vfData'), valorTotal: total, entrada: num(val('vfEntrada')), dataEntrada: val('vfDataEntrada') || val('vfData'), nParcelas: n, jurosMes: num(val('vfJuros')),
    valorParcela: num(val('vfParcela')), primeiroVencimento: val('vfPrimeiro') || val('vfData'), baloes, comissaoPct: num(val('vkPct')), comissaoValor: num(val('vkVal')), obs: val('vfObs'),
    indiceId: val('vfIndice') || null, indiceBase: val('vfIndiceBase') || monthKey(val('vfData'))
  });
  upsert('vendas', venda);
  const temPagos = x && recebiveisDe(x.id).some(r => num(r.valorPago) > 0);
  if (!temPagos) {
    if (x) recebiveisDe(x.id).forEach(r => removeRec('recebiveis', r.id));
    gerarRecebiveis(venda).forEach(r => upsert('recebiveis', r));
  }
  if (!x) {
    if (l) upsert('lotes', Object.assign({}, l, { status: 'vendido', vendaId: venda.id, reservaId: null }));
    if (reservaId) { const r = getReserva(reservaId); if (r) upsert('reservas', Object.assign({}, r, { status: 'convertida', encerradaEm: new Date().toISOString() })); }
    if (venda.corretor.telefone || venda.corretor.creci) registrarCorretor(venda.corretor);
    logAct(`Venda registrada: ${imovelLabel(venda)} — ${venda.cliente.nome} — ${fmtMoney(total)}`);
  } else logAct(`Venda editada: ${imovelLabel(venda)} — ${venda.cliente.nome}`);
  atualizarStatusVenda(venda.id);
  closeModal(); renderCurrent(); toast('✅', x ? 'Venda atualizada' : 'Venda registrada', imovelLabel(venda));
}
function distratoVenda(id) {
  const x = getVenda(id); if (!x) return;
  const motivo = prompt('Confirmar DISTRATO desta venda? O lote volta a ficar disponível e as parcelas em aberto são canceladas. Motivo:', '');
  if (motivo === null) return;
  upsert('vendas', Object.assign({}, x, { status: 'distrato', distratoEm: todayStr(), motivo }));
  const l = x.loteId ? getLote(x.loteId) : null; if (l && l.vendaId === x.id) upsert('lotes', Object.assign({}, l, { status: 'disponivel', vendaId: null }));
  logAct(`Distrato: ${imovelLabel(x)} — ${x.cliente.nome}${motivo ? ' (' + motivo + ')' : ''}`);
  closeModal(); renderCurrent(); toast('↩️', 'Distrato registrado', '');
}

// ================================================================ CADASTROS
function renderCadastros() {
  const v = $('#av-cadastros');
  state.sub.cad = state.sub.cad || 'corretores';
  const todasTabs = [['corretores', Cloud.active ? '👥 Equipe' : '🧑‍💼 Corretores', 'equipe.gerenciar'],
    ['vendedores', '✍️ Vendedores', 'config.editar'], ['permissoes', '🔐 Permissões', 'equipe.gerenciar'], ['categorias', '🏷️ Categorias', 'custos.editar'], ['documentos', '📄 Documentos', 'documentos.editar'],
    ['indices', '📈 Índices', 'indices.editar'], ['cobranca', '🔔 Cobrança', 'cobranca.registrar'], ['banco', '🏦 Banco', 'config.editar'], ['vitrine', '🌐 Vitrine', 'vitrine.gerenciar'],
    ['config', '⚙️ Configurações', 'config.editar'], ['nuvem', Cloud.active ? '☁️ Conta' : '☁️ Nuvem', null], ['backup', '💾 Backup', 'backup.usar']];
  const tabs = todasTabs.filter(t => !t[2] || pode(t[2])).map(t => [t[0], t[1]]);
  if (!tabs.find(t => t[0] === state.sub.cad)) state.sub.cad = tabs.length ? tabs[0][0] : 'config';
  const sub = state.sub.cad;
  let html = `<div class="subtabs">${tabs.map(([k, l]) => `<div class="chip ${sub === k ? 'active' : ''}" onclick="state.sub.cad='${k}';renderCadastros()">${l}</div>`).join('')}</div>`;
  if (sub === 'corretores') html += Cloud.active ? cadEquipeHtml() : cadCorretoresHtml();
  else if (sub === 'vendedores') html += cadVendedoresHtml();
  else if (sub === 'categorias') html += cadCategoriasHtml();
  else if (sub === 'documentos') html += cadDocumentosHtml();
  else if (sub === 'indices') html += cadIndicesHtml();
  else if (sub === 'cobranca') html += cadCobrancaHtml();
  else if (sub === 'banco') html += cadBancoHtml();
  else if (sub === 'permissoes') html += cadPermissoesHtml();
  else if (sub === 'vitrine') html += cadVitrineHtml();
  else if (sub === 'config') html += cadConfigHtml();
  else if (sub === 'nuvem') html += Cloud.active ? cadContaHtml() : cadNuvemHtml();
  else if (sub === 'backup') html += cadBackupHtml();
  v.innerHTML = html;
  if (sub === 'nuvem') renderSyncStatus();
}
function cadLoteamentoHtml() {
  const lot = curLot(); if (!lot) return `<div class="card"><p class="help">Nenhum loteamento. <button class="btn btn-primary btn-sm" onclick="abrirLoteamentoForm()">＋ Cadastrar</button></p></div>`;
  const c = lot.cond || {}; const orc = lot.orcamento || {};
  const cs = custosDo(lot.id);
  return `<div class="card"><h3>${ehCarteira(lot) ? '🏠' : '🏘️'} ${esc(lot.nome)} <span class="badge neutral">${esc(empLabel(lot))}</span> <span class="h-actions"><button class="btn btn-secondary btn-sm" onclick="abrirLoteamentoForm('${lot.id}')">✏️ Editar</button></span></h3>
      <div class="detail-grid"><div><div class="k">Cidade</div><div class="v">${esc(lot.cidade) || '—'}</div></div><div><div class="k">Endereço</div><div class="v">${esc(lot.endereco) || '—'}</div></div><div class="full"><div class="k">Descrição (aparece para os corretores)</div><div class="v">${esc(lot.descricao) || '—'}</div></div>
      <div><div class="k">Entrada mínima</div><div class="v">${fmtNum(c.entradaMinPct || 0, 0)}%</div></div><div><div class="k">Parcelas máx.</div><div class="v">${c.maxParcelas || '—'}</div></div><div><div class="k">Juros</div><div class="v">${c.jurosMes ? fmtNum(c.jurosMes, 2) + '% a.m.' : 'sem juros'}</div></div><div><div class="k">Desconto à vista</div><div class="v">${fmtNum(c.descontoVistaPct || 0, 0)}%</div></div></div></div>
    ${ehCarteira(lot) && !custosDo(lot.id).length ? '' : `<div class="card"><h3>📋 Orçamento de custos por categoria <span class="h-actions"><button class="btn btn-secondary btn-sm" onclick="abrirOrcamentoForm()">✏️ Editar</button></span></h3>
      ${db.categorias.filter(cat => num(orc[cat.id]) > 0).map(cat => { const real = cs.filter(x => x.categoriaId === cat.id).reduce((s, x) => s + num(x.valor), 0); const pct = Math.round(real / orc[cat.id] * 100); return `<div class="mb"><div class="row-between small"><span><span class="dot" style="background:${cat.cor}"></span> ${esc(cat.nome)}</span><span class="muted">${fmtMoney(real)} de ${fmtMoney(orc[cat.id])} (${pct}%)</span></div><div class="progress"><div class="${pct > 100 ? 'over' : pct >= 90 ? 'warn' : ''}" style="width:${Math.min(100, pct)}%"></div></div></div>`; }).join('') || '<p class="help">Nenhum orçamento definido. Defina o valor planejado por categoria para acompanhar orçado × realizado.</p>'}
      ${Object.values(orc).some(x => num(x) > 0) ? `<p class="small mt"><b>Total orçado: ${fmtMoney(Object.values(orc).reduce((s, x) => s + num(x), 0))}</b> · realizado ${fmtMoney(cs.reduce((s, x) => s + num(x.valor), 0))}</p>` : ''}</div>`}`;
}
function abrirLoteamentoForm(id) {
  const l = id ? getLoteamento(id) : null; const c = (l && l.cond) || { entradaMinPct: 10, maxParcelas: 120, jurosMes: 0, descontoVistaPct: 5 };
  const tipo = empTipo(l);
  const body = `<div class="fg"><label>Tipo *</label><select id="lmTipo" ${l ? 'disabled' : ''}>
      <option value="loteamento" ${tipo === 'loteamento' ? 'selected' : ''}>Loteamento — com planta e lotes numerados</option>
      <option value="carteira" ${tipo === 'carteira' ? 'selected' : ''}>Carteira — imóveis avulsos, sem planta</option></select>
      <div class="hint">${l ? 'O tipo não muda depois de criado.' : 'Na carteira cada venda descreve o imóvel. Serve para apartamento, sala, casa, terreno de terceiros — tudo que não é lote do seu loteamento. Como o imóvel não é seu, ela não tem planta, lote, reserva nem controle de obra: só a venda e o recebível.'}</div></div>
    <div class="fg"><label>Nome *</label><input type="text" id="lmNome" value="${esc(l ? l.nome : '')}" placeholder="Ex.: Residencial Vista Verde"></div>
    <div class="frow"><div class="fg"><label>Cidade / UF</label><input type="text" id="lmCidade" value="${esc(l ? l.cidade || '' : '')}"></div><div class="fg"><label>Endereço / acesso</label><input type="text" id="lmEnd" value="${esc(l ? l.endereco || '' : '')}"></div></div>
    <div class="fg"><label>Descrição para os corretores</label><textarea id="lmDesc" placeholder="Infraestrutura, diferenciais, área de lazer…">${esc(l ? l.descricao || '' : '')}</textarea></div>
    <details class="qualif"><summary>📋 Endereço e registro — para contrato, escritura e declaração fiscal</summary>
      <div class="frow3"><div class="fg"><label>CEP</label><input type="text" id="lmCep" value="${esc(l ? l.cep || '' : '')}"></div>
        <div class="fg" style="grid-column:span 2"><label>Logradouro</label><input type="text" id="lmLogr" value="${esc(l ? l.logradouro || '' : '')}" placeholder="Rua, avenida, rodovia…"></div></div>
      <div class="frow3"><div class="fg"><label>Número</label><input type="text" id="lmNum" value="${esc(l ? l.numeroEnd || '' : '')}"></div>
        <div class="fg"><label>Bairro</label><input type="text" id="lmBairro" value="${esc(l ? l.bairro || '' : '')}"></div>
        <div class="fg"><label>UF</label><select id="lmUf"><option value="">—</option>${UFS.map(u => `<option value="${u}" ${(l || {}).uf === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div></div>
      <div class="frow"><div class="fg"><label>Cartório de Registro de Imóveis</label><input type="text" id="lmCartorio" value="${esc(l ? l.cartorio || '' : '')}" placeholder="Ex.: 1º Ofício de Registro de Imóveis da Comarca de…"></div>
        <div class="fg"><label>Matrícula mãe</label><input type="text" id="lmMatMae" value="${esc(l ? l.matriculaMae || '' : '')}"></div></div>
      <div class="fg"><label>Código do município no IBGE</label><input type="text" id="lmIbge" value="${esc(l ? l.codigoIbge || '' : '')}" placeholder="7 dígitos">
        <div class="hint">Só a declaração fiscal usa. Se não souber agora, deixe em branco e preencha depois.</div></div></details>
    <div class="fieldset"><span class="lg">💳 Condições de pagamento padrão</span>
      <div class="frow"><div class="fg"><label>Entrada mínima (%)</label><input type="number" id="lmEntrada" step="0.1" value="${c.entradaMinPct ?? 10}"></div><div class="fg"><label>Máximo de parcelas</label><input type="number" id="lmMaxP" value="${c.maxParcelas ?? 120}"></div></div>
      <div class="frow"><div class="fg"><label>Juros do parcelamento (% a.m.)</label><input type="number" id="lmJuros" step="0.01" value="${c.jurosMes ?? 0}"><div class="hint">0 = sem juros (parcelas lineares)</div></div><div class="fg"><label>Desconto à vista (%)</label><input type="number" id="lmDesc2" step="0.1" value="${c.descontoVistaPct ?? 0}"></div></div></div>`;
  openModal({ title: l ? `✏️ Editar ${empLabel(l).toLowerCase()}` : '＋ Novo empreendimento', body, footer: `${l && db.loteamentos.length > 1 ? `<button class="btn btn-outline-danger" onclick="excluirLoteamento('${l.id}')">Excluir</button>` : ''}<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="salvarLoteamento('${l ? l.id : ''}')">Salvar</button>` });
  setTimeout(() => $('#lmNome').focus(), 60);
}
function salvarLoteamento(id) {
  const nome = val('lmNome'); if (!nome) { toast('⚠️', 'Informe o nome', '', true); return; }
  const prev = id ? getLoteamento(id) : null;
  const rec = Object.assign({}, prev || { id: genId(), criadoEm: new Date().toISOString(), orcamento: {}, tipo: val('lmTipo') === 'carteira' ? 'carteira' : 'loteamento' }, { nome, cidade: val('lmCidade'), endereco: val('lmEnd'), descricao: val('lmDesc'),
    cep: val('lmCep'), logradouro: val('lmLogr'), numeroEnd: val('lmNum'), bairro: val('lmBairro'), uf: val('lmUf'),
    cartorio: val('lmCartorio'), matriculaMae: val('lmMatMae'), codigoIbge: onlyDigits(val('lmIbge')), cond: { entradaMinPct: num(val('lmEntrada')), maxParcelas: Math.round(num(val('lmMaxP'))) || 120, jurosMes: num(val('lmJuros')), descontoVistaPct: num(val('lmDesc2')) } });
  upsert('loteamentos', rec);
  if (!prev) { logAct(`${empLabel(rec)} cadastrado: ${nome}`); state.empAberto = rec.id; state.empSub = 'resumo'; setCurLotSilencioso(rec.id); state.tab = 'emp'; }
  closeModal(); renderCurrent(); toast('✅', `${empLabel(rec)} salva`.replace('Loteamento salva', 'Loteamento salvo'), nome);
}
function excluirLoteamento(id) {
  const l = getLoteamento(id); if (!l) return;
  if (!confirm(`Excluir "${l.nome}" e TODOS os seus lotes, reservas, vendas e custos?`)) return;
  db.lotes.filter(x => x.loteamentoId === id).forEach(x => removeRec('lotes', x.id));
  db.reservas.filter(x => x.loteamentoId === id).forEach(x => removeRec('reservas', x.id));
  db.vendas.filter(x => x.loteamentoId === id).forEach(x => { recebiveisDe(x.id).forEach(r => removeRec('recebiveis', r.id)); removeRec('vendas', x.id); });
  db.custos.filter(x => x.loteamentoId === id).forEach(x => removeRec('custos', x.id));
  removeRec('loteamentos', id); state.lotId = null; state.plantaAdmin = null; state.plantaCorretor = null;
  closeModal(); renderCurrent(); toast('🗑️', 'Loteamento excluído', '');
}
function cadLoteamentosHtml() {
  return `<div class="card"><h3>📋 Loteamentos <span class="h-actions"><button class="btn btn-primary btn-sm" onclick="abrirLoteamentoForm()">＋ Novo</button></span></h3>
    ${db.loteamentos.map(l => { const ls = lotesDo(l.id); return `<div class="item ${l.id === state.lotId ? '' : 'bloqueado'}" onclick="setCurLot('${l.id}');state.sub.cad='loteamento';renderCadastros()"><div class="info"><div class="title">${esc(l.nome)} ${l.id === state.lotId ? '<span class="badge aprovada">atual</span>' : ''}</div><div class="meta"><span class="badge neutral">${esc(empLabel(l))}</span><span>${esc(l.cidade || '')}</span>${ehCarteira(l) ? `<span>· ${db.vendas.filter(v => v.loteamentoId === l.id && v.status !== 'distrato').length} venda(s)</span>` : `<span>· ${ls.length} lotes</span><span>· ${ls.filter(x => x.status === 'vendido').length} vendidos</span>`}</div></div><div class="side"><button class="btn-icon" onclick="event.stopPropagation();abrirLoteamentoForm('${l.id}')">✏️</button></div></div>`; }).join('') || '<p class="help">Nenhum empreendimento.</p>'}</div>`;
}
function abrirOrcamentoForm() {
  const lot = curLot(); const orc = lot.orcamento || {};
  const body = `<p class="help mb">Valor planejado por categoria. O painel compara com os custos lançados.</p>${db.categorias.map(c => `<div class="fg"><label><span class="dot" style="background:${c.cor}"></span> ${esc(c.nome)}</label><input type="number" step="0.01" id="orc_${c.id}" value="${orc[c.id] || ''}" placeholder="0,00"></div>`).join('')}`;
  openModal({ title: '📋 Orçamento por categoria', body, footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="salvarOrcamento()">Salvar</button>` });
}
function salvarOrcamento() {
  const lot = curLot(); const orc = {};
  db.categorias.forEach(c => { const v = num(val('orc_' + c.id)); if (v > 0) orc[c.id] = v; });
  upsert('loteamentos', Object.assign({}, lot, { orcamento: orc })); closeModal(); renderCadastros(); toast('✅', 'Orçamento salvo', '');
}
function cadCorretoresHtml() {
  const stats = c => { const m = x => (onlyDigits(x.telefone) && onlyDigits(x.telefone) === onlyDigits(c.telefone)) || (x.creci && c.creci && x.creci.toLowerCase() === c.creci.toLowerCase()); return { res: db.reservas.filter(r => m(r.corretor)).length, vend: db.vendas.filter(v => v.status !== 'distrato' && m(v.corretor)) }; };
  return `<div class="card"><h3>🧑‍💼 Corretores <span class="h-actions"><button class="btn btn-primary btn-sm" onclick="abrirCorretorForm()">＋ Novo</button></span></h3>
    <p class="help mb">Corretores são cadastrados automaticamente quando fazem o primeiro pedido de reserva. Você também pode cadastrá-los aqui.</p>
    ${db.corretores.slice().sort((a, b) => naturalCmp(a.nome, b.nome)).map(c => { const s = stats(c); return `<div class="item ${c.ativo === false ? 'bloqueado' : ''}" onclick="abrirCorretorForm('${c.id}')"><div class="info"><div class="title">${esc(c.nome)} ${c.ativo === false ? '<span class="badge neutral">inativo</span>' : ''}</div><div class="meta"><span>${esc(c.creci || 'sem CRECI')}</span><span>· ${esc(fmtPhone(c.telefone))}</span>${c.imobiliaria ? `<span>· ${esc(c.imobiliaria)}</span>` : ''}<span>· ${s.res} reserva(s) · ${s.vend.length} venda(s) · ${fmtMoneyShort(s.vend.reduce((t, v) => t + num(v.valorTotal), 0))}</span></div></div><div class="side">${c.telefone ? `<a class="btn-icon" style="background:#dcfce7;color:#166534;text-decoration:none" target="_blank" href="${waLink(c.telefone, '')}" onclick="event.stopPropagation()">💬</a>` : ''}</div></div>`; }).join('') || '<p class="help">Nenhum corretor ainda.</p>'}</div>`;
}

/* ---- Vendedores (outorgantes) ----------------------------------------------------------
   Quem vende no contrato nem sempre é a empresa do cadastro: incorporadora costuma ter um
   CNPJ por empreendimento, e às vezes vende imóvel que está no nome de outra do grupo. Por
   isso a venda pergunta sempre, tendo a empresa como padrão. */
function cadVendedoresHtml() {
  const pad = vendedorPadrao();
  return `<div class="card"><h3>✍️ Quem assina como vendedor <span class="h-actions"><button class="btn btn-primary btn-sm" onclick="abrirVendedorForm()">＋ Novo</button></span></h3>
    <p class="help mb">A empresa do cadastro já entra como vendedora padrão. Cadastre aqui os outros CNPJs do grupo — a cada venda o sistema pergunta qual deles assina o contrato.</p>
    <div class="item" onclick="state.sub.cad='config';renderCadastros()"><div class="info"><div class="title">${esc(pad.nome || 'Empresa sem nome')} <span class="badge neutral">padrão</span></div>
      <div class="meta"><span>${esc(pad.cpf ? fmtCPF(pad.cpf) : 'sem CNPJ')}</span>${pad.cidade ? `<span>· ${esc(pad.cidade)}</span>` : ''}<span>· editar em Configurações</span></div></div></div>
    ${db.vendedores.slice().sort((a, b) => naturalCmp(a.nome, b.nome)).map(v => {
      const falta = faltaQualificacao(v);
      return `<div class="item" onclick="abrirVendedorForm('${v.id}')"><div class="info"><div class="title">${esc(v.nome)}</div>
        <div class="meta"><span>${esc(v.cpf ? fmtCPF(v.cpf) : 'sem documento')}</span>${v.cidade ? `<span>· ${esc(v.cidade)}</span>` : ''}
        ${falta.length ? `<span class="warn">· falta ${esc(falta.join(', '))}</span>` : '<span>· qualificação completa</span>'}</div></div>
        <div class="side"><span class="muted">${db.vendas.filter(x => x.vendedorId === v.id).length} venda(s)</span></div></div>`;
    }).join('')}</div>`;
}
function abrirVendedorForm(id) {
  const v = id ? db.vendedores.find(x => x.id === id) : null;
  const body = `<p class="help mb">Estes dados entram na qualificação do vendedor no contrato, exatamente como serão impressos.</p>
    ${pessoaFormHtml('vdd', v || { tipo: 'pj' }, {})}
    <div class="fg"><label>Observações</label><input type="text" id="vddObs" value="${esc(v ? v.obs || '' : '')}"></div>`;
  openModal({ title: v ? '✏️ Vendedor' : '＋ Novo vendedor', body, wide: true,
    footer: `${v ? `<button class="btn btn-outline-danger" onclick="excluirVendedor('${v.id}')">Excluir</button>` : ''}<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="salvarVendedor('${v ? v.id : ''}')">Salvar</button>` });
}
function salvarVendedor(id) {
  if (!val('vddNome')) { toast('⚠️', 'Informe o nome ou a razão social', '', true); return; }
  const prev = id ? db.vendedores.find(x => x.id === id) : null;
  const p = pessoaDoForm('vdd', prev || {});
  upsert('vendedores', Object.assign({}, prev || { id: genId(), criadoEm: new Date().toISOString() }, p, { obs: val('vddObs') }));
  closeModal(); renderCadastros(); toast('✅', 'Vendedor salvo', p.nome);
}
function excluirVendedor(id) {
  const usos = db.vendas.filter(v => v.vendedorId === id).length;
  if (usos && !confirm(`Este vendedor está em ${usos} venda(s). Os contratos já emitidos guardam os dados como estavam, mas ele some da lista. Excluir?`)) return;
  removeRec('vendedores', id); closeModal(); renderCadastros();
}
function abrirCorretorForm(id) {
  const c = id ? db.corretores.find(x => x.id === id) : null;
  const body = `<div class="fg"><label>Nome *</label><input type="text" id="cfNome" value="${esc(c ? c.nome : '')}"></div>
    <div class="frow"><div class="fg"><label>CRECI</label><input type="text" id="cfCreci" value="${esc(c ? c.creci : '')}"></div><div class="fg"><label>Telefone *</label><input type="tel" id="cfTel" value="${esc(c ? c.telefone : '')}"></div></div>
    <div class="frow"><div class="fg"><label>E-mail</label><input type="email" id="cfEmail" value="${esc(c ? c.email : '')}"></div><div class="fg"><label>Imobiliária</label><input type="text" id="cfImob" value="${esc(c ? c.imobiliaria : '')}"></div></div>
    <label class="check"><input type="checkbox" id="cfAtivo" ${!c || c.ativo !== false ? 'checked' : ''}> Ativo</label>`;
  openModal({ title: c ? '✏️ Corretor' : '＋ Novo corretor', body, footer: `${c ? `<button class="btn btn-outline-danger" onclick="removeRec('corretores','${c.id}');closeModal();renderCadastros()">Excluir</button>` : ''}<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="salvarCorretor('${c ? c.id : ''}')">Salvar</button>` });
}
function salvarCorretor(id) {
  if (!val('cfNome') || !val('cfTel')) { toast('⚠️', 'Informe nome e telefone', '', true); return; }
  const prev = id ? db.corretores.find(x => x.id === id) : null;
  upsert('corretores', Object.assign({}, prev || { id: genId(), criadoEm: new Date().toISOString() }, { nome: val('cfNome'), creci: val('cfCreci'), telefone: val('cfTel'), email: val('cfEmail'), imobiliaria: val('cfImob'), ativo: checked('cfAtivo') }));
  closeModal(); renderCadastros(); toast('✅', 'Corretor salvo', '');
}
function cadCategoriasHtml() {
  return `<div class="card"><h3>🏷️ Categorias de custo <span class="h-actions"><button class="btn btn-primary btn-sm" onclick="abrirCategoriaForm()">＋ Nova</button></span></h3>
    ${db.categorias.map(c => `<div class="item" style="border-left-color:${c.cor}" onclick="abrirCategoriaForm('${c.id}')"><div class="info"><div class="title">${esc(c.nome)}</div><div class="meta"><span>${db.custos.filter(x => x.categoriaId === c.id).length} lançamento(s)</span></div></div></div>`).join('')}</div>`;
}
function abrirCategoriaForm(id) {
  const c = id ? getCategoria(id) : null;
  openModal({ title: c ? '✏️ Categoria' : '＋ Nova categoria', body: `<div class="fg"><label>Nome *</label><input type="text" id="ctNome" value="${esc(c ? c.nome : '')}"></div><div class="fg"><label>Cor</label><input type="color" id="ctCor" value="${c ? c.cor : '#0e4c73'}"></div>`,
    footer: `${c ? `<button class="btn btn-outline-danger" onclick="excluirCategoria('${c.id}')">Excluir</button>` : ''}<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="salvarCategoria('${c ? c.id : ''}')">Salvar</button>` });
}
function salvarCategoria(id) {
  if (!val('ctNome')) return;
  const prev = id ? getCategoria(id) : null;
  upsert('categorias', Object.assign({}, prev || { id: genId() }, { nome: val('ctNome'), cor: val('ctCor') })); closeModal(); renderCadastros();
}
function excluirCategoria(id) {
  if (db.custos.some(x => x.categoriaId === id)) { toast('⚠️', 'Categoria em uso por lançamentos', '', true); return; }
  if (!confirm('Excluir categoria?')) return; removeRec('categorias', id); closeModal(); renderCadastros();
}
function cadConfigHtml() {
  const c = db.config;
  return `<div class="card"><h3>⚙️ Configurações gerais</h3>
    <div class="frow"><div class="fg"><label>Nome da empresa / incorporadora</label><input type="text" id="cgEmpresa" value="${esc(c.empresa)}"></div><div class="fg"><label>WhatsApp da administração</label><input type="tel" id="cgWa" value="${esc(c.adminWhatsapp)}" placeholder="(00) 00000-0000"><div class="hint">Corretores podem avisar você pelo WhatsApp ao pedir reserva.</div></div></div>
    <div class="frow3"><div class="fg"><label>Validade da reserva (dias)</label><input type="number" id="cgDias" value="${c.reservaDias}"></div><div class="fg"><label>Comissão padrão (%)</label><input type="number" id="cgCom" step="0.1" value="${c.comissaoPct}"></div><div class="fg"><label>Multa por atraso (%)</label><input type="number" id="cgMulta" step="0.1" value="${c.multaPct}"></div></div>
    <div class="frow"><div class="fg"><label>Juros de mora (% ao mês)</label><input type="number" id="cgJuros" step="0.01" value="${c.jurosMesPct}"></div><div class="fg"><label>Corretor vê preço de lotes vendidos?</label><select id="cgMostra"><option value="1" ${c.mostrarPrecoVendido ? 'selected' : ''}>Sim</option><option value="0" ${!c.mostrarPrecoVendido ? 'selected' : ''}>Não</option></select></div></div>
    <button class="btn btn-primary" onclick="salvarConfig()">Salvar configurações</button></div>
    <div class="card"><h3>🏢 Dados da empresa para documentos</h3>
    <p class="help">Usados para preencher propostas e contratos automaticamente.</p>
    <div class="frow3"><div class="fg"><label>CNPJ</label><input type="text" id="cgCnpj" value="${esc(c.cnpj || '')}"></div><div class="fg"><label>Cidade (foro)</label><input type="text" id="cgCidade" value="${esc(c.cidade || '')}"></div>
      <div class="fg"><label>UF</label><select id="cgUf"><option value="">—</option>${UFS.map(u => `<option value="${u}" ${c.uf === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div></div>
    <div class="fg"><label>Endereço completo</label><input type="text" id="cgEnd" value="${esc(c.endereco || '')}" placeholder="Rua, número, bairro, cidade/UF"></div>
    <div class="frow"><div class="fg"><label>Telefone</label><input type="tel" id="cgTel" value="${esc(c.telefone || '')}"></div><div class="fg"><label>E-mail</label><input type="email" id="cgEmail" value="${esc(c.email || '')}"></div></div>
    <div class="frow3"><div class="fg"><label>Quem assina pela empresa</label><input type="text" id="cgRep" value="${esc(c.representante || '')}"></div><div class="fg"><label>CPF de quem assina</label><input type="text" id="cgRepCpf" value="${esc(c.repCpf || '')}"></div>
      <div class="fg"><label>Cargo de quem assina</label><input type="text" id="cgRepCargo" value="${esc(c.repCargo || '')}" placeholder="sócio administrador"></div></div>
    <div class="fg"><label>Concordância de quem assina</label><select id="cgRepGenero"><option value="m" ${c.repGenero === 'f' ? '' : 'selected'}>Masculino — brasileiro, casado</option><option value="f" ${c.repGenero === 'f' ? 'selected' : ''}>Feminino — brasileira, casada</option></select></div>
    <button class="btn btn-primary" onclick="salvarEmpresaDocs()">Salvar dados da empresa</button></div>
    ${Cloud.active ? '' : `<div class="card"><h3>🔐 Acesso</h3>
    <div class="frow"><div class="fg"><label>Novo PIN do administrador</label><input type="password" inputmode="numeric" id="cgPin" placeholder="mín. 4 dígitos" autocomplete="new-password"><div class="hint">${c.pinPadrao ? '<b style="color:#b45309">Você ainda usa o PIN padrão 1234. Troque agora.</b>' : 'PIN personalizado ativo.'}</div></div>
      <div class="fg"><label>Código de acesso dos corretores</label><input type="text" id="cgCod" value="${esc(c.codigoCorretor)}" placeholder="vazio = acesso livre"><div class="hint">Se definido, o corretor precisa digitar este código na primeira vez que abrir o app.</div></div></div>
    <button class="btn btn-primary" onclick="salvarAcesso()">Salvar acesso</button>
    <p class="help mt">⚠️ Este controle de acesso é simples (sem servidor). Serve para organizar o uso, não para proteger dados sigilosos.</p></div>`}`;
}
function salvarEmpresaDocs() {
  setConfig({ cnpj: val('cgCnpj'), cidade: val('cgCidade'), uf: val('cgUf'), endereco: val('cgEnd'), telefone: val('cgTel'), email: val('cgEmail'), representante: val('cgRep'), repCpf: val('cgRepCpf'), repCargo: val('cgRepCargo'), repGenero: val('cgRepGenero') });
  toast('✅', 'Dados da empresa salvos', 'Já valem para os próximos documentos.'); renderCadastros();
}
function salvarConfig() {
  setConfig({ empresa: val('cgEmpresa'), adminWhatsapp: val('cgWa'), reservaDias: Math.max(1, Math.round(num(val('cgDias')) || 7)), comissaoPct: num(val('cgCom')), multaPct: num(val('cgMulta')), jurosMesPct: num(val('cgJuros')), mostrarPrecoVendido: val('cgMostra') === '1' });
  toast('✅', 'Configurações salvas', ''); renderCadastros();
}
function salvarAcesso() {
  const pin = val('cgPin'); const patch = { codigoCorretor: val('cgCod') };
  if (pin) { if (pin.length < 4) { toast('⚠️', 'PIN muito curto', '', true); return; } patch.adminPin = hashStr(pin); patch.pinPadrao = false; }
  setConfig(patch); toast('✅', 'Acesso atualizado', pin ? 'Novo PIN ativo.' : ''); renderCadastros();
}
function cadNuvemHtml() {
  const link = location.origin + location.pathname + '?modo=corretor';
  return `<div class="card"><h3>☁️ Sincronização em nuvem <span id="syncStatusBox"></span></h3>
    <p class="help mb">Este aparelho está no <b>modo local</b>: os dados ficam salvos só neste navegador. Para trabalhar em equipe (corretores em qualquer aparelho, pedidos de reserva em tempo real, login por usuário), o app usa o <b>Supabase</b>.</p>
    <ol class="steps mb">
      <li>Crie o projeto em <a href="https://supabase.com" target="_blank">supabase.com</a> e rode o arquivo <code>gestao/supabase/schema.sql</code> no SQL Editor.</li>
      <li>Em <b>Project Settings › API</b>, copie a <b>Project URL</b> e a chave <b>anon public</b>.</li>
      <li>Preencha os dois valores em <code>gestao/config.js</code> e publique. O app passa a abrir com tela de login; crie sua conta e a empresa.</li>
    </ol>
    <p class="help">O guia completo está em <code>gestao/supabase/README.md</code>.</p></div>
    <div class="card"><h3>🔗 Link para os corretores (modo local)</h3>
    <p class="help mb">Abre direto na área do corretor. Sem a nuvem, cada aparelho tem os próprios dados; use apenas para demonstração.${db.config.codigoCorretor ? ' O código de acesso configurado será solicitado.' : ''}</p>
    <div class="code-box" id="linkCorretor">${esc(link)}</div>
    <div class="btn-row"><button class="btn btn-secondary" onclick="copiarTexto(document.getElementById('linkCorretor').textContent)">📋 Copiar link</button></div></div>`;
}
function copiarTexto(t) { (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('📋', 'Copiado', '')).catch(() => prompt('Copie o link:', t)); }
function cadBackupHtml() {
  const size = Math.round((localStorage.getItem(DB_KEY) || '').length / 1024);
  return `<div class="card"><h3>💾 Backup e dados</h3>
    <p class="help mb">Exporte um arquivo com todos os dados (lotes, planta, reservas, vendas, custos). Guarde uma cópia com regularidade. Tamanho atual: ${size} KB.</p>
    <div class="btn-row"><button class="btn btn-primary" onclick="exportarBackup()">⬇️ Exportar backup (JSON)</button><label class="btn btn-secondary" style="cursor:pointer">📥 Importar backup<input type="file" accept=".json,application/json" style="display:none" onchange="importarBackup(this)"></label></div>
    <div class="btn-row"><button class="btn btn-outline" onclick="exportarLotesCSV()">Lotes (CSV)</button><button class="btn btn-outline" onclick="exportarRecebiveisCSV()">Recebíveis (CSV)</button><button class="btn btn-outline" onclick="exportarCustosCSV()">Custos (CSV)</button></div></div>
    <div class="card"><h3>✨ Dados de exemplo</h3><p class="help mb">Carregue um loteamento fictício completo para conhecer o app. Substitui os dados atuais.</p><button class="btn btn-accent" onclick="carregarDemo()">Carregar dados de exemplo</button></div>
    <div class="card"><h3>🗑️ Zona de perigo</h3><p class="help mb">Apaga todos os loteamentos, lotes, reservas, vendas e custos. As configurações são mantidas.</p><button class="btn btn-outline-danger" onclick="apagarTudo()">Apagar todos os dados</button></div>`;
}

// ================================================================ LEADS (vitrine pública)
function leadsDo(lotId) { return db.leads.filter(l => l.loteamentoId === lotId || !l.loteamentoId); }
const LEAD_STATUS = { novo: ['🆕', 'Novo'], contatado: ['📞', 'Contatado'], convertido: ['✅', 'Convertido'], descartado: ['🚫', 'Descartado'] };

function renderLeads(alvo) {
  const lot = curLot(); const v = alvo || alvoDoEmp('av-leads');
  const f = state.filters.leads = state.filters.leads || { status: 'novo' };
  const all = leadsDo(lot.id);
  const list = (f.status === 'todos' ? all : all.filter(l => (l.status || 'novo') === f.status))
    .sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
  const vit = Cloud.active ? Cloud.vitrines.find(x => x.loteamentoId === lot.id) : null;
  const aviso = !Cloud.active
    ? `<div class="card"><p class="help">Os leads chegam pela <b>vitrine pública</b>, que funciona na versão em nuvem. Ative a nuvem em Cadastros › Nuvem para publicar o link do loteamento.</p></div>`
    : !vit || !vit.ativa
      ? `<div class="card"><p class="help">A vitrine pública deste loteamento ainda não está publicada. <button class="btn btn-primary btn-sm" onclick="state.tab='cadastros';state.sub.cad='vitrine';switchTab('cadastros')">🌐 Publicar agora</button></p></div>` : '';
  v.innerHTML = aviso + `
    <div class="chips">${[['novo', 'Novos'], ['contatado', 'Contatados'], ['convertido', 'Convertidos'], ['descartado', 'Descartados'], ['todos', 'Todos']].map(([k, l]) =>
      `<div class="chip ${f.status === k ? 'active' : ''}" onclick="state.filters.leads.status='${k}';renderLeads()">${l}<span class="n">${k === 'todos' ? all.length : all.filter(x => (x.status || 'novo') === k).length}</span></div>`).join('')}</div>
    ${list.length ? list.map(leadCardHtml).join('') : `<div class="empty"><div class="ic">🎯</div><p>Nenhum interesse nesta lista.</p><p class="small">Quando alguém preencher o formulário da vitrine, aparece aqui na hora.</p></div>`}`;
}

function leadCardHtml(l) {
  const lote = l.loteId ? getLote(l.loteId) : null;
  const st = l.status || 'novo'; const [ic, lbl] = LEAD_STATUS[st] || LEAD_STATUS.novo;
  const primeiro = (l.nome || '').split(' ')[0];
  const texto = `Olá ${primeiro}! Aqui é ${db.config.empresa || 'a equipe de vendas'}. Você demonstrou interesse${lote ? ' no lote ' + loteShort(lote) : ''} no nosso site.`;
  return `<div class="card">
    <div class="row-between"><div><b>${esc(l.nome)}</b> <span class="badge ${st === 'convertido' ? 'pago' : st === 'descartado' ? 'neutral' : st === 'contatado' ? 'pendente' : 'atrasado'}">${ic} ${lbl}</span></div>
      <span class="muted small">${esc(fmtDateTime(l.criadoEm))}</span></div>
    <div class="small mt">📱 ${esc(fmtPhone(l.telefone))}${l.email ? ' · ✉️ ' + esc(l.email) : ''}${lote ? ' · 📦 ' + esc(loteLabel(lote)) + ' (' + statusLabel(lote.status) + ')' : ''}</div>
    ${l.msg ? `<div class="small mt" style="background:var(--bg);border-radius:8px;padding:8px 10px">“${esc(l.msg)}”</div>` : ''}
    <div class="btn-row mt">
      ${l.telefone ? `<a class="btn btn-wa btn-sm" target="_blank" href="${waLink(l.telefone, texto)}" onclick="marcarLead('${l.id}','contatado',1)">💬 WhatsApp</a>` : ''}
      ${st !== 'contatado' ? `<button class="btn btn-secondary btn-sm" onclick="marcarLead('${l.id}','contatado')">📞 Contatado</button>` : ''}
      ${lote && lote.status === 'disponivel' ? `<button class="btn btn-primary btn-sm" onclick="reservarDoLead('${l.id}')">📝 Criar reserva</button>` : ''}
      ${st !== 'descartado' ? `<button class="btn btn-secondary btn-sm" onclick="marcarLead('${l.id}','descartado')">🚫 Descartar</button>` : ''}
      <button class="btn btn-outline-danger btn-sm" onclick="excluirLead('${l.id}')">🗑️</button>
    </div></div>`;
}

function marcarLead(id, status, silencioso) {
  const l = db.leads.find(x => x.id === id); if (!l || l.status === status) return;
  upsert('leads', Object.assign({}, l, { status }));
  if (!silencioso) { renderCurrent(); toast('✅', 'Lead atualizado', (LEAD_STATUS[status] || [])[1] || ''); }
  else setTimeout(renderCurrent, 400);
}
function excluirLead(id) {
  const l = db.leads.find(x => x.id === id); if (!l) return;
  if (!confirm(`Excluir o interesse de ${l.nome}?`)) return;
  removeRec('leads', id); renderCurrent(); toast('🗑️', 'Interesse excluído', '');
}
function reservarDoLead(id) {
  const l = db.leads.find(x => x.id === id); if (!l) return;
  abrirReservaAdminForm(l.loteId);
  setTimeout(() => { setVal('rlNome', l.nome); setVal('rlTel', l.telefone); setVal('rlEmail', l.email); setVal('raObs', 'Veio pela vitrine online'); }, 60);
  marcarLead(id, 'convertido', 1);
}

// ================================================================ VITRINE PÚBLICA
function vitrineSlugSugerido(lot) {
  const base = (lot.nome || 'loteamento').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return base || 'loteamento';
}
function vitrineUrl(slug) { return location.origin + location.pathname.replace(/[^/]*$/, '') + 'vitrine.html?l=' + encodeURIComponent(slug); }

function cadVitrineHtml() {
  const lot = curLot();
  if (!lot) return `<div class="card"><p class="help">Cadastre um loteamento primeiro.</p></div>`;
  if (!Cloud.active) return `<div class="card"><h3>🌐 Vitrine pública</h3>
    <p class="help">A vitrine é uma página aberta, sem login, com a planta e os lotes à venda para você mandar por WhatsApp, Instagram ou anúncio. Quem se interessa preenche um formulário e cai na aba <b>Leads</b>.</p>
    <p class="help mt">Ela funciona na <b>versão em nuvem</b>, porque a página precisa buscar os dados em um servidor. Configure a nuvem em <b>Cadastros › Nuvem</b> para liberar.</p></div>`;
  const v = Cloud.vitrines.find(x => x.loteamentoId === lot.id) || null;
  const ls = lotesDo(lot.id); const disp = ls.filter(l => l.status === 'disponivel').length;
  const semPreco = ls.filter(l => l.status === 'disponivel' && !num(l.preco)).length;
  const slug = v ? v.slug : vitrineSlugSugerido(lot);
  const url = vitrineUrl(slug);
  return `<div class="card"><h3>🌐 Vitrine pública de ${esc(lot.nome)}</h3>
    <p class="help">Página aberta, sem login, com a planta e os lotes à venda. Mande o link por WhatsApp, coloque no Instagram ou no anúncio. Quem se interessar preenche o formulário e aparece na aba <b>Leads</b>.</p>
    ${v && v.ativa ? `<div class="mb mt"><div class="k small">Link para divulgar</div>
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px"><input type="text" id="vitLink" readonly value="${esc(url)}" style="flex:1 1 240px;min-width:0;padding:9px 11px;border:1px solid var(--border);border-radius:9px;background:white;color:var(--text);font-size:0.9rem">
      <button class="btn btn-secondary btn-sm" style="flex:none" onclick="copiarLinkVitrine()">📋 Copiar</button>
      <a class="btn btn-secondary btn-sm" style="flex:none;text-decoration:none" target="_blank" href="${esc(url)}">↗ Abrir</a></div>
      <p class="small mt">${disp} lote(s) aparecem como disponíveis${semPreco ? ` · ${semPreco} sem preço aparecem como “valor sob consulta”` : ''}.</p></div>` : ''}
    <div class="fieldset"><span class="lg">⚙️ Configuração</span>
      <div class="fg"><label>Endereço do link (só letras, números e hífen)</label><input type="text" id="vitSlug" value="${esc(slug)}" placeholder="residencial-vista-verde"><div class="hint">Fica assim: ${esc(vitrineUrl('seu-endereco'))}</div></div>
      <div class="fg"><label>Título da página</label><input type="text" id="vitTitulo" value="${esc(v ? v.titulo : '')}" placeholder="${esc(lot.nome)}"></div>
      <div class="fg"><label>Chamada de vendas</label><textarea id="vitChamada" placeholder="Lotes prontos para construir, com asfalto, água e luz. Entrada facilitada e parcelamento direto.">${esc(v ? v.chamada : '')}</textarea></div>
      <div class="frow"><div class="fg"><label>WhatsApp de atendimento</label><input type="tel" id="vitZap" value="${esc(v ? v.whatsapp : (db.config.telefone || ''))}" placeholder="(48) 99999-9999"></div>
        <div class="fg"><label>Mostrar preços</label><select id="vitPreco"><option value="0" ${!v || !v.mostrarPreco ? 'selected' : ''}>Não, “valor sob consulta”</option><option value="1" ${v && v.mostrarPreco ? 'selected' : ''}>Sim, mostrar os valores</option></select></div></div>
      <label class="check"><input type="checkbox" id="vitAtiva" ${!v || v.ativa ? 'checked' : ''}> Vitrine no ar</label>
    </div>
    <div class="btn-row">
      <button class="btn btn-primary" onclick="salvarVitrine()">${v ? '💾 Salvar alterações' : '🌐 Publicar vitrine'}</button>
      ${v ? `<button class="btn btn-outline-danger" onclick="removerVitrine()">Remover do ar</button>` : ''}
    </div>
    <p class="help mt">O visitante vê quadra, número, área, situação e o preço (se você quiser). Matrícula, observações internas, reservas, vendas e dados dos corretores <b>nunca</b> aparecem.</p></div>`;
}

function copiarLinkVitrine() {
  const el = document.getElementById('vitLink'); if (!el) return;
  el.select(); el.setSelectionRange(0, 99999);
  const done = () => toast('📋', 'Link copiado', 'Cole no WhatsApp, no Instagram ou no anúncio.');
  if (navigator.clipboard) navigator.clipboard.writeText(el.value).then(done, () => { document.execCommand('copy'); done(); });
  else { document.execCommand('copy'); done(); }
}

async function salvarVitrine() {
  const lot = curLot(); if (!lot || !Cloud.active) return;
  const slug = val('vitSlug').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
  if (slug.length < 3) { toast('⚠️', 'Endereço muito curto', 'Use ao menos 3 letras.', true); return; }
  try {
    await Cloud.salvarVitrine({ loteamentoId: lot.id, slug, ativa: !!$('#vitAtiva').checked, mostrarPreco: val('vitPreco') === '1', titulo: val('vitTitulo'), chamada: val('vitChamada'), whatsapp: val('vitZap') });
    logAct(`Vitrine pública ${$('#vitAtiva').checked ? 'publicada' : 'despublicada'}: ${lot.nome}`);
    renderCadastros();
    toast('✅', 'Vitrine salva', $('#vitAtiva') && $('#vitAtiva').checked ? 'O link já está no ar.' : 'A vitrine ficou fora do ar.');
  } catch (e) { toast('⚠️', 'Não foi possível salvar', e.message, true); }
}
async function removerVitrine() {
  const lot = curLot(); if (!lot || !Cloud.active) return;
  if (!confirm('Tirar a vitrine do ar? O link para de funcionar para quem já recebeu.')) return;
  try { await Cloud.apagarVitrine(lot.id); logAct(`Vitrine pública removida: ${lot.nome}`); renderCadastros(); toast('🌐', 'Vitrine removida', ''); }
  catch (e) { toast('⚠️', 'Não foi possível remover', e.message, true); }
}
