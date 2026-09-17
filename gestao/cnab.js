/* ===== Gestão de Loteamento — cobrança bancária em arquivo (CNAB) =====

   Remessa: o arquivo que a empresa manda ao banco pedindo para registrar, alterar ou baixar
   boletos. Retorno: o arquivo que o banco devolve dizendo o que aconteceu com cada título.

   O layout do Banco do Brasil foi conferido contra uma remessa real gerada pelo sistema que
   a empresa usa hoje (CNAB 400, carteira 17, convênio de 7 dígitos), contra um boleto
   impresso do banco e contra o gerador e o leitor de uma biblioteca de código aberto usada em
   produção com o BB (eduardokum/laravel-boleto). O que ainda não foi conferido contra um
   arquivo de verdade está dito no comentário — nada aqui é chute silencioso.

   Fluxo, do jeito que o financeiro trabalha:
   1. Gerar cobranças do mês: mostra o que falta (índice não lançado), o que já foi gerado,
      simula em PDF e gera de uma vez: parcelas viram títulos e sai o arquivo de remessa.
   2. Parcela alterada depois de registrada no banco fica "marcada para remessa": o aviso
      aparece no topo da lista até sair a remessa de alteração (baixa do título antigo e
      registro de um novo) ou de baixa (paga por fora do banco).
   3. Retorno: o sistema lê, mostra o que entendeu e só dá baixa depois da confirmação.

   Regra de negócio: contrato com correção por índice não vira carnê. A parcela de outubro
   só tem valor final quando o índice de setembro é lançado, então a geração é mês a mês,
   conforme o índice entra. Contrato sem índice tem valor fixo e pode sair de uma vez. */
'use strict';

const CNAB = {
  '001': { nome: 'Banco do Brasil', colunas: 400, remessa: remessaBB, retorno: retornoBB }
};
function layoutCnab(banco) { return CNAB[pad(banco, 3)] || null; }

// ---------------------------------------------------------------- utilitários de coluna fixa
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

// ---------------------------------------------------------------- estado da parcela no banco
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
  if (faltando.length) return `Falta lançar ${getIndice(v.indiceId).codigo} de ${faltando.map(monthLabel).join(', ')}`;
  return null;
}
function registradaNoBanco(rec) { return !!(rec.nossoNumero && rec.remessaEm); }

/* O que a próxima remessa precisa dizer ao banco sobre esta parcela, se algo mudou depois
   que ela foi registrada. 'alterar' = baixa o título antigo e registra um novo com o valor ou
   vencimento atual; 'baixar' = foi paga por fora do banco ou cancelada, o banco precisa saber. */
function remessaPendente(rec) {
  if (!registradaNoBanco(rec)) return null;
  const st = recStatus(rec);
  if (st === 'pago') return rec.forma === 'Boleto' ? null : 'baixar';
  const v = getVenda(rec.vendaId);
  if (!v || v.status === 'distrato') return 'baixar';
  if (rec.bancoVenc && rec.bancoVenc !== rec.vencimento) return 'alterar';
  if (rec.bancoValor != null && Math.abs(recValor(rec) - num(rec.bancoValor)) > 0.005) return 'alterar';
  return null;
}
function pendentesDeRemessa(escopo) {
  return db.recebiveis.filter(r => noEscopo(r, escopo) && remessaPendente(r)).map(r => ({ r, acao: remessaPendente(r) }));
}
/* Parcelas do mês que ainda não viraram título. */
function parcelasDoMes(escopo, mes) {
  return db.recebiveis.filter(r => noEscopo(r, escopo) && monthKey(r.vencimento) === mes && r.tipo !== 'entrada' && recStatus(r) !== 'pago')
    .sort((a, b) => naturalCmp(clienteDe(a), clienteDe(b)) || a.vencimento.localeCompare(b.vencimento));
}

