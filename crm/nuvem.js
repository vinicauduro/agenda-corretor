// Nuvem do CRM (Supabase): login, equipe e sincronização dos dados.
// Sem chave em crm/config.js o app funciona só neste aparelho, como sempre funcionou.
//
// Como sincroniza: o app continua mexendo nas listas (events, reminders, messages,
// leads) e chamando saveData(). Aqui comparamos cada lista com a última versão
// conhecida e colocamos numa fila só o que mudou. A fila fica guardada no aparelho
// e é enviada assim que houver internet; o que o banco recusar é descartado com aviso.
const Nuvem = (() => {
  const cfg = window.CRM_CONFIG || {};
  const ativa = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  const sb = ativa ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  const URL_APP = location.origin + location.pathname;

  const st = {
    usuario: null,      // { id, email, nome }
    membro: null,       // linha de membros (só se ativo)
    desativado: false,
    equipe: null,       // { id, nome }
    membros: [],        // equipe inteira
    fila: [],
    seq: 0,
    snap: {},           // coleção -> Map(id -> JSON da linha)
    enviando: false,
    emVoo: null,
    canal: null,
    recarga: null
  };

  const semNulos = row => { for (const k of ['criado_em', 'criado_por']) if (row[k] == null) delete row[k]; return row; };

  // Tradução entre o objeto do app e a linha do banco. linha(obj(r)) precisa dar a
  // mesma linha, senão tudo o que vem do banco pareceria alterado.
  const COL = {
    events: {
      tabela: 'eventos', dono: 'user_id',
      linha: e => semNulos({ id: e.id, titulo: e.title || '', data: e.date || '', hora: e.time || '', tipo: e.type || 'outro',
        descricao: e.desc || '', lembrar_min: String(e.reminderMin || ''), lead_id: e.leadId || null, criado_em: e.createdAt || null }),
      obj: r => ({ id: r.id, title: r.titulo, date: r.data, time: r.hora, type: r.tipo, desc: r.descricao,
        reminderMin: r.lembrar_min, leadId: r.lead_id, createdAt: r.criado_em })
    },
    reminders: {
      tabela: 'lembretes', dono: 'user_id',
      linha: x => semNulos({ id: x.id, titulo: x.title || '', data: x.date || '', hora: x.time || '', feito: !!x.done,
        notificado: !!x.notified, lead_id: x.leadId || null, criado_em: x.createdAt || null }),
      obj: r => ({ id: r.id, title: r.titulo, date: r.data, time: r.hora, done: r.feito, notified: r.notificado,
        leadId: r.lead_id, createdAt: r.criado_em })
    },
    messages: {
      tabela: 'mensagens', dono: 'user_id', ordem: 'criado_em',
      linha: m => semNulos({ id: m.id, papel: m.role || 'user', tipo: m.type || 'texto', conteudo: m.content || '',
        transcricao: m.transcript || '', duracao: m.duration == null || m.duration === '' ? null : Number(m.duration),
        hora: m.time || '', criado_em: m.createdAt || null }),
      obj: r => ({ id: r.id, role: r.papel, type: r.tipo === 'texto' ? undefined : r.tipo, content: r.conteudo,
        transcript: r.transcricao, duration: r.duracao, time: r.hora, createdAt: r.criado_em })
    },
    leads: {
      tabela: 'leads', dono: 'equipe_id', ordem: 'criado_em',
      linha: l => semNulos({ id: l.id, corretor_id: l.corretorId || null, nome: l.nome || '', telefone: l.telefone || '',
        email: l.email || '', etapa: l.etapa || 'novo', motivo_perda: l.motivoPerda || '', finalidade: l.finalidade || 'compra',
        tipo_imovel: l.tipoImovel || '', regiao: l.regiao || '',
        valor_min: l.valorMin == null || l.valorMin === '' ? null : Number(l.valorMin),
        valor_max: l.valorMax == null || l.valorMax === '' ? null : Number(l.valorMax),
        pagamento: l.pagamento || [], obs: l.obs || '', criado_por: l.criadoPor || null, criado_em: l.criadoEm || null }),
      obj: r => ({ id: r.id, corretorId: r.corretor_id, nome: r.nome, telefone: r.telefone, email: r.email, etapa: r.etapa,
        motivoPerda: r.motivo_perda, finalidade: r.finalidade, tipoImovel: r.tipo_imovel, regiao: r.regiao,
        valorMin: r.valor_min == null ? null : Number(r.valor_min), valorMax: r.valor_max == null ? null : Number(r.valor_max),
        pagamento: r.pagamento || [], obs: r.obs, criadoPor: r.criado_por, criadoEm: r.criado_em, atualizadoEm: r.atualizado_em })
    }
  };
  const NOMES = Object.keys(COL);

  // ===== chaves no aparelho =====
  const chave = nome => 'crm_' + nome + '_' + st.usuario.id;
  const ler = (k, padrao) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : padrao; } catch { return padrao; } };
  const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn(e); } };

  function donoValor(c) { return c.dono === 'user_id' ? st.usuario.id : (st.membro && st.membro.equipe_id); }

  // ===== fila de envio =====
  function persistirFila() { gravar(chave('fila'), st.fila); atualizarStatus(); }

  function enfileirar(item) {
    item.k = item.col + ':' + item.id;
    item.seq = ++st.seq;
    const i = st.fila.findIndex(x => x.k === item.k && x.seq !== st.emVoo);
    if (i >= 0) st.fila[i] = item; else st.fila.push(item);
  }

  function diferenca(col, lista) {
    const c = COL[col], antes = st.snap[col] || new Map(), agora = new Map();
    for (const item of lista) {
      const row = c.linha(item), j = JSON.stringify(row);
      agora.set(item.id, j);
      if (antes.get(item.id) !== j) enfileirar({ op: 'upsert', col, id: item.id, row });
    }
    for (const id of antes.keys()) if (!agora.has(id)) enfileirar({ op: 'delete', col, id });
    st.snap[col] = agora;
  }

  function definirSnapshot(dados) {
    for (const col of NOMES) st.snap[col] = new Map((dados[col] || []).map(x => [x.id, JSON.stringify(COL[col].linha(x))]));
  }

  // Falha passageira (sem internet, servidor fora): tenta de novo depois.
  const passageira = r => !r.status || r.status >= 500 || r.status === 408 || r.status === 429;

  async function executar(item) {
    const c = COL[item.col], dono = donoValor(c);
    if (!dono) return { error: { message: 'Você não faz parte de uma equipe' }, status: 403 };
    try {
      if (item.op === 'upsert') {
        return await sb.from(c.tabela).upsert({ ...item.row, [c.dono]: dono }, { onConflict: c.dono + ',id' });
      }
      return await sb.from(c.tabela).delete().eq(c.dono, dono).eq('id', item.id);
    } catch (e) {
      return { error: { message: String(e && e.message || e) }, status: 0 };
    }
  }

  async function enviar() {
    if (!ativa || st.enviando || !st.usuario || !st.fila.length) return;
    st.enviando = true;
    atualizarStatus();
    try {
      while (st.fila.length) {
        const item = st.fila[0];
        st.emVoo = item.seq;
        const r = await executar(item);
        if (r.error && passageira(r)) break;
        st.fila = st.fila.filter(x => x.seq !== item.seq);
        persistirFila();
        if (r.error) {
          showToast('⚠️', 'Alteração recusada pela nuvem', traduzir(r.error.message));
          agendarRecarga();
        }
      }
    } finally {
      st.emVoo = null;
      st.enviando = false;
      atualizarStatus();
    }
  }

  function atualizarStatus() {
    const el = document.getElementById('syncBadge');
    if (!el) return;
    const n = st.fila.length;
    if (n) { el.textContent = navigator.onLine ? '⏳' + n : '⚠️' + n; el.title = n + ' alteração(ões) aguardando envio'; }
    else if (!navigator.onLine) { el.textContent = '⚠️'; el.title = 'Sem internet'; }
    else { el.textContent = ''; el.title = ''; }
    el.style.display = el.textContent ? 'inline-block' : 'none';
  }

  // ===== carregar do banco =====
  async function carregarTudo() {
    const uid = st.usuario.id;
    const consultas = NOMES.map(col => {
      const c = COL[col];
      if (c.dono === 'equipe_id' && !st.membro) return Promise.resolve({ data: [], status: 200 });
      let q = sb.from(c.tabela).select('*').eq(c.dono, c.dono === 'user_id' ? uid : st.membro.equipe_id);
      if (c.ordem) q = q.order(c.ordem);
      return q.then(r => r, e => ({ error: e, status: 0 }));
    });
    const res = await Promise.all(consultas);
    if (res.some(r => r.error)) return null;
    const dados = {};
    NOMES.forEach((col, i) => {
      const c = COL[col];
      const lista = res[i].data.map(c.obj);
      // o que ainda está na fila vale mais do que o banco
      for (const item of st.fila.filter(x => x.col === col)) {
        const j = lista.findIndex(x => x.id === item.id);
        if (item.op === 'delete') { if (j >= 0) lista.splice(j, 1); }
        else {
          const novo = c.obj(item.row);
          if (j >= 0) lista[j] = { ...lista[j], ...novo, atualizadoEm: lista[j].atualizadoEm }; else lista.push(novo);
        }
      }
      dados[col] = lista;
    });
    return dados;
  }

  function aplicar(dados) {
    definirSnapshot(dados);
    gravar(chave('dados'), dados);
    window.aoCarregarDados(dados);
  }

  async function carregarEquipe() {
    const r = await sb.from('membros').select('*, equipes(id, nome)').eq('user_id', st.usuario.id).maybeSingle()
      .then(x => x, e => ({ error: e, status: 0 }));
    if (r.error) return false;
    const m = r.data;
    st.desativado = !!(m && !m.ativo);
    st.membro = m && m.ativo ? m : null;
    st.equipe = st.membro && m.equipes ? { id: m.equipes.id, nome: m.equipes.nome } : null;
    st.membros = [];
    if (st.membro) {
      const t = await sb.from('membros').select('id, user_id, nome, email, telefone, papel, ativo')
        .eq('equipe_id', st.membro.equipe_id).order('nome').then(x => x, e => ({ error: e }));
      if (!t.error) st.membros = t.data;
    }
    gravar(chave('equipe'), { membro: st.membro, equipe: st.equipe, membros: st.membros, desativado: st.desativado });
    return true;
  }

  function assinarTempoReal() {
    if (st.canal) { sb.removeChannel(st.canal); st.canal = null; }
    if (!st.membro) return;
    st.canal = sb.channel('leads-' + st.membro.equipe_id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads', filter: 'equipe_id=eq.' + st.membro.equipe_id },
        () => agendarRecarga())
      .subscribe();
  }

  function agendarRecarga() {
    clearTimeout(st.recarga);
    st.recarga = setTimeout(recarregar, 1000);
  }

  async function recarregar() {
    if (!st.usuario) return;
    await enviar();
    const dados = await carregarTudo();
    if (dados) aplicar(dados);
  }

  // Dados que estavam só neste aparelho (antes da nuvem) sobem uma vez.
  function migrarLegado() {
    const uid = st.usuario.id;
    if (!localStorage.getItem('crm_legado_importado')) {
      const d = {
        events: ler('corretor_events', []),
        reminders: ler('corretor_reminders', []),
        messages: ler('corretor_messages', [])
      };
      if (d.events.length || d.reminders.length || d.messages.length) window.aoImportarLegado(d);
      localStorage.setItem('crm_legado_importado', uid);
    }
    if (st.membro && !localStorage.getItem('crm_legado_leads')) {
      const leads = ler('corretor_leads', []).map(l => ({ ...l, corretorId: uid, criadoPor: uid }));
      if (leads.length) window.aoImportarLegado({ leads });
      localStorage.setItem('crm_legado_leads', uid);
    }
  }

  // ===== convite pelo link (?convite=codigo) =====
  function guardarConviteDaUrl() {
    const p = new URLSearchParams(location.search);
    const c = p.get('convite');
    if (!c) return;
    localStorage.setItem('crm_convite', c);
    p.delete('convite');
    history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : '') + location.hash);
  }

  async function aceitarConvitePendente() {
    const codigo = localStorage.getItem('crm_convite');
    if (!codigo) return false;
    const r = await sb.rpc('crm_aceitar_convite', { p_codigo: codigo, p_nome: st.usuario.nome, p_telefone: '' })
      .then(x => x, e => ({ error: e, status: 0 }));
    if (r.error && passageira(r)) return false;
    localStorage.removeItem('crm_convite');
    if (r.error) { showToast('⚠️', 'Convite', traduzir(r.error.message)); return false; }
    showToast('🤝', 'Bem-vindo à equipe!', 'Seus leads aparecem na aba Leads');
    return true;
  }

  // ===== sessão =====
  async function iniciar() {
    guardarConviteDaUrl();
    sb.auth.onAuthStateChange((evento) => {
      if (evento === 'PASSWORD_RECOVERY') mostrarLogin('nova-senha');
    });
    window.addEventListener('online', () => { atualizarStatus(); enviar(); });
    window.addEventListener('offline', atualizarStatus);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && st.usuario) agendarRecarga(); });
    setInterval(() => { if (st.fila.length) enviar(); }, 30000);

    const { data } = await sb.auth.getSession();
    if (data && data.session) await abrirSessao(data.session.user);
    else mostrarLogin('entrar');
  }

  async function abrirSessao(user) {
    st.usuario = { id: user.id, email: user.email, nome: (user.user_metadata && user.user_metadata.nome) || '' };
    st.fila = ler(chave('fila'), []);
    st.seq = st.fila.reduce((m, x) => Math.max(m, x.seq || 0), 0);
    const eq = ler(chave('equipe'), null);
    if (eq) Object.assign(st, { membro: eq.membro, equipe: eq.equipe, membros: eq.membros || [], desativado: !!eq.desativado });
    esconderLogin();

    // primeiro o que já está no aparelho, para abrir rápido e funcionar sem internet
    const cache = ler(chave('dados'), null);
    if (cache) { definirSnapshot(cache); window.aoCarregarDados(cache); }
    else window.aoCarregarDados({});
    atualizarStatus();

    if (await carregarEquipe()) {
      if (!st.membro && await aceitarConvitePendente()) await carregarEquipe();
    }
    window.aoMudarEquipe();
    const dados = await carregarTudo();
    if (dados) { aplicar(dados); migrarLegado(); }
    assinarTempoReal();
    enviar();
    sincronizarPush();
  }

  // ===== tela de login =====
  let modoLogin = 'entrar';
  function mostrarLogin(modo) {
    modoLogin = modo;
    const tela = document.getElementById('telaLogin');
    tela.classList.add('open');
    const convite = !!localStorage.getItem('crm_convite');
    document.getElementById('loginConvite').style.display = convite && modo !== 'nova-senha' ? 'block' : 'none';
    document.getElementById('loginTitulo').textContent =
      modo === 'criar' ? 'Criar conta' : modo === 'nova-senha' ? 'Nova senha' : 'Entrar';
    document.getElementById('loginNomeGrupo').style.display = modo === 'criar' ? 'block' : 'none';
    document.getElementById('loginEmailGrupo').style.display = modo === 'nova-senha' ? 'none' : 'block';
    document.getElementById('loginSenhaLabel').textContent = modo === 'nova-senha' ? 'Nova senha' : 'Senha';
    document.getElementById('loginBotao').textContent =
      modo === 'criar' ? 'Criar conta' : modo === 'nova-senha' ? 'Salvar nova senha' : 'Entrar';
    document.getElementById('loginAlternar').innerHTML = modo === 'criar'
      ? 'Já tem conta? <a href="#" onclick="Nuvem.telaLogin(\'entrar\');return false">Entrar</a>'
      : modo === 'entrar'
        ? 'Primeira vez? <a href="#" onclick="Nuvem.telaLogin(\'criar\');return false">Criar conta</a> · <a href="#" onclick="Nuvem.esqueciSenha();return false">Esqueci a senha</a>'
        : '';
    document.getElementById('loginSenha').value = '';
    mensagemLogin('');
  }
  function esconderLogin() { document.getElementById('telaLogin').classList.remove('open'); }
  function mensagemLogin(txt, ok) {
    const el = document.getElementById('loginMsg');
    el.textContent = txt;
    el.style.color = ok ? '#15803d' : 'var(--danger)';
  }

  async function enviarLogin() {
    const nome = document.getElementById('loginNome').value.trim();
    const email = document.getElementById('loginEmail').value.trim();
    const senha = document.getElementById('loginSenha').value;
    const botao = document.getElementById('loginBotao');
    if (modoLogin !== 'nova-senha' && !email) return mensagemLogin('Informe o e-mail');
    if (!senha) return mensagemLogin('Informe a senha');
    if (modoLogin === 'criar' && !nome) return mensagemLogin('Informe seu nome');
    botao.disabled = true;
    try {
      if (modoLogin === 'entrar') {
        const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
        if (error) return mensagemLogin(traduzir(error.message));
        await abrirSessao(data.user);
      } else if (modoLogin === 'criar') {
        const { data, error } = await sb.auth.signUp({ email, password: senha, options: { data: { nome }, emailRedirectTo: URL_APP } });
        if (error) return mensagemLogin(traduzir(error.message));
        if (data.session) await abrirSessao(data.user);
        else mensagemLogin('Conta criada! Abra o link que enviamos para ' + email + ' e depois entre aqui.', true);
      } else {
        const { error } = await sb.auth.updateUser({ password: senha });
        if (error) return mensagemLogin(traduzir(error.message));
        const { data } = await sb.auth.getSession();
        showToast('🔑', 'Senha alterada', '');
        if (data.session) await abrirSessao(data.session.user); else mostrarLogin('entrar');
      }
    } catch (e) {
      mensagemLogin('Sem conexão com a nuvem. Verifique a internet.');
    } finally {
      botao.disabled = false;
    }
  }

  async function esqueciSenha() {
    const email = document.getElementById('loginEmail').value.trim();
    if (!email) return mensagemLogin('Digite seu e-mail acima e toque de novo em "Esqueci a senha"');
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: URL_APP });
    if (error) return mensagemLogin(traduzir(error.message));
    mensagemLogin('Enviamos um link para ' + email + ' para você criar uma nova senha.', true);
  }

  async function sair() {
    if (st.fila.length && !confirm('Há ' + st.fila.length + ' alteração(ões) que ainda não foram enviadas e serão perdidas. Sair mesmo assim?')) return;
    for (const n of ['fila', 'dados', 'equipe']) localStorage.removeItem(chave(n));
    await desativarPush().catch(() => {});
    await sb.auth.signOut().catch(() => {});
    location.reload();
  }

  // ===== equipe =====
  async function rpc(nome, args) {
    const r = await sb.rpc(nome, args).then(x => x, e => ({ error: e, status: 0 }));
    if (r.error) throw new Error(passageira(r) ? 'Sem conexão com a nuvem. Tente de novo.' : traduzir(r.error.message));
    return r.data;
  }

  async function criarEquipe(nome) {
    await rpc('crm_criar_equipe', { p_nome: nome, p_usuario_nome: st.usuario.nome, p_telefone: '' });
    await posMudancaEquipe();
  }

  async function posMudancaEquipe() {
    await carregarEquipe();
    window.aoMudarEquipe();
    const dados = await carregarTudo();
    if (dados) { aplicar(dados); migrarLegado(); }
    assinarTempoReal();
    enviar();
  }

  async function gerarConvite(papel) {
    const codigo = await rpc('crm_criar_convite', { p_papel: papel || 'corretor' });
    return URL_APP + '?convite=' + codigo;
  }

  async function atualizarMembro(id, campos) {
    const r = await sb.from('membros').update(campos).eq('id', id).then(x => x, e => ({ error: e, status: 0 }));
    if (r.error) throw new Error(passageira(r) ? 'Sem conexão com a nuvem. Tente de novo.' : traduzir(r.error.message));
    await carregarEquipe();
    window.aoMudarEquipe();
  }

  async function salvarPerfil(nome, telefone) {
    st.usuario.nome = nome;
    await sb.auth.updateUser({ data: { nome } }).catch(() => {});
    if (st.membro) await atualizarMembro(st.membro.id, { nome, telefone });
  }

  // ===== avisos no celular (push) =====
  // O aparelho se inscreve e a função "avisos" do Supabase manda o lembrete na
  // hora, mesmo com o app fechado. No iPhone só funciona com o app na Tela de Início.
  const PUSH = 'crm_push_endpoint';
  const iphoneNoSafari = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !navigator.standalone;
  const pushSuportado = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  function chaveBytes(b64) {
    const s = atob((b64 + '='.repeat((4 - b64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(s, c => c.charCodeAt(0));
  }
  async function inscricaoAtual() {
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  }

  async function estadoPush() {
    if (!ativa || !st.usuario) return 'indisponivel';
    if (iphoneNoSafari()) return 'instalar';
    if (!pushSuportado()) return 'sem-suporte';
    if (Notification.permission === 'denied') return 'bloqueado';
    const sub = await inscricaoAtual().catch(() => null);
    return sub && Notification.permission === 'granted' && localStorage.getItem(PUSH) ? 'ativo' : 'inativo';
  }

  async function registrarInscricao(sub) {
    const j = sub.toJSON();
    let fuso = 'America/Sao_Paulo';
    try { fuso = Intl.DateTimeFormat().resolvedOptions().timeZone || fuso; } catch {}
    await rpc('crm_salvar_inscricao', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_fuso: fuso });
    localStorage.setItem(PUSH, j.endpoint);
  }

  // Precisa ser chamado direto do toque no botão (o iPhone exige para mostrar a pergunta).
  async function ativarPush() {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('Sem permissão. Libere em Ajustes › Notificações › Agenda e tente de novo.');
    const chavePublica = await rpc('crm_vapid_publica', {});
    if (!chavePublica) throw new Error('Os avisos ainda não foram ligados no servidor. Tente de novo em alguns minutos.');
    let sub = await inscricaoAtual();
    if (!sub) {
      try {
        sub = await (await navigator.serviceWorker.ready).pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveBytes(chavePublica) });
      } catch (e) {
        throw new Error('Não foi possível ativar os avisos neste aparelho. Verifique a internet e tente de novo. (' + (e && e.message || e) + ')');
      }
    }
    await registrarInscricao(sub);
  }

  async function desativarPush() {
    const endpoint = localStorage.getItem(PUSH);
    localStorage.removeItem(PUSH);
    if (endpoint && st.usuario) await sb.rpc('crm_remover_inscricao', { p_endpoint: endpoint }).then(x => x, () => {});
    if (pushSuportado()) { const sub = await inscricaoAtual().catch(() => null); if (sub) await sub.unsubscribe().catch(() => {}); }
  }

  // A cada entrada, confirma a inscrição no servidor (o aparelho pode trocar o endereço dela).
  async function sincronizarPush() {
    if (!localStorage.getItem(PUSH) || !pushSuportado() || Notification.permission !== 'granted') return;
    const sub = await inscricaoAtual().catch(() => null);
    if (sub) await registrarInscricao(sub).catch(() => {});
  }

  function traduzir(msg) {
    const m = String(msg || '');
    const mapa = [
      [/invalid login credentials/i, 'E-mail ou senha incorretos'],
      [/user already registered/i, 'Este e-mail já tem conta. Use "Entrar".'],
      [/password should be at least/i, 'A senha precisa ter pelo menos 6 caracteres'],
      [/email not confirmed/i, 'Confirme seu e-mail pelo link que enviamos e tente de novo'],
      [/unable to validate email|invalid email/i, 'E-mail inválido'],
      [/rate limit|too many/i, 'Muitas tentativas. Aguarde alguns minutos.'],
      [/row-level security|permission denied/i, 'Sem permissão para esta alteração'],
      [/failed to fetch|network|load failed/i, 'Sem conexão com a nuvem']
    ];
    for (const [re, txt] of mapa) if (re.test(m)) return txt;
    return m;
  }

  return {
    ativa,
    iniciar,
    salvar(dados) {
      if (!st.usuario) return;
      gravar(chave('dados'), dados);
      for (const col of NOMES) {
        if (COL[col].dono === 'equipe_id' && !st.membro) continue;
        diferenca(col, dados[col] || []);
      }
      persistirFila();
      enviar();
    },
    telaLogin: mostrarLogin,
    enviarLogin,
    esqueciSenha,
    sair,
    criarEquipe,
    gerarConvite,
    atualizarMembro,
    salvarPerfil,
    recarregar,
    estadoPush,
    ativarPush,
    desativarPush,
    get pushAtivo() { return !!localStorage.getItem(PUSH); },
    get usuario() { return st.usuario; },
    get membro() { return st.membro; },
    get equipe() { return st.equipe; },
    get membros() { return st.membros; },
    get desativado() { return st.desativado; },
    get pendentes() { return st.fila.length; },
    get ehAdmin() { return !!(st.membro && st.membro.papel === 'admin'); }
  };
})();
