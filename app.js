/* =========================   STATE MANAGEMENT  ========================= */
const state = {
    sheets: [], 
    cuts: [],   
    results: null,
    activeShape: 'rect',
    hasChanges: false,
    sawBladeThickness: 3, // Schnittfuge in mm
    cuttingMode: 'free', // 'free' oder 'guillotine'
    statistics: {
        totalArea: 0,
        usedArea: 0,
        wasteArea: 0,
        wastePercent: 0
    }
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
            <span class="text-xs font-medium text-slate-500">Rotation erlauben (90°)</span>
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
    if(state.hasChanges) window.calculate(); // Nur triggern wenn schon initialisiert
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

/* ===== NEUE FUNKTIONEN ===== */

window.updateSawBladeThickness = function(value) {
    state.sawBladeThickness = parseFloat(value) || 3;
    window.calculate();
};

window.updateCuttingMode = function(value) {
    state.cuttingMode = value;
    window.calculate();
};

window.exportJSON = function() {
    if(state.cuts.length === 0) return alert("Keine Daten zum Exportieren vorhanden.");
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const anchor = document.createElement('a');
    anchor.setAttribute("href", dataStr);
    anchor.setAttribute("download", `zuschnitt_projekt_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
};

window.exportCSV = function() {
    if(state.cuts.length === 0) return alert("Keine Zuschnitte zum Exportieren vorhanden.");
    let csv = "Bezeichnung,Form,Länge (mm),Breite (mm),Obere Breite (mm),Anzahl\n";
    state.cuts.forEach(c => {
        csv += `"${c.name}","${c.shape}",${c.l},${c.w},${c.l2 || ''},${c.qty}\n`;
    });
    const blob = new Blob([csv], {type: 'text/csv'});
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `zuschnittliste_${new Date().toISOString().split('T')[0]}.csv`;
    anchor.click();
    window.URL.revokeObjectURL(url);
};

window.importCSV = function(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const csv = e.target.result;
        const lines = csv.trim().split('\n');
        
        // Skip header
        for(let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(',').map(p => p.replace(/^"|"$/g, ''));
            if(parts.length < 3) continue;
            
            const name = parts[0] || `Teil ${state.cuts.length + 1}`;
            const shape = parts[1] || 'rect';
            const l = parseFloat(parts[2]);
            const w = parseFloat(parts[3]);
            const l2 = parts[4] ? parseFloat(parts[4]) : null;
            const qty = parseInt(parts[5]) || 1;
            
            if(l > 0 && w > 0) {
                state.cuts.push({name, l, w, l2, qty, shape});
            }
        }
        
        renderCuts();
        window.calculate();
        alert(`${state.cuts.length} Zuschnitte importiert!`);
    };
    reader.readAsText(file);
};

/* PDF-Export (mit jsPDF) */
window.exportPDF = function() {
    if(state.results === null || !state.results.usedSheets || state.results.usedSheets.length === 0) {
        alert("Keine Optimierungsergebnisse vorhanden. Bitte zuerst Zuschnitte hinzufügen und berechnen.");
        return;
    }
    
    // Überprüfe ob jsPDF verfügbar ist, ansonsten laden
    if(!window.jsPDF) {
        alert("PDF-Bibliothek wird noch geladen. Bitte warten und erneut versuchen.");
        return;
    }
    
    try {
        const {jsPDF} = window.jsPDF;
        const doc = new jsPDF({orientation: 'landscape', unit: 'mm'});
        
        // Alle Canvas-Elemente sammeln
        const canvases = document.querySelectorAll('#canvas-list canvas');
        
        if(canvases.length === 0) {
            alert("Keine Schnittpläne zum Exportieren vorhanden.");
            return;
        }
        
        canvases.forEach((canvas, idx) => {
            if(idx > 0) doc.addPage();
            
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            
            // Header
            doc.setFontSize(16);
            doc.setTextColor(0, 71, 141); // Primary color
            doc.text(`Schnittplan #${idx + 1}`, 15, 15);
            
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
            doc.text(`Format: ${state.results.usedSheets[idx].sheet.name} (${state.results.usedSheets[idx].sheet.l}×${state.results.usedSheets[idx].sheet.w}mm)`, 15, 25);
            
            // Canvas in PDF rendern
            const imgData = canvas.toDataURL('image/png');
            const maxWidth = pageWidth - 30;
            const maxHeight = pageHeight - 40;
            const ratio = canvas.width / canvas.height;
            let width = maxWidth;
            let height = width / ratio;
            if(height > maxHeight) {
                height = maxHeight;
                width = height * ratio;
            }
            doc.addImage(imgData, 'PNG', 15, 35, width, height);
            
            // Footer mit Statistiken
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            const footerY = pageHeight - 10;
            doc.text(`Erstellt: ${new Date().toLocaleString('de-DE')} | Seite ${idx + 1}/${canvases.length}`, 15, footerY);
        });
        
        // Zusätzliche Seite mit Statistiken
        doc.addPage();
        doc.setFontSize(14);
        doc.setTextColor(0, 71, 141);
        doc.text("Schnittplan-Statistik", 15, 15);
        
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        let yPos = 30;
        const lineHeight = 7;
        
        doc.text(`Gesamtplatten: ${state.results.usedSheets.length}`, 15, yPos);
        yPos += lineHeight;
        doc.text(`Gesamtfläche: ${state.statistics.totalArea.toFixed(2)} m²`, 15, yPos);
        yPos += lineHeight;
        doc.text(`Genutzte Fläche: ${state.statistics.usedArea.toFixed(2)} m² (${(state.statistics.usedArea/state.statistics.totalArea*100).toFixed(1)}%)`, 15, yPos);
        yPos += lineHeight;
        doc.text(`Verschnittfläche: ${state.statistics.wasteArea.toFixed(2)} m² (${state.statistics.wastePercent.toFixed(1)}%)`, 15, yPos);
        yPos += lineHeight * 2;
        
        doc.setFontSize(10);
        doc.setTextColor(0, 71, 141);
        doc.text("Zuschnittliste:", 15, yPos);
        yPos += lineHeight;
        
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        state.cuts.forEach(cut => {
            const text = `${cut.qty}× ${cut.name} (${cut.shape}: ${cut.l}×${cut.w}mm)`;
            doc.text(text, 20, yPos);
            yPos += lineHeight;
            if(yPos > 270) {
                doc.addPage();
                yPos = 15;
            }
        });
        
        doc.save(`schnittplan_${new Date().toISOString().split('T')[0]}.pdf`);
        alert("PDF erfolgreich exportiert!");
    } catch(error) {
        console.error("PDF Export Fehler:", error);
        alert("Fehler beim PDF-Export: " + error.message);
    }
};

