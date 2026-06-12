/* widget.js — Kanban LaSuite.coop
   Inspiré des filtres d'Élodie Gateau + style FourAxis + charte LaSuite */

/* ── État global ─────────────────────────────────────────────── */
let _records         = [];   // enregistrements reçus de Grist
let _colsMeta        = [];   // métadonnées colonnes
let _tableId         = null;
let _currentUserRole = null;

/* Options persistées */
let _sourceColId     = null;  // colonne Choice source des colonnes Kanban
let _groupColId      = null;  // colonne Choice pour regroupement (optionnel)
let _visibleCols     = null;  // valeurs de source visibles (null = toutes)
let _visibleFields   = null;  // champs visibles sur les cartes (null = tous)
let _dateColId       = null;  // colonne date pour le filtre
let _hidePastDates   = false; // masquer cartes dont date est passée

/* UI state */
let _openPanel       = null;  // 'cols' | 'fields' | 'date' | null

const CAN_CREATE = ['Admin', 'Responsable'];
const DATE_COL_MAP = {
  'En cours': 'Date_en_cours',
  'Terminé':  'Date_termine',
  'Archivé':  'Date_archive',
  'Annulé':   'Date_annule',
};
const AVATAR_COLORS = ['#271B79','#16B7C7','#2F9E44','#D9480F','#6741D9','#C2255C'];

function avatarColor(s) {
  if (!s) return AVATAR_COLORS[0];
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}
function initials(s) {
  if (!s) return '?';
  const p = String(s).trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[p.length-1][0]).toUpperCase() : String(s).slice(0,2).toUpperCase();
}

/* ── Bootstrap Grist ─────────────────────────────────────────── */
grist.ready({ requiredAccess: 'full', allowSelectBy: true });

/* ── Résolution tableId ──────────────────────────────────────── */
async function _resolveTableId() {
  try {
    const t = grist.selectedTable;
    if (t?.getTableId) { _tableId = await t.getTableId(); return; }
  } catch(e) {}
  try {
    const info = await grist.getTable();
    const tid  = info?.tableId || info?._tableId;
    if (tid && !tid.startsWith('_grist')) { _tableId = tid; return; }
  } catch(e) {}
  try {
    const tablesData = await grist.docApi.fetchTable('_grist_Tables');
    const colsData   = await grist.docApi.fetchTable('_grist_Tables_column');
    const recCols    = _records.length > 0 ? Object.keys(_records[0]) : [];
    let best = null, bestScore = 0;
    for (const tid of [...new Set(tablesData.tableId.filter(t => !t.startsWith('_grist')))]) {
      const tIdx  = tablesData.tableId.indexOf(tid);
      const tRef  = tablesData.id[tIdx];
      const tCols = colsData.colId.filter((_, i) => colsData.parentId[i] === tRef);
      const score = tCols.filter(c => recCols.includes(c)).length;
      if (score > bestScore) { bestScore = score; best = tid; }
    }
    if (best) _tableId = best;
  } catch(e) {}
}

/* ── Métadonnées colonnes ────────────────────────────────────── */
async function _loadColsMeta() {
  try {
    const tablesData = await grist.docApi.fetchTable('_grist_Tables');
    const colsData   = await grist.docApi.fetchTable('_grist_Tables_column');
    const tIdx       = tablesData.tableId.indexOf(_tableId);
    const tableRef   = tIdx !== -1 ? tablesData.id[tIdx] : null;
    _colsMeta = colsData.id.map((id, i) => ({
      id, parentId: colsData.parentId?.[i] ?? null,
      colId: colsData.colId[i],
      label: colsData.label[i] || colsData.colId[i],
      type:  colsData.type[i]  || 'Text',
      widgetOptions: colsData.widgetOptions?.[i] ?? null,
    })).filter(c => {
      if (!c.colId || c.colId.startsWith('gristHelper') || c.colId === 'manualSort') return false;
      if (tableRef !== null && c.parentId !== null) return c.parentId === tableRef;
      return true;
    });
  } catch(e) { console.warn('[kanban] _loadColsMeta:', e); }
}

/* ── Rôle utilisateur ────────────────────────────────────────── */
async function _resolveUserRole() {
  try {
    const profile = await grist.getUserProfile();
    if (!profile?.email) return;
    const usersData = await grist.docApi.fetchTable('Utilisateurs');
    const idx = usersData.Email?.findIndex(e => e?.toLowerCase() === profile.email.toLowerCase()) ?? -1;
    if (idx !== -1 && usersData.Role) _currentUserRole = usersData.Role[idx] || null;
  } catch(e) {}
}

