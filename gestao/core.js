/* ===== Gestão de Loteamento — núcleo (dados, utilitários, navegação) ===== */
'use strict';

const DB_KEY = 'gl_db_v1';
const PREF_KEY = 'gl_prefs_v1';

// ---------------------------------------------------------------- utilitários
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function pad2(n) { return String(n).padStart(2, '0'); }
function ymd(dt) { return dt.getFullYear() + '-' + pad2(dt.getMonth() + 1) + '-' + pad2(dt.getDate()); }
function todayStr() { return ymd(new Date()); }
function parseDate(s) { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return ymd(d); }
function addMonths(s, n) {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1 + n, 1);
  const last = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  dt.setDate(Math.min(d, last));
  return ymd(dt);
}
function daysBetween(a, b) { return Math.round((parseDate(b) - parseDate(a)) / 86400000); }
function monthKey(s) { return (s || '').slice(0, 7); }
function monthLabel(key) { const [y, m] = key.split('-'); return ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][Number(m) - 1] + '/' + y.slice(2); }
function fmtMoney(v) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function fmtMoneyShort(v) {
  v = Number(v) || 0; const abs = Math.abs(v);
  if (abs >= 1e6) return 'R$ ' + (v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' mi';
  if (abs >= 1e4) return 'R$ ' + (v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';
  return fmtMoney(v);
}
function fmtNum(v, dec = 2) { return (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
function fmtDate(s) { if (!s) return '—'; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; }
function fmtDateTime(iso) { if (!iso) return ''; const d = new Date(iso); return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function num(v) { const n = parseFloat(String(v ?? '').replace(',', '.')); return isNaN(n) ? 0 : n; }
function naturalCmp(a, b) { return String(a ?? '').localeCompare(String(b ?? ''), 'pt-BR', { numeric: true, sensitivity: 'base' }); }
function onlyDigits(s) { return String(s || '').replace(/\D/g, ''); }
function fmtPhone(s) {
  const d = onlyDigits(s);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return s || '';
}
function fmtCPF(s) {
  const d = onlyDigits(s);
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return s || '';
}
function waLink(phone, text) {
  let d = onlyDigits(phone);
  if (d && d.length <= 11) d = '55' + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}
function hashStr(str) { // cyrb53 — não é criptografia forte, apenas evita guardar o PIN em texto puro
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
function download(filename, content, type = 'application/json') {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function csvEscape(v) { const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function toCSV(rows) { return '﻿' + rows.map(r => r.map(csvEscape).join(';')).join('\n'); }
function readFileAsDataURL(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); }); }
function readFileAsText(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(file); }); }
function resizeImage(dataUrl, maxW = 2000) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      res({ dataUrl: c.toDataURL('image/jpeg', 0.86), w, h });
    };
    img.onerror = rej; img.src = dataUrl;
  });
}
function pmt(rateMonth, n, pv) { // parcela Price
  if (n <= 0) return 0;
  if (!rateMonth) return pv / n;
  const i = rateMonth;
  return pv * i / (1 - Math.pow(1 + i, -n));
}

function toast(icon, title, body, isErr) {
  const c = $('#toastContainer');
  const t = document.createElement('div');
  t.className = 'toast' + (isErr ? ' err' : '');
  t.innerHTML = `<div class="t">${icon} ${esc(title)}</div>${body ? `<div>${esc(body)}</div>` : ''}`;
  c.appendChild(t);
  setTimeout(() => t.remove(), 4200);
}

// ---------------------------------------------------------------- modal
function openModal({ title, body, footer = '', wide = false, onClose = null }) {
  $('#modalTitle').innerHTML = title;
  $('#modalBody').innerHTML = body;
  $('#modalFoot').innerHTML = footer;
  $('#modalFoot').style.display = footer ? 'flex' : 'none';
  $('#modalBox').classList.toggle('wide', wide);
  $('#modalBody').scrollTop = 0;
  $('#modalOverlay').classList.add('open');
  state.modalOnClose = onClose;
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  $('#modalOverlay').classList.remove('open');
  document.body.style.overflow = '';
  const cb = state.modalOnClose; state.modalOnClose = null;
  if (cb) cb();
}
function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v ?? ''; }
function checked(id) { const el = document.getElementById(id); return !!(el && el.checked); }
function optionsHtml(list, selected, labelFn = x => x.nome, valueFn = x => x.id) {
  return list.map(x => `<option value="${esc(valueFn(x))}" ${valueFn(x) === selected ? 'selected' : ''}>${esc(labelFn(x))}</option>`).join('');
}

// ---------------------------------------------------------------- dados
function defaultCategorias() {
  return [
    { id: 'administrativo', nome: 'Administrativo', cor: '#6366f1' },
    { id: 'agua', nome: 'Água', cor: '#06b6d4' },
    { id: 'cartorio', nome: 'Cartório', cor: '#b91c1c' },
    { id: 'documentacao', nome: 'Documentação', cor: '#ef4444' },
    { id: 'drenagem', nome: 'Drenagem', cor: '#0284c7' },
    { id: 'esgoto', nome: 'Esgoto', cor: '#0e7490' },
    { id: 'impostos', nome: 'Impostos', cor: '#64748b' },
    { id: 'licencas', nome: 'Licenças', cor: '#0f766e' },
    { id: 'mao-de-obra', nome: 'Mão de Obra', cor: '#8b5cf6' },
    { id: 'marketing', nome: 'Marketing', cor: '#22c55e' },
    { id: 'materiais', nome: 'Materiais', cor: '#f97316' },
    { id: 'outros', nome: 'Outros', cor: '#94a3b8' },
    { id: 'pavimentacao', nome: 'Pavimentação', cor: '#0ea5e9' },
    { id: 'projetos', nome: 'Projetos', cor: '#14b8a6' },
    { id: 'rede-eletrica', nome: 'Rede Elétrica / Iluminação', cor: '#eab308' },
    { id: 'taxas', nome: 'Taxas', cor: '#475569' },
    { id: 'terraplanagem', nome: 'Terraplanagem', cor: '#92400e' },
    { id: 'terreno', nome: 'Aquisição do Terreno', cor: '#a16207' },
    { id: 'vendas', nome: 'Vendas', cor: '#15803d' }
  ];
}

/* As categorias padrão antigas juntavam dois assuntos numa linha só. Quem já usa o sistema
   recebe a divisão sozinho: [id antigo, nome antigo, categoria que fica com o histórico,
   categoria nova]. Rede Elétrica / Iluminação fica junta, por decisão de uso. */
const CATEGORIAS_DIVIDIDAS = [
  ['pavimentacao', 'Pavimentação e Drenagem', ['pavimentacao', 'Pavimentação', '#0ea5e9'], ['drenagem', 'Drenagem', '#0284c7']],
  ['agua-esgoto', 'Água e Esgoto', ['agua', 'Água', '#06b6d4'], ['esgoto', 'Esgoto', '#0e7490']],
  ['documentacao', 'Documentação e Cartório', ['documentacao', 'Documentação', '#ef4444'], ['cartorio', 'Cartório', '#b91c1c']],
  ['projetos', 'Projetos e Licenças', ['projetos', 'Projetos', '#14b8a6'], ['licencas', 'Licenças', '#0f766e']],
  ['impostos', 'Impostos e Taxas', ['impostos', 'Impostos', '#64748b'], ['taxas', 'Taxas', '#475569']],
  ['marketing', 'Marketing e Vendas', ['marketing', 'Marketing', '#22c55e'], ['vendas', 'Vendas', '#15803d']]
];

/* Divide as categorias padrão antigas em duas. Só mexe na categoria que ainda tem o id e o
   nome de fábrica — quem já renomeou fica como está. Lançamentos e orçamento continuam na
   primeira das duas, para não inventar rateio; quem divide o valor é você. */
