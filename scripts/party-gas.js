/**
 * Google Apps Script — 파티 일정 조율 API
 *
 * 사용법:
 * 1. Google Sheets에서 [확장 프로그램] → [Apps Script] 열기
 * 2. 이 코드를 붙여넣기
 * 3. 시트에 "Schedule" 이름의 시트 생성 (헤더: 이름 | 날짜 | 등록시간)
 * 4. [배포] → [새 배포] → 유형: 웹 앱
 *    - 실행 계정: 본인
 *    - 액세스 권한: 모든 사용자
 * 5. 배포 URL을 src/js/config.js의 PARTY_API_URL에 입력
 */

function doGet(e) {
  var action = e.parameter.action;

  if (action === 'list') {
    return listSchedule(e.parameter.start, e.parameter.end);
  }

  return jsonResponse({ error: 'unknown action' });
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);

  if (data.action === 'register') {
    return registerDates(data);
  }

  return jsonResponse({ error: 'unknown action' });
}

/**
 * 기간 내 등록 목록 조회
 */
function listSchedule(startDate, endDate) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Schedule');
  if (!sheet) return jsonResponse({ entries: [] });

  var rows = sheet.getDataRange().getValues();
  var entries = [];

  for (var i = 1; i < rows.length; i++) {
    var name = rows[i][0];
    var date = toDateString(rows[i][1]);

    if (startDate && date < startDate) continue;
    if (endDate && date > endDate) continue;

    entries.push({ name: name, date: date });
  }

  return jsonResponse({ entries: entries });
}

/**
 * 일정 등록
 * - rangeStart~rangeEnd 범위 내 해당 이름의 기존 등록을 모두 삭제
 * - dates 배열의 날짜들을 새로 추가
 * - dates가 빈 배열이면 해당 범위 내 본인 등록만 삭제 (일정 취소)
 */
function registerDates(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Schedule');
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('Schedule');
    sheet.appendRow(['이름', '날짜', '등록시간']);
  }

  var name = (data.name || '').trim();
  var dates = data.dates || [];
  var rangeStart = data.rangeStart || '';
  var rangeEnd = data.rangeEnd || '';
  var now = new Date().toISOString();

  if (!name) {
    return jsonResponse({ success: false, error: '이름을 입력해주세요' });
  }

  // 범위 내 해당 이름의 기존 등록을 모두 삭제
  var rows = sheet.getDataRange().getValues();
  var rowsToDelete = [];
  for (var i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][0]).trim() === name) {
      var existingDate = toDateString(rows[i][1]);
      if (rangeStart && existingDate < rangeStart) continue;
      if (rangeEnd && existingDate > rangeEnd) continue;
      rowsToDelete.push(i + 1);
    }
  }
  for (var j = 0; j < rowsToDelete.length; j++) {
    sheet.deleteRow(rowsToDelete[j]);
  }

  // 새 등록 추가
  for (var k = 0; k < dates.length; k++) {
    sheet.appendRow([name, dates[k], now]);
  }

  return jsonResponse({ success: true, count: dates.length });
}

/**
 * 날짜 값을 YYYY-MM-DD 문자열로 변환
 */
function toDateString(val) {
  if (val && typeof val.getFullYear === 'function') {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var s = String(val);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  var d = new Date(s);
  if (!isNaN(d.getTime())) {
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return s;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
