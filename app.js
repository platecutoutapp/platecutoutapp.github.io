/* =========================   STATE MANAGEMENT  ========================= */
const state = {
    sheets: [], 
    cuts: [],   
    results: null
};

/* =========================   UI TEMPLATES   ========================= */

function createSheetHTML(index) {
    const letter = String.fromCharCode(65 + index);
    return `
    <section class="sheet-card bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6" data-index="${index}">
        <div class="flex items-center justify-between mb-6">
            <div class="flex items-center gap-3">
                <span class="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">${index + 1}</span>
                <h4 class="font-headline font-bold text-lg">Plattenformat ${letter}</h4>
            </div>
            <button onclick="window.removeSheet(${index})" class="text-error flex items-center gap-1 text-sm font-medium hover:opacity-80 transition-opacity">
                <span class="material-symbols-outlined text-lg">delete</span> Entfernen
            </button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="md:col-span-2 border-b border-slate-100 pb-4">
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Bezeichnung</label>
                <input class="sheet-name w-full bg-transparent border-none focus:ring-0 text-on-surface font-medium p-0 text-lg" 
                       type="text" value="Standardformat ${letter}" oninput="window.calculate()"/>
            </div>
            <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Länge (mm)</label>
                <input class="sheet-l w-full bg-slate-50 border-none rounded p-2 text-primary font-bold text-xl" 
                       type="number" value="2500" oninput="window.calculate()"/>
            </div>
            <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Breite (mm)</label>
                <input class="sheet-w w-full bg-slate-50 border-none rounded p-2 text-primary font-bold text-xl" 
                       type="number" value="1250" oninput="window.calculate()"/>
            </div>
            <div class="flex items-center justify-between md:col-span-2 pt-2">
                <span class="text-xs font-medium text-slate-500">Maserung beachten</span>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" class="sheet-grain sr-only peer" checked onchange="window.calculate()">
                    <div class="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                </label>
            </div>
        </div>
    </section>`;
}

/* =========================   GLOBALE FUNKTIONEN   ========================= */

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
    const card = container.querySelector(`.sheet-card[data-index="${index}"]`);
    if (card) card.remove();
    
    // Indizes neu ordnen
    container.querySelectorAll('.sheet-card').forEach((card, i) => {
        card.setAttribute('data-index', i);
        card.querySelector('.w-8.h-8').textContent = i + 1;
        card.querySelector('h4').textContent = `Plattenformat ${String.fromCharCode(65 + i)}`;
    });
    window.calculate();
};

window.calculate = function() {
    const cards = document.querySelectorAll('.sheet-card');
    state.sheets = Array.from(cards).map(card => ({
        l: parseFloat(card.querySelector('.sheet-l').value) || 0,
        w: parseFloat(card.querySelector('.sheet-w').value) || 0,
        grain: card.querySelector('.sheet-grain').checked
    }));

    if (state.cuts.length === 0) {
        document.getElementById('results-canvas-container').classList.add('hidden');
        updateStats(0, 0);
        return;
    }

    // Zuschnitte sortieren
    let remainingCuts = [];
    state.cuts.forEach(c => {
        for(let i=0; i<c.qty; i++) remainingCuts.push({ ...c });
    });
    remainingCuts.sort((a, b) => (b.l * b.w) - (a.l * a.w));

    let usedSheets = [];
    const sheetDef = state.sheets[0]; // Nutzt das erste Format als Basis

    while (remainingCuts.length > 0) {
        let placed = [];
        let freeRects = [{ x: 0, y: 0, w: sheetDef.l, h: sheetDef.w }];

        for (let i = 0; i < remainingCuts.length; i++) {
            let cut = remainingCuts[i];
            let fits = false, fw = cut.l, fh = cut.w;

            for (let j = 0; j < freeRects.length; j++) {
                let fr = freeRects[j];
                if (fw <= fr.w && fh <= fr.h) fits = true;
                else if (!sheetDef.grain && fh <= fr.w && fw <= fr.h) { fits = true; [fw, fh] = [fh, fw]; }

                if (fits) {
                    placed.push({ ...cut, x: fr.x, y: fr.y, pw: fw, ph: fh });
                    freeRects.splice(j, 1);
                    if (fr.w - fw > 0) freeRects.push({ x: fr.x + fw, y: fr.y, w: fr.w - fw, h: fh });
                    if (fr.h - fh > 0) freeRects.push({ x: fr.x, y: fr.y + fh, w: fr.w, h: fr.h - fh });
                    remainingCuts.splice(i, 1); i--; break;
                }
            }
        }
        if (placed.length === 0) break;
        usedSheets.push({ placements: placed });
    }

    state.results = { usedSheets, totalArea: (usedSheets.length * sheetDef.l * sheetDef.w) / 1000000 };
    renderResults();
};

