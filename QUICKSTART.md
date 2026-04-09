# OptiCut Pro - Schnellstart Anleitung

## 🎯 Neue Features schnell erklärt

### 1️⃣ Schnittfuge konfigurieren
1. Öffne "Schnitteinstellungen" am Anfang
2. Gebe "Sägeblattstärke" ein (z.B. 3-4mm für typische Plattensägen)
3. Der Wert wird automatisch bei der Optimierung berücksichtigt

**💡 Tipp:** Je größer die Schnittfuge, desto mehr Material wird verschnitten!

### 2️⃣ Schnittmodus auswählen
- **Freies Verschachteln** (Standard): Teile können überall platziert werden - bessere Effizienz
- **Guillotine-Schnitt**: Nur gerade Schnitte von Kante zu Kante - für manche Plattensägen erforderlich

### 3️⃣ Zuschnittliste aus CSV importieren
1. Klicke "CSV Import" Button
2. Wähle eine CSV-Datei mit dieser Struktur:
   ```
   Bezeichnung,Form,Länge (mm),Breite (mm),Obere Breite (mm),Anzahl
   Frontblende,rect,800,600,,2
   Seitenpanel,rect,1200,400,,4
   ```
3. Teile werden automatisch importiert ✓

**Unterstützte Formen:** `rect`, `triangle`, `trapezoid`

### 4️⃣ Ergebnisse exportieren
Nach der Optimierung kannst du exportieren als:
- **JSON**: Komplettes Projekt (zum Speichern/Laden)
- **CSV**: Nur die Zuschnittliste (für Verwaltungssysteme)
- **PDF**: Schnittplan zum Drucken/Verteilen an Säger

### 5️⃣ Flächenstatistiken verstehen
Rechts im Panel siehst du:
- **Gesamtfläche:** Summe aller Platten
- **Genutzte Fläche:** Summe der Teile (grün)
- **Verschnittfläche:** Abfall (rot)
- **Verschnittquote:** Effizienz in Prozent

**Ziel:** Eine niedrige Verschnittquote (unter 20% ist gut!)

---

## 📋 Workflow-Beispiel

```
1. Setze Sägeblattstärke → "4mm"
2. Wähle Format A → "2500x1250mm"
3. Importiere CSV mit Zuschnittlisten
4. Stelle Schnittmodus → "Freies Verschachteln"  
5. Klick auf "+  TEIL HINZUFÜGEN" oder nutze CSV-Import
6. System berechnet automatisch
7. Exportiere PDF für Säger
8. Speichere Projekt als JSON
```

---

## 🔍 Troubleshooting

**Problem:** PDF-Export funktioniert nicht
- Lösung: Nutze Chrome/Edge; Firefox hat Limitationen
- Sicherstelle: JavaScript ist aktiviert

**Problem:** CSV-Import findet Datei nicht
- Lösung: Nutze .CSV-Format (nicht XLSX)
- Check: Spalten stimmen mit Vorlage überein

**Problem:** Teile werden nicht berechnet
- Lösung: Klick auf "+PART HINZUFÜGEN" Button
- Check: Länge und Breite > 0

**Problem:** Zu viel Verschnitt
- Lösung: Erhöhe Plattenformat
- Check: Schnittfuge nicht zu groß (versuche 2-3mm)
- Tipp: "Freies Verschachteln" ist effizienter als Guillotine

---

## 💾 Datenformat-Referenz

### CSV Export
```csv
Bezeichnung,Form,Länge (mm),Breite (mm),Obere Breite (mm),Anzahl
Teil1,rect,500,300,,1
Teil2,triangle,600,400,,2
```

### JSON Export
```json
{
  "sheets": [{
    "name": "Format A",
    "l": 2500,
    "w": 1250,
    "canRotate": true
  }],
  "cuts": [{
    "name": "Frontblende",
    "l": 800,
    "w": 600,
    "qty": 2,
    "shape": "rect"
  }],
  "sawBladeThickness": 3,
  "cuttingMode": "free"
}
```

---

## 🎓 Best Practices

✅ **DO:**
- Verwende realistische Schnittfugen-Werte
- Importiere Zuschnittlisten als CSV
- Exportiere Ergebnisse als PDF vor dem Druck
- Überprüfe Flächenstatistiken vor Produktion

❌ **DON'T:**
- Schnittfuge = 0 (unrealistisch)
- Guillotine für komplexe Formen (ineffizient)
- Bearbeite JSON manuell (verwende CSV)
- Ignoriere Verschnittquote

---

**Fragen? Bugs?** → GitHub Issues