// =============================================================================
// CUTTING OPTIMIZER — 2D Bin Packing
// Schnittstellen: preprocessCuts(), packGuillotine(), window.calculate()
// =============================================================================
 
 
// -----------------------------------------------------------------------------
// PREPROCESSING — Schnitte vorbereiten und Formen paaren
// -----------------------------------------------------------------------------
 
function preprocessCuts(cuts) {
  // Alle Einzelstücke expandieren (qty → Kopien)
  const pool = [];
  cuts.forEach(c => {
    for (let i = 0; i < c.qty; i++) pool.push({ ...c, id: Math.random() });
  });
 
  const rectsToPack = [];
 
  // Hilfsfunktion: gleiche Formen paaren (zwei Dreiecke/Trapeze → ein Rechteck)
  function pairShapes(shapes, isMatch, makePair, makeSingle) {
    while (shapes.length > 0) {
      const a = shapes.shift();
      const idx = shapes.findIndex(b => isMatch(a, b));
      if (idx !== -1) {
        rectsToPack.push(makePair(a, shapes.splice(idx, 1)[0]));
      } else {
        rectsToPack.push(makeSingle(a));
      }
    }
  }
 
  // Dreiecke: zwei gleiche Dreiecke → ein Rechteck
  pairShapes(
    pool.filter(c => c.shape === 'triangle'),
    (a, b) => a.l === b.l && a.w === b.w,
    (a, b) => ({ isPair: true,  type: 'triangle',  l: a.l, w: a.w, area: a.l * a.w,          items: [a, b] }),
    (a)    => ({ isPair: false, type: 'triangle',  l: a.l, w: a.w, area: (a.l * a.w) / 2,    items: [a]    })
  );
 
  // Trapeze: zwei gleiche Trapeze → ein Rechteck
  pairShapes(
    pool.filter(c => c.shape === 'trapezoid'),
    (a, b) => a.l === b.l && a.w === b.w && a.l2 === b.l2,
    (a, b) => {
      const combinedL = a.l + (a.l2 || 0);
      return { isPair: true, type: 'trapezoid', l: combinedL, w: a.w, area: combinedL * a.w, items: [a, b] };
    },
    (a) => ({ isPair: false, type: 'trapezoid', l: a.l, w: a.w, area: a.l * a.w, items: [a] })
  );
 
  // Rechtecke direkt übernehmen
  pool
    .filter(c => c.shape !== 'triangle' && c.shape !== 'trapezoid')
    .forEach(r => rectsToPack.push({ isPair: false, type: 'rect', l: r.l, w: r.w, area: r.l * r.w, items: [r] }));
 
  // Größte Teile zuerst (verbessert die Packdichte erheblich)
  return rectsToPack.sort((a, b) => b.area - a.area);
}
 
 
// -----------------------------------------------------------------------------
// GUILLOTINE-ALGORITHMUS
// Strategie: Best Short Side Fit + Longer Axis Split + optionale Rotation
// -----------------------------------------------------------------------------
 
