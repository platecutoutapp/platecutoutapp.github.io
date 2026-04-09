/* =========================   STATE MANAGEMENT  ========================= */
const state = {
    sheets: [], 
    cuts: [],   
    results: null
};

/* =========================   UI TEMPLATES   ========================= */

function createSheetHTML(index) {
    const letter = String.fromCharCode(65 + index);
    // Standardwerte für das erste Format, sonst leer oder Standard
    const defaultL = 2500;
    const defaultW = 1250;
    
    return `
    <section class="sheet-card bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md mb-6" data-index="${index}">
        <div class="flex items-center justify-between mb-6">
            <div class="flex items-center gap-3">
                <span class="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">${index + 1}</span>
                <h4 class="font-headline font-bold text-lg">Plattenformat ${letter}</h4>
            </div>
            <button onclick="removeSheet(${index})" class="text-error flex items-center gap-1 text-sm font-medium hover:opacity-80 transition-opacity">
                <span class="material-symbols-outlined text-lg">delete</span> Entfernen
            </button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="md:col-span-2 border-b border-slate-100 pb-4">
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Bezeichnung</label>
                <input class="sheet-name w-full bg-transparent border-none focus:ring-0 text-on-surface font-medium p-0 text-lg" 
                       placeholder="z.B. Sperrholz 18mm" type="text" value="Standardformat ${letter}"/>
            </div>
            <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Länge (mm)</label>
                <input class="sheet-l w-full bg-slate-50 border-none rounded p-2 focus:ring-2 focus:ring-primary/20 text-primary font-bold text-xl" 
                       type="number" value="${defaultL}" oninput="calculate()"/>
            </div>
            <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Breite (mm)</label>
                <input class="sheet-w w-full bg-slate-50 border-none rounded p-2 focus:ring-2 focus:ring-primary/20 text-primary font-bold text-xl" 
                       type="number" value="${defaultW}" oninput="calculate()"/>
            </div>
            <div class="flex items-center justify-between md:col-span-2 pt-2">
                <span class="text-xs font-medium text-slate-500">Maserung beachten (Rotation 180°)</span>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" class="sheet-grain sr-only peer" checked onchange="calculate()">
                    <div class="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                </label>
            </div>
        </div>
    </section>`;
}

/* =========================   CORE ACTIONS   ========================= */

function addSheet() {
    const container = document.getElementById('sheet-container');
    const index = container.querySelectorAll('.sheet-card').length;
    const div = document.createElement('div');
    div.innerHTML = createSheetHTML(index);
    container.appendChild(div.firstElementChild);
    calculate(); 
}

function removeSheet(index) {
    const container = document.getElementById('sheet-container');
    // Wir lassen das Löschen nur zu, wenn mehr als eine Karte da ist
    if (container.querySelectorAll('.sheet-card').length <= 1) {
        alert("Mindestens ein Plattenformat muss definiert sein.");
        return;
    }
    
    const card = container.querySelector(`.sheet-card[data-index="${index}"]`);
    if (card) card.remove();
    
    // Indizes neu sortieren
    reindexSheets();
    calculate();
}

function reindexSheets() {
    document.querySelectorAll('.sheet-card').forEach((card, i) => {
        card.setAttribute('data-index', i);
        card.querySelector('.w-8.h-8').textContent = i + 1;
        const letter = String.fromCharCode(65 + i);
        card.querySelector('h4').textContent = `Plattenformat ${letter}`;
    });
}

function createCutListUI() {
    const container = document.getElementById('cut-list-section');
    container.className = "bg-white p-8 rounded-xl border border-slate-200 mt-8 shadow-sm";
    container.innerHTML = `
        <h4 class="font-bold text-lg mb-6">Zuschnittliste</h4>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <input id="cut-name" type="text" placeholder="Name (z.B. Seite Links)" class="border-slate-200 rounded">
            <input id="cut-l" type="number" placeholder="Länge (mm)" class="border-slate-200 rounded">
            <input id="cut-w" type="number" placeholder="Breite (mm)" class="border-slate-200 rounded">
            <input id="cut-qty" type="number" value="1" class="border-slate-200 rounded">
        </div>
        <button id="add-cut-btn" class="bg-slate-800 text-white px-8 py-3 rounded-lg font-bold text-sm hover:bg-black transition-all w-full md:w-auto">
            TEIL HINZUFÜGEN
        </button>
        <div id="cut-display-list" class="mt-8 space-y-2"></div>
    `;

    document.getElementById('add-cut-btn').onclick = () => {
        const l = parseFloat(document.getElementById('cut-l').value);
        const w = parseFloat(document.getElementById('cut-w').value);
        const qty = parseInt(document.getElementById('cut-qty').value);
        
        if (l > 0 && w > 0 && qty > 0) {
            const count = state.cuts.length + 1;
            const name = document.getElementById('cut-name').value.trim() || `Element ${count}`;
            state.cuts.push({ name, l, w, qty });
            renderCutList();
            calculate();
            
            // Reset
            document.getElementById('cut-name').value = '';
            document.getElementById('cut-l').value = '';
            document.getElementById('cut-w').value = '';
            document.getElementById('cut-qty').value = '1';
        }
    };
}

function renderCutList() {
    const list = document.getElementById('cut-display-list');
    list.innerHTML = state.cuts.map((cut, i) => `
        <div class="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100 group">
            <span class="text-sm font-medium"><b>${cut.qty}x</b> ${cut.name} <span class="text-slate-400">(${cut.l}x${cut.w}mm)</span></span>
            <button onclick="state.cuts.splice(${i}, 1); renderCutList(); calculate();" class="text-error text-xs font-bold">LÖSCHEN</button>
        </div>
    `).join('');
}

