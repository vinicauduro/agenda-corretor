/* ===== Gestão de Loteamento — índices de correção (IGP-M, INPC, IPCA, CUB…) =====
   Cada contrato escolhe um índice. A correção é mensal: a variação do mês vale para
   todas as parcelas que vencem naquele mês, qualquer que seja o dia do vencimento. */
'use strict';

const INDICES_PADRAO = [
  { codigo: 'IGPM', nome: 'IGP-M (FGV)', tipo: 'percentual' },
  { codigo: 'INPC', nome: 'INPC (IBGE)', tipo: 'percentual' },
  { codigo: 'IPCA', nome: 'IPCA (IBGE)', tipo: 'percentual' },
  { codigo: 'CUB', nome: 'CUB (Sinduscon)', tipo: 'pontos' }
];

function getIndice(id) { return db.indices.find(i => i.id === id) || null; }
function indiceValores(ind) { return (ind && ind.valores) || {}; }
function mesesDoIndice(ind) { return Object.keys(indiceValores(ind)).sort(); }
function mesAtual() { return todayStr().slice(0, 7); }
function mesAnterior(m) { const [y, mm] = m.split('-').map(Number); const d = new Date(y, mm - 2, 1); return d.getFullYear() + '-' + pad2(d.getMonth() + 1); }
function mesSeguinte(m) { const [y, mm] = m.split('-').map(Number); const d = new Date(y, mm, 1); return d.getFullYear() + '-' + pad2(d.getMonth() + 1); }

/* Correção aplicada a uma parcela que vence em mesParcela, num contrato com mês base mesBase.
   O índice de um mês só é divulgado no mês seguinte, então a parcela usa o índice do mês
   anterior ao seu vencimento: a de setembro corrige pelo índice de agosto.
   Na prática acumula os meses de mesBase até mesParcela - 1.
   percentual: multiplica (1 + variação do mês) mês a mês.
   pontos (CUB): variação mês a mês do valor publicado.
   Deflação não corrige para baixo: mês negativo entra como 0%. */
function fatorIndice(indiceId, mesBase, mesParcela) {
  const ind = getIndice(indiceId);
  if (!ind || !mesBase || !mesParcela) return 1;
  const mesAlvo = mesAnterior(mesParcela);
  mesBase = mesAnterior(mesBase); // o índice do próprio mês base já conta
  if (mesAlvo <= mesBase) return 1;
  const vals = indiceValores(ind);
  let f = 1, m = mesSeguinte(mesBase), guard = 0;
  if (ind.tipo === 'pontos') {
    let ant = valorPontoAte(vals, mesBase);
    if (!(ant > 0)) return 1;
    while (m <= mesAlvo && guard++ < 600) {
      const v = valorPontoAte(vals, m);
      if (v > 0) { f *= Math.max(1, v / ant); ant = v; }
      m = mesSeguinte(m);
    }
    return f;
  }
  while (m <= mesAlvo && guard++ < 600) { const p = Number(vals[m]); if (isFinite(p)) f *= 1 + Math.max(0, p) / 100; m = mesSeguinte(m); }
  return f;
}
function valorPontoAte(vals, mes) { // último ponto conhecido até o mês
  const ms = Object.keys(vals).filter(k => k <= mes).sort();
  return ms.length ? Number(vals[ms[ms.length - 1]]) || 0 : 0;
}
/* Meses sem lançamento necessários para corrigir uma parcela que vence em mesParcela. */
function mesesFaltando(indiceId, mesBase, mesParcela) {
  const ind = getIndice(indiceId); if (!ind || ind.tipo === 'pontos' || !mesBase || !mesParcela) return [];
  const vals = indiceValores(ind); const out = [];
  const mesAlvo = mesAnterior(mesParcela);
  let m = mesBase, guard = 0;
  while (m <= mesAlvo && guard++ < 600) { if (!isFinite(Number(vals[m]))) out.push(m); m = mesSeguinte(m); }
  return out;
}
function acumuladoIndice(ind, nMeses, aplicado) { // aplicado = como entra nos contratos (sem deflação)
  const ms = mesesDoIndice(ind).slice(-nMeses); if (!ms.length) return null;
  const v = indiceValores(ind);
  if (ind.tipo === 'pontos') {
    let f = 1, ant = Number(v[ms[0]]);
    if (!(ant > 0)) return null;
    ms.slice(1).forEach(m => { const x = Number(v[m]); if (x > 0) { const p = x / ant; f *= aplicado ? Math.max(1, p) : p; ant = x; } });
    return (f - 1) * 100;
  }
  return (ms.reduce((f, m) => { const p = Number(v[m]) || 0; return f * (1 + (aplicado ? Math.max(0, p) : p) / 100); }, 1) - 1) * 100;
}

