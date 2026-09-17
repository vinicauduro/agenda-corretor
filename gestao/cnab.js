/* ===== Gestão de Loteamento — cobrança bancária em arquivo (CNAB) =====

   Remessa: o arquivo que a empresa manda ao banco pedindo para registrar os boletos.
   Retorno: o arquivo que o banco devolve dizendo o que aconteceu com cada título.

   O layout do Banco do Brasil aqui foi conferido contra uma remessa real gerada pelo
   sistema que a empresa usa hoje (CNAB 400, carteira 17, convênio de 7 dígitos), e o
   código de barras contra um boleto impresso do banco. O que não deu para conferir está
   marcado com "a conferir" no comentário — nada disso é chute silencioso.

   Regra de negócio importante: contrato com correção por índice não pode virar carnê.
   A parcela de outubro só tem valor final quando o índice de setembro é lançado, então
   o sistema libera a remessa mês a mês, conforme o índice entra. Contrato sem índice
   tem valor fixo do começo ao fim e pode sair de uma vez só. */
'use strict';

const CNAB = {
  '001': { nome: 'Banco do Brasil', colunas: 400, remessa: remessaBB, retorno: retornoBB }
};
function layoutCnab(banco) { return CNAB[pad(banco, 3)] || null; }

// ---------------------------------------------------------------- utilitários de coluna fixa
function nCampo(v, n) { return pad(Math.round(num(v)), n); }
function dinheiro(v, n) { return pad(Math.round(num(v) * 100), n); }
function dataDDMMAA(iso) { if (!iso) return '000000'; const [y, m, d] = String(iso).slice(0, 10).split('-'); return d + m + y.slice(2); }
function isoDeDDMMAA(s) {
  if (!/^\d{6}$/.test(s) || s === '000000') return null;
  const d = s.slice(0, 2), m = s.slice(2, 4), a = Number(s.slice(4, 6));
  return (a >= 70 ? 1900 + a : 2000 + a) + '-' + m + '-' + d;
}
function linha400(partes) {
  const s = partes.join('');
  if (s.length !== 400) throw new Error('Registro com ' + s.length + ' posições, deveria ter 400');
  return s;
}

/* Espécie do título no padrão do BB. O boleto real trazia "DM". */
const ESPECIE_BB = { DM: '01', DS: '02', NP: '12', OU: '99' };

// ---------------------------------------------------------------- quem pode virar boleto
/* Uma parcela só pode ir para o banco quando o valor dela é definitivo. Com correção por
   índice, isso depende do índice do mês anterior ao vencimento já estar lançado. */
function bloqueioRemessa(rec) {
  if (recStatus(rec) === 'pago') return 'Parcela já paga';
  if (rec.tipo === 'entrada') return 'Entrada não vira boleto';
  const v = getVenda(rec.vendaId);
  if (!v) return 'Sem contrato';
  if (v.status === 'distrato') return 'Contrato distratado';
  if (!v.indiceId || !getIndice(v.indiceId)) return null;
  const faltando = mesesFaltando(v.indiceId, v.indiceBase || monthKey(v.dataVenda), monthKey(rec.vencimento));
  if (faltando.length) {
    const ind = getIndice(v.indiceId);
    return `Falta lançar ${ind.codigo} de ${faltando.map(monthLabel).join(', ')}`;
  }
  return null;
}
function jaNaRemessa(rec) { return !!rec.remessaEm; }

// ---------------------------------------------------------------- REMESSA — Banco do Brasil
/* Conferido contra a remessa real: header, detalhe tipo 7, registro de multa tipo 5 e trailer.
   Posições 23-25 do registro de multa saem como "090", igual ao arquivo do banco; é a única
   coisa que copiei sem ter o manual para explicar. */
