/* =========================   STATE MANAGEMENT  ========================= */
const EPSILON = 1e-6;

const state = {
    sheets: [],
    cuts: [],
    results: null,
    activeShape: 'rect',
    hasChanges: false,
    kerf: 3,
    nestingMode: 'free'
};

/* =========================   UI TEMPLATES   ========================= */

function createSheetHTML(index) {
    const letter = String.fromCharCode(65  index);
    return `
    <section class="sheet-card bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6" data-index="${index}">
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
                <span class="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm">${letter}</span>
                <input class="sheet-name bg-transparent border-none font-bold text-lg p-0 focus:ring-0" type="text" value="Format ${letter}" oninput="window.calculate()"/>
            </div>
            <button onclick="window.removeSheet(${index})" class="text-error hover:bg-red-50 p-2 rounded-lg transition-colors">
                <span class="material-symbols-outlined">delete</span>
            </button>
        </div>
        <div class="grid grid-cols-2 gap-4">
            <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Lange (mm)</label>
                <input class="sheet-l w-full bg-slate-50 border-none rounded-lg p-3 text-primary font-bold text-lg" type="number" value="2500" oninput="window.calculate()"/>
            </div>
            <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Breite (mm)</label>
                <input class="sheet-w w-full bg-slate-50 border-none rounded-lg p-3 text-primary font-bold text-lg" type="number" value="1250" oninput="window.calculate()"/>
            </div>
        </div>
        <div class="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span class="text-xs font-medium text-slate-500">Rotation erlauben (90deg)</span>
            <input type="checkbox" class="sheet-grain rounded text-primary" onchange="window.calculate()">
        </div>
    </section>`;
}

function refreshSheetIndices() {
    document.querySelectorAll('.sheet-card').forEach((card, idx) => {
        card.dataset.index = String(idx);
        const badge = card.querySelector('span');
        const nameInput = card.querySelector('.sheet-name');
        const button = card.querySelector('button');

        const letter = String.fromCharCode(65  idx);
        if (badge) badge.textContent = letter;
        if (nameInput && !nameInput.value.trim()) nameInput.value = `Format ${letter}`;
        if (button) button.setAttribute('onclick', `window.removeSheet(${idx})`);
    });
}

/* =========================   UI LOGIC   ========================= */

window.addSheet = function () {
    const container = document.getElementById('sheet-container');
    const index = container.querySelectorAll('.sheet-card').length;
    const div = document.createElement('div');
    div.innerHTML = createSheetHTML(index);
    container.appendChild(div.firstElementChild);
    refreshSheetIndices();
    if (state.hasChanges) window.calculate();
};

window.removeSheet = function (index) {
    const container = document.getElementById('sheet-container');
    if (container.querySelectorAll('.sheet-card').length <= 1) {
        alert('Mindestens ein Format muss bleiben!');
        return;
    }

    const target = container.querySelector(`.sheet-card[data-index="${index}"]`);
    if (!target) return;

    target.remove();
    refreshSheetIndices();
    window.calculate();
};

window.setShape = function (shape) {
    state.activeShape = shape;

    document.querySelectorAll('.shape-tab').forEach((btn) => {
        btn.classList.toggle('bg-primary', btn.dataset.shape === shape);
        btn.classList.toggle('text-white', btn.dataset.shape === shape);
    });

    const extraFields = document.getElementById('extra-fields');
    if (shape === 'trapezoid') {
        extraFields.innerHTML = `
            <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Obere Breite (mm)</label>
                <input id="cut-l2" type="number" placeholder="L2" class="w-full border-slate-200 rounded-lg text-sm p-3 focus:ring-primary">
            </div>`;
    } else {
        extraFields.innerHTML = '';
    }
};

window.removeCut = function (index) {
    if (index < 0 || index >= state.cuts.length) return;
    state.cuts.splice(index, 1);
    renderCuts();
    window.calculate();
};

function renderCuts() {
    const list = document.getElementById('cut-display-list');
    if (!list) return;

    list.innerHTML = state.cuts.map((c, i) => `
        <div class="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
                <p class="text-sm font-bold">${c.qty}x ${c.name}</p>
                <p class="text-[10px] text-slate-500 uppercase">${c.shape} | ${c.l}x${c.w}${c.l2 ? ` (Top:${c.l2})` : ''}</p>
            </div>
            <button onclick="window.removeCut(${i})" class="text-error font-bold p-2 hover:bg-red-50 rounded">X</button>
        </div>
    `).join('');
}

