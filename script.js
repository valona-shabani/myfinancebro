/* everydayvalona – Verhalten der Seite (rechnen, speichern, anzeigen).
   Eingebunden am Ende von index.html mit einem script-Tag (src="script.js").
   Es steht dort ganz unten, damit das HTML-Gerüst schon existiert, wenn das Skript es sucht. */

/* ================= JAVASCRIPT: das Verhalten ================= */

/* ---------- A. Hilfsfunktionen ---------- */
// $ ist eine Abkürzung: $('#tabs') findet das Element mit id="tabs"
const $ = s => document.querySelector(s);

// Zahl -> deutsches Geld-Format, z.B. 1234.5 wird zu "1.234,50 €"
const eur = n => n.toLocaleString('de-DE', {style:'currency', currency:'EUR'});

// Schützt vor Schadcode: macht aus Zeichen wie < ein harmloses &lt;
// Wichtig, weil wir Texte des Nutzers (Kategorien, Notizen) in HTML einsetzen.
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- B. Grunddaten ---------- */
// Die vier Töpfe: links der interne Kurzname, rechts der angezeigte Name
const POTS = {spar:'Notgroschen', inv:'Investments', fix:'Fixkosten', tag:'Tagesgeld'};
// Farbe je Topf (für das Gesamt-Diagramm)
const COL = {spar:'#9ccb93', inv:'#f2d66b', fix:'#d9bd8f', tag:'#cfe3a6'};

// Name, unter dem der Browser deine Daten speichert
const KEY = 'everydayvalona-v1';

// Startzustand, falls noch nichts gespeichert ist
const DEF = {
  entries: [],                                          // alle Ein- und Ausgaben
  goals: {spar:25000, inv:1000, tag:500},               // Ziele und Budget (änderbar)
  cats: {                                               // Kategorien je Topf
    spar:['Rücklage'], inv:['ETF'],
    fix:['Miete','Versicherung','Abos'],
    tag:['Lebensmittel','Freizeit','Sonstiges']
  }
};

/* ---------- C. Speichern und Laden (localStorage) ---------- */
// S ("State") enthält alle Daten der App. Alles, was du siehst, wird aus S berechnet.
let S;
try { S = JSON.parse(localStorage.getItem(KEY)) || DEF; }  // gespeicherten Text zurück in Daten verwandeln
catch (e) { S = DEF; }                                      // try/catch: falls das Laden scheitert, startet die App trotzdem
// JSON.stringify macht aus Daten wieder Text, denn localStorage kann nur Text speichern
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

const today = new Date().toISOString().slice(0,10);   // "2026-11-02" (Datum als Text, erste 10 Zeichen)

// v ("View") merkt sich, was gerade angezeigt wird:
// tab = welcher Tab, mode = 'm' Monat oder 'y' Jahr, m = gewählter Monat als "2026-11"
let v = {tab:'all', mode:'m', m:today.slice(0,7)};

/* ---------- D. Rechenlogik ---------- */
const year = () => v.m.slice(0,4);   // "2026-11" -> "2026"

// Gehört ein Eintrag zum gewählten Zeitraum? Im Monatsmodus: gleicher Monat. Im Jahresmodus: gleiches Jahr.
// Dates sind Texte wie "2026-11-02", deshalb reicht slice() zum Vergleichen.
const inPeriod = e => v.mode==='m' ? e.date.slice(0,7)===v.m : e.date.slice(0,4)===year();

// Letzter Monat des Zeitraums (Jahresmodus: Dezember)
const endM = () => v.mode==='m' ? v.m : year()+'-12';

// STAND für Notgroschen/Investments: zählt ALLE Einträge bis zum Monat "end" zusammen.
// Genau das macht, dass diese Töpfe in die Folgemonate "rübergehen".
// filter() wählt passende Einträge aus, reduce() addiert sie (Einnahme +, Ausgabe -).
const bal = (p, end) =>
  S.entries.filter(e => e.pot===p && e.date.slice(0,7) <= end)
           .reduce((a,e) => a + (e.type==='in' ? e.amount : -e.amount), 0);

// AUSGABEN für Fixkosten/Tagesgeld: zählt NUR den gewählten Zeitraum.
// Genau das macht, dass diese Töpfe sich jeden Monat "zurücksetzen".
// f ist ein wählbarer Filter (Standard: inPeriod), die Jahrestabelle nutzt das für einzelne Monate.
const spent = (p, f = inPeriod) =>
  S.entries.filter(e => e.pot===p && f(e))
           .reduce((a,e) => a + (e.type==='out' ? e.amount : -e.amount), 0);

// Tagesgeld-Budget: im Jahresmodus 12 Monate lang
const budget = () => S.goals.tag * (v.mode==='m' ? 1 : 12);

