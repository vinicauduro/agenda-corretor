/* ===== Gestão de Loteamento — financeiro (recebíveis, custos, comissões, gráficos) ===== */
'use strict';

// ================================================================ RECEBÍVEIS
/* O filtro dos recebíveis nasce aqui, não dentro da tela. Quem entra direto no painel de
   cobrança — pelo alerta do painel, por exemplo — nunca passou pela lista, e mexer num
   filtro que ainda não existia quebrava o clique em silêncio: a tela parecia travada. */
function filtroRec() {
  return (state.filters.rec = Object.assign({ status: 'aberto', mes: mesAtual(), busca: '' }, state.filters.rec || {}));
}
function mostrarRecebiveis(st) {
  const f = filtroRec();
  if (st) f.status = st;
  state.sub.rec = 'lista';
  switchTab('recebiveis');
}
function abrirPainelCobranca() { filtroRec(); state.sub.rec = 'cobranca'; switchTab('recebiveis'); }
function renderRecebiveis() {
  const esc0 = escopoAtual(); const v = $('#av-recebiveis');
  /* A tela abre no mês corrente, não na carteira inteira: um loteamento com trezentas
     parcelas vira uma lista que ninguém lê. O extrato completo de um contrato fica na tela
     da venda, e quem quiser tudo aqui escolhe "Todos os meses". */
  const f = filtroRec();
  const all = recebiveisDo(esc0);
  const grupos = { aberto: r => recStatus(r) !== 'pago', atrasado: r => recStatus(r) === 'atrasado', pago: r => recStatus(r) === 'pago', all: () => true };
  const meses = [...new Set(all.map(r => monthKey(r.vencimento)).concat([mesAtual()]))].sort();
  /* Atraso não é do mês: parcela vencida em julho continua atrasada em setembro. Nesse
     filtro o mês é ignorado, senão o que a empresa mais precisa ver ficaria escondido. */
  const porMes = r => f.status === 'atrasado' || f.mes === 'all' || monthKey(r.vencimento) === f.mes;
  const list = all.filter(r => grupos[f.status](r) && porMes(r) && (!f.busca || clienteDe(r).toLowerCase().includes(f.busca.toLowerCase())))
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.numero - b.numero);
  const tot = all.reduce((s, r) => s + recValor(r), 0), pago = all.reduce((s, r) => s + num(r.valorPago), 0);
  const atr = all.filter(r => recStatus(r) === 'atrasado').reduce((s, r) => s + recRestante(r), 0);
  const mesKey = todayStr().slice(0, 7);
  const mes = all.filter(r => monthKey(r.vencimento) === mesKey && recStatus(r) !== 'pago').reduce((s, r) => s + recRestante(r), 0);
  const recMes = all.filter(r => r.dataPagamento && monthKey(r.dataPagamento) === mesKey).reduce((s, r) => s + num(r.valorPago), 0);
  const somaLista = list.reduce((s, r) => s + (f.status === 'pago' ? num(r.valorPago) : recRestante(r)), 0);
  v.innerHTML = `
    ${avisoRemessaHtml(esc0)}
    <div class="kpi-grid">
      <div class="kpi c-amber"><div class="lbl">A receber</div><div class="val">${fmtMoneyShort(tot - pago)}</div><div class="sub">de ${fmtMoneyShort(tot)} contratado</div></div>
      <div class="kpi c-green"><div class="lbl">Recebido</div><div class="val">${fmtMoneyShort(pago)}</div><div class="sub">${fmtMoneyShort(recMes)} neste mês</div></div>
      <div class="kpi c-red"><div class="lbl">Em atraso</div><div class="val">${fmtMoneyShort(atr)}</div><div class="sub">${all.filter(r => recStatus(r) === 'atrasado').length} parcela(s)</div></div>
      <div class="kpi c-blue"><div class="lbl">Vence este mês</div><div class="val">${fmtMoneyShort(mes)}</div><div class="sub">${monthLabel(mesKey)}</div></div>
    </div>
    <div class="chips">${[['aberto', 'Em aberto'], ['atrasado', 'Atrasados'], ['pago', 'Pagos'], ['all', 'Todos']].map(([k, l]) => `<div class="chip ${f.status === k ? 'active' : ''}" onclick="mostrarRecebiveis('${k}')">${l}<span class="n">${all.filter(grupos[k]).length}</span></div>`).join('')}
      <div class="chip" onclick="abrirPainelCobranca()">🔔 Cobrança<span class="n">${inadimplentes(esc0).length}</span></div>
      ${contasComLayout().length ? `<div class="chip" onclick="abrirGerarCobrancas()">🧾 Gerar cobranças<span class="n">${parcelasDoMes(esc0, mesAtual()).filter(r => !registradaNoBanco(r) && !bloqueioRemessa(r)).length}</span></div>
      <div class="chip" onclick="abrirRetorno()">📥 Retorno</div>` : ''}</div>
    <div class="filters">
      ${escopoSelectHtml('renderRecebiveis()')}
      <select onchange="filtroRec().mes=this.value;renderRecebiveis()"><option value="all">Todos os meses</option>${meses.map(m => `<option value="${m}" ${f.mes === m ? 'selected' : ''}>${monthLabel(m)}${m === mesAtual() ? ' (mês atual)' : ''}</option>`).join('')}</select>
      <input type="text" placeholder="🔎 Cliente ou lote" value="${esc(f.busca)}" oninput="aSetFiltro('rec','busca',this.value,renderRecebiveis,this)">
      <button class="btn btn-secondary btn-sm" onclick="exportarRecebiveisCSV()">⬇️ CSV</button>
    </div>
    <p class="small muted mb">${list.length} parcela(s) · ${fmtMoney(somaLista)}${f.status === 'atrasado' ? ' · atrasos de todos os meses' : f.mes !== 'all' ? ` · ${monthLabel(f.mes)}. O extrato completo de um contrato fica na tela da venda.` : ''}</p>
    ${list.length ? list.map(r => recRowHtml(r)).join('') : `<div class="empty"><div class="ic">📆</div><p>Nenhuma parcela nesta lista.</p></div>`}`;
}
function clienteDe(r) { const v = getVenda(r.vendaId); if (!v) return ''; return v.cliente.nome + ' ' + imovelLabel(v); }
function recRowHtml(r) {
  const v = getVenda(r.vendaId); const st = recStatus(r);
  const rest = recRestante(r);
  return `<div class="item ${st}" onclick="abrirVendaAdmin('${r.vendaId}')">
    <div class="info"><div class="title">${v ? esc(v.cliente.nome) : '—'} <span class="tiny muted">· ${v ? esc(imovelShort(v)) : ''}</span></div>
      <div class="meta"><span>${esc(r.descricao)}</span><span>· vence ${fmtDate(r.vencimento)}</span>${recCorrecao(r) > 0.005 && st !== 'pago' ? `<span title="Correção pelo índice do contrato">· base ${fmtMoney(r.valor)} + ${fmtMoney(recCorrecao(r))} de correção</span>` : ''}${st === 'atrasado' ? `<span style="color:var(--danger)">· ${daysBetween(r.vencimento, todayStr())} dias · atualizado ${fmtMoney(recAtualizado(r))}</span>` : ''}${st === 'pago' && r.dataPagamento ? `<span>· pago em ${fmtDate(r.dataPagamento)}${r.forma ? ' (' + esc(r.forma) + ')' : ''}</span>` : ''}${st === 'parcial' ? `<span>· pago ${fmtMoney(r.valorPago)}, resta ${fmtMoney(rest)}</span>` : ''}</div></div>
    <div class="side"><div class="value">${fmtMoney(st === 'pago' ? r.valorPago : rest)}</div><span class="badge ${st}">${statusLabel(st)}</span>
      <div class="btns" onclick="event.stopPropagation()">${st !== 'pago' && v && v.status !== 'distrato' && pode('financeiro.baixar') ? `<button class="btn-icon ok" title="Registrar pagamento" onclick="abrirPagamento('${r.id}')">💵</button>` : ''}${pode('financeiro.baixar') ? `<button class="btn-icon" title="Editar" onclick="editarRecebivel('${r.id}')">✏️</button>` : ''}</div></div></div>`;
}
function abrirPagamento(id, voltarVendaId) {
  const r = db.recebiveis.find(x => x.id === id); if (!r) return;
  const v = getVenda(r.vendaId); const rest = recRestante(r); const atual = recAtualizado(r);
  const body = `<p class="small mb"><b>${v ? esc(v.cliente.nome) : ''}</b> · ${esc(r.descricao)} · vencimento ${fmtDate(r.vencimento)}</p>
    <div class="detail-grid"><div><div class="k">Valor da parcela</div><div class="v">${fmtMoney(recValor(r))}${recCorrecao(r) > 0.005 ? `<div class="tiny muted">base ${fmtMoney(r.valor)} + ${fmtMoney(recCorrecao(r))} de correção</div>` : ''}</div></div><div><div class="k">Em aberto</div><div class="v">${fmtMoney(rest)}</div></div>${atual > rest + 0.01 ? `<div class="full"><div class="k">Com multa e juros (${fmtNum(db.config.multaPct, 1)}% + ${fmtNum(db.config.jurosMesPct, 2)}% a.m.)</div><div class="v" style="color:var(--danger)">${fmtMoney(atual)}</div></div>` : ''}</div>
    <div class="frow"><div class="fg"><label>Valor recebido (R$) *</label><input type="number" id="pgValor" step="0.01" value="${Math.round(rest * 100) / 100}"></div><div class="fg"><label>Data do pagamento *</label><input type="date" id="pgData" value="${todayStr()}"></div></div>
    <div class="frow"><div class="fg"><label>Forma</label><select id="pgForma"><option>PIX</option><option>Boleto</option><option>Transferência</option><option>Dinheiro</option><option>Cartão</option><option>Cheque</option><option>Permuta</option></select></div><div class="fg"><label>&nbsp;</label>${atual > rest + 0.01 ? `<button class="btn btn-outline btn-sm" onclick="setVal('pgValor',${Math.round(atual * 100) / 100})">Usar valor c/ juros</button>` : ''}</div></div>
    <div class="fg"><label>Observação</label><input type="text" id="pgObs" value="${esc(r.obsPagamento || '')}"></div>`;
  openModal({ title: '💵 Registrar pagamento', body, footer: `<button class="btn btn-secondary" onclick="${voltarVendaId ? `abrirVendaAdmin('${voltarVendaId}')` : 'closeModal()'}">Cancelar</button><button class="btn btn-success" onclick="salvarPagamento('${r.id}','${voltarVendaId || ''}')">Confirmar</button>` });
}
function salvarPagamento(id, voltarVendaId) {
  if (!pode('financeiro.baixar')) { toast('🔒', 'Sem permissão', 'Seu perfil não registra pagamentos.', true); return; }
  const r = db.recebiveis.find(x => x.id === id); if (!r) return;
  const valor = num(val('pgValor')), data = val('pgData');
  if (!valor || !data) { toast('⚠️', 'Informe valor e data', '', true); return; }
  const novoPago = num(r.valorPago) + valor;
  // se pagou a mais (juros/multa), registra o valor efetivamente recebido e considera quitada
  const devido = recValor(r);
  const quitou = novoPago >= devido - 0.005;
  const upd = Object.assign({}, r, { valorPago: novoPago, dataPagamento: data, forma: val('pgForma'), obsPagamento: val('pgObs'),
    valorCorrigido: quitou ? Math.round(Math.max(devido, novoPago) * 100) / 100 : (r.valorCorrigido || null) });
  upsert('recebiveis', upd);
  atualizarStatusVenda(r.vendaId);
  const v = getVenda(r.vendaId);
  logAct(`Pagamento recebido: ${v ? v.cliente.nome : ''} — ${r.descricao} — ${fmtMoney(valor)}`);
  toast('✅', 'Pagamento registrado', fmtMoney(valor));
  if (voltarVendaId) abrirVendaAdmin(voltarVendaId); else closeModal();
  renderCurrent();
}
function estornarPagamento(id, voltarVendaId) {
  const r = db.recebiveis.find(x => x.id === id); if (!r) return;
  if (!confirm('Estornar o pagamento desta parcela? Ela voltará a ficar em aberto.')) return;
  upsert('recebiveis', Object.assign({}, r, { valorPago: 0, dataPagamento: null, forma: null }));
  atualizarStatusVenda(r.vendaId);
  logAct(`Pagamento estornado: ${r.descricao}`);
  if (voltarVendaId) abrirVendaAdmin(voltarVendaId); else closeModal();
  renderCurrent();
}
function editarRecebivel(id, voltarVendaId) {
  const r = db.recebiveis.find(x => x.id === id); if (!r) return;
  const body = `<div class="fg"><label>Descrição</label><input type="text" id="erDesc" value="${esc(r.descricao)}"></div>
    <div class="frow"><div class="fg"><label>Vencimento</label><input type="date" id="erVenc" value="${r.vencimento}"></div><div class="fg"><label>Valor base (R$)</label><input type="number" id="erValor" step="0.01" value="${r.valor}">${recCorrecao(r) > 0.005 ? `<div class="hint">Com a correção do contrato: ${fmtMoney(recValor(r))}</div>` : ''}</div></div>
    <div class="frow"><div class="fg"><label>Valor pago (R$)</label><input type="number" id="erPago" step="0.01" value="${r.valorPago || 0}"></div><div class="fg"><label>Data do pagamento</label><input type="date" id="erData" value="${r.dataPagamento || ''}"></div></div>`;
  openModal({ title: '✏️ Editar parcela', body, footer: `<button class="btn btn-outline-danger" onclick="excluirRecebivel('${r.id}','${voltarVendaId || ''}')">Excluir</button><button class="btn btn-secondary" onclick="${voltarVendaId ? `abrirVendaAdmin('${voltarVendaId}')` : 'closeModal()'}">Cancelar</button><button class="btn btn-primary" onclick="salvarRecebivel('${r.id}','${voltarVendaId || ''}')">Salvar</button>` });
}
function salvarRecebivel(id, voltarVendaId) {
  const r = db.recebiveis.find(x => x.id === id); if (!r) return;
  upsert('recebiveis', Object.assign({}, r, { descricao: val('erDesc') || r.descricao, vencimento: val('erVenc') || r.vencimento, valor: num(val('erValor')), valorPago: num(val('erPago')), dataPagamento: val('erData') || null }));
  atualizarStatusVenda(r.vendaId);
  if (voltarVendaId) abrirVendaAdmin(voltarVendaId); else closeModal();
  renderCurrent(); toast('✅', 'Parcela atualizada', '');
}
function excluirRecebivel(id, voltarVendaId) {
  const r = db.recebiveis.find(x => x.id === id); if (!r) return;
  if (registradaNoBanco(r) && recStatus(r) !== 'pago') { toast('🏦', 'Esta parcela está registrada no banco', 'Zere o valor ou marque como paga para gerar a baixa na remessa; depois exclua.', true); return; }
  if (!confirm('Excluir esta parcela do cronograma?')) return;
  removeRec('recebiveis', id); atualizarStatusVenda(r.vendaId);
  if (voltarVendaId) abrirVendaAdmin(voltarVendaId); else closeModal();
  renderCurrent();
}
function exportarRecebiveisCSV() {
  const esc0 = escopoAtual(); const rows = [['Cliente', 'Imóvel', 'Parcela', 'Vencimento', 'Valor', 'Pago', 'Data pagamento', 'Forma', 'Status']];
  recebiveisDo(esc0).sort((a, b) => a.vencimento.localeCompare(b.vencimento)).forEach(r => { const v = getVenda(r.vendaId); rows.push([v ? v.cliente.nome : '', v ? imovelShort(v) : '', r.descricao, fmtDate(r.vencimento), fmtNum(recValor(r)), fmtNum(r.valorPago), r.dataPagamento ? fmtDate(r.dataPagamento) : '', r.forma || '', statusLabel(recStatus(r))]); });
  download(`recebiveis-${todayStr()}.csv`, toCSV(rows), 'text/csv');
}