function migrarCategorias() {
  if (Cloud.active && Cloud.papel !== 'dono' && Cloud.papel !== 'admin') return 0;
  let n = 0;
  CATEGORIAS_DIVIDIDAS.forEach(([idAntigo, nomeAntigo, fica, nova]) => {
    const velha = db.categorias.find(c => c.id === idAntigo && c.nome === nomeAntigo);
    if (!velha || db.categorias.some(c => c.id === nova[0])) return;
    if (fica[0] !== idAntigo) {
      db.custos.filter(x => x.categoriaId === idAntigo).forEach(x => upsert('custos', Object.assign({}, x, { categoriaId: fica[0] })));
      db.loteamentos.forEach(l => {
        const orc = l.orcamento || {};
        if (orc[idAntigo] === undefined) return;
        const novoOrc = Object.assign({}, orc);
        novoOrc[fica[0]] = novoOrc[idAntigo]; delete novoOrc[idAntigo];
        upsert('loteamentos', Object.assign({}, l, { orcamento: novoOrc }));
      });
      removeRec('categorias', idAntigo);
    }
    upsert('categorias', { id: fica[0], nome: fica[1], cor: fica[2] });
    upsert('categorias', { id: nova[0], nome: nova[1], cor: nova[2] });
    n++;
  });
  if (n) {
    db.categorias.sort((a, b) => naturalCmp(a.nome, b.nome));
    logAct(`Categorias de custo divididas em temas separados (${n})`);
  }
  return n;
}
function defaultConfig() {
  return {
    empresa: '',
    adminPin: hashStr('1234'),
    pinPadrao: true,
    codigoCorretor: '',
    reservaDias: 7,
    multaPct: 2,
    jurosMesPct: 1,
    comissaoPct: 5,
    adminWhatsapp: '',
    cnpj: '',
    endereco: '',
    cidade: '',
    telefone: '',
    email: '',
    representante: '',
    repCpf: '',
    pix: '',
    mostrarPrecoVendido: true
  };
}
function defaultDB() {
  return {
    meta: { version: 1, createdAt: new Date().toISOString() },
    config: defaultConfig(),
    loteamentos: [], lotes: [], reservas: [], vendas: [], recebiveis: [], custos: [],
    categorias: defaultCategorias(), corretores: [], leads: [], modelos: [], indices: [], cobrancas: [], contasBanco: [], remessas: [], log: []
  };
}
const COLLECTIONS = ['loteamentos', 'lotes', 'reservas', 'vendas', 'recebiveis', 'custos', 'categorias', 'corretores', 'leads', 'modelos', 'indices', 'cobrancas', 'contasBanco', 'remessas', 'log'];
function normalizeDB(data) {
  const d = data && typeof data === 'object' ? data : {};
  d.meta = d.meta || { version: 1 };
  d.config = Object.assign(defaultConfig(), d.config || {});
  COLLECTIONS.forEach(c => {
    let v = d[c];
    if (v && !Array.isArray(v) && typeof v === 'object') v = Object.values(v);
    d[c] = Array.isArray(v) ? v.filter(Boolean) : [];
  });
  if (!d.categorias.length) d.categorias = defaultCategorias();
  d.lotes.forEach(l => { if (l.pts && !Array.isArray(l.pts)) l.pts = Object.values(l.pts); });
  d.vendas.forEach(v => { if (v.baloes && !Array.isArray(v.baloes)) v.baloes = Object.values(v.baloes); v.baloes = v.baloes || []; });
  return d;
}

// configuração da nuvem (gestao/config.js); sem ela o app roda só neste dispositivo
const GL_CFG = window.GL_CONFIG || {};
const CLOUD_ENABLED = !!(GL_CFG.supabaseUrl && GL_CFG.supabaseAnonKey && window.supabase && window.supabase.createClient);

function cacheKey() { return CLOUD_ENABLED ? (Cloud.org ? 'gl_cache_' + Cloud.org.id : null) : DB_KEY; }
function loadLocalRaw(key) { try { const raw = localStorage.getItem(key || DB_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
let db = CLOUD_ENABLED ? normalizeDB(null) : normalizeDB(loadLocalRaw());
function saveLocal() {
  const k = cacheKey(); if (!k) return;
  try { localStorage.setItem(k, JSON.stringify(db)); }
  catch (e) { toast('⚠️', 'Não foi possível salvar localmente', 'Armazenamento cheio. Reduza imagens ou faça backup e limpe dados.', true); }
}

const prefs = (() => { try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); } catch (e) { return {}; } })();
function savePrefs() { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); }

// gravação: sempre em memória + cache local; na nuvem, também no Supabase
function upsert(col, rec) {
  const arr = db[col];
  const i = arr.findIndex(r => r.id === rec.id);
  if (i >= 0) arr[i] = rec; else arr.push(rec);
  saveLocal();
  if (Cloud.active) Cloud.upsert(col, rec);
  return rec;
}
function removeRec(col, id) {
  db[col] = db[col].filter(r => r.id !== id);
  saveLocal();
  if (Cloud.active) Cloud.remove(col, id);
}
function setConfig(patch) {
  Object.assign(db.config, patch);
  saveLocal();
  if (Cloud.active) Cloud.saveConfig();
}
function replaceDB(newDb) {
  db = normalizeDB(newDb);
  saveLocal();
  if (Cloud.active) return Cloud.replaceAll();
  return Promise.resolve();
}
function logAct(msg, who) {
  const entry = { id: genId(), ts: new Date().toISOString(), who: who || (Cloud.active ? (Cloud.membro.nome || 'Usuário') : (state.role === 'admin' ? 'Admin' : 'Corretor')), msg };
  db.log.push(entry);
  if (db.log.length > 400) db.log = db.log.slice(-400);
  saveLocal();
  if (Cloud.active) Cloud.upsert('log', entry);
}

// ---------------------------------------------------------------- nuvem (Supabase)
/* Código de convite: 10 caracteres sorteados pelo gerador criptográfico do navegador.
   Alfabeto sem 0/O e 1/I/L, que a pessoa erra ao digitar. São 32^10 combinações:
   não dá para adivinhar nem para prever o próximo a partir dos anteriores. */
function codigoConvite(n) {
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const tam = n || 10;
  const bytes = new Uint8Array(tam);
  (window.crypto || window.msCrypto).getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < tam; i++) out += alfabeto[bytes[i] % alfabeto.length];
  return out;
}

const TABLE_COLS = {
  loteamentos: ['id', 'nome', 'tipo', 'cidade', 'endereco', 'descricao', 'cond', 'orcamento', 'planta', 'criadoEm'],
  categorias: ['id', 'nome', 'cor'],
  lotes: ['id', 'loteamentoId', 'quadra', 'numero', 'area', 'frente', 'fundos', 'preco', 'tipo', 'status', 'obs', 'matricula', 'pts', 'reservaId', 'vendaId', 'criadoEm'],
  reservas: ['id', 'loteamentoId', 'loteId', 'corretor', 'corretorUserId', 'cliente', 'dataReserva', 'validade', 'status', 'proposta', 'obs', 'motivo', 'aprovadaEm', 'encerradaEm', 'criadoEm'],
  vendas: ['id', 'loteamentoId', 'loteId', 'imovel', 'reservaId', 'cliente', 'corretor', 'corretorUserId', 'dataVenda', 'valorTotal', 'entrada', 'dataEntrada', 'nParcelas', 'jurosMes', 'valorParcela', 'primeiroVencimento', 'baloes', 'indiceId', 'indiceBase', 'comissaoPct', 'comissaoValor', 'comissaoPaga', 'comissaoData', 'status', 'obs', 'motivo', 'distratoEm', 'criadoEm'],
  recebiveis: ['id', 'loteamentoId', 'vendaId', 'tipo', 'numero', 'descricao', 'vencimento', 'valor', 'valorPago', 'valorCorrigido', 'nossoNumero', 'remessaEm', 'bancoValor', 'bancoVenc', 'dataPagamento', 'forma', 'obsPagamento'],
  custos: ['id', 'loteamentoId', 'loteId', 'descricao', 'categoriaId', 'fornecedor', 'valor', 'formaPagamento', 'dataCompetencia', 'vencimento', 'status', 'dataPagamento', 'obs', 'criadoEm'],
  modelos: ['id', 'nome', 'tipo', 'corpo', 'criadoEm'],
  indices: ['id', 'codigo', 'nome', 'tipo', 'valores', 'criadoEm'],
  contasBanco: ['id', 'loteamentoId', 'banco', 'carteira', 'variacao', 'agencia', 'agenciaDv', 'conta', 'contaDv', 'convenio', 'nossoNumeroAtual', 'nnMax', 'remessaSeq', 'multaPct', 'jurosMesPct', 'jurosDia', 'descontoPct', 'protestoDias', 'baixaDias', 'especie', 'aceite', 'instrucao1', 'instrucao2', 'mensagem1', 'mensagem2', 'criadoEm'],
  cobrancas: ['id', 'vendaId', 'loteamentoId', 'data', 'canal', 'faixa', 'dias', 'valor', 'obs', 'quem', 'criadoEm'],
  remessas: ['id', 'loteamentoId', 'contaId', 'sequencial', 'data', 'arquivo', 'qtd', 'baixas', 'valor', 'recIds', 'primeiroNn', 'ultimoNn', 'criadoEm'],
  leads: ['id', 'loteamentoId', 'loteId', 'nome', 'telefone', 'email', 'msg', 'origem', 'status', 'obs', 'criadoEm'],
  log: ['id', 'ts', 'who', 'msg']
};
const NULLABLE_EMPTY = new Set(['validade', 'aprovadaEm', 'encerradaEm', 'dataEntrada', 'primeiroVencimento', 'comissaoData', 'distratoEm', 'dataPagamento', 'vencimento', 'reservaId', 'vendaId', 'loteId', 'categoriaId', 'forma', 'frente', 'fundos', 'planta', 'pts', 'proposta', 'corretorUserId']);
const INT_FIELDS = new Set(['nParcelas', 'numero']);
function snakeKey(k) { return k.replace(/[A-Z]/g, m => '_' + m.toLowerCase()); }
/* No aplicativo a coleção é camelCase (contasBanco); no Postgres a tabela é snake_case
   (contas_banco). Todas as outras são uma palavra só, então a conversão não muda nada. */