/* ---------- E. Kreisdiagramm (selbst gezeichnet als SVG) ---------- */
// Trick: Ein Kreis ohne Füllung mit dicker Linie ist ein Ring. Mit "stroke-dasharray"
// zeichnet man nur ein Stück der Linie. Jedes Stück = eine Scheibe des Diagramms.
// parts = Liste aus {v: Wert, c: Farbe}, c1 = große Zahl in der Mitte, c2 = kleiner Text darunter
function donut(parts, c1, c2) {
  const R = 70;
  const C = 2 * Math.PI * R;   // Umfang des Kreises
  const t = parts.reduce((a,p) => a + Math.max(p.v,0), 0);   // Summe aller Werte (negative zählen als 0)
  let off = 0;                 // wo das nächste Stück beginnt
  // Grauer Hintergrund-Ring (sichtbar, wenn noch keine Daten da sind)
  let s = `<svg viewBox="0 0 200 200" class="donut" role="img"><circle cx="100" cy="100" r="${R}" fill="none" stroke="#e8dcc2" stroke-width="28"/>`;
  if (t > 0) parts.forEach(p => {
    const l = Math.max(p.v,0) / t * C;    // Länge dieses Stücks = Anteil am Ganzen x Umfang
    if (l > 0) {
      // dasharray "l  Rest": l sichtbar, danach Lücke. dashoffset verschiebt den Start.
      // rotate(-90): beginnt oben statt rechts.
      s += `<circle cx="100" cy="100" r="${R}" fill="none" stroke="${p.c}" stroke-width="28" stroke-dasharray="${l} ${C-l}" stroke-dashoffset="${-off}" transform="rotate(-90 100 100)"/>`;
      off += l;
    }
  });
  return s + `<text x="100" y="102" text-anchor="middle" class="c1">${c1}</text><text x="100" y="121" text-anchor="middle" class="c2">${c2}</text></svg>`;
}

// Legende unter dem Diagramm: pro Eintrag Farbpunkt, Name und Betrag. map() macht aus jedem Listenelement ein HTML-Stück.
const legend = parts => '<ul class="leg">' + parts.map(p =>
  `<li><span><i style="background:${p.c}"></i>${esc(p.l)}</span><b>${eur(p.v)}</b></li>`).join('') + '</ul>';

// Eingabefeld für Ziel/Budget. Bei Änderung (onchange) ruft es setGoal auf.
const goalBox = (k, label) =>
  `<div class="goal"><label for="g">${label}</label><input id="g" type="number" min="0" step="50" value="${S.goals[k]}" onchange="setGoal('${k}',this.value)"></div>`;
window.setGoal = (k, val) => {
  S.goals[k] = Math.max(0, parseFloat(val) || 0);   // Text -> Zahl, ungültig wird 0
  save();       // dauerhaft speichern
  render();     // Anzeige neu zeichnen
};

/* ---------- F. Die Ansichten je Tab ---------- */
function potView(p) {
  // Notgroschen & Investments: Fortschritt zum Ziel
  if (p==='spar' || p==='inv') {
    const b = bal(p, endM());                         // aktueller Stand
    const g = S.goals[p];                             // Ziel
    const pct = g ? Math.round(b/g*100) : 0;          // Prozent (g? verhindert Teilen durch 0)
    return `<h2>${POTS[p]}</h2>`
      + donut([{v:Math.min(b,g), c:COL[p]}, {v:Math.max(g-b,0), c:'#e8dcc2'}], pct+' %', 'von '+eur(g))
      + legend([{l:'Bisher', v:b, c:COL[p]}, {l:'Fehlt noch', v:Math.max(g-b,0), c:'#e8dcc2'}])
      + goalBox(p, 'Ziel in €')
      + '<p class="empty">Der Stand wird in die nächsten Monate mitgenommen.</p>';
  }
  // Fixkosten: nur Summe, aufgeteilt nach Kategorie
  if (p==='fix') {
    const tot = spent('fix');
    const cats = {};   // Objekt als Zähler: { Miete: 800, Abos: 25, ... }
    S.entries.filter(e => e.pot==='fix' && inPeriod(e))
             .forEach(e => cats[e.cat] = (cats[e.cat]||0) + (e.type==='out' ? e.amount : -e.amount));
    const shades = ['#d9bd8f','#e7cf9f','#c9a876','#f0dfb4','#b99763'];   // Brauntöne, die sich wiederholen
    const parts = Object.keys(cats).map((k,i) => ({l:k, v:cats[k], c:shades[i%5]}));   // i%5 = Rest beim Teilen, springt nach 5 wieder auf 0
    return `<h2>Fixkosten</h2>`
      + donut(parts, eur(tot), v.mode==='m' ? 'diesen Monat' : 'dieses Jahr')
      + (parts.length ? legend(parts) : '<p class="empty">Noch keine Fixkosten eingetragen.</p>')
      + '<p class="empty">Setzt sich jeden Monat zurück.</p>';
  }
  // Tagesgeld: Budget minus Ausgaben
  const sp = spent('tag'), bu = budget(), rest = bu - sp;
  return `<h2>Tagesgeld</h2>`
    + donut([{v:sp, c: rest<0 ? '#e3a79d' : '#f2d66b'}, {v:Math.max(rest,0), c:'#cfe3a6'}], eur(rest), 'übrig von '+eur(bu))   // rot, wenn das Budget überschritten ist
    + legend([{l:'Ausgegeben', v:sp, c:'#f2d66b'}, {l:'Übrig', v:Math.max(rest,0), c:'#cfe3a6'}])
    + goalBox('tag', 'Monatsbudget in €')
    + '<p class="empty">Setzt sich jeden Monat zurück.</p>';
}

