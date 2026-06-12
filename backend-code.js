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
      case 'deleteAppraisal':  result = deleteAppraisal(p.id);    break;
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
  return {
    kpis: readTab('KPIs'),
    entries: readTab('Entries'),
    appraisals: readTab('Appraisals')
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
    entry.kpiId, Number(entry.hours) || 0, entry.evidence || ''
  ]);
  return { success: true, entry: entry };
}

function updateEntry(entry) {
  const sheet = ss.getSheetByName('Entries');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(entry.id)) {
      sheet.getRange(i + 1, 1, 1, 7).setValues([[
        entry.id, entry.date, entry.title, entry.description || '',
        entry.kpiId, Number(entry.hours) || 0, entry.evidence || ''
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
    kpi.metrics || '', kpi.reporting || ''
  ]);
  return { success: true, kpi: kpi };
}

function updateKpi(kpi) {
  const sheet = ss.getSheetByName('KPIs');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(kpi.id)) {
      sheet.getRange(i + 1, 1, 1, 7).setValues([[
        kpi.id, kpi.name, kpi.color,
        kpi.description || '', kpi.scope || '',
        kpi.metrics || '', kpi.reporting || ''
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
  var kSheet = ss.getSheetByName('KPIs');
  if (!kSheet) {
    kSheet = ss.insertSheet('KPIs');
  } else {
    kSheet.clear();
  }
  kSheet.appendRow(['id', 'name', 'color', 'description', 'scope', 'metrics', 'reporting']);
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
  eSheet.appendRow(['id', 'date', 'title', 'description', 'kpiId', 'hours', 'evidence']);
  eSheet.setFrozenRows(1);
  // Force id and date columns to plain text — prevents timezone-shifted date bugs
  eSheet.getRange('A:A').setNumberFormat('@');
  eSheet.getRange('B:B').setNumberFormat('@');
  eSheet.autoResizeColumns(1, 7);

  getAppraisalsSheet();

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
