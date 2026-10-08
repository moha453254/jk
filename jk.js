/* Global Application State */
const state = {
  stage: 1, // 1: Whole JD, 2: JD+Fils, 3: Awkward Cash, 4: Multi-Item
  inputMode: 'numpad', // 'numpad' or 'drawer'
  audioEnabled: true,
  timedRush: false,
  
  currentProblem: {
    items: [],
    totalPrice: 0,
    paidCash: 0,
    correctChange: 0,
    customerBills: []
  },

  userInput: "0.00",
  drawerTotal: 0,
  
  // Timers & Performance Tracking
  startTime: 0,
  timerInterval: null,
  rushCountdown: 10,
  rushInterval: null,
  
  stats: {
    totalAttempts: 0,
    correctAttempts: 0,
    streak: 0,
    bestSpeed: Infinity,
    bestSpeedRank: "No Badge",
    totalCashHandled: 0,
    speedTimes: []
  }
};

/* Available Currency Notes & Coins */
const JOD_DENOMINATIONS = [50, 20, 10, 5, 1, 0.50, 0.25, 0.10, 0.05, 0.025, 0.010, 0.005];

/* Audio Sound Effects using Web Audio API */
let audioCtx = null;
function playBeep(type) {
  if (!state.audioEnabled) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'click') {
      osc.frequency.setValueAtTime(600, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.05);
    } else if (type === 'success') {
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.16); // G5
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'error') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, audioCtx.currentTime);
      osc.frequency.setValueAtTime(180, audioCtx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    }
  } catch(e) {
    console.log("Audio play error:", e);
  }
}

function toggleAudio() {
  state.audioEnabled = !state.audioEnabled;
  const btn = document.getElementById('audio-toggle-btn');
  const icon = document.getElementById('audio-icon');
  if (state.audioEnabled) {
    btn.classList.remove('opacity-60');
    icon.textContent = '🔊';
    btn.childNodes[2].textContent = ' Sound ON';
  } else {
    btn.classList.add('opacity-60');
    icon.textContent = '🔇';
    btn.childNodes[2].textContent = ' Sound OFF';
  }
}

/* Evaluate Response Time Function */
function evaluateResponseTime(elapsedSeconds, stage, inputMode) {
  const stageBaseMap = {
    1: { lightning: 2.5, fast: 4.5, good: 7.0 },  // Whole JOD
    2: { lightning: 3.5, fast: 6.0, good: 9.0 },  // JOD + Fils
    3: { lightning: 4.5, fast: 7.5, good: 11.0 }, // Awkward Cash
    4: { lightning: 5.5, fast: 9.0, good: 13.0 }  // Multi-Item POS
  };

  const thresholds = stageBaseMap[stage] || stageBaseMap[1];
  const bonusWindow = (inputMode === 'drawer') ? 3.0 : 0.0;

  const lightningLimit = thresholds.lightning + bonusWindow;
  const fastLimit = thresholds.fast + bonusWindow;
  const goodLimit = thresholds.good + bonusWindow;

  if (elapsedSeconds <= lightningLimit) {
    return {
      rank: "LIGHTNING",
      badge: "⚡ LIGHTNING",
      color: "text-amber-500 bg-amber-100 border-amber-300",
      desc: "Very fast mental calculation."
    };
  } else if (elapsedSeconds <= fastLimit) {
    return {
      rank: "FAST",
      badge: "🚀 FAST",
      color: "text-emerald-600 bg-emerald-100 border-emerald-300",
      desc: "Solid speed for high-volume checkout."
    };
  } else if (elapsedSeconds <= goodLimit) {
    return {
      rank: "GOOD",
      badge: "👍 GOOD",
      color: "text-sky-600 bg-sky-100 border-sky-300",
      desc: "Standard reliable cashier speed."
    };
  } else {
    return {
      rank: "SLOW",
      badge: "🐢 SLOW",
      color: "text-slate-600 bg-slate-200 border-slate-300",
      desc: "Needs extra practice."
    };
  }
}