/* Valor devido de uma parcela, já corrigido.
   A correção vai só até o mês do vencimento: depois de vencida a parcela não recebe mais
   índice, apenas multa e juros de mora. Quitada, o valor fica congelado. */
function recValor(r) {
  if (r.valorCorrigido != null && num(r.valorCorrigido) > 0) return num(r.valorCorrigido);
  const base = num(r.valor);
  if (r.tipo === 'entrada') return base;
  const v = getVenda(r.vendaId);
  if (!v || !v.indiceId || !getIndice(v.indiceId)) return base;
  const f = fatorIndice(v.indiceId, v.indiceBase || monthKey(v.dataVenda), monthKey(r.vencimento));
  return Math.round(base * f * 100) / 100;
}
function recCorrecao(r) { return Math.round((recValor(r) - num(r.valor)) * 100) / 100; }

/* ---------------------------------------------------------------- impacto de um lançamento

   Lançar ou corrigir o índice de um mês que já passou muda o valor de parcelas que já estão
   na rua. Antes de salvar, o sistema mostra o que muda, de quanto para quanto.

   Duas listas saem daqui:
   - "mudam": parcelas em aberto que passam a valer outro valor.
   - "congeladas": parcelas já pagas que teriam mudado. Elas ficam como estão — o cliente pagou
     o que o sistema mandou pagar —, mas você precisa saber que existem. */
function _valorSemCongelar(r) {
  const v = getVenda(r.vendaId);
  if (!v || !v.indiceId || !getIndice(v.indiceId) || r.tipo === 'entrada') return num(r.valor);
  const f = fatorIndice(v.indiceId, v.indiceBase || monthKey(v.dataVenda), monthKey(r.vencimento));
  return Math.round(num(r.valor) * f * 100) / 100;
}
function simularIndice(ind, valoresNovos) {
  const alvo = db.recebiveis.filter(r => {
    const v = getVenda(r.vendaId);
    return v && v.indiceId === ind.id && v.status !== 'distrato' && r.tipo !== 'entrada';
  });
  const de = {}, deBruto = {};
  alvo.forEach(r => { de[r.id] = recValor(r); deBruto[r.id] = _valorSemCongelar(r); });
  const original = ind.valores;
  ind.valores = valoresNovos;                     // troca só para medir, e devolve logo abaixo
  const mudam = [], congeladas = [];
  alvo.forEach(r => {
    const para = recValor(r), paraBruto = _valorSemCongelar(r);
    if (Math.abs(para - de[r.id]) >= 0.005) mudam.push({ r, de: de[r.id], para });
    else if (Math.abs(paraBruto - deBruto[r.id]) >= 0.005) congeladas.push({ r, de: deBruto[r.id], para: paraBruto });
  });
  ind.valores = original;
  return { mudam, congeladas };
}

let _indicePendente = null;
/* Pede confirmação quando o lançamento mexe em parcela que já existe. Se nada muda, salva
   direto — não faz sentido incomodar quem está só lançando o mês corrente. */
