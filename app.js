/* =========================   STATE MANAGEMENT  ========================= */
const state = {
    sheets: [], 
    cuts: [],   
    results: null
};

/* =========================   UI TEMPLATES   ========================= */

// Erzeugt das HTML für eine Platte
function createSheetHTML(index) {
    const letter = String.fromCharCode(65 + index);
    return `
    <section class="sheet-card bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6" data-index="${index}">
        <div class="flex items-center justify-between mb-6">
            <div class="flex items-center gap-3">
                <span class="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">${index + 1}</span>
                <h4 class="font-headline font-bold text-lg">Plattenformat ${letter}</h4>
            </div>
            <button onclick="removeSheet(${index})" class="text-red-500 flex items-center gap-1 text-sm font-medium hover:opacity-70">
                <span class="material-symbols-outlined text-lg">delete</span> Entfernen
            </button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="md:col-span-2 border-b pb-4">
                <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bezeichnung</label>
                <input class="sheet-name w-full bg-transparent border-none text-on-surface font-medium p-0 text-lg focus:ring-0" 
                       type="text" value="Standardformat ${letter}"/>
            </div>
            <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Länge (mm)</label>
                <input class="sheet-l w-full bg-slate-50 border-none rounded p-2 text-primary font-bold text-xl" 
                       type="number" value="2500" oninput="calculate()"/>
            </div>
            <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Breite (mm)</label>
                <input class="sheet-w w-full bg-slate-50 border-none rounded p-2 text-primary font-bold text-xl" 
                       type="number" value="1250" oninput="calculate()"/>
            </div>
            <div class="flex items-center justify-between md:col-span-2 pt-2">
                <span class="text-xs font-medium text-slate-500">Maserung beachten (Fixe Orientierung)</span>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" class="sheet-grain sr-only peer" checked onchange="calculate()">
                    <div class="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                </label>
            </div>
        </div>
    </section>`;
}

/* =========================   GLOBALE FUNKTIONEN   ========================= */
// Wir hängen die Funktionen direkt an window, damit "onclick" im HTML sie sicher findet

window.addSheet = function() {
    const container = document.getElementById('sheet-container');
    if (!container) return console.error("Container 'sheet-container' nicht gefunden!");
    
    const index = container.querySelectorAll('.sheet-card').length;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = createSheetHTML(index);
    container.appendChild(tempDiv.firstElementChild);
    calculate();
};

window.removeSheet = function(index) {
    const container = document.getElementById('sheet-container');
    const cards = container.querySelectorAll('.sheet-card');
    if (cards.length <= 1) return alert("Ein Format muss bleiben!");
    
    const target = container.querySelector(`.sheet-card[data-index="${index}"]`);
    if (target) target.remove();
    
    // Neu durchnummerieren
    container.querySelectorAll('.sheet-card').forEach((card, i) => {
        card.setAttribute('data-index', i);
        card.querySelector('.w-8.h-8').textContent = i + 1;
        card.querySelector('h4').textContent = `Plattenformat ${String.fromCharCode(65 + i)}`;
    });
    calculate();
};

window.calculate = function() {
    console.log("Berechnung gestartet...");
    const cards = document.querySelectorAll('.sheet-card');
    state.sheets = Array.from(cards).map(card => ({
        name: card.querySelector('.sheet-name').value,
        l: parseFloat(card.querySelector('.sheet-l').value) || 0,
        w: parseFloat(card.querySelector('.sheet-w').value) || 0,
        grain: card.querySelector('.sheet-grain').checked
    }));

    if (state.cuts.length === 0) {
        document.getElementById('results-canvas-container')?.classList.add('hidden');
        return;
    }

    // Zuschnitte vorbereiten
    let remainingCuts = [];
    state.cuts.forEach(c => {
        for(let i=0; i<c.qty; i++) remainingCuts.push({ ...c, id: Math.random() });
    });
    remainingCuts.sort((a, b) => (b.l * b.w) - (a.l * a.w));

    let usedSheets = [];
    const sheetDef = state.sheets[0]; // Wir nutzen das erste Format als Basis

    // Simpler Packing-Algorithmus
    while (remainingCuts.length > 0) {
        let placed = [];
        let freeRects = [{ x: 0, y: 0, w: sheetDef.l, h: sheetDef.w }];

        for (let i = 0; i < remainingCuts.length; i++) {
            let cut = remainingCuts[i];
            let fits = false;
            let fw = cut.l, fh = cut.w;

            for (let j = 0; j < freeRects.length; j++) {
                let fr = freeRects[j];
                // Passt es?
                if (fw <= fr.w && fh <= fr.h) {
                    fits = true;
                } else if (!sheetDef.grain && fh <= fr.w && fw <= fr.h) {
                    fits = true;
                    [fw, fh] = [fh, fw]; // Rotieren
                }

                if (fits) {
                    placed.push({ ...cut, x: fr.x, y: fr.y, pw: fw, ph: fh });
                    freeRects.splice(j, 1);
                    // Raum aufteilen
                    if (fr.w - fw > 0) freeRects.push({ x: fr.x + fw, y: fr.y, w: fr.w - fw, h: fh });
                    if (fr.h - fh > 0) freeRects.push({ x: fr.x, y: fr.y + fh, w: fr.w, h: fr.h - fh });
                    remainingCuts.splice(i, 1);
                    i--;
                    break;
                }
            }
        }
        if (placed.length === 0) break; // Schutz vor Endlosschleife
        usedSheets.push({ placements: placed });
    }

    state.results = { usedSheets };
    renderResults();
};

