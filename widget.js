/* widget.js — Kanban LaSuite.coop — Style FourAxis */

/* ── État global ─────────────────────────────────────────────── */
let _records        = [];
let _colsMeta       = [];
let _tableId        = null;
let _statusColId    = null;
let _priorityColId  = null;
let _mappings       = {};
let _currentUserRole = null;

const DATE_COL_MAP = {
  'En cours': 'Date_en_cours',
  'Terminé':  'Date_termine',
  'Archivé':  'Date_archive',
  'Annulé':   'Date_annule',
};
const CAN_CREATE = ['Admin', 'Responsable'];

/* Couleurs avatar — cycle de 6 */
const AVATAR_COLORS = [
  '#271B79','#16B7C7','#2F9E44','#D9480F','#6741D9','#C2255C'
];
function avatarColor(str) {
  if (!str) return AVATAR_COLORS[0];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}
function initials(str) {
  if (!str) return '?';
  const parts = String(str).trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : String(str).slice(0, 2).toUpperCase();
}

/* ── Bootstrap Grist ─────────────────────────────────────────── */
grist.ready({
  requiredAccess: 'full',
  allowSelectBy: true,
  columns: [
    { name: 'STATUT',        title: 'Statut',        type: 'Choice',   description: 'Colonnes du Kanban' },
    { name: 'TITRE',         title: 'Titre',         type: 'Any',      description: 'Titre de la carte' },
    { name: 'PRIORITE',      title: 'Priorité',      type: 'Choice',   optional: true, description: 'Urgent / High / Medium / Low' },
    { name: 'ASSIGNEE',      title: 'Assigné à',     type: 'Any',      optional: true },
    { name: 'ECHEANCE',      title: 'Échéance',      type: 'Date',     optional: true },
    { name: 'CHAMP_2',       title: 'Champ 2',       type: 'Any',      optional: true },
    { name: 'CHAMP_3',       title: 'Champ 3',       type: 'Any',      optional: true },
    { name: 'CHAMP_4',       title: 'Champ 4',       type: 'Any',      optional: true },
    { name: 'DATE_EN_COURS', title: 'Date En cours', type: 'DateTime', optional: true },
    { name: 'DATE_TERMINE',  title: 'Date Terminé',  type: 'DateTime', optional: true },
    { name: 'DATE_ARCHIVE',  title: 'Date Archivé',  type: 'DateTime', optional: true },
    { name: 'DATE_ANNULE',   title: 'Date Annulé',   type: 'DateTime', optional: true },
    { name: 'CREE_LE',       title: 'Créé le',       type: 'DateTime', optional: true },
    { name: 'CREE_PAR',      title: 'Créé par',      type: 'Any',      optional: true },
  ],
  async onEditOptions() { _showConfig(); }
});

/* ── Résolution tableId ──────────────────────────────────────── */
async function _resolveTableId() {
  try {
    const t = grist.selectedTable;
    if (t && t.getTableId) { _tableId = await t.getTableId(); return; }
  } catch(e) {}
  try {
    const info = await grist.getTable();
    const tid  = info.tableId || info._tableId || null;
    if (tid && !tid.startsWith('_grist')) { _tableId = tid; return; }
  } catch(e) {}
  try {
    const tablesData = await grist.docApi.fetchTable('_grist_Tables');
    const colsData   = await grist.docApi.fetchTable('_grist_Tables_column');
    const recCols    = _records.length > 0 ? Object.keys(_records[0]) : [];
    const tableIds   = [...new Set(tablesData.tableId.filter(t => !t.startsWith('_grist')))];
    let best = null, bestScore = 0;
    for (const tid of tableIds) {
      const tIdx  = tablesData.tableId.indexOf(tid);
      const tRef  = tablesData.id[tIdx];
      const tCols = colsData.colId.filter((_, i) => colsData.parentId[i] === tRef);
      if (!tCols.includes(_statusColId)) continue;
      const score = tCols.filter(c => recCols.includes(c)).length;
      if (score > bestScore) { bestScore = score; best = tid; }
    }
    if (best) _tableId = best;
  } catch(e) { console.warn('[kanban] _resolveTableId:', e); }
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
      colId: colsData.colId[i], label: colsData.label[i] || colsData.colId[i],
      type: colsData.type[i] || 'Text',
      widgetOptions: colsData.widgetOptions?.[i] ?? null,
    })).filter(c => {
      if (!c.colId || c.colId.startsWith('gristHelper') || c.colId === 'manualSort') return false;
      if (tableRef !== null && c.parentId !== null) return c.parentId === tableRef;
      return true;
    });
    Config.setColsMeta(_colsMeta);
  } catch(e) { console.warn('[kanban] _loadColsMeta:', e); }
}

