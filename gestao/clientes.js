/* ===== Gestão de Loteamento — cadastro de clientes =====
   A ficha viva de quem compra. O contrato guarda uma cópia do comprador como ele estava no
   dia da assinatura; o cadastro é de onde o próximo contrato puxa os dados, sem digitar de
   novo. Um cliente é o mesmo quando tem o mesmo CPF/CNPJ; sem documento, vale o nome. */
'use strict';

function chaveCliente(p) {
  const d = onlyDigits((p || {}).cpf);
  return d ? 'doc:' + d : 'nome:' + String((p || {}).nome || '').trim().toLowerCase().replace(/\s+/g, ' ');
}
function clientePorChave(k, excetoId) { return db.clientes.find(c => c.id !== excetoId && chaveCliente(c) === k); }
function contratosDoCliente(c) {
  const k = chaveCliente(c);
  return db.vendas.filter(v => todosCompradores(v).some(p => chaveCliente(p) === k))
    .sort((a, b) => String(b.dataVenda || '').localeCompare(String(a.dataVenda || '')));
}
function podeEditarClientes() { return pode('vendas.criar') || pode('vendas.editar'); }

/* Dígitos verificadores. A declaração fiscal recusa documento inválido, então é melhor
   pegar o erro de digitação aqui do que no fim do ano. */