/* Live Speedometer Update */
function updateLiveSpeedometer() {
  if (!state.startTime) return;
  const elapsed = (Date.now() - state.startTime) / 1000;
  document.getElementById('live-timer').textContent = elapsed.toFixed(1) + 's';

  const evalResult = evaluateResponseTime(elapsed, state.stage, state.inputMode);
  const rankBadge = document.getElementById('speed-rank');
  rankBadge.textContent = evalResult.badge;
  rankBadge.className = `text-xs font-bold px-2 py-0.5 rounded border ${evalResult.color}`;
}

/* Timing Control */
function startTimers() {
  clearInterval(state.timerInterval);
  clearInterval(state.rushInterval);

  state.startTime = Date.now();
  state.timerInterval = setInterval(updateLiveSpeedometer, 100);

  if (state.timedRush) {
    state.rushCountdown = 10;
    const timerContainer = document.getElementById('timer-bar-container');
    const timerBar = document.getElementById('timer-bar');
    timerContainer.classList.remove('hidden');

    timerBar.style.width = '100%';
    timerBar.classList.remove('bg-rose-500');
    timerBar.classList.add('bg-emerald-500');

    state.rushInterval = setInterval(() => {
      state.rushCountdown -= 0.1;
      const pct = Math.max(0, (state.rushCountdown / 10) * 100);
      timerBar.style.width = pct + '%';

      if (pct < 30) {
        timerBar.classList.remove('bg-emerald-500');
        timerBar.classList.add('bg-rose-500');
      }

      if (state.rushCountdown <= 0) {
        clearInterval(state.rushInterval);
        handleTimeOut();
      }
    }, 100);
  } else {
    document.getElementById('timer-bar-container').classList.add('hidden');
  }
}

function stopTimers() {
  clearInterval(state.timerInterval);
  clearInterval(state.rushInterval);
}

function handleTimeOut() {
  stopTimers();
  playBeep('error');
  
  state.stats.totalAttempts++;
  state.stats.streak = 0;
  updateHeaderAndStatsUI();

  showFeedback(
    "⏰ RUSH TIMER EXPIRED!",
    `Time ran out! Total due was ${state.currentProblem.totalPrice.toFixed(3)} JD, Paid: ${state.currentProblem.paidCash.toFixed(3)} JD. Correct change was ${state.currentProblem.correctChange.toFixed(3)} JD.`,
    false
  );

  setTimeout(generateProblem, 2500);
}

/* Modal Navigation */
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

/* UI Mode & Stage Selection */
function setStage(stageNum) {
  playBeep('click');
  state.stage = stageNum;

  for (let i = 1; i <= 4; i++) {
    const btn = document.getElementById(`stage-btn-${i}`);
    if (i === stageNum) {
      btn.classList.add('ring-2', 'ring-emerald-500', 'bg-emerald-50/50');
    } else {
      btn.classList.remove('ring-2', 'ring-emerald-500', 'bg-emerald-50/50');
    }
  }

  const badge = document.getElementById('current-stage-badge');
  const stageNames = {
    1: "Stage 1: Whole JOD",
    2: "Stage 2: JD + Fils",
    3: "Stage 3: Awkward Cash / Rush",
    4: "Stage 4: Multi-Item POS"
  };
  badge.textContent = stageNames[stageNum];

  generateProblem();
}

function setInputMode(mode) {
  playBeep('click');
  state.inputMode = mode;

  const numpadBtn = document.getElementById('input-mode-numpad');
  const drawerBtn = document.getElementById('input-mode-drawer');
  const numpadContainer = document.getElementById('numpad-container');
  const drawerContainer = document.getElementById('drawer-container');
  const helpText = document.getElementById('input-help-text');

  if (mode === 'numpad') {
    numpadBtn.className = "py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white shadow";
    drawerBtn.className = "py-2 text-xs font-bold rounded-lg text-slate-600 hover:text-slate-900";
    numpadContainer.classList.remove('hidden');
    drawerContainer.classList.add('hidden');
    helpText.textContent = "Type exact change (submits automatically when correct)";
  } else {
    drawerBtn.className = "py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white shadow";
    numpadBtn.className = "py-2 text-xs font-bold rounded-lg text-slate-600 hover:text-slate-900";
    drawerContainer.classList.remove('hidden');
    numpadContainer.classList.add('hidden');
    helpText.textContent = "Click notes/coins to build exact change (submits automatically when correct)";
  }

  resetInput();
}