function tabelaDe(col) { return snakeKey(col); }
function camelKey(k) { return k.replace(/_([a-z])/g, (m, c) => c.toUpperCase()); }
function toRow(col, rec) {
  const row = { org_id: Cloud.org.id };
  TABLE_COLS[col].forEach(k => {
    if (!(k in rec)) return;
    let v = rec[k];
    if (v === undefined || (v === '' && NULLABLE_EMPTY.has(k))) v = null;
    if (INT_FIELDS.has(k) && col !== 'lotes' && v !== null) v = Math.round(num(v));
    row[snakeKey(k)] = v;
  });
  return row;
}
function fromRow(col, row) {
  const rec = {};
  Object.keys(row).forEach(k => { if (k !== 'org_id') rec[camelKey(k)] = row[k]; });
  if (col === 'lotes') { rec.numero = String(rec.numero ?? ''); rec.pts = rec.pts || null; }
  if (col === 'vendas') rec.baloes = rec.baloes || [];
  return rec;
}
function membroToCorretor(m) { return { id: m.id, userId: m.userId, nome: m.nome, creci: m.creci, telefone: m.telefone, email: m.email, imobiliaria: m.imobiliaria, ativo: m.ativo, papel: m.papel }; }

const Cloud = {
  enabled: CLOUD_ENABLED, client: null, user: null, org: null, membro: null, papel: null, vitrines: [],
  membros: [], convites: [], minhasOrgs: [], active: false, status: 'off', msg: '', channel: null, _renderTimer: null,
  init() {
    if (!this.enabled) return;
    this.client = window.supabase.createClient(GL_CFG.supabaseUrl, GL_CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    this.client.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') { state.role = 'landing'; showScreen('landing'); renderAuth('nova-senha'); return; }
      if (event === 'SIGNED_OUT') { this.user = null; this.fecharOrg(); state.role = 'landing'; showScreen('landing'); renderAuth('login'); return; }
      if (event === 'SIGNED_IN' && session && !this.user) { this.user = session.user; this.aposLogin(); }
    });
  },
  get admin() { return ['dono', 'admin', 'financeiro'].includes(this.papel); },
  async boot() {
    renderAuth('carregando');
    const { data } = await this.client.auth.getSession();
    if (data.session) { this.user = data.session.user; await this.aposLogin(); }
    else renderAuth('login');
  },
  async signIn(email, senha) { const { error } = await this.client.auth.signInWithPassword({ email, password: senha }); if (error) throw error; },
  async signUp(email, senha, nome) {
    const { data, error } = await this.client.auth.signUp({ email, password: senha, options: { data: { nome }, emailRedirectTo: location.origin + location.pathname } });
    if (error) throw error;
    return data; // data.session === null quando a confirmação de e-mail está ativada
  },
  async signOut() { this.fecharOrg(); await this.client.auth.signOut(); },
  async resetPassword(email) { const { error } = await this.client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }); if (error) throw error; },
  async updatePassword(senha) { const { error } = await this.client.auth.updateUser({ password: senha }); if (error) throw error; },
  async rpc(fn, args) { const { data, error } = await this.client.rpc(fn, args); if (error) throw new Error(error.message || String(error)); return data; },

  // --- empresas do usuário ---
  async carregarMinhasOrgs() {
    const { data, error } = await this.client.from('membros').select('*, organizacoes(id, nome, config, plano)').eq('user_id', this.user.id).eq('ativo', true);
    if (error) throw new Error(error.message);
    this.minhasOrgs = (data || []).filter(m => m.organizacoes).map(m => ({ membro: m, org: m.organizacoes }));
    return this.minhasOrgs;
  },
  async aposLogin() {
    try {
      renderAuth('carregando');
      await this.carregarMinhasOrgs();
      const p = new URLSearchParams(location.search);
      const convite = p.get('convite') || prefs.convitePendente;
      if (convite) { prefs.convitePendente = convite; savePrefs(); renderAuth('entrar'); return; }
      if (!this.minhasOrgs.length) { renderAuth('entrar'); return; }
      const lembrada = this.minhasOrgs.find(x => x.org.id === prefs.orgId);
      if (this.minhasOrgs.length === 1 || lembrada) await this.abrirOrg((lembrada || this.minhasOrgs[0]).org.id);
      else renderAuth('escolher');
    } catch (e) { renderAuth('login', 'Falha ao carregar seus dados: ' + e.message); }
  },
  async abrirOrg(orgId) {
    const item = this.minhasOrgs.find(x => x.org.id === orgId) || (await this.carregarMinhasOrgs(), this.minhasOrgs.find(x => x.org.id === orgId));
    if (!item) throw new Error('Empresa não encontrada');
    this.org = item.org; this.membro = fromRow('membros', item.membro); this.papel = item.membro.papel;
    prefs.orgId = orgId; savePrefs();
    // cache local para abrir rápido
    const cached = loadLocalRaw('gl_cache_' + orgId);
    db = normalizeDB(cached || {});
    db.config = Object.assign(defaultConfig(), item.org.config || {});
    this.active = true; this.status = 'loading'; this.msg = 'Carregando…'; renderSyncStatus();
    await this.loadAll();
    this.subscribe();
    this.status = 'on'; this.msg = 'Sincronizado'; renderSyncStatus();
    startRole(this.admin ? 'admin' : 'corretor');
  },
  fecharOrg() {
    if (this.channel) { try { this.client.removeChannel(this.channel); } catch (e) { /* ignora */ } this.channel = null; }
    this.org = null; this.membro = null; this.papel = null; this.active = false; this.status = 'off';
    db = normalizeDB(null);
  },
  async loadAll() {
    const org = this.org.id;
    const tabs = Object.keys(TABLE_COLS);
    const results = await Promise.all(tabs.map(t => this.client.from(tabelaDe(t)).select('*').eq('org_id', org).limit(t === 'log' ? 400 : 20000).order(t === 'log' ? 'ts' : 'id', { ascending: true })));
    tabs.forEach((t, i) => { if (results[i].error) throw new Error(t + ': ' + results[i].error.message); db[t] = (results[i].data || []).map(r => fromRow(t, r)); });
    if (!db.categorias.length) db.categorias = defaultCategorias();
    migrarCategorias();
    await this.loadEquipe();
    if (this.admin) await this.carregarVitrines();
    saveLocal();
  },
  async loadEquipe() {
    const org = this.org.id;
    const { data: ms } = await this.client.from('membros').select('*').eq('org_id', org).order('nome');
    this.membros = (ms || []).map(m => fromRow('membros', m));
    db.corretores = this.membros.filter(m => m.papel === 'corretor').map(membroToCorretor);
    const me = this.membros.find(m => m.userId === this.user.id); if (me) { this.membro = me; this.papel = me.papel; }
    if (this.admin) { const { data: cs } = await this.client.from('convites').select('*').eq('org_id', org).order('criado_em', { ascending: false }); this.convites = (cs || []).map(c => fromRow('convites', c)); }
  },
  subscribe() {
    if (this.channel) this.client.removeChannel(this.channel);
    const org = this.org.id;
    let ch = this.client.channel('org-' + org);
    Object.keys(TABLE_COLS).forEach(t => {
      ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: tabelaDe(t), filter: 'org_id=eq.' + org }, payload => this.onChange(t, payload));
    });
    ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: 'organizacoes', filter: 'id=eq.' + org }, payload => { if (payload.new && payload.new.config) { db.config = Object.assign(defaultConfig(), payload.new.config); saveLocal(); this.agendarRender(); } });
    ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: 'membros', filter: 'org_id=eq.' + org }, () => { this.loadEquipe().then(() => this.agendarRender()); });
    ch.subscribe(status => {
      if (status === 'SUBSCRIBED') { this.status = 'on'; this.msg = 'Sincronizado'; }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { this.status = 'offline'; this.msg = 'Sem tempo real (recarregue para atualizar)'; }
      renderSyncStatus();
    });
    this.channel = ch;
  },
  onChange(table, payload) {
    if (payload.eventType === 'DELETE') { const id = payload.old && payload.old.id; if (id) db[table] = db[table].filter(r => r.id !== id); }
    else if (payload.new) { const rec = fromRow(table, payload.new); const i = db[table].findIndex(r => r.id === rec.id); if (i >= 0) db[table][i] = rec; else db[table].push(rec); }
    saveLocal(); this.agendarRender();
  },
  agendarRender() { clearTimeout(this._renderTimer); this._renderTimer = setTimeout(() => { if (!$('#modalOverlay').classList.contains('open')) renderCurrent(); else updateTopbars(); }, 250); },
  erro(e, oque) { console.error(oque, e); toast('⚠️', 'Falha ao salvar na nuvem', (e && e.message) || String(e), true); },

  // --- escrita ---
  async upsert(col, rec) {
    if (!TABLE_COLS[col]) return;
    const { error } = await this.client.from(tabelaDe(col)).upsert(toRow(col, rec), { onConflict: 'org_id,id' });
    if (error) this.erro(error, col);
  },
  async remove(col, id) {
    if (!TABLE_COLS[col]) return;
    const { error } = await this.client.from(tabelaDe(col)).delete().eq('org_id', this.org.id).eq('id', id);
    if (error) this.erro(error, col);
  },
  async saveConfig() {
    const cfg = Object.assign({}, db.config); delete cfg.adminPin; delete cfg.pinPadrao; delete cfg.codigoCorretor;
    const { error } = await this.client.from('organizacoes').update({ config: cfg }).eq('id', this.org.id);
    if (error) this.erro(error, 'config'); else this.org.config = cfg;
  },
  async replaceAll() {
    try {
      await this.rpc('limpar_dados_org', { p_org: this.org.id });
      for (const t of ['loteamentos', 'categorias', 'lotes', 'reservas', 'vendas', 'recebiveis', 'custos', 'leads', 'modelos', 'indices', 'cobrancas', 'contasBanco', 'remessas', 'log']) {
        const rows = db[t].map(r => toRow(t, r));
        for (let i = 0; i < rows.length; i += 400) {
          const { error } = await this.client.from(tabelaDe(t)).upsert(rows.slice(i, i + 400), { onConflict: 'org_id,id' });
          if (error) throw new Error(t + ': ' + error.message);
        }
      }
      await this.saveConfig();
    } catch (e) { this.erro(e, 'replaceAll'); }
  },
  // --- vitrine pública ---
  async carregarVitrines() {
    const { data, error } = await this.client.from('vitrines').select('*').eq('org_id', this.org.id);
    if (error) { this.vitrines = []; return; }
    this.vitrines = (data || []).map(v => ({ loteamentoId: v.loteamento_id, slug: v.slug, ativa: v.ativa, mostrarPreco: v.mostrar_preco, titulo: v.titulo || '', chamada: v.chamada || '', whatsapp: v.whatsapp || '' }));
  },
  async salvarVitrine(v) {
    const row = { org_id: this.org.id, loteamento_id: v.loteamentoId, slug: v.slug, ativa: !!v.ativa, mostrar_preco: !!v.mostrarPreco, titulo: v.titulo || '', chamada: v.chamada || '', whatsapp: v.whatsapp || '' };
    const { error } = await this.client.from('vitrines').upsert(row, { onConflict: 'org_id,loteamento_id' });
    if (error) throw new Error(/vitrines_slug_idx|duplicate key/i.test(error.message) ? 'Este endereço de link já está em uso. Escolha outro.' : error.message);
    await this.carregarVitrines();
  },
  async apagarVitrine(loteamentoId) {
    const { error } = await this.client.from('vitrines').delete().eq('org_id', this.org.id).eq('loteamento_id', loteamentoId);
    if (error) throw new Error(error.message);
    await this.carregarVitrines();
  },
  async uploadPlanta(loteamentoId, dataUrl) {
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${this.org.id}/${loteamentoId}.jpg`;
    const { error } = await this.client.storage.from('plantas').upload(path, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
    if (error) throw new Error(error.message);
    const { data } = this.client.storage.from('plantas').getPublicUrl(path);
    return data.publicUrl + '?v=' + Date.now();
  },
  // --- funções do banco ---
  criarOrganizacao(nome, usuarioNome, telefone) { return this.rpc('criar_organizacao', { p_nome: nome, p_usuario_nome: usuarioNome, p_telefone: telefone }); },
  entrarComConvite(codigo, d) { return this.rpc('entrar_com_convite', { p_codigo: codigo, p_nome: d.nome || '', p_telefone: d.telefone || '', p_creci: d.creci || '', p_imobiliaria: d.imobiliaria || '' }); },
  solicitarReserva(r) { return this.rpc('solicitar_reserva', { p_org: this.org.id, p_reserva: { id: r.id, lote_id: r.loteId, corretor: r.corretor, cliente: r.cliente, proposta: r.proposta, obs: r.obs } }); },
  cancelarMinhaReserva(id, motivo) { return this.rpc('cancelar_minha_reserva', { p_org: this.org.id, p_id: id, p_motivo: motivo || '' }); },
  atualizarMeuPerfil(d) { return this.rpc('atualizar_meu_perfil', { p_org: this.org.id, p_nome: d.nome, p_telefone: d.telefone, p_creci: d.creci, p_imobiliaria: d.imobiliaria }); },
  limparDados() { return this.rpc('limpar_dados_org', { p_org: this.org.id }); },
  async salvarMembro(m) { const { error } = await this.client.from('membros').update({ papel: m.papel, ativo: m.ativo, nome: m.nome, telefone: m.telefone, creci: m.creci, imobiliaria: m.imobiliaria }).eq('id', m.id); if (error) throw new Error(error.message); await this.loadEquipe(); },
  async criarConvite(papel, descricao, opc) {
    const o = opc || {};
    const codigo = codigoConvite();
    const linha = { org_id: this.org.id, codigo, papel, descricao: descricao || '', criado_por: this.user.id, max_usos: Math.max(1, parseInt(o.maxUsos, 10) || 1) };
    const dias = parseInt(o.dias, 10);
    if (dias > 0) linha.expira_em = new Date(Date.now() + dias * 86400000).toISOString();
    const { error } = await this.client.from('convites').insert(linha);
    if (error) throw new Error(error.message); await this.loadEquipe(); return codigo;
  },
  async apagarConvite(id) { const { error } = await this.client.from('convites').delete().eq('id', id); if (error) throw new Error(error.message); await this.loadEquipe(); }
};
function renderSyncStatus() {
  const on = Cloud.enabled;
  $$('.sync-pill').forEach(el => {
    el.className = 'sync-pill' + (Cloud.status === 'on' ? ' on' : Cloud.status === 'offline' ? ' err' : '');
    el.innerHTML = `<span class="dot"></span>${!on ? 'Somente neste dispositivo' : Cloud.status === 'off' ? 'Nuvem configurada' : esc(Cloud.msg)}`;
  });
  const s = $('#syncStatusBox'); if (s) s.innerHTML = !on ? '<span class="badge neutral">Desativada</span>' : `<span class="badge ${Cloud.status === 'on' ? 'pago' : Cloud.status === 'offline' ? 'atrasado' : 'pendente'}">${esc(Cloud.msg || 'Conectando…')}</span>`;
}

// ---------------------------------------------------------------- estado / navegação
const state = {
  role: null, tab: null, lotId: prefs.lotId || null,
  modalOnClose: null, filters: {}, sub: {}, plantaCorretor: null, plantaAdmin: null, editorLoteId: null
};
/* Empreendimento escolhido no filtro das telas globais. '' = todos. */
function escopoAtual() { return state.escopo || ''; }
function escopoNome() { const l = escopoAtual() && getLoteamento(escopoAtual()); return l ? l.nome : 'Todos os empreendimentos'; }
function escopoSelectHtml(onchange) {
  if (db.loteamentos.length < 2) return '';
  return `<select onchange="state.escopo=this.value;${onchange}"><option value="">Todos os empreendimentos</option>${db.loteamentos.map(l => `<option value="${esc(l.id)}" ${escopoAtual() === l.id ? 'selected' : ''}>${esc(l.nome)}</option>`).join('')}</select>`;
}
function curLot() {
  let l = db.loteamentos.find(x => x.id === state.lotId);
  if (!l && db.loteamentos.length) { l = db.loteamentos[0]; state.lotId = l.id; }
  return l || null;
}
function setCurLot(id) { state.lotId = id; prefs.lotId = id; savePrefs(); renderCurrent(); }
/* Troca o empreendimento do espaço de trabalho sem redesenhar: quem chamou já vai desenhar. */
/* Onde desenhar uma tela que vive dentro do espaço do empreendimento. Quando o usuário
   clica num filtro lá dentro, o redesenho tem de voltar para o mesmo lugar. */
/* Telas globais que precisam de UM empreendimento (nova venda, cobrança bancária, porque a
   conta é de cada um). Se o filtro já aponta um, usa; se só existe um, usa; senão pergunta. */
function comEmpreendimento(titulo, ajuda, seguir, filtro) {
  const lista = (db.loteamentos || []).filter(l => !filtro || filtro(l));
  if (!lista.length) { toast('⚠️', 'Nenhum empreendimento disponível', ajuda || '', true); return; }
  const doFiltro = escopoAtual() && lista.find(l => l.id === escopoAtual());
  if (doFiltro) { setCurLotSilencioso(doFiltro.id); seguir(doFiltro); return; }
  if (lista.length === 1) { setCurLotSilencioso(lista[0].id); seguir(lista[0]); return; }
  window.__seguirEmp = seguir;
  openModal({ title: titulo, body: `<p class="help mb">${esc(ajuda || '')}</p>
    <div class="fg"><label>Empreendimento</label><select id="ceEmp">${lista.map(l => `<option value="${esc(l.id)}">${esc(l.nome)} — ${esc(empLabel(l))}</option>`).join('')}</select></div>`,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="confirmarEmpreendimento()">Continuar</button>` });
}
function confirmarEmpreendimento() {
  const id = val('ceEmp'); const l = getLoteamento(id); const seguir = window.__seguirEmp;
  window.__seguirEmp = null; closeModal();
  if (l && seguir) { setCurLotSilencioso(l.id); seguir(l); }
}
function alvoDoEmp(idFallback) { return (state.tab === 'emp' && $('#empConteudo')) || $('#' + idFallback); }
function setCurLotSilencioso(id) { state.lotId = id; prefs.lotId = id; savePrefs(); }
function lotesDo(lotId) { return db.lotes.filter(l => l.loteamentoId === lotId).sort(cmpLote); }
function cmpLote(a, b) { return naturalCmp(a.quadra, b.quadra) || naturalCmp(a.numero, b.numero); }
function getLote(id) { return db.lotes.find(l => l.id === id); }
function getLoteamento(id) { return db.loteamentos.find(l => l.id === id); }
function getReserva(id) { return db.reservas.find(r => r.id === id); }
function getVenda(id) { return db.vendas.find(v => v.id === id); }
function getCategoria(id) { return db.categorias.find(c => c.id === id); }
function loteLabel(l) { return `Quadra ${l.quadra} · Lote ${l.numero}`; }
function loteShort(l) { return `Q${l.quadra}-L${l.numero}`; }

