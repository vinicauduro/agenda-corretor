/* ===== Gestão de Loteamento — importar planta em PDF (admin) ===== */
'use strict';

const pdfImp = { doc: null, lib: null, pageNum: 1, page: null, ext: null, det: null, clip: null, prev: null, drag: null, fileName: '' };

async function importarPlantaPDF(input) {
  const f = input.files[0]; input.value = ''; if (!f) return;
  const lot = curLot(); if (!lot) return;
  openModal({ title: '📄 Importar planta do PDF', body: `<div class="empty"><div class="ic">⏳</div><p>Lendo o PDF…</p></div>`, wide: true });
  try {
    pdfImp.fileName = f.name;
    const buf = await f.arrayBuffer();
    pdfImp.lib = await PlantaPDF.getLib();
    pdfImp.doc = await PlantaPDF.abrir(new Uint8Array(buf), pdfImp.lib);
    pdfImp.pageNum = 1;
    await pdfCarregarPagina();
  } catch (e) { console.error(e); openModal({ title: '📄 Importar planta do PDF', body: `<div class="alert" style="cursor:default"><span>Não foi possível ler este PDF: ${esc(e.message || e)}</span></div>`, footer: `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>` }); }
}
async function pdfCarregarPagina() {
  pdfImp.page = await pdfImp.doc.getPage(pdfImp.pageNum);
  $('#modalBody').innerHTML = `<div class="empty"><div class="ic">🔎</div><p>Analisando vetores e textos da página ${pdfImp.pageNum}…</p></div>`;
  await new Promise(r => setTimeout(r, 30));
  pdfImp.ext = await PlantaPDF.extrair(pdfImp.page, pdfImp.lib);
  const det = PlantaPDF.detectar(pdfImp.ext);
  // recorte sugerido: caixa dos lotes encontrados com margem
  if (det.lotes.length) {
    const W = pdfImp.ext.W, H = pdfImp.ext.H;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    det.lotes.forEach(l => l.pts.forEach(p => { x0 = Math.min(x0, p[0] * W); y0 = Math.min(y0, p[1] * H); x1 = Math.max(x1, p[0] * W); y1 = Math.max(y1, p[1] * H); }));
    const mx = (x1 - x0) * 0.06, my = (y1 - y0) * 0.08;
    pdfImp.clip = { x: Math.max(0, x0 - mx), y: Math.max(0, y0 - my), w: Math.min(W, x1 + mx) - Math.max(0, x0 - mx), h: Math.min(H, y1 + my) - Math.max(0, y0 - my) };
  } else pdfImp.clip = { x: 0, y: 0, w: pdfImp.ext.W, h: pdfImp.ext.H };
  pdfImp.det = det;
  pdfRenderModal();
}
function pdfRenderModal() {
  const ext = pdfImp.ext, det = pdfImp.det, lot = curLot();
  const npg = pdfImp.doc.numPages;
  const existentes = lotesDo(lot.id);
  const porQ = {}; det.lotes.forEach(l => { porQ[l.quadra] = porQ[l.quadra] || { n: 0, inc: 0 }; porQ[l.quadra].n++; if (l.quadraIncerta) porQ[l.quadra].inc++; });
  const qs = Object.keys(porQ).sort(naturalCmp);
  const novos = det.lotes.filter(l => !existentes.find(e => e.quadra.toUpperCase() === l.quadra.toUpperCase() && String(e.numero) === l.numero)).length;
  const resumo = det.lotes.length ? `
    <div class="alert ok" style="cursor:default"><span><b>${det.lotes.length} lotes encontrados</b> em ${qs.length} quadra(s)${det.temTabela ? ' · áreas lidas do quadro de áreas' : ''}${det.semPoligono.length ? ` · <span style="color:#b45309">${det.semPoligono.length} número(s) sem contorno: ${esc(det.semPoligono.map(s => s.numero).join(', '))}</span>` : ''}</span></div>
    <div class="small muted mb">${qs.map(q => `<span class="badge ${porQ[q].inc ? 'pendente' : 'neutral'}" title="${porQ[q].inc ? porQ[q].inc + ' lote(s) com quadra incerta' : ''}">${esc(q)}: ${porQ[q].n}${det.esperado && det.esperado[q] ? '/' + det.esperado[q] : ''}${porQ[q].inc ? '?' : ''}</span>`).join(' ')}</div>
    <p class="help mb">${novos} lote(s) serão criados e ${det.lotes.length - novos} já existentes receberão a posição na planta. Quadras marcadas com <b>?</b> não tinham a letra dentro do bloco e foram deduzidas pela proximidade — confira depois na aba Lotes.</p>`
    : `<div class="alert warn" style="cursor:default"><span>Nenhum lote detectado automaticamente${det.erro ? ' (' + esc(det.erro) + ')' : ''}. A imagem da planta será importada e você poderá desenhar os lotes manualmente.</span></div>`;
  $('#modalBody').innerHTML = `
    ${npg > 1 ? `<div class="fg"><label>Página do PDF</label><select id="pdfPagina" onchange="pdfImp.pageNum=Number(this.value);pdfCarregarPagina()">${Array.from({ length: npg }, (_, i) => `<option value="${i + 1}" ${i + 1 === pdfImp.pageNum ? 'selected' : ''}>Página ${i + 1}</option>`).join('')}</select></div>` : ''}
    ${resumo}
    <div class="fg"><label>Área da planta que vai virar a imagem <span class="tiny muted">— arraste sobre a prévia para ajustar o recorte</span></label>
      <div id="pdfPrevWrap" style="position:relative;border:1px solid var(--border);border-radius:8px;overflow:hidden;background:#e2e8f0;user-select:none;touch-action:none"><canvas id="pdfPrev" style="display:block;width:100%"></canvas><div id="pdfCrop" style="position:absolute;border:2px dashed #2563eb;background:rgba(37,99,235,0.12);pointer-events:none"></div></div>
      <div class="btn-row" style="margin-top:8px"><button class="btn btn-secondary btn-sm" onclick="pdfClipAuto()">Recorte automático</button><button class="btn btn-secondary btn-sm" onclick="pdfClipTudo()">Página inteira</button></div></div>
    <div class="frow">
      <div class="fg"><label>Resolução da imagem</label><select id="pdfRes"><option value="3000">Normal (3000 px)</option><option value="4500" ${Cloud.active ? 'selected' : ''}>Alta (4500 px)</option><option value="6000">Máxima (6000 px)</option></select>${Cloud.active ? '' : '<div class="hint">No modo local a imagem é limitada a 2500 px para caber no armazenamento do navegador.</div>'}</div>
      <div class="fg"><label>Lotes</label><label class="check" style="margin-top:8px"><input type="checkbox" id="pdfDetect" ${det.lotes.length ? 'checked' : 'disabled'}> Cadastrar/posicionar automaticamente</label><label class="check"><input type="checkbox" id="pdfAreas" ${det.temTabela ? 'checked' : ''}> Atualizar áreas com as do PDF</label></div>
    </div>
    <div id="pdfProgresso" class="small muted"></div>`;
  $('#modalFoot').innerHTML = `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" id="pdfBtnImportar" onclick="pdfExecutarImportacao()">Importar</button>`;
  $('#modalFoot').style.display = 'flex';
  pdfDesenharClip();
  pdfRenderPreview().catch(e => { console.error(e); toast('⚠️', 'Falha na prévia', e.message || String(e), true); });
}
async function pdfRenderPreview() {
  const cv = $('#pdfPrev'); if (!cv) return;
  const wrap = $('#pdfPrevWrap'); const w = wrap.clientWidth || 700;
  const scale = Math.min(1, w / pdfImp.ext.W) * (window.devicePixelRatio > 1 ? 1.5 : 1);
  pdfImp.prev = { scale };
  await PlantaPDF.renderizar(pdfImp.page, scale, null, cv);
  // lotes detectados em verde
  const ctx = cv.getContext('2d'); const W = pdfImp.ext.W, H = pdfImp.ext.H;
  ctx.fillStyle = 'rgba(34,197,94,0.35)'; ctx.strokeStyle = 'rgba(21,128,61,0.8)'; ctx.lineWidth = 1;
  pdfImp.det.lotes.forEach(l => { ctx.beginPath(); l.pts.forEach((p, i) => { const x = p[0] * W * scale, y = p[1] * H * scale; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.fill(); ctx.stroke(); });
  pdfDesenharClip();
  wrap.onpointerdown = e => { const r = cv.getBoundingClientRect(); pdfImp.drag = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; wrap.setPointerCapture(e.pointerId); };
  wrap.onpointermove = e => { if (!pdfImp.drag) return; const r = cv.getBoundingClientRect(); const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)); const d = pdfImp.drag; pdfImp.clip = { x: Math.min(d.x, x) * W, y: Math.min(d.y, y) * H, w: Math.abs(x - d.x) * W, h: Math.abs(y - d.y) * H }; pdfDesenharClip(); };
  wrap.onpointerup = () => { if (pdfImp.drag && (pdfImp.clip.w < 20 || pdfImp.clip.h < 20)) pdfClipTudo(); pdfImp.drag = null; };
}
function pdfDesenharClip() { const c = pdfImp.clip, el = $('#pdfCrop'); if (!el) return; const W = pdfImp.ext.W, H = pdfImp.ext.H; el.style.left = (c.x / W * 100) + '%'; el.style.top = (c.y / H * 100) + '%'; el.style.width = (c.w / W * 100) + '%'; el.style.height = (c.h / H * 100) + '%'; }
function pdfClipTudo() { pdfImp.clip = { x: 0, y: 0, w: pdfImp.ext.W, h: pdfImp.ext.H }; pdfDesenharClip(); }
function pdfClipAuto() { const det = pdfImp.det; if (!det.lotes.length) { pdfClipTudo(); return; } const W = pdfImp.ext.W, H = pdfImp.ext.H; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; det.lotes.forEach(l => l.pts.forEach(p => { x0 = Math.min(x0, p[0] * W); y0 = Math.min(y0, p[1] * H); x1 = Math.max(x1, p[0] * W); y1 = Math.max(y1, p[1] * H); })); const mx = (x1 - x0) * 0.06, my = (y1 - y0) * 0.08; pdfImp.clip = { x: Math.max(0, x0 - mx), y: Math.max(0, y0 - my), w: Math.min(W, x1 + mx) - Math.max(0, x0 - mx), h: Math.min(H, y1 + my) - Math.max(0, y0 - my) }; pdfDesenharClip(); }

