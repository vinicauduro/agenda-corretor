/* ===== Gestão de Loteamento — conta de cobrança e boleto =====
   Base da cobrança bancária: cadastro do convênio da empresa, numeração do nosso número,
   código de barras e linha digitável no padrão Febraban, e o boleto para imprimir.
   O que é específico de cada banco fica isolado em BANCOS, para conferir com o manual. */
'use strict';

const BANCOS = {
  '001': {
    nome: 'Banco do Brasil', carteiras: ['11', '17', '18', '31'], nossoNumeroDigitos: 17,
    /* Campo livre do BB (25 posições). Duas montagens clássicas, conforme o tamanho do
       convênio. A conferir com o manual de cobrança do banco antes de usar em produção. */
    campoLivre(c, nossoNumero) {
      const conv = soDigitos(c.convenio);
      if (conv.length >= 7) return '000000' + pad(conv, 7) + pad(soDigitos(nossoNumero).slice(-10), 10) + pad(c.carteira, 2);
      return pad(conv, 6) + pad(soDigitos(nossoNumero).slice(-5), 5) + pad(soDigitos(c.agencia), 4) + pad(soDigitos(c.conta), 8) + pad(c.carteira, 2);
    },
    /* O BB imprime o nosso número com 20 posições, preenchido com zeros à esquerda, e o
       dígito verificador em seguida. Conferido contra um boleto real: 00030264480000001819-0 */
    nossoNumeroImpresso(c, nossoNumero) {
      const conv = soDigitos(c.convenio);
      const base = conv.length >= 7 ? pad(conv, 7) + pad(soDigitos(nossoNumero).slice(-10), 10) : pad(conv, 6) + pad(soDigitos(nossoNumero).slice(-5), 5);
      return pad(base, 20) + '-' + dvModulo11Banco(pad(base, 20));
    }
  },
  '104': { nome: 'Caixa Econômica Federal', carteiras: ['14', '24'], nossoNumeroDigitos: 17, campoLivre: null, nossoNumeroImpresso: null },
  '237': { nome: 'Bradesco', carteiras: ['09', '06', '19'], nossoNumeroDigitos: 11, campoLivre: null, nossoNumeroImpresso: null },
  '756': { nome: 'Sicoob', carteiras: ['01', '02'], nossoNumeroDigitos: 10, campoLivre: null, nossoNumeroImpresso: null },
  '336': { nome: 'C6 Bank', carteiras: ['01'], nossoNumeroDigitos: 11, campoLivre: null, nossoNumeroImpresso: null }
};

function soDigitos(s) { return String(s ?? '').replace(/\D/g, ''); }
function pad(v, n) { return soDigitos(v).slice(-n).padStart(n, '0'); }
/* Texto para arquivo de coluna fixa: sem acento, maiúsculo e só ASCII. Qualquer caractere
   fora do ASCII vira espaço — em UTF-8 ele ocuparia dois bytes e o registro deixaria de
   ter 400 posições, que é como o banco conta. */
function padTxt(s, n) { return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, ' ').toUpperCase().slice(0, n).padEnd(n, ' '); }

/* Dígito verificador do código de barras (módulo 11, pesos 2 a 9, resto 0/1/10 vira 1). */
function dvCodigoBarras(base43) {
  let peso = 2, soma = 0;
  for (let i = base43.length - 1; i >= 0; i--) { soma += Number(base43[i]) * peso; peso = peso === 9 ? 2 : peso + 1; }
  const resto = soma % 11, dv = 11 - resto;
  return (dv === 0 || dv === 10 || dv === 11) ? 1 : dv;
}
/* Módulo 10, usado nos campos da linha digitável. */
function dvModulo10(num) {
  let soma = 0, peso = 2;
  for (let i = num.length - 1; i >= 0; i--) {
    let v = Number(num[i]) * peso;
    if (v > 9) v -= 9;
    soma += v; peso = peso === 2 ? 1 : 2;
  }
  return (10 - (soma % 10)) % 10;
}
/* Módulo 11 dos bancos, para nosso número (resto 10 vira X, 0 e 1 viram 0). */
function dvModulo11Banco(num) {
  let peso = 2, soma = 0;
  for (let i = num.length - 1; i >= 0; i--) { soma += Number(num[i]) * peso; peso = peso === 9 ? 2 : peso + 1; }
  const resto = soma % 11;
  if (resto === 0) return '0';
  if (resto === 1) return 'X';
  return String(11 - resto);
}
/* Fator de vencimento Febraban: dias desde 07/10/1997, com a virada de 2025 já tratada. */
function fatorVencimento(venc) {
  const base = Date.UTC(1997, 9, 7);
  const [y, m, d] = String(venc).split('-').map(Number);
  const dias = Math.round((Date.UTC(y, m - 1, d) - base) / 86400000);
  if (dias < 1000) return '0000';
  return String(((dias - 1000) % 9000) + 1000);
}