/* ---- Empreendimentos -------------------------------------------------------------------
   Um empreendimento é ou um LOTEAMENTO, com planta e lotes numerados, ou uma CARTEIRA, que
   é só um agrupador de vendas: imóvel avulso, apartamento, sala, o que a empresa vender.
   Tudo que vem depois da venda — recebível, índice, antecipação, cobrança, remessa,
   relatório — funciona igual nos dois, porque nada disso depende de lote. */
function empTipo(lot) { return (lot && lot.tipo) === 'carteira' ? 'carteira' : 'loteamento'; }
function ehCarteira(lot) { return empTipo(lot) === 'carteira'; }
function empLabel(lot) { return ehCarteira(lot) ? 'Carteira' : 'Loteamento'; }

/* O imóvel de uma venda: o lote, quando existe, ou a descrição livre da venda avulsa. */
function imovelDaVenda(v) {
  if (!v) return { label: '', curto: '', endereco: '', matricula: '', lote: null };
  const l = v.loteId ? getLote(v.loteId) : null;
  if (l) return { label: loteLabel(l), curto: loteShort(l), endereco: '', matricula: l.matricula || '', lote: l };
  const im = v.imovel || {};
  const d = (im.descricao || '').trim();
  return { label: d || 'Imóvel sem descrição', curto: d ? d.slice(0, 22) : 'Imóvel', endereco: im.endereco || '', matricula: im.matricula || '', lote: null };
}
function imovelLabel(v) { return imovelDaVenda(v).label; }
function imovelShort(v) { return imovelDaVenda(v).curto; }
function statusLabel(s) {
  return { disponivel: 'Disponível', reservado: 'Reservado', vendido: 'Vendido', bloqueado: 'Indisponível',
    pendente: 'Pendente', aprovada: 'Aprovada', recusada: 'Recusada', cancelada: 'Cancelada', expirada: 'Expirada', convertida: 'Virou venda',
    pago: 'Pago', parcial: 'Parcial', atrasado: 'Atrasado', ativa: 'Ativa', quitada: 'Quitada', distrato: 'Distrato', paga: 'Paga',
    dono: 'Dono', admin: 'Administrador', financeiro: 'Financeiro', corretor: 'Corretor' }[s] || s;
}
function quadrasDo(lotId) { return [...new Set(lotesDo(lotId).map(l => l.quadra))].sort(naturalCmp); }