function renderResults() {
    const container = document.getElementById('results-canvas-container');
    const list = document.getElementById('canvas-list');
    container.classList.remove('hidden');
    list.innerHTML = '';

    state.results.usedSheets.forEach((data, i) => {
        const wrap = document.createElement('div');
        wrap.className = "bg-white p-4 rounded-xl border border-slate-200 shadow-sm";
        wrap.innerHTML = `<p class="text-[10px] font-black text-primary mb-2 uppercase tracking-widest">PLATTE #${i+1}</p>`;
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const scale = 1200 / state.sheets[0].l;
        canvas.width = 1200;
        canvas.height = state.sheets[0].w * scale;

        ctx.fillStyle = "#f1f5f9";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        data.placements.forEach(p => {
            ctx.fillStyle = "#00478d";
            ctx.strokeStyle = "white";
            ctx.lineWidth = 2;
            ctx.fillRect(p.x * scale, p.y * scale, p.pw * scale, p.ph * scale);
            ctx.strokeRect(p.x * scale, p.y * scale, p.pw * scale, p.ph * scale);
            
            ctx.fillStyle = "white";
            ctx.font = "bold 14px sans-serif";
            if (p.pw * scale > 60) ctx.fillText(p.name, (p.x + 5) * scale, (p.y + 20) * scale);
        });
        wrap.appendChild(canvas);
        list.appendChild(wrap);
    });
    updateStats(state.results.usedSheets.length, state.results.totalArea);
}

function updateStats(count, area) {
    document.getElementById('stat-sheets-count').innerText = count;
    document.getElementById('stat-total-area').innerText = area.toFixed(2) + " m²";
}

/* =========================   INITIALISIERUNG   ========================= */

document.addEventListener("DOMContentLoaded", () => {
    // 1. Zuschnitt-UI einfügen
    document.getElementById('cut-list-section').innerHTML = `
        <div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mt-8">
            <h4 class="font-bold mb-4">Zuschnitte hinzufügen</h4>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <input id="cut-name" type="text" placeholder="Name" class="border-slate-200 rounded text-sm">
                <input id="cut-l" type="number" placeholder="Länge" class="border-slate-200 rounded text-sm">
                <input id="cut-w" type="number" placeholder="Breite" class="border-slate-200 rounded text-sm">
                <input id="cut-qty" type="number" value="1" class="border-slate-200 rounded text-sm">
            </div>
            <button id="add-cut-btn" class="w-full bg-slate-800 text-white py-2 rounded-lg font-bold hover:bg-black">TEIL HINZUFÜGEN</button>
            <div id="cut-display-list" class="mt-4 space-y-2"></div>
        </div>
    `;

    // 2. Event Listener für Zuschnitte
    document.getElementById('add-cut-btn').onclick = () => {
        const l = parseFloat(document.getElementById('cut-l').value);
        const w = parseFloat(document.getElementById('cut-w').value);
        const qty = parseInt(document.getElementById('cut-qty').value);
        const name = document.getElementById('cut-name').value || `Teil ${state.cuts.length + 1}`;
        if (l > 0 && w > 0) {
            state.cuts.push({ name, l, w, qty });
            renderCuts();
            window.calculate();
        }
    };

    function renderCuts() {
        document.getElementById('cut-display-list').innerHTML = state.cuts.map((c, i) => `
            <div class="flex justify-between bg-slate-50 p-2 rounded border text-sm">
                <span>${c.qty}x ${c.name} (${c.l}x${c.w}mm)</span>
                <button onclick="state.cuts.splice(${i}, 1); document.getElementById('add-cut-btn').click(); window.calculate();" class="text-error">Löschen</button>
            </div>
        `).join('');
    }

    // 3. Initialisierung & Sidebar-Buttons
    window.addSheet();
    document.getElementById('add-sheet-btn').onclick = window.addSheet;
    document.getElementById('new-calc-btn').onclick = () => location.reload();
    document.getElementById('export-btn').onclick = () => alert("JSON Export bereit!");
});