function confirmarIndice(ind, valores, acao) {
  const imp = simularIndice(ind, valores);
  if (!imp.mudam.length && !imp.congeladas.length) { _indicePendente = { ind, valores, acao }; aplicarIndicePendente(); return; }
  _indicePendente = { ind, valores, acao };
  const porContrato = {};
  imp.mudam.forEach(x => { (porContrato[x.r.vendaId] = porContrato[x.r.vendaId] || []).push(x); });
  const difTotal = imp.mudam.reduce((s, x) => s + (x.para - x.de), 0);
  const cabecalho = v => `${v ? esc(imovelLabel(v)) : 'Contrato'}${v && v.cliente && v.cliente.nome ? ' · ' + esc(v.cliente.nome) : ''}`;
  openModal({
    title: '⚠️ Isto muda parcelas que já existem',
    wide: true,
    body: `<p class="help mb">${esc(acao)}. Confira a diferença antes de salvar. ${imp.mudam.length ? 'As parcelas abaixo passam a valer outro valor; se alguma já foi enviada ao cliente, o boleto precisa ser refeito.' : ''}</p>
      ${imp.mudam.length ? `<div class="card"><h3>Parcelas em aberto que mudam <span class="badge ${difTotal >= 0 ? 'convertida' : 'atrasado'}">${difTotal >= 0 ? '+' : ''}${esc(fmtMoney(difTotal))}</span></h3>
        ${Object.keys(porContrato).map(vid => { const v = getVenda(vid); const itens = porContrato[vid];
          return `<div class="fieldset"><span class="lg">${cabecalho(v)}</span>
            <table class="tbl"><thead><tr><th>Parcela</th><th>Vencimento</th><th class="num">Cobrado</th><th class="num">Ajustado</th><th class="num">Diferença</th></tr></thead><tbody>
            ${itens.map(x => `<tr><td>${esc(x.r.descricao || ('Parcela ' + x.r.numero))}</td><td>${fmtDate(x.r.vencimento)}</td><td class="num">${esc(fmtMoney(x.de))}</td><td class="num"><b>${esc(fmtMoney(x.para))}</b></td><td class="num" style="color:${x.para >= x.de ? 'var(--success)' : 'var(--danger)'};font-weight:700">${x.para >= x.de ? '+' : ''}${esc(fmtMoney(x.para - x.de))}</td></tr>`).join('')}
            </tbody></table></div>`; }).join('')}</div>` : ''}
      ${imp.congeladas.length ? `<div class="card"><h3>Parcelas já pagas que não mudam</h3>
        <p class="help">Estas ${imp.congeladas.length} parcela(s) teriam mudado, mas já estão quitadas e ficam como estão — o cliente pagou o que o sistema mandou pagar. A soma que deixou de ser cobrada é de <b>${esc(fmtMoney(imp.congeladas.reduce((s, x) => s + (x.para - x.de), 0)))}</b>. O saldo em aberto segue corrigido normalmente.</p></div>` : ''}`,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="aplicarIndicePendente()">Confirmar e salvar</button>`
  });
}
function aplicarIndicePendente() {
  const p = _indicePendente; _indicePendente = null;
  if (!p) return;
  upsert('indices', Object.assign({}, p.ind, { valores: p.valores }));
  logAct(p.acao);
  closeModal(); renderCadastros(); renderCurrent();
  toast('✅', 'Índice atualizado', p.ind.codigo);
}

// ================================================================ CADASTRO
function cadIndicesHtml() {
  const list = db.indices.slice().sort((a, b) => a.nome.localeCompare(b.nome));
  const usados = {};
  db.vendas.forEach(v => { if (v.indiceId) usados[v.indiceId] = (usados[v.indiceId] || 0) + 1; });
  const resumo = list.length ? `<div class="card ix-resumo"><h3>📈 Índices de reajuste</h3>
    <div class="ix-resumo-grid">${list.map(ind => {
      const ac = acumuladoIndice(ind, 12);
      return `<div onclick="abrirIndiceAno('${ind.id}')"><div class="v">${ac == null ? '—' : fmtNum(ac, 4)}</div><div class="k">${esc(ind.codigo)}</div></div>`;
    }).join('')}</div>
    <p class="help mt">Acumulado dos últimos 12 meses lançados. Os índices não são atualizados sozinhos: lance o mês novo assim que ele for divulgado.</p>
    ${list.some(ind => ind.tipo === 'percentual' && !indiceValores(ind)[mesAnterior(mesAtual())]) ? `<div class="alert warn" style="cursor:default"><span>Falta lançar ${monthLabel(mesAnterior(mesAtual()))} em ${esc(list.filter(ind => ind.tipo === 'percentual' && !indiceValores(ind)[mesAnterior(mesAtual())]).map(i => i.codigo).join(', '))}. Sem esse lançamento as parcelas do mês que vem ficam sem correção.</span></div>` : ''}</div>` : '';
  return `${resumo}<div class="card"><h3>📈 Índices de correção</h3>
    <p class="help">Cadastre aqui a variação de cada mês. A correção é mensal: o índice de um mês corrige as parcelas que vencem no mês seguinte, já que ele só é divulgado depois. Vale para todas as parcelas do mês, não importa o dia do vencimento. Cada contrato escolhe qual índice usa, na tela da venda.</p>
    <div class="btn-row mt"><button class="btn btn-primary" onclick="abrirIndiceForm()">＋ Novo índice</button>
    ${db.indices.length < INDICES_PADRAO.length ? `<button class="btn btn-secondary" onclick="criarIndicesPadrao()">📈 Criar IGP-M, INPC, IPCA e CUB</button>` : ''}</div></div>
    ${list.length ? list.map(ind => indiceCardHtml(ind, usados[ind.id] || 0)).join('') : `<div class="empty"><div class="ic">📈</div><p>Nenhum índice cadastrado.</p><p class="small">Crie os índices que você usa e lance a variação de cada mês.</p></div>`}`;
}

function indiceCardHtml(ind, nContratos) {
  const ms = mesesDoIndice(ind);
  const ultimos = ms.slice(-6).reverse();
  const vals = indiceValores(ind);
  const ac12 = acumuladoIndice(ind, 12), ac12ap = acumuladoIndice(ind, 12, true);
  const temNegativo = ind.tipo === 'percentual' ? ms.some(m => Number(vals[m]) < 0) : false;
  const faltaMes = ind.tipo === 'percentual' && ms.length > 0 && !vals[mesAtual()];
  const unidade = ind.tipo === 'pontos' ? '' : '%';
  return `<div class="card"><div class="row-between">
      <div><b>${esc(ind.nome)}</b> <span class="badge neutral">${esc(ind.codigo)}</span> <span class="tiny muted">${ind.tipo === 'pontos' ? 'valor em pontos (R$/m²)' : 'variação % ao mês'}</span></div>
      <div class="btn-row" style="margin:0"><button class="btn btn-primary btn-sm" onclick="abrirIndiceAno('${ind.id}')">📅 Lançar índices</button><button class="btn btn-secondary btn-sm" onclick="abrirIndiceForm('${ind.id}')">✏️</button>${nContratos ? '' : `<button class="btn btn-outline-danger btn-sm" onclick="excluirIndice('${ind.id}')">🗑️</button>`}</div></div>
    <div class="small mt">${ms.length} mês(es) lançado(s)${ac12 != null ? ` · acumulado dos últimos 12: <b>${fmtNum(ac12, 2)}%</b>${ac12ap != null && Math.abs(ac12ap - ac12) > 0.005 ? ` · aplicado nos contratos: <b>${fmtNum(ac12ap, 2)}%</b>` : ''}` : ''}${nContratos ? ` · usado em ${nContratos} contrato(s)` : ''}</div>
    ${temNegativo ? '<p class="help mt">Meses negativos ficam registrados, mas entram como 0% nos contratos: a correção não reduz o valor das parcelas.</p>' : ''}
    ${faltaMes ? `<div class="alert warn" style="cursor:default;margin-top:8px"><span>Falta lançar ${monthLabel(mesAtual())}. Sem o lançamento, as parcelas deste mês ficam sem correção.</span></div>` : ''}
    ${ultimos.length ? `<div class="chips mt">${ultimos.map(m => `<div class="chip" onclick="abrirIndiceAno('${ind.id}','${m.slice(0, 4)}')" ${Number(vals[m]) < 0 ? 'title="Deflação: entra como 0% nos contratos"' : ''}>${monthLabel(m)}<span class="n">${fmtNum(vals[m], 2)}${unidade}</span>${Number(vals[m]) < 0 ? ' ⤵' : ''}</div>`).join('')}</div>` : '<p class="help mt">Nenhum valor lançado ainda.</p>'}</div>`;
}

function criarIndicesPadrao() {
  INDICES_PADRAO.forEach(p => {
    if (db.indices.find(i => i.codigo === p.codigo)) return;
    upsert('indices', { id: genId(), codigo: p.codigo, nome: p.nome, tipo: p.tipo, valores: {}, criadoEm: new Date().toISOString() });
  });
  renderCadastros(); toast('📈', 'Índices criados', 'Agora lance a variação de cada mês.');
}

function abrirIndiceForm(id) {
  const ind = id ? getIndice(id) : null;
  openModal({
    title: ind ? '✏️ Editar índice' : '＋ Novo índice',
    body: `<div class="frow"><div class="fg"><label>Sigla *</label><input type="text" id="ixCodigo" value="${esc(ind ? ind.codigo : '')}" placeholder="IGPM"></div>
      <div class="fg"><label>Tipo</label><select id="ixTipo"><option value="percentual" ${!ind || ind.tipo === 'percentual' ? 'selected' : ''}>Variação em % ao mês</option><option value="pontos" ${ind && ind.tipo === 'pontos' ? 'selected' : ''}>Valor em pontos (CUB)</option></select></div></div>
      <div class="fg"><label>Nome *</label><input type="text" id="ixNome" value="${esc(ind ? ind.nome : '')}" placeholder="IGP-M (FGV)"></div>
      <p class="help">No tipo <b>percentual</b> você lança quanto o índice variou no mês, por exemplo 0,55. No tipo <b>pontos</b> você lança o valor publicado, e a correção é a razão entre o mês da parcela e o mês base do contrato.</p>`,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="salvarIndice('${id || ''}')">Salvar</button>`
  });
}
function salvarIndice(id) {
  const codigo = val('ixCodigo').toUpperCase(), nome = val('ixNome');
  if (!codigo || !nome) { toast('⚠️', 'Informe sigla e nome', '', true); return; }
  const prev = id ? getIndice(id) : null;
  upsert('indices', Object.assign({}, prev || { id: genId(), valores: {}, criadoEm: new Date().toISOString() }, { codigo, nome, tipo: val('ixTipo') }));
  closeModal(); renderCadastros(); toast('✅', 'Índice salvo', nome);
}
function excluirIndice(id) {
  const ind = getIndice(id); if (!ind) return;
  if (db.vendas.some(v => v.indiceId === id)) { toast('⚠️', 'Índice em uso', 'Há contratos usando este índice.', true); return; }
  if (!confirm(`Excluir o índice ${ind.nome} e todos os valores lançados?`)) return;
  removeRec('indices', id); renderCadastros(); toast('🗑️', 'Índice excluído', '');
}