/* ── Options persistées ──────────────────────────────────────── */
grist.onOptions((opts) => {
  if (!opts) return;
  _sourceColId   = opts.ls_source   || null;
  _groupColId    = opts.ls_group    || null;
  _visibleCols   = opts.ls_vis_cols || null;
  _visibleFields = opts.ls_vis_flds || null;
  _dateColId     = opts.ls_date_col || null;
  _hidePastDates = !!opts.ls_hide_past;
  _render();
});

async function _saveOpts(patch) {
  const current = {
    ls_source:    _sourceColId,
    ls_group:     _groupColId,
    ls_vis_cols:  _visibleCols,
    ls_vis_flds:  _visibleFields,
    ls_date_col:  _dateColId,
    ls_hide_past: _hidePastDates,
    ...patch
  };
  // Mettre à jour l'état local
  _sourceColId   = current.ls_source;
  _groupColId    = current.ls_group;
  _visibleCols   = current.ls_vis_cols;
  _visibleFields = current.ls_vis_flds;
  _dateColId     = current.ls_date_col;
  _hidePastDates = current.ls_hide_past;
  try {
    for (const [k, v] of Object.entries(current)) {
      await grist.widgetApi.setOption(k, v);
    }
  } catch(e) {}
  _render();
}

/* ── Écoute records ──────────────────────────────────────────── */
grist.onRecords(async (records) => {
  await _resolveTableId();
  await _loadColsMeta();
  if (_currentUserRole === null) await _resolveUserRole();
  _records = records;

  /* Auto-sélection de la source si aucune choisie */
  if (!_sourceColId) {
    const choiceCols = _colsMeta.filter(c => c.type === 'Choice' || c.type === 'ChoiceList');
    if (choiceCols.length > 0) _sourceColId = choiceCols[0].colId;
  }
  _render();
});

/* ── Colonnes Choice disponibles ─────────────────────────────── */
function _getChoiceCols() {
  return _colsMeta.filter(c => c.type === 'Choice' || c.type === 'ChoiceList');
}

/* ── Extraire choices d'une colonne ──────────────────────────── */
function _getChoices(colMeta) {
  if (!colMeta) return [];
  let wo = null;
  try { wo = typeof colMeta.widgetOptions === 'string' ? JSON.parse(colMeta.widgetOptions) : colMeta.widgetOptions; }
  catch(e) { return []; }
  if (!wo) return [];
  if (wo.choicesById) {
    const v = Object.values(wo.choicesById).map(c => ({ label: c.label ?? c.value ?? '' })).filter(c => c.label);
    if (v.length) return v;
  }
  if (Array.isArray(wo.choices)) {
    const v = wo.choices.map(c => typeof c === 'string' ? { label: c } : { label: c.label ?? c.value ?? '' }).filter(c => c.label);
    if (v.length) return v;
  }
  if (wo.choiceOptions) {
    const v = Object.keys(wo.choiceOptions).map(k => ({ label: k })).filter(c => c.label);
    if (v.length) return v;
  }
  return [];
}

