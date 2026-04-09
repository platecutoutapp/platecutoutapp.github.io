/* =========================   STATE MANAGEMENT  ========================= */
const state = {
    sheets: [], // Verfügbare Rohformate (Typen)
    cuts: [],   // Gewünschte Zuschnitte
    results: null
};

/* =========================   UI TEMPLATES   ========================= */

// Erstellt die HTML-Struktur für ein Plattenformat (ohne Anzahl-Eingabe)
function createSheetHTML(index) {
    const letter = String.fromCharCode(65 + index);
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
                       placeholder="z.B. Sperrholz 18mm" type="text" value="Format ${letter}"/>
            </div>
            <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Länge (mm)</label>
                <input class="sheet-l w-full bg-slate-50 border-none rounded p-2 focus:ring-2 focus:ring-primary/20 text-primary font-bold text-xl" type="number" value="2500"/>
            </div>
            <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Breite (mm)</label>
                <input class="sheet-w w-full bg-slate-50 border-none rounded p-2 focus:ring-2 focus:ring-primary/20 text-primary font-bold text-xl" type="number" value="1250"/>
            </div>
            <div class="flex items-center justify-between md:col-span-2 pt-2">
                <span class="text-xs font-medium text-slate-500">Maserung beachten (Rotation 180°)</span>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" class="sheet-grain sr-only peer" checked>
                    <div class="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                </label>
            </div>
        </div>
    </section>`;
}

/* =========================   CORE ACTIONS   ========================= */

function addSheet() {
    const container = document.getElementById('sheet-container');
    const index = document.querySelectorAll('.sheet-card').length;
    const div = document.createElement('div');
    div.innerHTML = createSheetHTML(index);
    container.appendChild(div.firstElementChild);
    calculate(); // Live-Update
}

function removeSheet(index) {
    const container = document.getElementById('sheet-container');
    if (container.children.length <= 1) return alert("Mindestens ein Format muss vorhanden sein.");
    
    const card = document.querySelector(`.sheet-card[data-index="${index}"]`);
    card?.remove();
    
    // Indizes und Titel neu ordnen
    document.querySelectorAll('.sheet-card').forEach((card, i) => {
        card.setAttribute('data-index', i);
        card.querySelector('.w-8.h-8').textContent = i + 1;
        const letter = String.fromCharCode(65 + i);
        card.querySelector('h4').textContent = `Plattenformat ${letter}`;
    });
    calculate();
}

function createCutListUI() {
    const container = document.getElementById('cut-list-section');
    container.className = "bg-white p-8 rounded-xl border border-slate-200 mt-8 shadow-sm";
    container.innerHTML = `
        <h4 class="font-bold text-lg mb-6">Zuschnittliste</h4>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div class="flex flex-col">
                <label class="text-[10px] font-bold text-slate-400 uppercase mb-1">Teil-Name (Optional)</label>
                <input id="cut-name" type="text" placeholder="Auto-Nummerierung" class="border-slate-200 rounded focus:ring-primary focus:border-primary">
            </div>
            <div class="flex flex-col">
                <label class="text-[10px] font-bold text-slate-400 uppercase mb-1">Länge (mm)</label>
                <input id="cut-l" type="number" placeholder="200" class="border-slate-200 rounded focus:ring-primary focus:border-primary">
            </div>
            <div class="flex flex-col">
                <label class="text-[10px] font-bold text-slate-400 uppercase mb-1">Breite (mm)</label>
                <input id="cut-w" type="number" placeholder="150" class="border-slate-200 rounded focus:ring-primary focus:border-primary">
            </div>
            <div class="flex flex-col">
                <label class="text-[10px] font-bold text-slate-400 uppercase mb-1">Anzahl</label>
                <input id="cut-qty" type="number" value="1" class="border-slate-200 rounded focus:ring-primary focus:border-primary">
            </div>
        </div>
        <button id="add-cut-btn" class="bg-slate-800 text-white px-8 py-3 rounded-lg font-bold text-sm hover:bg-black transition-all w-full md:w-auto flex items-center justify-center gap-2">
            <span class="material-symbols-outlined text-sm">add</span> TEIL HINZUFÜGEN
        </button>
        <div id="cut-display-list" class="mt-8 space-y-2"></div>
    `;

    document.getElementById('add-cut-btn').onclick = () => {
        const l = parseFloat(document.getElementById('cut-l').value);
        const w = parseFloat(document.getElementById('cut-w').value);
        const qty = parseInt(document.getElementById('cut-qty').value);
        
        if (l > 0 && w > 0 && qty > 0) {
            // Automatische Nummerierung wenn kein Name vergeben wurde
            const count = state.cuts.length + 1;
            const name = document.getElementById('cut-name').value.trim() || `Element ${count}`;
            
            state.cuts.push({ name, l, w, qty });
            renderCutList();
            calculate();
            
            // Reset Inputs
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
            <div class="flex items-center gap-4">
                <span class="text-xs font-bold bg-slate-200 px-2 py-1 rounded">${cut.qty}x</span>
                <span class="text-sm font-medium text-slate-700">${cut.name} <span class="text-slate-400 ml-2">(${cut.l} x ${cut.w} mm)</span></span>
            </div>
            <button onclick="state.cuts.splice(${i}, 1); renderCutList(); calculate();" class="text-error opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold flex items-center gap-1">
                <span class="material-symbols-outlined text-sm">delete</span> LÖSCHEN
            </button>
        </div>
    `).join('');
}

