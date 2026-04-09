/* =========================   STATE MANAGEMENT  ========================= */
const state = {
    sheets: [], 
    cuts: [],   
    results: null,
    activeShape: 'rect' // 'rect', 'triangle', 'trapezoid'
};

/* =========================   UI TEMPLATES   ========================= */

function createSheetHTML(index) {
    const letter = String.fromCharCode(65 + index);
    return `
    <section class="sheet-card bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6" data-index="${index}">
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
                <span class="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">${index + 1}</span>
                <h4 class="font-headline font-bold text-lg">Plattenformat ${letter}</h4>
            </div>
            <button onclick="window.removeSheet(${index})" class="text-error hover:bg-red-50 p-2 rounded-lg transition-colors">
                <span class="material-symbols-outlined">delete</span>
            </button>
        </div>
        <div class="grid grid-cols-2 gap-4">
            <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Länge (mm)</label>
                <input class="sheet-l w-full bg-slate-50 border-none rounded-lg p-3 text-primary font-bold text-lg focus:ring-2 focus:ring-primary/20" 
                       type="number" value="2500" oninput="window.calculate()"/>
            </div>
            <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Breite (mm)</label>
                <input class="sheet-w w-full bg-slate-50 border-none rounded-lg p-3 text-primary font-bold text-lg focus:ring-2 focus:ring-primary/20" 
                       type="number" value="1250" oninput="window.calculate()"/>
            </div>
        </div>
    </section>`;
}

/* =========================   CORE LOGIC   ========================= */

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
    if (container.querySelectorAll('.sheet-card').length <= 1) return alert("Ein Format muss bleiben!");
    container.querySelector(`.sheet-card[data-index="${index}"]`).remove();
    window.calculate();
};

// Wechselt die Eingabemasken für die Formen
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
                <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Obere Breite (mm)</label>
                <input id="cut-l2" type="number" placeholder="L2" class="w-full border-slate-200 rounded-lg text-sm p-3">
            </div>
        `;
    } else {
        extraFields.innerHTML = '';
    }
};

window.calculate = function() {
    const cards = document.querySelectorAll('.sheet-card');
    state.sheets = Array.from(cards).map(card => ({
        l: parseFloat(card.querySelector('.sheet-l').value) || 0,
        w: parseFloat(card.querySelector('.sheet-w').value) || 0,
    }));

    if (state.cuts.length === 0) {
        document.getElementById('results-canvas-container').classList.add('hidden');
        return;
    }

    // Packing Algorithm (Simplified Bounding Box Packing)
    let remainingCuts = [];
    state.cuts.forEach(c => {
        for(let i=0; i<c.qty; i++) remainingCuts.push({ ...c });
    });
    remainingCuts.sort((a, b) => (b.l * b.w) - (a.l * a.w));

    let usedSheets = [];
    const sheetDef = state.sheets[0] || {l: 2500, w: 1250};

    while (remainingCuts.length > 0) {
        let placed = [];
        let freeRects = [{ x: 0, y: 0, w: sheetDef.l, h: sheetDef.w }];

        for (let i = 0; i < remainingCuts.length; i++) {
            let cut = remainingCuts[i];
            for (let j = 0; j < freeRects.length; j++) {
                let fr = freeRects[j];
                if (cut.l <= fr.w && cut.w <= fr.h) {
                    placed.push({ ...cut, x: fr.x, y: fr.y });
                    freeRects.splice(j, 1);
                    if (fr.w - cut.l > 0) freeRects.push({ x: fr.x + cut.l, y: fr.y, w: fr.w - cut.l, h: cut.w });
                    if (fr.h - cut.w > 0) freeRects.push({ x: fr.x, y: fr.y + cut.w, w: fr.w, h: fr.h - cut.w });
                    remainingCuts.splice(i, 1);
                    i--; break;
                }
            }
        }
        if (placed.length === 0) break;
        usedSheets.push({ placements: placed });
    }
    state.results = { usedSheets };
    renderResults();
};

function renderResults() {
    const container = document.getElementById('results-canvas-container');
    const list = document.getElementById('canvas-list');
    container.classList.remove('hidden');
    list.innerHTML = '';

    state.results.usedSheets.forEach((data, i) => {
        const wrap = document.createElement('div');
        wrap.className = "bg-white p-4 rounded-xl border border-slate-200 shadow-sm max-w-full overflow-hidden";
        wrap.innerHTML = `<p class="text-[10px] font-black text-primary mb-3 uppercase tracking-tighter">Platte #${i+1} (${state.sheets[0].l}x${state.sheets[0].w}mm)</p>`;
        
        const canvas = document.createElement('canvas');
        canvas.className = "w-full h-auto block mx-auto"; // Zentriert den Plan
        const ctx = canvas.getContext('2d');
        
        // Skalierung: Wir berechnen die Breite basierend auf der Container-Anzeige
        const displayWidth = 1600; 
        const scale = displayWidth / state.sheets[0].l;
        canvas.width = displayWidth;
        canvas.height = state.sheets[0].w * scale;

        // Hintergrund
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        data.placements.forEach(p => {
            const x = p.x * scale;
            const y = p.y * scale;
            const w = p.l * scale;
            const h = p.w * scale;

            ctx.beginPath();
            ctx.fillStyle = "#00478d";
            ctx.strokeStyle = "white";
            ctx.lineWidth = 2;

            if (p.shape === 'rect') {
                ctx.rect(x, y, w, h);
            } else if (p.shape === 'triangle') {
                ctx.moveTo(x, y + h);
                ctx.lineTo(x + w, y + h);
                ctx.lineTo(x, y);
                ctx.closePath();
            } else if (p.shape === 'trapezoid') {
                const w2 = (p.l2 || p.l * 0.6) * scale;
                ctx.moveTo(x, y + h);
                ctx.lineTo(x + w, y + h);
                ctx.lineTo(x + w2, y);
                ctx.lineTo(x, y);
                ctx.closePath();
            }

            ctx.fill();
            ctx.stroke();

            // Moderne, zentrierte Beschriftung
            ctx.fillStyle = "white";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = "bold 16px Inter, sans-serif";
            
            // Nur zeichnen wenn Platz ist
            if (w > 40) {
                ctx.fillText(p.name, x + w/2, y + h/2);
            }
        });
        wrap.appendChild(canvas);
        list.appendChild(wrap);
    });
    
    document.getElementById('stat-sheets-count').innerText = state.results.usedSheets.length;
    document.getElementById('stat-total-area').innerText = (state.results.usedSheets.length * state.sheets[0].l * state.sheets[0].w / 1000000).toFixed(2) + " m²";
}

