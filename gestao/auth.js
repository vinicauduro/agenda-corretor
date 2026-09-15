/* ===== Gestão de Loteamento — autenticação, empresa, equipe e convites (modo nuvem) ===== */
'use strict';

// ---------------------------------------------------------------- telas de acesso
function renderAuth(tela, aviso) {
  $('#localBox').style.display = 'none';
  const box = $('#authBox'); box.style.display = '';
  renderSyncStatus();
  if (!tela) tela = Cloud.user ? (Cloud.minhasOrgs.length ? 'escolher' : 'entrar') : 'login';
  const alerta = aviso ? `<div class="alert" style="cursor:default;margin-bottom:12px"><span>${esc(aviso)}</span></div>` : '';
  const conv = prefs.convitePendente || '';
  if (tela === 'carregando') {
    box.innerHTML = `<div class="auth-card"><div class="empty"><div class="ic">⏳</div><p>Carregando…</p></div></div>`;
  } else if (tela === 'login') {
    box.innerHTML = `<div class="auth-card">${alerta}
      <h2>Entrar</h2>
      <div class="fg"><label>E-mail</label><input type="email" id="auEmail" autocomplete="username" value="${esc(prefs.ultimoEmail || '')}"></div>
      <div class="fg"><label>Senha</label><input type="password" id="auSenha" autocomplete="current-password"></div>
      <button class="btn btn-primary btn-block" id="auBtnLogin" onclick="authLogin()">Entrar</button>
      <div class="auth-links"><a href="#" onclick="renderAuth('cadastro');return false">Criar conta</a><a href="#" onclick="renderAuth('recuperar');return false">Esqueci a senha</a></div>
      ${conv ? `<p class="small muted mt">Você tem um convite (<b>${esc(conv)}</b>). Entre ou crie sua conta para aceitar.</p>` : ''}
    </div>`;
    setTimeout(() => { const el = $(prefs.ultimoEmail ? '#auSenha' : '#auEmail'); if (el) el.focus(); $$('#authBox input').forEach(i => i.onkeydown = e => { if (e.key === 'Enter') authLogin(); }); }, 50);
  } else if (tela === 'cadastro') {
    box.innerHTML = `<div class="auth-card">${alerta}
      <h2>Criar conta</h2>
      <div class="fg"><label>Seu nome</label><input type="text" id="auNome"></div>
      <div class="fg"><label>E-mail</label><input type="email" id="auEmail" autocomplete="username"></div>
      <div class="fg"><label>Senha (mín. 6 caracteres)</label><input type="password" id="auSenha" autocomplete="new-password"></div>
      <button class="btn btn-primary btn-block" onclick="authCadastro()">Criar conta</button>
      <div class="auth-links"><a href="#" onclick="renderAuth('login');return false">Já tenho conta</a></div>
    </div>`;
    setTimeout(() => { const el = $('#auNome'); if (el) el.focus(); }, 50);
  } else if (tela === 'recuperar') {
    box.innerHTML = `<div class="auth-card">${alerta}
      <h2>Recuperar senha</h2>
      <p class="small muted mb">Enviaremos um link para você definir uma nova senha.</p>
      <div class="fg"><label>E-mail</label><input type="email" id="auEmail" value="${esc(prefs.ultimoEmail || '')}"></div>
      <button class="btn btn-primary btn-block" onclick="authRecuperar()">Enviar link</button>
      <div class="auth-links"><a href="#" onclick="renderAuth('login');return false">Voltar</a></div>
    </div>`;
  } else if (tela === 'nova-senha') {
    box.innerHTML = `<div class="auth-card">${alerta}
      <h2>Definir nova senha</h2>
      <div class="fg"><label>Nova senha</label><input type="password" id="auSenha" autocomplete="new-password"></div>
      <div class="fg"><label>Repita a senha</label><input type="password" id="auSenha2" autocomplete="new-password"></div>
      <button class="btn btn-primary btn-block" onclick="authNovaSenha()">Salvar senha</button>
    </div>`;
  } else if (tela === 'confirmar') {
    box.innerHTML = `<div class="auth-card"><div class="empty"><div class="ic">📬</div><p><b>Confira seu e-mail.</b><br>Enviamos um link de confirmação para <b>${esc(prefs.ultimoEmail || '')}</b>. Depois de confirmar, volte aqui e entre.</p></div>
      <button class="btn btn-secondary btn-block" onclick="renderAuth('login')">Voltar para o login</button></div>`;
  } else if (tela === 'entrar') { // logado, sem empresa (ou com convite pendente)
    const m = Cloud.user && Cloud.user.user_metadata ? Cloud.user.user_metadata : {};
    box.innerHTML = `<div class="auth-card">${alerta}
      <div class="row-between mb"><h2 style="margin:0">Olá${m.nome ? ', ' + esc(m.nome.split(' ')[0]) : ''}!</h2><button class="btn btn-sm btn-secondary" onclick="sair()">Sair</button></div>
      ${Cloud.minhasOrgs.length ? `<p class="small muted mb">Você já participa de ${Cloud.minhasOrgs.length} empresa(s). <a href="#" onclick="renderAuth('escolher');return false">Abrir</a></p>` : ''}
      <div class="fieldset"><span class="lg">🧑‍💼 Tenho um código de convite</span>
        <p class="help mb">Corretores e equipe entram com o código enviado pelo administrador.</p>
        <div class="frow"><div class="fg"><label>Código *</label><input type="text" id="cvCodigo" value="${esc(conv)}" style="text-transform:uppercase"></div><div class="fg"><label>Seu nome *</label><input type="text" id="cvNome" value="${esc(m.nome || '')}"></div></div>
        <div class="frow"><div class="fg"><label>Telefone / WhatsApp *</label><input type="tel" id="cvTel"></div><div class="fg"><label>CRECI</label><input type="text" id="cvCreci"></div></div>
        <div class="fg"><label>Imobiliária</label><input type="text" id="cvImob"></div>
        <button class="btn btn-primary btn-block" onclick="authEntrarConvite()">Entrar na empresa</button></div>
      <div class="fieldset"><span class="lg">🏢 Criar minha empresa</span>
        <p class="help mb">Para incorporadoras e administradores de loteamento. Você será o dono.</p>
        <div class="fg"><label>Nome da empresa / incorporadora *</label><input type="text" id="orgNome"></div>
        <div class="frow"><div class="fg"><label>Seu nome *</label><input type="text" id="orgUser" value="${esc(m.nome || '')}"></div><div class="fg"><label>Telefone / WhatsApp</label><input type="tel" id="orgTel"></div></div>
        <button class="btn btn-accent btn-block" onclick="authCriarOrg()">Criar empresa</button></div>
    </div>`;
  } else if (tela === 'escolher') {
    box.innerHTML = `<div class="auth-card">${alerta}
      <div class="row-between mb"><h2 style="margin:0">Escolha a empresa</h2><button class="btn btn-sm btn-secondary" onclick="sair()">Sair</button></div>
      ${Cloud.minhasOrgs.map(x => `<div class="item" onclick="authAbrirOrg('${x.org.id}')"><div class="info"><div class="title">${esc(x.org.nome)}</div><div class="meta"><span>${statusLabel(x.membro.papel)}</span></div></div><div class="side">›</div></div>`).join('')}
      <button class="btn btn-secondary btn-block mt" onclick="renderAuth('entrar')">Entrar com convite ou criar outra empresa</button>
    </div>`;
  }
}
function authBusy(on) { $$('#authBox button').forEach(b => b.disabled = on); }
async function authLogin() {
  const email = val('auEmail').toLowerCase(), senha = val('auSenha');
  if (!email || !senha) { toast('⚠️', 'Informe e-mail e senha', '', true); return; }
  authBusy(true);
  try { prefs.ultimoEmail = email; savePrefs(); await Cloud.signIn(email, senha); }
  catch (e) { authBusy(false); toast('⛔', 'Não foi possível entrar', traduzErro(e), true); }
}
async function authCadastro() {
  const nome = val('auNome'), email = val('auEmail').toLowerCase(), senha = val('auSenha');
  if (!nome || !email || senha.length < 6) { toast('⚠️', 'Preencha nome, e-mail e uma senha com 6+ caracteres', '', true); return; }
  authBusy(true);
  try {
    prefs.ultimoEmail = email; savePrefs();
    const data = await Cloud.signUp(email, senha, nome);
    if (!data.session) renderAuth('confirmar');
    // com sessão, o onAuthStateChange(SIGNED_IN) segue o fluxo
  } catch (e) { authBusy(false); toast('⛔', 'Não foi possível criar a conta', traduzErro(e), true); }
}
async function authRecuperar() {
  const email = val('auEmail').toLowerCase(); if (!email) return;
  authBusy(true);
  try { await Cloud.resetPassword(email); toast('📬', 'Link enviado', 'Confira seu e-mail.'); renderAuth('login'); }
  catch (e) { authBusy(false); toast('⛔', 'Falha', traduzErro(e), true); }
}
async function authNovaSenha() {
  const s1 = val('auSenha'), s2 = val('auSenha2');
  if (s1.length < 6 || s1 !== s2) { toast('⚠️', 'As senhas precisam ser iguais e ter 6+ caracteres', '', true); return; }
  authBusy(true);
  try { await Cloud.updatePassword(s1); toast('✅', 'Senha atualizada', ''); history.replaceState(null, '', location.pathname); await Cloud.aposLogin(); }
  catch (e) { authBusy(false); toast('⛔', 'Falha', traduzErro(e), true); }
}
async function authCriarOrg() {
  const nome = val('orgNome'), user = val('orgUser');
  if (!nome || !user) { toast('⚠️', 'Informe o nome da empresa e o seu nome', '', true); return; }
  authBusy(true);
  try {
    const orgId = await Cloud.criarOrganizacao(nome, user, val('orgTel'));
    prefs.convitePendente = null; savePrefs();
    await Cloud.carregarMinhasOrgs();
    await Cloud.abrirOrg(orgId);
    toast('🎉', 'Empresa criada', 'Cadastre o primeiro loteamento.');
  } catch (e) { authBusy(false); toast('⛔', 'Não foi possível criar a empresa', traduzErro(e), true); }
}
async function authEntrarConvite() {
  const codigo = val('cvCodigo'), nome = val('cvNome'), tel = val('cvTel');
  if (!codigo || !nome || !tel) { toast('⚠️', 'Informe código, nome e telefone', '', true); return; }
  authBusy(true);
  try {
    const orgId = await Cloud.entrarComConvite(codigo, { nome, telefone: tel, creci: val('cvCreci'), imobiliaria: val('cvImob') });
    prefs.convitePendente = null; savePrefs();
    history.replaceState(null, '', location.pathname);
    await Cloud.carregarMinhasOrgs();
    await Cloud.abrirOrg(orgId);
    toast('✅', 'Bem-vindo!', 'Você entrou na empresa.');
  } catch (e) { authBusy(false); toast('⛔', 'Convite não aceito', traduzErro(e), true); }
}
async function authAbrirOrg(id) { renderAuth('carregando'); try { await Cloud.abrirOrg(id); } catch (e) { renderAuth('escolher', traduzErro(e)); } }
function trocarEmpresa() { if (!Cloud.enabled) return; Cloud.fecharOrg(); state.role = 'landing'; showScreen('landing'); Cloud.carregarMinhasOrgs().then(() => renderAuth('escolher')); }
function traduzErro(e) {
  const m = (e && e.message) || String(e);
  if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail antes de entrar (veja a caixa de entrada).';
  if (/already registered/i.test(m)) return 'Este e-mail já tem conta. Use "Entrar" ou "Esqueci a senha".';
  if (/Password should be/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/rate limit/i.test(m)) return 'Muitas tentativas. Aguarde um minuto.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Sem conexão com o servidor.';
  return m;
}

