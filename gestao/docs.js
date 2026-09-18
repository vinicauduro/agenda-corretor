/* ===== Gestão de Loteamento — documentos (proposta e contrato) =====
   O texto é da empresa: o usuário cola o modelo dele e marca as partes variáveis
   com {{campos}}. Tudo que não for um campo conhecido vira um preenchimento na hora
   de gerar, e a prévia é editável antes de imprimir ou salvar em PDF. */
'use strict';

const DOC_CAMPOS = [
  ['Empresa', [['empresa.nome', 'Nome'], ['empresa.cnpj', 'CNPJ'], ['empresa.endereco', 'Endereço'], ['empresa.cidade', 'Cidade'], ['empresa.telefone', 'Telefone'], ['empresa.email', 'E-mail'], ['empresa.representante', 'Quem assina'], ['empresa.repCpf', 'CPF de quem assina']]],
  ['Loteamento', [['loteamento.nome', 'Nome'], ['loteamento.cidade', 'Cidade'], ['loteamento.endereco', 'Endereço'], ['loteamento.descricao', 'Descrição']]],
  ['Lote', [['lote.identificacao', 'Quadra e lote'], ['lote.quadra', 'Quadra'], ['lote.numero', 'Número'], ['lote.area', 'Área (m²)'], ['lote.areaExtenso', 'Área por extenso'], ['lote.frente', 'Frente'], ['lote.fundos', 'Fundos'], ['lote.matricula', 'Matrícula'], ['lote.tipo', 'Tipo']]],
  ['Comprador', [['comprador.qualificacao', 'Qualificação de todos (com cônjuges)'], ['comprador.nomes', 'Nomes de todos'], ['cliente.qualificacao', 'Qualificação só do primeiro'], ['cliente.nome', 'Nome'], ['cliente.cpf', 'CPF/CNPJ'], ['cliente.rg', 'RG'], ['cliente.rgOrgao', 'Órgão do RG'], ['cliente.nacionalidade', 'Nacionalidade'], ['cliente.estadoCivil', 'Estado civil'], ['cliente.regimeBens', 'Regime de bens'], ['cliente.profissao', 'Profissão'], ['cliente.telefone', 'Telefone'], ['cliente.email', 'E-mail'], ['cliente.endereco', 'Endereço'], ['cliente.cidade', 'Cidade']]],
  ['Cônjuge', [['conjuge.qualificacao', 'Qualificação do cônjuge'], ['conjuge.nome', 'Nome'], ['conjuge.cpf', 'CPF'], ['conjuge.rg', 'RG'], ['conjuge.nacionalidade', 'Nacionalidade'], ['conjuge.profissao', 'Profissão']]],
  ['Vendedor', [['vendedor.qualificacao', 'Qualificação de todos'], ['vendedor.nomes', 'Nomes de todos'], ['vendedor.nome', 'Nome / razão social'], ['vendedor.cpf', 'CNPJ/CPF'], ['vendedor.endereco', 'Endereço'], ['vendedor.representante', 'Quem assina'], ['vendedor.repCpf', 'CPF de quem assina']]],
  ['Imóvel', [['imovel.descricao', 'Descrição da matrícula'], ['imovel.identificacao', 'Identificação curta'], ['imovel.matricula', 'Matrícula'], ['imovel.cartorio', 'Cartório de registro'], ['imovel.endereco', 'Endereço do imóvel'], ['imovel.medidas', 'Medidas']]],
  ['Corretor', [['corretor.nome', 'Nome'], ['corretor.creci', 'CRECI'], ['corretor.telefone', 'Telefone'], ['corretor.imobiliaria', 'Imobiliária']]],
  ['Pagamento', [['pagamento.valorTotal', 'Valor total'], ['pagamento.valorTotalExtenso', 'Valor por extenso'], ['pagamento.entrada', 'Entrada'], ['pagamento.entradaExtenso', 'Entrada por extenso'], ['pagamento.dataEntrada', 'Data da entrada'], ['pagamento.nParcelas', 'Nº de parcelas'], ['pagamento.valorParcela', 'Valor da parcela'], ['pagamento.valorParcelaExtenso', 'Parcela por extenso'], ['pagamento.juros', 'Juros (% a.m.)'], ['pagamento.primeiroVencimento', '1º vencimento'], ['pagamento.saldo', 'Saldo financiado'], ['pagamento.reforcos', 'Reforços'], ['pagamento.indice', 'Índice de correção'], ['pagamento.indiceBase', 'Mês base do índice'], ['pagamento.resumo', 'Resumo em uma linha'], ['pagamento.tabela', 'Tabela de parcelas']]],
  ['Assinaturas', [['assinaturas.vendedores', 'Linhas dos vendedores'], ['assinaturas.compradores', 'Linhas dos compradores e cônjuges']]],
  ['Documento', [['doc.data', 'Data'], ['doc.dataExtenso', 'Data por extenso'], ['doc.cidadeData', 'Cidade e data'], ['doc.validade', 'Validade da proposta']]]
];

