/* ===== Gestão de Loteamento — antecipação e quitação de parcelas =====
   O cliente que antecipa não paga os juros do prazo que não usou: cada parcela futura
   é trazida a valor presente pela mesma taxa do contrato. Parcelas já vencidas entram
   pelo valor cheio, com multa e juros de mora. */
'use strict';

function taxaVenda(v) { return (num(v.jurosMes) || 0) / 100; }

/* meses fechados entre duas datas: quem antecipa em qualquer dia do mês paga o mesmo,
   do mesmo jeito que o juro é cobrado por mês fechado */
function mesesFechados(dataRef, vencimento) {
  const [ya, ma] = monthKey(dataRef).split('-').map(Number);
  const [yb, mb] = monthKey(vencimento).split('-').map(Number);
  return Math.max(0, (yb - ya) * 12 + (mb - ma));
}

/* Quanto o cliente paga hoje por uma parcela ainda não vencida.
   Trazer as parcelas futuras pela taxa do contrato devolve exatamente o saldo devedor da
   tabela de amortização: sai só o juro dos meses que o cliente não vai usar. */
function vpParcela(r, v, dataRef) {
  const devido = recRestante(r);
  if (devido <= 0) return 0;
  if (r.vencimento <= dataRef) return recAtualizado(r);   // vencida: valor cheio + mora
  const i = taxaVenda(v);
  if (!i) return devido;                                   // sem juros no contrato: nada a descontar
  const n = mesesFechados(dataRef, r.vencimento);
  return n <= 0 ? devido : devido / Math.pow(1 + i, n);    // vence dentro deste mês: sem desconto
}

/* Tabela de amortização do que falta: parte do saldo devedor da data e mostra, parcela a
   parcela, quanto é juro do mês e quanto abate o saldo. */
function tabelaAmortizacao(v, dataRef) {
  dataRef = dataRef || todayStr();
  const i = taxaVenda(v);
  const futuras = recebiveisDe(v.id).filter(r => recStatus(r) !== 'pago' && r.vencimento > dataRef);
  let saldo = futuras.reduce((a, r) => a + vpParcela(r, v, dataRef), 0);
  return futuras.map(r => {
    const parcela = recRestante(r);
    const juros = Math.round(saldo * i * 100) / 100;
    const amortizacao = Math.round((parcela - juros) * 100) / 100;
    saldo = Math.round((saldo - amortizacao) * 100) / 100;
    return { rec: r, parcela, juros, amortizacao, saldo: Math.abs(saldo) < 0.02 ? 0 : saldo };
  });
}

/* Saldo para quitar (ou antecipar) numa data. */
function saldoQuitacao(v, dataRef) {
  dataRef = dataRef || todayStr();
  const itens = recebiveisDe(v.id).filter(r => recStatus(r) !== 'pago').map(r => {
    const devido = recRestante(r);
    const pagar = Math.round(vpParcela(r, v, dataRef) * 100) / 100;
    return { rec: r, devido, pagar, desconto: Math.round((devido - pagar) * 100) / 100, vencida: r.vencimento <= dataRef };
  });
  const nominal = itens.reduce((s, x) => s + x.devido, 0);
  const total = itens.reduce((s, x) => s + x.pagar, 0);
  return { dataRef, itens, nominal: Math.round(nominal * 100) / 100, total: Math.round(total * 100) / 100,
    desconto: Math.round((nominal - total) * 100) / 100,
    vencidas: itens.filter(x => x.vencida).length, futuras: itens.filter(x => !x.vencida).length };
}


