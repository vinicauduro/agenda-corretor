/* ===== Gestão de Loteamento — permissões por função =====
   O papel define o que o banco libera (dono, administrador, financeiro, corretor).
   Aqui você afina, dentro do papel, o que cada função vê e pode fazer no aplicativo. */
'use strict';

const PERMISSOES = [
  ['Planta e lotes', [
    ['lotes.editar', 'Cadastrar e editar lotes'],
    ['planta.editar', 'Editar a planta e importar PDF/DXF'],
    ['lotes.preco', 'Alterar preços dos lotes']
  ]],
  ['Reservas e vendas', [
    ['reservas.aprovar', 'Aprovar, recusar e liberar reservas'],
    ['vendas.criar', 'Registrar vendas'],
    ['vendas.editar', 'Editar vendas já registradas'],
    ['vendas.distrato', 'Fazer distrato'],
    ['comissao.gerenciar', 'Marcar comissões como pagas']
  ]],
  ['Financeiro', [
    ['financeiro.ver', 'Ver recebíveis'],
    ['financeiro.baixar', 'Registrar e estornar pagamentos'],
    ['financeiro.antecipar', 'Antecipar e quitar contratos'],
    ['cobranca.ver', 'Ver o painel de inadimplência'],
    ['cobranca.registrar', 'Registrar cobranças'],
    ['custos.ver', 'Ver custos da obra'],
    ['custos.editar', 'Lançar e editar custos']
  ]],
  ['Cadastros e configuração', [
    ['relatorios.ver', 'Ver os relatórios'],
    ['documentos.editar', 'Editar modelos de proposta e contrato'],
    ['indices.editar', 'Cadastrar índices e lançar valores'],
    ['equipe.gerenciar', 'Gerenciar a equipe e os convites'],
    ['config.editar', 'Alterar configurações da empresa'],
    ['backup.usar', 'Fazer backup e restaurar dados']
  ]]
];

/* O que cada papel pode por padrão. O dono sempre pode tudo. */
const PERM_PADRAO = {
  admin: { todas: true },
  financeiro: {
    'lotes.editar': false, 'planta.editar': false, 'lotes.preco': false,
    'reservas.aprovar': false, 'vendas.criar': true, 'vendas.editar': true, 'vendas.distrato': false,
    'comissao.gerenciar': true,
    'financeiro.ver': true, 'financeiro.baixar': true, 'financeiro.antecipar': true,
    'cobranca.ver': true, 'cobranca.registrar': true, 'custos.ver': true, 'custos.editar': true,
    'relatorios.ver': true, 'documentos.editar': false, 'indices.editar': true,
    'equipe.gerenciar': false, 'config.editar': false, 'backup.usar': false
  },
  corretor: { nenhuma: true }   // o corretor usa a área dele, não a administração
};

function permsSalvas() { return (db.config && db.config.permissoes) || {}; }
function todasAsChaves() { const out = []; PERMISSOES.forEach(([, itens]) => itens.forEach(([k]) => out.push(k))); return out; }

/* Mapa completo de permissões de um papel, já com o que estiver salvo. */
function permsDoPapel(papel) {
  const chaves = todasAsChaves();
  const out = {};
  if (papel === 'dono') { chaves.forEach(k => { out[k] = true; }); return out; }
  const padrao = PERM_PADRAO[papel] || { nenhuma: true };
  const salvo = permsSalvas()[papel] || null;
  chaves.forEach(k => {
    if (salvo && k in salvo) out[k] = !!salvo[k];
    else if (padrao.todas) out[k] = true;
    else if (padrao.nenhuma) out[k] = false;
    else out[k] = !!padrao[k];
  });
  return out;
}

/* Pode fazer isso? No modo local (sem login) o administrador pode tudo. */
function pode(chave) {
  if (!Cloud.active) return true;
  if (Cloud.papel === 'dono') return true;
  return !!permsDoPapel(Cloud.papel || 'corretor')[chave];
}
/* Papel atual por extenso, para as telas. */
function meuPapel() { return Cloud.active ? (Cloud.papel || 'corretor') : 'dono'; }