// ---------------------------------------------------------------- valores por extenso
const EXT_U = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const EXT_D = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const EXT_C = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
function extensoInt(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  if (n === 0) return 'zero';
  const grupos = [[1e9, 'bilhão', 'bilhões'], [1e6, 'milhão', 'milhões'], [1e3, 'mil', 'mil']];
  for (const [v, sing, plur] of grupos) {
    const q = Math.floor(n / v), r = n % v;
    if (q > 0) {
      const cabeca = (v === 1e3 && q === 1 ? '' : extensoInt(q) + ' ') + (q === 1 ? sing : plur);
      if (!r) return cabeca;
      // "e" só quando o resto é menor que cem ou centena redonda (mil e duzentos, mil e vinte)
      const liga = (r < 100 || r % 100 === 0) ? ' e ' : ' ';
      return cabeca + liga + extensoInt(r);
    }
  }
  const c = Math.floor(n / 100), r = n % 100;
  const tr = [];
  if (c) tr.push(c === 1 && r === 0 ? 'cem' : EXT_C[c]);
  if (r) tr.push(r < 20 ? EXT_U[r] : EXT_D[Math.floor(r / 10)] + (r % 10 ? ' e ' + EXT_U[r % 10] : ''));
  return tr.join(' e ');
}
function moedaExtenso(v) {
  v = Math.round((Number(v) || 0) * 100) / 100;
  const i = Math.floor(v), c = Math.round((v - i) * 100);
  const ext = extensoInt(i);
  // milhão/bilhão redondo pede "de reais"
  const de = /(milhão|milhões|bilhão|bilhões)$/.test(ext) ? 'de ' : '';
  let t = i === 1 ? 'um real' : `${ext} ${de}reais`;
  if (c > 0) t += ` e ${c === 1 ? 'um centavo' : extensoInt(c) + ' centavos'}`;
  return t;
}
function numeroExtenso(v, sing, plur) {
  const i = Math.round(Number(v) || 0);
  return `${extensoInt(i)} ${i === 1 ? sing : plur}`;
}
const MESES_EXT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
function dataExtenso(ymdStr) {
  const [y, m, d] = String(ymdStr || todayStr()).split('-').map(Number);
  return `${d} de ${MESES_EXT[(m || 1) - 1]} de ${y}`;
}

// ---------------------------------------------------------------- contexto
function docContexto(o) {
  const cfg = db.config, lot = o.loteamento || {}, l = o.lote || {}, c = o.cliente || {}, k = o.corretor || {}, p = o.pagamento || {};
  const cj = c.conjuge || {};
  /* Vendedor: o que a venda congelou, senão o escolhido, senão a empresa do cadastro. */
  const vd = o.vendedor || (o.venda ? vendedorDaVenda(o.venda) : vendedorPadrao());
  /* Listas completas das partes. Os campos no singular seguem apontando para a primeira de
     cada lado, que é quem as telas do dia a dia mostram. */
  const compradores = (o.compradores && o.compradores.length) ? o.compradores : (c.nome ? [c] : []);
  const vendedores = (o.vendedores && o.vendedores.length) ? o.vendedores : (vd.nome ? [vd] : []);
  const imv = imovelDados({ lote: o.lote, loteamento: o.loteamento, imovel: o.imovel || (o.venda || {}).imovel });
  const hoje = o.data || todayStr();
  const cidade = cfg.cidade || lot.cidade || '';
  const parcelasTxt = p.nParcelas ? `${p.nParcelas} ${p.nParcelas > 1 ? 'parcelas mensais' : 'parcela'} de ${fmtMoney(p.valorParcela)}` : '';
  const refs = (p.baloes || []).filter(b => num(b.valor) > 0);
  const iguais = refs.length > 1 && refs.every(b => num(b.valor) === num(refs[0].valor));
  const reforcosTxt = !refs.length ? ''
    : iguais ? `${refs.length} reforços de ${fmtMoney(refs[0].valor)}, o primeiro em ${fmtDate(refs[0].data)} e os demais a cada 12 meses`
    : refs.map(b => `${fmtMoney(b.valor)} em ${fmtDate(b.data)}`).join('; ');
  const ctx = {
    'empresa.nome': cfg.empresa || '', 'empresa.cnpj': cfg.cnpj || '', 'empresa.endereco': cfg.endereco || '', 'empresa.cidade': cfg.cidade || '',
    'empresa.telefone': cfg.telefone || '', 'empresa.email': cfg.email || '', 'empresa.representante': cfg.representante || '', 'empresa.repCpf': cfg.repCpf || '',
    'loteamento.nome': lot.nome || '', 'loteamento.cidade': lot.cidade || '', 'loteamento.endereco': lot.endereco || '', 'loteamento.descricao': lot.descricao || '',
    'lote.identificacao': l.quadra ? `Quadra ${l.quadra}, Lote ${l.numero}` : '', 'lote.quadra': l.quadra || '', 'lote.numero': l.numero || '',
    'lote.area': l.area ? fmtNum(l.area, 2) + ' m²' : '', 'lote.areaExtenso': l.area ? numeroExtenso(l.area, 'metro quadrado', 'metros quadrados') : '',
    'lote.frente': l.frente ? fmtNum(l.frente, 2) + ' m' : '', 'lote.fundos': l.fundos ? fmtNum(l.fundos, 2) + ' m' : '',
    'lote.matricula': l.matricula || '', 'lote.tipo': l.tipo === 'comercial' ? 'comercial' : 'residencial',
    'cliente.nome': c.nome || '', 'cliente.cpf': fmtCPF(c.cpf) || '', 'cliente.rg': c.rg || '', 'cliente.rgOrgao': c.rgOrgao || '',
    'cliente.nacionalidade': c.nacionalidade || '', 'cliente.estadoCivil': estadoCivilTexto(c) || '', 'cliente.regimeBens': c.regimeBens || '',
    'cliente.profissao': c.profissao || '', 'cliente.telefone': fmtPhone(c.telefone) || '',
    'cliente.email': c.email || '', 'cliente.endereco': enderecoLinha(c) || c.endereco || '', 'cliente.cidade': c.cidade || '',
    'cliente.qualificacao': qualificacaoPessoa(c), 'comprador.qualificacao': qualificacaoPartes(compradores),
    'comprador.nomes': nomesDasPartes(compradores), 'vendedor.nomes': nomesDasPartes(vendedores),
    'assinaturas.compradores': linhasAssinatura(compradores, 'Promitente comprador'),
    'assinaturas.vendedores': linhasAssinatura(vendedores, 'Promitente vendedora'),
    'conjuge.nome': cj.nome || '', 'conjuge.cpf': fmtCPF(cj.cpf) || '', 'conjuge.rg': cj.rg || '',
    'conjuge.nacionalidade': cj.nacionalidade || '', 'conjuge.profissao': cj.profissao || '',
    'conjuge.qualificacao': cj.nome ? qualificacaoPessoa(cj) : '',
    'vendedor.nome': vd.nome || '', 'vendedor.cpf': fmtCPF(vd.cpf) || '', 'vendedor.endereco': enderecoLinha(vd) || vd.endereco || '',
    'vendedor.representante': (vd.representante || {}).nome || '', 'vendedor.repCpf': fmtCPF((vd.representante || {}).cpf) || '',
    'vendedor.qualificacao': qualificacaoPartes(vendedores),
    'imovel.descricao': imv.descricao || '', 'imovel.identificacao': imv.identificacao || '', 'imovel.matricula': imv.matricula || '',
    'imovel.cartorio': imv.cartorio || '', 'imovel.endereco': imv.endereco || '', 'imovel.medidas': imv.medidas || '',
    'corretor.nome': k.nome || '', 'corretor.creci': k.creci || '', 'corretor.telefone': fmtPhone(k.telefone) || '', 'corretor.imobiliaria': k.imobiliaria || '',
    'pagamento.valorTotal': fmtMoney(p.valorTotal), 'pagamento.valorTotalExtenso': moedaExtenso(p.valorTotal),
    'pagamento.entrada': fmtMoney(p.entrada), 'pagamento.entradaExtenso': moedaExtenso(p.entrada),
    'pagamento.dataEntrada': p.dataEntrada ? fmtDate(p.dataEntrada) : '',
    'pagamento.nParcelas': String(p.nParcelas || 0), 'pagamento.valorParcela': fmtMoney(p.valorParcela), 'pagamento.valorParcelaExtenso': moedaExtenso(p.valorParcela),
    'pagamento.juros': p.jurosMes ? fmtNum(p.jurosMes, 2) + '% ao mês' : 'sem juros',
    'pagamento.primeiroVencimento': p.primeiroVencimento ? fmtDate(p.primeiroVencimento) : '',
    'pagamento.saldo': fmtMoney(Math.max(0, num(p.valorTotal) - num(p.entrada))),
    'pagamento.indice': p.indiceId && typeof getIndice === 'function' && getIndice(p.indiceId) ? getIndice(p.indiceId).nome : '',
    'pagamento.indiceBase': p.indiceBase ? monthLabel(p.indiceBase) : '',
    'pagamento.reforcos': reforcosTxt,
    'pagamento.resumo': [p.entrada ? `entrada de ${fmtMoney(p.entrada)}` : '', parcelasTxt, reforcosTxt ? (iguais ? reforcosTxt : `reforços de ${reforcosTxt}`) : ''].filter(Boolean).join(' + '),
    'pagamento.tabela': docTabelaParcelas(p),
    'doc.data': fmtDate(hoje), 'doc.dataExtenso': dataExtenso(hoje), 'doc.cidadeData': `${cidade ? cidade + ', ' : ''}${dataExtenso(hoje)}`,
    'doc.validade': o.validade || ''
  };
  Object.keys(o.extras || {}).forEach(k2 => { ctx[k2] = o.extras[k2]; });
  return ctx;
}

