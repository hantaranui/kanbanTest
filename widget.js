/* widget.js — Logique principale du Kanban */

/* ── État global ──────────────────────────────────────────────── */
let _records     = [];
let _colsMeta    = [];
let _tableId     = null;
let _statusColId = null;
let _mappings    = {};

/* ── Bootstrap Grist ──────────────────────────────────────────── */
grist.ready({
  requiredAccess: 'full',
  allowSelectBy: true,
  columns: [
    { name: 'STATUT',  title: 'Statut',   type: 'Choice', description: 'Colonne Choice qui définit les colonnes du Kanban' },
    { name: 'TITRE',   title: 'Titre',    type: 'Any',    description: 'Texte principal affiché sur chaque carte' },
    { name: 'CHAMP_2', title: 'Champ 2',  type: 'Any',    optional: true },
    { name: 'CHAMP_3', title: 'Champ 3',  type: 'Any',    optional: true },
    { name: 'CHAMP_4', title: 'Champ 4',  type: 'Any',    optional: true },
    { name: 'CHAMP_5', title: 'Champ 5',  type: 'Any',    optional: true },
    { name: 'CREE_LE', title: 'Créé le',  type: 'DateTime', optional: true },
    { name: 'CREE_PAR',title: 'Créé par', type: 'Any',    optional: true },
  ],
  async onEditOptions() { _showConfig(); }
});

/* ── Trouver le tableId via la table sélectionnée dans Grist ──── */
async function _resolveTableId() {
  /* Méthode 1 : grist.selectedTable (la plus fiable) */
  try {
    const t = grist.selectedTable;
    if (t && t.getTableId) {
      _tableId = await t.getTableId();
      console.log('[kanban] tableId via selectedTable =', _tableId);
      return;
    }
  } catch(e) { console.warn('[kanban] selectedTable:', e); }

  /* Méthode 2 : grist.getTable() */
  try {
    const info = await grist.getTable();
    const tid  = info.tableId || info._tableId || null;
    if (tid && !tid.startsWith('_grist')) {
      _tableId = tid;
      console.log('[kanban] tableId via getTable =', _tableId);
      return;
    }
  } catch(e) { console.warn('[kanban] getTable:', e); }

  /* Méthode 3 : croiser colonnes des records reçus avec _grist_Tables_column */
  try {
    const tablesData = await grist.docApi.fetchTable('_grist_Tables');
    const colsData   = await grist.docApi.fetchTable('_grist_Tables_column');
    const recCols    = _records.length > 0 ? Object.keys(_records[0]) : [];
    console.log('[kanban] colonnes dans records =', recCols);

    const tableIds = [...new Set(tablesData.tableId.filter(t => !t.startsWith('_grist')))];
    let bestTable = null, bestOverlap = 0;

    for (const tid of tableIds) {
      const tIdx  = tablesData.tableId.indexOf(tid);
      const tRef  = tablesData.id[tIdx];
      const tCols = colsData.colId.filter((_, i) => colsData.parentId[i] === tRef);
      if (!tCols.includes(_statusColId)) continue;
      const overlap = tCols.filter(c => recCols.includes(c)).length;
      console.log('[kanban] table', tid, '— overlap =', overlap);
      if (overlap > bestOverlap) { bestOverlap = overlap; bestTable = tid; }
    }

    if (bestTable) {
      _tableId = bestTable;
      console.log('[kanban] tableId résolu via overlap =', _tableId);
    }
  } catch(e) { console.warn('[kanban] _resolveTableId:', e); }
}


/* ── Chargement des métadonnées de colonnes ───────────────────── */
async function _loadColsMeta() {
  try {
    const tablesData = await grist.docApi.fetchTable('_grist_Tables');
    const colsData   = await grist.docApi.fetchTable('_grist_Tables_column');

    /* Trouver la ref interne de notre table */
    const tIdx    = tablesData.tableId.indexOf(_tableId);
    const tableRef = tIdx !== -1 ? tablesData.id[tIdx] : null;
    console.log('[kanban] tableRef =', tableRef, 'pour', _tableId);

    /* Construire les métadonnées en filtrant sur notre table */
    _colsMeta = colsData.id
      .map((id, i) => ({
        id,
        parentId:      colsData.parentId ? colsData.parentId[i] : null,
        colId:         colsData.colId[i],
        label:         colsData.label[i] || colsData.colId[i],
        type:          colsData.type[i]  || 'Text',
        widgetOptions: colsData.widgetOptions ? colsData.widgetOptions[i] : null,
      }))
      .filter(c => {
        if (!c.colId || c.colId.startsWith('gristHelper') || c.colId === 'manualSort') return false;
        if (tableRef !== null && c.parentId !== null) return c.parentId === tableRef;
        return true;
      });

    console.log('[kanban] colonnes :', _colsMeta.map(c => c.colId));

    /* Log des widgetOptions de Statut */
    const sm = _colsMeta.find(c => c.colId === _statusColId);
    if (sm) console.log('[kanban] Statut widgetOptions =', sm.widgetOptions);
    else console.warn('[kanban] colonne Statut non trouvée dans colsMeta');

    Config.setColsMeta(_colsMeta);
  } catch(e) {
    console.warn('[kanban] _loadColsMeta:', e);
  }
}