function toggleTimedRush() {
  playBeep('click');
  state.timedRush = document.getElementById('timer-toggle').checked;
  startTimers();
}

/* Input Handling: Numpad & Keyboard */
function pressNumpad(val) {
  playBeep('click');
  if (val === 'CLEAR') {
    state.userInput = "0.00";
  } else if (val === 'BACKSPACE') {
    if (state.userInput.length > 1) {
      state.userInput = state.userInput.slice(0, -1);
      if (state.userInput === "" || state.userInput === "-") state.userInput = "0.00";
    } else {
      state.userInput = "0.00";
    }
  } else {
    if (state.userInput === "0.00" || state.userInput === "0") {
      state.userInput = (val === '.') ? "0." : val;
    } else {
      if (val === '.' && state.userInput.includes('.')) return;
      state.userInput += val;
    }
  }
  updateInputDisplay();
}

/* Drawer Currency Logic */
function addDrawerCurrency(amount) {
  playBeep('click');
  state.drawerTotal = parseFloat((state.drawerTotal + amount).toFixed(3));
  state.userInput = state.drawerTotal.toFixed(3);
  updateInputDisplay();
}

function clearDrawerSelection() {
  playBeep('click');
  state.drawerTotal = 0;
  state.userInput = "0.000";
  updateInputDisplay();
}

function resetInput() {
  state.userInput = "0.00";
  state.drawerTotal = 0;
  updateInputDisplay();
}

function updateInputDisplay() {
  document.getElementById('user-input-display').textContent = state.userInput;
  checkAutoSubmit();
}

/* Automatic Verification Helper */
function checkAutoSubmit() {
  const userVal = parseFloat(state.userInput);
  const correctVal = state.currentProblem.correctChange;

  if (!isNaN(userVal) && Math.abs(userVal - correctVal) < 0.002) {
    submitAnswer();
  }
}

// Keyboard listener for physical numpad
window.addEventListener('keydown', (e) => {
  if (state.inputMode !== 'numpad') return;
  if (e.key >= '0' && e.key <= '9') {
    pressNumpad(e.key);
  } else if (e.key === '.' || e.key === ',') {
    pressNumpad('.');
  } else if (e.key === 'Backspace') {
    pressNumpad('BACKSPACE');
  } else if (e.key === 'Escape') {
    pressNumpad('CLEAR');
  } else if (e.key === 'Enter') {
    submitAnswer();
  }
});

/* Problem Generation Engine */
function generateProblem() {
  resetInput();
  hideFeedback();

  const stage = state.stage;
  let total = 0;
  let paid = 0;
  let items = [];
  let customerBills = [];

  if (stage === 1) {
    total = Math.floor(Math.random() * 45) + 1;
    const availableBills = [5, 10, 20, 50].filter(b => b > total);
    paid = availableBills[Math.floor(Math.random() * availableBills.length)];
    customerBills = [paid];
  } else if (stage === 2) {
    const whole = Math.floor(Math.random() * 20) + 1;
    const fils = [0.25, 0.50, 0.75, 0.35, 0.65, 0.15, 0.85, 0.10, 0.90][Math.floor(Math.random() * 9)];
    total = parseFloat((whole + fils).toFixed(3));
    const higherNote = [5, 10, 20, 50].find(b => b > total);
    paid = higherNote;
    customerBills = [paid];
  } else if (stage === 3) {
    const basePrice = Math.floor(Math.random() * 15) + 2;
    const filsPart = [0.35, 0.65, 0.25, 0.75, 0.15, 0.85, 0.45][Math.floor(Math.random() * 7)];
    total = parseFloat((basePrice + filsPart).toFixed(3));

    const baseNote = [10, 20, 50].find(b => b > total);
    const awkwardType = Math.random() > 0.5 ? 'matching_fils' : 'extra_coin';

    if (awkwardType === 'matching_fils') {
      paid = parseFloat((baseNote + filsPart).toFixed(3));
      customerBills = [baseNote, filsPart];
    } else {
      const extra = [0.50, 0.25, 1.00][Math.floor(Math.random() * 3)];
      paid = parseFloat((baseNote + extra).toFixed(3));
      customerBills = [baseNote, extra];
    }
  } else if (stage === 4) {
    const count = Math.floor(Math.random() * 3) + 2;
    for (let i = 0; i < count; i++) {
      const itemVal = parseFloat(((Math.floor(Math.random() * 8) + 1) + ([0.25, 0.50, 0.10, 0.05, 0.75][Math.floor(Math.random() * 5)])).toFixed(3));
      items.push(itemVal);
      total += itemVal;
    }
    total = parseFloat(total.toFixed(3));
    paid = [10, 20, 50].find(b => b >= total) || 50;
    customerBills = [paid];
  }

  const correctChange = parseFloat((paid - total).toFixed(3));

  state.currentProblem = {
    items,
    totalPrice: total,
    paidCash: paid,
    correctChange,
    customerBills
  };

  renderProblemUI();
  startTimers();
}