function docTabelaParcelas(p) {
  const linhas = [];
  if (num(p.entrada) > 0) linhas.push(['Entrada', p.dataEntrada ? fmtDate(p.dataEntrada) : '', fmtMoney(p.entrada)]);
  (p.baloes || []).filter(b => num(b.valor) > 0).forEach((b, i) => linhas.push([`Reforço ${i + 1}`, fmtDate(b.data), fmtMoney(b.valor)]));
  const n = Math.round(num(p.nParcelas));
  if (n > 0) {
    const venc = p.primeiroVencimento || todayStr();
    const mostrar = Math.min(n, 6);
    for (let i = 0; i < mostrar; i++) linhas.push([`Parcela ${i + 1}/${n}`, fmtDate(addMonths(venc, i)), fmtMoney(p.valorParcela)]);
    if (n > mostrar) linhas.push([`Parcelas ${mostrar + 1} a ${n}`, `até ${fmtDate(addMonths(venc, n - 1))}`, fmtMoney(p.valorParcela) + ' cada']);
  }
  if (!linhas.length) return '';
  return `<table class="doc-tab"><thead><tr><th>Item</th><th>Vencimento</th><th style="text-align:right">Valor</th></tr></thead><tbody>${
    linhas.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td style="text-align:right">${esc(r[2])}</td></tr>`).join('')}</tbody></table>`;
}

// ---------------------------------------------------------------- preenchimento
function docPlaceholders(texto) {
  const out = []; const re = /\{\{\s*([#/]?[\w.]+)\s*\}\}/g; let m;
  while ((m = re.exec(String(texto || '')))) { const k = m[1]; if (!k.startsWith('#') && !k.startsWith('/') && !out.includes(k)) out.push(k); }
  return out;
}
function docCamposConhecidos() {
  const s = new Set(); DOC_CAMPOS.forEach(([, itens]) => itens.forEach(([k]) => s.add(k))); return s;
}
function docCamposLivres(texto) {
  const conh = docCamposConhecidos();
  return docPlaceholders(texto).filter(k => !conh.has(k));
}
function docPreencher(texto, ctx) {
  let t = String(texto || '');
  // {{#se campo}} ... {{/se}} — só mostra o trecho quando o campo tem valor (resolve de dentro para fora)
  const re = /\{\{#se\s+([\w.]+)\s*\}\}((?:(?!\{\{#se)[\s\S])*?)\{\{\/se\s*\}\}/;
  for (let i = 0; i < 50 && re.test(t); i++) t = t.replace(re, (m, k, corpo) => (ctx[k] && String(ctx[k]).trim() ? corpo : ''));
  t = t.replace(/\{\{\/?se[^}]*\}\}/g, '');
  t = t.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, k) => (k in ctx && ctx[k] !== null && ctx[k] !== undefined && String(ctx[k]) !== '' ? String(ctx[k]) : '__________'));
  return t;
}
// texto simples com marcação leve → HTML (# título, ## subtítulo, **negrito**, linhas em branco = parágrafo)
function docHtml(texto, ctx) {
  const bruto = docPreencher(texto, ctx);
  const tabelas = [];
  const semTab = bruto.replace(/<table class="doc-tab">[\s\S]*?<\/table>/g, m => { tabelas.push(m); return ` T${tabelas.length - 1} `; });
  const linhas = esc(semTab).split('\n');
  let html = '', buf = [];
  const flush = () => { if (buf.length) { html += `<p>${buf.join('<br>')}</p>`; buf = []; } };
  linhas.forEach(ln => {
    const t = ln.trim();
    if (!t) { flush(); return; }
    if (/^##\s+/.test(t)) { flush(); html += `<h3>${t.replace(/^##\s+/, '')}</h3>`; return; }
    if (/^#\s+/.test(t)) { flush(); html += `<h2>${t.replace(/^#\s+/, '')}</h2>`; return; }
    if (/^-{3,}$/.test(t)) { flush(); html += '<hr>'; return; }
    buf.push(t);
  });
  flush();
  html = html.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/__________/g, '<span class="doc-vazio">__________</span>');
  return html.replace(/ T(\d+) /g, (m, i) => tabelas[Number(i)]);
}