function remessaBB(conta, itens, opc) {
  const o = opc || {};
  const emp = db.config || {};
  const cnpj = soDigitos(emp.cnpj);
  const tpInsc = cnpj.length === 11 ? '01' : '02';
  const ag = pad(conta.agencia, 4), agDv = pad(conta.agenciaDv || '0', 1);
  const cc = pad(conta.conta, 8), ccDv = pad(conta.contaDv || '0', 1);
  const conv = pad(conta.convenio, 7);
  const hoje = o.data || todayStr();
  const seq = Math.max(1, Math.round(num(o.sequencial) || 1));
  const linhas = [];

  linhas.push(linha400(['0', '1', 'REMESSA', '01', padTxt('COBRANCA', 15),
    ag, agDv, cc, ccDv, '000000', padTxt(emp.empresa || '', 30), '001', padTxt('BANCO DO BRASIL', 15),
    dataDDMMAA(hoje), pad(seq, 7), ' '.repeat(22), conv, ' '.repeat(258), '000001']));

  let n = 1;
  itens.forEach(it => {
    const sacado = it.sacado || {};
    const doc = soDigitos(sacado.cpf);
    const nn = pad(it.nossoNumero, 10);
    n++;
    linhas.push(linha400(['7', tpInsc, pad(cnpj, 14), ag, agDv, cc, ccDv, conv,
      pad(nn, 25),                                  // 039-063 controle do participante
      conv + nn,                                    // 064-080 nosso número (17)
      '00', '00', ' '.repeat(7),                    // 081-084 prestação e grupo, 085-091 brancos
      pad(conta.variacao || '0', 3),                // 092-094 variação da carteira
      '0000000', ' '.repeat(5),                     // 095-101, 102-106
      pad(conta.carteira, 2), '01',                 // 107-108 carteira, 109-110 comando (01 = entrada)
      nn,                                           // 111-120 seu número
      dataDDMMAA(it.vencimento), dinheiro(it.valor, 13),
      '001', '0000', ' ',                           // 140-146 banco e agência cobradora
      ESPECIE_BB[conta.especie] || '01', conta.aceite === 'S' ? 'A' : 'N',
      dataDDMMAA(it.emissao || hoje),
      pad(o.instrucao1 || (num(conta.protestoDias) > 0 ? '06' : '00'), 2),   // 157-158 protestar
      pad(o.instrucao2 || (num(conta.baixaDias) > 0 ? '09' : '00'), 2),      // 159-160 baixar/devolver
      dinheiro(num(it.valor) * num(conta.jurosDia) / 100, 13),        // 161-173 juros por dia, em reais
      num(conta.descontoPct) > 0 ? dataDDMMAA(it.vencimento) : '000000',
      dinheiro(num(it.valor) * num(conta.descontoPct) / 100, 13),
      dinheiro(0, 13), dinheiro(0, 13),             // IOF e abatimento
      doc.length === 11 ? '01' : '02', pad(doc, 14), padTxt(sacado.nome, 37), ' '.repeat(3),
      padTxt(sacado.endereco, 40), padTxt(sacado.bairro, 12), pad(sacado.cep, 8),
      padTxt(sacado.cidade, 15), padTxt(sacado.uf, 2),
      padTxt(it.mensagem, 40), ' '.repeat(3), pad(n, 6)]));

    if (num(conta.multaPct) > 0) {
      n++;
      linhas.push(linha400(['5', '99', '2', dataDDMMAA(it.vencimento),
        dinheiro(conta.multaPct, 12), '090', ' '.repeat(369), pad(n, 6)]));
    }
  });

  linhas.push(linha400(['9', ' '.repeat(393), pad(n + 1, 6)]));
  return linhas.join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------- RETORNO — Banco do Brasil
/* Ocorrências que interessam. A lista do BB é longa; aqui ficam as que mexem no sistema. */
const OCORRENCIAS_BB = {
  '02': ['confirmada', 'Entrada confirmada no banco'],
  '03': ['recusada', 'Entrada rejeitada pelo banco'],
  '05': ['info', 'Liquidação sem registro'],
  '06': ['liquidada', 'Liquidação (pagamento)'],
  '07': ['liquidada', 'Liquidação por conta'],
  '08': ['liquidada', 'Liquidação por saldo'],
  '09': ['baixada', 'Baixa automática'],
  '10': ['baixada', 'Baixa por devolução'],
  '15': ['liquidada', 'Liquidação em cartório'],
  '16': ['liquidada', 'Título pago em cheque'],
  '17': ['liquidada', 'Liquidação após baixa'],
  '19': ['info', 'Confirmação de instrução de protesto'],
  '21': ['info', 'Confirmação de prorrogação'],
  '24': ['info', 'Entrada rejeitada por CEP irregular'],
  '46': ['info', 'Instrução para cancelar protesto confirmada']
};

/* Lê o arquivo e devolve o que ele diz, sem mexer em nada. Quem decide baixar é você,
   na tela de conferência. Linha que não bate com o layout vem marcada, não some. */
function retornoBB(texto) {
  const linhas = String(texto).split(/\r?\n/).filter(l => l.length > 50);
  if (!linhas.length) throw new Error('Arquivo vazio');
  const head = linhas[0];
  if (head[0] !== '0' || head.slice(1, 9) !== '2RETORNO') throw new Error('Isto não parece um arquivo de retorno do Banco do Brasil');
  const cab = {
    agencia: head.slice(26, 30), conta: head.slice(31, 39), empresa: head.slice(46, 76).trim(),
    data: isoDeDDMMAA(head.slice(94, 100)), convenio: head.slice(149, 156).trim(), sequencial: head.slice(100, 107)
  };
  const itens = [], avisos = [];
  linhas.slice(1).forEach((l, i) => {
    if (l[0] === '9') return;
    if (l[0] !== '7') return;
    const cod = l.slice(108, 110);
    const oc = OCORRENCIAS_BB[cod] || ['info', 'Ocorrência ' + cod];
    const nossoNumero = l.slice(63, 80).trim();
    const item = {
      linha: i + 2, ocorrencia: cod, efeito: oc[0], descricao: oc[1], nossoNumero,
      seuNumero: l.slice(110, 116).trim(),
      data: isoDeDDMMAA(l.slice(110, 116)),
      vencimento: isoDeDDMMAA(l.slice(146, 152)),
      valorTitulo: num(l.slice(152, 165)) / 100,
      despesas: num(l.slice(175, 188)) / 100,
      valorPago: num(l.slice(252, 265)) / 100,
      juros: num(l.slice(265, 278)) / 100,
      creditoEm: isoDeDDMMAA(l.slice(295, 301))
    };
    const seq10 = pad(nossoNumero, 10);   // o banco devolve convênio + sequencial; comparamos o sequencial
    item.rec = db.recebiveis.find(r => r.nossoNumero && pad(r.nossoNumero, 10) === seq10) || null;
    if (!item.rec) avisos.push(`Linha ${item.linha}: nosso número ${nossoNumero} não é de nenhuma parcela deste sistema`);
    if (item.efeito === 'liquidada' && !(item.valorPago > 0)) avisos.push(`Linha ${item.linha}: liquidação sem valor pago legível — confira antes de baixar`);
    itens.push(item);
  });
  return { cabecalho: cab, itens, avisos };
}

// ================================================================ TELA: GERAR REMESSA
function sacadoDaVenda(v) {
  const c = (v && v.cliente) || {};
  return { nome: c.nome || '', cpf: c.cpf || '', endereco: c.endereco || '', bairro: c.bairro || '', cep: c.cep || '', cidade: c.cidade || db.config.cidade || '', uf: c.uf || '' };
}
function remessaElegiveis(lotId) {
  return db.recebiveis.filter(r => r.loteamentoId === lotId && !jaNaRemessa(r) && recStatus(r) !== 'pago' && r.tipo !== 'entrada')
    .sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)) || naturalCmp(a.descricao, b.descricao));
}
function abrirGerarRemessa() {
  const lot = curLot(); if (!lot) return;
  if (!pode('financeiro.baixar')) { toast('🔒', 'Sem permissão', 'Seu perfil não gera remessa.', true); return; }
  const conta = contaCobranca(lot.id);
  if (!conta) { toast('⚠️', 'Cadastre a conta de cobrança', 'Cadastros › 🏦 Banco', true); openModal({ title: '🏦 Falta a conta de cobrança', body: '<p class="help">Antes de gerar remessa, cadastre o convênio da empresa em <b>Cadastros › 🏦 Banco</b>: agência, conta, convênio, carteira e as instruções padrão do boleto.</p>', footer: '<button class="btn btn-primary" onclick="closeModal();switchTab(\'cadastros\');state.sub.cad=\'banco\';renderCadastros()">Ir para o cadastro</button>' }); return; }
  if (!layoutCnab(conta.banco)) { toast('⚠️', 'Banco sem layout', 'Hoje só o Banco do Brasil gera remessa.', true); return; }

  const todos = remessaElegiveis(lot.id);
  const livres = [], presos = [];
  todos.forEach(r => { const b = bloqueioRemessa(r); (b ? presos : livres).push({ r, motivo: b }); });
  const porVenda = {};
  livres.forEach(x => { (porVenda[x.r.vendaId] = porVenda[x.r.vendaId] || []).push(x.r); });
  const mesAtualKey = mesAtual();

  const grupo = (vid, recs) => {
    const v = getVenda(vid), l = v && getLote(v.loteId);
    const comIndice = v && v.indiceId && getIndice(v.indiceId);
    return `<div class="fieldset"><span class="lg">${l ? esc(loteLabel(l)) : 'Contrato'} · ${esc((v && v.cliente && v.cliente.nome) || '')}
        ${comIndice ? `<span class="badge pendente">corrigido por ${esc(getIndice(v.indiceId).codigo)}</span>` : '<span class="badge neutral">valor fixo</span>'}</span>
      ${comIndice ? '<p class="help">Este contrato sofre correção mensal. Só aparecem aqui as parcelas cujo índice já foi lançado — as seguintes entram mês a mês, quando o índice sair.</p>'
        : '<p class="help">Sem correção: dá para mandar o carnê inteiro de uma vez.</p>'}
      <label class="check" style="margin-bottom:6px"><input type="checkbox" onchange="marcarGrupoRemessa(this,'${vid}')" checked> <b>Marcar todas deste contrato</b></label>
      ${recs.map(r => `<label class="check" style="margin-bottom:4px"><input type="checkbox" class="rmChk" data-venda="${vid}" value="${r.id}" ${monthKey(r.vencimento) <= mesAtualKey || !comIndice ? 'checked' : ''}>
        ${esc(r.descricao || 'Parcela ' + r.numero)} · vence ${fmtDate(r.vencimento)} · <b>${esc(fmtMoney(recValor(r)))}</b></label>`).join('')}
    </div>`;
  };

  openModal({
    title: '📤 Gerar remessa para o banco', wide: true,
    body: !livres.length
      ? `<div class="empty"><div class="ic">📭</div><p><b>Nenhuma parcela pronta para remessa</b></p>
          <p class="small">${presos.length ? 'Há ' + presos.length + ' parcela(s) esperando lançamento de índice ou já enviadas.' : 'Todas as parcelas já foram enviadas ou estão pagas.'}</p></div>
          ${presos.length ? `<div class="card"><h3>Esperando</h3>${presos.slice(0, 40).map(x => `<div class="item"><div class="info"><div class="title">${esc(x.r.descricao || '')} · ${fmtDate(x.r.vencimento)}</div><div class="meta"><span>${esc(x.motivo)}</span></div></div></div>`).join('')}</div>` : ''}`
      : `<p class="help mb">Marque o que vai no arquivo. O sistema numera o nosso número sozinho e marca as parcelas como enviadas, para não mandar duas vezes.</p>
        ${Object.keys(porVenda).map(vid => grupo(vid, porVenda[vid])).join('')}
        ${presos.length ? `<div class="card"><h3>⏳ ${presos.length} parcela(s) ainda não podem ir</h3>
          <p class="help">Contrato com correção por índice não vira carnê: a parcela só tem valor definitivo depois que o índice do mês anterior é lançado. Lance o índice em <b>Cadastros › Índices</b> e elas aparecem aqui.</p>
          ${presos.slice(0, 25).map(x => { const v = getVenda(x.r.vendaId), l = v && getLote(v.loteId); return `<div class="item"><div class="info"><div class="title">${l ? esc(loteLabel(l)) : ''} · ${esc(x.r.descricao || '')} · ${fmtDate(x.r.vencimento)}</div><div class="meta"><span>${esc(x.motivo)}</span></div></div></div>`; }).join('')}
          ${presos.length > 25 ? `<p class="help">…e mais ${presos.length - 25}.</p>` : ''}</div>` : ''}`,
    footer: livres.length ? `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="gerarRemessa()">Gerar arquivo</button>`
      : `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>`
  });
}
function marcarGrupoRemessa(el, vendaId) { $$(`.rmChk[data-venda="${vendaId}"]`).forEach(c => { c.checked = el.checked; }); }