/* Itens do menu lateral e a permissão que cada um pede. */
const TAB_PERM = {
  reservas: 'reservas.aprovar', vendas: 'vendas.criar', recebiveis: 'financeiro.ver',
  cobranca: 'cobranca.ver', boletos: 'financeiro.ver', custos: 'custos.ver',
  indices: 'indices.editar', relatorios: 'relatorios.ver'
};
function abaPermitida(tab) {
  if (!Cloud.active) return true;
  const chave = TAB_PERM[tab];
  return !chave || pode(chave) || (tab === 'vendas' && pode('vendas.editar'));
}
/* Esconde do menu o que a pessoa não pode ver, e o título do grupo que ficou vazio. */
function aplicarPermissoesNasAbas() {
  let precisaTrocar = false;
  $$('#screen-admin .tab').forEach(t => {
    const ok = abaPermitida(t.dataset.tab);
    t.style.display = ok ? '' : 'none';
    if (!ok && state.tab === t.dataset.tab) precisaTrocar = true;
  });
  const novo = $('#aNovoContrato');
  if (novo) novo.style.display = pode('vendas.criar') ? '' : 'none';
  $$('#screen-admin .aside-grupo').forEach(g => {
    const itens = $$(`#screen-admin [data-g="${g.dataset.grupo}"]`);
    g.style.display = itens.some(i => i.style.display !== 'none') ? '' : 'none';
  });
  if (precisaTrocar) {
    const primeira = $$('#screen-admin .tab').find(t => t.style.display !== 'none');
    if (primeira) switchTab(primeira.dataset.tab);
  }
}
/* Bloqueio padrão quando alguém chega numa tela sem permissão. */
function semPermissaoHtml(oQue) {
  return `<div class="card"><div class="empty"><div class="ic">🔒</div><p><b>Sem permissão</b></p>
    <p class="small">Seu perfil (${esc(statusLabel(meuPapel()))}) não tem acesso a ${esc(oQue)}. Fale com o dono da empresa se precisar.</p></div></div>`;
}

// ================================================================ CADASTRO
function cadPermissoesHtml() {
  if (Cloud.active && !pode('equipe.gerenciar') && Cloud.papel !== 'dono') return semPermissaoHtml('permissões');
  const papeis = [['admin', 'Administrador'], ['financeiro', 'Financeiro'], ['corretor', 'Corretor']];
  const sub = state.sub.perm || 'admin';
  const perms = permsDoPapel(sub);
  const salvo = !!permsSalvas()[sub];
  return `<div class="card"><h3>🔐 Permissões por função</h3>
    <p class="help">O <b>papel</b> define o que o banco de dados libera para a pessoa. Aqui você afina, dentro do papel, o que ela vê e pode fazer no aplicativo. O dono sempre pode tudo.</p>
    ${!Cloud.active ? '<div class="alert info" style="cursor:default"><span>No modo só deste dispositivo existe um único administrador, que pode tudo. As permissões valem na versão em nuvem, com login por pessoa.</span></div>' : ''}
    <div class="subtabs">${papeis.map(([k, l]) => `<div class="chip ${sub === k ? 'active' : ''}" onclick="state.sub.perm='${k}';renderCurrent()">${l}</div>`).join('')}</div>
    <p class="help">${sub === 'corretor'
      ? 'O corretor usa a área dele: planta, lotes, as próprias reservas e as próprias comissões. Marque abaixo só o que ele também poderá fazer na administração.'
      : sub === 'financeiro'
        ? 'Perfil pensado para quem cuida do dinheiro: recebíveis, despesas, cobrança, índices e vendas. O banco de dados impede que ele mexa na planta, no preço e nas medidas dos lotes, mesmo que você marque abaixo.'
        : 'Perfil de administrador: por padrão pode tudo, menos o que você desmarcar aqui.'}</p>
    ${PERMISSOES.map(([grupo, itens]) => `<div class="fieldset"><span class="lg">${esc(grupo)}</span>
      ${itens.map(([k, rot]) => `<label class="check" style="margin-bottom:6px"><input type="checkbox" id="pm_${k.replace(/\W/g, '_')}" ${perms[k] ? 'checked' : ''}> ${esc(rot)}</label>`).join('')}
    </div>`).join('')}
    <div class="btn-row"><button class="btn btn-primary" onclick="salvarPermissoes('${sub}')">Salvar permissões do ${esc(papeis.find(p => p[0] === sub)[1].toLowerCase())}</button>
      ${salvo ? `<button class="btn btn-secondary" onclick="restaurarPermissoes('${sub}')">Voltar ao padrão</button>` : ''}</div>
    <p class="help mt">Quem estiver logado vê a mudança na próxima vez que abrir o app ou trocar de aba.</p></div>`;
}

function salvarPermissoes(papel) {
  const mapa = {};
  todasAsChaves().forEach(k => { const el = document.getElementById('pm_' + k.replace(/\W/g, '_')); if (el) mapa[k] = el.checked; });
  const todas = Object.assign({}, permsSalvas());
  todas[papel] = mapa;
  setConfig({ permissoes: todas });
  logAct(`Permissões do papel ${papel} atualizadas`);
  renderCurrent(); renderCurrent();
  toast('✅', 'Permissões salvas', statusLabel(papel));
}
function restaurarPermissoes(papel) {
  const todas = Object.assign({}, permsSalvas());
  delete todas[papel];
  setConfig({ permissoes: todas });
  renderCurrent(); renderCurrent();
  toast('↩️', 'Padrão restaurado', statusLabel(papel));
}