function packGuillotine(rects, sheets, sawThickness) {
  const usedSheets = [];
  let remaining = [...rects];
 
  while (remaining.length > 0) {
    let best = { score: -Infinity, placed: [], remaining: null, sheet: null };
 
    for (const sheet of sheets) {
      const result = _guillotinePackSheet(remaining, sheet, sawThickness);
      // Priorität: möglichst viele Teile platzieren, dann Effizienz
      const score = result.placed.length * 10000 + result.efficiency;
      if (result.placed.length > 0 && score > best.score) {
        best = { score, sheet, ...result };
      }
    }
 
    if (best.placed.length === 0) break; // Kein Teil passt mehr → Abbruch
    usedSheets.push({ sheet: best.sheet, placements: best.placed });
    remaining = best.remaining;
  }
 
  return usedSheets;
}
 
function _guillotinePackSheet(rects, sheet, sw) {
  let freeRects = [{ x: 0, y: 0, w: sheet.l, h: sheet.w }];
  const placed = [];
  let areaUsed = 0;
  const remaining = [...rects].sort((a, b) => b.area - a.area);
 
  for (let i = 0; i < remaining.length; i++) {
    const rect = remaining[i];
    let best = null; // { frIdx, fw, fh, rotated, score }
 
    for (let j = 0; j < freeRects.length; j++) {
      const fr = freeRects[j];
 
      // Normale Orientierung prüfen
      if (rect.l + sw <= fr.w && rect.w + sw <= fr.h) {
        const score = _shortSideScore(fr, rect.l, rect.w, sw);
        if (!best || score < best.score)
          best = { frIdx: j, fw: rect.l, fh: rect.w, rotated: false, score };
      }
 
      // Gedrehte Orientierung prüfen (90°, nur wenn erlaubt und sinnvoll)
      if (sheet.canRotate && rect.l !== rect.w && rect.w + sw <= fr.w && rect.l + sw <= fr.h) {
        const score = _shortSideScore(fr, rect.w, rect.l, sw);
        if (!best || score < best.score)
          best = { frIdx: j, fw: rect.w, fh: rect.l, rotated: true, score };
      }
    }
 
    if (best) {
      const fr = freeRects[best.frIdx];
      placed.push({ ...rect, x: fr.x, y: fr.y, pw: best.fw, ph: best.fh, rotatedBox: best.rotated });
      areaUsed += rect.area;
 
      // Freies Rechteck aufteilen und ersetzen
      const splits = _guillotineSplit(fr, best.fw, best.fh, sw);
      freeRects.splice(best.frIdx, 1, ...splits);
 
      remaining.splice(i, 1);
      i--;
    }
  }
 
  return { placed, remaining, efficiency: areaUsed / (sheet.l * sheet.w) };
}
 
// Score: je kleiner, desto besser passend (minimiert die kürzere Restseite)
function _shortSideScore(fr, fw, fh, sw) {
  return Math.min(fr.w - fw - sw, fr.h - fh - sw);
}
 
