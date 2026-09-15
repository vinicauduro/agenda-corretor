/* ===== Gestão de Loteamento — importação de planta em PDF =====
   Renderiza a página como imagem e detecta os lotes (polígonos, números e quadras)
   a partir dos vetores e textos do PDF. Funciona no navegador (pdf.js) e em Node (testes). */
'use strict';

const PlantaPDF = {
  lib: null,
  async getLib() {
    if (this.lib) return this.lib;
    const m = await import('./vendor/pdf.js');
    m.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.js';
    this.lib = m; return m;
  },
  async abrir(data, lib) {
    lib = lib || await this.getLib();
    return lib.getDocument({ data, disableWorker: !!(typeof process !== 'undefined' && process.versions && process.versions.node) }).promise;
  },

  // ---------------------------------------------------------------- renderização
  // clip em unidades de viewport escala 1 (pontos, y para baixo). Retorna canvas.
  async renderizar(page, scale, clip, canvas) {
    const vp = page.getViewport({ scale });
    const c = clip ? { x: clip.x * scale, y: clip.y * scale, w: clip.w * scale, h: clip.h * scale } : { x: 0, y: 0, w: vp.width, h: vp.height };
    canvas = canvas || document.createElement('canvas');
    canvas.width = Math.round(c.w); canvas.height = Math.round(c.h);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const vp2 = page.getViewport({ scale, offsetX: -c.x, offsetY: -c.y });
    await page.render({ canvasContext: ctx, viewport: vp2 }).promise;
    return canvas;
  },

  // ---------------------------------------------------------------- extração de vetores e textos
  async extrair(page, lib) {
    lib = lib || this.lib;
    const OPS = lib.OPS, U = lib.Util;
    const vp = page.getViewport({ scale: 1 });
    const W = vp.width, H = vp.height;
    const tc = await page.getTextContent();
    const texts = [];
    tc.items.forEach(t => {
      const s = (t.str || '').trim(); if (!s) return;
      const size = Math.hypot(t.transform[0], t.transform[1]) || t.height || 0;
      const p0 = U.applyTransform([t.transform[4], t.transform[5]], vp.transform);
      const p1 = U.applyTransform([t.transform[4] + (t.width || 0), t.transform[5] + size * 0.7], vp.transform);
      texts.push({ str: s, size, x0: Math.min(p0[0], p1[0]), x1: Math.max(p0[0], p1[0]), y0: Math.min(p0[1], p1[1]), y1: Math.max(p0[1], p1[1]), cx: (p0[0] + p1[0]) / 2, cy: (p0[1] + p1[1]) / 2 });
    });
    const ol = await page.getOperatorList();
    const paths = [];
    let ctm = [1, 0, 0, 1, 0, 0]; const stack = []; let stroke = [0, 0, 0], fill = [0, 0, 0]; let pending = null;
    const toRGB = a => { if (!a) return [0, 0, 0]; if (typeof a[0] === 'string') { const h = a[0].replace('#', ''); return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]; } return a.length >= 3 ? [a[0] / 255, a[1] / 255, a[2] / 255] : [a[0] / 255, a[0] / 255, a[0] / 255]; };
    const map = (x, y) => { const p = U.applyTransform(U.applyTransform([x, y], ctm), vp.transform); return [p[0], p[1]]; };
    for (let i = 0; i < ol.fnArray.length; i++) {
      const f = ol.fnArray[i], a = ol.argsArray[i];
      if (f === OPS.save) stack.push(ctm);
      else if (f === OPS.restore) { if (stack.length) ctm = stack.pop(); }
      else if (f === OPS.transform) ctm = U.transform(ctm, a);
      else if (f === OPS.setStrokeRGBColor) stroke = toRGB(a);
      else if (f === OPS.setFillRGBColor) fill = toRGB(a);
      else if (f === OPS.setStrokeGray) stroke = [a[0], a[0], a[0]];
      else if (f === OPS.setFillGray) fill = [a[0], a[0], a[0]];
      else if (f === OPS.setStrokeCMYKColor) { const k = 1 - a[3]; stroke = [(1 - a[0]) * k, (1 - a[1]) * k, (1 - a[2]) * k]; }
      else if (f === OPS.constructPath) {
        const ops = a[0], co = a[1]; const subpaths = []; let cur = null; let k = 0;
        for (const op of ops) {
          if (op === OPS.moveTo) { cur = { pts: [map(co[k], co[k + 1])], closed: false }; subpaths.push(cur); k += 2; }
          else if (op === OPS.lineTo) { if (!cur) { cur = { pts: [], closed: false }; subpaths.push(cur); } cur.pts.push(map(co[k], co[k + 1])); k += 2; }
          else if (op === OPS.curveTo) { if (cur) cur.pts.push(map(co[k + 4], co[k + 5])); k += 6; }
          else if (op === OPS.curveTo2 || op === OPS.curveTo3) { if (cur) cur.pts.push(map(co[k + 2], co[k + 3])); k += 4; }
          else if (op === OPS.closePath) { if (cur) cur.closed = true; }
          else if (op === OPS.rectangle) { const x = co[k], y = co[k + 1], w = co[k + 2], h = co[k + 3]; subpaths.push({ pts: [map(x, y), map(x + w, y), map(x + w, y + h), map(x, y + h)], closed: true }); cur = null; k += 4; }
        }
        pending = subpaths;
      } else if (pending && (f === OPS.stroke || f === OPS.closeStroke || f === OPS.fillStroke || f === OPS.closeFillStroke || f === OPS.eoFillStroke || f === OPS.closeEOFillStroke)) {
        const closedAll = (f === OPS.closeStroke || f === OPS.closeFillStroke || f === OPS.closeEOFillStroke);
        pending.forEach(sp => { if (sp.pts.length >= 2) paths.push({ pts: sp.pts, closed: sp.closed || closedAll, color: stroke }); });
        pending = null;
      } else if (pending && (f === OPS.fill || f === OPS.eoFill || f === OPS.endPath)) pending = null;
    }
    return { W, H, texts, paths };
  },

  // ---------------------------------------------------------------- detecção de lotes
  detectar(ext, clip) {
    clip = clip || { x: 0, y: 0, w: ext.W, h: ext.H };
    const inClip = (x, y) => x >= clip.x && x <= clip.x + clip.w && y >= clip.y && y <= clip.y + clip.h;
    const texts = ext.texts.filter(t => inClip(t.cx, t.cy));
    // números de lote: inteiros de 1-3 dígitos no tamanho de fonte mais comum
    const ints = texts.filter(t => /^\d{1,3}$/.test(t.str));
    const bySize = {}; ints.forEach(t => { const k = Math.round(t.size * 10); bySize[k] = (bySize[k] || 0) + 1; });
    const sizeKey = Object.keys(bySize).sort((a, b) => bySize[b] - bySize[a])[0];
    if (!sizeKey) return { lotes: [], letras: [], semPoligono: [], erro: 'Nenhum número de lote encontrado nesta região.' };
    const numSize = Number(sizeKey) / 10;
    const nums = ints.filter(t => Math.abs(t.size - numSize) <= 0.15).map(t => ({ n: String(parseInt(t.str, 10)), x: t.cx, y: t.cy }));
    const letras = texts.filter(t => /^[A-Z]{1,2}$/.test(t.str) && t.size >= numSize * 0.9 && t.size <= numSize * 2.2).map(t => ({ l: t.str, x: t.cx, y: t.cy }));
    // segmentos e polígonos diretos (linhas pretas/cinza)
    const isGray = c => Math.max(...c) <= 0.78 && (Math.max(...c) - Math.min(...c)) <= 0.06;
    const segs = [], direct = [];
    ext.paths.forEach(p => {
      if (!isGray(p.color)) return;
      const pts = p.pts.filter(q => inClip(q[0], q[1]) || true);
      if (!pts.some(q => inClip(q[0], q[1]))) return;
      for (let i = 0; i + 1 < pts.length; i++) segs.push([pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]]);
      let poly = pts.slice();
      if (poly.length >= 4 && Math.hypot(poly[0][0] - poly[poly.length - 1][0], poly[0][1] - poly[poly.length - 1][1]) < 0.5) poly = poly.slice(0, -1);
      if (poly.length >= 3 && (p.closed || pts.length !== poly.length)) { segs.push([poly[poly.length - 1][0], poly[poly.length - 1][1], poly[0][0], poly[0][1]]); if (poly.length >= 4) direct.push(poly); }
    });
    const good = segs.filter(s => Math.hypot(s[2] - s[0], s[3] - s[1]) > 0.3);
    // divide nas interseções e junções em T
    const TOL = 0.35, cell = 40;
    const key = (x, y) => Math.round(x / TOL) + ',' + Math.round(y / TOL);
    const grid = new Map();
    good.forEach((s, i) => {
      const x0 = Math.min(s[0], s[2]), x1 = Math.max(s[0], s[2]), y0 = Math.min(s[1], s[3]), y1 = Math.max(s[1], s[3]);
      for (let gx = Math.floor(x0 / cell); gx <= Math.floor(x1 / cell); gx++) for (let gy = Math.floor(y0 / cell); gy <= Math.floor(y1 / cell); gy++) { const k = gx + ':' + gy; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); }
    });
    const cuts = good.map(() => new Set());
    const seen = new Set();
    const inter = (a, b) => {
      const [x1, y1, x2, y2] = a, [x3, y3, x4, y4] = b;
      const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4); if (Math.abs(den) < 1e-9) return null;
      const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den, u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;
      return (t >= -1e-6 && t <= 1 + 1e-6 && u >= -1e-6 && u <= 1 + 1e-6) ? [t, u] : null;
    };
    const tOn = (s, px, py) => { const dx = s[2] - s[0], dy = s[3] - s[1], L2 = dx * dx + dy * dy; if (!L2) return null; const t = ((px - s[0]) * dx + (py - s[1]) * dy) / L2; if (t <= 0.001 || t >= 0.999) return null; return Math.abs((px - s[0]) * dy - (py - s[1]) * dx) / Math.sqrt(L2) < TOL ? t : null; };
    for (const ids of grid.values()) {
      for (const i of ids) for (const j of ids) {
        if (j <= i) continue; const pk = i + '-' + j; if (seen.has(pk)) continue; seen.add(pk);
        const r = inter(good[i], good[j]); if (r) { cuts[i].add(+r[0].toFixed(6)); cuts[j].add(+r[1].toFixed(6)); }
        for (const [a, b] of [[i, j], [j, i]]) { for (const [px, py] of [[good[b][0], good[b][1]], [good[b][2], good[b][3]]]) { const t = tOn(good[a], px, py); if (t !== null) cuts[a].add(+t.toFixed(6)); } }
      }
    }
    const adj = new Map(); const coord = new Map();
    const addV = (k, x, y) => { if (!adj.has(k)) { adj.set(k, new Set()); coord.set(k, [Math.round(x / TOL) * TOL, Math.round(y / TOL) * TOL]); } };
    good.forEach((s, i) => {
      const ts = [0, 1, ...[...cuts[i]].filter(t => t > 0 && t < 1)].sort((a, b) => a - b);
      const pts = ts.map(t => [s[0] + t * (s[2] - s[0]), s[1] + t * (s[3] - s[1])]);
      for (let k = 0; k + 1 < pts.length; k++) { const ka = key(...pts[k]), kb = key(...pts[k + 1]); if (ka === kb) continue; addV(ka, ...pts[k]); addV(kb, ...pts[k + 1]); adj.get(ka).add(kb); adj.get(kb).add(ka); }
    });
    let changed = true;
    while (changed) { changed = false; for (const [v, nb] of adj) { if (nb.size <= 1) { for (const u of nb) adj.get(u).delete(v); adj.delete(v); changed = true; } } }
    const ang = (a, b) => { const pa = coord.get(a), pb = coord.get(b); return Math.atan2(pb[1] - pa[1], pb[0] - pa[0]); };
    const order = new Map(); for (const [v, nb] of adj) order.set(v, [...nb].sort((p, q) => ang(v, p) - ang(v, q)));
    const used = new Set(); const faces = [];
    for (const [v, nb] of adj) for (const u of nb) {
      if (used.has(v + '>' + u)) continue;
      const face = []; let a = v, b = u, guard = 0;
      while (!used.has(a + '>' + b) && guard++ < 2000) { used.add(a + '>' + b); face.push(a); const o = order.get(b); const i = o.indexOf(a); const c = o[(i - 1 + o.length) % o.length]; a = b; b = c; }
      if (face.length >= 3) faces.push(face.map(k => coord.get(k)));
    }
    const area = p => Math.abs(p.reduce((s, q, i) => { const r = p[(i + 1) % p.length]; return s + q[0] * r[1] - r[0] * q[1]; }, 0) / 2);
    const inside = (x, y, poly) => { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi) ins = !ins; } return ins; };
    const polys = [...direct, ...faces].map(p => ({ p, a: area(p), bb: [Math.min(...p.map(q => q[0])), Math.min(...p.map(q => q[1])), Math.max(...p.map(q => q[0])), Math.max(...p.map(q => q[1]))] })).filter(o => o.a > 1);
    // cada número → menor polígono que o contém sem outro número dentro
    const found = []; const semPoligono = [];
    for (const n of nums) {
      const cands = polys.filter(o => n.x >= o.bb[0] && n.x <= o.bb[2] && n.y >= o.bb[1] && n.y <= o.bb[3] && inside(n.x, n.y, o.p)).sort((a, b) => a.a - b.a);
      let pick = null;
      for (const c of cands) { if (!nums.some(m => m !== n && m.x >= c.bb[0] && m.x <= c.bb[2] && m.y >= c.bb[1] && m.y <= c.bb[3] && inside(m.x, m.y, c.p))) { pick = c; break; } if (c.a > (cands[0].a * 4)) break; }
      if (pick) found.push({ numero: n.n, pts: pick.p, areaPt: pick.a, x: n.x, y: n.y }); else semPoligono.push({ numero: n.n, x: n.x, y: n.y });
    }
    if (!found.length) return { lotes: [], letras, semPoligono, erro: 'Não foi possível encontrar os contornos dos lotes.' };
    const med = found.map(f => f.areaPt).sort((a, b) => a - b)[Math.floor(found.length / 2)];
    const lotes = found.filter(f => f.areaPt < med * 25 && f.areaPt > med / 25);
    found.filter(f => !lotes.includes(f)).forEach(f => semPoligono.push({ numero: f.numero, x: f.x, y: f.y }));
    // quadras: componentes conexas de lotes que compartilham vértices
    const parent = lotes.map((_, i) => i); const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    const vmap = new Map();
    lotes.forEach((l, i) => l.pts.forEach(q => { const k = key(q[0], q[1]); if (!vmap.has(k)) vmap.set(k, []); vmap.get(k).push(i); }));
    for (const ids of vmap.values()) for (let i = 1; i < ids.length; i++) parent[find(ids[i])] = find(ids[0]);
    const comps = new Map(); lotes.forEach((l, i) => { const r = find(i); if (!comps.has(r)) comps.set(r, []); comps.get(r).push(i); });
    const quadrasSemLetra = [];
    let ci = 0;
    for (const ids of comps.values()) {
      ci++;
      let letra = null;
      const cx0 = ids.reduce((s, i) => s + lotes[i].x, 0) / ids.length, cy0 = ids.reduce((s, i) => s + lotes[i].y, 0) / ids.length;
      const freq = {}; letras.forEach(L => { freq[L.l] = (freq[L.l] || 0) + 1; });
      const dentro = letras.filter(L => ids.some(i => inside(L.x, L.y, lotes[i].pts))).sort((p, q) => (Math.hypot(p.x - cx0, p.y - cy0) - Math.hypot(q.x - cx0, q.y - cy0)) || (freq[p.l] - freq[q.l]));
      if (dentro.length > 1) { // quadras coladas sem rua entre elas: cada lote vai para a letra mais próxima
        ids.forEach(i => { const L = dentro.slice().sort((p, q) => Math.hypot(p.x - lotes[i].x, p.y - lotes[i].y) - Math.hypot(q.x - lotes[i].x, q.y - lotes[i].y))[0]; lotes[i].quadra = L.l; lotes[i].quadraIncerta = false; });
        continue;
      }
      if (dentro.length) letra = dentro[0].l;
      let incerto = false;
      if (!letra && letras.length) {
        const cx = ids.reduce((s, i) => s + lotes[i].x, 0) / ids.length, cy = ids.reduce((s, i) => s + lotes[i].y, 0) / ids.length;
        letra = letras.slice().sort((p, q) => Math.hypot(p.x - cx, p.y - cy) - Math.hypot(q.x - cx, q.y - cy))[0].l; incerto = true;
      }
      if (!letra) { letra = 'Q' + ci; incerto = true; quadrasSemLetra.push(letra); }
      ids.forEach(i => { lotes[i].quadra = letra; lotes[i].quadraIncerta = incerto; });
    }
    // tabela de áreas (opcional)
    const tabela = this.lerTabelaAreas(ext.texts);
    let ptPorM = null;
    if (tabela.size) {
      const pares = lotes.map(l => [l.areaPt, tabela.get(l.quadra + '-' + l.numero)]).filter(p => p[1] > 0);
      if (pares.length) { const r = pares.map(p => Math.sqrt(p[0] / p[1])).sort((a, b) => a - b); ptPorM = r[Math.floor(r.length / 2)]; }
    }
    lotes.forEach(l => {
      l.areaTabela = tabela.get(l.quadra + '-' + l.numero) || null;
      l.areaEstimada = ptPorM ? Math.round(l.areaPt / (ptPorM * ptPorM) * 100) / 100 : null;
      l.pts = l.pts.map(q => [Math.round((q[0] - clip.x) / clip.w * 10000) / 10000, Math.round((q[1] - clip.y) / clip.h * 10000) / 10000]);
      delete l.x; delete l.y;
    });
    const esperado = {}; for (const k of tabela.keys()) { const q = k.split('-')[0]; esperado[q] = (esperado[q] || 0) + 1; }
    return { lotes, letras: letras.map(L => L.l), semPoligono, quadrasSemLetra, esperado, temTabela: tabela.size > 0, ptPorM };
  },

  // Lê o "quadro de áreas": linhas "LOTE nn | área" agrupadas pelo cabeçalho "QUADRA X" acima.
  lerTabelaAreas(texts) {
    const rows = []; const headers = [];
    const areaRe = /^\d{1,3}(\.\d{3})*,\d{2}$/;
    const numAt = s => parseFloat(s.replace(/\./g, '').replace(',', '.'));
    texts.forEach((t, i) => {
      let m = /^LOTE\s*(\d{1,3})$/i.exec(t.str); let numero = m ? m[1] : null; let x1 = t.x1;
      if (!numero && /^LOTE$/i.test(t.str)) { const nx = texts.find(u => u !== t && Math.abs(u.cy - t.cy) < 2 && u.x0 >= t.x1 - 1 && u.x0 - t.x1 < 40 && /^\d{1,3}$/.test(u.str)); if (nx) { numero = nx.str; x1 = nx.x1; } }
      if (!numero) { const h = /^QUADRA\s*([A-Z]{1,2}|\d{1,3})$/i.exec(t.str); if (h) headers.push({ q: h[1].toUpperCase(), x: t.cx, y: t.cy, x0: t.x0, x1: t.x1 }); else if (/^QUADRA$/i.test(t.str)) { const nx = texts.find(u => u !== t && Math.abs(u.cy - t.cy) < 2 && u.x0 >= t.x1 - 1 && u.x0 - t.x1 < 30 && /^([A-Z]{1,2}|\d{1,3})$/.test(u.str)); if (nx) headers.push({ q: nx.str.toUpperCase(), x: (t.x0 + nx.x1) / 2, y: t.cy, x0: t.x0, x1: nx.x1 }); } return; }
      const ar = texts.filter(u => Math.abs(u.cy - t.cy) < 2.5 && u.x0 >= x1 - 1 && u.x0 - x1 < 120 && areaRe.test(u.str)).sort((a, b) => a.x0 - b.x0)[0];
      if (ar) rows.push({ numero: String(parseInt(numero, 10)), area: numAt(ar.str), x: t.cx, y: t.cy });
    });
    const tab = new Map();
    rows.forEach(r => {
      const hs = headers.filter(h => h.y < r.y && r.x >= h.x0 - 60 && r.x <= h.x1 + 60).sort((a, b) => (Math.abs(r.x - a.x) + (r.y - a.y) * 0.05) - (Math.abs(r.x - b.x) + (r.y - b.y) * 0.05));
      if (hs.length) tab.set(hs[0].q + '-' + r.numero, r.area);
    });
    return tab;
  }
};
if (typeof module !== 'undefined') module.exports = PlantaPDF;