// ================================================================ EXTRATO
function extratoTexto(v) {
  const lot = getLoteamento(v.loteamentoId); const r = vendaResumo(v);
  const abertas = recebiveisDe(v.id).filter(x => recStatus(x) !== 'pago');
  let t = `*${lot ? lot.nome : ''}* — ${imovelLabel(v)}\nCliente: ${v.cliente.nome}\nValor: ${fmtMoney(v.valorTotal)} · Pago: ${fmtMoney(r.pago)} · Saldo: ${fmtMoney(r.restante)}`;
  if (abertas.length) t += `\n\nPróximas parcelas:\n` + abertas.slice(0, 6).map(x => `• ${x.descricao} — ${fmtDate(x.vencimento)} — ${fmtMoney(recRestante(x))}${recStatus(x) === 'atrasado' ? ' (em atraso)' : ''}`).join('\n');
  return t;
}
function imprimirExtrato(vendaId) {
  const v = getVenda(vendaId); if (!v) return; const lot = getLoteamento(v.loteamentoId); const r = vendaResumo(v);
  const recs = recebiveisDe(v.id);
  $('#printArea').innerHTML = `
    <h1>${esc(db.config.empresa || lot.nome)}</h1><div>${esc(lot.nome)}${lot.cidade ? ' · ' + esc(lot.cidade) : ''}</div>
    <h2>Extrato de pagamentos — ${esc(imovelLabel(v))}</h2>
    <table><tr><th>Cliente</th><td>${esc(v.cliente.nome)}</td><th>CPF/CNPJ</th><td>${esc(fmtCPF(v.cliente.cpf))}</td></tr>
    <tr><th>Data da venda</th><td>${fmtDate(v.dataVenda)}</td><th>Valor</th><td>${fmtMoney(v.valorTotal)}</td></tr>
    <tr><th>Recebido</th><td>${fmtMoney(r.pago)}</td><th>Saldo devedor</th><td>${fmtMoney(r.restante)}</td></tr>
    <tr><th>Corretor</th><td>${esc(v.corretor.nome)}</td><th>Emitido em</th><td>${fmtDate(todayStr())}</td></tr></table>
    <h2>Parcelas</h2>
    <table><thead><tr><th>Parcela</th><th>Vencimento</th><th class="num">Valor</th><th class="num">Pago</th><th>Data pgto</th><th>Forma</th><th>Situação</th></tr></thead>
    <tbody>${recs.map(x => `<tr><td>${esc(x.descricao)}</td><td>${fmtDate(x.vencimento)}</td><td class="num">${fmtMoney(recValor(x))}</td><td class="num">${x.valorPago ? fmtMoney(x.valorPago) : ''}</td><td>${x.dataPagamento ? fmtDate(x.dataPagamento) : ''}</td><td>${esc(x.forma || '')}</td><td>${statusLabel(recStatus(x))}</td></tr>`).join('')}</tbody>
    <tfoot><tr><th colspan="2">Total</th><th class="num">${fmtMoney(r.total)}</th><th class="num">${fmtMoney(r.pago)}</th><th colspan="3"></th></tr></tfoot></table>
    ${v.obs ? `<p style="margin-top:10px"><b>Observações:</b> ${esc(v.obs)}</p>` : ''}`;
  window.print();
}

