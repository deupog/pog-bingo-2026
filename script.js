/*
 * Deployment URLs are supplied by config.js, which is intentionally not
 * committed. GitHub Pages generates it from repository secrets.
 */
const CONFIG = {
  QUESTION_CSV_URL: window.POG_CONFIG?.QUESTION_CSV_URL || "",
  SUBMIT_URL: window.POG_CONFIG?.SUBMIT_URL || "",
  QUESTIONS_PER_CARD: 16,
};

const DEMO_QUESTIONS = [
  "What is a small thing that always makes your day better?",
  "What song do you know all the words to?",
  "What would your ideal weekend look like?",
  "What is the best advice you have ever received?",
  "What is a skill you would love to learn?",
  "What food could you eat every week?",
  "What is something people would be surprised to learn about you?",
  "What is your favorite way to spend a quiet evening?",
  "What place would you love to visit next?",
  "What is a book, film, or show you recommend to everyone?",
  "What is a childhood game you still enjoy?",
  "What is something you are proud of from this year?",
  "What is the most memorable compliment you have received?",
  "If you could have dinner with anyone, who would it be?",
  "What is one habit you would like to build?",
  "What is your favorite smell?",
  "What makes a house feel like home to you?",
  "What is a cause you care about?",
  "What is your most-used emoji?",
  "What is an underrated everyday pleasure?",
];

const state = { questions: [], answers: new Map(), activeIndex: null };
const $ = (selector) => document.querySelector(selector);

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function parseCsv(text) {
  const rows = [];
  let row = [], value = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i], next = text[i + 1];
    if (char === '"' && quoted && next === '"') { value += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(value.trim()); value = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value.trim()); if (row.some(Boolean)) rows.push(row);
      row = []; value = "";
    } else value += char;
  }
  if (value || row.length) { row.push(value.trim()); if (row.some(Boolean)) rows.push(row); }
  return rows;
}

async function loadQuestions() {
  if (!CONFIG.QUESTION_CSV_URL) {
    $("#sourceStatus").textContent = "Demo soru kaynak listesi";
    return DEMO_QUESTIONS;
  }
  const response = await fetch(CONFIG.QUESTION_CSV_URL);
  if (!response.ok) throw new Error("Soru kaynak listesi yüklenemedi.");
  const rows = parseCsv(await response.text());
  const header = rows.length ? rows[0].map((cell) => cell.toLowerCase()) : [];
  const questionHeaderIndex = header.findIndex((cell) => cell === "question");
  const questionColumn = Math.max(0, questionHeaderIndex < 0 ? 0 : questionHeaderIndex);
  const questions = rows.slice(1).map((row) => row[questionColumn]).filter(Boolean);
  if (questions.length < CONFIG.QUESTIONS_PER_CARD) throw new Error("Kaynak listede en az 16 soru lazım.");
  $("#sourceStatus").textContent = "Canlı soru kaynak listesi";
  return questions;
}

function renderBoard() {
  const board = $("#board");
  board.innerHTML = state.questions.map((question, index) => {
    const answer = state.answers.get(index);
    return `<button class="question-card ${answer ? "answered" : ""}" data-index="${index}" type="button" aria-label="${answer ? "Edit answer for " : "Answer "}question ${index + 1}">
      <span class="card-inner">
        <span class="card-face card-front"><span><span class="card-number">${String(index + 1).padStart(2, "0")}</span><span class="card-question">${escapeHtml(question)}</span></span><span class="card-cta">Tap to answer</span></span>
        <span class="card-face card-back"><span><span class="card-number">${String(index + 1).padStart(2, "0")} - ANSWERED</span><span class="answer-preview">${escapeHtml(answer || "")}</span></span><span class="card-cta">Tap to edit</span></span>
      </span>
    </button>`;
  }).join("");
  board.querySelectorAll(".question-card").forEach((card) => card.addEventListener("click", () => openAnswer(Number(card.dataset.index))));
  updateProgress();
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));
}

function updateProgress() {
  const count = state.answers.size;
  $("#answeredCount").textContent = count;
  $("#progressBar").style.width = `${(count / CONFIG.QUESTIONS_PER_CARD) * 100}%`;
  $("#submitButton").disabled = count !== CONFIG.QUESTIONS_PER_CARD;
  $("#submitButton").style.opacity = count === CONFIG.QUESTIONS_PER_CARD ? "1" : ".55";
}

