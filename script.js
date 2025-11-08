// 기존 원본 로직 복구 + 디자인 업그레이드
let QUESTIONS_DB_P3 = [], QUESTIONS_DB_P1_2 = [];
let currentMode = 'P3';
let questionsForQuiz = [], currentQuestions = [], currentIndex = 0;
let score = 0, newIncorrect = [], isReviewMode = false, isExamMode = false;
let examTimer = null, timeRemaining = 0;
let QUIZ_STATS = {}, EXAM_HISTORY = [], INCORRECT_LOG = [];
let currentQuizResults = [];

const INCORRECT_LOG_KEY = () => `clinicalPathologyQuizLog_${currentMode}`;
const STATS_KEY = () => `clinicalPathologyQuizStats_${currentMode}`;
const EXAM_HISTORY_KEY = () => `clinicalPathologyExamHistory_${currentMode}`;

const appContainer = document.getElementById('app-container');
const loadingScreen = document.getElementById('loading-screen');
const errorMessage = document.getElementById('error-message');
const mainMenuScreen = document.getElementById('main-menu-screen');
const numSelectScreen = document.getElementById('num-select-screen');
const customNumScreen = document.getElementById('custom-num-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultsScreen = document.getElementById('results-screen');
const problemListScreen = document.getElementById('problem-list-screen');
const statsScreen = document.getElementById('stats-screen');

window.addEventListener('DOMContentLoaded', loadApp);

async function loadApp() {
    try {
        const [p3Response, p1_2Response] = await Promise.all([
            fetch('questions.json').catch(() => ({ok: false})),
            fetch('questions_1-2.json').catch(() => ({ok: false}))
        ]);

        if (p3Response.ok) QUESTIONS_DB_P3 = await p3Response.json();
        if (p1_2Response.ok) QUESTIONS_DB_P1_2 = await p1_2Response.json();

        if (QUESTIONS_DB_P3.length === 0 && QUESTIONS_DB_P1_2.length === 0) {
            throw new Error("문제 파일을 찾을 수 없습니다. questions.json 파일을 추가하세요.");
        }

        loadDataForCurrentMode();
        showScreen('main-menu-screen');
        showMainMenu();
    } catch (error) {
        console.error(error);
        errorMessage.textContent = error.message;
        showScreen('loading-screen');
    }
}

function getCurrentDB() {
    return currentMode === 'P3' ? QUESTIONS_DB_P3 : QUESTIONS_DB_P1_2;
}

function loadDataForCurrentMode() {
    INCORRECT_LOG = JSON.parse(localStorage.getItem(INCORRECT_LOG_KEY()) || '[]');
    QUIZ_STATS = JSON.parse(localStorage.getItem(STATS_KEY()) || '{}');
    EXAM_HISTORY = JSON.parse(localStorage.getItem(EXAM_HISTORY_KEY()) || '[]');
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    document.body.className = '';
}

function switchMode(newMode) {
    if (newMode === currentMode) return;
    if (newMode === 'P1_2' && QUESTIONS_DB_P1_2.length === 0) {
        alert("1,2교시 문제 파일을 불러오지 못했습니다.");
        return;
    }
    currentMode = newMode;
    loadDataForCurrentMode();
    showMainMenu();
}

function showMainMenu() {
    showScreen('main-menu-screen');
    stopTimer();

    document.getElementById('mode-title').textContent = currentMode === 'P3' ? '3교시' : '1·2교시';
    document.getElementById('exam-card').style.display = currentMode === 'P3' ? 'block' : 'none';

    const reviewBtn = document.getElementById('review-btn');
    reviewBtn.innerHTML = `오답 노트 풀기 (${INCORRECT_LOG.length}개)`;
    reviewBtn.disabled = INCORRECT_LOG.length === 0;

    const switchBtn = document.getElementById('switch-mode-btn');
    switchBtn.innerHTML = currentMode === 'P3' ? '1·2교시로 전환' : '3교시로 전환';

    renderSubjectTags();

    document.getElementById('start-quiz-btn').addEventListener('click', handleQuizStart);
    document.getElementById('review-btn').addEventListener('click', startReviewQuiz);
    document.getElementById('problem-list-btn').addEventListener('click', showProblemList);
    document.getElementById('stats-btn').addEventListener('click', showStatsScreen);
    document.getElementById('switch-mode-btn').addEventListener('click', () => switchMode(currentMode === 'P3' ? 'P1_2' : 'P3'));

    const examBtn = document.getElementById('exam-start-btn');
    if (examBtn) examBtn.addEventListener('click', handleExamStart);

    document.getElementById('select-all-btn').addEventListener('click', () => {
        document.querySelectorAll('#subject-tags input[type="checkbox"]').forEach(cb => {
            cb.checked = true;
            cb.parentElement.classList.add('selected');
        });
    });
    document.getElementById('deselect-all-btn').addEventListener('click', () => {
        document.querySelectorAll('#subject-tags input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
            cb.parentElement.classList.remove('selected');
        });
    });
}