/* ── Rendu principal ─────────────────────────────────────────── */
function _render() {
  const board = document.getElementById('ls-board');
  board.innerHTML = '';

  /* Logo LaSuite au-dessus de la toolbar */
  const logoHeader = document.createElement('div');
  logoHeader.className = 'ls-logo-header';
  logoHeader.innerHTML = `<svg width="36" height="36" viewBox="0 0 329 331" fill="none" xmlns="http://www.w3.org/2000/svg" style="--marked-color:#16B7C7;--text-color:#271B79;--second-marked-color:#B9FFB7">
    <path d="M30 115c0-46.9442 38.0558-85 85-85H244c46.944 0 85 38.0558 85 85V246c0 46.944-38.056 85-85 85H115c-46.9442 0-85-38.056-85-85V115z" fill="var(--marked-color)"/>
    <path fill-rule="evenodd" clip-rule="evenodd" d="M244 42H115c-40.3168 0-73 32.6832-73 73V246c0 40.317 32.6832 73 73 73H244c40.317 0 73-32.683 73-73V115c0-40.3168-32.683-73-73-73zM115 30c-46.9442 0-85 38.0558-85 85V246c0 46.944 38.0558 85 85 85H244c46.944 0 85-38.056 85-85V115c0-46.9442-38.056-85-85-85H115z" fill="var(--text-color)"/>
    <path d="M0 64C0 28.6538 28.6538 0 64 0H236c35.346 0 64 28.6538 64 64V236c0 35.346-28.654 64-64 64H64c-35.3462 0-64-28.654-64-64V64z" fill="var(--second-marked-color)"/>
    <path fill-rule="evenodd" clip-rule="evenodd" d="M236 12H64C35.2812 12 12 35.2812 12 64V236c0 28.719 23.2812 52 52 52H236c28.719 0 52-23.281 52-52V64c0-28.7188-23.281-52-52-52zM64 0C28.6538 0 0 28.6538 0 64V236c0 35.346 28.6538 64 64 64H236c35.346 0 64-28.654 64-64V64c0-35.3462-28.654-64-64-64H64z" fill="var(--text-color)"/>
    <path fill-rule="evenodd" clip-rule="evenodd" d="M140.585 139.932l18.758 23.314C161.2 162.547 163.598 161.839 165.282 162.008 168.83 162.291 171.903 164.022 174.503 167.203 177.104 170.383 178.19 173.739 177.763 177.273 177.415 180.741 175.612 183.808 172.353 186.474L146.718 207.44C143.538 210.041 140.175 211.199 136.628 210.917 133.16 210.569 130.126 208.805 127.526 205.625 124.926 202.445 123.8 199.12 124.147 195.652 124.574 192.119 126.378 189.052 129.557 186.451 130.034 186.061 130.262 185.61 130.24 185.097 130.219 184.583 129.941 184.081 129.406 183.59l-16.359-18.062C111.992 164.4 111.107 164.129 110.392 164.714 104.669 169.395 100.759 174.914 98.6619 181.273 96.5001 187.551 96.2348 194.203 97.8658 201.227 99.5113 208.107 102.999 214.806 108.329 221.325 113.66 227.844 119.644 232.568 126.283 235.497 132.857 238.345 139.586 239.276 146.472 238.288 153.372 237.155 159.882 234.086 166.003 229.08l24.085-19.699c6.041-4.941 10.261-10.648 12.662-17.122C205.085 185.706 205.509 178.924 204.023 171.915 202.471 164.826 199.03 158.021 193.7 151.502 188.37 144.983 182.497 140.234 176.082 137.255 169.602 134.197 163.071 133.104 156.49 133.976 153.16 134.345 149.939 135.223 146.827 136.608L146.482 136.754S145.464 137.24 145.365 137.299C144.83 137.62 144.347 137.924 143.901 138.205 142.917 138.823 142.109 139.331 141.308 139.672 141.068 139.766 140.827 139.853 140.585 139.932z" fill="var(--marked-color)"/>
    <path fill-rule="evenodd" clip-rule="evenodd" d="M107.21 150.897C101.88 144.378 98.4388 137.574 96.8873 130.485 95.4007 123.475 95.825 116.694 98.1602 110.14 100.64 103.601 104.94 97.8291 111.061 92.8232l24.085-19.6987C141.187 68.1836 147.617 65.1793 154.438 64.1117 161.323 63.1236 168.053 64.054 174.627 66.9028 181.266 69.8311 187.25 74.5548 192.58 81.0741 197.911 87.5933 201.398 94.2927 203.044 101.172 204.755 108.131 204.529 114.75 202.367 121.029 200.35 127.322 196.48 132.809 190.757 137.49 190.041 138.075 189.116 137.837 187.982 136.774l-16.598-17.867L171.092 118.549C170.312 117.595 170.359 116.761 171.233 116.046 174.492 113.38 176.296 110.313 176.643 106.845 177.071 103.311 175.984 99.9546 173.384 96.7745 170.784 93.5944 167.71 91.863 164.163 91.5802 160.695 91.2324 157.332 92.3913 154.073 95.0568L128.438 116.023C125.258 118.624 123.455 121.691 123.028 125.224 122.68 128.692 123.806 132.017 126.406 135.197 129.006 138.377 132.04 140.141 135.508 140.489 137.473 140.645 138.654 140.622 140.506 139.894 140.265 139.989 140.749 139.814 140.506 139.894l18.758 23.314C158.937 163.331 158.627 163.454 158.341 163.571 157.89 163.755 157.159 164.146 156.997 164.276 156.904 164.352 155.46 165.165 155.059 165.328 154.907 165.39 154.818 165.427 154.73 165.463 154.554 165.534 154.379 165.604 153.723 165.869 150.743 167.071 147.705 167.948 144.539 168.325 137.958 169.198 131.387 168.138 124.828 165.144 118.413 162.165 112.54 157.416 107.21 150.897z" fill="var(--text-color)"/>
  </svg>`;
  board.appendChild(logoHeader);

  /* Barre de filtres */
  board.appendChild(_buildToolbar());

  if (!_sourceColId) {
    const empty = document.createElement('div');
    empty.className = 'ls-empty';
    empty.innerHTML = '<strong>Choisissez une source</strong><br>Sélectionnez une colonne Choice dans le menu "Choisir une source".';
    board.appendChild(empty);
    return;
  }

  const sourceMeta = _colsMeta.find(c => c.colId === _sourceColId);
  let choices = _getChoices(sourceMeta);

  /* Filtrer colonnes masquées — _visibleCols = liste des labels CACHÉS (comme Élodie) */
  if (_visibleCols && _visibleCols.length > 0) {
    choices = choices.filter(c => !_visibleCols.includes(c.label));
  }

  if (!choices.length) {
    const empty = document.createElement('div');
    empty.className = 'ls-empty';
    empty.textContent = 'Aucune colonne à afficher — vérifiez vos filtres.';
    board.appendChild(empty);
    return;
  }

  /* Filtrer records par date si activé */
  let records = _records;
  if (_dateColId && _hidePastDates) {
    const now = Date.now() / 1000;
    records = records.filter(r => {
      const v = r[_dateColId];
      if (!v) return true;
      const ts = typeof v === 'number' ? v : new Date(v).getTime() / 1000;
      return ts >= now;
    });
  }

  /* Container colonnes */
  const colsContainer = document.createElement('div');
  colsContainer.className = 'ls-cols-container';
  board.appendChild(colsContainer);

  choices.forEach(choice => {
    const col = _buildColumn(choice, sourceMeta, records);
    colsContainer.appendChild(col);
  });

  /* Activer SortableJS */
  if (!_isReadonly()) {
    colsContainer.querySelectorAll('.ls-col-body').forEach(zone => {
      Sortable.create(zone, {
        group: 'ls-kanban', animation: 150,
        ghostClass: 'sortable-ghost', dragClass: 'sortable-drag',
        onEnd: async (evt) => {
          const recId    = parseInt(evt.item.dataset.recId, 10);
          const newVal   = evt.to.dataset.statut;
          if (!recId || !newVal || !_tableId) return;
          try {
            const fields = { [_sourceColId]: newVal };
            const dateColId = DATE_COL_MAP[newVal];
            if (dateColId && _colsMeta.some(c => c.colId === dateColId)) {
              const rec = _records.find(r => r.id === recId);
              if (rec && !rec[dateColId]) fields[dateColId] = Math.floor(Date.now() / 1000);
            }
            await grist.docApi.applyUserActions([['UpdateRecord', _tableId, recId, fields]]);
          } catch(e) { console.error('[kanban] UpdateRecord:', e); }
          colsContainer.querySelectorAll('.ls-col').forEach(_updateCounter);
        }
      });
    });
  }

  colsContainer.querySelectorAll('.ls-col').forEach(col => {
    if (localStorage.getItem('ls_col_' + col.dataset.colId) === 'collapsed')
      col.classList.add('collapsed');
    _updateCounter(col);
  });
}

