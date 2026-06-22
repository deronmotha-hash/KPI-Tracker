// ═══════════════════════════════════════════════════════════════
// KPI Tracker — Google Apps Script Backend (Generic / Shareable)
// ═══════════════════════════════════════════════════════════════
// 
// SETUP:
// 1. Create a new Google Sheet
// 2. Extensions → Apps Script
// 3. Delete the default Code.gs contents and paste this entire file
// 4. Click the function dropdown (top bar), select "setupSheet", click Run
// 5. Authorise when prompted (grant spreadsheet access)
// 6. Deploy → New deployment → Web app
//    - Execute as: Me
//    - Who has access: Anyone
// 7. Copy the deployment URL → paste into the tracker app settings
//
// REDEPLOYING after edits:
//    Deploy → Manage deployments → edit the existing one → New version → Deploy
// ═══════════════════════════════════════════════════════════════

const ss = SpreadsheetApp.getActiveSpreadsheet();

// ── HTTP handlers ────────────────────────────────────────────

function doGet(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    return send(getAllData());
  } catch (err) {
    return send({ error: err.message });
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const p = JSON.parse(e.postData.contents);
    let result;
    switch (p.action) {
      case 'addEntry':    result = addEntry(p.data);    break;
      case 'updateEntry': result = updateEntry(p.data);  break;
      case 'deleteEntry': result = deleteEntry(p.id);    break;
      case 'addKpi':      result = addKpi(p.data);       break;
      case 'updateKpi':   result = updateKpi(p.data);    break;
      case 'deleteKpi':   result = deleteKpi(p.id);      break;
      case 'assignAppraisal':  result = assignAppraisal(p.data);  break;
      case 'respondAppraisal': result = respondAppraisal(p.data); break;
      case 'updateAppraisal':  result = updateAppraisal(p.data);  break;
      case 'deleteAppraisal':  result = deleteAppraisal(p.id);    break;
      case 'addPeriod':       result = addPeriod(p.data);     break;
      case 'updatePeriod':    result = updatePeriod(p.data);  break;
      case 'setActivePeriod': result = setActivePeriod(p.id); break;
      case 'deletePeriod':    result = deletePeriod(p.id);    break;
      case 'resetData':   result = resetAllData();        break;
      default:            result = { error: 'Unknown action: ' + p.action };
    }
    return send(result);
  } catch (err) {
    return send({ error: err.message });
  } finally {
    lock.releaseLock();
  }
}

function send(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Read ─────────────────────────────────────────────────────

function getAllData() {
  migrateLegacyData();
  return {
    kpis: readTab('KPIs'),
    entries: readTab('Entries'),
    appraisals: readTab('Appraisals'),
    periods: readTab('Periods')
  };
}

function readTab(name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const [headers, ...rows] = sheet.getDataRange().getValues();
  const tz = ss.getSpreadsheetTimeZone();
  return rows.map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      let v = row[i];
      // Google Sheets converts date strings to Date objects;
      // normalise back to yyyy-MM-dd so the frontend gets clean strings
      if (v instanceof Date) {
        v = Utilities.formatDate(v, tz, 'yyyy-MM-dd');
      }
      obj[h] = v;
    });
    if (obj.hours !== undefined) obj.hours = Number(obj.hours) || 0;
    if (obj.id !== undefined) obj.id = String(obj.id);
    return obj;
  });
}

// ── Write: Entries ───────────────────────────────────────────

function addEntry(entry) {
  const sheet = ss.getSheetByName('Entries');
  if (!entry.id) entry.id = Date.now().toString();
  sheet.appendRow([
    entry.id, entry.date, entry.title, entry.description || '',
    entry.kpiId, Number(entry.hours) || 0, entry.evidence || '', entry.periodId || ''
  ]);
  return { success: true, entry: entry };
}