function gerarRemessa() {
  const lot = curLot(); const conta = contaCobranca(lot.id);
  const ids = $$('.rmChk').filter(c => c.checked).map(c => c.value);
  if (!ids.length) { toast('⚠️', 'Marque ao menos uma parcela', '', true); return; }
  let nn = Math.max(1, Math.round(num(conta.nossoNumeroAtual) || 1));
  const itens = [], atualizar = [];
  ids.forEach(id => {
    const r = db.recebiveis.find(x => x.id === id); if (!r) return;
    if (bloqueioRemessa(r)) return;
    const v = getVenda(r.vendaId), l = v && getLote(v.loteId);
    itens.push({ nossoNumero: nn, vencimento: r.vencimento, valor: recValor(r), sacado: sacadoDaVenda(v),
      mensagem: (conta.mensagem1 || '').replace('{{lote}}', l ? loteLabel(l) : '').replace('{{loteamento}}', lot.nome) });
    atualizar.push(Object.assign({}, r, { nossoNumero: String(nn), remessaEm: todayStr() }));
    nn++;
  });
  if (!itens.length) { toast('⚠️', 'Nada elegível', '', true); return; }
  const seq = Math.max(1, Math.round(num(conta.remessaSeq) || 1));
  let texto;
  try { texto = layoutCnab(conta.banco).remessa(conta, itens, { sequencial: seq }); }
  catch (e) { toast('⚠️', 'Falha ao montar o arquivo', e.message, true); return; }

  atualizar.forEach(r => upsert('recebiveis', r));
  upsert('contasBanco', Object.assign({}, conta, { nossoNumeroAtual: nn, remessaSeq: seq + 1 }));
  const total = itens.reduce((s, x) => s + x.valor, 0);
  const nome = 'CB' + pad(seq, 6) + '.REM';
  upsert('remessas', { id: genId(), loteamentoId: lot.id, contaId: conta.id, sequencial: seq, data: todayStr(),
    arquivo: nome, qtd: itens.length, valor: Math.round(total * 100) / 100,
    recIds: atualizar.map(r => r.id), primeiroNn: String(itens[0].nossoNumero), ultimoNn: String(itens[itens.length - 1].nossoNumero),
    criadoEm: new Date().toISOString() });
  download(nome, texto, 'text/plain');
  logAct(`Remessa ${seq} gerada: ${itens.length} título(s), ${fmtMoney(total)}`);
  closeModal(); renderCurrent();
  toast('✅', 'Remessa gerada', `${itens.length} título(s) · ${fmtMoney(total)}`);
}