function abrirLancarIndice(id, mes) {
  const ind = getIndice(id); if (!ind) return;
  const m = mes || mesAtual();
  const atual = indiceValores(ind)[m];
  openModal({
    title: `＋ ${esc(ind.codigo)} · lançar mês`,
    body: `<div class="frow"><div class="fg"><label>Mês de referência *</label><input type="month" id="lxMes" value="${m}"></div>
      <div class="fg"><label>${ind.tipo === 'pontos' ? 'Valor do índice *' : 'Variação no mês (%) *'}</label><input type="number" id="lxValor" step="0.0001" value="${atual != null ? atual : ''}" placeholder="${ind.tipo === 'pontos' ? '2.350,00' : '0,55'}"></div></div>
      <p class="help">${ind.tipo === 'pontos' ? 'Lance o valor publicado do índice no mês.' : 'Pode ser negativo em caso de deflação, por exemplo -0,15: o valor fica registrado, mas entra como 0% nos contratos, porque a correção não reduz as parcelas. Este é o índice apurado no mês informado, que corrige as parcelas do mês seguinte.'}</p>
      ${atual != null ? `<button class="btn btn-outline-danger btn-sm mt" onclick="apagarValorIndice('${id}','${m}')">Apagar o lançamento deste mês</button>` : ''}`,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="salvarValorIndice('${id}')">Salvar</button>`
  });
  setTimeout(() => { const el = $('#lxValor'); if (el) el.focus(); }, 60);
}
/* ---------------------------------------------------------------- lançamento por ano
   Lançar mês a mês, cada um num modal, é lento e não deixa conferir o ano inteiro. Aqui os
   doze meses ficam numa tabela só, com navegação de ano, do jeito que o usuário já conhece
   do sistema que ele usa hoje. O que é digitado fica num rascunho enquanto ele troca de
   ano, e só vai para o índice quando ele salva. */
function abrirIndiceAno(id, ano) {
  const ind = getIndice(id); if (!ind) return;
  window.__ixBuf = Object.assign({}, indiceValores(ind));
  window.__ixAno = Number(ano) || Number(mesAtual().slice(0, 4));
  openModal({
    title: `📈 ${esc(ind.nome)}`,
    wide: true,
    body: ixAnoHtml(id),
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-outline" onclick="ixCapturar();abrirIndiceValores('${id}')">📋 Colar de uma planilha</button>
      <button class="btn btn-primary" onclick="salvarIndiceAno('${id}')">Salvar</button>`
  });
  setTimeout(() => { const el = document.getElementById('ix0'); if (el) el.focus(); }, 60);
}
function ixAnoHtml(id) {
  const ind = getIndice(id); const ano = window.__ixAno; const buf = window.__ixBuf || {};
  const unidade = ind.tipo === 'pontos' ? '' : '%';
  const lancados = Object.keys(buf).filter(m => m.slice(0, 4) === String(ano) && buf[m] !== '' && buf[m] != null).length;
  const linhas = MESES_EXT.map((nome, i) => {
    const m = `${ano}-${pad2(i + 1)}`;
    const v = buf[m];
    const futuro = m > mesAtual();
    return `<tr class="${futuro ? 'ix-futuro' : ''}">
      <td>${nome.charAt(0).toUpperCase() + nome.slice(1)}/${ano}</td>
      <td style="text-align:right;width:180px"><input type="text" inputmode="decimal" id="ix${i}" data-mes="${m}" class="ix-val"
        value="${v == null || v === '' ? '' : String(v).replace('.', ',')}" placeholder="—" onkeydown="ixTecla(event,${i})"></td>
      <td style="width:28px" class="tiny muted">${unidade}</td></tr>`;
  }).join('');
  return `<div class="ix-ano-nav">
      <button type="button" class="btn btn-secondary btn-sm" onclick="ixTrocarAno('${id}',-1)">‹ ${ano - 1}</button>
      <b>${ano}</b>
      <button type="button" class="btn btn-secondary btn-sm" onclick="ixTrocarAno('${id}',1)">${ano + 1} ›</button>
    </div>
    <table class="tbl ix-tab" oninput="ixContar()"><thead><tr><th>Mês/Ano</th><th style="text-align:right">Índice</th><th></th></tr></thead><tbody>${linhas}</tbody></table>
    <p class="help mt"><span id="ixContagem">${lancados}</span> de 12 meses lançados em ${ano}. ${ind.tipo === 'pontos' ? 'Valor publicado do índice no mês.' : 'Variação do mês, em %. Pode ser negativa: fica registrada, mas entra como 0% nos contratos, porque a correção não reduz parcela.'} Mês em branco não é zero — é mês sem lançamento, e as parcelas que dependem dele ficam sem correção até você lançar.</p>
    <p class="help">Trocar de ano não perde o que você digitou: tudo é salvo junto no botão Salvar.</p>`;
}
/* A contagem acompanha a digitação: contador parado enquanto se preenche engana. */
function ixContar() {
  const el = document.getElementById('ixContagem'); if (!el) return;
  el.textContent = [...document.querySelectorAll('.ix-val')].filter(i => i.value.trim() !== '').length;
}
/* Enter desce para o mês seguinte, que é como se preenche uma coluna de doze valores. */
function ixTecla(ev, i) {
  if (ev.key !== 'Enter') return;
  ev.preventDefault();
  const prox = document.getElementById('ix' + (i + 1));
  if (prox) prox.focus(); else document.getElementById('ix' + i).blur();
}
function ixCapturar() {
  const buf = window.__ixBuf || (window.__ixBuf = {});
  document.querySelectorAll('.ix-val').forEach(el => {
    const m = el.dataset.mes, t = el.value.trim();
    if (t === '') delete buf[m]; else buf[m] = num(t);
  });
}
function ixTrocarAno(id, d) {
  ixCapturar();
  window.__ixAno += d;
  $('#modalBody').innerHTML = ixAnoHtml(id);
}
function salvarIndiceAno(id) {
  if (!pode('indices.editar')) { toast('🔒', 'Sem permissão', 'Seu perfil não lança índices.', true); return; }
  const ind = getIndice(id); if (!ind) return;
  ixCapturar();
  const valores = {};
  Object.keys(window.__ixBuf).forEach(m => { const v = window.__ixBuf[m]; if (v !== '' && v != null && isFinite(Number(v))) valores[m] = Number(v); });
  confirmarIndice(ind, valores, `Índice ${ind.codigo}: ${Object.keys(valores).length} mês(es) lançado(s)`);
}

