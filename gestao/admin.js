/* ===== Gestão de Loteamento — administração ===== */
'use strict';

function renderAdminTab() {
  updateTopbars();
  contadoresDoMenu();
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
  else if (tab === 'reservas') { if (!bloqueia('reservas.aprovar', 'reservas')) { renderAReservas(); fabShow('novaReservaEscolhendoEmp()'); } }
  else if (tab === 'corretores') renderCorretoresAdmin();
  else if (tab === 'clientes') { if (!abaPermitida('clientes')) $('#av-clientes').innerHTML = semPermissaoHtml('clientes'); else { renderClientes(); if (podeEditarClientes()) fabShow('abrirClienteForm()'); } }
  else if (tab === 'vendas') { if (!bloqueia('vendas.criar', 'contratos')) { renderAVendas(); if (pode('vendas.criar')) fabShow('novaVendaEscolhendoEmp()'); } }
  else if (tab === 'recebiveis') { if (!bloqueia('financeiro.ver', 'recebíveis')) renderRecebiveis(); }
  else if (tab === 'cobranca') { if (!bloqueia('cobranca.ver', 'cobrança')) renderCobranca(); }
  else if (tab === 'boletos') { if (!bloqueia('financeiro.ver', 'boletos')) renderBoletos(); }
  else if (tab === 'custos') { if (!bloqueia('custos.ver', 'contas a pagar')) { renderCustos(); if (pode('custos.editar')) fabShow('novoCustoEscolhendoEmp()'); } }
  else if (tab === 'indices') { if (!bloqueia('indices.editar', 'índices')) $('#av-indices').innerHTML = cadIndicesHtml(); }
  else if (tab === 'relatorios') renderRelatorios();
  else if (tab === 'cadastros') renderCadastros();
}

/* Números ao lado dos itens do menu: o que está esperando alguém. Só aparece para quem pode
   agir sobre aquilo. */
function contadoresDoMenu() {
  const put = (id, n, chave) => {
    const b = document.getElementById(id); if (!b) return;
    const mostra = n > 0 && (!chave || pode(chave));
    b.style.display = mostra ? '' : 'none'; b.textContent = n;
  };
  put('aBadgeReservas', db.reservas.filter(r => r.status === 'pendente').length, 'reservas.aprovar');
  put('aBadgeCobranca', typeof inadimplentes === 'function' ? inadimplentes('').length : 0, 'cobranca.ver');
  put('aBadgeCustos', db.custos.filter(c => custoStatus(c) === 'atrasado').length, 'custos.ver');
  put('aBadgeBoletos', typeof pendentesDeRemessa === 'function' ? pendentesDeRemessa('').length : 0, 'financeiro.ver');
}

/* ================================================================ EMPREENDIMENTOS
   Aqui mora tudo que é de um empreendimento só: planta, lotes, preços e obra.
   Vendas, recebíveis e relatórios ficam de fora, porque são da empresa inteira. */
const EMP_SUBS = [
  ['resumo', '📋 Resumo', null],
  ['planta', '🗺️ Planta', 'planta.editar'],
  ['lotes', '📦 Lotes e preços', 'lotes.editar'],
  ['custos', '🧾 Obra e orçamento', 'custos.ver']
];
/* Numa carteira de imóveis de terceiros não existe planta, lote, reserva nem obra: o imóvel
   não é seu, você só administra o recebível. A aba de custos só reaparece se a carteira já
   tiver lançamento, para não esconder dado que alguém já registrou. */