/* =========================   GEOMETRY HELPERS   ========================= */

function parseLocaleNumber(value, fallback = 0) {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
    const normalized = String(value).trim().replace(',', '.');
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeHeader(header) {
    return String(header || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
}

function polygonBounds(points) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
    }

    return {
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX,
        height: maxY - minY
    };
}

function normalizePolygon(points) {
    const bounds = polygonBounds(points);
    return points.map((p) => ({
        x: p.x - bounds.minX,
        y: p.y - bounds.minY
    }));
}

function rotatePolygon90(points, sourceHeight) {
    const rotated = points.map((p) => ({
        x: sourceHeight - p.y,
        y: p.x
    }));
    const normalized = normalizePolygon(rotated);
    const bounds = polygonBounds(normalized);
    return {
        points: normalized,
        width: bounds.width,
        height: bounds.height
    };
}

function polygonArea(points) {
    let sum = 0;
    for (let i = 0; i < points.length; i) {
        const a = points[i];
        const b = points[(i  1) % points.length];
        sum = (a.x * b.y) - (b.x * a.y);
    }
    return Math.abs(sum) * 0.5;
}

function polygonCentroid(points) {
    let signedArea = 0;
    let cx = 0;
    let cy = 0;

    for (let i = 0; i < points.length; i) {
        const a = points[i];
        const b = points[(i  1) % points.length];
        const cross = (a.x * b.y) - (b.x * a.y);
        signedArea = cross;
        cx = (a.x  b.x) * cross;
        cy = (a.y  b.y) * cross;
    }

    if (Math.abs(signedArea) < EPSILON) {
        const avgX = points.reduce((sum, p) => sum  p.x, 0) / points.length;
        const avgY = points.reduce((sum, p) => sum  p.y, 0) / points.length;
        return { x: avgX, y: avgY };
    }

    const factor = 1 / (3 * signedArea);
    return { x: cx * factor, y: cy * factor };
}

function buildBasePolygon(cut) {
    const l = Math.max(0, parseLocaleNumber(cut.l));
    const w = Math.max(0, parseLocaleNumber(cut.w));
    const l2Raw = parseLocaleNumber(cut.l2, 0);
    const l2 = Math.max(0, Math.min(l, l2Raw));

    if (cut.shape === 'triangle') {
        const points = [{ x: 0, y: w }, { x: l, y: w }, { x: 0, y: 0 }];
        return { points, width: l, height: w };
    }

    if (cut.shape === 'trapezoid') {
        const points = [{ x: 0, y: w }, { x: l, y: w }, { x: l2, y: 0 }, { x: 0, y: 0 }];
        const bounds = polygonBounds(points);
        return { points: normalizePolygon(points), width: bounds.width, height: bounds.height };
    }

    const points = [{ x: 0, y: 0 }, { x: l, y: 0 }, { x: l, y: w }, { x: 0, y: w }];
    return { points, width: l, height: w };
}

function getItemVariants(cut, canRotate) {
    const base = buildBasePolygon(cut);
    const normalizedBase = normalizePolygon(base.points);
    const baseBounds = polygonBounds(normalizedBase);
    const baseVariant = {
        points: normalizedBase,
        width: baseBounds.width,
        height: baseBounds.height,
        rotated: false,
        area: polygonArea(normalizedBase)
    };

    const variants = [baseVariant];

    if (canRotate) {
        const rotated = rotatePolygon90(normalizedBase, baseBounds.height);
        const signatureA = JSON.stringify(baseVariant.points.map((p) => [Number(p.x.toFixed(4)), Number(p.y.toFixed(4))]));
        const signatureB = JSON.stringify(rotated.points.map((p) => [Number(p.x.toFixed(4)), Number(p.y.toFixed(4))]));

        if (signatureA !== signatureB) {
            variants.push({
                points: rotated.points,
                width: rotated.width,
                height: rotated.height,
                rotated: true,
                area: polygonArea(rotated.points)
            });
        }
    }

    return variants;
}

function translatePolygon(points, dx, dy) {
    return points.map((p) => ({ x: p.x  dx, y: p.y  dy }));
}

function orient(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a, b, c) {
    return (
        Math.min(a.x, b.x) - EPSILON <= c.x && c.x <= Math.max(a.x, b.x)  EPSILON &&
        Math.min(a.y, b.y) - EPSILON <= c.y && c.y <= Math.max(a.y, b.y)  EPSILON
    );
}