/* ── Écoute des options ────────────────────────────────────────── */
grist.onOptions((opts) => {
  Config.onOptions(opts, () => _render());
  _render();
});

/* ── Écoute des records ────────────────────────────────────────── */
grist.onRecords(async (records, mappings) => {
  _mappings    = mappings || {};
  _statusColId = _mappings['STATUT'] || null;
  console.log('[kanban] statusColId =', _statusColId);

  /* Résoudre le tableId depuis la colonne STATUT mappée */
  await _resolveTableId();
  await _loadColsMeta();

  _records = records;
  _render();
});

/* ── Rendu du board ───────────────────────────────────────────── */
async function _render() {
  const board  = document.getElementById('ls-board');
  const cfgDiv = document.getElementById('ls-config');
  board.innerHTML  = '';
  cfgDiv.innerHTML = '';

  if (!_statusColId) {
    board.innerHTML = `<div class="ls-empty">
      <strong>Configuration requise</strong><br>
      Associez une colonne <em>Choice</em> au champ <strong>Statut</strong>
      dans le panneau de droite de Grist.
    </div>`;
    return;
  }

  const statusMeta = _colsMeta.find(c => c.colId === _statusColId);
  const choices    = _getChoices(statusMeta);
  console.log('[kanban] choices =', choices);

  if (!choices.length) {
    board.innerHTML = `<div class="ls-empty">
      La colonne Statut ne contient pas encore de valeurs Choice.<br>
      Ajoutez des choix directement dans Grist sur la colonne <strong>Statut</strong>
      de la table <strong>${_tableId || 'source'}</strong>.
    </div>`;
    return;
  }

  choices.forEach(choice => board.appendChild(_buildColumn(choice, statusMeta)));

  _records.forEach(rec => {
    const statut = rec[_statusColId] ?? rec['STATUT'];
    const zone = board.querySelector(`.ls-col-body[data-statut="${CSS.escape(statut)}"]`);
    if (!zone) return;
    zone.appendChild(_buildCard(rec));
    _updateCounter(zone.closest('.ls-col'));
  });

  if (!Config.isReadonly()) {
    board.querySelectorAll('.ls-col-body').forEach(zone => {
      Sortable.create(zone, {
        group: 'ls-kanban', animation: 150,
        ghostClass: 'sortable-ghost', dragClass: 'sortable-drag',
        onEnd: async (evt) => {
          const recId     = parseInt(evt.item.dataset.recId, 10);
          const newStatut = evt.to.dataset.statut;
          if (!recId || !newStatut) return;
          try {
            await grist.docApi.applyUserActions([[
              'UpdateRecord', _tableId, recId, { [_statusColId]: newStatut }
            ]]);
          } catch(e) { console.error('[kanban] UpdateRecord:', e); }
          board.querySelectorAll('.ls-col').forEach(_updateCounter);
        }
      });
    });
  }

  board.querySelectorAll('.ls-col').forEach(col => {
    if (localStorage.getItem('ls_col_' + col.dataset.colId) === 'collapsed')
      col.classList.add('collapsed');
    _updateCounter(col);
  });
}