function cpfValido(d) {
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === +d[9] && dv(10) === +d[10];
}
function cnpjValido(d) {
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const dv = n => { const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; let s = 0; for (let i = 0; i < n; i++) s += +d[i] * pesos[i]; const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return dv(12) === +d[12] && dv(13) === +d[13];
}
function documentoInvalido(p) {
  const d = onlyDigits((p || {}).cpf); if (!d) return '';
  if (ehPJ(p)) return cnpjValido(d) ? '' : 'CNPJ inválido';
  return cpfValido(d) ? '' : 'CPF inválido';
}

/* Só os campos da pessoa; o que é do contrato (cargo de quem assina, por exemplo) não vem. */
const CAMPOS_CLIENTE = () => TABLE_COLS.clientes.filter(k => !['id', 'obs', 'criadoEm'].includes(k));
function clienteDePessoa(p, base) {
  const out = Object.assign({}, base || { id: genId(), criadoEm: new Date().toISOString() });
  /* Nulo só onde o banco aceita (cônjuge e representante); nos outros campos o cadastro
     antigo sem aquele dado fica com o padrão do banco, em vez de recusar a linha. */
  CAMPOS_CLIENTE().forEach(k => {
    const v = (p || {})[k];
    if (v === undefined || (v === null && k !== 'conjuge' && k !== 'representante')) return;
    out[k] = v;
  });
  return out;
}
/* Compradores dos contratos que ainda não têm ficha. Quando o mesmo cliente comprou mais de
   uma vez, vale o contrato mais recente, que tem o endereço e o estado civil de agora. */
function compradoresForaDoCadastro() {
  const tem = new Set(db.clientes.map(chaveCliente));
  const novos = new Map();
  db.vendas.slice().sort((a, b) => String(a.dataVenda || '').localeCompare(String(b.dataVenda || '')))
    .forEach(v => todosCompradores(v).forEach(p => { const k = chaveCliente(p); if (!tem.has(k)) novos.set(k, p); }));
  return [...novos.values()];
}
function importarCompradores() {
  if (!podeEditarClientes()) { toast('🔒', 'Sem permissão', '', true); return; }
  const fora = compradoresForaDoCadastro(); if (!fora.length) return;
  fora.forEach(p => upsert('clientes', clienteDePessoa(p)));
  logAct(`Cadastro de clientes: ${fora.length} comprador(es) trazido(s) dos contratos`);
  renderCurrent(); toast('✅', 'Clientes cadastrados', `${fora.length} comprador(es) dos contratos.`);
}
/* Ao salvar um contrato, os compradores entram no cadastro ou atualizam a ficha que já
   existe. Campo em branco no contrato não apaga o que a ficha já sabia. */
function registrarClientesDaVenda(compradores) {
  (compradores || []).forEach(p => {
    if (!p || !p.nome) return;
    const ja = clientePorChave(chaveCliente(p));
    if (!ja) { upsert('clientes', clienteDePessoa(p)); return; }
    const novo = Object.assign({}, ja); let mudou = false;
    CAMPOS_CLIENTE().forEach(k => {
      const v = p[k];
      if (v === undefined || v === null || v === '') return;
      if (JSON.stringify(v) !== JSON.stringify(ja[k])) { novo[k] = v; mudou = true; }
    });
    if (mudou) upsert('clientes', novo);
  });
}

// ================================================================ TELA: CONTRATOS › CLIENTES
function renderClientes() {
  const v = $('#av-clientes'); if (!v) return;
  const f = state.filters.clientes = state.filters.clientes || { busca: '' };
  const edita = podeEditarClientes();
  const b = f.busca.trim().toLowerCase(), bd = onlyDigits(f.busca);
  const lista = db.clientes.filter(c => !b
      || String(c.nome || '').toLowerCase().includes(b)
      || String(c.cidade || '').toLowerCase().includes(b)
      || String(c.email || '').toLowerCase().includes(b)
      || (bd.length >= 3 && (onlyDigits(c.cpf).includes(bd) || onlyDigits(c.telefone).includes(bd))))
    .sort((a, c2) => naturalCmp(a.nome || '', c2.nome || ''));
  const fora = edita ? compradoresForaDoCadastro() : [];
  const incompletos = db.clientes.filter(c => faltaQualificacao(c).length).length;
  v.innerHTML = `
    ${fora.length ? `<div class="alert info" onclick="importarCompradores()"><span><b>${fora.length} comprador(es) dos contratos ainda sem ficha.</b> Trazer para o cadastro? Quem já tem ficha, pelo CPF, não é duplicado. <u>Trazer agora</u></span><span>›</span></div>` : ''}
    <div class="kpi-grid cols3">
      <div class="kpi c-blue"><div class="lbl">Clientes</div><div class="val">${db.clientes.length}</div><div class="sub">no cadastro</div></div>
      <div class="kpi c-green"><div class="lbl">Com contrato</div><div class="val">${db.clientes.filter(c => contratosDoCliente(c).length).length}</div><div class="sub">comprador em ao menos um</div></div>
      <div class="kpi ${incompletos ? 'c-amber' : 'c-green'}"><div class="lbl">Qualificação incompleta</div><div class="val">${incompletos}</div><div class="sub">${incompletos ? 'falta dado para o contrato' : 'todos prontos para contrato'}</div></div>
    </div>
    <div class="filters"><input type="text" placeholder="🔎 Nome, CPF, telefone, e-mail ou cidade" value="${esc(f.busca)}" oninput="aSetFiltro('clientes','busca',this.value,renderClientes,this)">
      ${edita ? '<button class="btn btn-primary btn-sm" onclick="abrirClienteForm()">＋ Novo cliente</button>' : ''}</div>
    ${lista.length ? lista.map(clienteItemHtml).join('')
      : `<div class="empty"><div class="ic">👥</div><p><b>${db.clientes.length ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}</b></p><p class="small">${db.clientes.length ? 'Tente outro nome ou parte do CPF.' : 'Cadastre aqui ou registre um contrato: o comprador entra no cadastro sozinho.'}</p></div>`}`;
}
function clienteItemHtml(c) {
  const n = contratosDoCliente(c).length; const falta = faltaQualificacao(c);
  return `<div class="item" onclick="abrirClienteForm('${esc(c.id)}')"><div class="info">
      <div class="title">${esc(c.nome)}${ehPJ(c) ? ' <span class="badge neutral">PJ</span>' : ''}${temConjuge(c) && (c.conjuge || {}).nome ? ` <span class="tiny muted">e ${esc(c.conjuge.nome)}</span>` : ''}</div>
      <div class="meta"><span>${esc(fmtCPF(c.cpf)) || 'sem CPF'}</span>${c.telefone ? `<span>· ${esc(fmtPhone(c.telefone))}</span>` : ''}${c.cidade ? `<span>· ${esc(c.cidade)}${c.uf ? '/' + esc(c.uf) : ''}</span>` : ''}<span>· ${n ? n + ' contrato(s)' : 'sem contrato'}</span></div>
      ${falta.length ? `<div class="tiny muted">Falta para o contrato: ${esc(falta.join(', '))}</div>` : '<div class="tiny ok">Qualificação completa</div>'}</div>
    <div class="side">${c.telefone ? `<a class="btn-icon" style="background:#dcfce7;color:#166534;text-decoration:none" target="_blank" href="${waLink(c.telefone, '')}" onclick="event.stopPropagation()">💬</a>` : ''}</div></div>`;
}
function abrirClienteForm(id) {
  const c = id ? db.clientes.find(x => x.id === id) : null;
  if (id && !c) return;
  const edita = podeEditarClientes();
  const contratos = c ? contratosDoCliente(c) : [];
  const body = `<p class="help mb">Estes dados entram na qualificação do comprador no contrato. Um contrato já emitido guarda os dados como estavam no dia da assinatura; o que você mudar aqui vale para os próximos.</p>
    ${pessoaFormHtml('cl', c || {}, { conjuge: true })}
    ${conjugeFormHtml('cl', c || {})}
    <div class="fg"><label>Observações</label><textarea id="clObs" rows="2">${esc(c ? c.obs || '' : '')}</textarea></div>
    ${contratos.length ? `<div class="fieldset"><span class="lg">📄 Contratos deste cliente</span>
      ${contratos.map(v => `<div class="item" onclick="setCurLotSilencioso('${esc(v.loteamentoId)}');abrirVendaAdmin('${esc(v.id)}')"><div class="info"><div class="title">${esc(imovelLabel(v))} <span class="tiny muted">· ${esc((getLoteamento(v.loteamentoId) || {}).nome || '')}</span></div>
        <div class="meta"><span>📅 ${fmtDate(v.dataVenda)}</span><span>· ${esc(fmtMoney(v.valorTotal))}</span></div></div><div class="side"><span class="badge ${v.status === 'distrato' ? 'distrato' : v.status}">${statusLabel(v.status)}</span></div></div>`).join('')}</div>` : ''}`;
  openModal({ title: c ? '👤 ' + esc(c.nome) : '＋ Novo cliente', body, wide: true,
    footer: `${c && edita ? `<button class="btn btn-outline-danger" onclick="excluirCliente('${esc(c.id)}')">Excluir</button>` : ''}<button class="btn btn-secondary" onclick="closeModal()">${edita ? 'Cancelar' : 'Fechar'}</button>${edita ? `<button class="btn btn-primary" onclick="salvarCliente('${c ? esc(c.id) : ''}')">Salvar</button>` : ''}` });
}
function salvarCliente(id) {
  if (!podeEditarClientes()) { toast('🔒', 'Sem permissão', 'Seu perfil não altera o cadastro de clientes.', true); return; }
  if (!val('clNome')) { toast('⚠️', 'Informe o nome', '', true); return; }
  const prev = id ? db.clientes.find(x => x.id === id) : null;
  const p = pessoaDoForm('cl', prev || {});
  p.conjuge = conjugeDoForm('cl', p, (prev || {}).conjuge);
  const inval = documentoInvalido(p);
  if (inval) { toast('⚠️', inval, 'Confira os números: o dígito verificador não bate.', true); return; }
  const cjInval = p.conjuge && onlyDigits(p.conjuge.cpf) && !cpfValido(onlyDigits(p.conjuge.cpf));
  if (cjInval) { toast('⚠️', 'CPF do cônjuge inválido', 'Confira os números.', true); return; }
  if (onlyDigits(p.cpf)) {
    const dup = clientePorChave(chaveCliente(p), id);
    if (dup) { toast('⚠️', `${ehPJ(p) ? 'CNPJ' : 'CPF'} já cadastrado`, `Pertence a ${dup.nome}. Abra a ficha dele para editar.`, true); return; }
  }
  const rec = Object.assign({}, prev || { id: genId(), criadoEm: new Date().toISOString() }, clienteDePessoa(p, {}), { obs: val('clObs') });
  upsert('clientes', rec);
  logAct(`Cliente ${prev ? 'editado' : 'cadastrado'}: ${rec.nome}`);
  closeModal(); renderCurrent(); toast('✅', prev ? 'Cliente atualizado' : 'Cliente cadastrado', rec.nome);
}
/* Em dois passos, como o contrato: o primeiro mostra o que acontece, o segundo apaga. */
function excluirCliente(id, confirmado) {
  if (!podeEditarClientes()) { toast('🔒', 'Sem permissão', '', true); return; }
  const c = db.clientes.find(x => x.id === id); if (!c) return;
  const n = contratosDoCliente(c).length;
  if (!confirmado) {
    openModal({ title: '🗑️ Excluir cliente',
      body: `<p class="mb">Excluir <b>${esc(c.nome)}</b> do cadastro de clientes?</p>
        ${n ? `<div class="alert warn" style="cursor:default"><span>É comprador em <b>${n} contrato(s)</b>. Os contratos não mudam, porque guardam os dados como estavam no dia. Some só a ficha do cadastro; se ele comprar de novo, os dados terão de ser digitados outra vez.</span></div>` : ''}
        <p class="help">Não dá para desfazer.</p>`,
      footer: `<button class="btn btn-secondary" onclick="abrirClienteForm('${esc(id)}')">Voltar</button><button class="btn btn-danger" onclick="excluirCliente('${esc(id)}', true)">Excluir definitivamente</button>` });
    return;
  }
  removeRec('clientes', id);
  logAct(`Cliente excluído do cadastro: ${c.nome}`);
  closeModal(); renderCurrent(); toast('🗑️', 'Cliente excluído', c.nome);
}

// ================================================================ NO CONTRATO: PUXAR DO CADASTRO
function clienteRotulo(c) { return `${c.nome}${c.cpf ? ' — ' + fmtCPF(c.cpf) : ''}`; }
function clientesDatalistHtml() {
  return `<datalist id="clientesDL">${db.clientes.slice().sort((a, b) => naturalCmp(a.nome || '', b.nome || '')).map(c => `<option value="${esc(clienteRotulo(c))}">`).join('')}</datalist>`;
}
function buscaClienteHtml(base, i) {
  if (!db.clientes.length) return '';
  return `<div class="fg cliente-busca"><label>📇 Puxar do cadastro de clientes</label>
    <input type="text" list="clientesDL" id="${pfxPessoa(base, i)}Busca" placeholder="Digite o nome ou o CPF e escolha na lista" oninput="if (clientePorRotulo(this.value)) puxarCliente('${base}', ${i}, this.value)" onchange="puxarCliente('${base}', ${i}, this.value)"></div>`;
}
/* Troca o bloco inteiro pelo formulário já preenchido: cônjuge, endereço e estado civil
   vêm juntos, e o que for digitado depois continua valendo só para este contrato. */
function clientePorRotulo(t) { return db.clientes.find(x => clienteRotulo(x) === t); }
function puxarCliente(base, i, texto) {
  const t = String(texto || '').trim(); if (!t) return;
  const campo = document.getElementById(pfxPessoa(base, i) + 'Busca');
  /* Escolher na lista dispara input e depois change, e trocar o bloco tira o foco do campo,
     o que dispara change de novo. A trava fica no campo velho, que vai embora com o bloco. */
  if (campo && campo.dataset.puxando) return;
  const d = onlyDigits(t);
  const c = clientePorRotulo(t)
    || (d.length >= 11 ? db.clientes.find(x => onlyDigits(x.cpf) === d) : null)
    || db.clientes.find(x => String(x.nome || '').toLowerCase() === t.toLowerCase());
  if (!c) { toast('⚠️', 'Cliente não encontrado', 'Escolha um nome da lista.', true); return; }
  if (campo) campo.dataset.puxando = '1';
  const p = Object.assign({}, c); delete p.id; delete p.obs; delete p.criadoEm;
  setTimeout(() => {
    const bloco = document.getElementById(pfxPessoa(base, i) + 'Bloco'); if (!bloco) return;
    bloco.outerHTML = pessoaBlocoHtml(base, p, i, (window.__pessoasOpc || {})[base] || {});
    toast('📇', 'Dados puxados do cadastro', c.nome);
  }, 0);
}