function segmentsIntersect(a, b, c, d) {
    const o1 = orient(a, b, c);
    const o2 = orient(a, b, d);
    const o3 = orient(c, d, a);
    const o4 = orient(c, d, b);

    if ((o1 > EPSILON && o2 < -EPSILON || o1 < -EPSILON && o2 > EPSILON) &&
        (o3 > EPSILON && o4 < -EPSILON || o3 < -EPSILON && o4 > EPSILON)) {
        return true;
    }

    if (Math.abs(o1) <= EPSILON && onSegment(a, b, c)) return true;
    if (Math.abs(o2) <= EPSILON && onSegment(a, b, d)) return true;
    if (Math.abs(o3) <= EPSILON && onSegment(c, d, a)) return true;
    if (Math.abs(o4) <= EPSILON && onSegment(c, d, b)) return true;

    return false;
}

function pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i) {
        const a = polygon[i];
        const b = polygon[j];
        const intersects = ((a.y > point.y) !== (b.y > point.y)) &&
            (point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || EPSILON)  a.x);
        if (intersects) inside = !inside;
    }
    return inside;
}

function polygonsIntersect(polyA, polyB) {
    for (let i = 0; i < polyA.length; i) {
        const a1 = polyA[i];
        const a2 = polyA[(i  1) % polyA.length];
        for (let j = 0; j < polyB.length; j) {
            const b1 = polyB[j];
            const b2 = polyB[(j  1) % polyB.length];
            if (segmentsIntersect(a1, a2, b1, b2)) return true;
        }
    }

    if (pointInPolygon(polyA[0], polyB)) return true;
    if (pointInPolygon(polyB[0], polyA)) return true;

    return false;
}

function pointToSegmentDistance(point, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) {
        return Math.hypot(point.x - a.x, point.y - a.y);
    }

    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx  (point.y - a.y) * dy) / (dx * dx  dy * dy)));
    const projX = a.x  t * dx;
    const projY = a.y  t * dy;
    return Math.hypot(point.x - projX, point.y - projY);
}

function segmentsMinDistance(a1, a2, b1, b2) {
    if (segmentsIntersect(a1, a2, b1, b2)) return 0;
    return Math.min(
        pointToSegmentDistance(a1, b1, b2),
        pointToSegmentDistance(a2, b1, b2),
        pointToSegmentDistance(b1, a1, a2),
        pointToSegmentDistance(b2, a1, a2)
    );
}

function polygonMinDistance(polyA, polyB) {
    let minDistance = Infinity;

    for (let i = 0; i < polyA.length; i) {
        const a1 = polyA[i];
        const a2 = polyA[(i  1) % polyA.length];

        for (let j = 0; j < polyB.length; j) {
            const b1 = polyB[j];
            const b2 = polyB[(j  1) % polyB.length];
            minDistance = Math.min(minDistance, segmentsMinDistance(a1, a2, b1, b2));
            if (minDistance < EPSILON) return 0;
        }
    }

    return minDistance;
}

function boundsOverlapWithPadding(boundsA, boundsB, padding) {
    return !(
        boundsA.maxX  padding <= boundsB.minX  EPSILON ||
        boundsB.maxX  padding <= boundsA.minX  EPSILON ||
        boundsA.maxY  padding <= boundsB.minY  EPSILON ||
        boundsB.maxY  padding <= boundsA.minY  EPSILON
    );
}

function polygonsConflict(polyA, boundsA, polyB, boundsB, kerf) {
    if (!boundsOverlapWithPadding(boundsA, boundsB, kerf)) return false;
    if (polygonsIntersect(polyA, polyB)) return true;
    if (kerf <= EPSILON) return false;
    return polygonMinDistance(polyA, polyB) < kerf - EPSILON;
}

function scoreCandidate(bounds) {
    return (bounds.minY * 1000000)  bounds.minX  (bounds.maxY * 0.0001);
}

function dedupeCandidates(candidates, sheet) {
    const seen = new Set();
    const deduped = [];

    for (const c of candidates) {
        const x = Math.max(0, c.x);
        const y = Math.max(0, c.y);
        if (x > sheet.l  EPSILON || y > sheet.w  EPSILON) continue;
        const key = `${Math.round(x * 10) / 10}|${Math.round(y * 10) / 10}`;
        if (!seen.has(key)) {
            seen.add(key);
            deduped.push({ x, y });
        }
    }

    deduped.sort((a, b) => (a.y - b.y) || (a.x - b.x));
    return deduped;
}