// ================================================================ TELA
function abrirAntecipacao(vendaId) {
  const v = getVenda(vendaId); if (!v) return;
  const s = saldoQuitacao(v, todayStr());
  if (!s.itens.length) { toast('✅', 'Contrato quitado', 'Não há parcelas em aberto.', false); return; }
  const futuras = s.itens.filter(x => !x.vencida);
  const body = `
    <p class="small mb"><b>${esc(v.cliente.nome)}</b> · ${esc(imovelLabel(v))} · ${s.itens.length} parcela(s) em aberto</p>
    <div class="kpi-grid">
      <div class="kpi c-amber"><div class="lbl">Saldo pelos vencimentos</div><div class="val">${fmtMoneyShort(s.nominal)}</div><div class="sub">${s.itens.length} parcela(s)</div></div>
      <div class="kpi c-green"><div class="lbl">Desconto</div><div class="val">${fmtMoneyShort(s.desconto)}</div><div class="sub">juros dos meses não usados</div></div>
      <div class="kpi c-blue"><div class="lbl">Para quitar</div><div class="val">${fmtMoneyShort(s.total)}</div><div class="sub">até ${fmtDate(ultimoDiaDoMes(todayStr()))}</div></div>
    </div>
    ${s.vencidas ? `<div class="alert warn" style="cursor:default"><span>${s.vencidas} parcela(s) vencida(s) entram pelo valor cheio, com multa e juros de mora. Só os meses futuros são descontados.</span></div>` : ''}
    ${!taxaVenda(v) ? `<div class="alert info" style="cursor:default"><span>Este contrato não tem juros no parcelamento, então antecipar não gera desconto: o cliente paga o valor das parcelas.</span></div>` : ''}

    <p class="tiny muted">O valor para quitação vale para todo o mês de ${monthLabel(mesAtual())}: o cálculo é por mês fechado, igual à cobrança de juros. É o saldo devedor do contrato, o mesmo número da tabela de amortização.</p>
    <details style="margin-top:8px"><summary class="small" style="cursor:pointer;font-weight:700">🧮 Ver a tabela de amortização</summary>
      <div class="table-wrap" style="margin-top:8px"><table class="tbl"><thead><tr><th>Parcela</th><th>Vencimento</th><th class="num">Valor</th><th class="num">Juros do mês</th><th class="num">Amortização</th><th class="num">Saldo depois</th></tr></thead>
      <tbody>${tabelaAmortizacao(v, todayStr()).map(x => `<tr><td>${esc(x.rec.descricao)}</td><td>${fmtDate(x.rec.vencimento)}</td><td class="num">${fmtMoney(x.parcela)}</td><td class="num">${fmtMoney(x.juros)}</td><td class="num">${fmtMoney(x.amortizacao)}</td><td class="num">${fmtMoney(x.saldo)}</td></tr>`).join('')}</tbody></table></div>
      <p class="tiny muted">Começa no saldo devedor de hoje. Antecipar uma parcela do fim economiza todos os juros previstos até lá.</p></details>

    <div class="fieldset" style="margin-top:14px"><span class="lg">💸 O que o cliente quer fazer</span>
      <div class="fg"><label>Operação</label><select id="anTipo" onchange="anCalc('${v.id}')">
        <option value="total">Quitar o contrato inteiro</option>
        <option value="parcelas">Antecipar as últimas parcelas</option>
        <option value="valor">Amortizar um valor</option>
      </select></div>
      <div class="frow"><div class="fg"><label>Data do pagamento</label><input type="date" id="anData" value="${todayStr()}" onchange="anCalc('${v.id}')"></div>
        <div class="fg" id="anQtdBox" style="display:none"><label>Quantas parcelas (das últimas)</label><input type="number" id="anQtd" min="1" max="${futuras.length}" value="${Math.min(6, futuras.length)}" oninput="anCalc('${v.id}')"></div>
        <div class="fg" id="anValorBox" style="display:none"><label>Valor que o cliente vai pagar (R$)</label><input type="number" id="anValor" step="0.01" oninput="anCalc('${v.id}')"></div></div>
      <div class="fg" id="anModoBox" style="display:none"><label>Como aplicar a amortização</label><select id="anModo" onchange="anCalc('${v.id}')">
        <option value="prazo">Reduzir prazo — quita as últimas parcelas</option>
        <option value="parcela">Reduzir o valor das parcelas — mantém o prazo</option>
      </select></div>
      <div class="sim-result" id="anResumo"></div>
      <div class="fg"><label>Observação no recibo</label><input type="text" id="anObs" placeholder="Antecipação negociada com o cliente"></div>
    </div>`;
  openModal({
    title: '💸 Antecipar ou quitar',
    body, wide: true,
    footer: `<button class="btn btn-secondary" onclick="abrirVendaAdmin('${v.id}')">Voltar</button>
      <button class="btn btn-outline" onclick="imprimirDemonstrativo('${v.id}')">🖨️ Demonstrativo</button>
      ${v.cliente.telefone ? `<a class="btn btn-wa" target="_blank" href="${waLink(v.cliente.telefone, textoAntecipacao(v, s))}">💬 Enviar</a>` : ''}
      <button class="btn btn-success" onclick="aplicarAntecipacao('${v.id}')">Registrar pagamento</button>`
  });
  anCalc(v.id);
}