function renderSubjectTags() {
    const container = document.getElementById('subject-tags');
    const subjects = [...new Set(getCurrentDB().map(q => q.subject || "기타"))].sort();
    container.innerHTML = subjects.map(s => `
        <label class="subject-tag">
            <input type="checkbox" value="${s}">
            <span>${s}</span>
        </label>
    `).join('');
    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', () => cb.parentElement.classList.toggle('selected', cb.checked));
    });
}

function handleQuizStart() {
    const selectedSubjects = Array.from(document.querySelectorAll('#subject-tags input[type="checkbox"]:checked')).map(cb => cb.value);
    if (selectedSubjects.length === 0) {
        alert("하나 이상의 과목을 선택해주세요.");
        return;
    }
    questionsForQuiz = getCurrentDB().filter(q => selectedSubjects.includes(q.subject));
    document.getElementById('total-questions').textContent = questionsForQuiz.length;
    showNumSelectScreen();
}

function showNumSelectScreen() {
    showScreen('num-select-screen');
    document.getElementById('num-back-to-main-btn').addEventListener('click', showMainMenu);
}

function showCustomNumScreen() {
    showScreen('custom-num-screen');
    const maxNum = questionsForQuiz.length;
    document.getElementById('max-custom-num').textContent = maxNum;
    document.getElementById('custom-num-input').max = maxNum;
    document.getElementById('custom-back-btn').addEventListener('click', showNumSelectScreen);
    document.getElementById('custom-ok-btn').addEventListener('click', customNumberEntered);
}

function customNumberEntered() {
    const num = parseInt(document.getElementById('custom-num-input').value);
    if (num > 0 && num <= questionsForQuiz.length) {
        prepareAndRunQuiz(num);
    } else {
        alert("1 이상의 숫자를 입력해주세요.");
    }
}

function prepareAndRunQuiz(num) {
    currentQuestions = [...questionsForQuiz].sort(() => 0.5 - Math.random()).slice(0, num);
    currentIndex = 0;
    score = 0;
    newIncorrect = [];
    isReviewMode = false;
    isExamMode = false;
    showScreen('quiz-screen');
    showQuestion();
}

function showQuestion() {
    const q = currentQuestions[currentIndex];
    const wrapper = document.getElementById('quiz-content-wrapper');
    let optionsHTML = q.options.map((opt, i) => `
        <label class="option-label">
            <input type="radio" name="option" value="${i+1}">
            <span>${opt}</span>
        </label>
    `).join('');

    wrapper.innerHTML = `
        <div style="padding:20px; text-align:center;">
            ${q.image_path ? `<img id="quiz-image" src="${q.image_path}" alt="문제 이미지">` : ''}
            <p id="question-text" style="font-size:18px; margin:16px 0;">${q.question}</p>
            <div class="options-container">${optionsHTML}</div>
            <button class="btn" id="submit-answer-btn" style="max-width:300px;">정답 제출</button>
            <div id="feedback-label" style="font-size:18px; margin-top:16px; min-height:50px;"></div>
        </div>
    `;

    document.getElementById('submit-answer-btn').addEventListener('click', () => {
        const selected = document.querySelector('input[name="option"]:checked');
        if (!selected) {
            alert("정답을 선택해주세요!");
            return;
        }
        checkAnswer(selected.value, q);
    });
}

function checkAnswer(selected, q) {
    const isCorrect = selected === q.answer;
    if (isCorrect) score++;
    else newIncorrect.push(q.id);

    const feedback = document.getElementById('feedback-label');
    feedback.innerHTML = isCorrect ? '<span style="color:green;">정답입니다!</span>' : `<span style="color:red;">오답입니다. 정답: ${q.options[q.answer - 1]}</span><br><small>${q.explanation}</small>`;
    document.body.className = isCorrect ? 'correct-feedback' : 'incorrect-feedback';

    setTimeout(() => {
        currentIndex++;
        if (currentIndex < currentQuestions.length) showQuestion();
        else finishQuiz();
    }, 2000);
}

function finishQuiz() {
    const accuracy = (score / currentQuestions.length * 100).toFixed(1);
    resultsScreen.innerHTML = `
        <div style="padding:20px; text-align:center;">
            <h2>퀴즈 결과</h2>
            <div class="donut-chart-container">
                <div class="donut-chart" style="--accuracy: ${accuracy}%"></div>
                <div class="donut-chart-center">${accuracy}%</div>
            </div>
            <p>총 문제: ${currentQuestions.length}개 | 맞힌 개수: ${score}개</p>
            <button class="btn" onclick="reviewMistakes(newIncorrect)">틀린 문제 복습 (${newIncorrect.length}개)</button>
            <button class="btn btn-secondary" onclick="showMainMenu()">메인으로</button>
        </div>
    `;
    showScreen('results-screen');

    // 통계 업데이트
    currentQuestions.forEach(q => {
        if (!QUIZ_STATS[q.subject]) QUIZ_STATS[q.subject] = {correct: 0, total: 0};
        QUIZ_STATS[q.subject].total++;
        if (newIncorrect.includes(q.id)) {} else QUIZ_STATS[q.subject].correct++;
    });
    localStorage.setItem(STATS_KEY(), JSON.stringify(QUIZ_STATS));

    if (!isReviewMode) {
        INCORRECT_LOG = [...new Set([...INCORRECT_LOG, ...newIncorrect])].sort((a,b) => a - b);
        localStorage.setItem(INCORRECT_LOG_KEY(), JSON.stringify(INCORRECT_LOG));
    }
}