function buildPlacement(item, variant, x, y) {
    const points = translatePolygon(variant.points, x, y);
    const bounds = polygonBounds(points);
    return {
        id: item.id,
        name: item.name,
        shape: item.shape,
        l: item.l,
        w: item.w,
        l2: item.l2,
        area: item.area,
        rotated: variant.rotated,
        points,
        bounds,
        x: bounds.minX,
        y: bounds.minY,
        pw: bounds.width,
        ph: bounds.height
    };
}

/* =========================   PACKING  ========================= */

function expandCuts(cuts) {
    const items = [];

    cuts.forEach((cut) => {
        const qty = Math.max(0, Math.floor(parseLocaleNumber(cut.qty, 0)));
        if (qty <= 0) return;

        const baseShape = buildBasePolygon(cut);
        const area = polygonArea(baseShape.points);
        if (area <= EPSILON) return;

        for (let i = 0; i < qty; i) {
            items.push({
                id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                name: cut.name,
                shape: cut.shape,
                l: parseLocaleNumber(cut.l),
                w: parseLocaleNumber(cut.w),
                l2: parseLocaleNumber(cut.l2, 0),
                area
            });
        }
    });

    items.sort((a, b) => b.area - a.area);
    return items;
}

function packSheetFree(items, sheet, kerf) {
    const remaining = [...items];
    const placed = [];
    let candidates = [{ x: 0, y: 0 }];
    let areaUsed = 0;

    for (let i = 0; i < remaining.length; i) {
        const item = remaining[i];
        const variants = getItemVariants(item, sheet.canRotate);
        let bestPlacement = null;
        let bestScore = Infinity;

        candidates = dedupeCandidates(candidates, sheet);

        for (const candidate of candidates) {
            for (const variant of variants) {
                if (variant.width > sheet.l  EPSILON || variant.height > sheet.w  EPSILON) continue;

                const placement = buildPlacement(item, variant, candidate.x, candidate.y);
                if (placement.bounds.maxX > sheet.l  EPSILON || placement.bounds.maxY > sheet.w  EPSILON) continue;

                let blocked = false;
                for (const existing of placed) {
                    if (polygonsConflict(placement.points, placement.bounds, existing.points, existing.bounds, kerf)) {
                        blocked = true;
                        break;
                    }
                }

                if (blocked) continue;

                const score = scoreCandidate(placement.bounds);
                if (score < bestScore) {
                    bestScore = score;
                    bestPlacement = placement;
                }
            }
        }

        if (!bestPlacement) continue;

        placed.push(bestPlacement);
        areaUsed = item.area;
        remaining.splice(i, 1);
        i--;

        const b = bestPlacement.bounds;
        candidates.push({ x: b.maxX  kerf, y: b.minY });
        candidates.push({ x: b.minX, y: b.maxY  kerf });
        candidates.push({ x: b.maxX  kerf, y: b.maxY  kerf });

        bestPlacement.points.forEach((p) => {
            candidates.push({ x: p.x  kerf, y: p.y });
            candidates.push({ x: p.x, y: p.y  kerf });
        });
    }

    const efficiency = areaUsed / (sheet.l * sheet.w);
    return { placed, remaining, areaUsed, efficiency };
}

function chooseGuillotinePlacement(item, sheet, freeRects) {
    const variants = getItemVariants(item, sheet.canRotate);
    let best = null;

    freeRects.forEach((fr, rectIndex) => {
        variants.forEach((variant) => {
            if (variant.width > fr.w  EPSILON || variant.height > fr.h  EPSILON) return;

            const placement = buildPlacement(item, variant, fr.x, fr.y);
            const waste = (fr.w * fr.h) - (variant.width * variant.height);
            const score = (waste * 1000)  fr.y  (fr.x * 0.01);

            if (!best || score < best.score) {
                best = {
                    score,
                    rectIndex,
                    usedWidth: variant.width,
                    usedHeight: variant.height,
                    placement
                };
            }
        });
    });

    return best;
}

function splitGuillotineRect(freeRects, rectIndex, usedWidth, usedHeight, kerf) {
    const selected = freeRects.splice(rectIndex, 1);
    const fr = selected[0];
    if (!fr) return;

    const rightWidth = fr.w - usedWidth - kerf;
    if (rightWidth > EPSILON) {
        freeRects.push({
            x: fr.x  usedWidth  kerf,
            y: fr.y,
            w: rightWidth,
            h: usedHeight
        });
    }

    const bottomHeight = fr.h - usedHeight - kerf;
    if (bottomHeight > EPSILON) {
        freeRects.push({
            x: fr.x,
            y: fr.y  usedHeight  kerf,
            w: fr.w,
            h: bottomHeight
        });
    }
}