function updateEntry(entry) {
  const sheet = ss.getSheetByName('Entries');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(entry.id)) {
      sheet.getRange(i + 1, 1, 1, 8).setValues([[
        entry.id, entry.date, entry.title, entry.description || '',
        entry.kpiId, Number(entry.hours) || 0, entry.evidence || '', entry.periodId || ''
      ]]);
      return { success: true };
    }
  }
  return { error: 'Entry not found: ' + entry.id };
}

function deleteEntry(id) {
  const sheet = ss.getSheetByName('Entries');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: 'Entry not found: ' + id };
}

// ── Write: KPIs ──────────────────────────────────────────────

function addKpi(kpi) {
  const sheet = ss.getSheetByName('KPIs');
  if (!kpi.id) kpi.id = 'kpi-' + Date.now().toString();
  sheet.appendRow([
    kpi.id, kpi.name, kpi.color || '#5b6abf',
    kpi.description || '', kpi.scope || '',
    kpi.metrics || '', kpi.reporting || '', kpi.periodId || ''
  ]);
  return { success: true, kpi: kpi };
}

function updateKpi(kpi) {
  const sheet = ss.getSheetByName('KPIs');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(kpi.id)) {
      sheet.getRange(i + 1, 1, 1, 8).setValues([[
        kpi.id, kpi.name, kpi.color,
        kpi.description || '', kpi.scope || '',
        kpi.metrics || '', kpi.reporting || '', kpi.periodId || ''
      ]]);
      return { success: true };
    }
  }
  return { error: 'KPI not found: ' + kpi.id };
}

function deleteKpi(id) {
  const sheet = ss.getSheetByName('KPIs');
  const data = sheet.getDataRange().getValues();
  let found = false;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      found = true;
      break;
    }
  }
  if (!found) return { error: 'KPI not found: ' + id };

  // Cascade: remove all entries assigned to this KPI
  const eSheet = ss.getSheetByName('Entries');
  const eData = eSheet.getDataRange().getValues();
  // Delete bottom-up so row indices stay valid
  for (let i = eData.length - 1; i >= 1; i--) {
    if (String(eData[i][4]) === String(id)) {
      eSheet.deleteRow(i + 1);
    }
  }
  return { success: true };
}

// ── Reset ────────────────────────────────────────────────────

function resetAllData() {
  var eSheet = ss.getSheetByName('Entries');
  if (eSheet.getLastRow() > 1) {
    eSheet.deleteRows(2, eSheet.getLastRow() - 1);
  }
  var kSheet = ss.getSheetByName('KPIs');
  if (kSheet.getLastRow() > 1) {
    kSheet.deleteRows(2, kSheet.getLastRow() - 1);
  }
  return { success: true, kpis: [], entries: [] };
}



// ── Periods ──────────────────────────────────────────────────
// Columns: id | label | startDate | endDate | active

function getPeriodsSheet() {
  let s = ss.getSheetByName('Periods');
  if (!s) {
    s = ss.insertSheet('Periods');
    s.appendRow(['id', 'label', 'startDate', 'endDate', 'active']);
    s.getRange('A:D').setNumberFormat('@');
    s.setFrozenRows(1);
  }
  return s;
}

function seedDefaultPeriod() {
  // Creates a single active default period if none exist; returns its id.
  const sheet = getPeriodsSheet();
  if (sheet.getLastRow() >= 2) {
    // return the first existing period id
    return String(sheet.getRange(2, 1).getValue());
  }
  const now = new Date();
  // Default UK appraisal year: 1 Apr – 31 Mar
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const id = 'period-' + Date.now().toString();
  const label = y + '/' + String(y + 1).slice(2);
  sheet.appendRow([id, label, y + '-04-01', (y + 1) + '-03-31', 'yes']);
  return id;
}