// "Longer Axis"-Split: Splitte entlang der längeren Restseite → größere freie Flächen
function _guillotineSplit(fr, fw, fh, sw) {
  const rightW  = fr.w - fw - sw;
  const bottomH = fr.h - fh - sw;
  const result  = [];
 
  if (rightW > bottomH) {
    // Rechter Streifen über volle Höhe, unterer Streifen begrenzt
    if (rightW  > 0) result.push({ x: fr.x + fw + sw, y: fr.y,        w: rightW, h: fr.h    });
    if (bottomH > 0) result.push({ x: fr.x,           y: fr.y + fh + sw, w: fw,     h: bottomH });
  } else {
    // Unterer Streifen über volle Breite, rechter Streifen begrenzt
    if (bottomH > 0) result.push({ x: fr.x,           y: fr.y + fh + sw, w: fr.w,   h: bottomH });
    if (rightW  > 0) result.push({ x: fr.x + fw + sw, y: fr.y,        w: rightW, h: fh      });
  }
 
  return result;
}
 
 
// -----------------------------------------------------------------------------
// MAXIMAL-RECTANGLES-ALGORITHMUS (freier Packing-Modus)
// Deutlich bessere Packdichte als einfaches Guillotine-Split-Packing,
// weil alle möglichen freien Rechtecke verwaltet werden (nicht nur zwei).
// Strategie: Best Short Side Fit (BSSF) + optionale Rotation
// -----------------------------------------------------------------------------
 
function _packMaxRects(rects, sheets, sawThickness) {
  const usedSheets = [];
  let remaining = [...rects];
 
  while (remaining.length > 0) {
    let best = { score: -Infinity, placed: [], remaining: null, sheet: null };
 
    for (const sheet of sheets) {
      const result = _maxRectsPackSheet(remaining, sheet, sawThickness);
      const score = result.placed.length * 10000 + result.efficiency;
      if (result.placed.length > 0 && score > best.score) {
        best = { score, sheet, ...result };
      }
    }
 
    if (best.placed.length === 0) break;
    usedSheets.push({ sheet: best.sheet, placements: best.placed });
    remaining = best.remaining;
  }
 
  return usedSheets;
}
 
function _maxRectsPackSheet(rects, sheet, sw) {
  let freeRects = [{ x: 0, y: 0, w: sheet.l, h: sheet.w }];
  const placed = [];
  let areaUsed = 0;
  const remaining = [...rects].sort((a, b) => b.area - a.area);
 
  for (let i = 0; i < remaining.length; i++) {
    const rect = remaining[i];
    let best = null; // { frIdx, fw, fh, rotated, score }
 
    for (let j = 0; j < freeRects.length; j++) {
      const fr = freeRects[j];
 
      if (rect.l + sw <= fr.w && rect.w + sw <= fr.h) {
        const score = Math.min(fr.w - rect.l - sw, fr.h - rect.w - sw);
        if (!best || score < best.score)
          best = { frIdx: j, fw: rect.l, fh: rect.w, rotated: false, score };
      }
 
      if (sheet.canRotate && rect.l !== rect.w && rect.w + sw <= fr.w && rect.l + sw <= fr.h) {
        const score = Math.min(fr.w - rect.w - sw, fr.h - rect.l - sw);
        if (!best || score < best.score)
          best = { frIdx: j, fw: rect.w, fh: rect.l, rotated: true, score };
      }
    }
 
    if (best) {
      const fr = freeRects[best.frIdx];
      // Das platzierte Rechteck inkl. Sägeblatt (für Kollisionsberechnung)
      const occupiedRect = { x: fr.x, y: fr.y, w: best.fw + sw, h: best.fh + sw };
 
      placed.push({ ...rect, x: fr.x, y: fr.y, pw: best.fw, ph: best.fh, rotatedBox: best.rotated });
      areaUsed += rect.area;
 
      // Alle freien Rechtecke anhand des platzierten Stücks aufteilen
      freeRects = _splitFreeRects(freeRects, occupiedRect);
      // Enthaltene (redundante) freie Rechtecke entfernen
      freeRects = _pruneContained(freeRects);
 
      remaining.splice(i, 1);
      i--;
    }
  }
 
  return { placed, remaining, efficiency: areaUsed / (sheet.l * sheet.w) };
}
 
// Alle freien Rechtecke, die das platzierte Stück überschneiden, in max. 4 Teile zerlegen
function _splitFreeRects(freeRects, placed) {
  const result = [];
 
  for (const fr of freeRects) {
    if (!_overlaps(fr, placed)) {
      result.push(fr); // Keine Überschneidung → unverändert übernehmen
      continue;
    }
    // Links vom platzierten Stück
    if (placed.x > fr.x)
      result.push({ x: fr.x, y: fr.y, w: placed.x - fr.x, h: fr.h });
    // Rechts vom platzierten Stück
    if (placed.x + placed.w < fr.x + fr.w)
      result.push({ x: placed.x + placed.w, y: fr.y, w: fr.x + fr.w - placed.x - placed.w, h: fr.h });
    // Oberhalb des platzierten Stücks
    if (placed.y > fr.y)
      result.push({ x: fr.x, y: fr.y, w: fr.w, h: placed.y - fr.y });
    // Unterhalb des platzierten Stücks
    if (placed.y + placed.h < fr.y + fr.h)
      result.push({ x: fr.x, y: placed.y + placed.h, w: fr.w, h: fr.y + fr.h - placed.y - placed.h });
  }
 
  return result;
}
 