// Gesamtübersicht: ein Diagramm mit allen vier Töpfen
function allView() {
  const parts = [
    {l:POTS.spar, v:bal('spar',endM()), c:COL.spar},
    {l:POTS.inv,  v:bal('inv',endM()),  c:COL.inv},
    {l:POTS.fix,  v:spent('fix'),       c:COL.fix},
    {l:POTS.tag,  v:spent('tag'),       c:COL.tag}
  ];
  const tot = parts.reduce((a,p) => a + Math.max(p.v,0), 0);
  return '<h2>Gesamtübersicht</h2>' + donut(parts, eur(tot), 'alle vier Töpfe') + legend(parts);
}

// Jahresansicht: Tabelle mit allen 12 Monaten
function monthsOfYear() {
  // Array.from erzeugt 12 Einträge ("2026-01" ... "2026-12"). padStart macht aus "1" ein "01".
  return Array.from({length:12}, (_,i) => year() + '-' + String(i+1).padStart(2,'0'));
}
function table() {
  const rows = monthsOfYear().map(m => {
    const f = e => e.date.slice(0,7) === m;   // Filter: nur dieser eine Monat
    return `<tr><td>${new Date(m+'-01').toLocaleDateString('de-DE',{month:'long'})}</td><td>${eur(bal('spar',m))}</td><td>${eur(bal('inv',m))}</td><td>${eur(spent('fix',f))}</td><td>${eur(spent('tag',f))}</td></tr>`;
  }).join('');
  return `<table><tr><th>Monat</th><th>Notgroschen (Stand)</th><th>Investments (Stand)</th><th>Fixkosten</th><th>Tagesgeld ausgegeben</th></tr>${rows}</table>`;
}

// Liste der einzelnen Einträge (neueste oben)
function list() {
  const items = S.entries
    .filter(e => (v.tab==='all' || e.pot===v.tab) && inPeriod(e))   // passender Topf UND Zeitraum
    .sort((a,b) => b.date.localeCompare(a.date));                   // sortieren nach Datum, absteigend
  $('#list').innerHTML = items.length
    ? items.map(e => `<li><small>${new Date(e.date).toLocaleDateString('de-DE')}</small><span>${esc(e.cat)} <small>· ${POTS[e.pot]}${e.note ? ' · '+esc(e.note) : ''}</small></span><b class="${e.type}">${e.type==='in' ? '+' : '−'}${eur(e.amount)}</b><button class="del" onclick="del('${e.id}')" aria-label="Eintrag löschen">×</button></li>`).join('')
    : '<li class="empty">Hier ist noch nichts. Trag oben deinen ersten Eintrag ein.</li>';
}
// Eintrag löschen: alle behalten, außer den mit dieser id
window.del = id => { S.entries = S.entries.filter(e => e.id !== id); save(); render(); };

/* ---------- G. render(): alles neu zeichnen ----------
   Das Grundprinzip: Daten (S und v) ändern sich -> render() baut die Anzeige daraus neu auf.
   Du änderst nie direkt, was auf dem Bildschirm steht, sondern nur die Daten. */