function packSheetGuillotine(items, sheet, kerf) {
    const remaining = [...items];
    const placed = [];
    let areaUsed = 0;

    const freeRects = [{ x: 0, y: 0, w: sheet.l, h: sheet.w }];

    for (let i = 0; i < remaining.length; i) {
        const item = remaining[i];
        const best = chooseGuillotinePlacement(item, sheet, freeRects);

        if (!best) continue;

        placed.push(best.placement);
        areaUsed = item.area;
        splitGuillotineRect(freeRects, best.rectIndex, best.usedWidth, best.usedHeight, kerf);
        remaining.splice(i, 1);
        i--;
    }

    const efficiency = areaUsed / (sheet.l * sheet.w);
    return { placed, remaining, areaUsed, efficiency };
}

function packItemsOnSheet(items, sheet, kerf, mode) {
    if (mode === 'guillotine') return packSheetGuillotine(items, sheet, kerf);
    return packSheetFree(items, sheet, kerf);
}

window.calculate = function () {
    state.hasChanges = true;

    const kerfInput = document.getElementById('kerf-input');
    const modeInput = document.getElementById('nesting-mode-select');
    state.kerf = Math.max(0, parseLocaleNumber(kerfInput ? kerfInput.value : state.kerf, 3));
    state.nestingMode = (modeInput && modeInput.value === 'guillotine') ? 'guillotine' : 'free';

    state.sheets = Array.from(document.querySelectorAll('.sheet-card')).map((card) => ({
        name: card.querySelector('.sheet-name').value,
        l: parseLocaleNumber(card.querySelector('.sheet-l').value),
        w: parseLocaleNumber(card.querySelector('.sheet-w').value),
        canRotate: card.querySelector('.sheet-grain').checked
    })).filter((sheet) => sheet.l > 0 && sheet.w > 0);

    if (state.cuts.length === 0 || state.sheets.length === 0) {
        state.results = null;
        document.getElementById('results-canvas-container').classList.add('hidden');
        document.getElementById('stat-sheets-count').innerText = '0';
        document.getElementById('stat-total-area').innerText = '0.00 m2';
        return;
    }

    let remaining = expandCuts(state.cuts);
    const usedSheets = [];

    while (remaining.length > 0) {
        let bestRun = null;

        for (const sheet of state.sheets) {
            const run = packItemsOnSheet(remaining, sheet, state.kerf, state.nestingMode);
            if (run.placed.length === 0) continue;

            if (!bestRun || run.efficiency > bestRun.efficiency ||
                (Math.abs(run.efficiency - bestRun.efficiency) < EPSILON && run.placed.length > bestRun.placed.length)) {
                bestRun = { ...run, sheet };
            }
        }

        if (!bestRun || bestRun.placed.length === 0) break;

        usedSheets.push({ sheet: bestRun.sheet, placements: bestRun.placed, areaUsed: bestRun.areaUsed });
        remaining = bestRun.remaining;
    }

    state.results = {
        usedSheets,
        unplaced: remaining
    };

    renderResults();
};

/* =========================   CANVAS RENDERING   ========================= */

function drawPlacement(ctx, placement, scale) {
    const colors = {
        rect: '#00478d',
        triangle: '#005eb8',
        trapezoid: '#0a6ebd'
    };

    const points = placement.points.map((p) => ({ x: p.x * scale, y: p.y * scale }));

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();

    ctx.fillStyle = colors[placement.shape] || '#00478d';
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();

    const centroid = polygonCentroid(points);
    if (placement.pw * scale > 60 && placement.ph * scale > 30) {
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.fillText(placement.name, centroid.x, centroid.y);
    }
}