// reservas
function reservaAtiva(loteId) { return db.reservas.find(r => r.loteId === loteId && (r.status === 'pendente' || r.status === 'aprovada')); }
function reservaStatus(r) {
  if ((r.status === 'pendente' || r.status === 'aprovada') && r.validade && r.validade < todayStr()) return 'expirada';
  return r.status;
}
// venda / recebíveis
function vendaAtiva(loteId) { return db.vendas.find(v => v.loteId === loteId && (v.status === 'ativa' || v.status === 'quitada')); }
function recStatus(r) {
  const restante = recValor(r) - (Number(r.valorPago) || 0);
  if (restante <= 0.005) return 'pago';
  if ((Number(r.valorPago) || 0) > 0) return r.vencimento < todayStr() ? 'atrasado' : 'parcial';
  if (r.vencimento < todayStr()) return 'atrasado';
  return 'pendente';
}
function recRestante(r) { return Math.max(0, recValor(r) - (Number(r.valorPago) || 0)); }
function recAtualizado(r) { // valor com multa e juros de mora
  const rest = recRestante(r);
  if (rest <= 0 || r.vencimento >= todayStr()) return rest;
  const dias = daysBetween(r.vencimento, todayStr());
  const multa = rest * (num(db.config.multaPct) / 100);
  const juros = rest * (num(db.config.jurosMesPct) / 100) * (dias / 30);
  return rest + multa + juros;
}
function recebiveisDe(vendaId) { return db.recebiveis.filter(r => r.vendaId === vendaId).sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.numero - b.numero); }
/* ---- Escopo -----------------------------------------------------------------------------
   As telas de dinheiro — vendas, recebíveis, cobrança, relatórios — trabalham na empresa
   inteira. Passar um id de empreendimento restringe; passar vazio traz tudo. O espaço de
   trabalho do empreendimento (planta, lotes, reservas, obra) é que é sempre de um só. */