function _overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}
 
// Rechtecke entfernen, die vollständig in einem anderen enthalten sind
function _pruneContained(freeRects) {
  return freeRects.filter((a, i) =>
    !freeRects.some((b, j) => i !== j && _contains(b, a))
  );
}
 
function _contains(outer, inner) {
  return outer.x <= inner.x && outer.y <= inner.y &&
         outer.x + outer.w >= inner.x + inner.w &&
         outer.y + outer.h >= inner.y + inner.h;
}
 
 
// -----------------------------------------------------------------------------
// HAUPTFUNKTION
// -----------------------------------------------------------------------------
 
window.calculate = function () {
  state.hasChanges = true;
 
  // Platten aus dem UI auslesen
  state.sheets = Array.from(document.querySelectorAll('.sheet-card')).map(card => ({
    name:      card.querySelector('.sheet-name').value,
    l:         parseFloat(card.querySelector('.sheet-l').value) || 0,
    w:         parseFloat(card.querySelector('.sheet-w').value) || 0,
    canRotate: card.querySelector('.sheet-grain').checked,
  })).filter(s => s.l > 0 && s.w > 0);
 
  if (state.cuts.length === 0 || state.sheets.length === 0) {
    document.getElementById('results-canvas-container').classList.add('hidden');
    updateStatistics();
    return;
  }
 
  const rects = preprocessCuts(state.cuts);
  const sw    = state.sawBladeThickness;
 
  const usedSheets = state.cuttingMode === 'guillotine'
    ? packGuillotine(rects, state.sheets, sw)
    : _packMaxRects(rects, state.sheets, sw);
 
  state.results = { usedSheets };
  renderResults();
  updateStatistics();
};

function updateStatistics() {
    let totalArea = 0;
    let usedArea = 0;
    
    if(state.results && state.results.usedSheets) {
        state.results.usedSheets.forEach(data => {
            let sheetArea = data.sheet.l * data.sheet.w;
            totalArea += sheetArea;
            data.placements.forEach(p => {
                usedArea += p.area;
            });
        });
    }
    
    let wasteArea = totalArea - usedArea;
    let wastePercent = totalArea > 0 ? (wasteArea / totalArea * 100) : 0;
    
    state.statistics = {
        totalArea: totalArea / 1000000, // in m²
        usedArea: usedArea / 1000000,
        wasteArea: wasteArea / 1000000,
        wastePercent: wastePercent
    };
    
    // UI aktualisieren
    document.getElementById('stat-total-area-abs').innerText = state.statistics.totalArea.toFixed(2);
    document.getElementById('stat-used-area').innerText = state.statistics.usedArea.toFixed(2);
    document.getElementById('stat-waste-area').innerText = state.statistics.wasteArea.toFixed(2);
    document.getElementById('stat-waste-percent').innerText = state.statistics.wastePercent.toFixed(1) + '%';
    document.getElementById('stat-waste-bar').style.width = Math.min(100, state.statistics.wastePercent) + '%';
}

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

        // Zeichne Schnittfugen-Linien
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);

        data.placements.forEach(p => {
            const x = p.x * scale, y = p.y * scale, w = p.pw * scale, h = p.ph * scale;

            if (p.type === 'triangle' && p.isPair) {
                drawShape(ctx, x, y, w, h, p.items[0].name, [{x:0, y:h}, {x:w, y:h}, {x:0, y:0}]);
                drawShape(ctx, x, y, w, h, p.items[1].name, [{x:w, y:0}, {x:0, y:0}, {x:w, y:h}], true);
            } 
            else if (p.type === 'trapezoid' && p.isPair) {
                const l1 = p.items[0].l * scale, l2 = (p.items[0].l2 || 0) * scale;
                drawShape(ctx, x, y, w, h, p.items[0].name, [{x:0, y:h}, {x:l1, y:h}, {x:l2, y:0}, {x:0, y:0}]);
                drawShape(ctx, x, y, w, h, p.items[1].name, [{x:l1, y:h}, {x:w, y:h}, {x:w, y:0}, {x:l2, y:0}], true);
            } 
            else {
                if (p.type === 'triangle') drawShape(ctx, x, y, w, h, p.items[0].name, [{x:0, y:h}, {x:w, y:h}, {x:0, y:0}]);
                else if (p.type === 'trapezoid') drawShape(ctx, x, y, w, h, p.items[0].name, [{x:0, y:h}, {x:w, y:h}, {x:(p.items[0].l2||0)*scale, y:0}, {x:0, y:0}]);
                else drawShape(ctx, x, y, w, h, p.items[0].name, [{x:0, y:0}, {x:w, y:0}, {x:w, y:h}, {x:0, y:h}]);
            }
            
            // Zeichne Schnittfuge
            if(state.sawBladeThickness > 0) {
                ctx.setLineDash([5, 5]);
                ctx.strokeStyle = "#94a3b8";
                ctx.strokeRect(x, y, w + state.sawBladeThickness * scale, h + state.sawBladeThickness * scale);
            }
        });
        
        ctx.setLineDash([]);
        wrap.appendChild(canvas);
        list.appendChild(wrap);
    });
    
    document.getElementById('stat-sheets-count').innerText = state.results.usedSheets.length;
    document.getElementById('stat-total-area').innerText = totalArea.toFixed(2) + " m²";
}