function renderResults() {
    const container = document.getElementById('results-canvas-container');
    const list = document.getElementById('canvas-list');

    if (!state.results || state.results.usedSheets.length === 0) {
        container.classList.add('hidden');
        list.innerHTML = '';
        document.getElementById('stat-sheets-count').innerText = '0';
        document.getElementById('stat-total-area').innerText = '0.00 m2';
        return;
    }

    container.classList.remove('hidden');
    list.innerHTML = '';

    let totalArea = 0;

    state.results.usedSheets.forEach((entry, index) => {
        totalArea = (entry.sheet.l * entry.sheet.w) / 1000000;

        const wrap = document.createElement('div');
        wrap.className = 'bg-white p-6 rounded-xl border border-slate-200 shadow-sm';
        wrap.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <p class="text-xs font-black text-primary uppercase tracking-wider">Schnittplan #${index  1}</p>
                <span class="text-sm font-bold bg-slate-100 px-3 py-1 rounded-full">${entry.sheet.name} (${entry.sheet.l}x${entry.sheet.w}mm)</span>
            </div>`;

        const canvas = document.createElement('canvas');
        canvas.className = 'w-full h-auto block mx-auto rounded border border-slate-200';
        const ctx = canvas.getContext('2d');

        const scale = 1600 / entry.sheet.l;
        canvas.width = 1600;
        canvas.height = Math.max(1, Math.round(entry.sheet.w * scale));

        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        entry.placements.forEach((placement) => drawPlacement(ctx, placement, scale));

        wrap.appendChild(canvas);
        list.appendChild(wrap);
    });

    const unplacedCount = state.results.unplaced ? state.results.unplaced.length : 0;
    if (unplacedCount > 0) {
        const note = document.createElement('p');
        note.className = 'text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3';
        note.textContent = `${unplacedCount} Teile konnten mit den aktuellen Einstellungen nicht platziert werden.`;
        list.prepend(note);
    }

    document.getElementById('stat-sheets-count').innerText = String(state.results.usedSheets.length);
    document.getElementById('stat-total-area').innerText = `${totalArea.toFixed(2)} m2`;
}

/* =========================   IMPORT / EXPORT   ========================= */

function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

function toCutRows(cuts) {
    return cuts.map((cut) => ({
        Bezeichnung: cut.name,
        Form: cut.shape,
        Laenge_mm: cut.l,
        Breite_mm: cut.w,
        ObereBreite_mm: cut.l2 || '',
        Anzahl: cut.qty
    }));
}

function toPlanRows() {
    if (!state.results || !state.results.usedSheets) return [];
    const rows = [];

    state.results.usedSheets.forEach((entry, sheetIndex) => {
        entry.placements.forEach((placement, cutIndex) => {
            rows.push({
                Schnittplan: sheetIndex  1,
                Position: cutIndex  1,
                Platte: entry.sheet.name,
                Teil: placement.name,
                Form: placement.shape,
                X_mm: Number(placement.x.toFixed(2)),
                Y_mm: Number(placement.y.toFixed(2)),
                Breite_mm: Number(placement.pw.toFixed(2)),
                Hoehe_mm: Number(placement.ph.toFixed(2)),
                Rotation: placement.rotated ? '90deg' : '0deg',
                Flaeche_mm2: Number(placement.area.toFixed(2))
            });
        });
    });

    return rows;
}

window.exportCutsCSV = function () {
    if (state.cuts.length === 0) {
        alert('Keine Stueckliste zum Export vorhanden.');
        return;
    }

    if (!window.XLSX) {
        alert('CSV Export nicht verfuegbar (XLSX Bibliothek fehlt).');
        return;
    }

    const sheet = XLSX.utils.json_to_sheet(toCutRows(state.cuts));
    const csv = XLSX.utils.sheet_to_csv(sheet);
    downloadBlob('stueckliste.csv', new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
};

window.exportCutsExcel = function () {
    if (state.cuts.length === 0) {
        alert('Keine Stueckliste zum Export vorhanden.');
        return;
    }

    if (!window.XLSX) {
        alert('Excel Export nicht verfuegbar (XLSX Bibliothek fehlt).');
        return;
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(toCutRows(state.cuts)), 'Stueckliste');

    const planRows = toPlanRows();
    if (planRows.length > 0) {
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(planRows), 'Schnittliste');
    }

    XLSX.writeFile(workbook, 'zuschnittlisten.xlsx');
};

function detectShape(shapeValue) {
    const value = String(shapeValue || '').toLowerCase().trim();
    if (value.includes('tri') || value.includes('dreieck')) return 'triangle';
    if (value.includes('trap')) return 'trapezoid';
    return 'rect';
}

function getRowValue(row, aliases) {
    const keys = Object.keys(row);
    for (const alias of aliases) {
        const hit = keys.find((k) => normalizeHeader(k) === alias);
        if (hit !== undefined) return row[hit];
    }
    return undefined;
}

function parseCutRows(rows) {
    const parsed = [];

    rows.forEach((row, index) => {
        const l = parseLocaleNumber(getRowValue(row, ['lange', 'laenge', 'length', 'l', 'x']));
        const w = parseLocaleNumber(getRowValue(row, ['breite', 'width', 'w', 'y']));
        const qty = Math.max(1, Math.floor(parseLocaleNumber(getRowValue(row, ['anzahl', 'qty', 'quantity', 'menge']), 1)));
        const l2 = parseLocaleNumber(getRowValue(row, ['oberebreite', 'top', 'l2', 'topwidth']), 0);

        if (l <= 0 || w <= 0) return;

        const name = String(getRowValue(row, ['bezeichnung', 'name', 'teil', 'part']) || `Teil ${index  1}`).trim();
        const shape = detectShape(getRowValue(row, ['form', 'shape', 'typ', 'type']));

        parsed.push({
            name: name || `Teil ${index  1}`,
            shape,
            l,
            w,
            l2: shape === 'trapezoid' ? l2 : null,
            qty
        });
    });

    return parsed;
}

window.handleCutImportFile = function (event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!window.XLSX) {
        alert('Import nicht verfuegbar (XLSX Bibliothek fehlt).');
        return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
        try {
            const data = new Uint8Array(loadEvent.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const firstSheet = workbook.Sheets[firstSheetName];
            const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

            const parsed = parseCutRows(rows);
            if (parsed.length === 0) {
                alert('Keine gueltigen Teile in der Datei gefunden. Erwartete Spalten z.B.: Bezeichnung, Form, Laenge, Breite, ObereBreite, Anzahl.');
                return;
            }

            state.cuts = parsed;
            renderCuts();
            window.calculate();
        } catch (error) {
            console.error(error);
            alert('Datei konnte nicht gelesen werden. Bitte CSV/XLSX mit Tabellenkopf verwenden.');
        } finally {
            event.target.value = '';
        }
    };

    reader.readAsArrayBuffer(file);
};

window.triggerCutImport = function () {
    const input = document.getElementById('cut-import-input');
    if (input) input.click();
};

window.exportPDF = function () {
    if (!state.results || state.results.usedSheets.length === 0) {
        alert('Kein Schnittplan zum Export vorhanden.');
        return;
    }

    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert('PDF Export nicht verfuegbar (jsPDF Bibliothek fehlt).');
        return;
    }

    const canvases = Array.from(document.querySelectorAll('#canvas-list canvas'));
    const jsPDF = window.jspdf.jsPDF;
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    state.results.usedSheets.forEach((entry, i) => {
        if (i > 0) pdf.addPage();

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        pdf.setFontSize(14);
        pdf.text(`Schnittplan #${i  1} - ${entry.sheet.name} (${entry.sheet.l}x${entry.sheet.w}mm)`, 10, 10);

        const canvas = canvases[i];
        if (!canvas) return;

        const imageData = canvas.toDataURL('image/png');
        const maxWidth = pageWidth - 20;
        const maxHeight = pageHeight - 25;

        const ratio = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
        const renderWidth = canvas.width * ratio;
        const renderHeight = canvas.height * ratio;

        const x = (pageWidth - renderWidth) / 2;
        const y = 15;
        pdf.addImage(imageData, 'PNG', x, y, renderWidth, renderHeight, undefined, 'FAST');
    });

    pdf.save('schnittplan.pdf');
};