function anCalc(vendaId) {
  const v = getVenda(vendaId); if (!v) return;
  const tipo = val('anTipo'), data = val('anData') || todayStr();
  const box = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
  box('anQtdBox', tipo === 'parcelas'); box('anValorBox', tipo === 'valor'); box('anModoBox', tipo === 'valor');
  const plano = planoAntecipacao(v, data, tipo, Math.round(num(val('anQtd'))), num(val('anValor')), val('anModo'));
  const el = $('#anResumo'); if (!el) return;
  if (!plano.itens.length && !plano.novaParcela) { el.innerHTML = '<span class="tiny muted">Informe o valor ou a quantidade de parcelas.</span>'; return; }
  el.innerHTML = `Cliente paga <b>${fmtMoney(plano.pagar)}</b> em ${fmtDate(data)} · desconto de juros <b style="color:var(--success)">${fmtMoney(plano.desconto)}</b>
    <br><span class="tiny muted">${plano.descricao}</span>`;
}

/* Monta o que vai ser quitado, sem gravar nada. */
function planoAntecipacao(v, data, tipo, qtd, valor, modo) {
  const s = saldoQuitacao(v, data);
  const abertas = s.itens;
  const futuras = abertas.filter(x => !x.vencida);
  const vencidas = abertas.filter(x => x.vencida);
  if (tipo === 'total') {
    return { tipo, itens: abertas, pagar: s.total, desconto: s.desconto, quitaTudo: true,
      descricao: `Quita as ${abertas.length} parcela(s) em aberto${vencidas.length ? `, incluindo ${vencidas.length} vencida(s) com mora` : ''}.` };
  }
  if (tipo === 'parcelas') {
    const n = Math.max(1, Math.min(qtd || 1, futuras.length));
    const alvo = futuras.slice(-n);                                    // sempre as últimas, que é onde o juro é maior
    const pagar = alvo.reduce((a, x) => a + x.pagar, 0);
    return { tipo, itens: alvo, pagar: Math.round(pagar * 100) / 100, desconto: Math.round(alvo.reduce((a, x) => a + x.desconto, 0) * 100) / 100,
      descricao: `Quita as ${n} última(s) parcela(s), de ${fmtDate(alvo[0].rec.vencimento)} a ${fmtDate(alvo[alvo.length - 1].rec.vencimento)}. As vencidas e as demais continuam como estão.` };
  }
  // valor livre
  const disponivel = num(valor);
  if (!(disponivel > 0)) return { tipo, itens: [], pagar: 0, desconto: 0, descricao: '' };
  if (modo === 'parcela') {
    const i = taxaVenda(v);
    const restantes = futuras.map(x => x.rec);
    const vpTotal = futuras.reduce((a, x) => a + x.pagar, 0);
    const novoVp = Math.max(0, vpTotal - disponivel);
    const novaParcela = restantes.length ? Math.round(pmt(i, restantes.length, novoVp) * 100) / 100 : 0;
    return { tipo, itens: [], pagar: Math.round(Math.min(disponivel, vpTotal) * 100) / 100,
      desconto: 0, novaParcela, restantes, modo,
      descricao: `Abate o valor do saldo e recalcula as ${restantes.length} parcela(s) restantes para ${fmtMoney(novaParcela)} cada, mantendo o prazo.` };
  }
  /* Reduzir prazo: quita as últimas parcelas até o dinheiro acabar. O que sobra não volta
     para o bolso do cliente — amortiza em parte a parcela seguinte, que continua aberta com
     o saldo. O cliente pode pagar 10, 100 ou 1000: sempre entra tudo. */
  const alvo = []; let resta = disponivel;
  for (let k = futuras.length - 1; k >= 0; k--) {
    const x = futuras[k];
    if (resta >= x.pagar - 0.005) { alvo.unshift(x); resta -= x.pagar; } else break;
  }
  resta = Math.round(resta * 100) / 100;
  const proxima = futuras[futuras.length - 1 - alvo.length];
  const parcial = (resta > 0.01 && proxima) ? { item: proxima, valor: resta } : null;
  /* O pedaço pago adiantado ganha o mesmo desconto que a parcela inteira ganharia: sem isso,
     quem amortiza metade estaria pagando juro de um prazo que não vai usar. */
  const descParcial = parcial && parcial.item.pagar > 0
    ? Math.round((parcial.valor * parcial.item.devido / parcial.item.pagar - parcial.valor) * 100) / 100 : 0;
  const pagar = alvo.reduce((a, x) => a + x.pagar, 0) + (parcial ? parcial.valor : 0);
  const descricaoParcial = parcial
    ? `${alvo.length ? ' ' : ''}Os ${fmtMoney(parcial.valor)} restantes amortizam em parte a ${parcial.item.rec.descricao}, que continua em aberto com o saldo.`
    : (resta > 0.01 ? ` Sobram ${fmtMoney(resta)} sem parcela futura para amortizar.` : '');
  return { tipo, itens: alvo, parcial,
    pagar: Math.round(pagar * 100) / 100,
    desconto: Math.round((alvo.reduce((a, x) => a + x.desconto, 0) + descParcial) * 100) / 100,
    sobra: parcial ? 0 : resta, modo,
    descricao: (alvo.length ? `Quita ${alvo.length} parcela(s) do fim do contrato, de ${fmtDate(alvo[0].rec.vencimento)} em diante.` : '') + descricaoParcial };
}