// ---------------------------------------------------------------- REMESSA — Banco do Brasil
/* Cada item: { comando: '01' registrar | '02' baixar, nossoNumero, vencimento, valor, sacado, mensagem }.
   Conferido contra a remessa real: header, detalhe tipo 7, registro de multa tipo 5 e trailer.
   O registro de multa só acompanha o comando 01, como no arquivo do banco. Da posição 23 em
   diante ele leva brancos: é o que o layout do BB define, confirmado pela biblioteca de
   referência; o "090" que aparecia no arquivo do sistema antigo é preenchimento do ERP, não
   campo do banco. */
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
    const comando = it.comando || '01';
    n++;
    linhas.push(linha400(['7', tpInsc, pad(cnpj, 14), ag, agDv, cc, ccDv, conv,
      pad(nn, 25),                                  // 039-063 controle do participante
      conv + nn,                                    // 064-080 nosso número (17)
      '00', '00', ' '.repeat(7),                    // 081-084 prestação e grupo, 085-091 brancos
      pad(conta.variacao || '0', 3),                // 092-094 variação da carteira
      '0000000', ' '.repeat(5),                     // 095-101, 102-106
      pad(conta.carteira, 2), comando,              // 107-108 carteira, 109-110 comando
      nn,                                           // 111-120 seu número
      dataDDMMAA(it.vencimento), dinheiro(it.valor, 13),
      '001', '0000', ' ',                           // 140-146 banco e agência cobradora
      ESPECIE_BB[conta.especie] || '01', conta.aceite === 'S' ? 'A' : 'N',
      dataDDMMAA(it.emissao || hoje),
      /* 157-160: instruções de cobrança. Os códigos mudam por banco e eu não tenho o manual
         para conferir os do BB; a remessa real da empresa vem com 00/00. Mandar um código
         errado pode fazer o banco protestar um comprador por engano, então só sai o que o
         usuário digitou do manual do banco dele. Sem isso, 00 = nenhuma instrução. */
      pad(o.instrucao1 || conta.instrucao1 || '00', 2),
      pad(o.instrucao2 || conta.instrucao2 || '00', 2),
      dinheiro(num(it.valor) * num(conta.jurosDia) / 100, 13),              // 161-173 juros por dia, em reais
      num(conta.descontoPct) > 0 ? dataDDMMAA(it.vencimento) : '000000',
      dinheiro(num(it.valor) * num(conta.descontoPct) / 100, 13),
      dinheiro(0, 13), dinheiro(0, 13),             // IOF e abatimento
      doc.length === 11 ? '01' : '02', pad(doc, 14), padTxt(sacado.nome, 37), ' '.repeat(3),
      padTxt(sacado.endereco, 40), padTxt(sacado.bairro, 12), pad(sacado.cep, 8),
      padTxt(sacado.cidade, 15), padTxt(sacado.uf, 2),
      padTxt(it.mensagem, 40), ' '.repeat(3), pad(n, 6)]));

    if (comando === '01' && num(conta.multaPct) > 0) {
      n++;
      linhas.push(linha400(['5', '99', '2', dataDDMMAA(it.vencimento),
        dinheiro(conta.multaPct, 12), ' '.repeat(372), pad(n, 6)]));
    }
  });

  linhas.push(linha400(['9', ' '.repeat(393), pad(n + 1, 6)]));
  return linhas.join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------- RETORNO — Banco do Brasil
const OCORRENCIAS_BB = {
  '02': ['confirmada', 'Entrada confirmada no banco'],
  '03': ['recusada', 'Comando recusado pelo banco'],
  '05': ['liquidada', 'Liquidação sem registro'],
  '06': ['liquidada', 'Liquidação (pagamento)'],
  '07': ['liquidada', 'Liquidação por conta'],
  '08': ['liquidada', 'Liquidação por saldo'],
  '09': ['baixada', 'Baixa de título'],
  '10': ['baixada', 'Baixa solicitada'],
  '11': ['info', 'Títulos em ser'],
  '12': ['info', 'Abatimento concedido'],
  '14': ['info', 'Alteração de vencimento confirmada'],
  '15': ['liquidada', 'Liquidação em cartório'],
  '16': ['info', 'Alteração de juros confirmada'],
  '19': ['info', 'Instrução de protesto confirmada'],
  '20': ['liquidada', 'Débito em conta'],
  '21': ['info', 'Alteração de nome/endereço confirmada'],
  '96': ['info', 'Tarifa sobre instruções'],
  '97': ['info', 'Tarifa sobre instruções de protesto'],
  '98': ['info', 'Tarifa sobre instruções de sustação']
};

/* Posições conferidas com o leitor de referência (laravel-boleto, BB CNAB 400):
   nosso número 064-080, ocorrência 109-110, data 111-116, seu número 117-126, vencimento
   147-152, valor 153-165, crédito 176-181, tarifa 182-188, outras despesas 189-201, IOF
   215-227, abatimento 228-240, desconto 241-253, valor recebido 254-266, mora 267-279,
   multa 280-292, motivo da rejeição 383-392. Ainda a conferir contra um retorno real com
   movimento — o único recebido não tinha ocorrência. */
