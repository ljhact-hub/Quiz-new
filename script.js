let P3_QUESTIONS = [], P1_2_QUESTIONS = [];
let currentMode = 'P3';
let questionsForQuiz = [], currentQuestions = [], currentIndex = 0, correctCount = 0;
let INCORRECT_LOG = JSON.parse(localStorage.getItem('incorrectLog') || '[]');
let timerInterval;

const screens = {
    loading: document.getElementById('loading-screen'),
    main: document.getElementById('main-menu-screen'),
    num: document.getElementById('num-select-screen'),
    custom: document.getElementById('custom-num-screen'),
    quiz: document.getElementById('quiz-screen'),
    results: document.getElementById('results-screen'),
    list: document.getElementById('problem-list-screen'),
    stats: document.getElementById('stats-screen')
};

function showScreen(id) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[id].classList.add('active');
}

function getCurrentDB() {
    return currentMode === 'P3' ? P3_QUESTIONS : P1_2_QUESTIONS;
}

async function loadQuestions() {
    try {
        const res = await fetch('questions.json');
        const data = await res.json();
        P3_QUESTIONS = data.P3 || [];
        P1_2_QUESTIONS = data.P1_2 || [];
        showMainMenu();
    } catch (e) {
        document.getElementById('error-message').textContent = '문제 로드 실패';
    }
}

function showMainMenu() {
    showScreen('main');
    stopTimer();

    document.getElementById('mode-title').textContent = currentMode === 'P3' ? '3교시' : '1·2교시';
    document.getElementById('exam-card').style.display = currentMode === 'P3' ? 'block' : 'none';

    const reviewBtn = document.getElementById('review-btn');
    reviewBtn.innerHTML = `오답 노트 (${INCORRECT_LOG.length})`;
    reviewBtn.disabled = INCORRECT_LOG.length === 0;

    document.getElementById('switch-mode-btn').textContent = 
        currentMode === 'P3' ? '1·2교시로 전환' : '3교시로 전환';

    renderSubjectTags();

    document.getElementById('start-quiz-btn').onclick = handleQuizStart;
    document.getElementById('review-btn').onclick = startReviewQuiz;
    document.getElementById('problem-list-btn').onclick = showProblemList;
    document.getElementById('stats-btn').onclick = showStatsScreen;
    document.getElementById('switch-mode-btn').onclick = () => switchMode(currentMode === 'P3' ? 'P1_2' : 'P3');
    document.getElementById('exam-start-btn').onclick = handleExamStart;

    document.getElementById('select-all-btn').onclick = () => {
        document.querySelectorAll('#subject-tags input[type="checkbox"]').forEach(cb => {
            cb.checked = true;
            cb.parentElement.classList.add('selected');
        });
    };
    document.getElementById('deselect-all-btn').onclick = () => {
        document.querySelectorAll('#subject-tags input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
            cb.parentElement.classList.remove('selected');
        });
    };
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
        cb.onchange = () => cb.parentElement.classList.toggle('selected', cb.checked);
    });
}

function handleQuizStart() {
    const selected = Array.from(document.querySelectorAll('#subject-tags input[type="checkbox"]:checked'))
                          .map(cb => cb.value);
    if (selected.length === 0) return alert("과목을 선택하세요.");
    questionsForQuiz = getCurrentDB().filter(q => selected.includes(q.subject));
    showNumSelectScreen();
}

function showNumSelectScreen() {
    showScreen('num');
    document.getElementById('num-back-btn').onclick = showMainMenu;
}

function showCustomNumScreen() {
    showScreen('custom');
    const input = document.getElementById('custom-num-input');
    input.max = getCurrentDB().length;
    document.getElementById('custom-back-btn').onclick = showNumSelectScreen;
    document.getElementById('custom-start-btn').onclick = () => {
        const num = parseInt(input.value);
        if (num >= 1 && num <= getCurrentDB().length) startQuizWithNum(num);
        else alert(`1~${getCurrentDB().length} 사이 숫자 입력`);
    };
}

function startQuizWithNum(num) {
    currentQuestions = [...questionsForQuiz].sort(() => Math.random() - 0.5).slice(0, num);
    currentIndex = 0; correctCount = 0;
    showScreen('quiz');
    showQuestion();
}

function showQuestion() {
    const q = currentQuestions[currentIndex];
    const wrapper = document.getElementById('quiz-content-wrapper');
    let optionsHTML = q.type === 'multiple_choice' ? `
        <div class="options-container">
            ${q.options.map((opt, i) => `
                <label class="option-label">
                    <input type="radio" name="option" value="${i+1}">
                    <span>${opt}</span>
                </label>
            `).join('')}
        </div>
    ` : '';

    wrapper.innerHTML = `
        <div style="width:100%; padding:0 20px;">
            ${q.image_path ? `<img id="quiz-image" src="${q.image_path}">` : ''}
            <p id="question-text">${q.question}</p>
            ${optionsHTML}
            <button id="submit-answer-btn" class="btn" style="margin-top:20px;">정답 제출</button>
            <div id="feedback-label"></div>
        </div>
    `;

    document.getElementById('submit-answer-btn').onclick = () => {
        const selected = document.querySelector('input[name="option"]:checked');
        if (!selected) return alert("정답 선택!");
        checkAnswer(selected.value);
    };
}

function checkAnswer(answer) {
    const q = currentQuestions[currentIndex];
    const isCorrect = answer == q.answer;
    if (isCorrect) correctCount++;
    else INCORRECT_LOG.push({ ...q, userAnswer: answer });
    localStorage.setItem('incorrectLog', JSON.stringify(INCORRECT_LOG));

    const feedback = document.getElementById('feedback-label');
    feedback.textContent = isCorrect ? '정답입니다!' : `오답입니다. 정답: ${q.options[q.answer-1]}`;
    feedback.style.color = isCorrect ? 'green' : 'red';

    setTimeout(() => {
        currentIndex++;
        if (currentIndex < currentQuestions.length) showQuestion();
        else showResults();
    }, 1500);
}

function showResults() {
    const accuracy = (correctCount / currentQuestions.length * 100).toFixed(1);
    screens.results.innerHTML = `
        <div style="padding:20px; text-align:center;">
            <h2>퀴즈 완료!</h2>
            <p>정답률: ${accuracy}%</p>
            <button class="btn" onclick="showMainMenu()">메인으로</button>
        </div>
    `;
    showScreen('results');
}

function startTimer(seconds) {
    let time = seconds;
    const display = document.getElementById('timer-display');
    display.style.display = 'block';
    timerInterval = setInterval(() => {
        const m = Math.floor(time / 60).toString().padStart(2, '0');
        const s = (time % 60).toString().padStart(2, '0');
        display.textContent = `${m}:${s}`;
        if (--time < 0) { clearInterval(timerInterval); showResults(); }
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    document.getElementById('timer-display').style.display = 'none';
}

function handleExamStart() {
    questionsForQuiz = getCurrentDB();
    startQuizWithNum(65);
    startTimer(65 * 60);
}

function switchMode(mode) {
    currentMode = mode;
    loadQuestions();
}

loadQuestions();