/* =========================   ALGORITHMUS   ========================= */

function calculate() {
    // UI auslesen
    state.sheets = Array.from(document.querySelectorAll('.sheet-card')).map(card => ({
        name: card.querySelector('.sheet-name').value,
        l: parseFloat(card.querySelector('.sheet-l').value),
        w: parseFloat(card.querySelector('.sheet-w').value),
        grain: card.querySelector('.sheet-grain').checked
    }));

    if (state.cuts.length === 0) {
        document.getElementById('results-canvas-container').classList.add('hidden');
        updateSummary(0, 0);
        return;
    }

    // Alle Einzelteile flachklopfen
    let remainingCuts = [];
    state.cuts.forEach(c => {
        for(let i=0; i<c.qty; i++) {
            remainingCuts.push({ ...c, id: Math.random() });
        }
    });

    // Sortierung: Größte Fläche zuerst
    remainingCuts.sort((a, b) => (b.l * b.w) - (a.l * a.w));

    let usedSheets = [];
    let unplaced = [];

    // Wir nutzen das erste definierte Plattenformat als Standard und fügen 
    // neue Platten hinzu, bis alle Schnitte platziert sind.
    const sheetFormat = state.sheets[0]; 

    while (remainingCuts.length > 0) {
        let placedOnThisSheet = [];
        let freeRects = [{ x: 0, y: 0, w: sheetFormat.l, h: sheetFormat.w }];

        for (let i = 0; i < remainingCuts.length; i++) {
            let cut = remainingCuts[i];
            let fits = false;
            let finalW = cut.l, finalH = cut.w;

            for (let j = 0; j < freeRects.length; j++) {
                let fr = freeRects[j];
                
                // Normaler Fit
                if (finalW <= fr.w && finalH <= fr.h) {
                    fits = true;
                } 
                // Rotation erlaubt?
                else if (!sheetFormat.grain && finalH <= fr.w && finalW <= fr.h) {
                    fits = true;
                    [finalW, finalH] = [finalH, finalW];
                }

                if (fits) {
                    placedOnThisSheet.push({ ...cut, x: fr.x, y: fr.y, pw: finalW, ph: finalH });
                    
                    // Guillotine-Split
                    freeRects.splice(j, 1);
                    if (fr.w - finalW > 0) freeRects.push({ x: fr.x + finalW, y: fr.y, w: fr.w - finalW, h: finalH });
                    if (fr.h - finalH > 0) freeRects.push({ x: fr.x, y: fr.y + finalH, w: fr.w, h: fr.h - finalH });
                    
                    remainingCuts.splice(i, 1);
                    i--;
                    break;
                }
            }
        }

        // Falls wir in einem Durchlauf gar nichts platzieren konnten (Teil zu groß für Platte)
        if (placedOnThisSheet.length === 0 && remainingCuts.length > 0) {
            unplaced.push(remainingCuts.shift());
        } else {
            usedSheets.push({ sheet: sheetFormat, placements: placedOnThisSheet });
        }
    }

    state.results = { 
        usedSheets, 
        totalArea: (usedSheets.length * sheetFormat.l * sheetFormat.w) / 1000000 
    };
    
    renderResults();
}