function renderProblemUI() {
  const prob = state.currentProblem;

  const multiContainer = document.getElementById('multi-item-container');
  if (state.stage === 4 && prob.items.length > 0) {
    multiContainer.classList.remove('hidden');
    multiContainer.innerHTML = prob.items.map((it, idx) => `
      <div class="flex justify-between text-slate-300">
        <span>Item #${idx + 1}</span>
        <span>${it.toFixed(3)} JD</span>
      </div>
    `).join('');
  } else {
    multiContainer.classList.add('hidden');
  }

  document.getElementById('display-total-price').textContent = prob.totalPrice.toFixed(3) + " JD";
  document.getElementById('display-paid-cash').textContent = prob.paidCash.toFixed(3) + " JD";

  const billsVisual = document.getElementById('customer-bills-visual');
  billsVisual.innerHTML = prob.customerBills.map(b => {
    if (b >= 1) {
      return `<span class="px-2 py-0.5 rounded bg-emerald-900/80 text-emerald-200 border border-emerald-700 font-bold font-mono text-[11px]">${b} JD</span>`;
    } else {
      return `<span class="px-2 py-0.5 rounded bg-amber-900/80 text-amber-200 border border-amber-700 font-bold font-mono text-[11px]">${b.toFixed(3)}</span>`;
    }
  }).join('');
}

/* Submit & Evaluation Logic */
function submitAnswer() {
  stopTimers();
  const userVal = parseFloat(state.userInput);
  const correctVal = state.currentProblem.correctChange;
  const elapsedSeconds = (Date.now() - state.startTime) / 1000;

  const isCorrect = Math.abs(userVal - correctVal) < 0.002;

  state.stats.totalAttempts++;

  if (isCorrect) {
    playBeep('success');
    state.stats.correctAttempts++;
    state.stats.streak++;
    state.stats.totalCashHandled += state.currentProblem.paidCash;
    state.stats.speedTimes.push(elapsedSeconds);

    const evalResult = evaluateResponseTime(elapsedSeconds, state.stage, state.inputMode);

    if (elapsedSeconds < state.stats.bestSpeed) {
      state.stats.bestSpeed = elapsedSeconds;
      state.stats.bestSpeedRank = evalResult.badge;
    }

    updateHeaderAndStatsUI();
    triggerSuccessAnimation();

    showFeedback(
      `✅ CORRECT CHANGE! (${evalResult.badge})`,
      `Response time: ${elapsedSeconds.toFixed(2)}s — ${evalResult.desc}`,
      true
    );

    updateSupervisorFeedback(elapsedSeconds, evalResult);

    setTimeout(generateProblem, 1800);
  } else {
    playBeep('error');
    state.stats.streak = 0;
    updateHeaderAndStatsUI();

    showFeedback(
      "❌ INCORRECT CHANGE",
      `Given: ${isNaN(userVal) ? '0.00' : userVal.toFixed(3)} JD | Correct Change: ${correctVal.toFixed(3)} JD. Keep practicing!`,
      false
    );

    updateSupervisorFeedbackOnFailure();

    setTimeout(generateProblem, 2600);
  }
}

function triggerSuccessAnimation() {
  const posScreen = document.getElementById('pos-screen');
  posScreen.classList.add('ring-4', 'ring-emerald-500', 'animate-success-ring');
  setTimeout(() => {
    posScreen.classList.remove('ring-4', 'ring-emerald-500', 'animate-success-ring');
  }, 600);
}

