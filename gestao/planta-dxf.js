/* ===== Gestão de Loteamento — importação de planta em DXF (AutoCAD) =====
   Lê o DXF em texto, monta o mesmo formato de extração usado pelo PDF (textos e caminhos
   num espaço de desenho) e desenha a planta num canvas. Funciona no navegador e em Node. */
'use strict';

const PlantaDXF = {
  // cores ACI mais comuns
  ACI: { 1: '#d32f2f', 2: '#c9a100', 3: '#2e7d32', 4: '#0097a7', 5: '#1565c0', 6: '#ad1457', 7: '#111111', 8: '#555555', 9: '#9e9e9e', 30: '#ef6c00', 40: '#f9a825', 50: '#9e9d24', 90: '#2e7d32', 150: '#1976d2', 250: '#333333', 251: '#666666', 252: '#888888', 253: '#aaaaaa', 254: '#cccccc' },

  // ---------------------------------------------------------------- parser
  parse(text) {
    const lines = text.split(/\r\n|\n|\r/);
    const n = lines.length;
    const ents = [], layers = {}; let units = 0;
    let i = 0;
    const read = () => { if (i + 1 >= n) return null; const code = parseInt(lines[i].trim(), 10); const val = lines[i + 1]; i += 2; return isNaN(code) ? null : [code, val]; };
    let section = null, cur = null, inTable = null, layer = null, poly = null;
    const finish = () => { if (cur) { ents.push(cur); cur = null; } };
    while (i + 1 < n) {
      const p = read(); if (!p) continue;
      const [code, raw] = p; const val = raw.trim();
      if (code === 0) {
        if (val === 'SECTION') { section = null; continue; }
        if (val === 'ENDSEC') { if (section === 'ENTITIES') finish(); cur = null; section = null; continue; }
        if (val === 'EOF') break;
        if (section === 'TABLES') { if (layer && layer.name) layers[layer.name] = layer; layer = null; if (val === 'TABLE') inTable = null; else if (val === 'LAYER' && inTable === 'LAYER') layer = {}; else if (val === 'ENDTAB') inTable = null; continue; }
        if (section === 'ENTITIES') {
          if (val === 'VERTEX' && poly) { cur = { type: 'VERTEX', parent: poly }; continue; }
          if (val === 'SEQEND') { finish(); if (poly) { ents.push(poly); poly = null; } continue; }
          finish();
          if (val === 'POLYLINE') { poly = { type: 'LWPOLYLINE', pts: [], layer: '0', flags: 0 }; cur = poly; continue; }
          cur = { type: val, layer: '0', pts: [], text: '' };
          if (val === 'LWPOLYLINE') cur.flags = 0;
        }
        continue;
      }
      if (section === null && code === 2 && (val === 'HEADER' || val === 'TABLES' || val === 'BLOCKS' || val === 'ENTITIES' || val === 'OBJECTS' || val === 'CLASSES')) { section = val; continue; }
      if (section === 'HEADER') { if (code === 9) cur = { hdr: val }; else if (cur && cur.hdr === '$INSUNITS' && code === 70) { units = parseInt(val, 10) || 0; cur = null; } continue; }
      if (section === 'TABLES') { if (code === 2 && !inTable && !layer) inTable = val; if (layer) { if (code === 2) layer.name = val; else if (code === 62) layer.color = parseInt(val, 10); } continue; }
      if (section !== 'ENTITIES' || !cur) continue;
      const e = cur.type === 'VERTEX' ? cur : cur;
      if (cur.type === 'VERTEX') { if (code === 10) cur.parent.pts.push([parseFloat(val), 0]); else if (code === 20) { const q = cur.parent.pts[cur.parent.pts.length - 1]; if (q) q[1] = parseFloat(val); } continue; }
      switch (code) {
        case 8: e.layer = val; break;
        case 62: e.color = parseInt(val, 10); break;
        case 10: { const x = parseFloat(val); if (Number.isFinite(x)) e.pts.push([x, 0]); break; }
        case 20: { const q = e.pts[e.pts.length - 1]; if (q) q[1] = parseFloat(val); break; }
        case 11: e.p2 = [parseFloat(val), 0]; break;
        case 21: if (e.p2) e.p2[1] = parseFloat(val); break;
        case 40: e.r = parseFloat(val); break;   // raio (CIRCLE/ARC) ou altura (TEXT/MTEXT)
        case 50: e.a1 = parseFloat(val); break;
        case 51: e.a2 = parseFloat(val); break;
        case 70: if (e.type === 'LWPOLYLINE') e.flags = parseInt(val, 10) || 0; else if (e.type === 'POLYLINE') e.flags = parseInt(val, 10) || 0; break;
        case 71: e.attach = parseInt(val, 10); break;
        case 72: e.halign = parseInt(val, 10); break;
        case 1: e.text += raw; break;
        case 3: e.text = raw + e.text; break;
      }
    }
    finish();
    return { ents, layers, units };
  },
  decodificar(buf) { // DXF salvo em ANSI (Windows-1252) ou UTF-8
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const head = new TextDecoder('latin1').decode(bytes.subarray(0, Math.min(bytes.length, 200000)));
    const m = /\$DWGCODEPAGE\s*\r?\n\s*3\s*\r?\n\s*([^\r\n]+)/i.exec(head);
    const cp = m ? m[1].trim().toUpperCase() : '';
    if (/UTF/.test(cp)) return new TextDecoder('utf-8').decode(bytes);
    if (/1252|ANSI|ISO/.test(cp)) return new TextDecoder('windows-1252').decode(bytes);
    const utf = new TextDecoder('utf-8').decode(bytes);
    return utf.includes('\uFFFD') ? new TextDecoder('windows-1252').decode(bytes) : utf;
  },
  plainText(s) { return String(s || '').replace(/\\P/g, ' ').replace(/\\[A-Za-z][^;]*;/g, '').replace(/[{}]/g, '').replace(/%%[cdpCDP]/g, '').trim(); },
  unitsToM(u) { return { 1: 0.0254, 2: 0.3048, 3: 1609.34, 4: 0.001, 5: 0.01, 6: 1, 7: 1000, 8: 2.54e-5, 9: 2.54e-8 }[u] || 1; },

  // ---------------------------------------------------------------- camadas e rotação
  camadas(dxf) {
    const info = {};
    dxf.ents.forEach(e => { const c = info[e.layer] = info[e.layer] || { name: e.layer, total: 0, util: 0 }; c.total++; if (['LWPOLYLINE', 'LINE', 'TEXT', 'MTEXT', 'CIRCLE', 'ARC'].includes(e.type)) c.util++; });
    const ruim = /curva|ponto|triang|cota|malha|estudo|topo|imagem|viewport|folha|selo|legenda|drenagem|eixo|grid/i;
    return Object.values(info).sort((a, b) => b.total - a.total).map(c => ({ name: c.name, total: c.total, on: c.util > 0 && (c.total - c.util) / c.total < 0.9 && !ruim.test(c.name) }));
  },
  anguloAuto(polys) { // ângulo (graus) que deixa a maioria das divisas dos lotes alinhada aos eixos
    const bins = new Array(90).fill(0);
    polys.forEach(e => { const p = e.pts; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-6) continue; let d = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI; d = ((d % 90) + 90) % 90; bins[Math.round(d) % 90] += L; } });
    let best = 0; for (let i = 0; i < 90; i++) { const v = bins[(i + 89) % 90] + bins[i] * 2 + bins[(i + 1) % 90]; if (v > best) { best = v; this._ang = i; } }
    return this._ang || 0;
  },
  rotator(angDeg, cx, cy) { const r = angDeg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return q => [cx + (q[0] - cx) * c - (q[1] - cy) * s, cy + (q[0] - cx) * s + (q[1] - cy) * c]; },

  // ---------------------------------------------------------------- extração (mesmo formato do PDF)
  extrair(dxf, opts = {}) {
    const fator = this.unitsToM(dxf.units);
    const on = opts.layers ? (l => opts.layers.has(l)) : (() => true);
    const ents = dxf.ents.filter(e => on(e.layer));
    const closedPolys = ents.filter(e => e.type === 'LWPOLYLINE' && (e.flags & 1) && e.pts.length >= 3);
    // extensão: caixa das polilinhas fechadas com área de lote (evita carimbos e mapas de situação distantes)
    const area = p => Math.abs(p.reduce((s, q, i) => { const r = p[(i + 1) % p.length]; return s + q[0] * r[1] - r[0] * q[1]; }, 0) / 2);
    const lotLike = closedPolys.filter(e => { const a = area(e.pts) * fator * fator; return a > 80 && a < 5000; });
    // camada dominante de lotes: a extensão do desenho é a dela (ignora cópias antigas da planta espalhadas pelo arquivo)
    const byLayer0 = {}; lotLike.forEach(e => { byLayer0[e.layer] = (byLayer0[e.layer] || 0) + 1; });
    const lotLayer0 = Object.keys(byLayer0).sort((a, b) => byLayer0[b] - byLayer0[a])[0] || null;
    const domin = lotLayer0 && byLayer0[lotLayer0] >= 10 ? lotLike.filter(e => e.layer === lotLayer0) : lotLike;
    const base = domin.length >= 5 ? domin : ents.filter(e => e.pts.length);
    if (!base.length) throw new Error('Nenhuma geometria encontrada no DXF.');
    // rotação: automática (alinha as divisas aos eixos, preferindo paisagem) ou informada
    let cx = 0, cy = 0, np = 0; base.forEach(e => e.pts.forEach(q => { cx += q[0]; cy += q[1]; np++; })); cx /= np; cy /= np;
    let ang = opts.angle;
    if (ang == null) {
      const a0 = this.anguloAuto(domin.length >= 5 ? domin : closedPolys);
      const ext = a => { const R = this.rotator(-a, cx, cy); let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity; base.forEach(e => e.pts.forEach(q => { const r = R(q); bx0 = Math.min(bx0, r[0]); bx1 = Math.max(bx1, r[0]); by0 = Math.min(by0, r[1]); by1 = Math.max(by1, r[1]); })); return (bx1 - bx0) / (by1 - by0); };
      ang = ext(a0) >= ext(a0 - 90) ? a0 : a0 - 90; // prefere paisagem (mais largo que alto)
    }
    const R = this.rotator(-ang, cx, cy);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    base.forEach(e => e.pts.forEach(q => { const r = R(q); x0 = Math.min(x0, r[0]); y0 = Math.min(y0, r[1]); x1 = Math.max(x1, r[0]); y1 = Math.max(y1, r[1]); }));
    const mx = (x1 - x0) * 0.15, my = (y1 - y0) * 0.15; x0 -= mx; x1 += mx; y0 -= my; y1 += my;
    let s = 3 / fator; // 3 unidades de desenho por metro (semelhante ao PDF)
    if ((x1 - x0) * s > 16000 || (y1 - y0) * s > 16000) s = 16000 / Math.max(x1 - x0, y1 - y0);
    const W = (x1 - x0) * s, H = (y1 - y0) * s;
    const map = q => { const r = R(q); return [(r[0] - x0) * s, (y1 - r[1]) * s]; };
    const inBox = q => { const r = R(q); return r[0] >= x0 && r[0] <= x1 && r[1] >= y0 && r[1] <= y1; };
    const texts = [], paths = [];
    // segmentos absurdamente longos (linhas de limite que vêm de fora e cruzam a planta) só sujam o desenho
    const diag = Math.hypot(x1 - x0, y1 - y0);
    const fatia = (pts, closed) => { // parte a polilinha nas arestas longas demais
      const out = []; let cur = [];
      const n = pts.length, m = closed ? n + 1 : n;
      for (let i = 0; i < m; i++) { const q = pts[i % n]; if (cur.length) { const a = cur[cur.length - 1]; if (Math.hypot(q[0] - a[0], q[1] - a[1]) > diag) { if (cur.length > 1) out.push(cur); cur = []; } } cur.push(q); }
      if (cur.length > 1) out.push(cur);
      return out.length === 1 && out[0].length === m ? [{ pts: pts, closed }] : out.map(pts => ({ pts, closed: false }));
    };
    const cor = e => { const c = (e.color && e.color !== 256) ? e.color : (dxf.layers[e.layer] && dxf.layers[e.layer].color); return this.ACI[Math.abs(c)] || '#333333'; };
    const toRGB = hex => [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255];
    ents.forEach(e => {
      if (e.type === 'TEXT' || e.type === 'MTEXT') {
        const str = this.plainText(e.text); if (!str) return;
        const ins = (e.type === 'TEXT' && e.p2 && e.halign) ? e.p2 : e.pts[0]; if (!ins || !inBox(ins)) return;
        const h = (e.r || 1) * s; const w = str.length * h * 0.6;
        const p = map(ins);
        let x0t = p[0], y1t = p[1], y0t = p[1] - h; // TEXT: canto inferior esquerdo
        if (e.type === 'MTEXT') { const at = e.attach || 1; y0t = p[1]; y1t = p[1] + h; if ([2, 5, 8].includes(at)) x0t -= w / 2; if ([3, 6, 9].includes(at)) x0t -= w; if ([4, 5, 6].includes(at)) { y0t -= h / 2; y1t -= h / 2; } if ([7, 8, 9].includes(at)) { y0t -= h; y1t -= h; } }
        else if (e.halign === 1 || e.halign === 4) { x0t -= w / 2; } else if (e.halign === 2) { x0t -= w; }
        texts.push({ str, size: h, x0: x0t, x1: x0t + w, y0: y0t, y1: y1t, cx: x0t + w / 2, cy: (y0t + y1t) / 2, layer: e.layer, color: cor(e) });
      } else if (e.type === 'LWPOLYLINE') {
        if (e.pts.length < 2 || !e.pts.some(inBox)) return;
        fatia(e.pts, !!(e.flags & 1)).forEach(f => paths.push({ pts: f.pts.map(map), closed: f.closed, color: toRGB('#000000'), hex: cor(e), layer: e.layer }));
      } else if (e.type === 'LINE') {
        if (!e.pts[0] || !e.p2 || !(inBox(e.pts[0]) || inBox(e.p2))) return;
        if (Math.hypot(e.p2[0] - e.pts[0][0], e.p2[1] - e.pts[0][1]) > diag) return;
        paths.push({ pts: [map(e.pts[0]), map(e.p2)], closed: false, color: toRGB('#000000'), hex: cor(e), layer: e.layer });
      } else if (e.type === 'CIRCLE' || e.type === 'ARC') {
        if (!e.pts[0] || !e.r || !inBox(e.pts[0])) return;
        const a1 = e.type === 'ARC' ? (e.a1 || 0) : 0, a2 = e.type === 'ARC' ? (e.a2 == null ? 360 : e.a2) : 360;
        let span = a2 - a1; if (span <= 0) span += 360; const nseg = Math.max(8, Math.round(span / 10));
        const pts = []; for (let k = 0; k <= nseg; k++) { const ang = (a1 + span * k / nseg) * Math.PI / 180; pts.push(map([e.pts[0][0] + e.r * Math.cos(ang), e.pts[0][1] + e.r * Math.sin(ang)])); }
        paths.push({ pts, closed: e.type === 'CIRCLE', color: toRGB('#000000'), hex: cor(e), layer: e.layer, circle: e.type === 'CIRCLE' });
      }
    });
    // camada dominante de lotes (polilinhas fechadas com área de lote)
    const byLayer = {}; lotLike.forEach(e => { byLayer[e.layer] = (byLayer[e.layer] || 0) + 1; });
    const lotLayer = Object.keys(byLayer).sort((a, b) => byLayer[b] - byLayer[a])[0] || null;
    return { W, H, texts, paths, ptPorM: s * fator, lotLayer, unidades: dxf.units, angulo: Math.round(ang * 10) / 10 };
  },

  // ---------------------------------------------------------------- desenho em canvas
  renderizar(ext, scale, clip, canvas) {
    const c = clip ? { x: clip.x * scale, y: clip.y * scale, w: clip.w * scale, h: clip.h * scale } : { x: 0, y: 0, w: ext.W * scale, h: ext.H * scale };
    canvas = canvas || document.createElement('canvas');
    canvas.width = Math.round(c.w); canvas.height = Math.round(c.h);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.translate(-c.x, -c.y); ctx.scale(scale, scale);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const vis = p => p.pts.some(q => q[0] * scale >= c.x - 50 && q[0] * scale <= c.x + c.w + 50 && q[1] * scale >= c.y - 50 && q[1] * scale <= c.y + c.h + 50);
    // caminhos: primeiro os demais, por cima os lotes
    const desenha = p => { ctx.beginPath(); p.pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); if (p.closed) ctx.closePath(); ctx.stroke(); };
    ext.paths.filter(p => p.layer !== ext.lotLayer && vis(p)).forEach(p => { ctx.strokeStyle = p.hex && p.hex !== '#111111' ? p.hex : '#8a8a8a'; ctx.lineWidth = 0.5 / scale + 0.3; desenha(p); });
    ext.paths.filter(p => p.layer === ext.lotLayer && vis(p)).forEach(p => { ctx.strokeStyle = '#111111'; ctx.lineWidth = 0.8 / scale + 0.6; desenha(p); });
    // textos (ignora os minúsculos, tipo cotas de pontos)
    const sizes = ext.texts.filter(t => /^\d{1,3}$/.test(t.str)).map(t => t.size).sort((a, b) => a - b);
    const minSize = sizes.length ? sizes[Math.floor(sizes.length * 0.5)] * 0.55 : 0;
    ext.texts.filter(t => t.size >= minSize && vis({ pts: [[t.cx, t.cy]] })).forEach(t => {
      ctx.font = `${Math.max(0.5, t.size * 0.95)}px system-ui, sans-serif`; ctx.fillStyle = t.color && t.color !== '#111111' ? t.color : '#333333'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(t.str, t.x0, t.y1);
    });
    ctx.restore();
    return canvas;
  }
};
if (typeof module !== 'undefined') module.exports = PlantaDXF;