function reviewMistakes(incorrectIds) {
    if (incorrectIds.length === 0) {
        alert("복습할 문제가 없습니다.");
        showMainMenu();
        return;
    }
    currentQuestions = getCurrentDB().filter(q => incorrectIds.includes(q.id));
    isReviewMode = true;
    prepareAndRunQuiz(currentQuestions.length);
}

function startReviewQuiz() {
    if (INCORRECT_LOG.length === 0) {
        alert("오답 노트에 문제가 없습니다.");
        return;
    }
    currentQuestions = getCurrentDB().filter(q => INCORRECT_LOG.includes(q.id));
    isReviewMode = true;
    prepareAndRunQuiz(currentQuestions.length);
}

function showProblemList() {
    showScreen('problem-list-screen');
    const list = document.getElementById('problem-list');
    list.innerHTML = getCurrentDB().map(q => `<li onclick="startSingleProblem(${q.id})">ID ${q.id} (${q.subject}): ${q.question.substring(0,50)}...</li>`).join('');
    document.getElementById('list-back-to-main-btn').addEventListener('click', showMainMenu);
}

function startSingleProblem(id) {
    currentQuestions = [getCurrentDB().find(q => q.id === id)];
    isSingleProblemMode = true;
    prepareAndRunQuiz(1);
}

function showStatsScreen() {
    showScreen('stats-screen');
    const statsContent = document.getElementById('stats-content');
    let totalCorrect = 0, total = 0;
    const subjectStats = Object.entries(QUIZ_STATS).map(([s, st]) => {
        totalCorrect += st.correct;
        total += st.total;
        return {name: s, accuracy: st.total ? (st.correct / st.total * 100) : 0};
    }).sort((a,b) => b.accuracy - a.accuracy);

    const overall = total ? (totalCorrect / total * 100).toFixed(1) : 0;
    statsContent.innerHTML = `
        <div class="card">
            <h3>전체 정답률: ${overall}%</h3>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                ${subjectStats.map(s => `<div style="text-align:center;"><p>${s.name}</p><p style="font-size:24px; font-weight:bold;">${s.accuracy.toFixed(1)}%</p></div>`).join('')}
            </div>
        </div>
        <button class="btn btn-secondary" onclick="showMainMenu()">메인으로</button>
    `;
    document.getElementById('stats-back-to-main-btn').addEventListener('click', showMainMenu);
}

function handleExamStart() {
    if (currentMode === 'P1_2') {
        alert("1,2교시에서는 시험 모드를 지원하지 않습니다.");
        return;
    }
    const examQuestions = generateExamQuestions();
    if (examQuestions.length > 0) {
        timeRemaining = 65 * 60;
        isExamMode = true;
        prepareAndRunQuiz(65);
        startTimer();
    }
}

function generateExamQuestions() {
    const blueprint = [
        {subject: "조직학", count: 9}, {subject: "세포학", count: 7}, {subject: "임상화학", count: 14},
        {subject: "핵의학", count: 2}, {subject: "혈액학", count: 11}, {subject: "수혈학", count: 5},
        {subject: "요화학", count: 1}, {subject: "미생물학", count: 6}, {subject: "진균학", count: 2},
        {subject: "바이러스학", count: 2}, {subject: "기생충학", count: 2}, {subject: "혈청학", count: 4}
    ];
    let examQuestions = [];
    const pools = {};
    getCurrentDB().forEach(q => {
        const s = q.subject || "기타";
        if (!pools[s]) pools[s] = [];
        pools[s].push(q);
    });
    for (const item of blueprint) {
        const pool = pools[item.subject] || [];
        if (pool.length < item.count) {
            alert(`${item.subject} 과목 문제가 부족합니다.`);
            return [];
        }
        const shuffled = [...pool].sort(() => 0.5 - Math.random());
        examQuestions = examQuestions.concat(shuffled.slice(0, item.count));
    }
    return examQuestions;
}

function startTimer() {
    const display = document.getElementById('timer-display');
    display.style.display = 'block';
    examTimer = setInterval(() => {
        timeRemaining--;
        const m = Math.floor(timeRemaining / 60).toString().padStart(2,'0');
        const s = (timeRemaining % 60).toString().padStart(2,'0');
        display.textContent = `${m}:${s}`;
        if (timeRemaining <= 0) {
            clearInterval(examTimer);
            alert("시간 종료!");
            finishQuiz();
        }
    }, 1000);
}

function stopTimer() {
    if (examTimer) clearInterval(examTimer);
    document.getElementById('timer-display').style.display = 'none';
}