/* Feedback Banner Rendering */
function showFeedback(title, detail, isSuccess) {
  const banner = document.getElementById('feedback-banner');
  banner.classList.remove('hidden', 'bg-emerald-100', 'border-emerald-300', 'text-emerald-900', 'bg-rose-100', 'border-rose-300', 'text-rose-900');

  if (isSuccess) {
    banner.classList.add('bg-emerald-100', 'border-emerald-300', 'text-emerald-900');
  } else {
    banner.classList.add('bg-rose-100', 'border-rose-300', 'text-rose-900');
  }

  document.getElementById('feedback-title').textContent = title;
  document.getElementById('feedback-detail').textContent = detail;
}

function hideFeedback() {
  document.getElementById('feedback-banner').classList.add('hidden');
}

/* Live Supervisor Smart Hints & Feedback */
function updateSupervisorFeedback(seconds, evalResult) {
  const trickText = document.getElementById('persistent-trick-text');
  const statusTag = document.getElementById('last-shortcut-status');
  const prob = state.currentProblem;

  statusTag.textContent = `${evalResult.badge} (${seconds.toFixed(2)}s)`;

  let tipMessage = "";
  if (prob.correctChange > 0) {
    const fils = parseFloat((prob.correctChange % 1).toFixed(3));
    if (fils > 0) {
      tipMessage = `<strong>Supervisor Tip:</strong> For ${prob.totalPrice.toFixed(3)} JD due, count up from ${prob.totalPrice.toFixed(3)} JD to the next whole dinar (+${(1 - (prob.totalPrice % 1)).toFixed(3)} JD fils), then add whole notes!`;
    } else {
      tipMessage = `<strong>Supervisor Tip:</strong> Clean integer calculation! Simply subtract whole dinars: ${prob.paidCash} - ${prob.totalPrice} = ${prob.correctChange} JD.`;
    }
  } else {
    tipMessage = `<strong>Supervisor Tip:</strong> Exact cash received! Zero change required.`;
  }

  trickText.innerHTML = `${evalResult.desc} ${tipMessage}`;
}

function updateSupervisorFeedbackOnFailure() {
  const trickText = document.getElementById('persistent-trick-text');
  const statusTag = document.getElementById('last-shortcut-status');

  statusTag.textContent = "MISCALCULATION";
  statusTag.className = "text-[10px] font-mono px-2 py-0.5 bg-rose-100 text-rose-800 font-semibold rounded-md border border-rose-300";

  trickText.innerHTML = `<strong>Supervisor Advice:</strong> Take a deep breath! Use the 1,000-fils complement rule: make the tens digit sum to 9 and the units digit sum to 10 for rapid fils calculation.`;
}

/* Update Top Bar and Side Bar Analytics */
function updateHeaderAndStatsUI() {
  document.getElementById('header-streak').textContent = `${state.stats.streak} 🔥`;

  const avg = state.stats.speedTimes.length > 0
    ? (state.stats.speedTimes.reduce((a, b) => a + b, 0) / state.stats.speedTimes.length).toFixed(1)
    : "0.0";
  document.getElementById('header-avg-time').textContent = `${avg}s`;
  document.getElementById('header-total-cash').textContent = `${state.stats.totalCashHandled.toFixed(3)} JD`;

  const pct = state.stats.totalAttempts > 0
    ? Math.round((state.stats.correctAttempts / state.stats.totalAttempts) * 100)
    : 100;
  document.getElementById('stat-accuracy').textContent = `${pct}%`;
  document.getElementById('stat-counts').textContent = `${state.stats.correctAttempts} / ${state.stats.totalAttempts} correct`;

  const best = state.stats.bestSpeed === Infinity ? "0.0s" : `${state.stats.bestSpeed.toFixed(2)}s`;
  document.getElementById('stat-best-speed').textContent = best;
  document.getElementById('stat-badge').textContent = state.stats.bestSpeedRank;
}

function resetStats() {
  playBeep('click');
  state.stats = {
    totalAttempts: 0,
    correctAttempts: 0,
    streak: 0,
    bestSpeed: Infinity,
    bestSpeedRank: "No Badge",
    totalCashHandled: 0,
    speedTimes: []
  };
  updateHeaderAndStatsUI();
  generateProblem();
}

/* Initialization on DOM Load */
window.addEventListener('DOMContentLoaded', () => {
  setStage(1);
});