function empSubsVisiveis(lot) {
  if (!lot) return EMP_SUBS.filter(([, , chave]) => !chave || pode(chave));
  const fora = ehCarteira(lot) ? ['planta', 'lotes'].concat(custosDo(lot.id).length ? [] : ['custos']) : [];
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
      <div><button class="btn btn-secondary btn-sm" onclick="fecharEmpreendimento()">‹ Imóveis</button></div>
      <div class="small muted"><b>${esc(aberto.nome)}</b> · ${esc(empLabel(aberto))}${aberto.cidade ? ' · ' + esc(aberto.cidade) : ''}</div>
    </div>
    <div class="subtabs">${subs.map(([k, rot]) => `<div class="chip ${state.empSub === k ? 'active' : ''}" onclick="state.empSub='${k}';renderEmpreendimentos()">${rot}</div>`).join('')}</div>
    <div id="empConteudo"></div>`;
  const alvo = $('#empConteudo');
  const fab = $('#fab'); fab.classList.remove('show');
  if (state.empSub === 'resumo') alvo.innerHTML = cadLoteamentoHtml();
  else if (state.empSub === 'planta') renderPlantaEditor(alvo);
  else if (state.empSub === 'lotes') { renderALotes(alvo); fabShow('abrirLoteForm()'); }
  else if (state.empSub === 'custos') { renderCustos(alvo); if (pode('custos.editar')) fabShow('abrirCustoForm()'); }
}
/* A lista não mostra valor de loteamento: são centenas de lotes com preços diferentes, e o
   número que importa aparece quando você abre. O imóvel de terceiro é um só, então o valor
   de venda dele é a informação principal e fica à vista. */
function listaEmpreendimentosHtml() {
  const podeCriar = pode('config.editar') || pode('lotes.editar');
  return `<div class="card"><h3>🏠 Imóveis ${podeCriar ? '<span class="h-actions"><button class="btn btn-primary btn-sm" onclick="abrirLoteamentoForm()">＋ Novo</button></span>' : ''}</h3>
    <p class="help mb">Os loteamentos, com planta e lotes, e cada imóvel de terceiro que você vende — um lote, uma casa, um apartamento. Abra um para ver preços e situação. Contratos, recebíveis e relatórios ficam no menu, com todos juntos.</p>
    ${db.loteamentos.slice().sort((a, b) => (ehCarteira(a) - ehCarteira(b)) || naturalCmp(a.nome, b.nome)).map(l => {
      if (ehCarteira(l)) {
        const vd = vendaAtivaDoImovel(l);
        return `<div class="item" onclick="abrirEmpreendimento('${l.id}')"><div class="info">
          <div class="title">🏠 ${esc(l.nome)} <span class="badge neutral">Imóvel de terceiro</span></div>
          <div class="meta">${esc(l.cidade || '')}${l.matricula ? `<span>· matrícula ${esc(l.matricula)}</span>` : ''}${num(l.area) ? `<span>· ${fmtNum(l.area, 2)} m²</span>` : ''}${vd ? `<span>· vendido para ${esc(vd.cliente.nome)}</span>` : ''}</div>
        </div><div class="side">${num(l.preco) ? `<div class="value">${fmtMoney(l.preco)}</div>` : '<div class="tiny muted">sem valor de venda</div>'}<span class="badge ${vd ? 'vendido' : 'disponivel'}">${vd ? 'Vendido' : 'Disponível'}</span></div></div>`;
      }
      const ls = lotesDo(l.id);
      const pend = db.reservas.filter(r => r.loteamentoId === l.id && reservaStatus(r) === 'pendente').length;
      return `<div class="item" onclick="abrirEmpreendimento('${l.id}')"><div class="info">
        <div class="title">🏘️ ${esc(l.nome)} <span class="badge neutral">Loteamento</span>${pend ? ` <span class="badge pendente">${pend} reserva(s) a aprovar</span>` : ''}</div>
        <div class="meta">${esc(l.cidade || '')}<span>· ${ls.length} lotes</span><span>· ${ls.filter(x => x.status === 'vendido').length} vendidos</span><span>· ${ls.filter(x => x.status === 'disponivel').length} disponíveis</span></div>
      </div><div class="side"><span class="muted">›</span></div></div>`;
    }).join('') || `<div class="empty"><div class="ic">🏠</div><p><b>Nenhum imóvel cadastrado ainda.</b></p><p class="small">Cadastre um loteamento, com planta e lotes, ou um imóvel de terceiro que você vai vender.</p></div>`}</div>`;
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
  if (resPend.length) alerts += `<div class="alert warn" onclick="switchTab('reservas')"><span><b>${resPend.length} reserva(s) aguardando aprovação</b></span><span>›</span></div>`;
  if (resExp.length) alerts += `<div class="alert" onclick="aSetFiltroRes('expirada')"><span><b>${resExp.length} reserva(s) vencida(s)</b> — libere o lote ou renove</span><span>›</span></div>`;
  if (resVencendo.length) alerts += `<div class="alert info" onclick="switchTab('reservas')"><span><b>${resVencendo.length} reserva(s) vencem em até 2 dias</b></span><span>›</span></div>`;
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
`;
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
/* Reservas são do Comercial, da empresa inteira: o corretor pede, a empresa aprova. O filtro
   de empreendimento restringe quando há mais de um. */
function renderAReservas(alvo) {
  const v = alvo || $('#av-reservas');
  const escopo = escopoAtual();
  const f = state.filters.ares = state.filters.ares || { status: 'ativas' };
  const all = db.reservas.filter(r => noEscopo(r, escopo));
  const grupos = { ativas: r => ['pendente', 'aprovada'].includes(reservaStatus(r)), pendente: r => r.status === 'pendente', aprovada: r => reservaStatus(r) === 'aprovada', expirada: r => reservaStatus(r) === 'expirada', historico: r => ['recusada', 'cancelada', 'convertida', 'expirada'].includes(r.status) || (reservaStatus(r) === 'expirada') };
  const list = all.filter(grupos[f.status] || (() => true)).sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
  v.innerHTML = `
    ${db.loteamentos.length > 1 ? `<div class="filters">${escopoSelectHtml('renderAReservas()')}</div>` : ''}
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
/* Reserva lançada pela própria empresa, a partir da lista geral: primeiro o loteamento. */
function novaReservaEscolhendoEmp() {
  comEmpreendimento('📝 Nova reserva', 'Em qual loteamento?', () => abrirReservaAdminForm(), l => !ehCarteira(l));
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
      <div><div class="k">Cliente</div><div class="v">${esc(c.nome)}${(x.compradoresExtras || []).length ? ` <span class="tiny muted">e mais ${(x.compradoresExtras || []).length}</span>` : ''}${temConjuge(c) && (c.conjuge || {}).nome ? `<div class="tiny muted">com ${esc(c.conjuge.nome)}</div>` : ''}</div></div><div><div class="k">CPF/CNPJ</div><div class="v">${esc(fmtCPF(c.cpf)) || '—'}</div></div>
      <div><div class="k">Telefone</div><div class="v"><a href="${waLink(c.telefone, '')}" target="_blank">${esc(fmtPhone(c.telefone))}</a></div></div><div><div class="k">E-mail</div><div class="v">${esc(c.email) || '—'}</div></div>
      <div class="full"><div class="k">Endereço</div><div class="v">${esc([c.endereco, c.cidade].filter(Boolean).join(' · ')) || '—'}</div></div>
      <div><div class="k">Corretor</div><div class="v">${esc(x.corretor.nome)}${x.corretor.creci ? ' · ' + esc(x.corretor.creci) : ''}</div></div><div><div class="k">Comissão</div><div class="v">${fmtMoney(x.comissaoValor)} (${fmtNum(x.comissaoPct, 1)}%) <span class="badge ${x.comissaoPaga ? 'paga' : 'pendente'}">${x.comissaoPaga ? 'paga' : 'a pagar'}</span></div></div>
      <div><div class="k">Entrada</div><div class="v">${fmtMoney(x.entrada)}</div></div><div><div class="k">Parcelas</div><div class="v">${x.nParcelas}× ${fmtMoney(x.valorParcela)}${x.baloes && x.baloes.length ? ` + ${x.baloes.length} reforço(s)` : ''}</div></div>
      ${(x.compradoresExtras || []).length ? `<div class="full"><div class="k">Demais compradores</div><div class="v">${esc(nomesDasPartes(x.compradoresExtras))}</div></div>` : ''}
      ${(x.vendedoresExtras || []).length || x.vendedorId ? `<div class="full"><div class="k">Vendedor no contrato</div><div class="v">${esc(nomesDasPartes(todosVendedores(x)))}</div></div>` : ''}
      ${x.obs ? `<div class="full"><div class="k">Observações</div><div class="v">${esc(x.obs)}</div></div>` : ''}
    </div>
    ${correcaoResumoVenda(x)}
    <h3 class="small" style="margin:8px 0 6px;font-weight:800">📆 Parcelas</h3>
    <div class="table-wrap"><table class="tbl"><thead><tr><th>Parcela</th><th>Venc.</th><th class="num">Valor</th><th class="num">Pago</th><th>Status</th><th></th></tr></thead>
    <tbody>${recs.map(rc => { const st = recStatus(rc); return `<tr><td>${esc(rc.descricao)}</td><td>${fmtDate(rc.vencimento)}</td><td class="num">${fmtMoney(recValor(rc))}${recCorrecao(rc) > 0.005 ? `<br><span class="tiny muted">base ${fmtMoney(rc.valor)}</span>` : ''}</td><td class="num">${rc.valorPago ? fmtMoney(rc.valorPago) + (rc.dataPagamento ? `<br><span class="tiny muted">${fmtDate(rc.dataPagamento)}</span>` : '') : '—'}</td><td><span class="badge ${st}">${statusLabel(st)}</span>${st === 'atrasado' ? `<br><span class="tiny" style="color:var(--danger)">atual. ${fmtMoney(recAtualizado(rc))}</span>` : ''}</td><td>${x.status !== 'distrato' ? (!pode('financeiro.baixar') ? '' : st === 'pago' ? `<button class="btn-icon" title="Estornar" onclick="estornarPagamento('${rc.id}','${x.id}')">↩</button>` : `<button class="btn-icon ok" title="Registrar pagamento" onclick="abrirPagamento('${rc.id}','${x.id}')">💵</button>`) : ''} <button class="btn-icon" title="Boleto" onclick="abrirBoleto('${rc.id}')">🏦</button> <button class="btn-icon" title="Editar parcela" onclick="editarRecebivel('${rc.id}','${x.id}')">✏️</button></td></tr>`; }).join('')}</tbody>
    <tfoot><tr><td colspan="2">Total</td><td class="num">${fmtMoney(r.total)}</td><td class="num">${fmtMoney(r.pago)}</td><td colspan="2"></td></tr></tfoot></table></div>`;
  let footer = `${pode('vendas.editar') ? `<button class="btn btn-secondary" onclick="abrirVendaForm('${x.id}')">✏️ Editar</button>` : ''}<button class="btn btn-outline" onclick="imprimirExtrato('${x.id}')">🖨️ Extrato</button><button class="btn btn-outline" onclick="gerarContratoVenda('${x.id}')">📄 Contrato</button>${x.status !== 'distrato' && vendaResumo(x).restante > 0.005 && pode('financeiro.antecipar') ? `<button class="btn btn-success" onclick="abrirAntecipacao('${x.id}')">💸 Antecipar / quitar</button>` : ''}`;
  if (c.telefone) footer += `<a class="btn btn-wa" target="_blank" href="${waLink(c.telefone, extratoTexto(x))}">💬 Enviar resumo</a>`;
  if (pode('vendas.distrato')) footer += `<button class="btn btn-outline-danger" onclick="excluirVenda('${x.id}')">🗑️ Excluir contrato</button>`;
  openModal({ title: `💰 Venda · ${esc(imovelShort(x))}`, body, footer, wide: true });
}
/* Venda nova a partir da aba global: primeiro o empreendimento, depois o formulário. */
/* No banco, imóvel e lote novos são do dono e do administrador; o financeiro registra a
   venda, mas não cria o imóvel. O botão só aparece para quem o banco vai aceitar. */
function ehAdminDaEmpresa() { return !Cloud.active || Cloud.papel === 'dono' || Cloud.papel === 'admin'; }
function podeCadastrarImovel() { return ehAdminDaEmpresa() && (pode('config.editar') || pode('lotes.editar')); }
function podeCriarLote() { return ehAdminDaEmpresa() && pode('lotes.editar'); }
/* Novo contrato: primeiro o imóvel. A escolha aparece sempre, mesmo com um só, porque o
   imóvel pode ainda não estar no sistema — uma venda antiga que está sendo trazida, um
   imóvel que entrou e saiu vendido sem passar pelo estoque. Aí ele é cadastrado aqui mesmo
   e o contrato segue com ele. Imóvel de terceiro já vendido não entra: ele é um só. */
function novaVendaEscolhendoEmp() {
  const lista = db.loteamentos.filter(l => !ehCarteira(l) || !vendaAtivaDoImovel(l))
    .sort((a, b) => (ehCarteira(a) - ehCarteira(b)) || naturalCmp(a.nome, b.nome));
  const podeNovo = podeCadastrarImovel();
  if (!lista.length && !podeNovo) { toast('⚠️', 'Nenhum imóvel disponível', 'Peça ao administrador para cadastrar o imóvel.', true); return; }
  const pre = lista.find(l => l.id === escopoAtual()) ? escopoAtual() : (lista[0] || {}).id;
  const botao = podeNovo ? `<button type="button" class="btn btn-secondary" style="flex:none" onclick="novoImovelParaContrato()">＋ Novo imóvel</button>` : '';
  openModal({ title: '💰 Novo contrato',
    body: `<p class="help mb">Qual imóvel está sendo vendido? Se ele ainda não está no sistema — uma venda antiga que você está trazendo, um imóvel que já entrou vendido — cadastre aqui mesmo${podeNovo ? '' : ' (peça ao administrador)'}.</p>
      ${lista.length ? `<div class="fg"><label>Loteamento ou imóvel</label><div class="row-between" style="gap:8px"><select id="ceEmp" style="flex:1">${lista.map(l => `<option value="${esc(l.id)}" ${l.id === pre ? 'selected' : ''}>${esc(l.nome)} — ${esc(empLabel(l))}${ehCarteira(l) && num(l.preco) ? ' · ' + esc(fmtMoney(l.preco)) : ''}</option>`).join('')}</select>${botao}</div>
        <div class="hint">Num loteamento, se o lote ainda não foi cadastrado, dá para cadastrar ele no próprio contrato.</div></div>`
        : `<div class="empty"><div class="ic">🏠</div><p><b>Nenhum imóvel disponível para vender.</b></p><div class="btn-row" style="justify-content:center">${botao}</div></div>`}`,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>${lista.length ? '<button class="btn btn-primary" onclick="continuarNovoContrato()">Continuar</button>' : ''}` });
}
function continuarNovoContrato() {
  const l = getLoteamento(val('ceEmp')); if (!l) return;
  closeModal(); setCurLotSilencioso(l.id); abrirVendaForm();
}
function novoImovelParaContrato() {
  if (!podeCadastrarImovel()) { toast('🔒', 'Sem permissão', 'Cadastrar imóvel é do dono ou do administrador.', true); return; }
  closeModal(); abrirLoteamentoForm(null, { tipo: 'carteira', paraContrato: true });
}
function abrirVendaForm(id, loteId, reservaId) {
  const lot = curLot(); const x = id ? getVenda(id) : null;
  const res = reservaId ? getReserva(reservaId) : null;
  const cond = lot.cond || {};
  window.vfReservaId = reservaId || null;
  const carteira = ehCarteira(lot);
  /* Além dos disponíveis, entra o lote marcado como vendido que não tem contrato no sistema:
     é a venda antiga que está sendo trazida para cá. */
  const lotes = carteira ? [] : lotesDo(lot.id).filter(l => l.status === 'disponivel' || (x && l.id === x.loteId) || (loteId && l.id === loteId) || (!x && vendidoSemContrato(l)));
  const novoLote = !carteira && !x && podeCriarLote();
  if (!carteira && !x && !lotes.length && !novoLote) { toast('⚠️', 'Nenhum lote disponível para venda', 'Peça ao administrador para cadastrar o lote.', true); return; }
  if (carteira && !x && vendaAtivaDoImovel(lot)) { toast('⚠️', 'Este imóvel já foi vendido', `Contrato de ${vendaAtivaDoImovel(lot).cliente.nome}. Para vender de novo, faça antes o distrato.`, true); return; }
  const c = x ? x.cliente : (res ? res.cliente : {}); const k = x ? x.corretor : (res ? res.corretor : { nome: db.config.empresa || 'Venda direta' });
  const sel = carteira ? '' : (x ? x.loteId : (loteId || (lotes[0] || {}).id || '__novo')); const lsel = sel && sel !== '__novo' ? getLote(sel) : null;
  const im = (x && x.imovel) || (carteira ? imovelDoTerceiro(lot) : {});
  const vsel = x ? [x.vendedorId || ''].concat((x.vendedoresExtras || []).map(v => v.id || '')) : [''];
  const compradores = x ? todosCompradores(x) : (c && c.nome ? [c] : [c]);
  const pv = res && res.proposta ? res.proposta : {};
  const total = x ? x.valorTotal : (pv.valor || (lsel ? lsel.preco : (carteira ? num(lot.preco) : 0)));
  const entrada = x ? x.entrada : (pv.entrada != null ? pv.entrada : Math.round(total * (num(cond.entradaMinPct) || 10) / 100));
  const n = x ? x.nParcelas : (pv.nParcelas || Math.min(60, Number(cond.maxParcelas) || 60));
  const hoje = todayStr();
  const temPagos = x && recebiveisDe(x.id).some(r => num(r.valorPago) > 0);
  const aVista = x ? (!x.nParcelas && !(x.baloes || []).length) : false;
  const corrs = db.corretores.filter(cc => cc.ativo !== false);
  /* Venda direta pela empresa é comum; corretor é a exceção que o usuário liga. Em venda
     nova o nome que vem preenchido é o da própria empresa, que não é corretor nenhum. */
  const temCorr = x
    ? !!(k.nome && k.nome !== 'Venda direta' && k.nome !== db.config.empresa)
    : !!res;
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
    : `<div class="fg"><label>Lote *</label><div class="row-between" style="gap:8px"><select id="vfLote" style="flex:1" onchange="vfLoteChange()" ${x ? 'disabled' : ''}>${optionsHtml(lotes, sel, l => `${loteLabel(l)} — ${fmtMoney(l.preco)}${vendidoSemContrato(l) ? ' · marcado vendido, sem contrato' : ''}`)}${novoLote ? `<option value="__novo" ${sel === '__novo' ? 'selected' : ''}>＋ Cadastrar novo lote…</option>` : ''}</select>${novoLote ? `<button type="button" class="btn btn-secondary" style="flex:none" onclick="setVal('vfLote','__novo');vfLoteChange()">＋ Novo lote</button>` : ''}</div></div>
      ${novoLote ? `<div class="fieldset" id="vfNovoLoteBox" style="${sel === '__novo' ? '' : 'display:none'}"><span class="lg">＋ Novo lote no ${esc(lot.nome)}</span>
        <div class="frow3"><div class="fg"><label>Quadra *</label><input type="text" id="vfNlQuadra" list="vfQuadras" value=""><datalist id="vfQuadras">${quadrasDo(lot.id).map(q => `<option value="${esc(q)}">`).join('')}</datalist></div>
          <div class="fg"><label>Número do lote *</label><input type="text" id="vfNlNumero"></div>
          <div class="fg"><label>Área (m²)</label><input type="number" id="vfNlArea" step="0.01" min="0"></div></div>
        <div class="frow3"><div class="fg"><label>Frente (m)</label><input type="number" id="vfNlFrente" step="0.01" min="0"></div>
          <div class="fg"><label>Fundos (m)</label><input type="number" id="vfNlFundos" step="0.01" min="0"></div>
          <div class="fg"><label>Matrícula</label><input type="text" id="vfNlMat"></div></div>
        <div class="fg"><label>Preço de tabela (R$)</label><input type="number" id="vfNlPreco" step="0.01" min="0" oninput="if(num(this.value)){setVal('vfTotal',this.value);window.vfManual=false;vfCalc();}"><div class="hint">Em branco, vale o valor da venda.</div></div>
        <div class="hint">O lote entra no loteamento já vendido para este contrato. A posição na planta você marca depois, em Imóveis › Planta.</div></div>` : ''}`}
    <div class="fieldset"><span class="lg">🧑‍🤝‍🧑 Comprador</span>
      ${pessoasListaHtml('vc', compradores, { recolher: true, conjuge: true, telObrigatorio: true, obrigatorio: true, cadastro: true, rotulo: 'Comprador', rotuloBotao: 'Adicionar comprador' })}
      <p class="help mt">O primeiro comprador é quem aparece nas telas de venda, recebível e cobrança. Os demais existem para o contrato. Marido e mulher não precisam de dois blocos: use o estado civil e o cônjuge.</p></div>
    <div class="fieldset"><span class="lg">✍️ Vendedor</span>
      ${vendedoresListaHtml('vfVend', vsel)}
      <p class="help mt">Cadastre outros CNPJs do grupo em Configurações › Dados da empresa. O contrato sai com a qualificação de todos os escolhidos aqui.</p></div>
    <div class="fieldset"><span class="lg">🤝 Intermediação</span>
      <div class="fg"><label>O negócio foi intermediado por corretor de imóveis?</label>
        <select id="vfTemCorretor" onchange="vfCorretorChange()">
          <option value="nao" ${temCorr ? '' : 'selected'}>Não — venda direta pela empresa</option>
          <option value="sim" ${temCorr ? 'selected' : ''}>Sim</option></select></div>
      <div id="vkBox" style="${temCorr ? '' : 'display:none'}">
        ${corrs.length ? `<div class="fg"><label>Corretor já cadastrado</label><select id="vkSel" onchange="vkPreenche()"><option value="">— digitar os dados —</option>${optionsHtml(corrs, '', cc => cc.nome + (cc.imobiliaria ? ' (' + cc.imobiliaria + ')' : ''))}</select></div>` : ''}
        ${pessoaFormHtml('vk', Object.assign({ tipo: 'pf' }, k, { nome: k.nome === 'Venda direta' ? '' : k.nome }), { soGenero: true })}
        <div class="frow"><div class="fg"><label>CRECI *</label><input type="text" id="vkCreci" value="${esc(k.creci || '')}"></div><div class="fg"><label>Imobiliária</label><input type="text" id="vkImob" value="${esc(k.imobiliaria || '')}"></div></div>
        <div class="frow"><div class="fg"><label>Comissão (%)</label><input type="number" id="vkPct" step="0.1" value="${x ? x.comissaoPct : db.config.comissaoPct}" oninput="vfCalc()"></div><div class="fg"><label>Comissão (R$)</label><input type="number" id="vkVal" step="0.01" value="${x ? x.comissaoValor : ''}" oninput="vfCalcPct()"></div></div>
      </div></div>
    <div class="fieldset"><span class="lg">💰 Condições de pagamento</span>
      <div class="frow"><div class="fg"><label>Data da venda *</label><input type="date" id="vfData" value="${x ? x.dataVenda : hoje}"></div><div class="fg"><label>Valor da venda (R$) *</label><input type="number" id="vfTotal" step="0.01" value="${total}" oninput="vfCalc()"></div></div>
      <div class="fg"><label>Forma de pagamento</label><select id="vfForma" onchange="vfFormaChange()">
        <option value="parcelado" ${aVista ? '' : 'selected'}>Parcelado</option>
        <option value="vista" ${aVista ? 'selected' : ''}>À vista</option></select></div>
      <div id="vfVistaBox" style="${aVista ? '' : 'display:none'}">
        <div class="fg"><label>Data do pagamento</label><input type="date" id="vfDataVista" value="${x ? x.dataEntrada || x.dataVenda : hoje}"></div></div>
      <div id="vfParcBox" style="${aVista ? 'display:none' : ''}">
      <div class="frow"><div class="fg"><label>Entrada (R$)</label><input type="number" id="vfEntrada" step="0.01" value="${entrada}" oninput="vfCalc()"></div><div class="fg"><label>Data da entrada</label><input type="date" id="vfDataEntrada" value="${x ? x.dataEntrada || x.dataVenda : hoje}"></div></div>
      <div class="frow3"><div class="fg"><label>Nº parcelas</label><input type="text" inputmode="numeric" id="vfN" value="${n}" oninput="vfCalc()"></div><div class="fg"><label>Juros (% a.m.)</label><input type="number" id="vfJuros" step="0.01" value="${x ? (x.jurosMes || 0) : (cond.jurosMes || 0)}" oninput="vfCalc()"></div><div class="fg"><label>1º vencimento</label><input type="date" id="vfPrimeiro" value="${x ? x.primeiroVencimento : addMonths(hoje, 1)}"></div></div>
      <div class="fg"><label>Valor da parcela (R$) <span class="tiny muted">— calculado; pode ajustar</span></label><input type="number" id="vfParcela" step="0.01" value="${x ? x.valorParcela : ''}" oninput="vfManual=true;vfCalc()"></div>
      ${indiceSelectHtml(x ? x.indiceId : '', x ? x.indiceBase : '', x ? x.dataVenda : hoje)}
      <div class="fg"><label>Reforços / balões (opcional)</label><div id="vfBaloes"></div><button class="btn btn-secondary btn-sm" onclick="addBalao()">＋ Adicionar reforço</button></div>
      </div>
      <div class="sim-result" id="vfResumo"></div>
      ${temPagos ? '<p class="tiny muted mt">⚠️ Esta venda já tem pagamentos registrados: as parcelas <b>não serão regeradas</b> ao salvar. Edite parcelas individualmente na tela da venda.</p>' : ''}
    </div>
    <div class="fg"><label>Observações / contrato</label><textarea id="vfObs">${esc(x ? x.obs || '' : (res && res.obs ? res.obs : ''))}</textarea></div>`;
  openModal({ title: x ? '✏️ Editar venda' : '💰 Registrar venda', body, footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="salvarVenda('${x ? x.id : ''}','${reservaId || ''}')">Salvar venda</button>`, wide: true });
  window.vfManual = !!x; window.vfBaloes = x ? (x.baloes || []).map(b => ({ ...b })) : [];
  renderBaloes(); vfCalc();
}
function vfCorretorChange() {
  const sim = val('vfTemCorretor') === 'sim';
  const box = $('#vkBox'); if (box) box.style.display = sim ? '' : 'none';
}
function vfFormaChange() {
  const vista = val('vfForma') === 'vista';
  const p = $('#vfParcBox'), v = $('#vfVistaBox');
  if (p) p.style.display = vista ? 'none' : '';
  if (v) v.style.display = vista ? '' : 'none';
  vfCalc();
}
function vkPreenche() { const c = db.corretores.find(x => x.id === val('vkSel')); if (!c) return; setVal('vkNome', c.nome); setVal('vkCreci', c.creci); setVal('vkTel', c.telefone); setVal('vkImob', c.imobiliaria); }
function vfLoteChange() {
  const v = val('vfLote'); const box = $('#vfNovoLoteBox');
  if (box) box.style.display = v === '__novo' ? '' : 'none';
  if (v === '__novo') { const q = $('#vfNlQuadra'); if (q && !q.value) setTimeout(() => q.focus(), 0); return; }
  const l = getLote(v); if (l) { setVal('vfTotal', l.preco); window.vfManual = false; vfCalc(); }
}
/* Lote vendido sem contrato no sistema: veio de antes, marcado à mão ou importado. */
function vendidoSemContrato(l) { return l && l.status === 'vendido' && !db.vendas.some(v => v.loteId === l.id && v.status !== 'distrato'); }
function addBalao() { window.vfBaloes.push({ data: addMonths(val('vfPrimeiro') || todayStr(), 12), valor: 0 }); renderBaloes(); vfCalc(); }
function delBalao(i) { window.vfBaloes.splice(i, 1); renderBaloes(); vfCalc(); }
function renderBaloes() {
  const box = $('#vfBaloes'); if (!box) return;
  box.innerHTML = (window.vfBaloes || []).map((b, i) => `<div class="frow" style="grid-template-columns:1fr 1fr auto;margin-bottom:6px"><input type="date" value="${b.data || ''}" onchange="vfBaloes[${i}].data=this.value;vfCalc()"><input type="number" step="0.01" placeholder="Valor" value="${b.valor || ''}" oninput="vfBaloes[${i}].valor=num(this.value);vfCalc()"><button class="btn-icon del" onclick="delBalao(${i})">🗑</button></div>`).join('');
}
function vfCalc() {
  if (val('vfForma') === 'vista') {
    const el0 = $('#vfResumo');
    if (el0) el0.innerHTML = `Pagamento único de <b>${fmtMoney(num(val('vfTotal')))}</b><span class="tiny muted"> — uma parcela só, sem juros nem correção.</span>`;
    return;
  }
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
  let l = carteira ? null : getLote(x ? x.loteId : val('vfLote'));
  /* Lote novo, cadastrado no próprio contrato. Só é gravado junto com a venda, depois de
     tudo conferido: um contrato recusado não deixa lote solto para trás. */
  let loteNovo = null;
  if (!carteira && !x && val('vfLote') === '__novo') {
    if (!podeCriarLote()) { toast('🔒', 'Sem permissão', 'Cadastrar lote é do dono ou do administrador.', true); return; }
    const quadra = val('vfNlQuadra').toUpperCase(), numero = val('vfNlNumero');
    if (!quadra || !numero) { toast('⚠️', 'Informe quadra e número do lote novo', '', true); const q = $('#vfNlQuadra'); if (q) q.focus(); return; }
    const dup = db.lotes.find(y => y.loteamentoId === lot.id && String(y.quadra).toUpperCase() === quadra && String(y.numero) === numero);
    if (dup) { toast('⚠️', `${loteLabel(dup)} já existe`, 'Escolha ele na lista de lotes.', true); return; }
    loteNovo = { id: genId(), loteamentoId: lot.id, quadra, numero, area: num(val('vfNlArea')), frente: num(val('vfNlFrente')) || null, fundos: num(val('vfNlFundos')) || null,
      preco: num(val('vfNlPreco')) || num(val('vfTotal')), tipo: 'residencial', matricula: val('vfNlMat'), status: 'disponivel', obs: '', criadoEm: new Date().toISOString() };
    l = loteNovo;
  }
  if (!carteira) {
    if (!l) { toast('⚠️', 'Selecione o lote', '', true); return; }
    if (!x && l.status !== 'disponivel' && !(reservaId && l.status === 'reservado') && !vendidoSemContrato(l)) { toast('⚠️', 'Lote não está disponível', '', true); return; }
  } else if (!val('vfImDesc')) { toast('⚠️', 'Descreva o imóvel', 'Ex.: Apartamento 302, Ed. Aurora', true); return; }
  const total = num(val('vfTotal')); if (!total || !val('vfData')) { toast('⚠️', 'Informe valor e data da venda', '', true); return; }
  const aVista = val('vfForma') === 'vista';
  const n = aVista ? 0 : Math.max(0, Math.round(num(val('vfN'))));
  if (n && !val('vfPrimeiro')) { toast('⚠️', 'Informe o 1º vencimento', '', true); return; }
  const baloes = aVista ? [] : (window.vfBaloes || []).filter(b => b.data && num(b.valor) > 0);
  const compradores = pessoasDoFormLista('vc', x ? todosCompradores(x) : (res ? [res.cliente] : []));
  if (!compradores.length) { toast('⚠️', 'Informe o comprador', '', true); return; }
  /* A qualificação é obrigatória: contrato e escritura não saem sem ela, e completar depois,
     com o comprador fora da sala, é o que nunca acontece. */
  const pend = compradores.map((p, i) => ({ i, f: faltaQualificacao(p) })).filter(o => o.f.length);
  if (pend.length) {
    toast('⚠️', 'Qualificação incompleta', `${compradores.length > 1 ? `Comprador ${pend[0].i + 1}: ` : ''}falta ${pend[0].f.join(', ')}.`, true);
    const foco = document.getElementById(pfxPessoa('vc', pend[0].i) + 'Nome'); if (foco) foco.scrollIntoView({ block: 'center' });
    return;
  }
  if (!compradores[0].telefone) { toast('⚠️', 'Informe o telefone do comprador', 'É por ele que o sistema fala com a venda.', true); return; }
  const temCorretor = val('vfTemCorretor') === 'sim';
  if (temCorretor && (!val('vkNome') || !val('vkCreci'))) { toast('⚠️', 'Informe o corretor', 'Nome e CRECI são obrigatórios quando houve intermediação.', true); return; }
  const corretor = temCorretor
    ? Object.assign(pessoaDoForm('vk', (x && x.corretor) || (res && res.corretor) || { tipo: 'pf' }), {
        creci: val('vkCreci'), imobiliaria: val('vkImob'),
        email: val('vkEmail') || (x && x.corretor.email) || '',
        userId: (x && x.corretor.userId) || (res && res.corretor && res.corretor.userId) || (corretorSelecionado('vkSel') || {}).userId || null
      })
    : { tipo: 'pf', nome: 'Venda direta', creci: '', telefone: '', imobiliaria: '', email: '', userId: null };
  const vendIds = vendedoresDoFormLista('vfVend');
  const venda = Object.assign({}, x || { id: genId(), loteId: l ? l.id : null, loteamentoId: lot.id, status: 'ativa', reservaId: reservaId || null, criadoEm: new Date().toISOString(), comissaoPaga: false, comissaoData: null }, {
    imovel: carteira ? {
      descricao: val('vfImDesc'), endereco: val('vfImEnd'), matricula: val('vfImMat'), descricaoMatricula: val('vfImDescMat'),
      cartorio: val('vfImCart'), area: num(val('vfImArea')) || null, cep: val('vfImCep'), bairro: val('vfImBairro'), cidade: val('vfImCidade')
    } : null,
    cliente: compradores[0],
    compradoresExtras: compradores.slice(1),
    vendedorId: vendIds[0] || null,
    /* Os vendedores são congelados na venda: se o cadastro mudar depois, o contrato já
       assinado continua contando a história que foi assinada. */
    vendedor: vendedorPorId(vendIds[0]),
    vendedoresExtras: vendIds.slice(1).map(vendedorPorId),
    corretor,
    corretorUserId: temCorretor ? ((x && x.corretorUserId) || (res && res.corretorUserId) || (corretorSelecionado('vkSel') || {}).userId || null) : null,
    dataVenda: val('vfData'), valorTotal: total,
    /* À vista é uma parcela só: o valor inteiro entra como entrada, na data do pagamento. */
    entrada: aVista ? total : num(val('vfEntrada')),
    dataEntrada: (aVista ? val('vfDataVista') : val('vfDataEntrada')) || val('vfData'),
    nParcelas: n, jurosMes: aVista ? 0 : num(val('vfJuros')),
    valorParcela: aVista ? 0 : num(val('vfParcela')), primeiroVencimento: (aVista ? '' : val('vfPrimeiro')) || val('vfData'), baloes,
    comissaoPct: temCorretor ? num(val('vkPct')) : 0, comissaoValor: temCorretor ? num(val('vkVal')) : 0, obs: val('vfObs'),
    indiceId: aVista ? null : (val('vfIndice') || null), indiceBase: val('vfIndiceBase') || monthKey(val('vfData'))
  });
  upsert('vendas', venda);
  registrarClientesDaVenda(compradores);
  const temPagos = x && recebiveisDe(x.id).some(r => num(r.valorPago) > 0);
  if (!temPagos) {
    if (x) recebiveisDe(x.id).forEach(r => removeRec('recebiveis', r.id));
    gerarRecebiveis(venda).forEach(r => upsert('recebiveis', r));
  }
  if (!x) {
    if (loteNovo) logAct(`Lote cadastrado no contrato: ${loteLabel(loteNovo)} — ${fmtMoney(loteNovo.preco)}`);
    if (l) upsert('lotes', Object.assign({}, l, { status: 'vendido', vendaId: venda.id, reservaId: null }));
    if (reservaId) { const r = getReserva(reservaId); if (r) upsert('reservas', Object.assign({}, r, { status: 'convertida', encerradaEm: new Date().toISOString() })); }
    if (venda.corretor.telefone || venda.corretor.creci) registrarCorretor(venda.corretor);
    logAct(`Venda registrada: ${imovelLabel(venda)} — ${venda.cliente.nome} — ${fmtMoney(total)}`);
  } else logAct(`Venda editada: ${imovelLabel(venda)} — ${venda.cliente.nome}`);
  atualizarStatusVenda(venda.id);
  closeModal(); renderCurrent(); toast('✅', x ? 'Venda atualizada' : 'Venda registrada', imovelLabel(venda));
  if (!x) perguntarContrato(venda.id);
}
/* Registrada a venda, o passo seguinte é sempre o contrato. Perguntar aqui poupa o usuário
   de procurar o botão, e a tela do contrato ainda é conferível antes de imprimir. */
function perguntarContrato(vendaId) {
  const v = getVenda(vendaId); if (!v) return;
  if (typeof gerarContratoVenda !== 'function') return;
  openModal({
    title: '📄 Emitir o contrato agora?',
    body: `<p class="help">A venda de <b>${esc(imovelLabel(v))}</b> para <b>${esc(v.cliente.nome)}</b> foi registrada. Quer gerar o contrato agora? Você ainda vai poder conferir e corrigir o texto antes de imprimir.</p>`,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Agora não</button><button class="btn btn-primary" onclick="closeModal();gerarContratoVenda('${v.id}')">📄 Gerar contrato</button>`
  });
}
/* Exclusão do contrato, no lugar do distrato — que ficou mal resolvido e a gente ainda não
   sabe como quer. Apagar é destrutivo e leva junto o histórico de pagamentos, então são duas
   etapas: primeiro o que vai embora, depois escrever EXCLUIR. */
function excluirVenda(id) {
  const x = getVenda(id); if (!x) return;
  const recs = recebiveisDe(x.id);
  const pagos = recs.filter(r => num(r.valorPago) > 0);
  const totalPago = pagos.reduce((s, r) => s + num(r.valorPago), 0);
  const l = x.loteId ? getLote(x.loteId) : null;
  openModal({
    title: '🗑️ Excluir contrato',
    body: `<p class="help mb">Isto apaga a venda de <b>${esc(imovelLabel(x))}</b> para <b>${esc(x.cliente.nome)}</b>. Não dá para desfazer.</p>
      <div class="detail-grid">
        <div><div class="k">Parcelas</div><div class="v">${recs.length} serão apagadas</div></div>
        <div><div class="k">Já recebido</div><div class="v">${pagos.length ? `<b style="color:var(--danger)">${fmtMoney(totalPago)}</b> em ${pagos.length} pagamento(s)` : 'nada'}</div></div>
        ${l ? `<div class="full"><div class="k">Lote</div><div class="v">${esc(loteLabel(l))} volta a ficar disponível</div></div>` : ''}
      </div>
      ${pagos.length ? `<div class="alert warn" style="cursor:default"><span>Este contrato tem <b>${fmtMoney(totalPago)}</b> já recebido. Apagando, esse dinheiro some dos relatórios e do caixa. Se o negócio foi desfeito e você precisa do histórico, guarde um backup antes em Configurações › Backup.</span></div>` : ''}
      <div class="fg mt"><label>Para confirmar, escreva <b>EXCLUIR</b></label><input type="text" id="exVenda" placeholder="EXCLUIR" autocomplete="off"></div>`,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-outline-danger" onclick="confirmarExclusaoVenda('${x.id}')">Excluir contrato</button>`
  });
  setTimeout(() => { const el = $('#exVenda'); if (el) el.focus(); }, 60);
}
function confirmarExclusaoVenda(id) {
  const x = getVenda(id); if (!x) return;
  if (val('exVenda').trim().toUpperCase() !== 'EXCLUIR') { toast('⚠️', 'Escreva EXCLUIR', 'A palavra confirma que você quer mesmo apagar.', true); return; }
  const nome = x.cliente.nome, imovel = imovelLabel(x);
  recebiveisDe(x.id).forEach(r => removeRec('recebiveis', r.id));
  db.cobrancas.filter(c => c.vendaId === x.id).forEach(c => removeRec('cobrancas', c.id));
  const l = x.loteId ? getLote(x.loteId) : null;
  if (l && l.vendaId === x.id) upsert('lotes', Object.assign({}, l, { status: 'disponivel', vendaId: null, reservaId: null }));
  removeRec('vendas', x.id);
  logAct(`Contrato excluído: ${imovel} — ${nome}`);
  closeModal(); renderCurrent(); toast('🗑️', 'Contrato excluído', `${imovel} — ${nome}`);
}

// ================================================================ CADASTROS
function renderCadastros() {
  const v = $('#av-cadastros');
  state.sub.cad = state.sub.cad || (Cloud.active ? 'corretores' : 'empresa');
  /* Só o que se ajusta uma vez. Índices, corretores e vitrine saíram daqui: os dois primeiros
     são rotina e têm lugar no menu; a vitrine saiu do produto. No modo local não existe
     equipe — os corretores ficam em Comercial › Corretores. */
  const todasTabs = [...(Cloud.active ? [['corretores', '👥 Equipe', 'equipe.gerenciar']] : []),
    ['empresa', '🏢 Dados da empresa', 'config.editar'], ['permissoes', '🔐 Permissões', 'equipe.gerenciar'], ['categorias', '🏷️ Categorias', 'custos.editar'], ['documentos', '📄 Modelos de documento', 'documentos.editar'],
    ['banco', '🏦 Contas bancárias', 'config.editar'], ['cobranca', '🔔 Régua de cobrança', 'cobranca.registrar'],
    ['config', '⚙️ Geral', 'config.editar'], ['nuvem', Cloud.active ? '☁️ Conta' : '☁️ Nuvem', null], ['backup', '💾 Backup', 'backup.usar']];
  const tabs = todasTabs.filter(t => !t[2] || pode(t[2])).map(t => [t[0], t[1]]);
  if (!tabs.find(t => t[0] === state.sub.cad)) state.sub.cad = tabs.length ? tabs[0][0] : 'config';
  const sub = state.sub.cad;
  let html = `<div class="subtabs">${tabs.map(([k, l]) => `<div class="chip ${sub === k ? 'active' : ''}" onclick="state.sub.cad='${k}';renderCurrent()">${l}</div>`).join('')}</div>`;
  if (sub === 'corretores') html += cadEquipeHtml();
  else if (sub === 'empresa') html += cadEmpresaHtml();
  else if (sub === 'categorias') html += cadCategoriasHtml();
  else if (sub === 'documentos') html += cadDocumentosHtml();
  else if (sub === 'cobranca') html += cadCobrancaHtml();
  else if (sub === 'banco') html += cadBancoHtml();
  else if (sub === 'permissoes') html += cadPermissoesHtml();
  else if (sub === 'config') html += cadConfigHtml();
  else if (sub === 'nuvem') html += Cloud.active ? cadContaHtml() : cadNuvemHtml();
  else if (sub === 'backup') html += cadBackupHtml();
  v.innerHTML = html;
  if (sub === 'nuvem') renderSyncStatus();
}
function cadLoteamentoHtml() {
  const lot = curLot(); if (!lot) return `<div class="card"><p class="help">Nenhum loteamento. <button class="btn btn-primary btn-sm" onclick="abrirLoteamentoForm()">＋ Cadastrar</button></p></div>`;
  if (ehCarteira(lot)) return terceiroResumoHtml(lot) + (custosDo(lot.id).length ? orcamentoCardHtml(lot) : '');
  const c = lot.cond || {};
  return `<div class="card"><h3>🏘️ ${esc(lot.nome)} <span class="badge neutral">Loteamento</span> <span class="h-actions"><button class="btn btn-secondary btn-sm" onclick="abrirLoteamentoForm('${lot.id}')">✏️ Editar</button></span></h3>
      <div class="detail-grid"><div><div class="k">Cidade</div><div class="v">${esc(lot.cidade) || '—'}</div></div><div><div class="k">Endereço</div><div class="v">${esc(lot.endereco) || '—'}</div></div><div class="full"><div class="k">Descrição (aparece para os corretores)</div><div class="v">${esc(lot.descricao) || '—'}</div></div>
      <div><div class="k">Entrada mínima</div><div class="v">${fmtNum(c.entradaMinPct || 0, 0)}%</div></div><div><div class="k">Parcelas máx.</div><div class="v">${c.maxParcelas || '—'}</div></div><div><div class="k">Juros</div><div class="v">${c.jurosMes ? fmtNum(c.jurosMes, 2) + '% a.m.' : 'sem juros'}</div></div><div><div class="k">Desconto à vista</div><div class="v">${fmtNum(c.descontoVistaPct || 0, 0)}%</div></div></div></div>
    ${orcamentoCardHtml(lot)}`;
}
function orcamentoCardHtml(lot) {
  const orc = lot.orcamento || {}; const cs = custosDo(lot.id);
  return `<div class="card"><h3>📋 Orçamento de custos por categoria <span class="h-actions"><button class="btn btn-secondary btn-sm" onclick="abrirOrcamentoForm()">✏️ Editar</button></span></h3>
      ${db.categorias.filter(cat => num(orc[cat.id]) > 0).map(cat => { const real = cs.filter(x => x.categoriaId === cat.id).reduce((s, x) => s + num(x.valor), 0); const pct = Math.round(real / orc[cat.id] * 100); return `<div class="mb"><div class="row-between small"><span><span class="dot" style="background:${cat.cor}"></span> ${esc(cat.nome)}</span><span class="muted">${fmtMoney(real)} de ${fmtMoney(orc[cat.id])} (${pct}%)</span></div><div class="progress"><div class="${pct > 100 ? 'over' : pct >= 90 ? 'warn' : ''}" style="width:${Math.min(100, pct)}%"></div></div></div>`; }).join('') || '<p class="help">Nenhum orçamento definido. Defina o valor planejado por categoria para acompanhar orçado × realizado.</p>'}
      ${Object.values(orc).some(x => num(x) > 0) ? `<p class="small mt"><b>Total orçado: ${fmtMoney(Object.values(orc).reduce((s, x) => s + num(x), 0))}</b> · realizado ${fmtMoney(cs.reduce((s, x) => s + num(x.valor), 0))}</p>` : ''}</div>`;
}
/* O imóvel de terceiro abre direto no que importa: quanto vale, se está vendido e para quem. */
function terceiroResumoHtml(lot) {
  const vd = vendaAtivaDoImovel(lot); const c = lot.cond || {};
  const temCond = ['entradaMinPct', 'maxParcelas', 'jurosMes', 'descontoVistaPct'].some(k => num(c[k]));
  const end = enderecoLinha(lot) || lot.endereco || '';
  return `<div class="card"><h3><span>🏠 ${esc(lot.nome)} <span class="badge neutral">Imóvel de terceiro</span> <span class="badge ${vd ? 'vendido' : 'disponivel'}">${vd ? 'Vendido' : 'Disponível'}</span></span>
      ${pode('config.editar') || pode('lotes.editar') ? `<span class="h-actions"><button class="btn btn-secondary btn-sm" onclick="abrirLoteamentoForm('${lot.id}')">✏️ Editar</button></span>` : ''}</h3>
    <div class="row-between mb" style="flex-wrap:wrap;gap:10px">
      <div><div class="price-big">${num(lot.preco) ? fmtMoney(lot.preco) : '—'}</div><div class="price-sub">${num(lot.preco) ? 'valor de venda' : 'valor de venda ainda não informado'}</div></div>
      ${vd ? `<button class="btn btn-secondary" style="flex:none" onclick="abrirVendaAdmin('${vd.id}')">📄 Contrato de ${esc(vd.cliente.nome)} · ${fmtMoney(vd.valorTotal)}</button>`
        : pode('vendas.criar') ? `<button class="btn btn-primary" style="flex:none" onclick="setCurLotSilencioso('${lot.id}');abrirVendaForm()">💰 Registrar venda</button>` : ''}
    </div>
    <div class="detail-grid">
      <div><div class="k">Matrícula</div><div class="v">${esc(lot.matricula) || '—'}</div></div><div><div class="k">Área</div><div class="v">${num(lot.area) ? fmtNum(lot.area, 2) + ' m²' : '—'}</div></div>
      <div class="full"><div class="k">Endereço</div><div class="v">${esc(end) || esc(lot.cidade) || '—'}</div></div>
      ${lot.cartorio ? `<div class="full"><div class="k">Cartório</div><div class="v">${esc(lot.cartorio)}</div></div>` : ''}
      ${lot.descricaoMatricula ? `<div class="full"><div class="k">Descrição conforme a matrícula</div><div class="v">${esc(lot.descricaoMatricula)}</div></div>` : ''}
      ${lot.descricao ? `<div class="full"><div class="k">Observações</div><div class="v">${esc(lot.descricao)}</div></div>` : ''}
      ${temCond ? `<div><div class="k">Entrada mínima</div><div class="v">${fmtNum(c.entradaMinPct || 0, 0)}%</div></div><div><div class="k">Parcelas máx.</div><div class="v">${c.maxParcelas || '—'}</div></div><div><div class="k">Juros</div><div class="v">${c.jurosMes ? fmtNum(c.jurosMes, 2) + '% a.m.' : 'sem juros'}</div></div><div><div class="k">Desconto à vista</div><div class="v">${fmtNum(c.descontoVistaPct || 0, 0)}%</div></div>` : ''}
    </div></div>`;
}
function abrirLoteamentoForm(id, opc) {
  opc = opc || {};
  const l = id ? getLoteamento(id) : null;
  const tipo = l ? empTipo(l) : (opc.tipo === 'carteira' ? 'carteira' : 'loteamento'); const terc = tipo === 'carteira';
  const c = (l && l.cond) || { entradaMinPct: 10, maxParcelas: 120, jurosMes: 0, descontoVistaPct: 5 };
  const mostra = ok => ok ? '' : 'display:none';
  const body = `${opc.paraContrato ? '<input type="hidden" id="lmParaContrato" value="1"><div class="alert info" style="cursor:default"><span>Depois de salvar, o contrato abre com este imóvel.</span></div>' : ''}<div class="fg"><label>Tipo *</label><select id="lmTipo" ${l ? 'disabled' : ''} onchange="lmTipoChange()">
      <option value="loteamento" ${terc ? '' : 'selected'}>Loteamento — com planta e lotes numerados</option>
      <option value="carteira" ${terc ? 'selected' : ''}>Imóvel de terceiro — um lote, uma casa, um apartamento</option></select>
      <div class="hint" id="lmHint">${l ? 'O tipo não muda depois de criado.' : lmHint(terc)}</div></div>
    <div class="fg"><label id="lmNomeLbl">${terc ? 'Qual é o imóvel *' : 'Nome do loteamento *'}</label><input type="text" id="lmNome" value="${esc(l ? l.nome : '')}" placeholder="${terc ? 'Ex.: Lote 15 da Quadra 300 · Apartamento 302 do Ed. Aurora' : 'Ex.: Residencial Vista Verde'}"></div>
    <div id="lmBoxTerceiro" style="${mostra(terc)}">
      <div class="frow3"><div class="fg"><label>Valor de venda (R$) *</label><input type="number" id="lmPreco" step="0.01" value="${l && num(l.preco) ? l.preco : ''}" placeholder="0,00"></div>
        <div class="fg"><label>Matrícula</label><input type="text" id="lmMat" value="${esc(l ? l.matricula || '' : '')}"></div>
        <div class="fg"><label>Área (m²)</label><input type="number" id="lmArea" step="0.01" value="${l && num(l.area) ? l.area : ''}"></div></div></div>
    <div class="frow"><div class="fg"><label>Cidade / UF</label><input type="text" id="lmCidade" value="${esc(l ? l.cidade || '' : '')}"></div><div class="fg"><label>Endereço / acesso</label><input type="text" id="lmEnd" value="${esc(l ? l.endereco || '' : '')}"></div></div>
    <div class="fg"><label id="lmDescLbl">${terc ? 'Observações' : 'Descrição para os corretores'}</label><textarea id="lmDesc" placeholder="${terc ? 'Quem é o proprietário, chaves, o que for útil…' : 'Infraestrutura, diferenciais, área de lazer…'}">${esc(l ? l.descricao || '' : '')}</textarea></div>
    <details class="qualif"><summary>📋 Endereço e registro — para contrato, escritura e declaração fiscal</summary>
      <div class="frow3"><div class="fg"><label>CEP</label><input type="text" id="lmCep" value="${esc(l ? l.cep || '' : '')}"></div>
        <div class="fg" style="grid-column:span 2"><label>Logradouro</label><input type="text" id="lmLogr" value="${esc(l ? l.logradouro || '' : '')}" placeholder="Rua, avenida, rodovia…"></div></div>
      <div class="frow3"><div class="fg"><label>Número</label><input type="text" id="lmNum" value="${esc(l ? l.numeroEnd || '' : '')}"></div>
        <div class="fg"><label>Bairro</label><input type="text" id="lmBairro" value="${esc(l ? l.bairro || '' : '')}"></div>
        <div class="fg"><label>UF</label><select id="lmUf"><option value="">—</option>${UFS.map(u => `<option value="${u}" ${(l || {}).uf === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div></div>
      <div class="frow"><div class="fg"><label>Cartório de Registro de Imóveis</label><input type="text" id="lmCartorio" value="${esc(l ? l.cartorio || '' : '')}" placeholder="Ex.: 1º Ofício de Registro de Imóveis da Comarca de…"></div>
        <div class="fg" id="lmMatMaeBox" style="${mostra(!terc)}"><label>Matrícula mãe</label><input type="text" id="lmMatMae" value="${esc(l ? l.matriculaMae || '' : '')}"></div></div>
      <div class="fg" id="lmDescMatBox" style="${mostra(terc)}"><label>Descrição conforme a matrícula</label><textarea id="lmDescMat" rows="3" placeholder="Copie do registro, com as confrontações, exatamente como está na matrícula.">${esc(l ? l.descricaoMatricula || '' : '')}</textarea>
        <div class="hint">O contrato sai com este texto. O cartório compara com a matrícula palavra por palavra.</div></div>
      <div class="fg"><label>Código do município no IBGE</label><input type="text" id="lmIbge" value="${esc(l ? l.codigoIbge || '' : '')}" placeholder="7 dígitos">
        <div class="hint">Só a declaração fiscal usa. Se não souber agora, deixe em branco e preencha depois.</div></div></details>
    <details class="qualif" id="lmCondBox" ${terc ? '' : 'open'}><summary>💳 Condições de pagamento padrão <span class="tiny muted" id="lmCondOpc">${terc ? '— opcional' : ''}</span></summary>
      <div class="frow"><div class="fg"><label>Entrada mínima (%)</label><input type="number" id="lmEntrada" step="0.1" value="${c.entradaMinPct ?? 10}"></div><div class="fg"><label>Máximo de parcelas</label><input type="number" id="lmMaxP" value="${c.maxParcelas ?? 120}"></div></div>
      <div class="frow"><div class="fg"><label>Juros do parcelamento (% a.m.)</label><input type="number" id="lmJuros" step="0.01" value="${c.jurosMes ?? 0}"><div class="hint">0 = sem juros (parcelas lineares)</div></div><div class="fg"><label>Desconto à vista (%)</label><input type="number" id="lmDesc2" step="0.1" value="${c.descontoVistaPct ?? 0}"></div></div></details>`;
  openModal({ title: l ? `✏️ Editar ${empLabel(l).toLowerCase()}` : '＋ Novo imóvel', body, footer: `${l && db.loteamentos.length > 1 ? `<button class="btn btn-outline-danger" onclick="excluirLoteamento('${l.id}')">Excluir</button>` : ''}<button class="btn btn-secondary" onclick="${opc.paraContrato ? 'novaVendaEscolhendoEmp()' : 'closeModal()'}">${opc.paraContrato ? '‹ Voltar' : 'Cancelar'}</button><button class="btn btn-primary" onclick="salvarLoteamento('${l ? l.id : ''}')">${opc.paraContrato ? 'Salvar e abrir o contrato' : 'Salvar'}</button>` });
  setTimeout(() => $('#lmNome').focus(), 60);
}
function lmHint(terc) {
  return terc
    ? 'Um imóvel só, que você vende para o proprietário: lote, casa, apartamento, sala. Não tem planta nem lotes; tem valor de venda, matrícula e endereço, e o contrato já sai com esses dados.'
    : 'Tem planta, lotes numerados com preço cada um e reservas pelos corretores.';
}
function lmTipoChange() {
  const terc = val('lmTipo') === 'carteira';
  const mostra = (id, ok) => { const el = document.getElementById(id); if (el) el.style.display = ok ? '' : 'none'; };
  mostra('lmBoxTerceiro', terc); mostra('lmDescMatBox', terc); mostra('lmMatMaeBox', !terc);
  $('#lmNomeLbl').textContent = terc ? 'Qual é o imóvel *' : 'Nome do loteamento *';
  $('#lmNome').placeholder = terc ? 'Ex.: Lote 15 da Quadra 300 · Apartamento 302 do Ed. Aurora' : 'Ex.: Residencial Vista Verde';
  $('#lmDescLbl').textContent = terc ? 'Observações' : 'Descrição para os corretores';
  $('#lmDesc').placeholder = terc ? 'Quem é o proprietário, chaves, o que for útil…' : 'Infraestrutura, diferenciais, área de lazer…';
  $('#lmHint').textContent = lmHint(terc);
  $('#lmCondOpc').textContent = terc ? '— opcional' : '';
  $('#lmCondBox').open = !terc;
}
function salvarLoteamento(id) {
  const prev = id ? getLoteamento(id) : null;
  const terc = prev ? ehCarteira(prev) : val('lmTipo') === 'carteira';
  const nome = val('lmNome'); if (!nome) { toast('⚠️', terc ? 'Informe qual é o imóvel' : 'Informe o nome', terc ? 'Ex.: Lote 15 da Quadra 300' : '', true); return; }
  /* Sem preço não há o que vender: as condições de pagamento dependem dele. */
  if (terc && !(num(val('lmPreco')) > 0)) { toast('⚠️', 'Informe o valor de venda', 'É por ele que a venda e as condições começam.', true); const p = $('#lmPreco'); if (p) p.focus(); return; }
  const rec = Object.assign({}, prev || { id: genId(), criadoEm: new Date().toISOString(), orcamento: {}, tipo: val('lmTipo') === 'carteira' ? 'carteira' : 'loteamento' }, { nome, cidade: val('lmCidade'), endereco: val('lmEnd'), descricao: val('lmDesc'),
    cep: val('lmCep'), logradouro: val('lmLogr'), numeroEnd: val('lmNum'), bairro: val('lmBairro'), uf: val('lmUf'),
    cartorio: val('lmCartorio'), matriculaMae: val('lmMatMae'), codigoIbge: onlyDigits(val('lmIbge')),
    ...(terc ? { preco: num(val('lmPreco')), matricula: val('lmMat'), area: num(val('lmArea')) || null, descricaoMatricula: val('lmDescMat') } : {}), cond: terc && !$('#lmCondBox').open ? ((prev && prev.cond) || {}) : { entradaMinPct: num(val('lmEntrada')), maxParcelas: Math.round(num(val('lmMaxP'))) || 120, jurosMes: num(val('lmJuros')), descontoVistaPct: num(val('lmDesc2')) } });
  const paraContrato = !prev && val('lmParaContrato') === '1';
  upsert('loteamentos', rec);
  if (paraContrato) {
    logAct(`${empLabel(rec)} cadastrado no contrato: ${nome}`);
    closeModal(); setCurLotSilencioso(rec.id); abrirVendaForm();
    toast('✅', `${empLabel(rec)} cadastrado`, 'Agora preencha o contrato.');
    return;
  }
  if (!prev) { logAct(`${empLabel(rec)} cadastrado: ${nome}`); state.empAberto = rec.id; state.empSub = 'resumo'; setCurLotSilencioso(rec.id); state.tab = 'emp'; }
  closeModal(); renderCurrent(); toast('✅', `${empLabel(rec)} salvo`, nome);
}
function excluirLoteamento(id) {
  const l = getLoteamento(id); if (!l) return;
  if (!confirm(ehCarteira(l) ? `Excluir "${l.nome}" e a venda, os recebíveis e os custos dele?` : `Excluir "${l.nome}" e TODOS os seus lotes, reservas, vendas e custos?`)) return;
  db.lotes.filter(x => x.loteamentoId === id).forEach(x => removeRec('lotes', x.id));
  db.reservas.filter(x => x.loteamentoId === id).forEach(x => removeRec('reservas', x.id));
  db.vendas.filter(x => x.loteamentoId === id).forEach(x => { recebiveisDe(x.id).forEach(r => removeRec('recebiveis', r.id)); removeRec('vendas', x.id); });
  db.custos.filter(x => x.loteamentoId === id).forEach(x => removeRec('custos', x.id));
  removeRec('loteamentos', id); state.lotId = null; state.plantaAdmin = null; state.plantaCorretor = null;
  closeModal(); renderCurrent(); toast('🗑️', `${empLabel(l)} excluído`, l.nome);
}
function cadLoteamentosHtml() {
  return `<div class="card"><h3>📋 Loteamentos <span class="h-actions"><button class="btn btn-primary btn-sm" onclick="abrirLoteamentoForm()">＋ Novo</button></span></h3>
    ${db.loteamentos.map(l => { const ls = lotesDo(l.id); return `<div class="item ${l.id === state.lotId ? '' : 'bloqueado'}" onclick="setCurLot('${l.id}');state.sub.cad='loteamento';renderCurrent()"><div class="info"><div class="title">${esc(l.nome)} ${l.id === state.lotId ? '<span class="badge aprovada">atual</span>' : ''}</div><div class="meta"><span class="badge neutral">${esc(empLabel(l))}</span><span>${esc(l.cidade || '')}</span>${ehCarteira(l) ? `<span>· ${db.vendas.filter(v => v.loteamentoId === l.id && v.status !== 'distrato').length} venda(s)</span>` : `<span>· ${ls.length} lotes</span><span>· ${ls.filter(x => x.status === 'vendido').length} vendidos</span>`}</div></div><div class="side"><button class="btn-icon" onclick="event.stopPropagation();abrirLoteamentoForm('${l.id}')">✏️</button></div></div>`; }).join('') || '<p class="help">Nenhum empreendimento.</p>'}</div>`;
}
function abrirOrcamentoForm() {
  const lot = curLot(); const orc = lot.orcamento || {};
  const body = `<p class="help mb">Valor planejado por categoria. O painel compara com os custos lançados.</p>${db.categorias.map(c => `<div class="fg"><label><span class="dot" style="background:${c.cor}"></span> ${esc(c.nome)}</label><input type="number" step="0.01" id="orc_${c.id}" value="${orc[c.id] || ''}" placeholder="0,00"></div>`).join('')}`;
  openModal({ title: '📋 Orçamento por categoria', body, footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="salvarOrcamento()">Salvar</button>` });
}
function salvarOrcamento() {
  const lot = curLot(); const orc = {};
  db.categorias.forEach(c => { const v = num(val('orc_' + c.id)); if (v > 0) orc[c.id] = v; });
  upsert('loteamentos', Object.assign({}, lot, { orcamento: orc })); closeModal(); renderCurrent(); toast('✅', 'Orçamento salvo', '');
}
/* Comercial › Corretores. No modo local o cadastro é daqui mesmo. Na nuvem o corretor entra
   por convite e vira membro da equipe, então a lista é a mesma de sempre e o botão leva ao
   convite, em Configurações › Equipe. */
function renderCorretoresAdmin() {
  const v = $('#av-corretores');
  if (!Cloud.active) { v.innerHTML = cadCorretoresHtml(); return; }
  const stats = c => { const m = x => (onlyDigits(x.telefone) && onlyDigits(x.telefone) === onlyDigits(c.telefone)) || (x.creci && c.creci && x.creci.toLowerCase() === c.creci.toLowerCase()) || (c.userId && x.userId === c.userId); return { res: db.reservas.filter(r => m(r.corretor)).length, vend: db.vendas.filter(v2 => v2.status !== 'distrato' && m(v2.corretor)) }; };
  v.innerHTML = `<div class="card"><h3>🧑‍💼 Corretores ${pode('equipe.gerenciar') ? `<span class="h-actions"><button class="btn btn-primary btn-sm" onclick="state.sub.cad='corretores';switchTab('cadastros')">＋ Convidar corretor</button></span>` : ''}</h3>
    <p class="help mb">Os corretores entram por convite e usam o portal deles para ver a planta, simular e pedir reserva.</p>
    ${db.corretores.slice().sort((a, b) => naturalCmp(a.nome, b.nome)).map(c => { const st = stats(c); return `<div class="item"><div class="info"><div class="title">${esc(c.nome)}</div><div class="meta"><span>${esc(c.creci || 'sem CRECI')}</span>${c.telefone ? `<span>· ${esc(fmtPhone(c.telefone))}</span>` : ''}${c.imobiliaria ? `<span>· ${esc(c.imobiliaria)}</span>` : ''}<span>· ${st.res} reserva(s) · ${st.vend.length} venda(s) · ${fmtMoneyShort(st.vend.reduce((t, x) => t + num(x.valorTotal), 0))}</span></div></div></div>`; }).join('') || '<p class="help">Nenhum corretor ainda. Convide o primeiro.</p>'}</div>`;
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
/* Dados da empresa: quem ela é, quem assina por ela e os outros CNPJs do grupo. Tudo o que
   o contrato precisa do lado de quem vende mora aqui. */
function cadEmpresaHtml() {
  const emp = vendedorPadrao();
  const reps = (db.config.representantes || []).filter(r => r && r.nome);
  return `<div class="card"><h3>🏢 A sua empresa</h3>
    <p class="help mb">É com estes dados que a empresa é qualificada no contrato, no boleto e nos documentos.</p>
    ${pessoaFormHtml('emp', Object.assign({}, emp, { tipo: 'pj' }), { semTipo: true, semRepresentante: true })}
    <button class="btn btn-primary" onclick="salvarEmpresa()">Salvar dados da empresa</button></div>

    <div class="card"><h3>✍️ Quem assina pela empresa</h3>
    <p class="help mb">Contrato social costuma exigir mais de uma assinatura. Cadastre aqui cada pessoa que assina, com a qualificação completa — é ela que sai no contrato.</p>
    ${pessoasListaHtml('sig', reps.length ? reps : [null], { rotulo: 'Signatário', rotuloBotao: 'Adicionar quem assina', soGenero: true, comCargo: true })}
    <button class="btn btn-primary mt" onclick="salvarSignatarios()">Salvar quem assina</button></div>

    <div class="card"><h3>🏘️ Outras empresas do grupo <span class="h-actions"><button class="btn btn-primary btn-sm" onclick="abrirVendedorForm()">＋ Nova</button></span></h3>
    <p class="help mb">Incorporadora costuma ter um CNPJ por empreendimento. Cadastre os outros aqui e, a cada venda, o sistema pergunta qual deles assina o contrato. A empresa acima é sempre a padrão.</p>
    ${db.vendedores.slice().sort((a, b) => naturalCmp(a.nome, b.nome)).map(v => {
      const falta = faltaQualificacao(v);
      return `<div class="item" onclick="abrirVendedorForm('${v.id}')"><div class="info"><div class="title">${esc(v.nome)}</div>
        <div class="meta"><span>${esc(v.cpf ? fmtCPF(v.cpf) : 'sem documento')}</span>${v.cidade ? `<span>· ${esc(v.cidade)}</span>` : ''}
        ${falta.length ? `<span class="warn">· falta ${esc(falta.join(', '))}</span>` : '<span>· qualificação completa</span>'}</div></div>
        <div class="side"><span class="muted">${db.vendas.filter(x => x.vendedorId === v.id).length} venda(s)</span></div></div>`;
    }).join('') || '<p class="help">Nenhuma outra empresa cadastrada.</p>'}</div>`;
}
function salvarEmpresa() {
  const p = pessoaDoForm('emp', {});
  if (!p.nome) { toast('⚠️', 'Informe a razão social', '', true); return; }
  setConfig({
    empresa: p.nome, cnpj: p.cpf, inscricaoEstadual: p.inscricaoEstadual || '',
    cep: p.cep || '', logradouro: p.logradouro || '', numeroEnd: p.numeroEnd || '', bairro: p.bairro || '',
    endereco: p.endereco || '', cidade: p.cidade || '', uf: p.uf || '', telefone: p.telefone || '', email: p.email || ''
  });
  toast('✅', 'Dados da empresa salvos', 'Já valem para os próximos documentos.'); renderCurrent();
}
function salvarSignatarios() {
  const reps = pessoasDoFormLista('sig', db.config.representantes || []);
  const p1 = reps[0] || {};
  setConfig({
    representantes: reps,
    /* Os campos antigos continuam preenchidos com o primeiro: modelo de contrato que já
       usava {{empresa.representante}} segue funcionando. */
    representante: p1.nome || '', repCpf: p1.cpf || '', repCargo: p1.cargo || '', repGenero: p1.genero || 'm'
  });
  toast('✅', reps.length > 1 ? 'Signatários salvos' : 'Signatário salvo', reps.map(r => r.nome).join(', ')); renderCurrent();
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
  closeModal(); renderCurrent(); toast('✅', 'Vendedor salvo', p.nome);
}
function excluirVendedor(id) {
  const usos = db.vendas.filter(v => v.vendedorId === id).length;
  if (usos && !confirm(`Este vendedor está em ${usos} venda(s). Os contratos já emitidos guardam os dados como estavam, mas ele some da lista. Excluir?`)) return;
  removeRec('vendedores', id); closeModal(); renderCurrent();
}
function abrirCorretorForm(id) {
  const c = id ? db.corretores.find(x => x.id === id) : null;
  const body = `<div class="fg"><label>Nome *</label><input type="text" id="cfNome" value="${esc(c ? c.nome : '')}"></div>
    <div class="frow"><div class="fg"><label>CRECI</label><input type="text" id="cfCreci" value="${esc(c ? c.creci : '')}"></div><div class="fg"><label>Telefone *</label><input type="tel" id="cfTel" value="${esc(c ? c.telefone : '')}"></div></div>
    <div class="frow"><div class="fg"><label>E-mail</label><input type="email" id="cfEmail" value="${esc(c ? c.email : '')}"></div><div class="fg"><label>Imobiliária</label><input type="text" id="cfImob" value="${esc(c ? c.imobiliaria : '')}"></div></div>
    <label class="check"><input type="checkbox" id="cfAtivo" ${!c || c.ativo !== false ? 'checked' : ''}> Ativo</label>`;
  openModal({ title: c ? '✏️ Corretor' : '＋ Novo corretor', body, footer: `${c ? `<button class="btn btn-outline-danger" onclick="removeRec('corretores','${c.id}');closeModal();renderCurrent()">Excluir</button>` : ''}<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="salvarCorretor('${c ? c.id : ''}')">Salvar</button>` });
}
function salvarCorretor(id) {
  if (!val('cfNome') || !val('cfTel')) { toast('⚠️', 'Informe nome e telefone', '', true); return; }
  const prev = id ? db.corretores.find(x => x.id === id) : null;
  upsert('corretores', Object.assign({}, prev || { id: genId(), criadoEm: new Date().toISOString() }, { nome: val('cfNome'), creci: val('cfCreci'), telefone: val('cfTel'), email: val('cfEmail'), imobiliaria: val('cfImob'), ativo: checked('cfAtivo') }));
  closeModal(); renderCurrent(); toast('✅', 'Corretor salvo', '');
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
  upsert('categorias', Object.assign({}, prev || { id: genId() }, { nome: val('ctNome'), cor: val('ctCor') })); closeModal(); renderCurrent();
}
function excluirCategoria(id) {
  if (db.custos.some(x => x.categoriaId === id)) { toast('⚠️', 'Categoria em uso por lançamentos', '', true); return; }
  if (!confirm('Excluir categoria?')) return; removeRec('categorias', id); closeModal(); renderCurrent();
}
function cadConfigHtml() {
  const c = db.config;
  return `<div class="card"><h3>⚙️ Configurações gerais</h3>
    <div class="frow"><div class="fg"><label>Nome da empresa / incorporadora</label><input type="text" id="cgEmpresa" value="${esc(c.empresa)}"></div><div class="fg"><label>WhatsApp da administração</label><input type="tel" id="cgWa" value="${esc(c.adminWhatsapp)}" placeholder="(00) 00000-0000"><div class="hint">Corretores podem avisar você pelo WhatsApp ao pedir reserva.</div></div></div>
    <div class="frow3"><div class="fg"><label>Validade da reserva (dias)</label><input type="number" id="cgDias" value="${c.reservaDias}"></div><div class="fg"><label>Comissão padrão (%)</label><input type="number" id="cgCom" step="0.1" value="${c.comissaoPct}"></div><div class="fg"><label>Multa por atraso (%)</label><input type="number" id="cgMulta" step="0.1" value="${c.multaPct}"></div></div>
    <div class="frow"><div class="fg"><label>Juros de mora (% ao mês)</label><input type="number" id="cgJuros" step="0.01" value="${c.jurosMesPct}"></div><div class="fg"><label>Corretor vê preço de lotes vendidos?</label><select id="cgMostra"><option value="1" ${c.mostrarPrecoVendido ? 'selected' : ''}>Sim</option><option value="0" ${!c.mostrarPrecoVendido ? 'selected' : ''}>Não</option></select></div></div>
    <button class="btn btn-primary" onclick="salvarConfig()">Salvar configurações</button></div>
    <div class="card"><h3>🏢 Dados da empresa</h3>
    <p class="help">CNPJ, endereço, quem assina e os outros CNPJs do grupo ficam em <b><a href="#" onclick="state.sub.cad='empresa';renderCurrent();return false">Configurações › Dados da empresa</a></b>.</p></div>
    ${Cloud.active ? '' : `<div class="card"><h3>🔐 Acesso</h3>
    <div class="frow"><div class="fg"><label>Novo PIN do administrador</label><input type="password" inputmode="numeric" id="cgPin" placeholder="mín. 4 dígitos" autocomplete="new-password"><div class="hint">${c.pinPadrao ? '<b style="color:#b45309">Você ainda usa o PIN padrão 1234. Troque agora.</b>' : 'PIN personalizado ativo.'}</div></div>
      <div class="fg"><label>Código de acesso dos corretores</label><input type="text" id="cgCod" value="${esc(c.codigoCorretor)}" placeholder="vazio = acesso livre"><div class="hint">Se definido, o corretor precisa digitar este código na primeira vez que abrir o app.</div></div></div>
    <button class="btn btn-primary" onclick="salvarAcesso()">Salvar acesso</button>
    <p class="help mt">⚠️ Este controle de acesso é simples (sem servidor). Serve para organizar o uso, não para proteger dados sigilosos.</p></div>`}`;
}
function salvarConfig() {
  setConfig({ empresa: val('cgEmpresa'), adminWhatsapp: val('cgWa'), reservaDias: Math.max(1, Math.round(num(val('cgDias')) || 7)), comissaoPct: num(val('cgCom')), multaPct: num(val('cgMulta')), jurosMesPct: num(val('cgJuros')), mostrarPrecoVendido: val('cgMostra') === '1' });
  toast('✅', 'Configurações salvas', ''); renderCurrent();
}
function salvarAcesso() {
  const pin = val('cgPin'); const patch = { codigoCorretor: val('cgCod') };
  if (pin) { if (pin.length < 4) { toast('⚠️', 'PIN muito curto', '', true); return; } patch.adminPin = hashStr(pin); patch.pinPadrao = false; }
  setConfig(patch); toast('✅', 'Acesso atualizado', pin ? 'Novo PIN ativo.' : ''); renderCurrent();
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

