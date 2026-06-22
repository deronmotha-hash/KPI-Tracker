// ═══════════════════════════════════════════════════════════════
// KPI Tracker — MANAGER Backend (Google Apps Script)
// ═══════════════════════════════════════════════════════════════
//
// This backend stores the manager's employee register and the
// manager's own notes/scores. It does NOT store employee KPI data —
// that stays in each employee's own sheet and is read directly
// (read-only) by the manager app via their deployment URLs.
//
// SETUP:
// 1. Create a new Google Sheet (this is YOUR manager sheet)
// 2. Extensions → Apps Script
// 3. Delete default contents, paste this entire file
// 4. Function dropdown → select "setupSheet" → Run → authorise
// 5. Deploy → New deployment → Web app
//    - Execute as: Me
//    - Who has access: Anyone
// 6. Copy the deployment URL → paste into the manager app settings
//
// REDEPLOYING after edits:
//    Deploy → Manage deployments → ✏ edit → New version → Deploy
//    (this keeps the same URL)
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
      case 'addEmployee':    result = addEmployee(p.data);    break;
      case 'updateEmployee': result = updateEmployee(p.data); break;
      case 'deleteEmployee': result = deleteEmployee(p.id);   break;
      case 'saveReview':     result = saveReview(p.data);     break;
      case 'deleteReview':   result = deleteReview(p.id);     break;
      default:               result = { error: 'Unknown action: ' + p.action };
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
    employees: readTab('Employees'),
    reviews: readTab('Reviews')
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
      if (v instanceof Date) {
        v = Utilities.formatDate(v, tz, 'yyyy-MM-dd');
      }
      obj[h] = v;
    });
    if (obj.score !== undefined && obj.score !== '') obj.score = Number(obj.score);
    if (obj.id !== undefined) obj.id = String(obj.id);
    return obj;
  });
}

// ── Employees ────────────────────────────────────────────────
// Columns: id | name | title | apiUrl | added

function addEmployee(emp) {
  const sheet = ss.getSheetByName('Employees');
  if (!emp.id) emp.id = 'emp-' + Date.now().toString();
  sheet.appendRow([
    emp.id,
    emp.name,
    emp.title || '',
    emp.apiUrl,
    new Date().toISOString().split('T')[0]
  ]);
  return { success: true, employee: emp };
}

function updateEmployee(emp) {
  const sheet = ss.getSheetByName('Employees');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(emp.id)) {
      sheet.getRange(i + 1, 1, 1, 4).setValues([[
        emp.id, emp.name, emp.title || '', emp.apiUrl
      ]]);
      return { success: true };
    }
  }
  return { error: 'Employee not found: ' + emp.id };
}

function deleteEmployee(id) {
  const sheet = ss.getSheetByName('Employees');
  const data = sheet.getDataRange().getValues();
  let found = false;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      found = true;
      break;
    }
  }
  if (!found) return { error: 'Employee not found: ' + id };

  // Cascade: remove this employee's reviews
  const rSheet = ss.getSheetByName('Reviews');
  const rData = rSheet.getDataRange().getValues();
  for (let i = rData.length - 1; i >= 1; i--) {
    if (String(rData[i][1]) === String(id)) {
      rSheet.deleteRow(i + 1);
    }
  }
  return { success: true };
}

// ── Reviews (manager notes + score per employee per KPI) ────
// Columns: id | employeeId | kpiId | score | notes | updated
// Upsert: one review per employee+kpi combination

function saveReview(rev) {
  const sheet = ss.getSheetByName('Reviews');
  const data = sheet.getDataRange().getValues();
  const updated = new Date().toISOString().split('T')[0];
  const pid = rev.periodId || '';

  // Match on employee + kpi + period so each period keeps its own review
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(rev.employeeId) && String(data[i][2]) === String(rev.kpiId) && String(data[i][6] || '') === String(pid)) {
      sheet.getRange(i + 1, 1, 1, 7).setValues([[
        data[i][0], rev.employeeId, rev.kpiId,
        rev.score === '' || rev.score === null || rev.score === undefined ? '' : Number(rev.score),
        rev.notes || '', updated, pid
      ]]);
      return { success: true, id: String(data[i][0]) };
    }
  }

  const id = 'rev-' + Date.now().toString();
  sheet.appendRow([
    id, rev.employeeId, rev.kpiId,
    rev.score === '' || rev.score === null || rev.score === undefined ? '' : Number(rev.score),
    rev.notes || '', updated, pid
  ]);
  return { success: true, id: id };
}

function deleteReview(id) {
  const sheet = ss.getSheetByName('Reviews');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: 'Review not found: ' + id };
}

// ── Setup (run once) ─────────────────────────────────────────

function setupSheet() {
  // Safety guard: never wipe a sheet that already holds data.
  function hasData(name) {
    const s = ss.getSheetByName(name);
    return s && s.getLastRow() > 1;
  }
  if (hasData('Employees') || hasData('Reviews')) {
    try {
      SpreadsheetApp.getUi().alert('Setup blocked: this sheet already contains data.\n\nRunning setup would erase it. To update the code instead, use Deploy \u2192 Manage deployments \u2192 edit \u2192 New version. No setup needed.');
    } catch (e) {
      throw new Error('Setup blocked: sheet already contains data. Use Manage deployments \u2192 New version to update code without wiping data.');
    }
    return;
  }

  var eSheet = ss.getSheetByName('Employees');
  if (!eSheet) {
    eSheet = ss.insertSheet('Employees');
  } else {
    eSheet.clear();
  }
  eSheet.appendRow(['id', 'name', 'title', 'apiUrl', 'added']);
  eSheet.getRange('A:A').setNumberFormat('@');
  eSheet.getRange('E:E').setNumberFormat('@');
  eSheet.setFrozenRows(1);
  eSheet.autoResizeColumns(1, 5);

  var rSheet = ss.getSheetByName('Reviews');
  if (!rSheet) {
    rSheet = ss.insertSheet('Reviews');
  } else {
    rSheet.clear();
  }
  rSheet.appendRow(['id', 'employeeId', 'kpiId', 'score', 'notes', 'updated', 'periodId']);
  rSheet.getRange('A:C').setNumberFormat('@');
  rSheet.getRange('F:G').setNumberFormat('@');
  rSheet.setFrozenRows(1);
  rSheet.autoResizeColumns(1, 6);

  var sheet1 = ss.getSheetByName('Sheet1');
  if (sheet1 && sheet1.getLastRow() === 0) {
    ss.deleteSheet(sheet1);
  }

  try {
    SpreadsheetApp.getUi().alert('Manager backend setup complete.\n\nEmployees and Reviews tabs created.\nNext: Deploy → New deployment → Web app.');
  } catch (e) {
    Logger.log('Setup complete.');
  }
}