function noEscopo(rec, escopo) { return !escopo || rec.loteamentoId === escopo; }
function vendasDo(escopo) { return db.vendas.filter(v => noEscopo(v, escopo)); }
function recebiveisDo(escopo) {
  const vendasOk = new Set(db.vendas.filter(v => noEscopo(v, escopo) && v.status !== 'distrato').map(v => v.id));
  return db.recebiveis.filter(r => vendasOk.has(r.vendaId));
}
function custoStatus(c) { if (c.status === 'pago') return 'pago'; if (c.vencimento && c.vencimento < todayStr()) return 'atrasado'; return 'pendente'; }
function custosDo(escopo) { return db.custos.filter(c => noEscopo(c, escopo)); }

function gerarRecebiveis(venda) {
  const list = [];
  const n = Number(venda.nParcelas) || 0;
  if (num(venda.entrada) > 0) list.push({ id: genId(), vendaId: venda.id, loteamentoId: venda.loteamentoId, tipo: 'entrada', numero: 0, descricao: 'Entrada', vencimento: venda.dataEntrada || venda.dataVenda, valor: num(venda.entrada), valorPago: 0, dataPagamento: null, forma: null });
  for (let i = 1; i <= n; i++) list.push({ id: genId(), vendaId: venda.id, loteamentoId: venda.loteamentoId, tipo: 'parcela', numero: i, descricao: `Parcela ${i}/${n}`, vencimento: addMonths(venda.primeiroVencimento, i - 1), valor: num(venda.valorParcela), valorPago: 0, dataPagamento: null, forma: null });
  (venda.baloes || []).forEach((b, i) => { if (b.data && num(b.valor) > 0) list.push({ id: genId(), vendaId: venda.id, loteamentoId: venda.loteamentoId, tipo: 'balao', numero: 1000 + i, descricao: `Reforço ${i + 1}`, vencimento: b.data, valor: num(b.valor), valorPago: 0, dataPagamento: null, forma: null }); });
  return list;
}
function vendaResumo(v) {
  const recs = recebiveisDe(v.id);
  const total = recs.reduce((s, r) => s + recValor(r), 0);
  const pago = recs.reduce((s, r) => s + num(r.valorPago), 0);
  const atrasado = recs.filter(r => recStatus(r) === 'atrasado').reduce((s, r) => s + recRestante(r), 0);
  const nPagas = recs.filter(r => recStatus(r) === 'pago').length;
  return { total, pago, restante: total - pago, atrasado, n: recs.length, nPagas };
}
function atualizarStatusVenda(vendaId) {
  const v = getVenda(vendaId); if (!v || v.status === 'distrato') return;
  const r = vendaResumo(v);
  const novo = (r.n > 0 && r.restante <= 0.005) ? 'quitada' : 'ativa';
  if (novo !== v.status) { v.status = novo; upsert('vendas', v); }
}

// corretor identificado neste dispositivo (modo local) ou pelo login (nuvem)
function corretorPerfil() {
  if (Cloud.active && Cloud.membro) { const m = Cloud.membro; return { nome: m.nome || '', creci: m.creci || '', telefone: m.telefone || '', email: m.email || '', imobiliaria: m.imobiliaria || '', userId: m.userId }; }
  return prefs.corretor || { nome: '', creci: '', telefone: '', email: '', imobiliaria: '' };
}
function corretorMatch(c) {
  if (!c) return false;
  if (Cloud.active) return !!Cloud.user && c.userId === Cloud.user.id;
  const p = corretorPerfil();
  const tel = onlyDigits(p.telefone), creci = (p.creci || '').trim().toLowerCase();
  return (tel && onlyDigits(c.telefone) === tel) || (creci && (c.creci || '').trim().toLowerCase() === creci);
}
function registrarCorretor(c) { // modo local: mantém cadastro de corretores a partir das reservas
  if (Cloud.active) return null;
  const existente = db.corretores.find(x => (onlyDigits(x.telefone) && onlyDigits(x.telefone) === onlyDigits(c.telefone)) || (x.creci && c.creci && x.creci.trim().toLowerCase() === c.creci.trim().toLowerCase()));
  if (existente) {
    const upd = Object.assign({}, existente, { nome: c.nome || existente.nome, email: c.email || existente.email, imobiliaria: c.imobiliaria || existente.imobiliaria, creci: c.creci || existente.creci, telefone: c.telefone || existente.telefone });
    upsert('corretores', upd); return upd;
  }
  const novo = { id: genId(), nome: c.nome, creci: c.creci || '', telefone: c.telefone || '', email: c.email || '', imobiliaria: c.imobiliaria || '', ativo: true, criadoEm: new Date().toISOString() };
  upsert('corretores', novo); return novo;
}

// ---------------------------------------------------------------- telas
function showScreen(name) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  $('#screen-' + name).classList.add('active');
  window.scrollTo(0, 0);
}
function switchTab(tab) {
  state.tab = tab;
  const prefix = state.role === 'admin' ? 'a' : 'c';
  $$(`#screen-${state.role} .tab`).forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  $$(`#screen-${state.role} .view`).forEach(v => v.classList.toggle('active', v.id === `${prefix}v-${tab}`));
  renderCurrent();
}
function renderCurrent() {
  if (state.role === 'landing' || !state.role) { renderLanding(); return; }
  if (state.role === 'corretor') renderCorretorTab();
  else if (state.role === 'admin') renderAdminTab();
  updateTopbars();
}
function updateTopbars() {
  const lot = curLot();
  /* O corretor trabalha em cima da planta: carteiras de imóveis avulsos não aparecem para ele. */
  const empsVisiveis = state.role === 'corretor' ? db.loteamentos.filter(l => !ehCarteira(l)) : db.loteamentos;
  $$('.lot-select').forEach(sel => {
    sel.innerHTML = empsVisiveis.length ? optionsHtml(empsVisiveis, lot ? lot.id : '') : '<option value="">Nenhum empreendimento</option>';
    sel.style.display = empsVisiveis.length > 1 ? '' : 'none';
  });
  $$('.lot-name').forEach(el => { el.textContent = lot ? lot.nome : (Cloud.org ? Cloud.org.nome : 'Gestão de Loteamento'); });
  $$('.user-name').forEach(el => { el.textContent = Cloud.active ? (Cloud.membro.nome || Cloud.user.email || '') : ''; el.style.display = Cloud.active ? '' : 'none'; });
  $$('.btn-ver-corretor').forEach(el => { el.style.display = (state.role === 'admin') ? '' : 'none'; });
  $$('.btn-voltar-admin').forEach(el => { el.style.display = (state.role === 'corretor' && (Cloud.active ? Cloud.admin : sessionStorage.getItem('gl_admin') === '1')) ? '' : 'none'; });
}