/* ── Construction d'une colonne ───────────────────────────────── */
function _buildColumn(choice, statusMeta) {
  const colors = Render.getChoiceColor(statusMeta, choice.label);
  const bg = colors?.bg || '#271B79';
  const fg = colors?.fg || '#FFFFFF';

  const col = document.createElement('div');
  col.className = 'ls-col';
  col.dataset.colId = choice.label;

  const header = document.createElement('div');
  header.className = 'ls-col-header';
  header.style.background = bg;
  header.style.color = fg;
  header.innerHTML = `
    <span class="ls-col-header-title">${choice.label}</span>
    <span class="ls-col-counter">(0)</span>
    <button class="ls-col-toggle" title="Réduire/agrandir" aria-label="Réduire la colonne">⇄</button>`;

  header.querySelector('.ls-col-toggle').addEventListener('click', (e) => {
    e.stopPropagation();
    col.classList.toggle('collapsed');
    localStorage.setItem('ls_col_' + choice.label,
      col.classList.contains('collapsed') ? 'collapsed' : 'open');
  });

  const body = document.createElement('div');
  body.className = 'ls-col-body';
  body.dataset.statut = choice.label;

  col.appendChild(header);
  col.appendChild(body);

  if (!Config.isReadonly()) {
    const addBtn = document.createElement('button');
    addBtn.className = 'ls-col-add';
    addBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Ajouter une carte`;
    addBtn.addEventListener('click', () => _addRecord(choice.label));
    col.appendChild(addBtn);
  }

  return col;
}

/* ── Construction d'une carte ─────────────────────────────────── */
function _buildCard(rec) {
  const card = document.createElement('div');
  card.className = 'ls-card';
  card.dataset.recId = rec.id;

  const titleColId = Config.getTitleCol() || _mappings['TITRE'] || 'TITRE';
  const titleVal   = rec[titleColId] ?? rec['TITRE'] ?? `#${rec.id}`;

  const titleEl = document.createElement('div');
  titleEl.className = 'ls-card-title';
  titleEl.textContent = String(titleVal || '(sans titre)');
  card.appendChild(titleEl);

  const fieldsEl = document.createElement('div');
  fieldsEl.className = 'ls-card-fields';
  const visibleFields = Config.getVisibleFields();

  ['CHAMP_2','CHAMP_3','CHAMP_4','CHAMP_5','CREE_LE','CREE_PAR'].forEach(name => {
    const colId = _mappings[name];
    if (!colId) return;
    if (visibleFields && !visibleFields.includes(colId)) return;
    if (colId === titleColId || colId === _statusColId) return;
    const val = rec[colId];
    if (Render.isNil(val)) return;
    const meta      = _colsMeta.find(c => c.colId === colId);
    const fieldType = meta?.type || 'Text';
    const label     = meta?.label || colId;
    fieldsEl.innerHTML += Render.field(label, meta, fieldType, val);
  });

  card.appendChild(fieldsEl);

  if (!Config.isReadonly()) {
    const delBtn = document.createElement('button');
    delBtn.className = 'ls-card-delete';
    delBtn.title = 'Supprimer cette carte';
    delBtn.setAttribute('aria-label', 'Supprimer');
    delBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`Supprimer "${titleVal}" ? Cette action est irréversible.`)) return;
      try {
        await grist.docApi.applyUserActions([['RemoveRecord', _tableId, rec.id]]);
      } catch(err) { console.error('[kanban] RemoveRecord:', err); }
    });
    card.appendChild(delBtn);
  }

  card.addEventListener('click', () => grist.setCursorPos({ rowId: rec.id }));
  return card;
}

/* ── Ajout d'un enregistrement ────────────────────────────────── */
async function _addRecord(statut) {
  if (!_tableId || !_statusColId) {
    console.error('[kanban] _addRecord: tableId ou statusColId manquant', _tableId, _statusColId);
    return;
  }
  try {
    await grist.docApi.applyUserActions([[
      'AddRecord', _tableId, null, { [_statusColId]: statut }
    ]]);
  } catch(e) { console.error('[kanban] AddRecord:', e); }
}

/* ── Panneau de config ────────────────────────────────────────── */
function _showConfig() {
  document.getElementById('ls-board').style.display  = 'none';
  document.getElementById('ls-config').style.display = 'block';
  Config.render(document.getElementById('ls-config'));
}

/* ── Extraire les choix depuis widgetOptions ──────────────────── */
function _getChoices(colMeta) {
  if (!colMeta) { console.warn('[kanban] _getChoices: colMeta null'); return []; }

  let wo = null;
  if (colMeta.widgetOptions) {
    try {
      wo = typeof colMeta.widgetOptions === 'string'
        ? JSON.parse(colMeta.widgetOptions)
        : colMeta.widgetOptions;
    } catch(e) { console.warn('[kanban] widgetOptions parse error', e); }
  }

  if (!wo) { console.warn('[kanban] widgetOptions vide ou null'); return []; }

  /* Format 1 : choicesById */
  if (wo.choicesById && typeof wo.choicesById === 'object') {
    const vals = Object.values(wo.choicesById)
      .map(c => ({ label: c.label ?? c.value ?? '' }))
      .filter(c => c.label);
    if (vals.length) return vals;
  }

  /* Format 2 : choices[] */
  if (Array.isArray(wo.choices)) {
    const vals = wo.choices
      .map(c => typeof c === 'string' ? { label: c } : { label: c.label ?? c.value ?? '' })
      .filter(c => c.label);
    if (vals.length) return vals;
  }

  /* Format 3 : choiceOptions{} */
  if (wo.choiceOptions && typeof wo.choiceOptions === 'object') {
    const vals = Object.keys(wo.choiceOptions)
      .map(k => ({ label: k }))
      .filter(c => c.label);
    if (vals.length) return vals;
  }

  console.warn('[kanban] _getChoices: aucun format reconnu', wo);
  return [];
}

function _updateCounter(colEl) {
  if (!colEl) return;
  const body    = colEl.querySelector('.ls-col-body');
  const counter = colEl.querySelector('.ls-col-counter');
  if (body && counter) counter.textContent = `(${body.children.length})`;
}