// ---------------------------------------------------------------- modelos padrão
const MODELO_PROPOSTA = `# PROPOSTA DE COMPRA

**{{empresa.nome}}**{{#se empresa.cnpj}} · CNPJ {{empresa.cnpj}}{{/se}}
{{#se empresa.endereco}}{{empresa.endereco}}{{/se}}{{#se empresa.telefone}} · {{empresa.telefone}}{{/se}}

## Imóvel
Loteamento {{loteamento.nome}}{{#se loteamento.cidade}}, em {{loteamento.cidade}}{{/se}}.
{{lote.identificacao}}, com área de {{lote.area}}{{#se lote.frente}}, frente de {{lote.frente}}{{/se}}{{#se lote.matricula}}, matrícula {{lote.matricula}}{{/se}}.

## Proponente comprador
{{cliente.nome}}{{#se cliente.cpf}}, CPF {{cliente.cpf}}{{/se}}{{#se cliente.profissao}}, {{cliente.profissao}}{{/se}}
{{#se cliente.endereco}}Endereço: {{cliente.endereco}}{{#se cliente.cidade}} — {{cliente.cidade}}{{/se}}{{/se}}
{{#se cliente.telefone}}Telefone: {{cliente.telefone}}{{/se}}{{#se cliente.email}} · E-mail: {{cliente.email}}{{/se}}

## Condições propostas
Valor total: **{{pagamento.valorTotal}}** ({{pagamento.valorTotalExtenso}}).
Forma de pagamento: {{pagamento.resumo}}.
{{#se pagamento.juros}}Juros do parcelamento: {{pagamento.juros}}.{{/se}}
{{#se pagamento.primeiroVencimento}}Primeiro vencimento em {{pagamento.primeiroVencimento}}.{{/se}}

{{pagamento.tabela}}

{{#se doc.validade}}Esta proposta é válida até {{doc.validade}} e fica sujeita à aprovação da administração.{{/se}}

{{doc.cidadeData}}

---

_______________________________
{{cliente.nome}}
Proponente comprador

{{#se corretor.nome}}Corretor: {{corretor.nome}}{{#se corretor.creci}} · CRECI {{corretor.creci}}{{/se}}{{#se corretor.telefone}} · {{corretor.telefone}}{{/se}}{{/se}}`;

const MODELO_CONTRATO = `# INSTRUMENTO PARTICULAR DE PROMESSA DE COMPRA E VENDA DE LOTE

**PROMITENTE VENDEDORA:** {{vendedor.qualificacao}}.

**PROMITENTE COMPRADOR:** {{comprador.qualificacao}}.

As partes têm entre si justo e contratado o seguinte:

## CLÁUSULA PRIMEIRA — DO OBJETO
A promitente vendedora promete vender ao promitente comprador o imóvel assim descrito: {{imovel.descricao}}{{#se imovel.endereco}}, situado {{imovel.endereco}}{{/se}}{{#se imovel.matricula}}, objeto da matrícula nº {{imovel.matricula}}{{#se imovel.cartorio}} do {{imovel.cartorio}}{{/se}}{{/se}}.

## CLÁUSULA SEGUNDA — DO PREÇO E DA FORMA DE PAGAMENTO
O preço certo e ajustado é de {{pagamento.valorTotal}} ({{pagamento.valorTotalExtenso}}), pago da seguinte forma: {{pagamento.resumo}}.
{{#se pagamento.juros}}Sobre o saldo parcelado incidem juros de {{pagamento.juros}}.{{/se}}
{{#se pagamento.primeiroVencimento}}A primeira parcela vence em {{pagamento.primeiroVencimento}} e as demais no mesmo dia dos meses subsequentes.{{/se}}

{{pagamento.tabela}}

{{#se pagamento.indice}}## CLÁUSULA TERCEIRA — DA CORREÇÃO MONETÁRIA
As parcelas são corrigidas mensalmente pela variação do {{pagamento.indice}}, a partir do mês base de {{pagamento.indiceBase}}. A variação apurada em cada mês incide sobre as parcelas vencíveis no mês subsequente ao de sua divulgação, qualquer que seja o dia do vencimento. Apurada variação negativa em determinado mês, esta será considerada igual a zero, não havendo redução do valor das parcelas. A parcela não paga no vencimento deixa de sofrer correção e passa a responder apenas pelos encargos de mora previstos neste instrumento.

{{/se}}## CLÁUSULA TERCEIRA — DO ATRASO
O atraso no pagamento de qualquer parcela sujeita o promitente comprador a multa e juros de mora previstos neste instrumento, sem prejuízo da correção monetária do saldo devedor.

## CLÁUSULA QUARTA — DA POSSE E DA ESCRITURA
A posse será transmitida na forma aqui ajustada, e a escritura definitiva será outorgada após a quitação integral do preço, correndo por conta do promitente comprador as despesas de escritura, registro e impostos.

## CLÁUSULA QUINTA — DO FORO
Fica eleito o foro da comarca de {{empresa.cidade}} para dirimir as questões oriundas deste contrato.

E por estarem assim justas e contratadas, as partes assinam o presente instrumento em duas vias de igual teor.

{{doc.cidadeData}}

---

{{assinaturas.vendedores}}

{{assinaturas.compradores}}

_______________________________            _______________________________
Testemunha                                  Testemunha`;

