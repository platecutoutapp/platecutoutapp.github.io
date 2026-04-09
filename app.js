/* =========================   STATE MANAGEMENT  ========================= */
const state = {
    sheets: [], 
    cuts: [],   
    results: null,
    activeShape: 'rect'
};

/* =========================   UI TEMPLATES   ========================= */

function createSheetHTML(index) {
    const letter = String.fromCharCode(65 + index);
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
                <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Länge (mm)</label>
                <input class="sheet-l w-full bg-slate-50 border-none rounded-lg p-3 text-primary font-bold text-lg" type="number" value="2500" oninput="window.calculate()"/>
            </div>
            <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Breite (mm)</label>
                <input class="sheet-w w-full bg-slate-50 border-none rounded-lg p-3 text-primary font-bold text-lg" type="number" value="1250" oninput="window.calculate()"/>
            </div>
        </div>
        <div class="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span class="text-xs font-medium text-slate-500">Maserung / Rotation erlauben (90°)</span>
            <input type="checkbox" class="sheet-grain rounded text-primary" onchange="window.calculate()">
        </div>
    </section>`;
}

/* =========================   UI LOGIK   ========================= */

window.addSheet = function() {
    const container = document.getElementById('sheet-container');
    const index = container.querySelectorAll('.sheet-card').length;
    const div = document.createElement('div');
    div.innerHTML = createSheetHTML(index);
    container.appendChild(div.firstElementChild);
    window.calculate();
};

window.removeSheet = function(index) {
    const container = document.getElementById('sheet-container');
    if (container.querySelectorAll('.sheet-card').length <= 1) return alert("Mindestens ein Format muss bleiben!");
    container.querySelector(`.sheet-card[data-index="${index}"]`).remove();
    window.calculate();
};

window.setShape = function(shape) {
    state.activeShape = shape;
    document.querySelectorAll('.shape-tab').forEach(btn => {
        btn.classList.toggle('bg-primary', btn.dataset.shape === shape);
        btn.classList.toggle('text-white', btn.dataset.shape === shape);
    });
    
    const extraFields = document.getElementById('extra-fields');
    if (shape === 'trapezoid') {
        extraFields.innerHTML = `
            <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Obere Br. (mm)</label>
                <input id="cut-l2" type="number" placeholder="L2" class="w-full border-slate-200 rounded-lg text-sm p-3 focus:ring-primary">
            </div>`;
    } else { extraFields.innerHTML = ''; }
};

/* =========================   ALGORITHMUS (Multi-Bin & Pairing) ========================= */

// Kombiniert passende Dreiecke/Trapeze zu Rechtecken
function preprocessCuts(cuts) {
    let pool = [];
    cuts.forEach(c => { for(let i=0; i<c.qty; i++) pool.push({...c, id: Math.random()}); });

    let rectsToPack = [];

    // 1. Dreiecke paaren (180° gedreht ergeben sie ein Rechteck L x W)
    let triangles = pool.filter(c => c.shape === 'triangle');
    pool = pool.filter(c => c.shape !== 'triangle');
    while(triangles.length > 0) {
        let t1 = triangles.shift();
        let matchIdx = triangles.findIndex(t2 => t2.l === t1.l && t2.w === t1.w);
        if (matchIdx !== -1) {
            let t2 = triangles.splice(matchIdx, 1)[0];
            rectsToPack.push({ isPair: true, type: 'triangle', l: t1.l, w: t1.w, area: t1.l*t1.w, items: [t1, t2] });
        } else {
            rectsToPack.push({ isPair: false, type: 'triangle', l: t1.l, w: t1.w, area: t1.l*t1.w, items: [t1] });
        }
    }

    // 2. Trapeze paaren (Fügt man 2 identische Trapeze gedreht zusammen, wird es ein Rechteck (L+L2) x W)
    let trapezoids = pool.filter(c => c.shape === 'trapezoid');
    pool = pool.filter(c => c.shape !== 'trapezoid');
    while(trapezoids.length > 0) {
        let t1 = trapezoids.shift();
        let matchIdx = trapezoids.findIndex(t2 => t2.l === t1.l && t2.w === t1.w && t2.l2 === t1.l2);
        if (matchIdx !== -1) {
            let t2 = trapezoids.splice(matchIdx, 1)[0];
            let combinedL = t1.l + (t1.l2 || 0);
            rectsToPack.push({ isPair: true, type: 'trapezoid', l: combinedL, w: t1.w, area: combinedL*t1.w, items: [t1, t2] });
        } else {
            rectsToPack.push({ isPair: false, type: 'trapezoid', l: t1.l, w: t1.w, area: t1.l*t1.w, items: [t1] });
        }
    }

    // 3. Rechtecke hinzufügen
    pool.forEach(r => rectsToPack.push({ isPair: false, type: 'rect', l: r.l, w: r.w, area: r.l*r.w, items: [r] }));

    // Nach Fläche sortieren (größte zuerst)
    return rectsToPack.sort((a,b) => b.area - a.area);
}

window.calculate = function() {
    state.sheets = Array.from(document.querySelectorAll('.sheet-card')).map(card => ({
        name: card.querySelector('.sheet-name').value,
        l: parseFloat(card.querySelector('.sheet-l').value) || 0,
        w: parseFloat(card.querySelector('.sheet-w').value) || 0,
        canRotate: card.querySelector('.sheet-grain').checked
    })).filter(s => s.l > 0 && s.w > 0);

    if (state.cuts.length === 0 || state.sheets.length === 0) {
        document.getElementById('results-canvas-container').classList.add('hidden');
        return;
    }

    let remainingRects = preprocessCuts(state.cuts);
    let usedSheets = [];

    // Multi-Bin Algorithm: Wähle Platte, die pro Schritt am vollsten wird
    while (remainingRects.length > 0) {
        let bestRun = { efficiency: -1, placed: [], remaining: [], sheet: null };

        for (let sheet of state.sheets) {
            let currentRemaining = [...remainingRects];
            let placed = [];
            let freeSpace = [{ x: 0, y: 0, w: sheet.l, h: sheet.w }];
            let areaUsed = 0;

            for (let i = 0; i < currentRemaining.length; i++) {
                let rect = currentRemaining[i];
                let fits = false;
                let fw = rect.l, fh = rect.w;
                let rotated = false;

                for (let j = 0; j < freeSpace.length; j++) {
                    let fr = freeSpace[j];
                    if (fw <= fr.w && fh <= fr.h) {
                        fits = true;
                    } else if (sheet.canRotate && fh <= fr.w && fw <= fr.h) {
                        fits = true; [fw, fh] = [fh, fw]; rotated = true;
                    }

                    if (fits) {
                        placed.push({ ...rect, x: fr.x, y: fr.y, pw: fw, ph: fh, rotatedBox: rotated });
                        freeSpace.splice(j, 1);
                        // Restraum aufteilen
                        if (fr.w - fw > 0) freeSpace.push({ x: fr.x + fw, y: fr.y, w: fr.w - fw, h: fh });
                        if (fr.h - fh > 0) freeSpace.push({ x: fr.x, y: fr.y + fh, w: fr.w, h: fr.h - fh });
                        
                        areaUsed += rect.area;
                        currentRemaining.splice(i, 1);
                        i--;
                        break;
                    }
                }
            }

            let efficiency = areaUsed / (sheet.l * sheet.w);
            if (placed.length > 0 && efficiency > bestRun.efficiency) {
                bestRun = { efficiency, placed, remaining: currentRemaining, sheet };
            }
        }

        if (bestRun.placed.length === 0) {
            console.error("Einige Teile sind zu groß für alle verfügbaren Platten!");
            break; 
        }

        usedSheets.push({ sheet: bestRun.sheet, placements: bestRun.placed });
        remainingRects = bestRun.remaining;
    }

    state.results = { usedSheets };
    renderResults();
};

/* =========================   CANVAS ZEICHNEN   ========================= */

function renderResults() {
    const container = document.getElementById('results-canvas-container');
    const list = document.getElementById('canvas-list');
    container.classList.remove('hidden');
    list.innerHTML = '';

    let totalArea = 0;

    state.results.usedSheets.forEach((data, i) => {
        totalArea += (data.sheet.l * data.sheet.w) / 1000000;
        
        const wrap = document.createElement('div');
        wrap.className = "bg-white p-6 rounded-xl border border-slate-200 shadow-sm";
        wrap.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <p class="text-xs font-black text-primary uppercase tracking-wider">Schnittplan #${i+1}</p>
                <span class="text-sm font-bold bg-slate-100 px-3 py-1 rounded-full">${data.sheet.name} (${data.sheet.l}x${data.sheet.w}mm)</span>
            </div>`;
        
        const canvas = document.createElement('canvas');
        canvas.className = "w-full h-auto block mx-auto rounded border border-slate-200";
        const ctx = canvas.getContext('2d');
        const scale = 1600 / data.sheet.l;
        canvas.width = 1600;
        canvas.height = data.sheet.w * scale;

        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        data.placements.forEach(p => {
            const x = p.x * scale, y = p.y * scale, w = p.pw * scale, h = p.ph * scale;
            
            // Box Outline (Debug)
            // ctx.strokeStyle = "rgba(0,0,0,0.1)"; ctx.strokeRect(x,y,w,h);

            if (p.type === 'triangle' && p.isPair) {
                // Paar aus 2 Dreiecken
                drawShape(ctx, x, y, w, h, p.items[0].name, [{x:0, y:h}, {x:w, y:h}, {x:0, y:0}]);
                drawShape(ctx, x, y, w, h, p.items[1].name, [{x:w, y:0}, {x:0, y:0}, {x:w, y:h}], true);
            } 
            else if (p.type === 'trapezoid' && p.isPair) {
                // Paar aus 2 Trapezen
                const l1 = p.items[0].l * scale;
                const l2 = (p.items[0].l2 || 0) * scale;
                let wActual = p.rotatedBox ? h : w; // Wenn BoundingBox gedreht wurde, verhalten sich Längen anders
                let hActual = p.rotatedBox ? w : h;
                
                drawShape(ctx, x, y, w, h, p.items[0].name, [{x:0, y:h}, {x:l1, y:h}, {x:l2, y:0}, {x:0, y:0}]);
                drawShape(ctx, x, y, w, h, p.items[1].name, [{x:l1, y:h}, {x:w, y:h}, {x:w, y:0}, {x:l2, y:0}], true);
            } 
            else {
                // Einzelne Teile (wurden nicht gepaart)
                if (p.type === 'triangle') {
                    drawShape(ctx, x, y, w, h, p.items[0].name, [{x:0, y:h}, {x:w, y:h}, {x:0, y:0}]);
                } else if (p.type === 'trapezoid') {
                    const l2 = (p.items[0].l2 || 0) * scale;
                    drawShape(ctx, x, y, w, h, p.items[0].name, [{x:0, y:h}, {x:w, y:h}, {x:l2, y:0}, {x:0, y:0}]);
                } else {
                    drawShape(ctx, x, y, w, h, p.items[0].name, [{x:0, y:0}, {x:w, y:0}, {x:w, y:h}, {x:0, y:h}]); // Rect
                }
            }
        });
        wrap.appendChild(canvas);
        list.appendChild(wrap);
    });
    
    document.getElementById('stat-sheets-count').innerText = state.results.usedSheets.length;
    document.getElementById('stat-total-area').innerText = totalArea.toFixed(2) + " m²";
}