function retornoBB(texto) {
  const linhas = String(texto).split(/\r?\n/).filter(l => l.length > 50);
  if (!linhas.length) throw new Error('Arquivo vazio');
  const head = linhas[0];
  if (head[0] !== '0' || head.slice(1, 9) !== '2RETORNO') throw new Error('Isto não parece um arquivo de retorno do Banco do Brasil');
  const cab = {
    agencia: head.slice(26, 30), conta: head.slice(31, 39), empresa: head.slice(46, 76).trim(),
    data: isoDeDDMMAA(head.slice(94, 100)), convenio: head.slice(149, 156).trim(), sequencial: head.slice(100, 107)
  };
  const fim = linhas[linhas.length - 1];
  if (fim && fim[0] === '9') {            // rodapé: posição da carteira, não deste arquivo
    cab.titulosEmSer = Math.round(num(fim.slice(17, 25)));
    cab.valorEmSer = num(fim.slice(25, 39)) / 100;
  }
  const itens = [], avisos = [];
  linhas.slice(1).forEach((l, i) => {
    if (l[0] !== '7') return;
    const cod = l.slice(108, 110);
    const oc = OCORRENCIAS_BB[cod] || ['info', 'Ocorrência ' + cod];
    const nossoNumero = l.slice(63, 80).trim();
    const item = {
      linha: i + 2, ocorrencia: cod, efeito: oc[0], descricao: oc[1], nossoNumero,
      seuNumero: l.slice(116, 126).trim(),
      data: isoDeDDMMAA(l.slice(110, 116)),
      vencimento: isoDeDDMMAA(l.slice(146, 152)),
      valorTitulo: num(l.slice(152, 165)) / 100,
      creditoEm: isoDeDDMMAA(l.slice(175, 181)),
      tarifa: num(l.slice(181, 188)) / 100,
      valorPago: num(l.slice(253, 266)) / 100,
      juros: num(l.slice(266, 279)) / 100,
      multa: num(l.slice(279, 292)) / 100,
      bancoPagador: l.slice(165, 168),
      motivo: oc[0] === 'recusada' ? l.slice(86, 88) : ''
    };
    const seq10 = pad(nossoNumero, 10);   // o banco devolve convênio + sequencial; comparamos o sequencial
    item.rec = db.recebiveis.find(r => r.nossoNumero && pad(r.nossoNumero, 10) === seq10) || null;
    if (!item.rec) avisos.push(`Linha ${item.linha}: nosso número ${nossoNumero} não é de nenhuma parcela deste sistema`);
    if (item.efeito === 'liquidada' && !(item.valorPago > 0)) avisos.push(`Linha ${item.linha}: liquidação sem valor pago legível — confira antes de baixar`);
    if (item.efeito === 'recusada') avisos.push(`Linha ${item.linha}: o banco recusou o título ${nossoNumero}${item.motivo ? ' (motivo ' + item.motivo + ')' : ''}`);
    itens.push(item);
  });
  return { cabecalho: cab, itens, avisos };
}

// ================================================================ NOSSO NÚMERO
/* O banco recusa título cujo nosso número já foi usado no mesmo convênio, e a recusa só
   aparece no retorno, dias depois. Por isso o número nunca volta atrás e nunca se repete:
   o contador do cadastro é só o ponto de partida; quem manda é o maior já gravado aqui.

   Atenção na migração: o sistema antigo continua consumindo números enquanto os dois rodam,
   e não dá para descobrir onde ele está olhando arquivos soltos. A saída é começar numa faixa
   separada, bem acima da dele — há 10 dígitos disponíveis, quase 10 bilhões de números. */
const NOSSO_NUMERO_MAX = 9999999999;
/* Marca d'água: o maior número que já saiu daqui para o banco. Fica gravado na conta porque
   a parcela pode trocar de número (alteração) ou sumir, mas o banco não esquece o antigo. */
function maiorNossoNumeroUsado(conta) {
  let maior = Math.max(0, Math.round(num(conta.nnMax)));
  db.recebiveis.forEach(r => { if (r.nossoNumero) maior = Math.max(maior, num(soDigitos(r.nossoNumero).slice(-10))); });
  db.remessas.forEach(r => { if (r.contaId === conta.id && r.ultimoNn) maior = Math.max(maior, num(soDigitos(r.ultimoNn).slice(-10))); });
  return maior;
}
function proximoNossoNumero(conta) {
  return Math.max(1, Math.round(num(conta.nossoNumeroAtual) || 1), maiorNossoNumeroUsado(conta) + 1);
}
function nossoNumeroEmUso(conta, n) {
  if (n <= maiorNossoNumeroUsado(conta)) return true;
  const alvo = pad(n, 10);
  return db.recebiveis.some(r => r.nossoNumero && pad(r.nossoNumero, 10) === alvo);
}

// ================================================================ MOTOR DA REMESSA
function sacadoDaVenda(v) {
  const c = (v && v.cliente) || {};
  return { nome: c.nome || '', cpf: c.cpf || '', endereco: c.endereco || '', bairro: c.bairro || '', cep: c.cep || '', cidade: c.cidade || db.config.cidade || '', uf: c.uf || '' };
}
function mensagemDoTitulo(conta, r) {
  const v = getVenda(r.vendaId), lot = getLoteamento(r.loteamentoId);
  return (conta.mensagem1 || '').replace('{{lote}}', v ? imovelLabel(v) : '').replace('{{loteamento}}', lot ? lot.nome : '');
}
/* Monta e grava uma remessa. novas: parcelas a registrar; pendentes: [{r, acao}] de
   alteração ou baixa. Devolve o texto do arquivo ou null se não havia nada. */