function modelosPadrao() {
  return [
    { id: 'mod-proposta', nome: 'Proposta de compra', tipo: 'proposta', corpo: MODELO_PROPOSTA, criadoEm: new Date().toISOString() },
    { id: 'mod-contrato', nome: 'Promessa de compra e venda', tipo: 'contrato', corpo: MODELO_CONTRATO, criadoEm: new Date().toISOString() }
  ];
}
function modelosDo(tipo) {
  const ms = db.modelos.filter(m => m.tipo === tipo);
  return ms.length ? ms : modelosPadrao().filter(m => m.tipo === tipo);
}

// ---------------------------------------------------------------- prévia e impressão
function docPreview({ titulo, html, arquivo, whatsTexto }) {
  window.__docHtml = html;
  openModal({
    title: titulo,
    wide: true,
    body: `<p class="help mb">Confira o documento. Você pode <b>clicar no texto e editar</b> qualquer parte antes de imprimir ou salvar em PDF.</p>
      <div class="doc-folha" id="docFolha" contenteditable="true">${html}</div>`,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
      ${whatsTexto ? `<a class="btn btn-wa" target="_blank" href="${esc(whatsTexto)}">💬 Enviar</a>` : ''}
      <button class="btn btn-primary" onclick="docImprimir('${esc(arquivo || 'documento')}')">🖨️ Imprimir / salvar PDF</button>`
  });
}
function docImprimir(nome) {
  const folha = $('#docFolha');
  $('#printArea').innerHTML = `<div class="doc-folha">${folha ? folha.innerHTML : window.__docHtml || ''}</div>`;
  const antes = document.title;
  document.title = nome || antes;
  window.print();
  setTimeout(() => { document.title = antes; }, 800);
}

// ---------------------------------------------------------------- campos livres do modelo
function docFormLivres(campos, prefixo) {
  if (!campos.length) return '';
  const memo = JSON.parse(localStorage.getItem('gl_doc_livres') || '{}');
  return `<div class="fieldset"><span class="lg">✏️ Campos do seu modelo</span>
    ${campos.map(k => `<div class="fg"><label>${esc(k.replace(/[._]/g, ' '))}</label><input type="text" id="${prefixo}${k.replace(/\W/g, '_')}" value="${esc(memo[k] || '')}"></div>`).join('')}
    <div class="hint">São as partes marcadas no seu modelo que não vêm do cadastro. Ficam guardadas para a próxima vez.</div></div>`;
}
function docLerLivres(campos, prefixo) {
  const memo = JSON.parse(localStorage.getItem('gl_doc_livres') || '{}');
  const out = {};
  campos.forEach(k => { const v = val(prefixo + k.replace(/\W/g, '_')); out[k] = v; if (v) memo[k] = v; });
  try { localStorage.setItem('gl_doc_livres', JSON.stringify(memo)); } catch (e) {}
  return out;
}

// ================================================================ PROPOSTA (corretor)
function abrirPropostaForm(loteId) {
  const l = getLote(loteId); if (!l) return;
  const lot = getLoteamento(l.loteamentoId); const cond = lot.cond || {};
  const p = typeof corretorPerfil === 'function' ? corretorPerfil() : {};
  const mods = modelosDo('proposta');
  const entradaSim = num(val('simEntrada')), nSim = Math.round(num(val('simParcelas')));
  const entrada = entradaSim || Math.round(l.preco * (num(cond.entradaMinPct) || 10) / 100);
  const n = nSim || Math.min(60, Number(cond.maxParcelas) || 60);
  const livres = docCamposLivres(mods[0].corpo);
  openModal({
    title: '📄 Gerar proposta',
    wide: true,
    body: `<p class="help mb">Preencha os dados do cliente e as condições. A proposta sai em PDF com o modelo da empresa, pronta para enviar e assinar.</p>
      <div class="fg"><label>Lote</label><input type="text" value="${esc(loteLabel(l))} — ${fmtMoney(l.preco)}" readonly></div>
      ${mods.length > 1 ? `<div class="fg"><label>Modelo</label><select id="ppModelo">${mods.map(m => `<option value="${esc(m.id)}">${esc(m.nome)}</option>`).join('')}</select></div>` : ''}
      <div class="fieldset"><span class="lg">🧑‍🤝‍🧑 Cliente</span>
        <div class="fg"><label>Nome *</label><input type="text" id="ppNome"></div>
        <div class="frow"><div class="fg"><label>CPF/CNPJ</label><input type="text" id="ppCpf"></div><div class="fg"><label>Telefone *</label><input type="tel" id="ppTel"></div></div>
        <div class="frow"><div class="fg"><label>E-mail</label><input type="email" id="ppEmail"></div><div class="fg"><label>Cidade</label><input type="text" id="ppCidade"></div></div>
        <div class="fg"><label>Endereço</label><input type="text" id="ppEnd"></div></div>
      <div class="fieldset"><span class="lg">💰 Condições</span>
        <div class="frow"><div class="fg"><label>Valor do lote (R$)</label><input type="number" id="ppTotal" step="0.01" value="${l.preco}" oninput="ppCalc()"></div><div class="fg"><label>Entrada (R$)</label><input type="number" id="ppEntrada" step="0.01" value="${entrada}" oninput="ppCalc()"></div></div>
        <div class="frow3"><div class="fg"><label>Nº parcelas</label><input type="number" id="ppN" min="0" value="${n}" oninput="ppCalc()"></div><div class="fg"><label>Juros (% a.m.)</label><input type="number" id="ppJuros" step="0.01" value="${cond.jurosMes || 0}" oninput="ppCalc()"></div><div class="fg"><label>1º vencimento</label><input type="date" id="ppVenc" value="${addMonths(todayStr(), 1)}"></div></div>
        <div class="fg"><label>Valor da parcela (R$) <span class="tiny muted">— calculado; pode ajustar</span></label><input type="number" id="ppParcela" step="0.01" oninput="window.ppManual=true"></div>
        <div class="frow"><div class="fg"><label>Reforço anual (R$) <span class="tiny muted">opcional</span></label><input type="number" id="ppReforco" step="0.01" value="" oninput="ppCalc()"></div><div class="fg"><label>Validade da proposta</label><input type="date" id="ppValidade" value="${addDays(todayStr(), 5)}"></div></div>
        <div class="sim-result" id="ppResumo"></div></div>
      ${docFormLivres(livres, 'ppL_')}`,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="gerarProposta('${l.id}')">📄 Gerar proposta</button>`
  });
  window.ppManual = false;
  ppCalc();
  setTimeout(() => { const el = $('#ppNome'); if (el) el.focus(); }, 60);
}