/* ── Barre de filtres ────────────────────────────────────────── */
function _buildToolbar() {
  const bar = document.createElement('div');
  bar.className = 'ls-toolbar';

  const choiceCols  = _getChoiceCols();
  const sourceMeta  = _colsMeta.find(c => c.colId === _sourceColId);
  const allChoices  = sourceMeta ? _getChoices(sourceMeta) : [];
  /* Tous les champs de la table — comme Élodie, pas de filtrage par type */
  const userFields = _colsMeta.filter(c =>
    c.colId !== 'manualSort' && !c.colId.startsWith('gristHelper')
  );
  /* Colonnes date — exactement comme Élodie Gateau (isDateLike) :
     regarde le type brut ET le widget dans widgetOptions */
  const dateCols = _colsMeta.filter(c => {
    if (!c.colId || c.colId.startsWith('gristHelper') || c.colId === 'manualSort') return false;
    const t = String(c.type || '').toLowerCase();
    let w = '';
    try {
      const wo = typeof c.widgetOptions === 'string' ? JSON.parse(c.widgetOptions) : (c.widgetOptions || {});
      w = String(wo?.widget || '').toLowerCase();
    } catch(e) {}
    return t.includes('date') || w === 'date' || w === 'datetime';
  });

  
  /* 1. Source */
  const srcWrap = document.createElement('div');
  srcWrap.className = 'ls-toolbar-select-wrap';
  const srcSel = document.createElement('select');
  srcSel.className = 'ls-toolbar-select';
  const srcDefault = document.createElement('option');
  srcDefault.value = ''; srcDefault.textContent = 'Choisir une source';
  srcSel.appendChild(srcDefault);
  choiceCols.forEach(col => {
    const opt = document.createElement('option');
    opt.value = col.colId;
    opt.textContent = col.label;
    opt.selected = col.colId === _sourceColId;
    srcSel.appendChild(opt);
  });
  srcSel.addEventListener('change', () => {
    _openPanel = null;
    _saveOpts({ ls_source: srcSel.value || null, ls_vis_cols: null, ls_group: null });
  });
  srcWrap.appendChild(srcSel);
  bar.appendChild(srcWrap);

  /* 2. Regrouper par */
  const grpWrap = document.createElement('div');
  grpWrap.className = 'ls-toolbar-select-wrap';
  const grpSel = document.createElement('select');
  grpSel.className = 'ls-toolbar-select';
  const grpDefault = document.createElement('option');
  grpDefault.value = ''; grpDefault.textContent = 'Regrouper par...';
  grpSel.appendChild(grpDefault);
  choiceCols.filter(c => c.colId !== _sourceColId).forEach(col => {
    const opt = document.createElement('option');
    opt.value = col.colId;
    opt.textContent = col.label;
    opt.selected = col.colId === _groupColId;
    grpSel.appendChild(opt);
  });
  grpSel.addEventListener('change', () => {
    _openPanel = null;
    _saveOpts({ ls_group: grpSel.value || null });
  });
  grpWrap.appendChild(grpSel);
  bar.appendChild(grpWrap);

  /* 3. Afficher les colonnes */
  const colsBtn = _buildToolbarBtn(
    _openPanel === 'cols' ? 'Masquer les colonnes' : 'Afficher les colonnes',
    () => { _openPanel = _openPanel === 'cols' ? null : 'cols'; _render(); }
  );
  bar.appendChild(colsBtn);

  /* 4. Afficher les champs */
  const fldsBtn = _buildToolbarBtn(
    _openPanel === 'fields' ? 'Masquer les champs' : 'Afficher les champs',
    () => { _openPanel = _openPanel === 'fields' ? null : 'fields'; _render(); }
  );
  bar.appendChild(fldsBtn);

  /* 5. Filtre date */
  const dateBtn = _buildToolbarBtn(
    _openPanel === 'date' ? 'Masquer filtre date' : 'Filtre date',
    () => { _openPanel = _openPanel === 'date' ? null : 'date'; _render(); }
  );
  bar.appendChild(dateBtn);

  /* Panneaux déroulants */
  if (_openPanel === 'cols' && allChoices.length > 0) {
    const panel = document.createElement('div');
    panel.className = 'ls-panel';
    const title = document.createElement('div');
    title.className = 'ls-panel-title';
    title.textContent = 'Colonnes :';
    panel.appendChild(title);
    const grid = document.createElement('div');
    grid.className = 'ls-panel-grid';

    /* Élodie stocke les CACHÉES (hidden), pas les visibles.
       _visibleCols est ici une liste de labels CACHÉS (null = rien de caché = tout visible) */
    const hiddenCols = Array.isArray(_visibleCols) ? _visibleCols : [];

    /* Option (vide) */
    const videChecked = !hiddenCols.includes('(vide)');
    const vide = _buildCheckbox('(vide)', '(vide)', videChecked, async (checked) => {
      let cur = [...hiddenCols];
      if (!checked) { if (!cur.includes('(vide)')) cur.push('(vide)'); }
      else cur = cur.filter(x => x !== '(vide)');
      await _saveOpts({ ls_vis_cols: cur.length === 0 ? null : cur });
    });
    grid.appendChild(vide);

    allChoices.forEach(choice => {
      const checked = !hiddenCols.includes(choice.label);
      const cb = _buildCheckbox(choice.label, choice.label, checked, async (isChecked) => {
        let cur = [...hiddenCols];
        if (!isChecked) { if (!cur.includes(choice.label)) cur.push(choice.label); }
        else cur = cur.filter(x => x !== choice.label);
        await _saveOpts({ ls_vis_cols: cur.length === 0 ? null : cur });
      });
      grid.appendChild(cb);
    });
    panel.appendChild(grid);

    const wrapper = document.createElement('div');
    wrapper.className = 'ls-toolbar-panel-wrapper';
    wrapper.appendChild(panel);
    bar.appendChild(wrapper);
  }

  if (_openPanel === 'fields' && userFields.length > 0) {
    const panel = document.createElement('div');
    panel.className = 'ls-panel';
    const title = document.createElement('div');
    title.className = 'ls-panel-title';
    title.textContent = 'Champs :';
    panel.appendChild(title);

    /* Afficher tous */
    const allCb = _buildCheckbox('Afficher tous', '__all__',
      _visibleFields === null,
      async (checked) => {
        await _saveOpts({ ls_vis_flds: checked ? null : [] });
      }
    );
    panel.appendChild(allCb);

    const grid = document.createElement('div');
    grid.className = 'ls-panel-grid';
    userFields.forEach(col => {
      const checked = _visibleFields === null || _visibleFields.includes(col.colId);
      const cb = _buildCheckbox(col.label, col.colId, checked, async (isChecked) => {
        let cur = _visibleFields ? [..._visibleFields] : userFields.map(c => c.colId);
        if (isChecked) { if (!cur.includes(col.colId)) cur.push(col.colId); }
        else cur = cur.filter(x => x !== col.colId);
        await _saveOpts({ ls_vis_flds: cur.length === userFields.length ? null : cur });
      });
      grid.appendChild(cb);
    });
    panel.appendChild(grid);

    const wrapper = document.createElement('div');
    wrapper.className = 'ls-toolbar-panel-wrapper';
    wrapper.appendChild(panel);
    bar.appendChild(wrapper);
  }

  if (_openPanel === 'date') {
    const panel = document.createElement('div');
    panel.className = 'ls-panel';
    const title = document.createElement('div');
    title.className = 'ls-panel-title';
    title.textContent = 'Filtre par date';
    panel.appendChild(title);

    const selWrap = document.createElement('div');
    selWrap.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:10px';
    const lbl = document.createElement('label');
    lbl.textContent = 'Champ date :';
    lbl.style.cssText = 'font-size:13px;font-weight:600;color:#271B79;white-space:nowrap';
    const sel = document.createElement('select');
    sel.className = 'ls-toolbar-select';
    sel.style.flex = '1';
    const none = document.createElement('option');
    none.value = ''; none.textContent = '— Aucun —';
    sel.appendChild(none);
    dateCols.forEach(col => {
      const opt = document.createElement('option');
      opt.value = col.colId; opt.textContent = col.label;
      opt.selected = col.colId === _dateColId;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => _saveOpts({ ls_date_col: sel.value || null }));
    selWrap.appendChild(lbl);
    selWrap.appendChild(sel);
    panel.appendChild(selWrap);

    const hideCb = _buildCheckbox('Masquer les cartes dont la date est passée', '__hide_past__',
      _hidePastDates,
      async (checked) => { await _saveOpts({ ls_hide_past: checked }); }
    );
    panel.appendChild(hideCb);

    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:12px;color:#16B7C7;margin-top:8px';
    hint.textContent = _dateColId ? '' : 'Si aucun champ n\'est choisi, aucune carte n\'est filtrée.';
    panel.appendChild(hint);

    const wrapper = document.createElement('div');
    wrapper.className = 'ls-toolbar-panel-wrapper';
    wrapper.appendChild(panel);
    bar.appendChild(wrapper);
  }

  return bar;
}

function _buildToolbarBtn(label, onClick) {
  const btn = document.createElement('button');
  btn.className = 'ls-toolbar-btn';
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

function _buildCheckbox(label, value, checked, onChange) {
  const row = document.createElement('div');
  row.className = 'ls-check-row';
  const cb = document.createElement('input');
  cb.type = 'checkbox'; cb.checked = checked;
  cb.style.accentColor = '#271B79';
  const lbl = document.createElement('label');
  lbl.textContent = label;
  lbl.style.cssText = 'font-size:13px;color:#271B79;cursor:pointer';
  cb.addEventListener('change', () => onChange(cb.checked));
  lbl.addEventListener('click', () => { cb.checked = !cb.checked; onChange(cb.checked); });
  row.appendChild(cb);
  row.appendChild(lbl);
  return row;
}

/* ── Construction colonne ────────────────────────────────────── */
function _buildColumn(choice, sourceMeta, records) {
  const colors   = Render.getChoiceColor(sourceMeta, choice.label);
  const dotColor = colors?.bg || '#271B79';

  const col = document.createElement('div');
  col.className = 'ls-col';
  col.dataset.colId = choice.label;

  const header = document.createElement('div');
  header.className = 'ls-col-header';
  header.innerHTML = `
    <span class="ls-col-dot" style="background:${dotColor}"></span>
    <span class="ls-col-header-title">${choice.label}</span>
    <span class="ls-col-counter">(0)</span>
    <div class="ls-col-actions">
      <button class="ls-col-btn ls-col-collapse-btn" title="Réduire">⇄</button>
      ${!_isReadonly() && CAN_CREATE.includes(_currentUserRole)
        ? `<button class="ls-col-btn ls-col-add-btn" title="Ajouter">+</button>`
        : ''}
    </div>`;

  header.querySelector('.ls-col-collapse-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    col.classList.toggle('collapsed');
    const isNowCollapsed = col.classList.contains('collapsed');
    localStorage.setItem('ls_col_' + choice.label, isNowCollapsed ? 'collapsed' : 'open');
    /* Mettre à jour le titre du bouton pour indiquer l'action possible */
    e.currentTarget.title = isNowCollapsed ? 'Agrandir' : 'Réduire';
  });
  const addBtn = header.querySelector('.ls-col-add-btn');
  if (addBtn) addBtn.addEventListener('click', () => _addRecord(choice.label));

  const body = document.createElement('div');
  body.className = 'ls-col-body';
  body.dataset.statut = choice.label;
  col.appendChild(header);
  col.appendChild(body);

  /* Cartes de cette colonne */
  const colRecords = records.filter(r => r[_sourceColId] === choice.label);

  if (_groupColId) {
    /* Regroupement par 2e colonne Choice */
    const groupMeta   = _colsMeta.find(c => c.colId === _groupColId);
    const groupVals   = _getChoices(groupMeta).map(c => c.label);
    const groups      = {};
    colRecords.forEach(r => {
      const gv = r[_groupColId] || '(vide)';
      if (!groups[gv]) groups[gv] = [];
      groups[gv].push(r);
    });

    /* Groupes connus d'abord, puis (vide) */
    const orderedKeys = [...groupVals.filter(v => groups[v]), ...(groups['(vide)'] ? ['(vide)'] : [])];
    orderedKeys.forEach(gk => {
      const accordion = document.createElement('div');
      accordion.className = 'ls-group';
      const gHeader = document.createElement('div');
      gHeader.className = 'ls-group-header';
      gHeader.innerHTML = `<span class="ls-group-label">${gk}</span><span class="ls-group-count">${groups[gk].length}</span>`;
      accordion.appendChild(gHeader);
      const gBody = document.createElement('div');
      gBody.className = 'ls-group-body';
      groups[gk].forEach(rec => gBody.appendChild(_buildCard(rec)));
      accordion.appendChild(gBody);
      /* Toggle accordéon */
      gHeader.addEventListener('click', () => accordion.classList.toggle('collapsed'));
      body.appendChild(accordion);
    });
  } else {
    colRecords.forEach(rec => body.appendChild(_buildCard(rec)));
  }

  if (!_isReadonly() && CAN_CREATE.includes(_currentUserRole)) {
    const addFooter = document.createElement('button');
    addFooter.className = 'ls-col-add';
    addFooter.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Ajouter une carte`;
    addFooter.addEventListener('click', () => _addRecord(choice.label));
    col.appendChild(addFooter);
  }

  return col;
}

/* ── Construction carte ──────────────────────────────────────── */
function _buildCard(rec) {
  const card = document.createElement('div');
  card.className = 'ls-card';
  card.dataset.recId = rec.id;

  /* Trouver colonne priorité */
  const prioCols = _colsMeta.filter(c =>
    (c.type === 'Choice') && c.colId.toLowerCase().includes('prior')
  );
  const prioColId  = prioCols[0]?.colId || null;
  const prioVal    = prioColId ? (rec[prioColId] ?? '') : '';
  const prioClass  = { 'Urgent':'urgent','High':'high','Medium':'medium','Low':'low',
                       'Haute':'urgent','Normale':'medium','Basse':'low' }[prioVal] || '';

  /* Ligne haute : priorité + menu */
  const top = document.createElement('div');
  top.className = 'ls-card-top';
  top.innerHTML = prioVal
    ? `<span class="ls-badge-prio ${prioClass}">${prioVal}</span>`
    : '<span></span>';

  if (!_isReadonly() && CAN_CREATE.includes(_currentUserRole)) {
    const menuBtn = document.createElement('button');
    menuBtn.className = 'ls-card-menu';
    menuBtn.innerHTML = '···';
    menuBtn.addEventListener('click', (e) => { e.stopPropagation(); _toggleCardMenu(menuBtn, rec); });
    top.appendChild(menuBtn);
  }
  card.appendChild(top);

  /* Titre — première colonne texte disponible */
  const titleCol = _colsMeta.find(c =>
    ['Text','Any'].includes(c.type) &&
    !c.colId.toLowerCase().includes('date') &&
    !c.colId.toLowerCase().includes('id')
  );
  const titleColId = titleCol?.colId || Object.keys(rec)[1] || 'id';
  const titleVal   = rec[titleColId] ?? `#${rec.id}`;
  const titleEl    = document.createElement('div');
  titleEl.className = 'ls-card-title';
  titleEl.textContent = String(titleVal || '(sans titre)');
  card.appendChild(titleEl);

  /* Champs visibles */
  const fieldsEl = document.createElement('div');
  fieldsEl.className = 'ls-card-fields';

  _colsMeta.forEach(col => {
    if (col.colId === titleColId) return;
    if (col.colId === _sourceColId) return;
    if (col.colId === prioColId) return;
    if (col.type === 'Attachments') return;
    if (_visibleFields !== null && !_visibleFields.includes(col.colId)) return;

    const val = rec[col.colId];
    if (Render.isNil(val)) return;

    /* Ne pas afficher les dates contextuelles ici — elles vont dans le footer */
    if (Object.values(DATE_COL_MAP).includes(col.colId)) return;

    fieldsEl.innerHTML += Render.field(col.label, col, col.type, val);
  });

  if (fieldsEl.innerHTML) card.appendChild(fieldsEl);

  /* Footer : date contextuelle + avatar */
  const statut    = rec[_sourceColId];
  const dateColId = DATE_COL_MAP[statut];
  const dateVal   = dateColId ? rec[dateColId] : (_dateColId ? rec[_dateColId] : null);

  /* Chercher colonne assigné */
  const assigneeCols = _colsMeta.filter(c =>
    c.colId.toLowerCase().includes('testeur') ||
    c.colId.toLowerCase().includes('assign') ||
    c.colId.toLowerCase().includes('responsable')
  );
  const assigneeVal = assigneeCols.length > 0 ? rec[assigneeCols[0].colId] : null;

  if (dateVal || (assigneeVal && !Render.isNil(assigneeVal))) {
    const footer = document.createElement('div');
    footer.className = 'ls-card-footer';

    const dateEl = document.createElement('div');
    dateEl.className = 'ls-card-date';
    if (dateVal && !Render.isNil(dateVal)) {
      dateEl.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        ${Render.formatDate(typeof dateVal === 'number' ? dateVal * 1000 : dateVal)}`;
    }
    footer.appendChild(dateEl);

    if (assigneeVal && !Render.isNil(assigneeVal)) {
      const label  = typeof assigneeVal === 'object'
        ? (assigneeVal.label ?? assigneeVal.name ?? String(assigneeVal.id ?? ''))
        : String(assigneeVal);
      const avatar = document.createElement('div');
      avatar.className = 'ls-avatar';
      avatar.style.background = avatarColor(label);
      avatar.textContent = initials(label);
      avatar.title = label;
      footer.appendChild(avatar);
    }
    card.appendChild(footer);
  }

  card.addEventListener('click', () => grist.setCursorPos({ rowId: rec.id }));
  return card;
}

/* ── Menu carte ──────────────────────────────────────────────── */
function _toggleCardMenu(btn, rec) {
  document.querySelectorAll('.ls-card-dropdown').forEach(d => d.remove());
  const dropdown = document.createElement('div');
  dropdown.className = 'ls-card-dropdown';
  const delBtn = document.createElement('button');
  delBtn.className = 'danger';
  delBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg> Supprimer`;
  delBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    dropdown.remove();
    const titleCol = _colsMeta.find(c => ['Text','Any'].includes(c.type) && !c.colId.includes('date'));
    const title = titleCol ? rec[titleCol.colId] : `#${rec.id}`;
    if (!confirm(`Supprimer "${title}" ? Cette action est irréversible.`)) return;
    try { await grist.docApi.applyUserActions([['RemoveRecord', _tableId, rec.id]]); }
    catch(e) { console.error('[kanban] RemoveRecord:', e); }
  });
  dropdown.appendChild(delBtn);
  btn.closest('.ls-card').appendChild(dropdown);
  setTimeout(() => {
    document.addEventListener('click', function h() { dropdown.remove(); document.removeEventListener('click', h); });
  }, 0);
}

/* ── Ajout record ────────────────────────────────────────────── */
async function _addRecord(val) {
  if (!_tableId || !_sourceColId) return;
  try { await grist.docApi.applyUserActions([['AddRecord', _tableId, null, { [_sourceColId]: val }]]); }
  catch(e) { console.error('[kanban] AddRecord:', e); }
}

function _isReadonly() { return false; }

function _updateCounter(colEl) {
  if (!colEl) return;
  const body    = colEl.querySelector('.ls-col-body');
  const counter = colEl.querySelector('.ls-col-counter');
  if (body && counter) {
    const cards = body.querySelectorAll('.ls-card');
    counter.textContent = `(${cards.length})`;
  }
}