function emitirRemessa(lot, conta, novas, pendentes) {
  let nn = proximoNossoNumero(conta);
  const proximoLivre = () => { while (nossoNumeroEmUso(conta, nn)) nn++; if (nn > NOSSO_NUMERO_MAX) throw new Error('O nosso número passou de 10 dígitos. Fale comigo antes de continuar.'); return nn; };
  const itens = [], atualizar = [];
  (pendentes || []).forEach(({ r, acao }) => {
    const v = getVenda(r.vendaId);
    itens.push({ comando: '02', nossoNumero: r.nossoNumero, vencimento: r.bancoVenc || r.vencimento, valor: r.bancoValor != null ? r.bancoValor : recValor(r), sacado: sacadoDaVenda(v), mensagem: mensagemDoTitulo(conta, r) });
    if (acao === 'alterar') {
      proximoLivre();
      itens.push({ comando: '01', nossoNumero: nn, vencimento: r.vencimento, valor: recValor(r), sacado: sacadoDaVenda(v), mensagem: mensagemDoTitulo(conta, r) });
      atualizar.push(Object.assign({}, r, { nossoNumero: String(nn), remessaEm: todayStr(), bancoValor: recValor(r), bancoVenc: r.vencimento }));
      nn++;
    } else {
      atualizar.push(Object.assign({}, r, { forma: r.forma || 'Boleto', bancoValor: null, bancoVenc: null, remessaEm: null }));
    }
  });
  (novas || []).forEach(r => {
    if (bloqueioRemessa(r) || registradaNoBanco(r)) return;
    const v = getVenda(r.vendaId);
    proximoLivre();
    itens.push({ comando: '01', nossoNumero: nn, vencimento: r.vencimento, valor: recValor(r), sacado: sacadoDaVenda(v), mensagem: mensagemDoTitulo(conta, r) });
    atualizar.push(Object.assign({}, r, { nossoNumero: String(nn), remessaEm: todayStr(), bancoValor: recValor(r), bancoVenc: r.vencimento }));
    nn++;
  });
  if (!itens.length) return null;
  const seq = Math.max(1, Math.round(num(conta.remessaSeq) || 1));
  const texto = layoutCnab(conta.banco).remessa(conta, itens, { sequencial: seq });
  atualizar.forEach(r => upsert('recebiveis', r));
  upsert('contasBanco', Object.assign({}, conta, { nossoNumeroAtual: nn, nnMax: Math.max(num(conta.nnMax), nn - 1), remessaSeq: seq + 1 }));
  const registrados = itens.filter(i => i.comando === '01');
  const total = registrados.reduce((s, x) => s + x.valor, 0);
  const nome = 'CB' + pad(seq, 6) + '.REM';
  upsert('remessas', { id: genId(), loteamentoId: lot.id, contaId: conta.id, sequencial: seq, data: todayStr(), arquivo: nome,
    qtd: registrados.length, baixas: itens.length - registrados.length, valor: Math.round(total * 100) / 100,
    recIds: atualizar.map(r => r.id), primeiroNn: registrados.length ? String(registrados[0].nossoNumero) : '', ultimoNn: registrados.length ? String(registrados[registrados.length - 1].nossoNumero) : '',
    criadoEm: new Date().toISOString() });
  download(nome, texto, 'text/plain');
  logAct(`Remessa ${seq}: ${registrados.length} título(s) registrado(s), ${itens.length - registrados.length} baixa(s), ${fmtMoney(total)}`);
  return texto;
}
function contaPronta(lot) {
  const conta = contaCobranca(lot.id);
  if (!conta) {
    openModal({ title: '🏦 Falta a conta de cobrança', body: '<p class="help">Antes de gerar cobranças, cadastre o convênio da empresa em <b>Cadastros › 🏦 Banco</b>: agência, conta, convênio, carteira e as instruções padrão do boleto (multa, juros, protesto, baixa).</p>', footer: '<button class="btn btn-primary" onclick="closeModal();switchTab(\'cadastros\');state.sub.cad=\'banco\';renderCadastros()">Ir para o cadastro</button>' });
    return null;
  }
  if (!layoutCnab(conta.banco)) { toast('⚠️', 'Banco sem layout', 'Hoje só o Banco do Brasil gera remessa.', true); return null; }
  return conta;
}