function ppDados() {
  const total = num(val('ppTotal')), entrada = num(val('ppEntrada')), n = Math.max(0, Math.round(num(val('ppN'))));
  const juros = num(val('ppJuros')) / 100, reforco = num(val('ppReforco'));
  const venc = val('ppVenc') || addMonths(todayStr(), 1);
  const baloes = [];
  if (reforco > 0 && n >= 12) for (let k = 12; k <= n; k += 12) baloes.push({ data: addMonths(venc, k - 1), valor: reforco });
  // valor presente dos reforços sai do saldo antes de calcular a parcela
  const vpReforcos = baloes.reduce((s, b, i) => s + reforco / Math.pow(1 + juros, (i + 1) * 12), 0);
  const saldo = Math.max(0, total - entrada - vpReforcos);
  const parcela = n ? pmt(juros, n, saldo) : 0;
  return { total, entrada, n, juros, baloes, parcela, venc };
}
function ppCalc() {
  const d = ppDados();
  if (!window.ppManual) setVal('ppParcela', d.n ? Math.round(d.parcela * 100) / 100 : 0);
  const parcela = num(val('ppParcela'));
  const somaRef = d.baloes.reduce((s, b) => s + b.valor, 0);
  const box = $('#ppResumo'); if (!box) return;
  box.innerHTML = `Entrada <b>${fmtMoney(d.entrada)}</b> + <b>${d.n}×</b> de <b>${fmtMoney(parcela)}</b>${somaRef ? ` + ${d.baloes.length} reforço(s) de ${fmtMoney(d.baloes[0].valor)}` : ''}
    <br><span class="tiny muted">Total pago ${fmtMoney(d.entrada + parcela * d.n + somaRef)} · saldo financiado ${fmtMoney(Math.max(0, d.total - d.entrada))}</span>`;
}

function gerarProposta(loteId) {
  const l = getLote(loteId); if (!l) return;
  if (!val('ppNome')) { toast('⚠️', 'Informe o nome do cliente', '', true); return; }
  const lot = getLoteamento(l.loteamentoId);
  const mods = modelosDo('proposta');
  const mod = mods.find(m => m.id === val('ppModelo')) || mods[0];
  const d = ppDados();
  const perfil = typeof corretorPerfil === 'function' ? corretorPerfil() : {};
  const ctx = docContexto({
    loteamento: lot, lote: l,
    cliente: { nome: val('ppNome'), cpf: val('ppCpf'), telefone: val('ppTel'), email: val('ppEmail'), cidade: val('ppCidade'), endereco: val('ppEnd') },
    corretor: perfil,
    pagamento: { valorTotal: d.total, entrada: d.entrada, dataEntrada: todayStr(), nParcelas: d.n, valorParcela: num(val('ppParcela')), jurosMes: num(val('ppJuros')), primeiroVencimento: d.venc, baloes: d.baloes },
    validade: val('ppValidade') ? fmtDate(val('ppValidade')) : '',
    extras: docLerLivres(docCamposLivres(mod.corpo), 'ppL_')
  });
  const html = docHtml(mod.corpo, ctx);
  const tel = val('ppTel');
  const texto = `Olá ${val('ppNome').split(' ')[0]}! Segue a proposta do ${loteLabel(l)} no ${lot.nome}: ${ctx['pagamento.resumo']}. Qualquer dúvida estou à disposição.`;
  logAct(`Proposta gerada: ${loteLabel(l)} — ${val('ppNome')}`);
  docPreview({ titulo: '📄 Proposta · ' + loteShort(l), html, arquivo: `Proposta ${loteShort(l)} - ${val('ppNome')}`, whatsTexto: tel ? waLink(tel, texto) : null });
}