async function pdfExecutarImportacao() {
  const lot = curLot(); const btn = $('#pdfBtnImportar'); const prog = $('#pdfProgresso');
  const detectar = checked('pdfDetect'), atualizarAreas = checked('pdfAreas');
  let alvo = Number(val('pdfRes')) || 3000; if (!Cloud.active) alvo = Math.min(alvo, 2500);
  btn.disabled = true; btn.textContent = 'Importando…';
  try {
    const clip = pdfImp.clip; const scale = alvo / clip.w;
    prog.textContent = 'Renderizando a imagem…'; await new Promise(r => setTimeout(r, 30));
    const canvas = await PlantaPDF.renderizar(pdfImp.page, scale, clip);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    let img = dataUrl;
    if (Cloud.active) { prog.textContent = 'Enviando a imagem para a nuvem…'; img = await Cloud.uploadPlanta(lot.id, dataUrl); }
    else if (dataUrl.length > 3.5 * 1024 * 1024) throw new Error('Imagem grande demais para o modo local. Escolha uma resolução menor ou um recorte mais justo.');
    upsert('loteamentos', Object.assign({}, lot, { planta: { img, w: canvas.width, h: canvas.height, origem: 'pdf', arquivo: pdfImp.fileName } }));
    let criados = 0, posicionados = 0, areas = 0;
    if (detectar) {
      prog.textContent = 'Cadastrando lotes…'; await new Promise(r => setTimeout(r, 30));
      const det = PlantaPDF.detectar(pdfImp.ext, clip);
      const existentes = lotesDo(lot.id);
      det.lotes.forEach(l => {
        const ex = existentes.find(e => e.quadra.toUpperCase() === l.quadra.toUpperCase() && String(e.numero) === l.numero);
        const area = l.areaTabela || l.areaEstimada || 0;
        if (ex) {
          const upd = Object.assign({}, ex, { pts: l.pts });
          if (atualizarAreas && area) { upd.area = area; areas++; } else if (!num(ex.area) && area) upd.area = area;
          upsert('lotes', upd); posicionados++;
        } else {
          upsert('lotes', { id: genId(), loteamentoId: lot.id, quadra: l.quadra.toUpperCase(), numero: l.numero, area, frente: null, fundos: null, preco: 0, tipo: 'residencial', status: 'disponivel', obs: l.quadraIncerta ? 'Quadra deduzida automaticamente — confira' : '', matricula: '', pts: l.pts, criadoEm: new Date().toISOString() });
          criados++;
        }
      });
      logAct(`Planta importada do PDF (${pdfImp.fileName}): ${criados} lote(s) criados, ${posicionados} posicionados`);
    } else logAct(`Planta importada do PDF (${pdfImp.fileName})`);
    prefs.aModo = 'imagem'; savePrefs(); state.plantaAdmin = null;
    closeModal(); renderPlantaEditor();
    toast('✅', 'Planta importada', detectar ? `${criados} lote(s) criados · ${posicionados} posicionados${areas ? ' · ' + areas + ' áreas atualizadas' : ''}` : 'Agora desenhe os lotes sobre a planta.');
    if (criados) setTimeout(() => toast('💲', 'Defina os preços', 'Use "Reajustar preços" na aba Lotes para aplicar um valor por m².'), 1200);
  } catch (e) { console.error(e); btn.disabled = false; btn.textContent = 'Importar'; prog.textContent = ''; toast('⚠️', 'Falha na importação', e.message || String(e), true); }
}