// ================================================================ TELA: GERAR COBRANÇAS DO MÊS
function abrirGerarCobrancas(mes) {
  if (!pode('financeiro.baixar')) { toast('🔒', 'Sem permissão', 'Seu perfil não gera cobranças.', true); return; }
  /* A conta de cobrança é de cada empreendimento, então a remessa também é. */
  comEmpreendimento('🧾 Gerar cobranças', 'A conta de cobrança é de cada empreendimento, então a remessa sai de um por vez.',
    lot => gerarCobrancasTela(lot, mes), l => !!contaCobranca(l.id) && !!layoutCnab(contaCobranca(l.id).banco));
}
function gerarCobrancasTela(lot, mes) {
  const conta = contaPronta(lot); if (!conta) return;
  const m = mes || state.sub.cobMes || mesAtual();
  state.sub.cobMes = m;
  const parcelas = parcelasDoMes(lot.id, m);
  const geradas = parcelas.filter(registradaNoBanco);
  const abertas = parcelas.filter(r => !registradaNoBanco(r));
  const travadas = abertas.map(r => ({ r, motivo: bloqueioRemessa(r) })).filter(x => x.motivo);
  const prontas = abertas.filter(r => !bloqueioRemessa(r));
  const pend = pendentesDeRemessa(lot.id);
  const semIndice = {};
  travadas.forEach(x => { const v = getVenda(x.r.vendaId); if (v) semIndice[v.id] = x.motivo; });
  const total = prontas.reduce((s, r) => s + recValor(r), 0);
  openModal({
    title: '🧾 Gerar cobranças', wide: true,
    body: `<div class="subtabs" style="justify-content:center"><div class="chip" onclick="gerarCobrancasTela(getLoteamento('${lot.id}'),'${mesAnterior(m)}')">‹ ${monthLabel(mesAnterior(m))}</div><div class="chip active">${esc(lot.nome)} · ${monthLabel(m)}</div><div class="chip" onclick="gerarCobrancasTela(getLoteamento('${lot.id}'),'${mesSeguinte(m)}')">${monthLabel(mesSeguinte(m))} ›</div></div>
      <div class="kpi-grid">
        <div class="kpi ${Object.keys(semIndice).length ? 'c-red' : 'c-green'}"><div class="lbl">Contratos sem índice do mês</div><div class="val">${Object.keys(semIndice).length}</div><div class="sub">${Object.keys(semIndice).length ? 'lance o índice antes de gerar' : 'todos os índices lançados'}</div></div>
        <div class="kpi c-blue"><div class="lbl">Já geradas em ${monthLabel(m)}</div><div class="val">${geradas.length}</div><div class="sub">registradas no banco</div></div>
        <div class="kpi c-amber"><div class="lbl">Prontas para gerar</div><div class="val">${prontas.length}</div><div class="sub">${fmtMoney(total)}</div></div>
      </div>
      ${Object.keys(semIndice).length ? `<div class="card"><h3>⏳ Contratos esperando índice</h3>
        <p class="help">Estes contratos sofrem correção mensal e o índice que corrige a parcela de ${monthLabel(m)} ainda não foi lançado. Gerar agora mandaria boleto com valor errado, então eles ficam de fora até você lançar em <b>Cadastros › Índices</b>.</p>
        ${Object.keys(semIndice).map(vid => { const v = getVenda(vid); return `<div class="item"><div class="info"><div class="title">${esc(imovelLabel(v))} · ${esc(v.cliente.nome || '')}</div><div class="meta"><span>${esc(semIndice[vid])}</span></div></div></div>`; }).join('')}</div>` : ''}
      ${pend.length ? `<div class="alert warn" style="cursor:default"><span><b>${pend.length} cobrança(s) alterada(s) depois de registrada(s)</b> vão junto nesta remessa, para o banco atualizar: ${pend.filter(x => x.acao === 'alterar').length} alteração(ões) e ${pend.filter(x => x.acao === 'baixar').length} baixa(s).</span></div>` : ''}
      ${prontas.length ? `<div class="card"><h3>O que vai ser gerado</h3>
        <p class="help">Uma cobrança por parcela. O sistema numera o nosso número, marca como registrada e gera o arquivo de remessa para você enviar ao banco.</p>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Cliente</th><th>Lote</th><th>Parcela</th><th>Vencimento</th><th class="num">Valor</th></tr></thead><tbody>
        ${prontas.map(r => { const v = getVenda(r.vendaId); return `<tr><td>${esc(v.cliente.nome || '')}</td><td>${esc(imovelShort(v))}</td><td>${esc(r.descricao || '')}</td><td>${fmtDate(r.vencimento)}</td><td class="num">${esc(fmtMoney(recValor(r)))}</td></tr>`; }).join('')}
        </tbody><tfoot><tr><td colspan="4">Total</td><td class="num">${esc(fmtMoney(total))}</td></tr></tfoot></table></div></div>`
        : `<div class="empty"><div class="ic">📭</div><p><b>Nada a gerar em ${monthLabel(m)}</b></p><p class="small">${geradas.length ? 'As cobranças deste mês já foram geradas.' : 'Nenhuma parcela em aberto neste mês.'}</p></div>`}`,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
      ${prontas.length ? `<button class="btn btn-outline" onclick="simularCobrancas('${lot.id}','${m}')">🖨️ Simular</button><button class="btn btn-primary" onclick="gerarCobrancas('${lot.id}','${m}')">Gerar agora</button>` : pend.length ? `<button class="btn btn-primary" onclick="gerarRemessaPendente('${lot.id}')">Gerar remessa das alterações</button>` : ''}`
  });
}
/* Simulação em PDF: o que sairia se você gerasse agora, agrupado por cliente, como o
   financeiro está acostumado a conferir antes de mandar ao banco. */
function simularCobrancas(lotId, mes) {
  const lot = getLoteamento(lotId); const conta = contaCobranca(lot.id);
  const prontas = parcelasDoMes(lot.id, mes).filter(r => !registradaNoBanco(r) && !bloqueioRemessa(r));
  const porVenda = {};
  prontas.forEach(r => { (porVenda[r.vendaId] = porVenda[r.vendaId] || []).push(r); });
  const total = prontas.reduce((s, r) => s + recValor(r), 0);
  $('#printArea').innerHTML = `
    <h1>${esc(db.config.empresa || lot.nome)}</h1>
    <h2>Simulação da geração de cobranças — ${monthLabel(mes)}</h2>
    <p>${esc(lot.nome)} · ${prontas.length} cobrança(s) · ${esc(fmtMoney(total))} · ${conta ? 'Banco ' + esc(BANCOS[pad(conta.banco, 3)].nome) + ', convênio ' + esc(conta.convenio) : ''}</p>
    ${Object.keys(porVenda).map(vid => { const v = getVenda(vid); const recs = porVenda[vid];
      return `<h3 style="margin:14px 0 4px">${esc(v.cliente.nome || '')} — ${esc(imovelLabel(v))}</h3>
        <table class="tbl"><thead><tr><th>Parcela</th><th>Vencimento</th><th>Valor base</th><th>Correção</th><th>Total</th></tr></thead><tbody>
        ${recs.map(r => `<tr><td>${esc(r.descricao || '')}</td><td>${fmtDate(r.vencimento)}</td><td>${esc(fmtMoney(r.valor))}</td><td>${esc(fmtMoney(recCorrecao(r)))}</td><td><b>${esc(fmtMoney(recValor(r)))}</b></td></tr>`).join('')}
        </tbody></table><p style="text-align:right"><b>Total do cliente: ${esc(fmtMoney(recs.reduce((s, r) => s + recValor(r), 0)))}</b></p>`; }).join('')}
    <p style="margin-top:14px">Simulação emitida em ${fmtDate(todayStr())}. Nada foi gerado nem enviado ao banco.</p>`;
  window.print();
}
function gerarCobrancas(lotId, mes) {
  const lot = getLoteamento(lotId); const conta = contaPronta(lot); if (!conta) return;
  const prontas = parcelasDoMes(lot.id, mes).filter(r => !registradaNoBanco(r) && !bloqueioRemessa(r));
  const pend = pendentesDeRemessa(lot.id);
  let texto;
  try { texto = emitirRemessa(lot, conta, prontas, pend); }
  catch (e) { toast('⚠️', 'Falha ao montar o arquivo', e.message, true); return; }
  if (!texto) { toast('⚠️', 'Nada a gerar', '', true); return; }
  closeModal(); renderCurrent();
  toast('✅', 'Cobranças geradas', `${prontas.length} título(s) em ${monthLabel(mes)}${pend.length ? ' + ' + pend.length + ' alteração(ões)' : ''}. Envie o arquivo ao banco.`);
}
/* Só as alterações e baixas pendentes, sem gerar cobrança nova. É o botão do aviso. */
function gerarRemessaPendente(lotId) {
  if (!pode('financeiro.baixar')) { toast('🔒', 'Sem permissão', '', true); return; }
  if (!lotId) { comEmpreendimento('📤 Remessa de alterações', 'De qual empreendimento?', l => gerarRemessaPendente(l.id), l => pendentesDeRemessa(l.id).length); return; }
  const lot = getLoteamento(lotId); const conta = contaPronta(lot); if (!conta) return;
  const pend = pendentesDeRemessa(lot.id);
  if (!pend.length) { toast('ℹ️', 'Nada pendente', '', true); return; }
  let texto;
  try { texto = emitirRemessa(lot, conta, [], pend); }
  catch (e) { toast('⚠️', 'Falha ao montar o arquivo', e.message, true); return; }
  closeModal(); renderCurrent();
  toast('✅', 'Remessa de alterações gerada', `${pend.length} título(s). Envie o arquivo ao banco.`);
}
/* Aviso no topo da lista de recebíveis, igual ao ERP: enquanto houver alteração não enviada. */
function avisoRemessaHtml(escopo) {
  const pend = pendentesDeRemessa(escopo).filter(x => { const c = contaCobranca(x.r.loteamentoId); return c && layoutCnab(c.banco); });
  if (!pend.length) return '';
  const alt = pend.filter(x => x.acao === 'alterar').length, bx = pend.length - alt;
  const emps = [...new Set(pend.map(x => x.r.loteamentoId))];
  return `<div class="alert warn" onclick="gerarRemessaPendente(${emps.length === 1 ? `'${emps[0]}'` : ''})"><span><b>${pend.length} cobrança(s) marcada(s) para remessa</b> — ${alt ? alt + ' alterada(s) depois de registrada(s)' : ''}${alt && bx ? ' e ' : ''}${bx ? bx + ' para baixar no banco' : ''}${emps.length > 1 ? ` em ${emps.length} empreendimentos` : ''}. O banco ainda tem o boleto antigo. <u>Gerar remessa</u></span></div>`;
}

// ================================================================ TELA: LER RETORNO
function abrirRetorno() {
  if (!pode('financeiro.baixar')) { toast('🔒', 'Sem permissão', 'Seu perfil não dá baixa.', true); return; }
  if (!curLot() || !contaCobranca(curLot().id)) { comEmpreendimento('📥 Ler retorno', 'De qual conta de cobrança é este arquivo?', () => abrirRetorno(), l => !!contaCobranca(l.id)); return; }
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
  const recusados = r.itens.filter(x => x.efeito === 'recusada' && x.rec);
  const tarifas = r.itens.reduce((s, x) => s + num(x.tarifa), 0);
  const total = baixar.reduce((s, x) => s + (x.valorPago || 0), 0);
  const linha = x => {
    const v = x.rec && getVenda(x.rec.vendaId);
    return `<tr><td>${x.rec ? esc(v ? imovelLabel(v) : '') + ' · ' + esc(x.rec.descricao || '') : '<span class="muted">não localizada</span>'}</td>
      <td>${esc(x.nossoNumero)}</td><td>${esc(x.descricao)}${x.motivo ? ' <span class="muted">(' + esc(x.motivo) + ')</span>' : ''}</td><td>${x.data ? fmtDate(x.data) : '—'}</td>
      <td class="num">${esc(fmtMoney(x.valorPago))}</td></tr>`;
  };
  openModal({ title: '📥 Retorno · ' + esc(r.nomeArquivo || ''), wide: true,
    body: `<p class="help mb">Arquivo de <b>${esc(r.cabecalho.empresa)}</b>, agência ${esc(r.cabecalho.agencia)} conta ${esc(r.cabecalho.conta)}, gerado em ${r.cabecalho.data ? fmtDate(r.cabecalho.data) : '—'}. ${r.itens.length} ocorrência(s).${r.cabecalho.titulosEmSer ? ` Segundo o banco, a carteira tem <b>${r.cabecalho.titulosEmSer} título(s) em ser</b>, somando ${esc(fmtMoney(r.cabecalho.valorEmSer))}.` : ''}</p>
      ${tarifas > 0.005 ? `<div class="alert info" style="cursor:default"><span>O banco cobrou <b>${esc(fmtMoney(tarifas))}</b> de tarifa neste arquivo (${esc(fmtMoney(tarifas / Math.max(1, r.itens.filter(x => x.tarifa > 0).length)))} por título). Isso não sai das parcelas — lance como despesa bancária se quiser acompanhar.</span></div>` : ''}
      ${!r.itens.length ? '<div class="alert info" style="cursor:default"><span>Este arquivo não tem nenhuma ocorrência: só cabeçalho e rodapé. É o retorno de um dia sem movimento.</span></div>' : ''}
      ${baixar.length ? `<div class="card"><h3>Vão ser baixadas <span class="badge pago">${esc(fmtMoney(total))}</span></h3>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Parcela</th><th>Nosso número</th><th>Ocorrência</th><th>Data</th><th class="num">Pago</th></tr></thead><tbody>${baixar.map(linha).join('')}</tbody></table></div></div>` : ''}
      ${r.itens.length && !baixar.length ? '<div class="alert info" style="cursor:default"><span>Nenhuma liquidação nova para dar baixa. As demais ocorrências são informativas.</span></div>' : ''}
      ${r.itens.filter(x => x.efeito !== 'liquidada').length ? `<div class="card"><h3>Outras ocorrências</h3>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Parcela</th><th>Nosso número</th><th>Ocorrência</th><th>Data</th><th class="num">Valor</th></tr></thead><tbody>${r.itens.filter(x => x.efeito !== 'liquidada').map(linha).join('')}</tbody></table></div></div>` : ''}
      ${recusados.length ? `<div class="card"><h3>🚫 ${recusados.length} título(s) recusado(s) pelo banco</h3>
        <p class="help">Estes títulos não foram registrados — motivo mais comum é nosso número já usado no convênio. Ao confirmar, eles voltam a ficar sem registro e saem na próxima remessa com um número novo.</p>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Parcela</th><th>Nosso número</th><th>Motivo</th></tr></thead><tbody>
        ${recusados.map(x => { const v = getVenda(x.rec.vendaId); return `<tr><td>${esc(v ? imovelLabel(v) : '')} · ${esc(x.rec.descricao || '')}</td><td>${esc(x.nossoNumero)}</td><td>${esc(x.motivo || '—')}</td></tr>`; }).join('')}
        </tbody></table></div></div>` : ''}
      ${r.avisos.length ? `<div class="card"><h3>⚠️ Confira antes</h3>${r.avisos.slice(0, 20).map(a => `<p class="help">${esc(a)}</p>`).join('')}</div>` : ''}`,
    footer: baixar.length || recusados.length ? `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-success" onclick="aplicarRetorno()">${baixar.length ? 'Dar baixa em ' + baixar.length + ' parcela(s)' : ''}${baixar.length && recusados.length ? ' e liberar ' : ''}${!baixar.length && recusados.length ? 'Liberar ' + recusados.length + ' recusado(s)' : recusados.length ? recusados.length + ' recusado(s)' : ''}</button>`
      : `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>` });
}
function aplicarRetorno() {
  const r = _retornoLido; if (!r) return;
  let n = 0, soma = 0, recusados = 0;
  /* Título recusado pelo banco (nosso número repetido, dado inválido) volta a não registrado,
     para a próxima remessa mandá-lo de novo com um número novo. */
  r.itens.filter(x => x.efeito === 'recusada' && x.rec).forEach(x => {
    const rec = db.recebiveis.find(y => y.id === x.rec.id); if (!rec) return;
    upsert('recebiveis', Object.assign({}, rec, { nossoNumero: null, remessaEm: null, bancoValor: null, bancoVenc: null,
      obsPagamento: `Recusado pelo banco em ${fmtDate(x.data || todayStr())}${x.motivo ? ' (motivo ' + x.motivo + ')' : ''}` }));
    recusados++;
  });
  r.itens.filter(x => x.efeito === 'liquidada' && x.rec && recStatus(x.rec) !== 'pago').forEach(x => {
    const rec = db.recebiveis.find(y => y.id === x.rec.id); if (!rec) return;
    if (recStatus(rec) === 'pago') return;   // já baixada por outra linha do mesmo arquivo
    const pago = x.valorPago || recValor(rec);
    const devido = recValor(rec);
    upsert('recebiveis', Object.assign({}, rec, {
      valorPago: pago, dataPagamento: x.data || todayStr(), forma: 'Boleto',
      obsPagamento: `Baixa pelo retorno ${r.nomeArquivo || ''}`.trim(),
      valorCorrigido: Math.round(Math.max(devido, pago) * 100) / 100
    }));
    atualizarStatusVenda(rec.vendaId);
    n++; soma += pago;
  });
  logAct(`Retorno ${r.nomeArquivo || ''}: ${n} baixa(s), ${fmtMoney(soma)}${recusados ? `, ${recusados} recusado(s) pelo banco` : ''}`);
  _retornoLido = null;
  closeModal(); renderCurrent();
  toast('✅', 'Retorno aplicado', `${n} baixa(s) · ${fmtMoney(soma)}${recusados ? ` · ${recusados} recusado(s), volta(m) na próxima remessa` : ''}`);
}

// ================================================================ HISTÓRICO DE REMESSAS
function cadRemessasHtml() {
  const lot = curLot(); if (!lot) return '';
  const lista = db.remessas.filter(r => r.loteamentoId === lot.id).sort((a, b) => String(b.data).localeCompare(String(a.data)));
  if (!lista.length) return '<p class="help">Nenhuma remessa gerada ainda.</p>';
  return `<div class="table-wrap"><table class="tbl"><thead><tr><th>Arquivo</th><th>Data</th><th>Registrados</th><th>Baixas</th><th class="num">Valor</th><th>Nosso número</th></tr></thead><tbody>
    ${lista.map(r => `<tr><td>${esc(r.arquivo)}</td><td>${fmtDate(r.data)}</td><td>${r.qtd}</td><td>${r.baixas || 0}</td><td class="num">${esc(fmtMoney(r.valor))}</td><td>${r.primeiroNn ? esc(r.primeiroNn) + ' a ' + esc(r.ultimoNn) : '—'}</td></tr>`).join('')}
  </tbody></table></div>`;
}