// ================================================================ CONTRATO (venda)
function gerarContratoVenda(vendaId) {
  const v = getVenda(vendaId); if (!v) return;
  const l = getLote(v.loteId), lot = getLoteamento(v.loteamentoId);
  const mods = modelosDo('contrato');
  const livres = docCamposLivres(mods[0].corpo);
  const c = v.cliente || {};
  /* Com mais de um comprador, o aviso é do conjunto: basta um incompleto para o contrato
     sair capenga. */
  const falta = [...new Set(todosCompradores(v).flatMap(faltaQualificacao))];
  openModal({
    title: '📄 Gerar contrato',
    wide: true,
    body: `<p class="help mb">O contrato usa o modelo cadastrado em <b>Cadastros › Documentos</b>. O que você completar aqui volta para o cadastro da venda.</p>
      ${mods.length > 1 ? `<div class="fg"><label>Modelo</label><select id="ctModelo">${mods.map(m => `<option value="${esc(m.id)}">${esc(m.nome)}</option>`).join('')}</select></div>` : ''}
      ${falta.length ? `<div class="alert warn" style="cursor:default"><span>Para o contrato sair completo ainda falta <b>${esc(falta.join(', '))}</b>. Complete abaixo.</span></div>` : ''}
      <div class="fieldset"><span class="lg">🧑‍🤝‍🧑 Qualificação do comprador</span>
        ${pessoasListaHtml('ct', todosCompradores(v), { conjuge: true, rotulo: 'Comprador', rotuloBotao: 'Adicionar comprador' })}
        <label class="check mt"><input type="checkbox" id="ctSalvar" checked> Guardar esses dados no cadastro da venda</label></div>
      <div class="fieldset"><span class="lg">✍️ Vendedor</span>
        ${vendedoresListaHtml('ctVend', [v.vendedorId || ''].concat((v.vendedoresExtras || []).map(x => x.id || '')))}</div>
      <div class="frow"><div class="fg"><label>Data do contrato</label><input type="date" id="ctData" value="${esc(v.dataVenda || todayStr())}"></div></div>
      ${docFormLivres(livres, 'ctL_')}`,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="gerarContratoConfirma('${v.id}')">📄 Gerar contrato</button>`
  });
}
function gerarContratoConfirma(vendaId) {
  const v = getVenda(vendaId); if (!v) return;
  const l = getLote(v.loteId), lot = getLoteamento(v.loteamentoId);
  const mods = modelosDo('contrato');
  const mod = mods.find(m => m.id === val('ctModelo')) || mods[0];
  const compradores = pessoasDoFormLista('ct', todosCompradores(v));
  const cliente = compradores[0] || v.cliente || {};
  const vendIds = vendedoresDoFormLista('ctVend');
  const vendedores = vendIds.map(vendedorPorId);
  const vendedor = vendedores[0];
  if ($('#ctSalvar') && $('#ctSalvar').checked) {
    upsert('vendas', Object.assign({}, v, {
      cliente, compradoresExtras: compradores.slice(1),
      vendedorId: vendIds[0] || null, vendedor, vendedoresExtras: vendedores.slice(1)
    }));
  }
  const ctx = docContexto({
    loteamento: lot, lote: l, cliente, compradores, corretor: v.corretor, venda: v, vendedor, vendedores, imovel: v.imovel,
    pagamento: { valorTotal: v.valorTotal, entrada: v.entrada, dataEntrada: v.dataEntrada, nParcelas: v.nParcelas, valorParcela: v.valorParcela, jurosMes: v.jurosMes, primeiroVencimento: v.primeiroVencimento, baloes: v.baloes, indiceId: v.indiceId, indiceBase: v.indiceBase },
    data: val('ctData') || v.dataVenda,
    extras: docLerLivres(docCamposLivres(mod.corpo), 'ctL_')
  });
  const html = docHtml(mod.corpo, ctx);
  logAct(`Contrato gerado: ${l ? loteLabel(l) : ''} — ${v.cliente.nome}`);
  docPreview({ titulo: '📄 Contrato · ' + (l ? loteShort(l) : ''), html, arquivo: `Contrato ${l ? loteShort(l) : ''} - ${v.cliente.nome}` });
}

// ================================================================ CADASTRO DE MODELOS
function cadDocumentosHtml() {
  const mods = db.modelos.slice().sort((a, b) => (a.tipo + a.nome).localeCompare(b.tipo + b.nome));
  const lista = mods.length ? mods : modelosPadrao();
  return `<div class="card"><h3>📄 Modelos de documento</h3>
    <p class="help">O texto é seu. Cole aqui a proposta e o contrato que a sua empresa já usa e marque as partes que mudam a cada negócio com os campos do sistema. Na hora de gerar, tudo é preenchido sozinho e você ainda pode editar antes de imprimir.</p>
    ${mods.length ? '' : '<p class="help mt">Você ainda não cadastrou modelos. Os dois abaixo são exemplos prontos: abra, ajuste ao seu texto e salve.</p>'}
    <div class="btn-row mt"><button class="btn btn-primary" onclick="abrirModeloForm('','proposta')">＋ Modelo de proposta</button><button class="btn btn-secondary" onclick="abrirModeloForm('','contrato')">＋ Modelo de contrato</button></div></div>
    ${lista.map(m => `<div class="card"><div class="row-between">
      <div><b>${esc(m.nome)}</b> <span class="badge ${m.tipo === 'proposta' ? 'pendente' : 'neutral'}">${m.tipo === 'proposta' ? 'Proposta' : 'Contrato'}</span>${db.modelos.find(x => x.id === m.id) ? '' : ' <span class="tiny muted">exemplo</span>'}</div>
      <div class="btn-row" style="margin:0"><button class="btn btn-secondary btn-sm" onclick="abrirModeloForm('${esc(m.id)}')">✏️ Editar</button>${db.modelos.find(x => x.id === m.id) ? `<button class="btn btn-outline-danger btn-sm" onclick="excluirModelo('${esc(m.id)}')">🗑️</button>` : ''}</div></div>
      <div class="small muted mt">${esc(docPreencher(m.corpo, {}).replace(/[#*_]/g, '').slice(0, 160))}…</div></div>`).join('')}`;
}

function abrirModeloForm(id, tipo) {
  const m = id ? (db.modelos.find(x => x.id === id) || modelosPadrao().find(x => x.id === id)) : null;
  const rasc = window.__modDraft; window.__modDraft = null; window.__modEditId = id || '';
  const t = rasc ? rasc.tipo : (m ? m.tipo : (tipo || 'contrato'));
  const paleta = DOC_CAMPOS.map(([grupo, itens]) => `<div class="doc-grupo"><b>${esc(grupo)}</b> ${itens.map(([k, rot]) => `<button type="button" class="doc-chip" onclick="modInserir('${k}')" title="${esc(k)}">${esc(rot)}</button>`).join('')}</div>`).join('');
  openModal({
    title: m ? '✏️ Editar modelo' : (t === 'proposta' ? '＋ Modelo de proposta' : '＋ Modelo de contrato'),
    full: true,
    body: `<div class="frow"><div class="fg"><label>Nome do modelo *</label><input type="text" id="mdNome" value="${esc(rasc ? rasc.nome : (m ? m.nome : ''))}" placeholder="${t === 'proposta' ? 'Proposta de compra' : 'Promessa de compra e venda'}"></div>
      <div class="fg"><label>Tipo</label><select id="mdTipo"><option value="proposta" ${t === 'proposta' ? 'selected' : ''}>Proposta (corretor)</option><option value="contrato" ${t === 'contrato' ? 'selected' : ''}>Contrato (venda)</option></select></div></div>
      <div class="doc-editor-grid">
        <div class="fg"><label>Texto do documento</label>
          <textarea id="mdCorpo" class="doc-editor" spellcheck="false">${esc(rasc ? rasc.corpo : (m ? m.corpo : (t === 'proposta' ? MODELO_PROPOSTA : MODELO_CONTRATO)))}</textarea>
          <div class="hint">Clique num campo ao lado para inserir no lugar do cursor. Use <b># </b> no começo da linha para título, <b>## </b> para subtítulo e <b>**texto**</b> para negrito. Qualquer campo que você inventar, por exemplo <b>{{foro}}</b>, vira um preenchimento na hora de gerar.</div></div>
        <div class="doc-paleta">${paleta}</div>
      </div>`,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-outline" onclick="modTestar()">👁️ Ver exemplo</button><button class="btn btn-primary" onclick="salvarModelo('${esc(id || '')}')">Salvar modelo</button>`
  });
}
function modInserir(campo) {
  const ta = $('#mdCorpo'); if (!ta) return;
  const txt = '{{' + campo + '}}';
  const i = ta.selectionStart || 0, f = ta.selectionEnd || 0;
  ta.value = ta.value.slice(0, i) + txt + ta.value.slice(f);
  ta.focus(); ta.selectionStart = ta.selectionEnd = i + txt.length;
}
function modTestar() {
  const corpo = val('mdCorpo');
  window.__modDraft = { nome: val('mdNome'), tipo: val('mdTipo'), corpo };
  const lot = curLot() || { nome: 'Loteamento Exemplo', cidade: 'Sua cidade' };
  const l = (lotesDo(lot.id || '')[0]) || { quadra: 'A', numero: '1', area: 360, frente: 12, matricula: '00.000', tipo: 'residencial' };
  const ctx = docContexto({
    loteamento: lot, lote: l,
    cliente: {
      tipo: 'pf', genero: 'f', nome: 'Maria da Silva', cpf: '00000000000', profissao: 'comerciante', estadoCivil: 'casado',
      regimeBens: 'comunhão parcial de bens', nacionalidade: 'brasileiro', rg: '0.000.000', rgOrgao: 'SSP/SC', telefone: '48999990000',
      logradouro: 'Rua Exemplo', numeroEnd: '100', bairro: 'Centro', cep: '88000000', cidade: lot.cidade, uf: 'SC',
      conjuge: { tipo: 'pf', genero: 'm', nome: 'João da Silva', cpf: '11111111111', profissao: 'motorista', nacionalidade: 'brasileiro', rg: '1.111.111', rgOrgao: 'SSP/SC', mesmoEndereco: true }
    },
    corretor: { nome: 'João Corretor', creci: '12345', telefone: '48988887777' },
    pagamento: { valorTotal: 180000, entrada: 30000, dataEntrada: todayStr(), nParcelas: 60, valorParcela: 2800, jurosMes: 1, primeiroVencimento: addMonths(todayStr(), 1), baloes: [] },
    validade: fmtDate(addDays(todayStr(), 5)),
    extras: {}
  });
  const html = docHtml(corpo, ctx);
  openModal({ title: '👁️ Exemplo preenchido', wide: true, body: `<p class="help mb">Dados fictícios só para conferir o texto. Os espaços em branco são campos sem valor no cadastro.</p><div class="doc-folha">${html}</div>`, footer: `<button class="btn btn-primary" onclick="abrirModeloForm('${esc(window.__modEditId || '')}')">Voltar ao editor</button>` });
}
function salvarModelo(id) {
  if (!pode('documentos.editar')) { toast('🔒', 'Sem permissão', 'Seu perfil não edita modelos.', true); return; }
  const nome = val('mdNome'); if (!nome) { toast('⚠️', 'Dê um nome ao modelo', '', true); return; }
  const corpo = val('mdCorpo'); if (corpo.length < 20) { toast('⚠️', 'O texto está muito curto', '', true); return; }
  const prev = id ? db.modelos.find(x => x.id === id) : null;
  const rec = Object.assign({}, prev || { id: id || genId(), criadoEm: new Date().toISOString() }, { nome, tipo: val('mdTipo'), corpo });
  upsert('modelos', rec);
  logAct(`Modelo de ${rec.tipo} salvo: ${nome}`);
  closeModal(); renderCadastros(); toast('✅', 'Modelo salvo', nome);
}
function excluirModelo(id) {
  const m = db.modelos.find(x => x.id === id); if (!m) return;
  if (!confirm(`Excluir o modelo "${m.nome}"?`)) return;
  removeRec('modelos', id); renderCadastros(); toast('🗑️', 'Modelo excluído', '');
}