function drawShape(ctx, bx, by, bw, bh, name, points, isFlipped = false) {
    ctx.beginPath();
    ctx.fillStyle = isFlipped ? "#005eb8" : "#00478d"; 
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.moveTo(bx + points[0].x, by + points[0].y);
    for(let i=1; i<points.length; i++) ctx.lineTo(bx + points[i].x, by + points[i].y);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    let centerX = bx + points.reduce((sum, p) => sum + p.x, 0) / points.length;
    let centerY = by + points.reduce((sum, p) => sum + p.y, 0) / points.length;
    if (bw > 50 && bh > 30) {
        ctx.fillStyle = "white"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.font = "bold 14px Inter, sans-serif"; ctx.fillText(name, centerX, centerY);
    }
}

/* =========================   INIT   ========================= */

document.addEventListener("DOMContentLoaded", () => {
    
    // Neues Projekt Dialog
    document.getElementById('new-calc-btn').onclick = () => {
        if (!state.hasChanges || confirm("Es gibt ungespeicherte Änderungen. Möchtest du wirklich ein neues Projekt starten?")) {
            location.reload();
        }
    };

    // Export Funktionen binden
    document.getElementById('export-json-btn').onclick = window.exportJSON;
    document.getElementById('export-csv-btn').onclick = window.exportCSV;
    document.getElementById('export-pdf-btn').onclick = window.exportPDF;
    
    // Import CSV
    document.getElementById('import-csv').addEventListener('change', (e) => {
        if(e.target.files[0]) {
            window.importCSV(e.target.files[0]);
            e.target.value = ''; // Reset file input
        }
    });

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
            <button id="add-cut-btn" class="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-black transition-all shadow-md mt-2">TEIL HINZUFÜGEN</button>
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
            window.renderCuts(); 
            window.calculate();
            // Clear inputs
            document.getElementById('cut-name').value = '';
            document.getElementById('cut-l').value = '';
            document.getElementById('cut-w').value = '';
            document.getElementById('cut-qty').value = '1';
            if(document.getElementById('cut-l2')) document.getElementById('cut-l2').value = '';
        }
    };

window.removeCut = function(index) {
    state.cuts.splice(index, 1);
    renderCuts();
    window.calculate();
};

window.renderCuts = function() {
    const list = document.getElementById('cut-display-list');
    list.innerHTML = state.cuts.map((c, i) => `
        <div class="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-all hover:shadow-sm">
            <div class="flex-1">
                <p class="text-sm font-bold">${c.qty}x ${c.name}</p>
                <p class="text-[10px] text-slate-500 uppercase">${c.shape} | ${c.l}x${c.w}${c.l2 ? ' (Oben:'+c.l2+')' : ''}</p>
            </div>
            <button onclick="window.removeCut(${i})" class="text-error font-bold p-2 hover:bg-red-50 rounded transition-colors ml-3" title="Diesen Zuschnitt löschen">✕</button>
        </div>
    `).join('');
};

    // Button Binding Fix
    document.getElementById('add-sheet-btn').addEventListener('click', window.addSheet);

    // Initiales Setup
    window.addSheet();
    state.hasChanges = false; // Reset nach initialem Laden
});

// PDF-Support hinzufügen (jsPDF laden wenn verfügbar)
if(!window.jsPDF) {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    document.head.appendChild(script);
}
