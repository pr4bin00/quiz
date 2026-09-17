/**
 * Shared scoreboard for the cloud & compliance assessment.
 * Free, no server, no account beyond a Google login. Stores every response
 * in a spreadsheet you own and can open at any time.
 *
 * SETUP (about five minutes)
 *   1. Go to sheets.new to create a blank Google Sheet.
 *   2. Extensions  ->  Apps Script. Delete whatever is there and paste this file in.
 *   3. Click Save.
 *   4. Click Deploy  ->  New deployment.
 *        Type:            Web app
 *        Execute as:      Me
 *        Who has access:  Anyone            <-- this matters, "Anyone with Google account" will NOT work
 *   5. Authorise when prompted, then copy the Web app URL. It ends in /exec
 *   6. Open config.js and paste the URL into endpoint:
 *          endpoint: "https://script.google.com/macros/s/AKfycb.../exec",
 *      That is the ONLY file you edit. index.html and scores.html both read it.
 *   7. Upload index.html, scores.html and config.js to your host.
 *      Everyone now shares one scoreboard.
 *
 * THIS FILE DOES NOT GO ON YOUR WEB HOST. It runs inside Google Apps Script.
 * Uploading it to GitHub Pages does nothing. Full walkthrough in README.md.
 *
 * If you later change this script, you must Deploy -> Manage deployments -> Edit
 * -> New version, or the old code keeps running.
 */

var SHEET_NAME = 'scores';

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['id', 'name', 'total', 'answered', 'completed', 'updatedAt', 'answers']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** The quiz page calls this to read every score. */
function doGet() {
  var sh = sheet_();
  var values = sh.getDataRange().getValues().slice(1);
  var scores = values.filter(function (r) { return r[0]; }).map(function (r) {
    var answers = {};
    try { answers = JSON.parse(r[6] || '{}'); } catch (e) {}
    return {
      id: String(r[0]),
      name: String(r[1] || 'Anonymous'),
      total: Number(r[2]) || 0,
      answered: Number(r[3]) || 0,
      completed: r[4] === true || String(r[4]).toLowerCase() === 'true',
      updatedAt: String(r[5] || ''),
      answers: answers
    };
  });
  scores.sort(function (a, b) { return b.total - a.total; });
  return json_({ ok: true, scores: scores });
}

/** The quiz page calls this on every answer, and to remove an entry. */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var msg = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var sh = sheet_();
    var values = sh.getDataRange().getValues().slice(1);

    var found = -1;
    for (var i = 0; i < values.length; i++) {
      if (String(values[i][0]) === String(msg.id)) { found = i; break; }
    }

    if (msg.action === 'delete') {
      if (found >= 0) sh.deleteRow(found + 2);
      return json_({ ok: true });
    }

    var r = msg.record || {};
    var row = [
      String(msg.id),
      String(r.name || 'Anonymous'),
      Number(r.total) || 0,
      Number(r.answered) || 0,
      !!r.completed,
      String(r.updatedAt || new Date().toISOString()),
      JSON.stringify(r.answers || {})
    ];

    if (found >= 0) sh.getRange(found + 2, 1, 1, row.length).setValues([row]);
    else sh.appendRow(row);

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