/* =========================   ALGORITHMUS   ========================= */

function calculate() {
    const cards = document.querySelectorAll('.sheet-card');
    if (cards.length === 0) return;

    state.sheets = Array.from(cards).map(card => ({
        name: card.querySelector('.sheet-name').value,
        l: parseFloat(card.querySelector('.sheet-l').value) || 0,
        w: parseFloat(card.querySelector('.sheet-w').value) || 0,
        grain: card.querySelector('.sheet-grain').checked
    }));

    if (state.cuts.length === 0) {
        document.getElementById('results-canvas-container').classList.add('hidden');
        updateSummary(0, 0);
        return;
    }

    let remainingCuts = [];
    state.cuts.forEach(c => {
        for(let i=0; i<c.qty; i++) remainingCuts.push({ ...c });
    });
    remainingCuts.sort((a, b) => (b.l * b.w) - (a.l * a.w));

    let usedSheets = [];
    // Wir nehmen das erste definierte Format für die Berechnung
    const sheetDef = state.sheets[0];

    while (remainingCuts.length > 0) {
        let placed = [];
        let freeRects = [{ x: 0, y: 0, w: sheetDef.l, h: sheetDef.w }];

        for (let i = 0; i < remainingCuts.length; i++) {
            let cut = remainingCuts[i];
            let fits = false;
            let fw = cut.l, fh = cut.w;

            for (let j = 0; j < freeRects.length; j++) {
                let fr = freeRects[j];
                if (fw <= fr.w && fh <= fr.h) {
                    fits = true;
                } else if (!sheetDef.grain && fh <= fr.w && fw <= fr.h) {
                    fits = true;
                    [fw, fh] = [fh, fw];
                }

                if (fits) {
                    placed.push({ ...cut, x: fr.x, y: fr.y, pw: fw, ph: fh });
                    freeRects.splice(j, 1);
                    if (fr.w - fw > 0) freeRects.push({ x: fr.x + fw, y: fr.y, w: fr.w - fw, h: fh });
                    if (fr.h - fh > 0) freeRects.push({ x: fr.x, y: fr.y + fh, w: fr.w, h: fr.h - fh });
                    remainingCuts.splice(i, 1);
                    i--;
                    break;
                }
            }
        }
        
        if (placed.length === 0) break; // Schutz gegen zu große Teile
        usedSheets.push({ sheet: sheetDef, placements: placed });
    }

    state.results = { usedSheets, totalArea: (usedSheets.length * sheetDef.l * sheetDef.w) / 1000000 };
    renderResults();
}

function renderResults() {
    const container = document.getElementById('results-canvas-container');
    const canvasList = document.getElementById('canvas-list');
    container.classList.remove('hidden');
    canvasList.innerHTML = '';

    state.results.usedSheets.forEach((data, i) => {
        const wrap = document.createElement('div');
        wrap.className = "bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6";
        wrap.innerHTML = `<p class="text-[10px] font-black text-primary mb-2 uppercase">PLATTE #${i+1} (${data.sheet.l}x${data.sheet.w}mm)</p>`;
        
        const canvas = document.createElement('canvas');
        canvas.className = "w-full h-auto rounded";
        const ctx = canvas.getContext('2d');
        const scale = 1200 / data.sheet.l;
        canvas.width = 1200;
        canvas.height = data.sheet.w * scale;

        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        data.placements.forEach(p => {
            ctx.fillStyle = "#00478d";
            ctx.strokeStyle = "white";
            ctx.lineWidth = 2;
            ctx.fillRect(p.x * scale, p.y * scale, p.pw * scale, p.ph * scale);
            ctx.strokeRect(p.x * scale, p.y * scale, p.pw * scale, p.ph * scale);

            // Beschriftung auf Canvas
            if (p.pw * scale > 50) {
                ctx.fillStyle = "white";
                ctx.font = "bold 14px Inter";
                ctx.textAlign = "center";
                ctx.fillText(p.name, (p.x + p.pw/2) * scale, (p.y + p.ph/2 + 5) * scale);
            }
        });
        wrap.appendChild(canvas);
        canvasList.appendChild(wrap);
    });

    updateSummary(state.results.usedSheets.length, state.results.totalArea);
}

function updateSummary(count, area) {
    document.getElementById('stat-sheets-count').innerText = count;
    document.getElementById('stat-total-area').innerText = area.toFixed(2) + " m²";
}

/* =========================   INIT   ========================= */

document.addEventListener("DOMContentLoaded", () => {
    // 1. UI Initialisieren
    createCutListUI();

    // 2. Standard-Platte hinzufügen
    addSheet();

    // 3. Event Listener für Buttons (Sicherstellen, dass IDs passen)
    const addSheetBtn = document.getElementById('add-sheet-btn');
    if (addSheetBtn) addSheetBtn.onclick = addSheet;

    const newCalcBtn = document.getElementById('new-calc-btn');
    if (newCalcBtn) {
        newCalcBtn.onclick = () => {
            if (state.cuts.length > 0) {
                if (confirm("Möchten Sie alle Eingaben löschen?")) {
                    state.cuts = [];
                    renderCutList();
                    // Optional: Platten auch resetten? Hier nur Cuts:
                    calculate();
                }
            }
        };
    }

    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
        exportBtn.onclick = () => {
            const data = JSON.stringify({sheets: state.sheets, cuts: state.cuts});
            const blob = new Blob([data], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = "projekt.json"; a.click();
        };
    }
});