function render() {
  // Tab-Buttons erzeugen, der aktive bekommt die Klasse "on"
  $('#tabs').innerHTML = [['all','Gesamt'], ...Object.entries(POTS)]
    .map(([k,n]) => `<button data-t="${k}" class="${v.tab===k ? 'on' : ''}">${n}</button>`).join('');
  // Lichtschalter: an = Jahr. aria-checked steuert die CSS-Darstellung (Knopf rechts/links) und sagt Screenreadern den Zustand.
  $('#switch').setAttribute('aria-checked', v.mode === 'y');
  $('#swM').classList.toggle('active', v.mode === 'm');   // gewählte Beschriftung fett
  $('#swY').classList.toggle('active', v.mode === 'y');
  // Beschriftung der Navigation: "November 2026" oder "2026"
  $('#label').textContent = v.mode==='m'
    ? new Date(v.m+'-01').toLocaleDateString('de-DE', {month:'long', year:'numeric'})
    : year();
  // Hauptkarte: Gesamt oder einzelner Topf
  $('#view').innerHTML = v.tab==='all' ? allView() : potView(v.tab);
  // Jahrestabelle nur im Jahresmodus zeigen
  $('#yearbox').hidden = v.mode !== 'y';
  if (v.mode==='y') $('#table').innerHTML = table();
  list();
}

/* ---------- H. Klicks und Eingaben verarbeiten ---------- */
// Event Delegation: ein Listener am Container statt einer pro Button. Funktioniert auch für Buttons, die später neu erzeugt werden.
$('#tabs').onclick = e => { if (e.target.dataset.t) { v.tab = e.target.dataset.t; render(); } };
// Lichtschalter: bei jedem Klick zwischen Monat ('m') und Jahr ('y') wechseln
$('#switch').onclick = () => { v.mode = v.mode === 'm' ? 'y' : 'm'; render(); };

// Lichtschalter im Formular: aus = Ausgabe, an = Einnahme.
// Der Zustand steckt in aria-checked ("true"/"false"). Das ist die einzige Stelle, an der er gespeichert wird.
// Beim Absenden lesen wir ihn wieder aus (siehe unten).
const isIncome = () => $('#typeSwitch').getAttribute('aria-checked') === 'true';
$('#typeSwitch').onclick = () => {
  const on = !isIncome();                                  // Zustand umdrehen
  $('#typeSwitch').setAttribute('aria-checked', on);
  $('#swOut').classList.toggle('active', !on);             // gewählte Beschriftung fett
  $('#swIn').classList.toggle('active', on);
};

// Pfeile: Monat bzw. Jahr um d (+1 / -1) verschieben, inklusive Wechsel über den Jahreswechsel
const shift = d => {
  let [y, m] = v.m.split('-').map(Number);   // "2026-11" -> y=2026, m=11
  if (v.mode==='y') y += d;
  else { m += d; if (m<1) { m=12; y--; } if (m>12) { m=1; y++; } }
  v.m = y + '-' + String(m).padStart(2,'0');
  render();
};
$('#prev').onclick = () => shift(-1);
$('#next').onclick = () => shift(1);

// Kategorie-Dropdown füllen: abhängig vom gewählten Topf, plus Option zum Anlegen neuer Kategorien
function fillCats(sel) {
  const p = $('#pot').value;
  $('#cat').innerHTML = S.cats[p].map(c => `<option>${esc(c)}</option>`).join('') + '<option value="__new">+ Neue Kategorie …</option>';
  if (sel) $('#cat').value = sel;   // optional direkt die neue Kategorie auswählen
}
// Start: Topf-Auswahl füllen, "Tagesgeld" vorauswählen, heutiges Datum setzen
$('#pot').innerHTML = Object.entries(POTS).map(([k,n]) => `<option value="${k}">${n}</option>`).join('');
$('#pot').value = 'tag'; fillCats(); $('#date').value = today;
$('#pot').onchange = () => fillCats();   // anderer Topf = andere Kategorien

// Neue Kategorie: nach Auswahl von "+ Neue Kategorie" nach dem Namen fragen und speichern
$('#cat').onchange = () => {
  if ($('#cat').value !== '__new') return;
  const n = (prompt('Name der neuen Kategorie:') || '').trim(), p = $('#pot').value;
  if (n && !S.cats[p].includes(n)) { S.cats[p].push(n); save(); }
  fillCats(n || undefined);
};

// Formular absenden: neuen Eintrag anlegen
$('#f').onsubmit = e => {
  e.preventDefault();   // verhindert, dass der Browser die Seite neu lädt (sonst wären Daten weg)
  const amount = parseFloat($('#amt').value);
  if (!amount || $('#cat').value === '__new') return;   // Sicherheitscheck
  S.entries.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,5),   // eindeutige Nummer, damit wir den Eintrag später löschen können
    date: $('#date').value, pot: $('#pot').value, type: isIncome() ? 'in' : 'out',   // Schalter an = Einnahme ('in'), aus = Ausgabe ('out')
    cat: $('#cat').value, amount, note: $('#note').value.trim()
  });
  save();
  $('#amt').value = ''; $('#note').value = '';   // Felder leeren
  v.m = $('#date').value.slice(0,7);             // zum Monat des Eintrags springen
  render();
};

// Erster Start: alles zum ersten Mal zeichnen
render();