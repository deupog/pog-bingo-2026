const QUESTIONS_SHEET = "Questions";
const ANSWERS_SHEET = "Answers";
const ANSWER_COUNT = 16;
const ANSWER_COLUMN_COUNT = 2 + ANSWER_COUNT * 2;
const USER_PROPERTY_PREFIX = "bingo_user_";
const QUEUE_PROPERTY_PREFIX = "bingo_queue_";

function doPost(event) {
  try {
    const request = JSON.parse(event.postData.contents);
    const username = String(request.username || "").trim();
    const answers = Array.isArray(request.answers) ? request.answers : [];
    if (!username || answers.length !== ANSWER_COUNT) {
      return json({ error: `Bir kullanıcı adı ve cevaplar gereklidir.` }, 400);
    }

    const normalizedUsername = username.toLowerCase();
    const userProperty = USER_PROPERTY_PREFIX + hash(normalizedUsername);
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const properties = PropertiesService.getScriptProperties();
      const existing = properties.getProperty(userProperty);
      if (existing) {
        const saved = JSON.parse(existing);
        return json({
          ok: false,
          duplicate: true,
          username: saved.username,
          answers: saved.answers,
        });
      }

      const savedRequest = {
        username,
        answers: normalizeAnswers(answers),
      };
      const queueProperty = QUEUE_PROPERTY_PREFIX + Utilities.getUuid();
      properties.setProperties({
        [userProperty]: JSON.stringify(savedRequest),
        [queueProperty]: JSON.stringify(savedRequest),
      });
      return json({ ok: true, username, answers: savedRequest.answers });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}

function processQueue() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const properties = PropertiesService.getScriptProperties();
    const allProperties = properties.getProperties();
    const queueEntries = Object.keys(allProperties)
      .filter((key) => key.indexOf(QUEUE_PROPERTY_PREFIX) === 0)
      .map((key) => ({ key, request: JSON.parse(allProperties[key]) }));

    // Keep a single request queued so the sheet is only touched for a batch.
    if (queueEntries.length < 1) return;

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const answerSheet = spreadsheet.getSheetByName(ANSWERS_SHEET)
      || spreadsheet.insertSheet(ANSWERS_SHEET);
    const rows = queueEntries.map((entry) => buildAnswerRow(entry.request));
    const lastRow = answerSheet.getLastRow();

    if (lastRow === 0) {
      answerSheet.getRange(1, 1, rows.length + 1, ANSWER_COLUMN_COUNT)
        .setValues([answerHeader()].concat(rows));
    } else {
      answerSheet.getRange(lastRow + 1, 1, rows.length, ANSWER_COLUMN_COUNT).setValues(rows);
    }

    queueEntries.forEach((entry) => properties.deleteProperty(entry.key));
  } finally {
    lock.releaseLock();
  }
}

function installQueueTrigger() {
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === "processQueue") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger("processQueue").timeBased().everyMinutes(5).create();
}

function initializeUsernameIndex() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const answerSheet = spreadsheet.getSheetByName(ANSWERS_SHEET);
  if (!answerSheet || answerSheet.getLastRow() < 2) return;

  const rows = answerSheet
    .getRange(2, 1, answerSheet.getLastRow() - 1, ANSWER_COLUMN_COUNT)
    .getValues();
  const userProperties = {};
  rows.forEach((row) => {
    const username = String(row[1] || "").trim();
    if (!username) return;
    const answers = [];
    for (let i = 0; i < ANSWER_COUNT; i += 1) {
      answers.push({
        question: row[2 + i * 2],
        answer: row[3 + i * 2],
      });
    }
    userProperties[USER_PROPERTY_PREFIX + hash(username.toLowerCase())] = JSON.stringify({
      username,
      answers,
    });
  });
  PropertiesService.getScriptProperties().setProperties(userProperties);
}

function answerHeader() {
  const header = ["timestamp", "username"];
  for (let i = 0; i < ANSWER_COUNT; i += 1) {
    header.push(`question_${i + 1}`, `answer_${i + 1}`);
  }
  return header;
}

function buildAnswerRow(request) {
  const row = [new Date(), request.username];
  request.answers.forEach((item) => row.push(item.question, item.answer));
  return row;
}

function normalizeAnswers(answers) {
  return answers.map((item) => ({
    question: String((item && item.question) || ""),
    answer: String((item && item.answer) || ""),
  }));
}

function hash(value) {
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    value,
    Utilities.Charset.UTF_8,
  ).map((byte) => (byte + 256).toString(16).slice(-2)).join("");
}

function json(payload, status) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