/* Código de barras de 44 posições. */
function codigoBarras(conta, nossoNumero, venc, valor) {
  const banco = pad(conta.banco, 3);
  const perfil = BANCOS[banco];
  if (!perfil || !perfil.campoLivre) throw new Error('Layout do banco ainda não configurado.');
  const livre = pad(perfil.campoLivre(conta, nossoNumero), 25);
  // 43 posições sem o dígito: banco(3) moeda(1) fator(4) valor(10) campo livre(25)
  const base43 = banco + '9' + fatorVencimento(venc) + pad(Math.round(num(valor) * 100), 10) + livre;
  const dv = dvCodigoBarras(base43);
  return base43.slice(0, 4) + dv + base43.slice(4);
}
/* Linha digitável (47 dígitos) a partir do código de barras. */
function linhaDigitavel(cb) {
  const c1 = cb.slice(0, 4) + cb.slice(19, 24);
  const c2 = cb.slice(24, 34);
  const c3 = cb.slice(34, 44);
  const fmt = campo => campo.slice(0, 5) + '.' + campo.slice(5) + dvModulo10(campo);
  return `${fmt(c1)} ${fmt(c2)} ${fmt(c3)} ${cb[4]} ${cb.slice(5, 19)}`;
}
/* Confere a linha digitável reconstruindo o código de barras. */
function barrasDaLinha(linha) {
  const n = soDigitos(linha);
  if (n.length !== 47) return null;
  return n.slice(0, 4) + n[32] + n.slice(33, 47) + n.slice(4, 9) + n.slice(10, 20) + n.slice(21, 31);
}

