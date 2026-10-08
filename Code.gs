const QUESTIONS_SHEET = "Questions";
const ANSWERS_SHEET = "Answers";

function doPost(event) {
  try {
    const request = JSON.parse(event.postData.contents);
    const username = String(request.username || "").trim();
    const answers = Array.isArray(request.answers) ? request.answers : [];
    if (!username || answers.length !== 16) {
      return json({ error: "A username and all 16 answers are required." }, 400);
    }

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const answerSheet = spreadsheet.getSheetByName(ANSWERS_SHEET) || spreadsheet.insertSheet(ANSWERS_SHEET);
    const values = answerSheet.getDataRange().getValues();
    const header = ["timestamp", "username"];
    for (let i = 0; i < 16; i += 1) header.push(`question_${i + 1}`, `answer_${i + 1}`);
    if (answerSheet.getLastRow() === 0) answerSheet.appendRow(header);

    const usernameIndex = 1;
    const previousRow = values.slice(1).find((row) => String(row[usernameIndex]).toLowerCase() === username.toLowerCase());
    if (previousRow) {
      const previousAnswers = [];
      for (let i = 0; i < 16; i += 1) {
        previousAnswers.push({ question: previousRow[2 + i * 2], answer: previousRow[3 + i * 2] });
      }
      return json({ ok: false, duplicate: true, username: previousRow[usernameIndex], answers: previousAnswers });
    }

    const row = [new Date(), username];
    answers.forEach((item) => row.push(String(item.question || ""), String(item.answer || "")));
    answerSheet.appendRow(row);
    return json({ ok: true, username, answers });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}

function json(payload, status) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