function migrateLegacyData() {
  // One-time self-heal: if a Periods tab is empty, seed one; if KPIs/Entries
  // lack a periodId column or have blank periodIds, assign them to the active period.
  const pSheet = getPeriodsSheet();
  if (pSheet.getLastRow() < 2) {
    seedDefaultPeriod();
  }
  // find active (or first) period id
  const pData = pSheet.getDataRange().getValues();
  let activeId = null, firstId = null;
  for (let i = 1; i < pData.length; i++) {
    if (!firstId) firstId = String(pData[i][0]);
    if (String(pData[i][4]).toLowerCase() === 'yes') activeId = String(pData[i][0]);
  }
  const targetId = activeId || firstId;
  if (!targetId) return;

  ['KPIs', 'Entries'].forEach(function(tabName) {
    const sh = ss.getSheetByName(tabName);
    if (!sh || sh.getLastRow() < 1) return;
    const data = sh.getDataRange().getValues();
    let headers = data[0];
    let pidCol = headers.indexOf('periodId');
    if (pidCol === -1) {
      // add the column header at the end
      pidCol = headers.length;
      sh.getRange(1, pidCol + 1).setValue('periodId');
    }
    if (sh.getLastRow() < 2) return;
    // fill blanks
    const rng = sh.getRange(2, pidCol + 1, sh.getLastRow() - 1, 1);
    const vals = rng.getValues();
    let changed = false;
    for (let i = 0; i < vals.length; i++) {
      if (!vals[i][0]) { vals[i][0] = targetId; changed = true; }
    }
    if (changed) rng.setValues(vals);
  });
}

function addPeriod(p) {
  const sheet = getPeriodsSheet();
  if (!p.id) p.id = 'period-' + Date.now().toString();
  if (p.active) clearActiveFlags();
  sheet.appendRow([p.id, p.label, p.startDate || '', p.endDate || '', p.active ? 'yes' : '']);
  return { success: true, period: p };
}

function updatePeriod(p) {
  const sheet = getPeriodsSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(p.id)) {
      if (p.active) clearActiveFlags();
      sheet.getRange(i + 1, 1, 1, 5).setValues([[p.id, p.label, p.startDate || '', p.endDate || '', p.active ? 'yes' : '']]);
      return { success: true };
    }
  }
  return { error: 'Period not found: ' + p.id };
}

function setActivePeriod(id) {
  clearActiveFlags();
  const sheet = getPeriodsSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.getRange(i + 1, 5).setValue('yes');
      return { success: true };
    }
  }
  return { error: 'Period not found: ' + id };
}

function clearActiveFlags() {
  const sheet = getPeriodsSheet();
  if (sheet.getLastRow() < 2) return;
  const n = sheet.getLastRow() - 1;
  const range = sheet.getRange(2, 5, n, 1);
  const vals = range.getValues().map(function() { return ['']; });
  range.setValues(vals);
}

function deletePeriod(id) {
  const pSheet = getPeriodsSheet();
  const pData = pSheet.getDataRange().getValues();
  let found = false;
  for (let i = 1; i < pData.length; i++) {
    if (String(pData[i][0]) === String(id)) { pSheet.deleteRow(i + 1); found = true; break; }
  }
  if (!found) return { error: 'Period not found: ' + id };
  ['KPIs', 'Entries'].forEach(function(tabName) {
    const sh = ss.getSheetByName(tabName);
    if (!sh || sh.getLastRow() < 2) return;
    const data = sh.getDataRange().getValues();
    const headers = data[0];
    const pidCol = headers.indexOf('periodId');
    if (pidCol === -1) return;
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][pidCol]) === String(id)) sh.deleteRow(i + 1);
    }
  });
  return { success: true };
}

// ── Appraisals ───────────────────────────────────────────────
// Columns: id | title | description | assigned | due | status | response | respondedDate
// Tasks are assigned by the manager app; responses written by the employee app.
// The tab is created on demand so existing sheets don't need setupSheet rerun.

function getAppraisalsSheet() {
  let s = ss.getSheetByName('Appraisals');
  if (!s) {
    s = ss.insertSheet('Appraisals');
    s.appendRow(['id', 'title', 'description', 'assigned', 'due', 'status', 'response', 'respondedDate']);
    s.getRange('A:A').setNumberFormat('@');
    s.getRange('D:E').setNumberFormat('@');
    s.getRange('H:H').setNumberFormat('@');
    s.setFrozenRows(1);
  }
  return s;
}