// ================================================================ TELA: LER RETORNO
function abrirRetorno() {
  if (!pode('financeiro.baixar')) { toast('🔒', 'Sem permissão', 'Seu perfil não dá baixa.', true); return; }
  openModal({ title: '📥 Ler retorno do banco',
    body: `<p class="help mb">Escolha o arquivo de retorno que você baixou do internet banking. O sistema lê, mostra o que entendeu e só dá baixa depois que você confirmar.</p>
      <div class="fg"><input type="file" id="retArq" accept=".ret,.txt,.RET,.TXT" onchange="lerArquivoRetorno(this)"></div>`,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>` });
}
let _retornoLido = null;
async function lerArquivoRetorno(input) {
  const f = input.files[0]; if (!f) return;
  const lot = curLot(); const conta = lot && contaCobranca(lot.id);
  if (!conta || !layoutCnab(conta.banco)) { toast('⚠️', 'Cadastre a conta de cobrança primeiro', '', true); return; }
  try {
    const texto = await readFileAsText(f);
    _retornoLido = layoutCnab(conta.banco).retorno(texto);
    _retornoLido.nomeArquivo = f.name;
    mostrarRetorno();
  } catch (e) { toast('⚠️', 'Não consegui ler', e.message, true); }
  input.value = '';
}
function mostrarRetorno() {
  const r = _retornoLido; if (!r) return;
  const baixar = r.itens.filter(x => x.efeito === 'liquidada' && x.rec && recStatus(x.rec) !== 'pago');
  const total = baixar.reduce((s, x) => s + (x.valorPago || 0), 0);
  const linha = x => {
    const v = x.rec && getVenda(x.rec.vendaId), l = v && getLote(v.loteId);
    return `<tr><td>${x.rec ? esc(l ? loteLabel(l) : '') + ' · ' + esc(x.rec.descricao || '') : '<span class="muted">não localizada</span>'}</td>
      <td>${esc(x.nossoNumero)}</td><td>${esc(x.descricao)}</td><td>${x.data ? fmtDate(x.data) : '—'}</td>
      <td class="num">${esc(fmtMoney(x.valorPago))}</td></tr>`;
  };
  openModal({ title: '📥 Retorno · ' + esc(r.nomeArquivo || ''), wide: true,
    body: `<p class="help mb">Arquivo de <b>${esc(r.cabecalho.empresa)}</b>, agência ${esc(r.cabecalho.agencia)} conta ${esc(r.cabecalho.conta)}, gerado em ${r.cabecalho.data ? fmtDate(r.cabecalho.data) : '—'}. ${r.itens.length} ocorrência(s).</p>
      ${!r.itens.length ? '<div class="alert info" style="cursor:default"><span>Este arquivo não tem nenhuma ocorrência: só cabeçalho e rodapé. É o retorno de um dia sem movimento.</span></div>' : ''}
      ${baixar.length ? `<div class="card"><h3>Vão ser baixadas <span class="badge pago">${esc(fmtMoney(total))}</span></h3>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Parcela</th><th>Nosso número</th><th>Ocorrência</th><th>Data</th><th class="num">Pago</th></tr></thead><tbody>${baixar.map(linha).join('')}</tbody></table></div></div>` : ''}
      ${r.itens.length && !baixar.length ? '<div class="alert info" style="cursor:default"><span>Nenhuma liquidação nova para dar baixa. As demais ocorrências são informativas.</span></div>' : ''}
      ${r.itens.filter(x => x.efeito !== 'liquidada').length ? `<div class="card"><h3>Outras ocorrências</h3>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Parcela</th><th>Nosso número</th><th>Ocorrência</th><th>Data</th><th class="num">Valor</th></tr></thead><tbody>${r.itens.filter(x => x.efeito !== 'liquidada').map(linha).join('')}</tbody></table></div></div>` : ''}
      ${r.avisos.length ? `<div class="card"><h3>⚠️ Confira antes</h3>${r.avisos.slice(0, 20).map(a => `<p class="help">${esc(a)}</p>`).join('')}</div>` : ''}`,
    footer: baixar.length ? `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-success" onclick="aplicarRetorno()">Dar baixa em ${baixar.length} parcela(s)</button>`
      : `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>` });
}
function aplicarRetorno() {
  const r = _retornoLido; if (!r) return;
  let n = 0, soma = 0;
  r.itens.filter(x => x.efeito === 'liquidada' && x.rec && recStatus(x.rec) !== 'pago').forEach(x => {
    const rec = db.recebiveis.find(y => y.id === x.rec.id); if (!rec) return;
    const pago = x.valorPago || recValor(rec);
    const devido = recValor(rec);
    upsert('recebiveis', Object.assign({}, rec, {
      valorPago: pago, dataPagamento: x.data || todayStr(), forma: 'Boleto',
      obsPagamento: `Baixa automática pelo retorno ${r.nomeArquivo || ''}`.trim(),
      valorCorrigido: Math.round(Math.max(devido, pago) * 100) / 100
    }));
    atualizarStatusVenda(rec.vendaId);
    n++; soma += pago;
  });
  logAct(`Retorno ${r.nomeArquivo || ''}: ${n} baixa(s), ${fmtMoney(soma)}`);
  _retornoLido = null;
  closeModal(); renderCurrent();
  toast('✅', 'Baixas registradas', `${n} parcela(s) · ${fmtMoney(soma)}`);
}

// ================================================================ HISTÓRICO DE REMESSAS
function cadRemessasHtml() {
  const lot = curLot(); if (!lot) return '';
  const lista = db.remessas.filter(r => r.loteamentoId === lot.id).sort((a, b) => String(b.data).localeCompare(String(a.data)));
  if (!lista.length) return '<p class="help">Nenhuma remessa gerada ainda.</p>';
  return `<div class="table-wrap"><table class="tbl"><thead><tr><th>Arquivo</th><th>Data</th><th>Títulos</th><th class="num">Valor</th><th>Nosso número</th></tr></thead><tbody>
    ${lista.map(r => `<tr><td>${esc(r.arquivo)}</td><td>${fmtDate(r.data)}</td><td>${r.qtd}</td><td class="num">${esc(fmtMoney(r.valor))}</td><td>${esc(r.primeiroNn)} a ${esc(r.ultimoNn)}</td></tr>`).join('')}
  </tbody></table></div>`;
}