/* =========================   INIT   ========================= */

document.addEventListener("DOMContentLoaded", () => {
    // Neues Zuschnitt-Interface
    document.getElementById('cut-list-section').innerHTML = `
        <div class="bg-white p-8 rounded-xl border border-slate-200 shadow-sm mt-8">
            <h4 class="font-bold text-lg mb-6">Zuschnitte</h4>
            
            <div class="flex gap-2 mb-6">
                <button onclick="window.setShape('rect')" data-shape="rect" class="shape-tab flex-1 py-2 rounded-lg border border-slate-200 text-xs font-bold transition-all bg-primary text-white">RECHTECK</button>
                <button onclick="window.setShape('triangle')" data-shape="triangle" class="shape-tab flex-1 py-2 rounded-lg border border-slate-200 text-xs font-bold transition-all">DREIECK</button>
                <button onclick="window.setShape('trapezoid')" data-shape="trapezoid" class="shape-tab flex-1 py-2 rounded-lg border border-slate-200 text-xs font-bold transition-all">TRAPEZ</button>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
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
            
            <button id="add-cut-btn" class="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-black transition-all shadow-md active:scale-[0.98]">
                TEIL HINZUFÜGEN
            </button>
            
            <div id="cut-display-list" class="mt-8 grid grid-cols-1 md:grid-cols-2 gap-2"></div>
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
            renderCuts();
            window.calculate();
            document.getElementById('cut-name').value = '';
        }
    };

    function renderCuts() {
        document.getElementById('cut-display-list').innerHTML = state.cuts.map((c, i) => `
            <div class="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100 group">
                <div class="flex items-center gap-3">
                    <div class="w-2 h-2 rounded-full bg-primary"></div>
                    <div>
                        <p class="text-sm font-bold">${c.qty}x ${c.name}</p>
                        <p class="text-[10px] text-slate-400 uppercase">${c.shape} — ${c.l} x ${c.w} mm</p>
                    </div>
                </div>
                <button onclick="state.cuts.splice(${i}, 1); renderCuts(); window.calculate();" class="text-error opacity-0 group-hover:opacity-100 transition-opacity">
                    <span class="material-symbols-outlined text-sm">close</span>
                </button>
            </div>
        `).join('');
    }

    window.addSheet();
    document.getElementById('add-sheet-btn').onclick = window.addSheet;
});