function assignAppraisal(task) {
  const sheet = getAppraisalsSheet();
  if (!task.id) task.id = 'apr-' + Date.now().toString();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(task.id)) {
      return { success: true, skipped: true };
    }
  }
  sheet.appendRow([
    task.id,
    task.title,
    task.description || '',
    new Date().toISOString().split('T')[0],
    task.due || '',
    'pending',
    '',
    ''
  ]);
  return { success: true, task: task };
}

function respondAppraisal(data) {
  const sheet = getAppraisalsSheet();
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.id)) {
      sheet.getRange(i + 1, 6, 1, 3).setValues([[
        data.status || 'completed',
        data.response || '',
        new Date().toISOString().split('T')[0]
      ]]);
      return { success: true };
    }
  }
  return { error: 'Appraisal task not found: ' + data.id };
}


function updateAppraisal(task) {
  const sheet = getAppraisalsSheet();
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(task.id)) {
      // Update title, description, due only — status and response stay with the employee
      sheet.getRange(i + 1, 2, 1, 2).setValues([[task.title, task.description || '']]);
      sheet.getRange(i + 1, 5).setValue(task.due || '');
      return { success: true };
    }
  }
  return { error: 'Appraisal task not found: ' + task.id };
}

function deleteAppraisal(id) {
  const sheet = getAppraisalsSheet();
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: 'Appraisal task not found: ' + id };
}

// ── Setup (run once) ─────────────────────────────────────────

function setupSheet() {
  // Safety guard: never wipe a sheet that already holds data.
  function hasData(name) {
    const s = ss.getSheetByName(name);
    return s && s.getLastRow() > 1;
  }
  if (hasData('KPIs') || hasData('Entries')) {
    try {
      SpreadsheetApp.getUi().alert('Setup blocked: this sheet already contains data.\n\nRunning setup would erase it. To update the code instead, use Deploy \u2192 Manage deployments \u2192 edit \u2192 New version. No setup needed.');
    } catch (e) {
      throw new Error('Setup blocked: sheet already contains data. Use Manage deployments \u2192 New version to update code without wiping data.');
    }
    return;
  }

  var kSheet = ss.getSheetByName('KPIs');
  if (!kSheet) {
    kSheet = ss.insertSheet('KPIs');
  } else {
    kSheet.clear();
  }
  kSheet.appendRow(['id', 'name', 'color', 'description', 'scope', 'metrics', 'reporting', 'periodId']);
  kSheet.setFrozenRows(1);
  // Force id column to plain text so numeric-looking ids don't get converted
  kSheet.getRange('A:A').setNumberFormat('@');
  kSheet.autoResizeColumns(1, 7);

  var eSheet = ss.getSheetByName('Entries');
  if (!eSheet) {
    eSheet = ss.insertSheet('Entries');
  } else {
    eSheet.clear();
  }
  eSheet.appendRow(['id', 'date', 'title', 'description', 'kpiId', 'hours', 'evidence', 'periodId']);
  eSheet.setFrozenRows(1);
  // Force id and date columns to plain text — prevents timezone-shifted date bugs
  eSheet.getRange('A:A').setNumberFormat('@');
  eSheet.getRange('B:B').setNumberFormat('@');
  eSheet.autoResizeColumns(1, 7);

  getAppraisalsSheet();
  getPeriodsSheet();
  seedDefaultPeriod();

  var sheet1 = ss.getSheetByName('Sheet1');
  if (sheet1 && sheet1.getLastRow() === 0) {
    ss.deleteSheet(sheet1);
  }

  // getUi() can fail in some run contexts; setup still succeeded
  try {
    SpreadsheetApp.getUi().alert('Setup complete. KPIs and Entries tabs created.\n\nAdd your KPIs in the app, then start logging work.');
  } catch (e) {
    Logger.log('Setup complete.');
  }
}