function salvarValorIndice(id) {
  if (!pode('indices.editar')) { toast('🔒', 'Sem permissão', 'Seu perfil não lança índices.', true); return; }
  const ind = getIndice(id); if (!ind) return;
  const mes = val('lxMes'), v = val('lxValor');
  if (!mes || v === '') { toast('⚠️', 'Informe mês e valor', '', true); return; }
  const valores = Object.assign({}, indiceValores(ind)); valores[mes] = num(v);
  confirmarIndice(ind, valores, `Índice ${ind.codigo} ${monthLabel(mes)}: ${fmtNum(num(v), 2)}${ind.tipo === 'pontos' ? '' : '%'}`);
}
function apagarValorIndice(id, mes) {
  const ind = getIndice(id); if (!ind) return;
  if (!pode('indices.editar')) { toast('🔒', 'Sem permissão', 'Seu perfil não lança índices.', true); return; }
  const valores = Object.assign({}, indiceValores(ind)); delete valores[mes];
  confirmarIndice(ind, valores, `Índice ${ind.codigo}: lançamento de ${monthLabel(mes)} apagado`);
}

function abrirIndiceValores(id) {
  const ind = getIndice(id); if (!ind) return;
  const vals = indiceValores(ind);
  const linhas = mesesDoIndice(ind).map(m => `${m}  ${String(vals[m]).replace('.', ',')}`).join('\n');
  openModal({
    title: `📋 ${esc(ind.codigo)} · todos os meses`,
    wide: true,
    body: `<p class="help mb">Uma linha por mês, no formato <b>AAAA-MM valor</b>. Dá para colar de uma planilha. ${ind.tipo === 'pontos' ? 'Valores em pontos.' : 'Valores em % do mês.'}</p>
      <div class="fg"><textarea id="ixLista" class="doc-editor" style="min-height:220px" spellcheck="false">${esc(linhas)}</textarea></div>`,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="salvarIndiceLista('${id}')">Salvar lista</button>`
  });
}
function salvarIndiceLista(id) {
  const ind = getIndice(id); if (!ind) return;
  const valores = {}; let erros = 0;
  val('ixLista').split('\n').forEach(ln => {
    const t = ln.trim(); if (!t) return;
    const m = /^(\d{4})[-/](\d{1,2})[\s;,\t]+(-?[\d.,]+)\s*%?$/.exec(t);
    if (!m) { erros++; return; }
    valores[`${m[1]}-${pad2(Number(m[2]))}`] = num(m[3]);
  });
  if (erros) toast('⚠️', 'Linhas ignoradas', `${erros} linha(s) fora do formato AAAA-MM valor`, true);
  confirmarIndice(ind, valores, `Índice ${ind.codigo}: lista de ${Object.keys(valores).length} mês(es) salva`);
}

// ================================================================ NA VENDA
function indiceSelectHtml(selId, selBase, dataVenda) {
  const base = selBase || monthKey(dataVenda || todayStr());
  /* Sem índice cadastrado o seletor fica vazio e parece defeito. Melhor dizer o que falta e
     mandar para a tela certa. */
  if (!db.indices.length) {
    return `<div class="alert info" style="cursor:pointer" onclick="closeModal();irParaIndices()">
      <span><b>Nenhum índice cadastrado ainda.</b> Para corrigir as parcelas por IGP-M, INPC, IPCA ou CUB, cadastre o índice em Cadastros › Índices. Sem isso a venda fica sem correção monetária.</span><span>›</span></div>`;
  }
  return `<div class="frow"><div class="fg"><label>Índice de correção</label>
      <select id="vfIndice"><option value="">— sem correção —</option>${db.indices.slice().sort((a, b) => a.nome.localeCompare(b.nome)).map(i => `<option value="${i.id}" ${selId === i.id ? 'selected' : ''}>${esc(i.nome)}</option>`).join('')}</select>
      <div class="hint">Cada parcela usa o índice do mês anterior ao vencimento, que é quando ele foi divulgado. Depois de vencida, só multa e juros. Deflação entra como 0%.</div></div>
    <div class="fg"><label>Mês base da correção</label><input type="month" id="vfIndiceBase" value="${base}"><div class="hint">O índice deste mês é o primeiro a ser aplicado, na parcela do mês seguinte.</div></div></div>`;
}

function irParaIndices() { state.tab = 'cadastros'; state.sub.cad = 'indices'; renderCurrent(); }
function correcaoResumoVenda(v) {
  if (!v.indiceId) return '';
  const ind = getIndice(v.indiceId); if (!ind) return '';
  const base = v.indiceBase || monthKey(v.dataVenda);
  const f = fatorIndice(v.indiceId, base, mesAtual());
  const falta = mesesFaltando(v.indiceId, base, mesAtual());
  const abertas = recebiveisDe(v.id).filter(r => recStatus(r) !== 'pago');
  const correcao = abertas.reduce((s, r) => s + recCorrecao(r), 0);
  const vencidas = abertas.filter(r => r.vencimento < todayStr()).length;
  return `<div class="alert info" style="cursor:default"><span>📈 <b>${esc(ind.codigo)}</b> desde ${monthLabel(base)} · acumulado ${fmtNum((f - 1) * 100, 2)}%${correcao ? ` · ${fmtMoney(correcao)} de correção nas parcelas em aberto` : ''}${falta.length ? ` · <b>faltam lançar ${falta.length} mês(es)</b>` : ''}${vencidas ? ` · ${vencidas} parcela(s) vencida(s) com valor congelado, só multa e juros` : ''}</span></div>`;
}