function aplicarAntecipacao(vendaId) {
  if (!pode('financeiro.antecipar')) { toast('🔒', 'Sem permissão', 'Seu perfil não registra antecipações.', true); return; }
  const v = getVenda(vendaId); if (!v) return;
  const data = val('anData') || todayStr();
  const tipo = val('anTipo');
  const plano = planoAntecipacao(v, data, tipo, Math.round(num(val('anQtd'))), num(val('anValor')), val('anModo'));
  const obs = val('anObs') || 'Antecipação com desconto de juros';
  if (!plano.itens.length && !plano.novaParcela && !plano.parcial) { toast('⚠️', 'Nada a registrar', 'Confira o valor informado.', true); return; }
  if (!confirm(`Registrar ${fmtMoney(plano.pagar)} em ${fmtDate(data)}?${plano.itens.length ? ` ${plano.itens.length} parcela(s) serão quitadas.` : ''}${plano.parcial ? ` A ${plano.parcial.item.rec.descricao} fica em aberto com o saldo.` : ''}`)) return;

  plano.itens.forEach(x => {
    const r = x.rec;
    upsert('recebiveis', Object.assign({}, r, {
      valorCorrigido: Math.round((num(r.valorPago) + x.pagar) * 100) / 100,
      valorPago: Math.round((num(r.valorPago) + x.pagar) * 100) / 100,
      dataPagamento: data, forma: 'Antecipação',
      obsPagamento: `${obs}${x.desconto > 0.005 ? ` · desconto de ${fmtMoney(x.desconto)}` : ''}`
    }));
  });

  /* Parcela amortizada em parte vira duas linhas: a amortização, quitada na data do
     pagamento, e a parcela original com a base reduzida — que continua em aberto, no mesmo
     vencimento e ainda sujeita à correção do índice, como qualquer saldo devedor. */
  if (plano.parcial) {
    const x = plano.parcial.item, r = x.rec, pago = plano.parcial.valor;
    const base = num(r.valor);
    const credNominal = x.pagar > 0 ? pago * x.devido / x.pagar : pago;
    const novaBase = Math.max(0, Math.round(base * Math.max(0, x.devido - credNominal) / (x.devido || 1) * 100) / 100);
    upsert('recebiveis', Object.assign({}, r, {
      valor: novaBase, valorCorrigido: null,
      obsPagamento: `Amortizada em parte em ${fmtDate(data)}: ${fmtMoney(pago)}`
    }));
    upsert('recebiveis', {
      id: genId(), loteamentoId: r.loteamentoId, vendaId: r.vendaId, tipo: 'parcela', numero: r.numero,
      descricao: `Amortização da ${r.descricao}`, vencimento: data,
      valor: Math.round((base - novaBase) * 100) / 100, valorCorrigido: pago,
      valorPago: pago, dataPagamento: data, forma: 'Antecipação',
      obsPagamento: `${obs}${credNominal - pago > 0.005 ? ` · desconto de ${fmtMoney(credNominal - pago)}` : ''}`
    });
  }

  if (plano.tipo === 'valor' && plano.modo === 'parcela' && plano.novaParcela) {
    plano.restantes.forEach(r => {
      upsert('recebiveis', Object.assign({}, r, { valor: plano.novaParcela, valorCorrigido: null, obsPagamento: r.obsPagamento || '' }));
    });
    upsert('vendas', Object.assign({}, v, { valorParcela: plano.novaParcela, indiceBase: monthKey(data) }));
  }

  atualizarStatusVenda(v.id);
  const vAtual = getVenda(v.id);
  logAct(`Antecipação: ${v.cliente.nome} pagou ${fmtMoney(plano.pagar)}${plano.desconto > 0.005 ? ` com ${fmtMoney(plano.desconto)} de desconto` : ''}${plano.itens.length ? ` (${plano.itens.length} parcela(s))` : ''}`);
  renderCurrent();
  toast('✅', vAtual && vAtual.status === 'quitada' ? 'Contrato quitado' : 'Antecipação registrada',
    `${fmtMoney(plano.pagar)}${plano.desconto > 0.005 ? ` · desconto de ${fmtMoney(plano.desconto)}` : ''}`);
  abrirVendaAdmin(v.id);
}

