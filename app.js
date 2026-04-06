/* =========================   STATE MANAGEMENT  ========================= */
const state = {
    sheets: [], // Verfügbare Rohplatten
    cuts: [],   // Gewünschte Zuschnitte
    results: null
};

/* =========================   UI TEMPLATES  ========================= */
function createSheetHTML(index) {
    return `
    <section class="sheet-card bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/20 shadow-sm transition-all hover:shadow-md mb-6" data-index="${index}">
        <div class="flex items-center justify-between mb-8">
            <div class="flex items-center gap-3">
                <span class="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center text-primary font-bold text-sm">${index + 1}</span>
                <h4 class="font-headline font-bold text-lg">Plattenformat</h4>
            </div>
            <button onclick="removeSheet(${index})" class="text-error flex items-center gap-1 text-sm font-medium hover:opacity-80 transition-opacity">
                <span class="material-symbols-outlined text-lg">delete</span> Entfernen
            </button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
            <div class="md:col-span-2">
                <label class="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Bezeichnung</label>
                <div class="ghost-border-bottom py-2 px-2"><input class="sheet-name w-full bg-transparent border-none focus:ring-0 text-on-surface font-medium p-0" placeholder="z.B. Sperrholz 18mm" type="text" value="Standardformat ${String.fromCharCode(65 + index)}"/></div>
            </div>
            <div>
                <label class="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Länge (mm)</label>
                <div class="ghost-border-bottom py-2 flex items-center px-2"><input class="sheet-l w-full bg-transparent border-none focus:ring-0 text-on-surface font-bold text-xl p-0" type="number" value="2500"/></div>
            </div>
            <div>
                <label class="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Breite (mm)</label>
                <div class="ghost-border-bottom py-2 flex items-center px-2"><input class="sheet-w w-full bg-transparent border-none focus:ring-0 text-on-surface font-bold text-xl p-0" type="number" value="1250"/></div>
            </div>
            <div>
                <label class="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Anzahl</label>
                <div class="ghost-border-bottom py-2 flex items-center px-2"><input class="sheet-qty w-full bg-transparent border-none focus:ring-0 text-on-surface font-bold text-xl p-0" type="number" value="10"/></div>
            </div>
            <div class="flex items-center justify-between py-4">
                <div><label class="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Maserung beachten</label></div>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" class="sheet-grain sr-only peer" checked>
                    <div class="w-11 h-6 bg-surface-container-high rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                </label>
            </div>
        </div>
    </section>`;
}

/* =========================   CORE ACTIONS  ========================= */
function addSheet() {
    const container = document.getElementById('sheet-container');
    const index = document.querySelectorAll('.sheet-card').length;
    const div = document.createElement('div');
    div.innerHTML = createSheetHTML(index);
    container.appendChild(div.firstElementChild);
    updateSummary();
}

function removeSheet(index) {
    const card = document.querySelector(`.sheet-card[data-index="${index}"]`);
    card?.remove();
    // Indices neu ordnen
    document.querySelectorAll('.sheet-card').forEach((card, i) => {
        card.setAttribute('data-index', i);
        card.querySelector('.w-8.h-8').textContent = i + 1;
    });
    updateSummary();
}

function readUI() {
    // Platten auslesen
    state.sheets = Array.from(document.querySelectorAll('.sheet-card')).map(card => ({
        name: card.querySelector('.sheet-name').value,
        length: parseFloat(card.querySelector('.sheet-l').value),
        width: parseFloat(card.querySelector('.sheet-w').value),
        qty: parseInt(card.querySelector('.sheet-qty').value),
        grain: card.querySelector('.sheet-grain').checked
    }));
}