// ---------------------------------------------------------------- acesso (modo local: PIN e código)
function enterAdmin() {
  const body = `<p class="small muted mb">Digite o PIN do administrador.</p>
    <div class="fg"><input type="password" inputmode="numeric" id="pinInput" class="pin-input" maxlength="8" autocomplete="off" placeholder="••••"></div>
    ${db.config.pinPadrao ? '<div class="alert warn" style="cursor:default"><span>PIN padrão <b>1234</b>. Troque em Cadastros › Configurações.</span></div>' : ''}`;
  openModal({ title: '🔐 Acesso do administrador', body, footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="checkPin()">Entrar</button>` });
  setTimeout(() => { const i = $('#pinInput'); i.focus(); i.onkeydown = e => { if (e.key === 'Enter') checkPin(); }; }, 50);
}
function checkPin() {
  if (hashStr(val('pinInput')) !== db.config.adminPin) { toast('⛔', 'PIN incorreto', '', true); $('#pinInput').value = ''; return; }
  closeModal();
  sessionStorage.setItem('gl_admin', '1');
  startRole('admin');
}
function enterCorretor() {
  if (db.config.codigoCorretor && prefs.codigoOk !== hashStr(db.config.codigoCorretor)) {
    const body = `<p class="small muted mb">Este loteamento exige um código de acesso para corretores. Peça ao administrador.</p>
      <div class="fg"><input type="text" id="codInput" placeholder="Código de acesso" autocomplete="off"></div>`;
    openModal({ title: '🔑 Acesso do corretor', body, footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="checkCodigo()">Entrar</button>` });
    setTimeout(() => { const i = $('#codInput'); i.focus(); i.onkeydown = e => { if (e.key === 'Enter') checkCodigo(); }; }, 50);
    return;
  }
  startRole('corretor');
}
function checkCodigo() {
  if (val('codInput').trim().toLowerCase() !== db.config.codigoCorretor.trim().toLowerCase()) { toast('⛔', 'Código inválido', '', true); return; }
  prefs.codigoOk = hashStr(db.config.codigoCorretor); savePrefs();
  closeModal(); startRole('corretor');
}
function startRole(role) {
  if (role === 'admin' && Cloud.active && !Cloud.admin) role = 'corretor';
  state.role = role;
  prefs.lastRole = role; savePrefs();
  showScreen(role);
  updateTopbars();
  switchTab(role === 'admin' ? (db.loteamentos.length ? 'painel' : 'cadastros') : 'planta');
}
function voltarAdmin() { if (Cloud.active ? Cloud.admin : sessionStorage.getItem('gl_admin') === '1') startRole('admin'); }
async function sair() {
  sessionStorage.removeItem('gl_admin');
  prefs.lastRole = null; savePrefs();
  if (Cloud.enabled) { state.role = 'landing'; showScreen('landing'); renderAuth('carregando'); await Cloud.signOut(); renderAuth('login'); return; }
  state.role = 'landing';
  showScreen('landing'); renderLanding();
}

// ---------------------------------------------------------------- tela inicial (modo local)
function renderLanding() {
  if (Cloud.enabled) { renderAuth(); return; }
  $('#authBox').style.display = 'none'; $('#localBox').style.display = '';
  const lot = curLot();
  const box = $('#landingEmpreend');
  if (!lot) {
    box.innerHTML = `<div class="nome">Nenhum loteamento cadastrado</div><div class="info">Entre como administrador para cadastrar o primeiro loteamento, ou carregue os dados de exemplo.</div>
      <div class="mt"><button class="btn btn-sm btn-accent" onclick="carregarDemo()">✨ Carregar dados de exemplo</button></div>`;
  } else {
    const ls = lotesDo(lot.id);
    const cnt = s => ls.filter(l => l.status === s).length;
    box.innerHTML = `<div class="nome">🏘️ ${esc(lot.nome)}</div><div class="info">${esc([lot.cidade, lot.endereco].filter(Boolean).join(' · '))}</div>
      <div class="stats"><span><b>${ls.length}</b>lotes</span><span><b style="color:#86efac">${cnt('disponivel')}</b>disponíveis</span><span><b style="color:#fcd34d">${cnt('reservado')}</b>reservados</span><span><b style="color:#fca5a5">${cnt('vendido')}</b>vendidos</span></div>
      ${db.loteamentos.length > 1 ? `<div class="mt"><select class="lot-select" onchange="setCurLot(this.value)" style="max-width:260px;margin:0 auto"></select></div>` : ''}`;
  }
  updateTopbars();
  $('#landingWarn').style.display = db.config.pinPadrao ? '' : 'none';
  renderSyncStatus();
}

// ---------------------------------------------------------------- backup
function exportarBackup() {
  download(`backup-loteamento-${todayStr()}.json`, JSON.stringify(db, null, 1));
  toast('💾', 'Backup exportado', '');
}
async function importarBackup(input) {
  const f = input.files[0]; if (!f) return;
  try {
    const data = JSON.parse(await readFileAsText(f));
    if (!data || !data.config) throw new Error('Arquivo inválido');
    if (!confirm('Importar este backup vai SUBSTITUIR todos os dados atuais. Continuar?')) { input.value = ''; return; }
    if (Cloud.active) { delete data.config.adminPin; data.config = Object.assign({}, db.config, data.config); }
    await replaceDB(data);
    toast('✅', 'Backup importado', '');
    renderCurrent();
  } catch (e) { toast('⚠️', 'Falha ao importar', e.message, true); }
  input.value = '';
}
async function apagarTudo() {
  if (!confirm('Apagar TODOS os dados deste loteamento (lotes, reservas, vendas, custos)? Esta ação não pode ser desfeita.')) return;
  if (!confirm('Tem certeza? Recomendamos exportar um backup antes.')) return;
  const cfg = db.config;
  await replaceDB(Object.assign(defaultDB(), { config: cfg }));
  state.lotId = null;
  toast('🗑️', 'Dados apagados', '');
  renderCurrent();
}