/* Desenho do código de barras no padrão 2 de 5 intercalado, em SVG. */
const I25 = { '0': 'nnwwn', '1': 'wnnnw', '2': 'nwnnw', '3': 'wwnnn', '4': 'nnwnw', '5': 'wnwnn', '6': 'nwwnn', '7': 'nnnww', '8': 'wnnwn', '9': 'nwnwn' };
function barrasSvg(cb, altura) {
  const h = altura || 50;
  let barras = '110'; // início
  for (let i = 0; i < cb.length; i += 2) {
    const a = I25[cb[i]], b = I25[cb[i + 1]];
    for (let k = 0; k < 5; k++) { barras += (a[k] === 'w' ? '111' : '1') + (b[k] === 'w' ? '000' : '0'); }
  }
  barras += '1001'; // fim
  let x = 0, rects = '';
  let i = 0;
  while (i < barras.length) {
    let j = i; while (j < barras.length && barras[j] === barras[i]) j++;
    const larg = j - i;
    if (barras[i] === '1') rects += `<rect x="${x}" y="0" width="${larg}" height="${h}" fill="#000"/>`;
    x += larg; i = j;
  }
  return `<svg class="boleto-barras" viewBox="0 0 ${x} ${h}" width="${Math.min(x, 420)}" height="${h}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
}

// ================================================================ CADASTRO DA CONTA
/* O contrato fala em juros ao mês; o arquivo do banco quer o valor em reais por dia.
   Contas antigas guardavam só o valor ao dia, então a conversão aceita os dois. */
function jurosMesDaConta(c) { return c && c.jurosMesPct != null ? num(c.jurosMesPct) : num((c || {}).jurosDia) * 30; }
function jurosDiaDaConta(c) { return jurosMesDaConta(c) / 30; }
function fmtNumPlano(v) { return String(Math.round(num(v) * 10000) / 10000).replace('.', ','); }
function contaCobranca(loteamentoId) {
  return db.contasBanco.find(c => c.loteamentoId === loteamentoId) || db.contasBanco.find(c => !c.loteamentoId) || null;
}
/* Uma empresa pode ter mais de uma conta de cobrança. A conta sem empreendimento vale para
   todos; uma conta com empreendimento cobra só as vendas daquele. O banco exige um arquivo
   de remessa por convênio, então é por conta que a cobrança se organiza. */
function cadBancoHtml() {
  if (!pode('config.editar')) return semPermissaoHtml('cadastro bancário');
  const editandoId = state.sub.contaEdit;
  const lista = db.contasBanco;
  if (!editandoId && lista.length) return listaContasHtml(lista);
  const c = (editandoId && db.contasBanco.find(x => x.id === editandoId)) || { banco: '001', carteira: '17', variacao: '019', nossoNumeroAtual: 1, remessaSeq: 1, protestoDias: 0, baixaDias: 0, multaPct: num(db.config.multaPct) || 2, jurosMesPct: num(db.config.jurosMesPct) || 1, descontoPct: 0, especie: 'DM', aceite: 'N', mensagem1: '', mensagem2: '' };
  const perfil = BANCOS[pad(c.banco, 3)] || BANCOS['001'];
  return `<div class="card"><h3>🏦 ${c.id ? 'Editar conta de cobrança' : 'Nova conta de cobrança'} ${lista.length ? '<span class="h-actions"><button class="btn btn-secondary btn-sm" onclick="state.sub.contaEdit=null;renderCadastros()">‹ Voltar</button></span>' : ''}</h3>
    <p class="help">Dados do convênio de cobrança registrada da empresa. Eles vão no boleto e no arquivo de remessa. Cada empresa preenche os seus; o layout de cada banco é do sistema.</p>
    <div class="fg"><label>Cobra quais vendas?</label><select id="bcEmp">
      <option value="" ${!c.loteamentoId ? 'selected' : ''}>Todos os empreendimentos</option>
      ${db.loteamentos.map(l => `<option value="${esc(l.id)}" ${c.loteamentoId === l.id ? 'selected' : ''}>Só ${esc(l.nome)}</option>`).join('')}
    </select><div class="hint">Com uma conta só, tudo cai nela. Se um empreendimento tiver conta própria, as vendas dele vão para essa; o resto continua na conta geral.</div></div>
    <div class="frow"><div class="fg"><label>Banco</label><select id="bcBanco" onchange="renderCadastros()">${Object.entries(BANCOS).map(([k, v]) => `<option value="${k}" ${pad(c.banco, 3) === k ? 'selected' : ''}>${k} — ${esc(v.nome)}</option>`).join('')}</select></div>
      <div class="fg"><label>Carteira</label><select id="bcCarteira">${perfil.carteiras.map(x => `<option value="${x}" ${c.carteira === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div></div>
    <div class="frow3"><div class="fg"><label>Agência (sem dígito)</label><input type="text" id="bcAgencia" value="${esc(c.agencia || '')}" placeholder="1234"></div>
      <div class="fg"><label>Dígito da agência</label><input type="text" id="bcAgenciaDv" value="${esc(c.agenciaDv || '')}" maxlength="1"></div>
      <div class="fg"><label>Variação da carteira</label><input type="text" id="bcVariacao" value="${esc(c.variacao || '')}" placeholder="019"></div></div>
    <div class="frow3"><div class="fg"><label>Conta corrente</label><input type="text" id="bcConta" value="${esc(c.conta || '')}"></div>
      <div class="fg"><label>Dígito da conta</label><input type="text" id="bcContaDv" value="${esc(c.contaDv || '')}" maxlength="1"></div>
      <div class="fg"><label>Convênio / código do cedente</label><input type="text" id="bcConvenio" value="${esc(c.convenio || '')}" placeholder="1234567"></div></div>
    <div class="fg"><label>Próxima remessa (sequencial)</label><input type="number" id="bcSeq" value="${c.remessaSeq || 1}"></div>
    <div class="alert info" style="cursor:default"><span><b>O nosso número é do sistema.</b> Cada boleto recebe o seu sozinho, ${c.id ? `a partir de <b>${proximoNossoNumero(c)}</b>` : `começando em <b>${NN_INICIAL}</b>`}, sem repetir e sem voltar atrás — o banco recusa título cujo número já foi usado neste convênio. A faixa começa bem acima da que o seu sistema antigo estaria usando — ele estava na casa dos milhares, e daqui ele levaria décadas para chegar. Cada conta tem a sua numeração, porque o banco exige que o número seja único dentro do convênio, não entre bancos.</span></div>
    <div class="fieldset"><span class="lg">📄 Instruções do boleto</span>
      <div class="frow3"><div class="fg"><label>Multa por atraso (%)</label><input type="number" id="bcMulta" step="0.01" value="${c.multaPct ?? 2}"></div>
        <div class="fg"><label>Juros de mora (% ao mês)</label><input type="number" id="bcJuros" step="0.01" value="${fmtNumPlano(jurosMesDaConta(c))}"><div class="hint">O banco cobra por dia; o sistema divide por 30 sozinho.</div></div>
        <div class="fg"><label>Desconto até o vencimento (%)</label><input type="number" id="bcDesc" step="0.01" value="${c.descontoPct ?? 0}"></div></div>
      <div class="frow3"><div class="fg"><label>Protestar após (dias)</label><input type="number" id="bcProtesto" value="${c.protestoDias ?? 0}"><div class="hint">0 = não protestar</div></div>
        <div class="fg"><label>Baixar após vencimento (dias)</label><input type="number" id="bcBaixa" value="${c.baixaDias ?? 0}"></div>
        <div class="fg"><label>Espécie / aceite</label><select id="bcEspecie"><option value="DM" ${c.especie === 'DM' ? 'selected' : ''}>Duplicata mercantil</option><option value="DS" ${c.especie === 'DS' ? 'selected' : ''}>Duplicata de serviço</option><option value="OU" ${c.especie === 'OU' ? 'selected' : ''}>Outros</option></select></div></div>
      <p class="help">Os dias acima saem <b>impressos no boleto</b>, como aviso ao comprador. O banco não protesta nem baixa nada por conta própria: para isso ele precisaria de um código de instrução, que muda de banco para banco e que o sistema não manda. É de propósito — um código errado faria o banco protestar um comprador por engano. Se um dia você quiser mesmo o protesto automático, a gente liga isso junto com o seu gerente.</p>
      <div class="fg"><label>Mensagem 1 no boleto</label><input type="text" id="bcMsg1" value="${esc(c.mensagem1 || '')}" placeholder="Referente ao lote {{lote}} do {{loteamento}}"></div>
      <div class="fg"><label>Mensagem 2 no boleto</label><input type="text" id="bcMsg2" value="${esc(c.mensagem2 || '')}" placeholder="Não receber após 30 dias do vencimento"></div></div>
    <div class="btn-row">${c.id ? `<button class="btn btn-outline-danger" onclick="excluirContaBanco('${c.id}')">Excluir</button>` : ''}<button class="btn btn-primary" onclick="salvarContaBanco('${c.id || ''}')">Salvar conta de cobrança</button>
      ${c.id ? `<button class="btn btn-secondary" onclick="testarBoleto('${c.id}')">👁️ Ver um boleto de exemplo</button>` : ''}</div>
    ${!perfil.campoLivre ? `<div class="alert warn" style="cursor:default;margin-top:10px"><span>O layout do ${esc(perfil.nome)} ainda não está implementado. Hoje o sistema gera boleto do Banco do Brasil; os outros entram assim que eu tiver o manual de cada um.</span></div>` : ''}
    ${layoutCnab(c.banco) ? `<div class="fieldset"><span class="lg">📤 Remessa e retorno</span>
      <p class="help">A remessa sai da aba <b>Recebíveis</b>, no botão <b>📤 Remessa</b>: você escolhe as parcelas e o sistema monta o arquivo. O retorno entra pelo botão <b>📥 Retorno</b>, com tela de conferência antes de dar baixa.</p>
      ${cadRemessasHtml(c.id)}</div>` : ''}</div>`;
}

function listaContasHtml(lista) {
  return `<div class="card"><h3>🏦 Contas de cobrança <span class="h-actions"><button class="btn btn-primary btn-sm" onclick="state.sub.contaEdit='nova';renderCadastros()">＋ Nova conta</button></span></h3>
    <p class="help mb">O banco aceita um arquivo de remessa por convênio, então é por conta que a cobrança se organiza. Com uma conta só, todos os empreendimentos saem juntos.</p>
    ${lista.map(c => { const b = BANCOS[pad(c.banco, 3)]; const emp = c.loteamentoId && getLoteamento(c.loteamentoId);
      const n = db.recebiveis.filter(r => { const x = contaCobranca(r.loteamentoId); return x && x.id === c.id && recStatus(r) !== 'pago'; }).length;
      return `<div class="item" onclick="state.sub.contaEdit='${c.id}';renderCadastros()"><div class="info">
        <div class="title">${esc((b || {}).nome || c.banco)} · ag ${esc(c.agencia)}${c.agenciaDv ? '-' + esc(c.agenciaDv) : ''} / conta ${esc(c.conta)}${c.contaDv ? '-' + esc(c.contaDv) : ''} ${b && b.campoLivre ? '' : '<span class="badge neutral">sem layout</span>'}</div>
        <div class="meta"><span>convênio ${esc(c.convenio)}</span><span>· carteira ${esc(c.carteira)}</span><span>· ${emp ? 'só ' + esc(emp.nome) : 'todos os empreendimentos'}</span><span>· ${n} parcela(s) em aberto</span></div>
      </div><div class="side"><button class="btn-icon" onclick="event.stopPropagation();state.sub.contaEdit='${c.id}';renderCadastros()">✏️</button></div></div>`; }).join('')}</div>`;
}
function excluirContaBanco(id) {
  const c = db.contasBanco.find(x => x.id === id); if (!c) return;
  if (db.remessas.some(r => r.contaId === id)) { toast('⚠️', 'Conta com remessas geradas', 'Não dá para excluir uma conta que já mandou arquivo ao banco.', true); return; }
  if (!confirm('Excluir esta conta de cobrança?')) return;
  removeRec('contasBanco', id); state.sub.contaEdit = null; renderCadastros();
}
function salvarContaBanco(id) {
  const prev = id && id !== 'nova' ? db.contasBanco.find(x => x.id === id) : null;
  const rec = Object.assign({}, prev || { id: genId(), criadoEm: new Date().toISOString() }, {
    loteamentoId: val('bcEmp') || '', banco: val('bcBanco'), carteira: val('bcCarteira'), variacao: val('bcVariacao'),
    agencia: val('bcAgencia'), agenciaDv: val('bcAgenciaDv'), conta: val('bcConta'), contaDv: val('bcContaDv'),
    convenio: val('bcConvenio'),
    /* O nosso número não é digitado: conta nova começa na faixa alta e daí o sistema anda
       sozinho. Conta que já existe mantém o ponto em que está. */
    nossoNumeroAtual: prev ? num(prev.nossoNumeroAtual) || NN_INICIAL : NN_INICIAL,
    nnMax: prev ? num(prev.nnMax) : 0, remessaSeq: Math.max(1, Math.round(num(val('bcSeq')))),
    multaPct: num(val('bcMulta')), jurosMesPct: num(val('bcJuros')), jurosDia: num(val('bcJuros')) / 30, descontoPct: num(val('bcDesc')),
    protestoDias: Math.round(num(val('bcProtesto'))), baixaDias: Math.round(num(val('bcBaixa'))),
    especie: val('bcEspecie'), aceite: 'N',
    instrucao1: (prev && prev.instrucao1) || '', instrucao2: (prev && prev.instrucao2) || '',
    mensagem1: val('bcMsg1'), mensagem2: val('bcMsg2')
  });
  if (!rec.agencia || !rec.conta || !rec.convenio) { toast('⚠️', 'Faltam dados', 'Agência, conta e convênio são obrigatórios.', true); return; }
  upsert('contasBanco', rec);
  logAct(`Conta de cobrança salva: ${(BANCOS[pad(rec.banco, 3)] || {}).nome || rec.banco}`);
  state.sub.contaEdit = null;
  renderCadastros(); toast('✅', 'Conta salva', 'Já dá para gerar boletos.');
}

// ================================================================ BOLETO
function dadosBoleto(rec) {
  const v = getVenda(rec.vendaId);
  const lot = getLoteamento(rec.loteamentoId);
  const conta = contaCobranca(rec.loteamentoId);
  if (!conta) throw new Error('Cadastre a conta de cobrança em Cadastros › Banco.');
  const perfil = BANCOS[pad(conta.banco, 3)];
  if (!perfil || !perfil.campoLivre) throw new Error(`O layout do ${(perfil || {}).nome || 'banco'} ainda não está implementado.`);
  const nn = rec.nossoNumero || String(conta.nossoNumeroAtual || 1);
  const valor = recValor(rec);
  const cb = codigoBarras(conta, nn, rec.vencimento, valor);
  const ctx = { lote: v ? imovelLabel(v) : '', loteamento: lot ? lot.nome : '', cliente: v ? v.cliente.nome : '', parcela: rec.descricao };
  const msg = t => String(t || '').replace(/\{\{(\w+)\}\}/g, (m, k) => ctx[k] || '');
  return {
    conta, perfil, nossoNumero: nn, valor, venda: v, imovel: v ? imovelLabel(v) : '', loteamento: lot, rec,
    codigoBarras: cb, linha: linhaDigitavel(cb),
    nossoNumeroImpresso: perfil.nossoNumeroImpresso ? perfil.nossoNumeroImpresso(conta, nn) : nn,
    mensagem1: msg(conta.mensagem1), mensagem2: msg(conta.mensagem2)
  };
}

function boletoHtml(d) {
  const c = d.conta, v = d.venda;
  const agConta = `${pad(c.agencia, 4)}${c.agenciaDv ? '-' + c.agenciaDv : ''} / ${soDigitos(c.conta)}${c.contaDv ? '-' + c.contaDv : ''}`;
  const linhaCliente = v ? `${esc(v.cliente.nome)}${v.cliente.cpf ? ' · CPF/CNPJ ' + esc(fmtCPF(v.cliente.cpf)) : ''}` : '';
  return `<div class="boleto">
    <div class="boleto-topo"><div class="banco">${esc(pad(c.banco, 3))}-${dvModulo11Banco(pad(c.banco, 3))}</div><div class="linha">${esc(d.linha)}</div></div>
    <table class="boleto-tab">
      <tr><td colspan="3"><small>Beneficiário</small>${esc(db.config.empresa || '')}${db.config.cnpj ? ' · CNPJ ' + esc(db.config.cnpj) : ''}</td><td><small>Agência / conta</small>${esc(agConta)}</td></tr>
      <tr><td><small>Vencimento</small><b>${fmtDate(d.rec.vencimento)}</b></td><td><small>Nosso número</small>${esc(d.nossoNumeroImpresso)}</td><td><small>Carteira</small>${esc(c.carteira)}</td><td><small>Valor do documento</small><b>${fmtMoney(d.valor)}</b></td></tr>
      <tr><td colspan="4"><small>Pagador</small>${linhaCliente}</td></tr>
      <tr><td colspan="4"><small>Instruções</small>
        ${c.multaPct ? `Após o vencimento, multa de ${fmtNum(c.multaPct, 2)}%` : ''}${jurosMesDaConta(c) ? ` e juros de ${fmtNum(jurosMesDaConta(c), 2)}% ao mês` : ''}.
        ${c.protestoDias ? `Protestar após ${c.protestoDias} dias do vencimento.` : ''}
        ${d.mensagem1 ? `<br>${esc(d.mensagem1)}` : ''}${d.mensagem2 ? `<br>${esc(d.mensagem2)}` : ''}</td></tr>
    </table>
    <div class="boleto-barras-box">${barrasSvg(d.codigoBarras, 50)}</div>
  </div>`;
}

function abrirBoleto(recId) {
  const rec = db.recebiveis.find(r => r.id === recId); if (!rec) return;
  let d;
  try { d = dadosBoleto(rec); } catch (e) { toast('⚠️', 'Não dá para gerar', e.message, true); return; }
  openModal({
    title: '🏦 Boleto · ' + esc(rec.descricao),
    wide: true,
    body: `<p class="help mb">Confira antes de imprimir. O boleto só é válido depois que o banco registrar o título pelo arquivo de remessa.</p>
      <div id="boletoBox">${boletoHtml(d)}</div>
      <div class="fg mt"><label>Linha digitável</label><input type="text" readonly value="${esc(d.linha)}" onclick="this.select()"></div>`,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
      ${rec.vendaId && getVenda(rec.vendaId) && getVenda(rec.vendaId).cliente.telefone ? `<a class="btn btn-wa" target="_blank" href="${waLink(getVenda(rec.vendaId).cliente.telefone, `Segue a linha digitável do boleto de ${rec.descricao}, vencimento ${fmtDate(rec.vencimento)}, valor ${fmtMoney(d.valor)}:\n\n${d.linha}`)}">💬 Enviar linha</a>` : ''}
      <button class="btn btn-primary" onclick="imprimirBoleto('${rec.id}')">🖨️ Imprimir</button>`
  });
}
function imprimirBoleto(recId) {
  const rec = db.recebiveis.find(r => r.id === recId); if (!rec) return;
  const d = dadosBoleto(rec);
  $('#printArea').innerHTML = boletoHtml(d);
  window.print();
}
function testarBoleto(contaId) {
  const daConta = r => { const c = contaCobranca(r.loteamentoId); return !contaId || (c && c.id === contaId); };
  const todos = recebiveisDo('').filter(daConta);
  const rec = todos.find(r => recStatus(r) !== 'pago') || todos[0];
  if (!rec) { toast('⚠️', 'Sem parcelas', 'Registre uma venda que cobre por esta conta para ver um boleto.', true); return; }
  abrirBoleto(rec.id);
}