function textoAntecipacao(v, s) {
  return `*${db.config.empresa || ''}*\n${imovelLabel(v)} — ${v.cliente.nome}\n\nPara quitar até ${fmtDate(ultimoDiaDoMes(s.dataRef))}:\n• Saldo pelos vencimentos: ${fmtMoney(s.nominal)}\n• Desconto de juros: ${fmtMoney(s.desconto)}\n• *Valor para quitação: ${fmtMoney(s.total)}*\n\nAntecipando, você não paga os juros do prazo que não usou.`;
}

function imprimirDemonstrativo(vendaId) {
  const v = getVenda(vendaId); if (!v) return;
  const data = val('anData') || todayStr();
  const s = saldoQuitacao(v, data);
  const lot = getLoteamento(v.loteamentoId);
  $('#printArea').innerHTML = `
    <h1>${esc(db.config.empresa || (lot ? lot.nome : ''))}</h1><div>${lot ? esc(lot.nome) : ''}${lot && lot.cidade ? ' · ' + esc(lot.cidade) : ''}</div>
    <h2>Demonstrativo de antecipação — ${esc(imovelLabel(v))}</h2>
    <table><tr><th>Cliente</th><td>${esc(v.cliente.nome)}</td><th>CPF/CNPJ</th><td>${esc(fmtCPF(v.cliente.cpf))}</td></tr>
      <tr><th>Válido até</th><td>${fmtDate(ultimoDiaDoMes(data))}</td><th>Juros do contrato</th><td>${v.jurosMes ? fmtNum(v.jurosMes, 2) + '% a.m.' : 'sem juros'}</td></tr>
      <tr><th>Parcelas em aberto</th><td>${s.itens.length}</td><th>Valor para quitação</th><td><b>${fmtMoney(s.total)}</b></td></tr></table>
    <h2>Parcelas em aberto</h2>
    <table><thead><tr><th>Parcela</th><th>Vencimento</th><th class="num">Valor no vencimento</th><th class="num">Desconto</th><th class="num">Valor antecipado</th></tr></thead>
    <tbody>${s.itens.map(x => `<tr><td>${esc(x.rec.descricao)}</td><td>${fmtDate(x.rec.vencimento)}</td><td class="num">${fmtMoney(x.devido)}</td><td class="num">${x.desconto > 0.005 ? fmtMoney(x.desconto) : (x.vencida ? 'vencida' : '—')}</td><td class="num">${fmtMoney(x.pagar)}</td></tr>`).join('')}</tbody>
    <tfoot><tr><th colspan="2">Total</th><th class="num">${fmtMoney(s.nominal)}</th><th class="num">${fmtMoney(s.desconto)}</th><th class="num">${fmtMoney(s.total)}</th></tr></tfoot></table>
    <h2>Tabela de amortização do saldo</h2>
    <table><thead><tr><th>Parcela</th><th>Vencimento</th><th class="num">Valor</th><th class="num">Juros do mês</th><th class="num">Amortização</th><th class="num">Saldo depois</th></tr></thead>
    <tbody>${tabelaAmortizacao(v, data).map(x => `<tr><td>${esc(x.rec.descricao)}</td><td>${fmtDate(x.rec.vencimento)}</td><td class="num">${fmtMoney(x.parcela)}</td><td class="num">${fmtMoney(x.juros)}</td><td class="num">${fmtMoney(x.amortizacao)}</td><td class="num">${fmtMoney(x.saldo)}</td></tr>`).join('')}</tbody></table>

    <p style="margin-top:10px">As parcelas futuras são trazidas a valor presente pela mesma taxa de juros do contrato, o que devolve exatamente o saldo devedor da tabela de amortização: o cliente deixa de pagar apenas o juro dos meses que não vai utilizar. O cálculo é por mês fechado, então o valor vale para qualquer dia do mês de referência. Parcelas vencidas entram pelo valor cheio, acrescidas de multa e juros de mora.</p>
    <p style="margin-top:6px">Emitido em ${fmtDate(todayStr())}.</p>`;
  window.print();
}