/* =========================   ALGORITHM (SIMPLE SHELF PACKING)  ========================= */
function calculate() {
    readUI();
    if (state.cuts.length === 0) return alert("Bitte fügen Sie zuerst Zuschnitte hinzu.");

    let remainingCuts = [];
    state.cuts.forEach(c => {
        for(let i=0; i<c.qty; i++) remainingCuts.push({...c, id: Math.random()});
    });

    // Sortierung: Größte Fläche zuerst
    remainingCuts.sort((a, b) => (b.w * b.h) - (a.w * a.h));

    let usedSheets = [];
    let currentCuts = [...remainingCuts];

    // Simpler Algorithmus: Versuche Platten nacheinander zu füllen
    for (let sheetDef of state.sheets) {
        for (let q = 0; q < sheetDef.qty; q++) {
            if (currentCuts.length === 0) break;

            let placed = [];
            let freeRects = [{ x: 0, y: 0, w: sheetDef.length, h: sheetDef.width }];

            for (let i = 0; i < currentCuts.length; i++) {
                let cut = currentCuts[i];
                for (let j = 0; j < freeRects.length; j++) {
                    let fr = freeRects[j];
                    
                    // Prüfe Orientierung (Maserung beachten)
                    let fits = false;
                    let finalW = cut.w, finalH = cut.h;

                    if (finalW <= fr.w && finalH <= fr.h) {
                        fits = true;
                    } else if (!sheetDef.grain && finalH <= fr.w && finalW <= fr.h) {
                        fits = true;
                        [finalW, finalH] = [finalH, finalW];
                    }

                    if (fits) {
                        placed.push({ ...cut, x: fr.x, y: fr.y, w: finalW, h: finalH });
                        // Splitte freien Platz (einfacher Guillotine-Schnitt)
                        freeRects.splice(j, 1);
                        if (fr.w - finalW > 0) freeRects.push({ x: fr.x + finalW, y: fr.y, w: fr.w - finalW, h: finalH });
                        if (fr.h - finalH > 0) freeRects.push({ x: fr.x, y: fr.y + finalH, w: fr.w, h: fr.h - finalH });
                        
                        currentCuts.splice(i, 1);
                        i--;
                        break;
                    }
                }
            }
            if (placed.length > 0) {
                usedSheets.push({ sheet: sheetDef, placements: placed });
            }
        }
    }

    state.results = { 
        usedSheets, 
        unplaced: currentCuts,
        totalArea: usedSheets.reduce((sum, s) => sum + (s.sheet.length * s.sheet.width), 0) / 1000000
    };
    
    renderResults();
}

/* =========================   VISUALIZATION  ========================= */
function renderResults() {
    updateSummary();
    const container = document.getElementById('results-canvas-container');
    container.innerHTML = '<h4 class="font-bold mb-4">Schnittplan Vorschau</h4>';
    
    state.results.usedSheets.forEach((data, i) => {
        const canvas = document.createElement('canvas');
        canvas.className = "w-full border bg-white rounded-lg mb-4 shadow-sm";
        const ctx = canvas.getContext('2d');
        
        // Skalierung berechnen
        const scale = 800 / data.sheet.length;
        canvas.width = 800;
        canvas.height = data.sheet.width * scale;

        // Platte zeichnen
        ctx.fillStyle = "#f0f4f8";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Schnitte zeichnen
        data.placements.forEach(p => {
            ctx.fillStyle = "#00478d";
            ctx.strokeStyle = "white";
            ctx.lineWidth = 1;
            ctx.fillRect(p.x * scale, p.y * scale, p.w * scale, p.h * scale);
            ctx.strokeRect(p.x * scale, p.y * scale, p.w * scale, p.h * scale);
        });

        container.appendChild(canvas);
    });
}

function updateSummary() {
    const sheetCount = document.querySelectorAll('.sheet-card').length;
    document.querySelector(".text-4xl").textContent = state.results ? state.results.usedSheets.length : sheetCount;
    
    if(state.results) {
        document.querySelector(".border-t span:last-child").textContent = state.results.totalArea.toFixed(2) + " m²";
    }
}

