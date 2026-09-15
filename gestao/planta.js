/* ===== Gestão de Loteamento — planta interativa (SVG) ===== */
'use strict';

const SVG_NS = 'http://www.w3.org/2000/svg';

class PlantaView {
  /**
   * opts: { onLotClick(id), onShape(ptsNormalizados), editable }
   */
  constructor(container, opts = {}) {
    this.c = container;
    this.opts = opts;
    this.tool = 'select';        // select | rect | poly
    this.mode = 'esquema';       // imagem | esquema
    this.vb = null;              // viewBox atual {x,y,w,h}
    this.W = 1000; this.H = 700;
    this.pointers = new Map();
    this.drawPts = [];           // pontos do polígono em desenho (coords svg)
    this.rectStart = null;
    this.selectedId = null;
    this.highlightIds = null;    // Set de ids a destacar (filtro)
    this.lastKey = '';
    this.build();
  }

  build() {
    this.c.classList.add('planta-wrap');
    this.c.innerHTML = '';
    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.setAttribute('class', 'planta-svg');
    this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    this.gBase = document.createElementNS(SVG_NS, 'g');
    this.gLotes = document.createElementNS(SVG_NS, 'g');
    this.gDraw = document.createElementNS(SVG_NS, 'g');
    this.svg.append(this.gBase, this.gLotes, this.gDraw);
    this.c.appendChild(this.svg);

    const ctrls = document.createElement('div');
    ctrls.className = 'planta-ctrls';
    ctrls.innerHTML = `<button title="Aproximar" data-act="in">+</button><button title="Afastar" data-act="out">−</button><button title="Enquadrar" data-act="fit">⛶</button>`;
    ctrls.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.act === 'in') this.zoomBy(1.4);
      else if (b.dataset.act === 'out') this.zoomBy(1 / 1.4);
      else this.resetView();
    });
    this.c.appendChild(ctrls);
    this.hint = document.createElement('div');
    this.hint.className = 'planta-hint';
    this.hint.style.display = 'none';
    this.c.appendChild(this.hint);
    this.emptyBox = document.createElement('div');
    this.emptyBox.className = 'planta-empty';
    this.emptyBox.style.display = 'none';
    this.c.appendChild(this.emptyBox);

    this.svg.addEventListener('pointerdown', e => this.onDown(e));
    this.svg.addEventListener('pointermove', e => this.onMove(e));
    this.svg.addEventListener('pointerup', e => this.onUp(e));
    this.svg.addEventListener('pointercancel', e => this.onUp(e));
    this.svg.addEventListener('wheel', e => { e.preventDefault(); const p = this.toSvg(e); this.zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, p.x, p.y); }, { passive: false });
    this.svg.addEventListener('dblclick', e => { if (this.tool === 'poly' && this.drawPts.length >= 3) this.finishPoly(); });
  }

  setHint(text) { this.hint.style.display = text ? '' : 'none'; this.hint.textContent = text || ''; }

  // ------------------------------------------------ dados
  setData(loteamento, lotes, mode) {
    this.lot = loteamento; this.lotes = lotes || [];
    const hasImg = !!(loteamento && loteamento.planta && loteamento.planta.img);
    if (mode) this.mode = mode;
    if (!hasImg) this.mode = 'esquema';
    if (this.mode === 'imagem') { this.W = loteamento.planta.w; this.H = loteamento.planta.h; }
    else {
      // em telas estreitas (retrato) usa menos lotes por linha para aproveitar a altura
      const rect = this.svg.getBoundingClientRect();
      const perRow = rect.width && rect.height && rect.width < rect.height ? 5 : 10;
      this.esq = this.layoutEsquema(this.lotes, perRow); this.W = this.esq.W; this.H = this.esq.H;
    }
    const key = (loteamento ? loteamento.id : '') + '|' + this.mode + '|' + this.W + 'x' + this.H;
    if (key !== this.lastKey || !this.vb) { this.lastKey = key; this.resetView(); }
    this.render();
  }

  layoutEsquema(lotes, perRow = 10) {
    const cellW = 110, cellH = 70, gap = 8, blockPad = 14, blockGap = 34, titleH = 30;
    const groups = {};
    lotes.forEach(l => { (groups[l.quadra] = groups[l.quadra] || []).push(l); });
    const quadras = Object.keys(groups).sort(naturalCmp);
    const pts = new Map(); const blocks = [];
    let y = 20, W = 0;
    quadras.forEach(q => {
      const ls = groups[q].slice().sort(cmpLote);
      const cols = Math.min(perRow, ls.length);
      const rows = Math.ceil(ls.length / perRow);
      const bw = cols * cellW + (cols - 1) * gap + blockPad * 2;
      const bh = titleH + rows * cellH + (rows - 1) * gap + blockPad * 2;
      blocks.push({ nome: q, x: 20, y, w: bw, h: bh, n: ls.length });
      ls.forEach((l, i) => {
        const r = Math.floor(i / perRow), c = i % perRow;
        const x0 = 20 + blockPad + c * (cellW + gap), y0 = y + titleH + blockPad + r * (cellH + gap);
        pts.set(l.id, [[x0, y0], [x0 + cellW, y0], [x0 + cellW, y0 + cellH], [x0, y0 + cellH]]);
      });
      W = Math.max(W, bw + 40);
      y += bh + blockGap;
    });
    return { W: Math.max(W, 400), H: Math.max(y, 300), pts, blocks };
  }

  absPts(l) {
    if (this.mode === 'imagem') return (l.pts && l.pts.length >= 3) ? l.pts.map(p => [p[0] * this.W, p[1] * this.H]) : null;
    return this.esq.pts.get(l.id) || null;
  }
  static bbox(pts) {
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y, cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2 };
  }
  static centroid(pts) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
      const f = x0 * y1 - x1 * y0; a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
    }
    if (Math.abs(a) < 1e-6) return PlantaView.bbox(pts);
    a *= 0.5; return { cx: cx / (6 * a), cy: cy / (6 * a) };
  }

  // ------------------------------------------------ render
  render() {
    const svg = this.svg;
    this.gBase.innerHTML = ''; this.gLotes.innerHTML = '';
    svg.classList.toggle('tool-rect', this.tool === 'rect');
    svg.classList.toggle('tool-poly', this.tool === 'poly');
    const noLotes = !this.lotes.length;
    this.emptyBox.style.display = (noLotes && this.mode === 'esquema') ? '' : 'none';
    this.emptyBox.textContent = noLotes ? 'Nenhum lote cadastrado neste loteamento ainda.' : '';

    if (this.mode === 'imagem') {
      const img = document.createElementNS(SVG_NS, 'image');
      img.setAttribute('href', this.lot.planta.img);
      img.setAttribute('x', 0); img.setAttribute('y', 0);
      img.setAttribute('width', this.W); img.setAttribute('height', this.H);
      img.setAttribute('preserveAspectRatio', 'none');
      this.gBase.appendChild(img);
    } else {
      const bg = document.createElementNS(SVG_NS, 'rect');
      bg.setAttribute('x', 0); bg.setAttribute('y', 0); bg.setAttribute('width', this.W); bg.setAttribute('height', this.H); bg.setAttribute('fill', '#dbe4ee');
      this.gBase.appendChild(bg);
      this.esq.blocks.forEach(b => {
        const r = document.createElementNS(SVG_NS, 'rect');
        r.setAttribute('class', 'quadra-block'); r.setAttribute('x', b.x); r.setAttribute('y', b.y); r.setAttribute('width', b.w); r.setAttribute('height', b.h); r.setAttribute('rx', 10);
        const t = document.createElementNS(SVG_NS, 'text');
        t.setAttribute('class', 'quadra-label'); t.setAttribute('x', b.x + 14); t.setAttribute('y', b.y + 24); t.setAttribute('font-size', 18);
        t.textContent = `Quadra ${b.nome}  ·  ${b.n} lote${b.n > 1 ? 's' : ''}`;
        this.gBase.append(r, t);
      });
    }

    const opacity = this.mode === 'imagem' ? 0.5 : 0.92;
    this.lotes.forEach(l => {
      const pts = this.absPts(l); if (!pts) return;
      const poly = document.createElementNS(SVG_NS, 'polygon');
      poly.setAttribute('points', pts.map(p => p.join(',')).join(' '));
      let cls = 'lote-shape ' + (l.status || 'disponivel');
      if (this.selectedId === l.id) cls += ' selected';
      if (this.highlightIds && !this.highlightIds.has(l.id)) cls += ' dim';
      poly.setAttribute('class', cls);
      poly.setAttribute('fill-opacity', opacity);
      poly.dataset.id = l.id;
      this.gLotes.appendChild(poly);
      const bb = PlantaView.bbox(pts); const c = PlantaView.centroid(pts);
      const fs = Math.max(6, Math.min(bb.w * (this.mode === 'imagem' ? 0.22 : 0.28), bb.h * (this.mode === 'imagem' ? 0.32 : 0.45), this.mode === 'imagem' ? 60 : 26));
      const t = document.createElementNS(SVG_NS, 'text');
      t.setAttribute('class', 'lote-label'); t.setAttribute('x', c.cx); t.setAttribute('y', c.cy - (this.mode === 'esquema' ? fs * 0.35 : 0)); t.setAttribute('font-size', fs);
      t.textContent = this.mode === 'esquema' ? l.numero : (l.numero);
      this.gLotes.appendChild(t);
      if (this.mode === 'esquema') {
        const t2 = document.createElementNS(SVG_NS, 'text');
        t2.setAttribute('class', 'lote-label'); t2.setAttribute('x', c.cx); t2.setAttribute('y', c.cy + fs * 0.55); t2.setAttribute('font-size', fs * 0.5); t2.setAttribute('font-weight', 500);
        t2.textContent = l.area ? `${fmtNum(l.area, 0)} m²` : '';
        this.gLotes.appendChild(t2);
      }
    });
    this.renderDraw();
  }

  renderDraw() {
    this.gDraw.innerHTML = '';
    if (this.tool === 'poly' && this.drawPts.length) {
      const p = document.createElementNS(SVG_NS, this.drawPts.length >= 3 ? 'polygon' : 'polyline');
      p.setAttribute('points', this.drawPts.map(x => x.join(',')).join(' ')); p.setAttribute('class', 'draw-shape');
      this.gDraw.appendChild(p);
      const r = this.vb.w / 200;
      this.drawPts.forEach(([x, y], i) => { const c = document.createElementNS(SVG_NS, 'circle'); c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', i === 0 ? r * 1.6 : r); c.setAttribute('class', 'draw-pt'); this.gDraw.appendChild(c); });
    }
    if (this.tool === 'rect' && this.rectStart && this.rectCur) {
      const r = document.createElementNS(SVG_NS, 'rect');
      const x = Math.min(this.rectStart.x, this.rectCur.x), y = Math.min(this.rectStart.y, this.rectCur.y);
      r.setAttribute('x', x); r.setAttribute('y', y); r.setAttribute('width', Math.abs(this.rectCur.x - this.rectStart.x)); r.setAttribute('height', Math.abs(this.rectCur.y - this.rectStart.y)); r.setAttribute('class', 'draw-shape');
      this.gDraw.appendChild(r);
    }
  }

  setSelected(id) { this.selectedId = id; this.render(); }
  setHighlight(ids) { this.highlightIds = ids ? new Set(ids) : null; this.render(); }
  setTool(t) { this.tool = t; this.drawPts = []; this.rectStart = null; this.render(); }

  // ------------------------------------------------ viewBox / zoom
  applyVB() { const v = this.vb; this.svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`); }
  resetView() {
    const rect = this.svg.getBoundingClientRect();
    const ar = rect.width && rect.height ? rect.width / rect.height : 1.4;
    let w = this.W, h = this.H;
    if (w / h < ar) w = h * ar; else h = w / ar;
    const pad = 1.04;
    w *= pad; h *= pad;
    this.vb = { x: (this.W - w) / 2, y: (this.H - h) / 2, w, h };
    this.applyVB();
  }
  zoomBy(f) { this.zoomAt(f, this.vb.x + this.vb.w / 2, this.vb.y + this.vb.h / 2); }
  zoomAt(f, cx, cy) {
    const v = this.vb;
    const nw = v.w / f, nh = v.h / f;
    const minW = Math.max(this.W, this.H) / 40, maxW = Math.max(this.W, this.H) * 4;
    if (nw < minW || nw > maxW) return;
    this.vb = { x: cx - (cx - v.x) / f, y: cy - (cy - v.y) / f, w: nw, h: nh };
    this.applyVB();
    if (this.drawPts.length) this.renderDraw();
  }
  zoomToLote(id) {
    const l = this.lotes.find(x => x.id === id); const pts = l && this.absPts(l);
    if (!pts) return false;
    const bb = PlantaView.bbox(pts);
    const rect = this.svg.getBoundingClientRect(); const ar = rect.width / rect.height || 1.4;
    let w = Math.max(bb.w, bb.h * ar) * 5, h = w / ar;
    this.vb = { x: bb.cx - w / 2, y: bb.cy - h / 2, w, h };
    this.applyVB();
    return true;
  }
  toSvg(e) {
    const pt = this.svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const m = this.svg.getScreenCTM(); if (!m) return { x: 0, y: 0 };
    const p = pt.matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }
  unitsPerPx() { const rect = this.svg.getBoundingClientRect(); return this.vb.w / Math.max(1, rect.width) ; }

  // ------------------------------------------------ ponteiros (pan, pinça, clique, desenho)
  onDown(e) {
    this.svg.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, target: e.target });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mid: this.toSvg({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 }), vb: { ...this.vb } };
      this.rectStart = null;
    } else if (this.pointers.size === 1) {
      this.moved = false;
      if (this.tool === 'rect' && this.opts.editable) { this.rectStart = this.toSvg(e); this.rectCur = null; }
      else this.svg.classList.add('grabbing');
    }
  }
  onMove(e) {
    const p = this.pointers.get(e.pointerId); if (!p) return;
    const prev = { x: p.x, y: p.y };
    p.x = e.clientX; p.y = e.clientY;
    if (Math.hypot(p.x - p.sx, p.y - p.sy) > 6) this.moved = true;
    if (this.pointers.size === 2 && this.pinch) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const f = d / this.pinch.d;
      const rect = this.svg.getBoundingClientRect();
      const nw = this.pinch.vb.w / f, nh = this.pinch.vb.h / f;
      const midNow = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      // mantém o ponto médio inicial (em svg) sob o ponto médio atual (em tela)
      const upp = nw / rect.width;
      const offX = (midNow.x - rect.left) * upp, offY = (midNow.y - rect.top) * (nh / rect.height);
      this.vb = { x: this.pinch.mid.x - offX, y: this.pinch.mid.y - offY, w: nw, h: nh };
      this.applyVB();
      return;
    }
    if (this.pointers.size !== 1) return;
    if (this.tool === 'rect' && this.rectStart) { this.rectCur = this.toSvg(e); this.renderDraw(); return; }
    if (this.tool === 'poly') return; // no modo polígono, o arraste não move (evita pontos acidentais)
    const upp = this.unitsPerPx();
    this.vb.x -= (p.x - prev.x) * upp; this.vb.y -= (p.y - prev.y) * upp;
    this.applyVB();
  }
  onUp(e) {
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    this.svg.classList.remove('grabbing');
    if (this.pointers.size < 2) this.pinch = null;
    if (!p) return;
    const clicked = !this.moved;
    if (this.tool === 'rect' && this.rectStart) {
      const end = this.toSvg(e);
      const w = Math.abs(end.x - this.rectStart.x), h = Math.abs(end.y - this.rectStart.y);
      const s = this.rectStart; this.rectStart = null; this.rectCur = null; this.renderDraw();
      if (w > this.unitsPerPx() * 6 && h > this.unitsPerPx() * 6) {
        const x0 = Math.min(s.x, end.x), y0 = Math.min(s.y, end.y);
        this.emitShape([[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]]);
        return;
      }
    }
    if (clicked) {
      if (this.tool === 'poly' && this.opts.editable) {
        const pt = this.toSvg(e);
        if (this.drawPts.length >= 3) {
          const [fx, fy] = this.drawPts[0];
          if (Math.hypot(pt.x - fx, pt.y - fy) < this.unitsPerPx() * 14) { this.finishPoly(); return; }
        }
        this.drawPts.push([pt.x, pt.y]); this.renderDraw();
        this.setHint(`${this.drawPts.length} ponto(s). Toque no primeiro ponto ou em "Concluir" para fechar.`);
        return;
      }
      const id = p.target && p.target.dataset ? p.target.dataset.id : null;
      if (id && this.opts.onLotClick) this.opts.onLotClick(id);
    }
  }
  undoPoint() { this.drawPts.pop(); this.renderDraw(); }
  cancelDraw() { this.drawPts = []; this.rectStart = null; this.renderDraw(); this.setHint(''); }
  finishPoly() { if (this.drawPts.length < 3) return; const pts = this.drawPts.slice(); this.drawPts = []; this.renderDraw(); this.emitShape(pts); }
  emitShape(absPts) {
    const norm = absPts.map(([x, y]) => [Math.round(x / this.W * 10000) / 10000, Math.round(y / this.H * 10000) / 10000]);
    if (this.opts.onShape) this.opts.onShape(norm);
  }
}