// ================================================================ CUSTOS
function aSetFiltroCusto(st) { state.filters.custos = Object.assign(state.filters.custos || {}, { status: st }); switchTab('custos'); }
function renderCustos(alvo) {
  const lot = curLot(); const v = alvo || alvoDoEmp('av-custos');
  const f = state.filters.custos = state.filters.custos || { status: 'all', cat: 'all', mes: 'all', busca: '' };
  const all = custosDo(lot.id);
  const meses = [...new Set(all.map(c => monthKey(c.dataCompetencia)))].sort().reverse();
  const list = all.filter(c => (f.status === 'all' || custoStatus(c) === f.status) && (f.cat === 'all' || c.categoriaId === f.cat) && (f.mes === 'all' || monthKey(c.dataCompetencia) === f.mes) && (!f.busca || (c.descricao + ' ' + (c.fornecedor || '')).toLowerCase().includes(f.busca.toLowerCase())))
    .sort((a, b) => (b.dataCompetencia || '').localeCompare(a.dataCompetencia || ''));
  const tot = all.reduce((s, c) => s + num(c.valor), 0), pago = all.filter(c => c.status === 'pago').reduce((s, c) => s + num(c.valor), 0);
  const atr = all.filter(c => custoStatus(c) === 'atrasado').reduce((s, c) => s + num(c.valor), 0);
  const prox = all.filter(c => c.status !== 'pago' && c.vencimento && c.vencimento >= todayStr() && daysBetween(todayStr(), c.vencimento) <= 30).reduce((s, c) => s + num(c.valor), 0);
  const orcTotal = Object.values(lot.orcamento || {}).reduce((s, x) => s + num(x), 0);
  const porCat = {}; all.forEach(c => { porCat[c.categoriaId] = (porCat[c.categoriaId] || 0) + num(c.valor); });
  const catData = Object.entries(porCat).map(([id, value]) => { const c = getCategoria(id); return { label: c ? c.nome : 'Sem categoria', color: c ? c.cor : '#94a3b8', value }; }).sort((a, b) => b.value - a.value);
  v.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi c-primary"><div class="lbl">Total de custos</div><div class="val">${fmtMoneyShort(tot)}</div><div class="sub">${orcTotal ? Math.round(tot / orcTotal * 100) + '% do orçamento (' + fmtMoneyShort(orcTotal) + ')' : all.length + ' lançamento(s)'}</div></div>
      <div class="kpi c-green"><div class="lbl">Pago</div><div class="val">${fmtMoneyShort(pago)}</div></div>
      <div class="kpi c-amber"><div class="lbl">A pagar</div><div class="val">${fmtMoneyShort(tot - pago)}</div><div class="sub">${fmtMoneyShort(prox)} nos próximos 30 dias</div></div>
      <div class="kpi c-red"><div class="lbl">Vencidos</div><div class="val">${fmtMoneyShort(atr)}</div><div class="sub">${all.filter(c => custoStatus(c) === 'atrasado').length} conta(s)</div></div>
    </div>
    <div class="grid2">
      <div class="card"><h3>Custos por categoria</h3><canvas class="chart" id="chartCustos" height="190"></canvas><div class="legend-list" id="chartCustosLegend"></div></div>
      <div class="card"><h3>Orçado × realizado <span class="h-actions"><button class="btn btn-secondary btn-sm" onclick="abrirOrcamentoForm()">✏️</button></span></h3>
        ${db.categorias.filter(c => num((lot.orcamento || {})[c.id]) > 0).map(c => { const o = lot.orcamento[c.id]; const real = porCat[c.id] || 0; const pct = Math.round(real / o * 100); return `<div class="mb"><div class="row-between small"><span><span class="dot" style="background:${c.cor}"></span> ${esc(c.nome)}</span><span class="muted">${fmtMoneyShort(real)} / ${fmtMoneyShort(o)} · ${pct}%</span></div><div class="progress"><div class="${pct > 100 ? 'over' : pct >= 90 ? 'warn' : ''}" style="width:${Math.min(100, pct)}%"></div></div></div>`; }).join('') || '<p class="help">Defina o orçamento por categoria para acompanhar aqui.</p>'}</div>
    </div>
    <div class="chips">${[['all', 'Todos'], ['pendente', 'A pagar'], ['atrasado', 'Vencidos'], ['pago', 'Pagos']].map(([k, l]) => `<div class="chip ${f.status === k ? 'active' : ''}" onclick="state.filters.custos.status='${k}';renderCustos()">${l}<span class="n">${k === 'all' ? all.length : all.filter(c => custoStatus(c) === k).length}</span></div>`).join('')}</div>
    <div class="filters">
      <select onchange="state.filters.custos.cat=this.value;renderCustos()"><option value="all">Todas as categorias</option>${db.categorias.map(c => `<option value="${c.id}" ${f.cat === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select>
      <select onchange="state.filters.custos.mes=this.value;renderCustos()"><option value="all">Todos os meses</option>${meses.map(m => `<option value="${m}" ${f.mes === m ? 'selected' : ''}>${monthLabel(m)}</option>`).join('')}</select>
      <input type="text" placeholder="🔎 Descrição ou fornecedor" value="${esc(f.busca)}" oninput="aSetFiltro('custos','busca',this.value,renderCustos,this)">
      <button class="btn btn-primary btn-sm" onclick="abrirCustoForm()">＋ Lançar</button>
    </div>
    <p class="small muted mb">${list.length} lançamento(s) · ${fmtMoney(list.reduce((s, c) => s + num(c.valor), 0))}</p>
    ${list.length ? list.map(c => custoRowHtml(c)).join('') : `<div class="empty"><div class="ic">🧾</div><p>Nenhum custo lançado.<br>Toque em <b>Lançar</b> para registrar despesas da obra, documentação, marketing…</p></div>`}`;
  drawDonut($('#chartCustos'), $('#chartCustosLegend'), catData, true);
}
function custoRowHtml(c) {
  const st = custoStatus(c); const cat = getCategoria(c.categoriaId);
  return `<div class="item ${st}" onclick="abrirCustoForm('${c.id}')">
    <div class="info"><div class="title">${esc(c.descricao)}</div>
      <div class="meta"><span class="badge" style="background:${cat ? cat.cor : '#94a3b8'};color:white">${cat ? esc(cat.nome) : 'Sem categoria'}</span>${c.fornecedor ? `<span>· ${esc(c.fornecedor)}</span>` : ''}<span>· ${fmtDate(c.dataCompetencia)}</span>${c.vencimento && st !== 'pago' ? `<span ${st === 'atrasado' ? 'style="color:var(--danger)"' : ''}>· vence ${fmtDate(c.vencimento)}</span>` : ''}${st === 'pago' && c.dataPagamento ? `<span>· pago em ${fmtDate(c.dataPagamento)}</span>` : ''}</div></div>
    <div class="side"><div class="value">${fmtMoney(c.valor)}</div><span class="badge ${st}">${statusLabel(st)}</span>
      <div class="btns" onclick="event.stopPropagation()">${st !== 'pago' ? `<button class="btn-icon ok" title="Marcar como pago" onclick="pagarCusto('${c.id}')">💵</button>` : ''}<button class="btn-icon del" onclick="excluirCusto('${c.id}')">🗑️</button></div></div></div>`;
}
function abrirCustoForm(id) {
  const lot = curLot(); const c = id ? db.custos.find(x => x.id === id) : null;
  const fornecedores = [...new Set(db.custos.map(x => x.fornecedor).filter(Boolean))].sort(naturalCmp);
  const body = `<div class="fg"><label>Descrição *</label><input type="text" id="cuDesc" value="${esc(c ? c.descricao : '')}" placeholder="Ex.: Pavimentação — 2ª medição"></div>
    <div class="frow"><div class="fg"><label>Categoria *</label><select id="cuCat">${optionsHtml(db.categorias, c ? c.categoriaId : db.categorias[0].id)}</select></div><div class="fg"><label>Fornecedor</label><input type="text" id="cuForn" list="fornList" value="${esc(c ? c.fornecedor || '' : '')}"><datalist id="fornList">${fornecedores.map(f => `<option value="${esc(f)}">`).join('')}</datalist></div></div>
    <div class="frow"><div class="fg"><label>Valor (R$) *</label><input type="number" id="cuValor" step="0.01" value="${c ? c.valor : ''}"></div><div class="fg"><label>Forma de pagamento</label><select id="cuForma">${['PIX', 'Boleto', 'Transferência', 'Dinheiro', 'Cartão', 'Cheque', 'Permuta'].map(o => `<option ${c && c.formaPagamento === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div></div>
    <div class="frow"><div class="fg"><label>Competência *</label><input type="date" id="cuComp" value="${c ? c.dataCompetencia : todayStr()}"></div><div class="fg"><label>Vencimento</label><input type="date" id="cuVenc" value="${c ? c.vencimento || '' : ''}"></div></div>
    <div class="frow"><div class="fg"><label>Status</label><select id="cuStatus" onchange="document.getElementById('cuDataPg').parentElement.style.display=this.value==='pago'?'':'none'"><option value="pendente" ${!c || c.status !== 'pago' ? 'selected' : ''}>A pagar</option><option value="pago" ${c && c.status === 'pago' ? 'selected' : ''}>Pago</option></select></div><div class="fg" style="${c && c.status === 'pago' ? '' : 'display:none'}"><label>Data do pagamento</label><input type="date" id="cuDataPg" value="${c ? c.dataPagamento || todayStr() : todayStr()}"></div></div>
    <div class="fg"><label>Lote (opcional)</label><select id="cuLote"><option value="">— Custo geral do loteamento —</option>${optionsHtml(lotesDo(lot.id), c ? c.loteId || '' : '', l => loteLabel(l))}</select></div>
    <div class="fg"><label>Observações</label><textarea id="cuObs">${esc(c ? c.obs || '' : '')}</textarea></div>`;
  openModal({ title: c ? '✏️ Editar custo' : '🧾 Lançar custo', body, footer: `${c ? `<button class="btn btn-outline-danger" onclick="excluirCusto('${c.id}')">Excluir</button>` : ''}<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="salvarCusto('${c ? c.id : ''}')">Salvar</button>` });
  setTimeout(() => $('#cuDesc').focus(), 60);
}
function salvarCusto(id) {
  const lot = curLot(); const prev = id ? db.custos.find(x => x.id === id) : null;
  if (!val('cuDesc') || !num(val('cuValor')) || !val('cuComp')) { toast('⚠️', 'Preencha descrição, valor e competência', '', true); return; }
  const st = val('cuStatus');
  const rec = Object.assign({}, prev || { id: genId(), loteamentoId: lot.id, criadoEm: new Date().toISOString() }, { descricao: val('cuDesc'), categoriaId: val('cuCat'), fornecedor: val('cuForn'), valor: num(val('cuValor')), formaPagamento: val('cuForma'), dataCompetencia: val('cuComp'), vencimento: val('cuVenc') || null, status: st, dataPagamento: st === 'pago' ? (val('cuDataPg') || todayStr()) : null, loteId: val('cuLote') || null, obs: val('cuObs') });
  upsert('custos', rec);
  if (!prev) logAct(`Custo lançado: ${rec.descricao} — ${fmtMoney(rec.valor)}`);
  closeModal(); renderCurrent(); toast('✅', 'Custo salvo', rec.descricao);
}
function pagarCusto(id) {
  const c = db.custos.find(x => x.id === id); if (!c) return;
  const data = prompt('Data do pagamento (AAAA-MM-DD):', todayStr()); if (data === null) return;
  upsert('custos', Object.assign({}, c, { status: 'pago', dataPagamento: /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : todayStr() }));
  logAct(`Custo pago: ${c.descricao} — ${fmtMoney(c.valor)}`); renderCurrent(); toast('✅', 'Marcado como pago', '');
}
function excluirCusto(id) {
  const c = db.custos.find(x => x.id === id); if (!c) return;
  if (!confirm(`Excluir "${c.descricao}"?`)) return;
  removeRec('custos', id); closeModal(); renderCurrent();
}
function exportarCustosCSV() {
  const lot = curLot(); const rows = [['Descrição', 'Categoria', 'Fornecedor', 'Valor', 'Competência', 'Vencimento', 'Status', 'Pagamento', 'Forma', 'Lote', 'Obs']];
  custosDo(lot.id).sort((a, b) => a.dataCompetencia.localeCompare(b.dataCompetencia)).forEach(c => { const cat = getCategoria(c.categoriaId); const l = c.loteId && getLote(c.loteId); rows.push([c.descricao, cat ? cat.nome : '', c.fornecedor || '', fmtNum(c.valor), fmtDate(c.dataCompetencia), c.vencimento ? fmtDate(c.vencimento) : '', statusLabel(custoStatus(c)), c.dataPagamento ? fmtDate(c.dataPagamento) : '', c.formaPagamento || '', l ? loteShort(l) : '', c.obs || '']); });
  download(`custos-${todayStr()}.csv`, toCSV(rows), 'text/csv');
}

// ================================================================ COMISSÕES
function renderComissoes(v, f) {
  const lot = curLot();
  const vendas = db.vendas.filter(x => x.loteamentoId === lot.id && x.status !== 'distrato').sort((a, b) => (b.dataVenda || '').localeCompare(a.dataVenda || ''));
  const tot = vendas.reduce((s, x) => s + num(x.comissaoValor), 0), pago = vendas.filter(x => x.comissaoPaga).reduce((s, x) => s + num(x.comissaoValor), 0);
  const porCorretor = {};
  vendas.forEach(x => { const k = x.corretor.nome || 'Venda direta'; porCorretor[k] = porCorretor[k] || { n: 0, tot: 0, pago: 0 }; porCorretor[k].n++; porCorretor[k].tot += num(x.comissaoValor); if (x.comissaoPaga) porCorretor[k].pago += num(x.comissaoValor); });
  v.innerHTML = `
    <div class="subtabs"><div class="chip" onclick="state.filters.avendas.sub='vendas';renderAVendas()">💰 Vendas</div><div class="chip active">🤝 Comissões</div></div>
    <div class="kpi-grid cols3"><div class="kpi c-primary"><div class="lbl">Total de comissões</div><div class="val">${fmtMoneyShort(tot)}</div></div><div class="kpi c-green"><div class="lbl">Pagas</div><div class="val">${fmtMoneyShort(pago)}</div></div><div class="kpi c-amber"><div class="lbl">A pagar</div><div class="val">${fmtMoneyShort(tot - pago)}</div></div></div>
    <div class="card"><h3>Por corretor</h3><div class="table-wrap"><table class="tbl"><thead><tr><th>Corretor</th><th class="num">Vendas</th><th class="num">Comissões</th><th class="num">Pagas</th><th class="num">A pagar</th></tr></thead><tbody>${Object.entries(porCorretor).sort((a, b) => b[1].tot - a[1].tot).map(([k, s]) => `<tr><td>${esc(k)}</td><td class="num">${s.n}</td><td class="num">${fmtMoney(s.tot)}</td><td class="num">${fmtMoney(s.pago)}</td><td class="num"><b>${fmtMoney(s.tot - s.pago)}</b></td></tr>`).join('') || '<tr><td colspan="5" class="muted">Sem vendas.</td></tr>'}</tbody></table></div></div>
    ${vendas.map(x => { const r = vendaResumo(x); return `<div class="item ${x.comissaoPaga ? 'pago' : 'pendente'}" onclick="abrirVendaAdmin('${x.id}')"><div class="info"><div class="title">${esc(x.corretor.nome)} <span class="tiny muted">· ${esc(imovelShort(x))} · ${esc(x.cliente.nome)}</span></div><div class="meta"><span>Venda ${fmtDate(x.dataVenda)} · ${fmtMoney(x.valorTotal)}</span><span>· ${fmtNum(x.comissaoPct, 1)}%</span><span>· cliente já pagou ${fmtMoney(r.pago)}</span>${x.comissaoPaga && x.comissaoData ? `<span>· paga em ${fmtDate(x.comissaoData)}</span>` : ''}</div></div>
      <div class="side"><div class="value">${fmtMoney(x.comissaoValor)}</div><span class="badge ${x.comissaoPaga ? 'paga' : 'pendente'}">${x.comissaoPaga ? 'Paga' : 'A pagar'}</span><div class="btns" onclick="event.stopPropagation()"><button class="btn-icon ${x.comissaoPaga ? '' : 'ok'}" title="${x.comissaoPaga ? 'Marcar como não paga' : 'Marcar como paga'}" onclick="toggleComissao('${x.id}')">${x.comissaoPaga ? '↩' : '💵'}</button></div></div></div>`; }).join('') || '<div class="empty"><div class="ic">🤝</div><p>Nenhuma comissão.</p></div>'}`;
}
function toggleComissao(id) {
  const x = getVenda(id); if (!x) return;
  const paga = !x.comissaoPaga;
  upsert('vendas', Object.assign({}, x, { comissaoPaga: paga, comissaoData: paga ? todayStr() : null }));
  logAct(`Comissão ${paga ? 'paga' : 'reaberta'}: ${x.corretor.nome} — ${fmtMoney(x.comissaoValor)}`); renderCurrent();
}

// ================================================================ GRÁFICOS (canvas)
function setupCanvas(cv) {
  const dpr = window.devicePixelRatio || 1; const rect = cv.getBoundingClientRect();
  const w = Math.max(200, rect.width || cv.parentElement.clientWidth - 32), h = Number(cv.getAttribute('height')) || 200;
  cv.width = w * dpr; cv.height = h * dpr; cv.style.height = h + 'px';
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr); return { ctx, w, h };
}
function drawFluxoChart(cv, recs, custos) {
  if (!cv) return; const { ctx, w, h } = setupCanvas(cv);
  const months = []; const now = new Date();
  for (let i = -1; i < 11; i++) { const d = new Date(now.getFullYear(), now.getMonth() + i, 1); months.push(d.getFullYear() + '-' + pad2(d.getMonth() + 1)); }
  const rIn = months.map(m => recs.filter(r => monthKey(r.vencimento) === m).reduce((s, r) => s + recValor(r), 0));
  const cOut = months.map(m => custos.filter(c => monthKey(c.vencimento || c.dataCompetencia) === m).reduce((s, c) => s + num(c.valor), 0));
  const max = Math.max(...rIn, ...cOut, 1);
  const padL = 8, padB = 22, padT = 14; const cw = w - padL * 2, ch = h - padB - padT; const gw = cw / months.length; const bw = gw * 0.34;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1;
  [0.25, 0.5, 0.75, 1].forEach(p => { const y = padT + ch - ch * p; ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padL, y); ctx.stroke(); });
  const narrow = gw < 46, showVals = gw >= 64;
  months.forEach((m, i) => {
    const x = padL + i * gw + gw / 2;
    const h1 = rIn[i] / max * ch, h2 = cOut[i] / max * ch;
    ctx.fillStyle = m === monthKey(todayStr()) ? '#1d4ed8' : '#60a5fa'; ctx.fillRect(x - bw - 1, padT + ch - h1, bw, h1);
    ctx.fillStyle = m === monthKey(todayStr()) ? '#ea580c' : '#fdba74'; ctx.fillRect(x + 1, padT + ch - h2, bw, h2);
    ctx.fillStyle = '#64748b'; ctx.font = '10px system-ui'; ctx.textAlign = 'center';
    if (!narrow || i % 2 === 0) ctx.fillText(monthLabel(m), x, h - 6);
    if (showVals) {
      ctx.fillStyle = '#334155'; ctx.font = '9px system-ui';
      if (h1 >= 14) ctx.fillText(fmtMoneyShort(rIn[i]).replace('R$ ', ''), x - bw / 2 - 1, padT + ch - h1 - 3);
      if (h2 >= 14) ctx.fillText(fmtMoneyShort(cOut[i]).replace('R$ ', ''), x + bw / 2 + 1, padT + ch - h2 - 3);
    }
  });
}
function drawDonut(cv, legendEl, data, money) {
  if (!cv) return; const { ctx, w, h } = setupCanvas(cv);
  ctx.clearRect(0, 0, w, h);
  const items = data.filter(d => d.value > 0); const total = items.reduce((s, d) => s + d.value, 0);
  if (!total) { ctx.fillStyle = '#94a3b8'; ctx.font = '13px system-ui'; ctx.textAlign = 'center'; ctx.fillText('Sem dados', w / 2, h / 2); if (legendEl) legendEl.innerHTML = ''; return; }
  const cx = w / 2, cy = h / 2, r = Math.min(cx, cy) - 8; let start = -Math.PI / 2;
  items.forEach(d => { const a = d.value / total * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, start, start + a); ctx.closePath(); ctx.fillStyle = d.color; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); start += a; });
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.58, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.fillStyle = '#0f172a'; ctx.font = 'bold 15px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(money ? fmtMoneyShort(total) : String(total), cx, cy - 2);
  ctx.fillStyle = '#64748b'; ctx.font = '10px system-ui'; ctx.fillText(money ? 'total' : 'lotes', cx, cy + 14);
  if (legendEl) legendEl.innerHTML = items.map(d => `<div><span class="dot" style="background:${d.color}"></span>${esc(d.label)}<span class="lv">${money ? fmtMoney(d.value) : d.value} (${Math.round(d.value / total * 100)}%)</span></div>`).join('');
}