/* =========================   INIT  ========================= */
document.addEventListener("DOMContentLoaded", () => {
    // Container für Platten dynamisch finden/erstellen
    const mainArea = document.querySelector(".lg\\:col-span-8");
    const sheetContainer = document.createElement('div');
    sheetContainer.id = "sheet-container";
    mainArea.prepend(sheetContainer);

    // Initial eine Platte hinzufügen
    addSheet();

    // Event Listener für Buttons
    document.querySelector(".border-dashed").onclick = addSheet;
    document.querySelector("header button.bg-primary").onclick = calculate;
    
    // Result Container vorbereiten
    const resDiv = document.createElement('div');
    resDiv.id = "results-canvas-container";
    resDiv.className = "mt-10";
    mainArea.appendChild(resDiv);

    // Zuschnitt-UI initialisieren (aus Ihrem Code übernommen)
    createCutListUI();

    // In den DOMContentLoaded Listener einfügen:

// Sidebar Buttons
document.querySelector('aside button.bg-primary').onclick = startNewCalculation;

// Export Links (In der Sidebar)
const navLinks = document.querySelectorAll('aside nav a');
navLinks.forEach(link => {
    const text = link.innerText.toLowerCase();
    if (text.includes('export')) {
        link.onclick = (e) => {
            e.preventDefault();
            exportJSON();
        };
    }
});

// "Results" Link in der Nav oben oder Sidebar
// Hier könnte man einen Sprung zum Result-Container einbauen
});

// [Hier die restlichen Hilfsfunktionen aus deinem Code wie createCutListUI, renderCutList einfügen]
/* =========================   EXPORT & DATEI   ========================= */

// Projekt als JSON herunterladen
function exportJSON() {
    if (state.sheets.length === 0 && state.cuts.length === 0) {
        alert("Keine Daten zum Exportieren vorhanden.");
        return;
    }
    const data = JSON.stringify({
        sheets: state.sheets,
        cuts: state.cuts,
        timestamp: new Date().toISOString()
    }, null, 2);
    
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `OptiCut_Export_${new Date().toLocaleDateString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// Die berechneten Schnittpläne als Bild (PNG) speichern
function exportImage() {
    const canvases = document.querySelectorAll('#results-canvas-container canvas');
    if (canvases.length === 0) {
        alert("Bitte führen Sie zuerst eine Optimierung durch.");
        return;
    }

    canvases.forEach((canvas, index) => {
        const link = document.createElement('a');
        link.download = `Schnittplan_Platte_${index + 1}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    });
}

// Einfacher PDF-Export über die Druckfunktion
function exportPDF() {
    const container = document.getElementById('results-canvas-container');
    if (container.classList.contains('hidden')) {
        alert("Nichts zum Drucken vorhanden.");
        return;
    }
    
    // Temporäres Fenster für sauberen Druck
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head><title>Schnittplan Export</title></head>
            <body style="font-family: sans-serif; padding: 20px;">
                <h1>OptiCut Pro - Schnittbericht</h1>
                <p>Datum: ${new Date().toLocaleString()}</p>
                <hr>
                ${container.innerHTML}
                <style>canvas { max-width: 100%; border: 1px solid #000; margin-bottom: 20px; }</style>
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
}

/* =========================   APP MANAGEMENT   ========================= */

function startNewCalculation() {
    if (confirm("Möchten Sie alle aktuellen Eingaben löschen und neu starten?")) {
        state.sheets = [];
        state.cuts = [];
        state.results = null;
        
        // UI zurücksetzen
        document.getElementById('sheet-container').innerHTML = '';
        document.getElementById('cut-display-list').innerHTML = '';
        document.getElementById('results-canvas-container').innerHTML = '';
        document.getElementById('results-canvas-container').classList.add('hidden');
        
        // Stats zurücksetzen
        document.getElementById('stat-sheets-count').innerText = '0';
        document.getElementById('stat-total-area').innerText = '0.00 m²';
        
        // Initial eine leere Platte hinzufügen
        addSheet();
    }
}