// ---------------------------------------------------------------- dados de exemplo
async function carregarDemo() {
  if (db.lotes.length && !confirm('Já existem dados cadastrados. Carregar os dados de exemplo vai substituí-los. Continuar?')) return;
  const d = defaultDB();
  d.config = Cloud.active ? Object.assign({}, db.config, { comissaoPct: 5 }) : Object.assign(d.config, { empresa: 'Sua Incorporadora', comissaoPct: 5 });
  const lot = { id: 'demo-lot', nome: 'Residencial Vista Verde', cidade: 'Rio do Sul / SC', endereco: 'Rod. BR-470, km 140', descricao: 'Loteamento residencial com 32 lotes, infraestrutura completa: asfalto, água, energia, iluminação em LED e área de lazer.',
    cond: { entradaMinPct: 10, maxParcelas: 120, jurosMes: 0.8, descontoVistaPct: 6 }, orcamento: { terraplanagem: 380000, pavimentacao: 480000, drenagem: 140000, 'rede-eletrica': 210000, agua: 150000, esgoto: 110000, documentacao: 40000, cartorio: 20000, projetos: 60000, licencas: 30000, marketing: 80000, terreno: 1500000 }, criadoEm: new Date().toISOString() };
  d.loteamentos.push(lot);
  const t = todayStr();
  const quadras = { A: 10, B: 12, C: 10 };
  let idx = 0;
  Object.entries(quadras).forEach(([q, n]) => {
    for (let i = 1; i <= n; i++) {
      idx++;
      const area = 300 + ((idx * 37) % 160);
      const preco = Math.round(area * (410 + ((idx * 13) % 60)) / 100) * 100;
      d.lotes.push({ id: 'lote-' + q + i, loteamentoId: lot.id, quadra: q, numero: String(i), area, frente: 12, fundos: Math.round(area / 12 * 10) / 10, preco, tipo: (q === 'C' && i <= 2) ? 'comercial' : 'residencial', status: 'disponivel', obs: '', matricula: '' });
    }
  });
  const byId = id => d.lotes.find(l => l.id === id);
  const corr1 = { nome: 'Carlos Mendes', creci: 'SC-12345', telefone: '(47) 99911-2233', email: 'carlos@imob.com', imobiliaria: 'Mendes Imóveis' };
  const corr2 = { nome: 'Ana Paula Souza', creci: 'SC-54321', telefone: '(47) 98877-6655', email: 'ana@souzaimoveis.com', imobiliaria: 'Souza Imóveis' };
  d.corretores.push(Object.assign({ id: 'c1', ativo: true }, corr1), Object.assign({ id: 'c2', ativo: true }, corr2));
  const clientes = [
    { nome: 'João da Silva', cpf: '123.456.789-00', telefone: '(47) 99123-4567', email: 'joao@email.com', endereco: 'Rua das Flores, 120', cidade: 'Rio do Sul' },
    { nome: 'Maria Oliveira', cpf: '987.654.321-00', telefone: '(47) 99765-4321', email: 'maria@email.com', endereco: 'Av. Central, 500', cidade: 'Ituporanga' },
    { nome: 'Pedro Santos', cpf: '111.222.333-44', telefone: '(49) 98811-2233', email: '', endereco: '', cidade: 'Lontras' },
    { nome: 'Fernanda Lima', cpf: '555.666.777-88', telefone: '(47) 99222-1100', email: 'fer@email.com', endereco: 'Rua 7 de Setembro, 45', cidade: 'Rio do Sul' },
    { nome: 'Roberto Costa', cpf: '999.888.777-66', telefone: '(47) 99333-2211', email: '', endereco: '', cidade: 'Blumenau' }
  ];
  function venda(loteId, cliente, corr, mesesAtras, n, entradaPct, pagas) {
    const l = byId(loteId);
    const dataVenda = addMonths(t, -mesesAtras);
    const total = l.preco;
    const entrada = Math.round(total * entradaPct / 100);
    const parcela = Math.round((total - entrada) / n * 100) / 100;
    const v = { id: 'v-' + loteId, loteId, loteamentoId: lot.id, cliente, corretor: corr, dataVenda, valorTotal: total, entrada, dataEntrada: dataVenda, nParcelas: n, valorParcela: parcela, primeiroVencimento: addMonths(dataVenda, 1), baloes: [], comissaoPct: 5, comissaoValor: total * 0.05, comissaoPaga: pagas > 2, comissaoData: pagas > 2 ? addMonths(dataVenda, 1) : null, status: 'ativa', obs: '', criadoEm: new Date().toISOString() };
    d.vendas.push(v);
    l.status = 'vendido'; l.vendaId = v.id;
    const recs = gerarRecebiveis(v);
    recs.forEach((r, i) => { if (i <= pagas) { r.valorPago = r.valor; r.dataPagamento = r.vencimento; r.forma = i === 0 ? 'PIX' : 'Boleto'; } });
    d.recebiveis.push(...recs);
  }
  venda('lote-A1', clientes[0], corr1, 8, 60, 20, 8);
  venda('lote-A2', clientes[1], corr1, 6, 48, 15, 6);
  venda('lote-B3', clientes[2], corr2, 5, 36, 10, 2); // atrasado
  venda('lote-B4', clientes[3], corr2, 3, 24, 30, 3);
  venda('lote-C1', clientes[4], corr1, 1, 12, 50, 1);
  // reservas
  function reserva(loteId, cliente, corr, status, diasAtras, obs) {
    const l = byId(loteId);
    const data = addDays(t, -diasAtras);
    const r = { id: 'r-' + loteId, loteId, loteamentoId: lot.id, cliente, corretor: corr, dataReserva: data, validade: addDays(data, 7), status, proposta: { valor: l.preco, entrada: Math.round(l.preco * 0.1), nParcelas: 60 }, obs: obs || '', criadoEm: new Date(parseDate(data)).toISOString() };
    d.reservas.push(r);
    if (status === 'pendente' || status === 'aprovada') { l.status = 'reservado'; l.reservaId = r.id; }
  }
  reserva('lote-A5', { nome: 'Lucas Pereira', cpf: '222.333.444-55', telefone: '(47) 99444-5566', email: '', endereco: '', cidade: 'Rio do Sul' }, corr2, 'pendente', 1, 'Cliente quer visitar no sábado.');
  reserva('lote-B7', { nome: 'Juliana Rocha', cpf: '333.444.555-66', telefone: '(47) 99555-6677', email: 'ju@email.com', endereco: '', cidade: 'Rio do Sul' }, corr1, 'aprovada', 3, '');
  reserva('lote-C5', { nome: 'Marcos Antunes', cpf: '444.555.666-77', telefone: '(47) 99666-7788', email: '', endereco: '', cidade: 'Lontras' }, corr2, 'aprovada', 12, 'Aguardando aprovação de crédito.');
  reserva('lote-A9', { nome: 'Beatriz Nunes', cpf: '', telefone: '(47) 99777-8899', email: '', endereco: '', cidade: '' }, corr1, 'recusada', 20, '');
  byId('lote-C10').status = 'bloqueado'; byId('lote-C10').obs = 'Área institucional / reservada';
  // custos
  const custos = [
    ['Aquisição da gleba (parcela 3/10)', 'terreno', 'Espólio Família Souza', 150000, -2, 'pago'],
    ['Aquisição da gleba (parcela 4/10)', 'terreno', 'Espólio Família Souza', 150000, 1, 'pendente'],
    ['Terraplanagem quadras A e B', 'terraplanagem', 'Terraplanagem Silva Ltda', 210000, -5, 'pago'],
    ['Terraplanagem quadra C', 'terraplanagem', 'Terraplanagem Silva Ltda', 95000, -1, 'pago'],
    ['Pavimentação asfáltica — 1ª medição', 'pavimentacao', 'Pavisul Engenharia', 280000, -2, 'pago'],
    ['Pavimentação asfáltica — 2ª medição', 'pavimentacao', 'Pavisul Engenharia', 190000, 0, 'pendente'],
    ['Rede de água tratada', 'agua', 'Hidro Obras', 98000, -3, 'pago'],
    ['Rede coletora de esgoto', 'esgoto', 'Hidro Obras', 77000, -3, 'pago'],
    ['Rede elétrica e postes', 'rede-eletrica', 'Celesc / Eletro Vale', 120000, -1, 'pago'],
    ['Iluminação LED', 'rede-eletrica', 'Eletro Vale', 48000, 2, 'pendente'],
    ['Projeto urbanístico', 'projetos', 'Arq. Helena Prado', 45000, -7, 'pago'],
    ['Licença ambiental prévia', 'licencas', 'Consultoria Ambiental Verde', 16000, -7, 'pago'],
    ['Registro do loteamento', 'cartorio', 'Cartório RI', 22000, -6, 'pago'],
    ['Placas, site e anúncios', 'marketing', 'Agência Vale Digital', 18500, -1, 'pago'],
    ['Impulsionamento mídias (mês)', 'marketing', 'Agência Vale Digital', 3500, 0, 'pendente'],
    ['ITBI', 'impostos', 'Prefeitura', 9800, -4, 'pago'],
    ['Taxas municipais de aprovação', 'taxas', 'Prefeitura', 3000, -4, 'pago'],
    ['Contabilidade (trimestre)', 'administrativo', 'Contábil Rio', 4200, -1, 'atrasado']
  ];
  custos.forEach(([desc, cat, forn, valor, meses, st], i) => {
    const comp = addMonths(t, meses);
    const venc = st === 'atrasado' ? addDays(t, -9) : addDays(comp, 15);
    d.custos.push({ id: 'cu-' + i, loteamentoId: lot.id, descricao: desc, categoriaId: cat, fornecedor: forn, valor, dataCompetencia: comp, vencimento: venc, status: st === 'pago' ? 'pago' : 'pendente', dataPagamento: st === 'pago' ? venc : null, formaPagamento: 'Transferência', obs: '' });
  });
  d.log.push({ id: genId(), ts: new Date().toISOString(), who: 'Sistema', msg: 'Dados de exemplo carregados.' });
  await replaceDB(d);
  if (Cloud.active) db.corretores = Cloud.membros.filter(m => m.papel === 'corretor').map(membroToCorretor);
  state.lotId = lot.id; prefs.lotId = lot.id; savePrefs();
  toast('✨', 'Dados de exemplo carregados', Cloud.active ? 'Explore o painel, a planta e as reservas.' : 'Explore como corretor e como administrador (PIN 1234).');
  renderCurrent();
}


// ---------------------------------------------------------------- boot
document.addEventListener('DOMContentLoaded', async () => {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(() => {});
  $('#modalOverlay').addEventListener('click', e => { if (e.target.id === 'modalOverlay') closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#modalOverlay').classList.contains('open')) closeModal(); });
  state.role = 'landing';
  showScreen('landing');
  if (Cloud.enabled) { Cloud.init(); await Cloud.boot(); return; }
  migrarCategorias();
  renderLanding();
  const modo = new URLSearchParams(location.search).get('modo');
  if (modo === 'corretor') enterCorretor();
  else if (sessionStorage.getItem('gl_admin') === '1') startRole('admin');
  else if (prefs.lastRole === 'corretor') startRole('corretor');
});