/* ── Rôle utilisateur ────────────────────────────────────────── */
async function _resolveUserRole() {
  try {
    const profile = await grist.getUserProfile();
    const email   = profile?.email || null;
    if (!email) return;
    const usersData = await grist.docApi.fetchTable('Utilisateurs');
    const idx = usersData.Email
      ? usersData.Email.findIndex(e => e && e.toLowerCase() === email.toLowerCase())
      : -1;
    if (idx !== -1 && usersData.Role) _currentUserRole = usersData.Role[idx] || null;
  } catch(e) { console.warn('[kanban] _resolveUserRole:', e); }
}

/* ── Écoute Grist ────────────────────────────────────────────── */
grist.onOptions((opts) => { Config.onOptions(opts, () => _render()); _render(); });

grist.onRecords(async (records, mappings) => {
  _mappings       = mappings || {};
  _statusColId    = _mappings['STATUT']   || null;
  _priorityColId  = _mappings['PRIORITE'] || null;
  await _resolveTableId();
  await _loadColsMeta();
  if (_currentUserRole === null) await _resolveUserRole();
  _records = records;
  _render();
});

/* ── Rendu board ─────────────────────────────────────────────── */
async function _render() {
  const board  = document.getElementById('ls-board');
  const cfgDiv = document.getElementById('ls-config');
  board.innerHTML = ''; cfgDiv.innerHTML = '';

  if (!_statusColId) {
    board.innerHTML = `<div class="ls-empty"><strong>Configuration requise</strong><br>Associez une colonne <em>Choice</em> au champ <strong>Statut</strong>.</div>`;
    return;
  }

  const statusMeta = _colsMeta.find(c => c.colId === _statusColId);
  const choices    = _getChoices(statusMeta);

  if (!choices.length) {
    board.innerHTML = `<div class="ls-empty">La colonne Statut ne contient pas encore de valeurs Choice.<br>Ajoutez des choix dans Grist.</div>`;
    return;
  }

  choices.forEach(choice => board.appendChild(_buildColumn(choice, statusMeta)));

  _records.forEach(rec => {
    const statut = rec[_statusColId] ?? rec['STATUT'];
    const zone   = board.querySelector(`.ls-col-body[data-statut="${CSS.escape(statut)}"]`);
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
            const fields = { [_statusColId]: newStatut };
            const dateColId = DATE_COL_MAP[newStatut];
            if (dateColId && _colsMeta.some(c => c.colId === dateColId)) {
              const rec = _records.find(r => r.id === recId);
              if (rec && !rec[dateColId]) fields[dateColId] = Math.floor(Date.now() / 1000);
            }
            await grist.docApi.applyUserActions([['UpdateRecord', _tableId, recId, fields]]);
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

/* ── Colonne ─────────────────────────────────────────────────── */
function _buildColumn(choice, statusMeta) {
  const colors = Render.getChoiceColor(statusMeta, choice.label);
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
      ${!Config.isReadonly() && CAN_CREATE.includes(_currentUserRole)
        ? `<button class="ls-col-btn ls-col-add-btn" title="Ajouter une carte">+</button>`
        : ''}
    </div>`;

  header.querySelector('.ls-col-collapse-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    col.classList.toggle('collapsed');
    localStorage.setItem('ls_col_' + choice.label,
      col.classList.contains('collapsed') ? 'collapsed' : 'open');
  });

  const addHeaderBtn = header.querySelector('.ls-col-add-btn');
  if (addHeaderBtn) addHeaderBtn.addEventListener('click', () => _addRecord(choice.label));

  const body = document.createElement('div');
  body.className = 'ls-col-body';
  body.dataset.statut = choice.label;

  col.appendChild(header);
  col.appendChild(body);

  if (!Config.isReadonly() && CAN_CREATE.includes(_currentUserRole)) {
    const addBtn = document.createElement('button');
    addBtn.className = 'ls-col-add';
    addBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Ajouter une carte`;
    addBtn.addEventListener('click', () => _addRecord(choice.label));
    col.appendChild(addBtn);
  }

  return col;
}

/* ── Carte ───────────────────────────────────────────────────── */
function _buildCard(rec) {
  const card = document.createElement('div');
  card.className = 'ls-card';
  card.dataset.recId = rec.id;

  /* Priorité */
  const priorityColId = _priorityColId || _mappings['PRIORITE'];
  const priorityVal   = priorityColId ? (rec[priorityColId] ?? '') : '';
  const prioClass     = {
    'Urgent': 'urgent', 'High': 'high', 'Medium': 'medium', 'Low': 'low',
    'Haute': 'urgent', 'Normale': 'medium', 'Basse': 'low',
  }[priorityVal] || '';

  /* Ligne haute */
  const top = document.createElement('div');
  top.className = 'ls-card-top';
  top.innerHTML = priorityVal
    ? `<span class="ls-badge-prio ${prioClass}">${priorityVal}</span>`
    : `<span></span>`;

  if (!Config.isReadonly() && CAN_CREATE.includes(_currentUserRole)) {
    const menuBtn = document.createElement('button');
    menuBtn.className = 'ls-card-menu';
    menuBtn.innerHTML = '···';
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      _toggleCardMenu(menuBtn, rec);
    });
    top.appendChild(menuBtn);
  }
  card.appendChild(top);

  /* Titre */
  const titleColId = Config.getTitleCol() || _mappings['TITRE'] || 'TITRE';
  const titleVal   = rec[titleColId] ?? rec['TITRE'] ?? `#${rec.id}`;
  const titleEl    = document.createElement('div');
  titleEl.className = 'ls-card-title';
  titleEl.textContent = String(titleVal || '(sans titre)');
  card.appendChild(titleEl);

  /* Champs extras */
  const visibleFields = Config.getVisibleFields();
  const fieldsEl = document.createElement('div');
  fieldsEl.className = 'ls-card-fields';

  ['CHAMP_2','CHAMP_3','CHAMP_4'].forEach(name => {
    const colId = _mappings[name];
    if (!colId) return;
    if (visibleFields && !visibleFields.includes(colId)) return;
    if (colId === titleColId || colId === _statusColId || colId === priorityColId) return;
    const val = rec[colId];
    if (Render.isNil(val)) return;
    const meta  = _colsMeta.find(c => c.colId === colId);
    const label = meta?.label || colId;
    fieldsEl.innerHTML += Render.field(label, meta, meta?.type || 'Text', val);
  });

  if (fieldsEl.innerHTML) card.appendChild(fieldsEl);

  /* Footer : date + avatar */
  const footer = document.createElement('div');
  footer.className = 'ls-card-footer';

  /* Date contextuelle ou échéance */
  const statut     = rec[_statusColId] ?? rec['STATUT'];
  const dateColId  = DATE_COL_MAP[statut];
  const echeanceId = _mappings['ECHEANCE'];
  let dateVal = dateColId ? rec[dateColId] : null;
  if (!dateVal && echeanceId) dateVal = rec[echeanceId];

  const dateEl = document.createElement('div');
  dateEl.className = 'ls-card-date';
  if (dateVal && !Render.isNil(dateVal)) {
    dateEl.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      ${Render.formatDate(typeof dateVal === 'number' ? dateVal * 1000 : dateVal)}`;
  }
  footer.appendChild(dateEl);

  /* Avatar assigné */
  const assigneeId = _mappings['ASSIGNEE'];
  const assigneeVal = assigneeId ? rec[assigneeId] : null;
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

  /* Clic → fiche liée */
  card.addEventListener('click', () => grist.setCursorPos({ rowId: rec.id }));
  return card;
}

/* ── Menu carte (supprimer) ──────────────────────────────────── */
function _toggleCardMenu(btn, rec) {
  /* Fermer tout menu ouvert */
  document.querySelectorAll('.ls-card-dropdown').forEach(d => d.remove());

  const dropdown = document.createElement('div');
  dropdown.className = 'ls-card-dropdown';

  const delBtn = document.createElement('button');
  delBtn.className = 'danger';
  delBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg> Supprimer`;
  delBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    dropdown.remove();
    const titleColId = Config.getTitleCol() || _mappings['TITRE'] || 'TITRE';
    const title = rec[titleColId] ?? `carte #${rec.id}`;
    if (!confirm(`Supprimer "${title}" ? Cette action est irréversible.`)) return;
    try {
      await grist.docApi.applyUserActions([['RemoveRecord', _tableId, rec.id]]);
    } catch(err) { console.error('[kanban] RemoveRecord:', err); }
  });

  dropdown.appendChild(delBtn);
  btn.closest('.ls-card').appendChild(dropdown);

  /* Fermer au clic extérieur */
  setTimeout(() => {
    document.addEventListener('click', function handler() {
      dropdown.remove();
      document.removeEventListener('click', handler);
    });
  }, 0);
}

/* ── Ajout enregistrement ────────────────────────────────────── */
async function _addRecord(statut) {
  if (!_tableId || !_statusColId) return;
  try {
    await grist.docApi.applyUserActions([['AddRecord', _tableId, null, { [_statusColId]: statut }]]);
  } catch(e) { console.error('[kanban] AddRecord:', e); }
}

/* ── Config ──────────────────────────────────────────────────── */
function _showConfig() {
  document.getElementById('ls-board').style.display  = 'none';
  document.getElementById('ls-config').style.display = 'block';
  Config.render(document.getElementById('ls-config'));
}

/* ── Extraire choices ────────────────────────────────────────── */
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

function _updateCounter(colEl) {
  if (!colEl) return;
  const body    = colEl.querySelector('.ls-col-body');
  const counter = colEl.querySelector('.ls-col-counter');
  if (body && counter) counter.textContent = `(${body.children.length})`;
}