// ---------------------------------------------------------------- equipe e convites (admin, modo nuvem)
function cadEquipeHtml() {
  const link = c => location.origin + location.pathname + '?convite=' + c.codigo;
  const eu = Cloud.user.id;
  return `<div class="card"><h3>👥 Equipe <span class="h-actions"><button class="btn btn-primary btn-sm" onclick="abrirConviteForm()">＋ Convite</button></span></h3>
    <p class="help mb">Quem tem acesso a <b>${esc(Cloud.org.nome)}</b>. Corretores veem a planta, os preços e só as próprias reservas. Administradores e financeiro veem tudo.</p>
    ${Cloud.membros.map(m => `<div class="item ${m.ativo ? '' : 'bloqueado'}" onclick="abrirMembroForm('${m.id}')"><div class="info"><div class="title">${esc(m.nome || m.email || '(sem nome)')} ${m.userId === eu ? '<span class="badge aprovada">você</span>' : ''} ${!m.ativo ? '<span class="badge neutral">inativo</span>' : ''}</div>
      <div class="meta"><span class="badge ${m.papel === 'corretor' ? 'neutral' : 'convertida'}">${statusLabel(m.papel)}</span><span>${esc(m.email)}</span>${m.telefone ? `<span>· ${esc(fmtPhone(m.telefone))}</span>` : ''}${m.creci ? `<span>· ${esc(m.creci)}</span>` : ''}${m.imobiliaria ? `<span>· ${esc(m.imobiliaria)}</span>` : ''}</div></div>
      <div class="side">${m.telefone ? `<a class="btn-icon" style="background:#dcfce7;color:#166534;text-decoration:none" target="_blank" href="${waLink(m.telefone, '')}" onclick="event.stopPropagation()">💬</a>` : ''}</div></div>`).join('')}</div>
    <div class="card"><h3>🔗 Convites</h3>
    <p class="help mb">Envie o link ao corretor: ele cria a conta (ou entra) e já fica vinculado à sua empresa com o papel do convite.</p>
    ${Cloud.convites.length ? Cloud.convites.map(c => `<div class="item"><div class="info"><div class="title">${esc(c.codigo)} <span class="badge ${c.papel === 'corretor' ? 'neutral' : 'convertida'}">${statusLabel(c.papel)}</span> ${c.descricao ? `<span class="small muted">· ${esc(c.descricao)}</span>` : ''}</div><div class="meta"><span>${c.usos} uso(s)</span><span>· criado em ${fmtDateTime(c.criadoEm)}</span></div><div class="code-box mt" style="font-size:0.7rem">${esc(link(c))}</div></div>
      <div class="side"><div class="btns"><button class="btn-icon" title="Copiar link" onclick="copiarTexto('${esc(link(c))}')">📋</button><a class="btn-icon" style="background:#dcfce7;color:#166534;text-decoration:none" title="Enviar por WhatsApp" target="_blank" href="${'https://wa.me/?text=' + encodeURIComponent('Acesse a planta de ' + Cloud.org.nome + ' e faça suas reservas por aqui: ' + link(c) + ' (código ' + c.codigo + ')')}">💬</a><button class="btn-icon del" title="Excluir convite" onclick="apagarConvite('${c.id}')">🗑️</button></div></div></div>`).join('') : '<p class="help">Nenhum convite ativo. Crie um para chamar corretores.</p>'}
    </div>`;
}
function abrirConviteForm() {
  openModal({ title: '🔗 Novo convite', body: `<div class="fg"><label>Papel de quem entrar com este convite</label><select id="cvPapel"><option value="corretor">Corretor (vê planta, preços e faz reservas)</option><option value="financeiro">Financeiro (vê tudo, inclusive recebíveis e custos)</option><option value="admin">Administrador (acesso total)</option></select></div>
    <div class="fg"><label>Descrição (opcional)</label><input type="text" id="cvDesc" placeholder="Ex.: corretores da Mendes Imóveis"></div>`,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="criarConvite()">Gerar link</button>` });
}
async function criarConvite() {
  try { const cod = await Cloud.criarConvite(val('cvPapel'), val('cvDesc')); closeModal(); renderCadastros(); toast('✅', 'Convite criado', 'Código ' + cod); }
  catch (e) { toast('⚠️', 'Falha', e.message, true); }
}
async function apagarConvite(id) { if (!confirm('Excluir este convite? Quem já entrou continua na equipe.')) return; try { await Cloud.apagarConvite(id); renderCadastros(); } catch (e) { toast('⚠️', 'Falha', e.message, true); } }
function abrirMembroForm(id) {
  const m = Cloud.membros.find(x => x.id === id); if (!m) return;
  const eu = m.userId === Cloud.user.id;
  openModal({ title: '👤 ' + esc(m.nome || m.email), body: `
    <div class="fg"><label>Nome</label><input type="text" id="mbNome" value="${esc(m.nome)}"></div>
    <div class="frow"><div class="fg"><label>Telefone</label><input type="tel" id="mbTel" value="${esc(m.telefone)}"></div><div class="fg"><label>CRECI</label><input type="text" id="mbCreci" value="${esc(m.creci)}"></div></div>
    <div class="frow"><div class="fg"><label>Imobiliária</label><input type="text" id="mbImob" value="${esc(m.imobiliaria)}"></div><div class="fg"><label>Papel</label><select id="mbPapel" ${eu ? 'disabled' : ''}><option value="corretor" ${m.papel === 'corretor' ? 'selected' : ''}>Corretor</option><option value="financeiro" ${m.papel === 'financeiro' ? 'selected' : ''}>Financeiro</option><option value="admin" ${m.papel === 'admin' ? 'selected' : ''}>Administrador</option><option value="dono" ${m.papel === 'dono' ? 'selected' : ''}>Dono</option></select></div></div>
    <label class="check"><input type="checkbox" id="mbAtivo" ${m.ativo ? 'checked' : ''} ${eu ? 'disabled' : ''}> Ativo (desmarque para bloquear o acesso)</label>
    <p class="help mt">E-mail: ${esc(m.email)}</p>`,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="salvarMembro('${m.id}')">Salvar</button>` });
}
async function salvarMembro(id) {
  const m = Cloud.membros.find(x => x.id === id); if (!m) return;
  const upd = Object.assign({}, m, { nome: val('mbNome'), telefone: val('mbTel'), creci: val('mbCreci'), imobiliaria: val('mbImob'), papel: $('#mbPapel').disabled ? m.papel : val('mbPapel'), ativo: $('#mbAtivo').disabled ? m.ativo : checked('mbAtivo') });
  try { await Cloud.salvarMembro(upd); closeModal(); renderCadastros(); toast('✅', 'Membro atualizado', ''); }
  catch (e) { toast('⚠️', 'Falha', e.message, true); }
}
function cadContaHtml() {
  return `<div class="card"><h3>☁️ Nuvem e conta <span id="syncStatusBox"></span></h3>
    <div class="detail-grid"><div><div class="k">Empresa</div><div class="v">${esc(Cloud.org.nome)}</div></div><div><div class="k">Seu papel</div><div class="v">${statusLabel(Cloud.papel)}</div></div><div><div class="k">Usuário</div><div class="v">${esc(Cloud.user.email || '')}</div></div><div><div class="k">Plano</div><div class="v">${esc(Cloud.org.plano || 'gratuito')}</div></div></div>
    <p class="help mt">Os dados ficam no banco da empresa e são atualizados em tempo real em todos os aparelhos. Uma cópia local é mantida neste navegador para abrir mais rápido.</p>
    <div class="btn-row"><button class="btn btn-secondary" onclick="trocarEmpresa()">Trocar de empresa</button><button class="btn btn-outline" onclick="renderAuthNovaSenhaModal()">Alterar minha senha</button><button class="btn btn-outline-danger" onclick="sair()">Sair</button></div></div>`;
}
function renderAuthNovaSenhaModal() {
  openModal({ title: '🔐 Alterar senha', body: `<div class="fg"><label>Nova senha</label><input type="password" id="auSenha" autocomplete="new-password"></div><div class="fg"><label>Repita a senha</label><input type="password" id="auSenha2" autocomplete="new-password"></div>`,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="(async()=>{const a=val('auSenha'),b=val('auSenha2');if(a.length<6||a!==b){toast('⚠️','As senhas precisam ser iguais e ter 6+ caracteres','',true);return;}try{await Cloud.updatePassword(a);closeModal();toast('✅','Senha alterada','');}catch(e){toast('⛔','Falha',traduzErro(e),true);}})()">Salvar</button>` });
}
