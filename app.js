/* ================= STATE ================= */

const state = {
    sheets: [],
    cuts: [],
    results: [],

    config: {
        kerf: 3,
        mode: "free"
    }
};

/* ================= INIT ================= */

document.addEventListener("DOMContentLoaded", () => {
    bindUI();
    addSheet();
});

/* ================= UI ================= */

function bindUI() {
    document.getElementById("add-sheet").onclick = addSheet;

    document.getElementById("kerf").oninput = e => {
        state.config.kerf = +e.target.value || 0;
        calculate();
    };

    document.getElementById("mode").onchange = e => {
        state.config.mode = e.target.value;
        calculate();
    };

    document.getElementById("export-json").onclick = exportJSON;
    document.getElementById("export-csv").onclick = exportCSV;
    document.getElementById("export-pdf").onclick = exportPDF;

    document.getElementById("import-csv").onchange = e => {
        importCSV(e.target.files[0]);
    };
}

/* ================= SHEETS ================= */

function addSheet() {
    state.sheets.push({ l: 2500, w: 1250 });
    renderSheets();
}

function renderSheets() {
    const el = document.getElementById("sheet-container");
    el.innerHTML = state.sheets.map((s, i) => `
        <div class="bg-white p-4 mb-2">
            <input value="${s.l}" onchange="updateSheet(${i}, 'l', this.value)">
            <input value="${s.w}" onchange="updateSheet(${i}, 'w', this.value)">
            <button onclick="removeSheet(${i})">X</button>
        </div>
    `).join("");
}

function updateSheet(i, key, val) {
    state.sheets[i][key] = +val;
    calculate();
}

function removeSheet(i) {
    state.sheets.splice(i, 1);
    renderSheets();
    calculate();
}

/* ================= CUTS ================= */

function renderCuts() {
    const el = document.getElementById("cuts");

    el.innerHTML = `
        <button onclick="addCut()">Teil hinzufügen</button>
        ${state.cuts.map((c,i)=>`
            <div>
                ${c.name} (${c.l}x${c.w})
                <button onclick="removeCut(${i})">X</button>
            </div>
        `).join("")}
    `;
}

function addCut() {
    state.cuts.push({
        name: "Teil",
        l: 500,
        w: 300,
        qty: 1,
        shape: "rect"
    });
    renderCuts();
    calculate();
}

function removeCut(i) {
    state.cuts.splice(i,1);
    renderCuts();
    calculate();
}

/* ================= ALGORITHM ================= */

function calculate() {
    if (!state.sheets.length || !state.cuts.length) return;

    const kerf = state.config.kerf;

    let parts = [];

    state.cuts.forEach(c => {
        for (let i=0;i<c.qty;i++) {
            parts.push({...c});
        }
    });

    state.results = [];

    while(parts.length) {
        let sheet = {...state.sheets[0]};
        let free = [{x:0,y:0,w:sheet.l,h:sheet.w}];
        let placed = [];

        for (let p of parts) {
            let pw = p.l + kerf;
            let ph = p.w + kerf;

            for (let i=0;i<free.length;i++) {
                let f = free[i];

                if (pw <= f.w && ph <= f.h) {
                    placed.push({...p, x:f.x, y:f.y, w:pw, h:ph});

                    free.splice(i,1);

                    if (state.config.mode === "guillotine") {
                        free.push(
                            {x:f.x+pw,y:f.y,w:f.w-pw,h:ph},
                            {x:f.x,y:f.y+ph,w:f.w,h:f.h-ph}
                        );
                    } else {
                        free.push(
                            {x:f.x+pw,y:f.y,w:f.w-pw,h:f.h},
                            {x:f.x,y:f.y+ph,w:pw,h:f.h-ph}
                        );
                    }

                    parts.splice(parts.indexOf(p),1);
                    break;
                }
            }
        }

        state.results.push({sheet, placed});
    }

    renderResults();
}

/* ================= RENDER ================= */

function renderResults() {
    const el = document.getElementById("results");

    el.innerHTML = state.results.map(r => {
        return `
            <div class="mb-4 bg-white p-4">
                ${r.placed.length} Teile
            </div>
        `;
    }).join("");
}

/* ================= EXPORT ================= */

function exportJSON() {
    const blob = new Blob([JSON.stringify(state,null,2)]);
    download(blob, "project.json");
}

function exportCSV() {
    const rows = state.cuts.map(c =>
        `${c.name};${c.l};${c.w};${c.qty}`
    );
    download(new Blob([rows.join("\n")]), "cuts.csv");
}

function importCSV(file) {
    const reader = new FileReader();
    reader.onload = e => {
        const lines = e.target.result.split("\n");

        state.cuts = lines.map(l => {
            const [name,lx,wx,qty] = l.split(";");
            return {name, l:+lx, w:+wx, qty:+qty, shape:"rect"};
        });

        renderCuts();
        calculate();
    };
    reader.readAsText(file);
}

async function exportPDF() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();

    pdf.text("Schnittplan",10,10);

    pdf.save("plan.pdf");
}

function download(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
}