function renderResults() {
    const container = document.getElementById('results-canvas-container');
    const canvasList = document.getElementById('canvas-list');
    if (!container || !canvasList) return;

    container.classList.remove('hidden');
    canvasList.innerHTML = '';

    state.results.usedSheets.forEach((data, i) => {
        const wrap = document.createElement('div');
        wrap.className = "bg-white p-4 rounded-xl border mb-6";
        wrap.innerHTML = `<p class="text-[10px] font-bold text-primary mb-2">PLATTE #${i+1}</p>`;
        
        const canvas = document.createElement('canvas');
        canvas.className = "w-full rounded border";
        const ctx = canvas.getContext('2d');
        const sheet = state.sheets[0];
        const scale = 1000 / sheet.l;
        
        canvas.width = 1000;
        canvas.height = sheet.w * scale;

        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        data.placements.forEach(p => {
            ctx.fillStyle = "#00478d";
            ctx.strokeStyle = "white";
            ctx.fillRect(p.x * scale, p.y * scale, p.pw * scale, p.ph * scale);
            ctx.strokeRect(p.x * scale, p.y * scale, p.pw * scale, p.ph * scale);
            
            ctx.fillStyle = "white";
            ctx.font = "12px sans-serif";
            if (p.pw * scale > 40) {
                ctx.fillText(p.name, (p.x + 5) * scale, (p.y + 15) * scale);
            }
        });
        wrap.appendChild(canvas);
        canvasList.appendChild(wrap);
    });
}

/* =========================   INITIALISIERUNG   ========================= */

document.addEventListener("DOMContentLoaded", () => {
    console.log("App initialisiert...");
    
    // 1. Zuschnitt-Logik
    const addCutBtn = document.getElementById('add-cut-btn');
    if (addCutBtn) {
        addCutBtn.onclick = () => {
            const l = parseFloat(document.getElementById('cut-l').value);
            const w = parseFloat(document.getElementById('cut-w').value);
            const qty = parseInt(document.getElementById('cut-qty').value);
            const name = document.getElementById('cut-name').value || `Teil ${state.cuts.length + 1}`;
            
            if (l > 0 && w > 0) {
                state.cuts.push({ name, l, w, qty });
                renderCutList();
                calculate();
            }
        };
    }

    function renderCutList() {
        const list = document.getElementById('cut-display-list');
        if (!list) return;
        list.innerHTML = state.cuts.map((c, i) => `
            <div class="flex justify-between p-2 bg-slate-50 mb-1 rounded text-sm">
                <span>${c.qty}x ${c.name} (${c.l}x${c.w})</span>
                <button onclick="state.cuts.splice(${i}, 1); document.dispatchEvent(new Event('renderCuts')); window.calculate();" class="text-red-500">X</button>
            </div>
        `).join('');
    }
    
    // Event-Listener für das Löschen innerhalb des Maps (einfachere Lösung)
    document.addEventListener('renderCuts', renderCutList);

    // 2. Erste Platte laden
    window.addSheet();

    // 3. Button zum Hinzufügen von Formaten binden
    const addSheetBtn = document.getElementById('add-sheet-btn');
    if (addSheetBtn) addSheetBtn.onclick = window.addSheet;
});