// Hilfsfunktion zum Zeichnen der Polygone
function drawShape(ctx, bx, by, bw, bh, name, points, isFlipped = false) {
    ctx.beginPath();
    ctx.fillStyle = isFlipped ? "#005eb8" : "#00478d"; // Leichter Kontrast für gepaarte Teile
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    
    ctx.moveTo(bx + points[0].x, by + points[0].y);
    for(let i=1; i<points.length; i++) {
        ctx.lineTo(bx + points[i].x, by + points[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Beschriftung in der Mitte der Bounding-Box berechnen (Approximation für den Schwerpunkt)
    let centerX = bx + points.reduce((sum, p) => sum + p.x, 0) / points.length;
    let centerY = by + points.reduce((sum, p) => sum + p.y, 0) / points.length;

    if (bw > 50 && bh > 30) {
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "bold 14px Inter, sans-serif";
        ctx.fillText(name, centerX, centerY);
    }
}

/* =========================   INIT   ========================= */

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('new-calc-btn').onclick = () => location.reload();
    
    // Zuschnitt-Interface
    document.getElementById('cut-list-section').innerHTML = `
        <div class="bg-white p-8 rounded-xl border border-slate-200 shadow-sm mt-8">
            <h4 class="font-bold text-lg mb-6">Zuschnitte</h4>
            
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
                    <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Länge (mm)</label>
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
            
            <button id="add-cut-btn" class="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-black transition-all shadow-md mt-2">
                TEIL HINZUFÜGEN
            </button>
            
            <div id="cut-display-list" class="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3"></div>
        </div>
    `;

    document.getElementById('add-cut-btn').onclick = () => {
        const l = parseFloat(document.getElementById('cut-l').value);
        const w = parseFloat(document.getElementById('cut-w').value);
        const l2 = document.getElementById('cut-l2') ? parseFloat(document.getElementById('cut-l2').value) : null;
        const qty = parseInt(document.getElementById('cut-qty').value);
        const name = document.getElementById('cut-name').value || `Teil ${state.cuts.length + 1}`;
        
        if (l > 0 && w > 0) {
            state.cuts.push({ name, l, w, l2, qty, shape: state.activeShape });
            renderCuts(); window.calculate();
            document.getElementById('cut-name').value = ''; // Reset name
        }
    };

    function renderCuts() {
        document.getElementById('cut-display-list').innerHTML = state.cuts.map((c, i) => `
            <div class="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                    <p class="text-sm font-bold">${c.qty}x ${c.name}</p>
                    <p class="text-[10px] text-slate-500 uppercase">${c.shape} | ${c.l}x${c.w}${c.l2 ? ' (Top:'+c.l2+')' : ''}</p>
                </div>
                <button onclick="state.cuts.splice(${i}, 1); renderCuts(); window.calculate();" class="text-error font-bold p-2">✕</button>
            </div>
        `).join('');
    }

    // Start UI
    window.addSheet();
});