function openAnswer(index) {
  state.activeIndex = index;
  const existing = state.answers.get(index);
  $("#modalPosition").textContent = `${index + 1} / ${CONFIG.QUESTIONS_PER_CARD}`;
  $("#modalQuestion").textContent = state.questions[index];
  $("#answerInput").value = existing || "";
  $("#answerInput").disabled = Boolean(existing);
  $("#answerHint").textContent = existing ? "This card is already answered. Edit or remove it below." : "You can edit this answer later.";
  $("#saveAnswer").textContent = existing ? "Edit answer" : "Save answer";
  $("#removeAnswer").classList.toggle("hidden", !existing);
  $("#answerModal").showModal();
}

function closeDialog(dialog) { dialog.close(); }

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message; toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 3000);
}

async function submitCard(username) {
  const payload = { username, answers: state.questions.map((question, index) => ({ question, answer: state.answers.get(index) })) };
  if (!CONFIG.SUBMIT_URL) return { ok: true, demo: true, username, answers: payload.answers };
  const response = await fetch(CONFIG.SUBMIT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Kart kaydedilemedi.");
  return result;
}

function showResult(result) {
  const duplicate = result.duplicate;
  $("#resultKicker").textContent = duplicate ? "Bu isim çoktan kullanıldı" : result.demo ? "Demo kardı kaydedildi" : "Kardınız kaydedildi";
  $("#resultTitle").textContent = duplicate ? `Tekrardan hoşgeldin, ${result.username}` : `Cevapların bize ulaştı, ${result.username}!`;
  $("#resultDescription").textContent = duplicate ? "Bu kullanıcı adı çoktan kullanıldı. İşte bu kullanıcı adıyla kaydedilmiş kart:" : "İşte sorular ve sizin cevaplarınız:";
  $("#resultList").innerHTML = result.answers.map((item, index) => `<div class="result-item"><strong>${index + 1}. ${escapeHtml(item.question)}</strong><span>${escapeHtml(item.answer || "Cevapsız")}</span></div>`).join("");
  $("#resultModal").showModal();
}

$("#answerForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if ($("#answerInput").disabled) {
    $("#answerInput").disabled = false;
    $("#answerInput").focus();
    $("#saveAnswer").textContent = "Cevabı kaydet";
    $("#answerHint").textContent = "Cevabı güncelle, sonra da kaydet.";
    return;
  }
  const answer = $("#answerInput").value.trim();
  if (!answer) return;
  state.answers.set(state.activeIndex, answer);
  closeDialog($("#answerModal")); renderBoard(); showToast("Cevap kaydedildi.");
});
$("#answerInput").addEventListener("input", () => { $("#saveAnswer").disabled = false; });
$("#answerForm").addEventListener("click", (event) => { if (event.target === $("#answerModal")) closeDialog($("#answerModal")); });
$("#backAnswer").addEventListener("click", () => closeDialog($("#answerModal")));
$("#closeAnswer").addEventListener("click", () => closeDialog($("#answerModal")));
$("#removeAnswer").addEventListener("click", () => {
  state.answers.delete(state.activeIndex); closeDialog($("#answerModal")); renderBoard(); showToast("Answer removed.");
});
$("#submitButton").addEventListener("click", () => {
  if (state.answers.size !== CONFIG.QUESTIONS_PER_CARD) return showToast("Answer every question before submitting.");
  $("#usernameInput").value = ""; $("#submitError").textContent = ""; $("#submitModal").showModal();
});
$("#cancelSubmit").addEventListener("click", () => closeDialog($("#submitModal")));
$("#closeSubmit").addEventListener("click", () => closeDialog($("#submitModal")));
$("#submitForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("#finishSubmit"); button.disabled = true; $("#submitError").textContent = "";
  try { showResult(await submitCard($("#usernameInput").value.trim())); closeDialog($("#submitModal")); }
  catch (error) { $("#submitError").textContent = error.message; }
  finally { button.disabled = false; }
});
$("#closeResult").addEventListener("click", () => closeDialog($("#resultModal")));

(async function init() {
  try {
    const pool = await loadQuestions();
    state.questions = shuffle(pool).slice(0, CONFIG.QUESTIONS_PER_CARD);
    $("#loadingState").classList.add("hidden"); renderBoard();
    $("#gameId").textContent = `KART ${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  } catch (error) {
    $("#loadingState").innerHTML = `<p class="form-error">${escapeHtml(error.message)}<br />Server hatası... Google Sheet URL'ini kontrol et ve tekrar dene.</p>`;
  }
})();