/* =========================   VISUALIZATION   ========================= */

function renderResults() {
    const container = document.getElementById('results-canvas-container');
    const canvasList = document.getElementById('canvas-list');
    container.classList.remove('hidden');
    canvasList.innerHTML = '';

    state.results.usedSheets.forEach((data, i) => {
        const wrapper = document.createElement('div');
        wrapper.className = "bg-white p-4 rounded-xl border border-slate-200 shadow-sm";
        wrapper.innerHTML = `<p class="text-[10px] font-black text-primary mb-3 uppercase tracking-widest">PLATTE #${i+1} — ${data.sheet.name}</p>`;
        
        const canvas = document.createElement('canvas');
        canvas.className = "w-full h-auto rounded-md shadow-inner";
        const ctx = canvas.getContext('2d');
        
        const scale = 1200 / data.sheet.l;
        canvas.width = 1200;
        canvas.height = data.sheet.w * scale;

        // Hintergrund
        ctx.fillStyle = "#f1f5f9";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        data.placements.forEach(p => {
            // Box zeichnen
            ctx.fillStyle = "#00478d";
            ctx.strokeStyle = "rgba(255,255,255,0.5)";
            ctx.lineWidth = 2;
            
            const rx = p.x * scale;
            const ry = p.y * scale;
            const rw = p.pw * scale;
            const rh = p.ph * scale;

            ctx.fillRect(rx, ry, rw, rh);
            ctx.strokeRect(rx, ry, rw, rh);

            // Beschriftung (Name auf dem Teil)
            if (rw > 40 && rh > 20) {
                ctx.fillStyle = "white";
                ctx.font = "bold 14px Inter, sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                // Text abschneiden falls zu lang
                let displayName = p.name;
                if (ctx.measureText(displayName).width > rw - 10) {
                    displayName = displayName.substring(0, 5) + "..";
                }
                ctx.fillText(displayName, rx + rw / 2, ry + rh / 2);
            }
        });

        wrapper.appendChild(canvas);
        canvasList.appendChild(wrapper);
    });

    updateSummary(state.results.usedSheets.length, state.results.totalArea);
}

function updateSummary(count, area) {
    document.getElementById('stat-sheets-count').innerText = count;
    document.getElementById('stat-total-area').innerText = area.toFixed(2) + " m²";
}

/* =========================   APP MANAGEMENT   ========================= */

function startNewCalculation() {
    // Prüfung ob Daten vorhanden sind
    const hasData = state.cuts.length > 0 || document.querySelectorAll('.sheet-card').length > 1;
    
    if (hasData) {
        if (!confirm("Alle Eingaben löschen und neues Projekt starten?")) return;
    }

    state.cuts = [];
    state.results = null;
    document.getElementById('sheet-container').innerHTML = '';
    document.getElementById('cut-display-list').innerHTML = '';
    document.getElementById('results-canvas-container').classList.add('hidden');
    
    addSheet();
    renderCutList();
}

function exportJSON() {
    if (state.cuts.length === 0) return alert("Keine Daten zum Exportieren vorhanden.");
    
    const exportData = {
        project: "OptiCut Export",
        date: new Date().toISOString(),
        sheets: state.sheets,
        cuts: state.cuts,
        results: {
            plateCount: state.results?.usedSheets.length,
            totalArea: state.results?.totalArea
        }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Zuschnittplan_${new Date().toLocaleDateString()}.json`;
    a.click();
}

/* =========================   INIT   ========================= */

document.addEventListener("DOMContentLoaded", () => {
    // Initialisierung
    addSheet();
    createCutListUI();

    // Event Listener für Live-Update (Delegation)
    document.getElementById('sheet-container').addEventListener('input', () => calculate());
    
    // Buttons
    document.getElementById('add-sheet-btn').onclick = addSheet;
    document.getElementById('new-calc-btn').onclick = startNewCalculation;
    document.getElementById('export-btn').onclick = exportJSON;
    
    // Optionaler Optimieren Button (falls noch im HTML vorhanden)
    const optBtn = document.getElementById('optimize-btn');
    if(optBtn) optBtn.onclick = calculate;
});