/* =========================   INIT   ========================= */

document.addEventListener('DOMContentLoaded', () => {
    const modeSelect = document.getElementById('nesting-mode-select');
    const kerfInput = document.getElementById('kerf-input');

    if (modeSelect) modeSelect.value = state.nestingMode;
    if (kerfInput) kerfInput.value = String(state.kerf);

    document.getElementById('new-calc-btn').onclick = () => {
        if (!state.hasChanges || confirm('Es gibt ungespeicherte Aenderungen. Wirklich neues Projekt starten?')) {
            location.reload();
        }
    };

    document.getElementById('export-json-btn').onclick = () => {
        if (state.cuts.length === 0 && (!state.results || state.results.usedSheets.length === 0)) {
            alert('Keine Daten zum Exportieren vorhanden.');
            return;
        }

        const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(state, null, 2))}`;
        const anchor = document.createElement('a');
        anchor.setAttribute('href', dataStr);
        anchor.setAttribute('download', 'zuschnitt_projekt.json');
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    };

    document.getElementById('export-pdf-btn').onclick = window.exportPDF;

    document.getElementById('cut-list-section').innerHTML = `
        <div class="bg-white p-8 rounded-xl border border-slate-200 shadow-sm mt-8">
            <h4 class="font-bold text-lg mb-6">Zuschnitte</h4>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                <button id="import-cuts-btn" class="w-full border border-slate-300 px-4 py-3 rounded-lg text-sm font-bold hover:bg-slate-50">CSV/Excel Import</button>
                <button id="export-csv-btn" class="w-full border border-slate-300 px-4 py-3 rounded-lg text-sm font-bold hover:bg-slate-50">CSV Export (Stueckliste)</button>
                <button id="export-excel-btn" class="w-full border border-slate-300 px-4 py-3 rounded-lg text-sm font-bold hover:bg-slate-50 md:col-span-2">Excel Export (Stueck- & Schnittliste)</button>
            </div>

            <input id="cut-import-input" type="file" accept=".csv,.xlsx,.xls" class="hidden" />

            <div class="flex gap-2 mb-6">
                <button onclick="window.setShape('rect')" data-shape="rect" class="shape-tab flex-1 py-2 rounded-lg border border-slate-200 text-xs font-bold transition-all bg-primary text-white">RECHTECK</button>
                <button onclick="window.setShape('triangle')" data-shape="triangle" class="shape-tab flex-1 py-2 rounded-lg border border-slate-200 text-xs font-bold transition-all">DREIECK</button>
                <button onclick="window.setShape('trapezoid')" data-shape="trapezoid" class="shape-tab flex-1 py-2 rounded-lg border border-slate-200 text-xs font-bold transition-all">TRAPEZ</button>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 items-end">
                <div class="col-span-2">
                    <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bezeichnung</label>
                    <input id="cut-name" type="text" placeholder="z.B. Frontblende" class="w-full border-slate-200 rounded-lg text-sm p-3 focus:ring-primary">
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Laenge (mm)</label>
                    <input id="cut-l" type="number" placeholder="L" class="w-full border-slate-200 rounded-lg text-sm p-3">
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Breite (mm)</label>
                    <input id="cut-w" type="number" placeholder="B" class="w-full border-slate-200 rounded-lg text-sm p-3">
                </div>
                <div id="extra-fields" class="col-span-2 md:col-span-1"></div>
                <div>
                    <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Anzahl</label>
                    <input id="cut-qty" type="number" value="1" class="w-full border-slate-200 rounded-lg text-sm p-3">
                </div>
            </div>

            <button id="add-cut-btn" class="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-black transition-all shadow-md mt-2">TEIL HINZUFUEGEN</button>
            <div id="cut-display-list" class="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3"></div>
        </div>
    `;

    document.getElementById('add-cut-btn').onclick = () => {
        const l = parseLocaleNumber(document.getElementById('cut-l').value);
        const w = parseLocaleNumber(document.getElementById('cut-w').value);
        const l2Input = document.getElementById('cut-l2');
        const l2 = l2Input ? parseLocaleNumber(l2Input.value, 0) : null;
        const qty = Math.max(1, Math.floor(parseLocaleNumber(document.getElementById('cut-qty').value, 1)));
        const name = (document.getElementById('cut-name').value || `Teil ${state.cuts.length  1}`).trim();

        if (l > 0 && w > 0) {
            state.cuts.push({
                name: name || `Teil ${state.cuts.length  1}`,
                l,
                w,
                l2: state.activeShape === 'trapezoid' ? l2 : null,
                qty,
                shape: state.activeShape
            });

            renderCuts();
            window.calculate();

            document.getElementById('cut-name').value = '';
            document.getElementById('cut-l').value = '';
            document.getElementById('cut-w').value = '';
            if (l2Input) l2Input.value = '';
            document.getElementById('cut-qty').value = '1';
        }
    };

    document.getElementById('import-cuts-btn').addEventListener('click', window.triggerCutImport);
    document.getElementById('export-csv-btn').addEventListener('click', window.exportCutsCSV);
    document.getElementById('export-excel-btn').addEventListener('click', window.exportCutsExcel);
    document.getElementById('cut-import-input').addEventListener('change', window.handleCutImportFile);

    document.getElementById('add-sheet-btn').addEventListener('click', window.addSheet);

    if (modeSelect) modeSelect.addEventListener('change', window.calculate);
    if (kerfInput) kerfInput.addEventListener('input', window.calculate);

    window.addSheet();
    state.hasChanges = false;
});
