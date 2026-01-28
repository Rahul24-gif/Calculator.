/* --- GLOBAL VARIABLES --- */
let expression = "";
let memory = 0;
let history = [];
let lastCalculationResult = ""; // Stores "Expr = Result" for sharing
let voiceEnabled = true; // Default Voice Output ON

/* --- INITIALIZATION & PERFORMANCE OPTIMIZATION --- */
document.addEventListener('DOMContentLoaded', () => {
  // 1. Theme Initialization
  const savedTheme = localStorage.getItem("theme");
  const themeToggle = document.querySelector('.theme-toggle');
  const themeIcon = themeToggle.querySelector('i');
  const themeText = themeToggle.querySelector('.theme-text');

  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
    themeIcon.classList.remove('fa-moon');
    themeIcon.classList.add('fa-sun');
    themeText.textContent = 'Light';
  } else {
    document.body.classList.remove("dark-mode");
    themeIcon.classList.remove('fa-sun');
    themeIcon.classList.add('fa-moon');
    themeText.textContent = 'Dark';
  }

  // 2. Low Power / Performance Check (Disabled to preserve original layout/look)
  /*
  const isLowPower = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || 
                     (navigator.connection && navigator.connection.saveData);
  
  if (isLowPower) {
    document.body.classList.add('low-power');
    console.log("Low power mode enabled: Simplified animations.");
  }
  */

  // 3. Resize Observer for Dynamic UI
  const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
      const width = entry.contentRect.width;
      const height = entry.contentRect.height;
      let scaleW = width / 400;
      let scaleH = height / 800;
      let scale = Math.min(scaleW, scaleH);
      if (scale < 0.8) scale = 0.8;
      if (scale > 1.4) scale = 1.4;

      const container = document.querySelector('.container');
      if (container) {
        container.style.setProperty('--gap-size', `${10 * scale}px`);
        container.style.setProperty('--btn-padding', `${12 * scale}px`);
      }

      const display = document.getElementById('display');
      if (display) {
        let fontSize = Math.max(1.8, Math.min(3.5, width / 200));
        display.style.fontSize = `${fontSize}rem`;
      }
    }
  });

  const calcContainer = document.querySelector('.container');
  if (calcContainer) resizeObserver.observe(calcContainer);

  // 4. Initialize Components
  loadHistory();
  populateConverterOptions();
  loadRoughPad(); // New Feature

  // 5. Input Listeners
  document.querySelectorAll(".cash-table input[type='number']").forEach(input => {
    input.addEventListener('input', () => {
      validateCashInput(input);
      updateCashTotal();
      playClick();
    });
  });

  if (display) {
    display.addEventListener('input', (e) => {
      expression = e.target.value;
    });
  }

  // Prevent Arrow Keys on Number Inputs
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.target.type === 'number') {
      e.preventDefault();
    }
  });

  // Global Keyboard Support for Standard Calculator REMOVED (Handled by Global Listener at bottom)


  // Hide Splash
  setTimeout(() => {
    showCalculator('standard');
    const splash = document.getElementById("splash");
    if (splash) splash.classList.add("hidden");
  }, 800);
});

/* --- AUDIO CONTEXT --- */
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playClick() {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.05);
  gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + 0.05);
}

/* --- VOICE OUTPUT (TTS) --- */
function speakResult(text) {
  if (!voiceEnabled || !window.speechSynthesis) return;

  // Cancel previous speech to avoid queue buildup
  window.speechSynthesis.cancel();

  // Clean text for speech (replace symbols)
  let speechText = text.toString()
    .replace(/-/g, " minus ")
    .replace(/\*/g, " multiplied by ")
    .replace(/\//g, " divided by ")
    .replace(/\./g, " point ");

  const utterance = new SpeechSynthesisUtterance(speechText);
  utterance.lang = 'en-US'; // Can be changed based on preference
  utterance.rate = 1.1;
  window.speechSynthesis.speak(utterance);
}

function toggleVoiceOutput() {
  voiceEnabled = !voiceEnabled;
  const btn = document.getElementById('tts-toggle-btn');
  if (btn) {
    btn.innerHTML = voiceEnabled ? '<i class="fas fa-volume-up"></i>' : '<i class="fas fa-volume-mute"></i>';
    btn.style.color = voiceEnabled ? 'var(--text-main)' : 'var(--text-muted)';
  }
  playClick();
}

/* --- WHATSAPP SHARE --- */
/* --- WHATSAPP SHARE --- */
function shareToWhatsApp(context) {
  let text = "";

  if (context === 'standard') {
    if (!lastCalculationResult) {
      // Fallback to display value if user types but doesn't hit =
      const disp = document.getElementById('display').value;
      if (!disp) return alert("Calculate something first!");
      text = `*Smart Calculator Result:* \n${disp}`;
    } else {
      text = `*Smart Calculator Result:* \n${lastCalculationResult}`;
    }

  } else if (context === 'cash') {
    text = `*Cash Calculator Summary*\n---------------------\n`;
    const notes = [
      { value: 500, id: 'c500' }, { value: 200, id: 'c200' },
      { value: 100, id: 'c100' }, { value: 50, id: 'c50' },
      { value: 20, id: 'c20' }, { value: 10, id: 'c10' }
    ];

    let hasItems = false;
    notes.forEach(n => {
      const count = document.getElementById(n.id).value;
      if (count && count > 0) {
        text += `₹${n.value} x ${count} = ₹${(n.value * count).toLocaleString('en-IN')}\n`;
        hasItems = true;
      }
    });

    const coins = document.getElementById('coins').value;
    if (coins && coins > 0) {
      text += `Coins: ₹${parseInt(coins).toLocaleString('en-IN')}\n`;
      hasItems = true;
    }

    if (!hasItems) return alert("Enter some cash details first!");

    text += `---------------------\n*${document.getElementById('cashTotal').innerText}*`;

  } else if (context === 'loan') {
    const emi = document.getElementById('emiResult').innerText;
    if (emi === '₹0') return alert("Calculate first!");

    const P = document.getElementById('loanAmount').value;
    const R = document.getElementById('loanRate').value;
    const N = document.getElementById('loanTerm').value;
    const extra = document.getElementById('loanExtra').value;
    const totalInt = document.getElementById('interestResult').innerText;
    const totalPay = document.getElementById('paymentResult').innerText;

    text = `*Loan EMI Breakdown*\n`;
    text += `Loan: ₹${parseFloat(P).toLocaleString('en-IN')} @ ${R}% for ${N}Y\n`;
    text += `---------------------\n`;
    text += `EMI: ${emi}/mo\n`;
    text += `Total Interest: ${totalInt}\n`;
    text += `Total Amount: ${totalPay}\n`;
    text += `---------------------\n`;

    if (extra && extra > 0) {
      const savedInt = document.getElementById('savedInterest').innerText;
      const savedTime = document.getElementById('savedTime').innerText;
      text += `With Extra Pay: ₹${parseFloat(extra).toLocaleString('en-IN')}/mo\n`;
      text += `*SAVES: ${savedInt} & ${savedTime}*`;
    }
  }

  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

/* --- UTILS --- */
function loadHistory() {
  const savedHistory = localStorage.getItem("calcHistory");
  if (savedHistory) {
    history = savedHistory.split('\n').filter(entry => entry.trim() !== '');
    const historyElement = document.getElementById("history-content");
    if (historyElement) {
      historyElement.innerHTML = history.map(entry => `<p>${entry}</p>`).join("");
      historyElement.scrollTop = historyElement.scrollHeight;
    }
  }
}

function saveHistory() {
  localStorage.setItem("calcHistory", history.join('\n'));
}

function toggleTheme() {
  document.body.classList.toggle("dark-mode");
  const isDarkMode = document.body.classList.contains("dark-mode");
  localStorage.setItem("theme", isDarkMode ? "dark" : "light");

  const themeToggle = document.querySelector('.theme-toggle');
  const themeIcon = themeToggle.querySelector('i');
  const themeText = themeToggle.querySelector('.theme-text');

  if (isDarkMode) {
    themeIcon.classList.remove('fa-moon');
    themeIcon.classList.add('fa-sun');
    themeText.textContent = 'Light';
  } else {
    themeIcon.classList.remove('fa-sun');
    themeIcon.classList.add('fa-moon');
    themeText.textContent = 'Dark';
  }
  playClick();
}

function getActiveMode() {
  if (document.querySelector('.calculator').classList.contains('active')) return 'standard';
  // other modes check if needed
  return null;
}

function updateDisplay(value) {
  const mode = getActiveMode();
  if (mode === 'standard') {
    const d = document.getElementById("display");
    if (d) d.value = value || "";
  }
}

function showCalculator(type) {
  document.querySelectorAll('.calculator, .cash-calculator, .loan-calculator, .unit-converter, .date-calculator, .bmi-calculator, .cheque-writer').forEach(el => {
    el.style.display = 'none';
    el.classList.remove('active');
  });

  document.querySelectorAll(".tabs button").forEach(tab => tab.classList.remove("active"));
  const tab = document.querySelector(`.tabs button[onclick="showCalculator('${type}')"]`);
  if (tab) tab.classList.add("active");

  const map = {
    'standard': 'standard',
    'cash': 'cash',
    'loan': 'loan',
    'unit': 'convert', // ID mismatch in HTML handled manually
    'date': 'date',
    'bmi': 'bmi',
    'cheque': 'cheque'
  };

  const id = map[type] || type;
  const el = document.getElementById(id);

  // Special handling for unit converter ID which is 'convert' in HTML
  if (type === 'unit') {
    document.getElementById('convert').style.display = 'flex';
    document.getElementById('convert').classList.add('active');
  } else if (el) {
    el.style.display = 'flex';
    el.classList.add('active');
  }

  if (type === 'standard') updateDisplay(expression);
  else if (type === 'cash') updateCashTotal();

  playClick();
}

/* --- CHEQUE WRITER LOGIC --- */
function convertNumberToWords() {
  const input = document.getElementById('chequeInput').value;
  const output = document.getElementById('chequeOutput');

  if (!input) {
    output.innerText = "Please enter an amount.";
    return;
  }

  // Remove commas for calculation
  const rawValue = input.replace(/,/g, '');
  const num = parseInt(rawValue);

  if (isNaN(num)) {
    output.innerText = "Invalid Number";
    return;
  }

  // Indian Numbering System Logic
  const words = numberToWordsIndian(num);
  output.innerText = words + " Rupees Only";
  playClick();
}

function formatChequeInput(input) {
  // Get cursor position to restore later
  const cursor = input.selectionStart;
  const originalLen = input.value.length;

  // Remove non-digits
  let val = input.value.replace(/[^0-9]/g, '');
  if (!val) {
    input.value = "";
    return;
  }

  // Format with commas (Indian system)
  const formatted = new Intl.NumberFormat('en-IN').format(val);
  input.value = formatted;

  convertNumberToWords();

  // Restore cursor logic (simple approximation)
  // If formatting added chars, cursor needs adjustment. 
  // For simplicity keeping at end or keeping relative if possible, 
  // but standard input behavior often jumps with auto-format.
  // We'll just let it jump to end for now or simple adjustment.
}

function numberToWordsIndian(num) {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if ((num = num.toString()).length > 9) return 'overflow';
  const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return;
  let str = '';
  str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
  str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
  str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
  str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
  str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
  return str.trim();
}

function clearChequeInput() {
  document.getElementById('chequeInput').value = '';
  document.getElementById('chequeOutput').innerText = 'Amount in words will appear here...';
  playClick();
}

/* --- ROUGH PAD LOGIC --- */
function toggleRoughPad() {
  const pad = document.getElementById('roughPad');
  pad.classList.toggle('visible');
  playClick();
}

function loadRoughPad() {
  const savedNote = localStorage.getItem('roughPadNote');
  if (savedNote) {
    document.getElementById('roughPadText').value = savedNote;
  }
}

function saveRoughPad() {
  const text = document.getElementById('roughPadText').value;
  localStorage.setItem('roughPadNote', text);
}

function clearRoughPad() {
  if (confirm("Clear note?")) {
    document.getElementById('roughPadText').value = "";
    saveRoughPad();
  }
}

/* --- STANDARD CALC LOGIC --- */
function press(val) {
  let display;
  if (document.querySelector('.calculator').classList.contains('active')) {
    display = document.getElementById("display");
  } else {
    return;
  }

  const startPos = display.selectionStart;
  const endPos = display.selectionEnd;
  const currentValue = display.value;
  const newValue = currentValue.substring(0, startPos) + val + currentValue.substring(endPos);

  if (document.querySelector('.calculator').classList.contains('active')) {
    expression = newValue;
  }

  display.value = newValue;
  const newCursorPos = startPos + val.length;
  display.setSelectionRange(newCursorPos, newCursorPos);
  display.focus();
  playClick();
}

function clearDisplay() {
  expression = "";
  updateDisplay("");
  playClick();
  document.getElementById("display").focus();
}

function backspace() {
  // Logic simplified: Always remove last char from expression if it exists.
  // We removed the 'document.activeElement === display' check because
  // the display is readonly, which messed up keyboard support if focused.

  if (expression.length > 0) {
    expression = expression.slice(0, -1);
    updateDisplay(expression);
    playClick();
  }
}

/* --- INFO MODAL LOGIC --- */
function toggleInfo() {
  const modal = document.getElementById('infoModal');
  const isActive = modal.classList.contains('active');

  if (isActive) {
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300); // Wait for transition
  } else {
    modal.style.display = 'flex';
    // Small delay to allow display:flex to apply before adding class for opacity transition
    setTimeout(() => modal.classList.add('active'), 10);
  }
  playClick();
}

function closeInfo(e) {
  if (e.target.id === 'infoModal') {
    toggleInfo();
  }
}

function calculate() {
  const display = document.getElementById("display");
  expression = display.value;
  try {
    let expr = expression;
    expr = expr.replace(/\^/g, '**');

    // Percentage Logic
    while (expr.includes('%')) {
      const index = expr.indexOf('%');
      const sub = expr.substring(0, index + 1);
      const tail = expr.substring(index + 1);

      // Match "Base Operator Number%"
      const match = sub.match(/(.*)([\+\-\*\/])(\d+(?:\.\d+)?)%$/);

      if (match) {
        const base = match[1];
        const op = match[2];
        const num = match[3];

        if (op === '+' || op === '-') {
          const p = parseFloat(num) / 100;
          expr = `(${base}) * (1 ${op} ${p})` + tail;
        } else { // * or /
          const p = parseFloat(num) / 100;
          expr = `${base}${op}(${p})` + tail;
        }
      } else {
        // No preceding operator (e.g. "10%")
        expr = sub.replace(/(\d+(?:\.\d+)?)%$/, '($1/100)') + tail;
      }
    }

    // Remove leading zeros
    expr = expr.replace(/(?<![\d.])0+(?=[1-9])/g, '');

    if (!expr) return;

    let result = Function('"use strict";return (' + expr + ')')();
    if (!isFinite(result) || isNaN(result)) {
      display.value = "Error";
      expression = "";
      playClick();
      return;
    }

    result = parseFloat(result.toFixed(10));
    const calculation = `${expression} = ${result}`;
    lastCalculationResult = calculation; // Store for sharing
    addToHistory(calculation);
    expression = result.toString();
    updateDisplay(expression);

    // Voice Output
    if (voiceEnabled) speakResult(result);

    playClick();

  } catch (error) {
    console.error("Calculation Error:", error);
    display.value = "Error";
  }
}

function addToHistory(entry) {
  const serialNumber = history.length + 1;
  const formattedEntry = `${serialNumber}. ${entry}`;
  history.push(formattedEntry);
  if (history.length > 10) history.shift();
  const historyElement = document.getElementById("history-content");
  if (historyElement) {
    historyElement.innerHTML = history.map(e => `<p>${e}</p>`).join("");
    historyElement.scrollTop = historyElement.scrollHeight;
    saveHistory();
  }
}

function clearHistory() {
  history = [];
  const historyElement = document.getElementById("history-content");
  if (historyElement) {
    historyElement.innerHTML = "";
    saveHistory();
    playClick();
  }
}

function memoryAdd() {
  const currentValue = parseFloat(expression || "0");
  if (!isNaN(currentValue)) {
    memory += currentValue;
    alert(`Memory: ${memory}`);
    playClick();
  }
}

function memorySubtract() {
  const currentValue = parseFloat(expression || "0");
  if (!isNaN(currentValue)) {
    memory -= currentValue;
    alert(`Memory: ${memory}`);
    playClick();
  }
}

function memoryRecall() {
  expression = memory.toString();
  updateDisplay(expression);
  playClick();
}

function memoryClear() {
  memory = 0;
  alert("Memory Cleared");
  playClick();
}

function calculateGST(mode) {
  const display = document.getElementById("display");
  let currentVal = display.value;
  try {
    if (!currentVal) return;
    const safeExpression = currentVal.replace(/[^0-9+\-*/().]/g, '');
    const result = Function('"use strict";return (' + safeExpression + ')')();
    const rate = parseFloat(document.getElementById('gstRate').value);
    let finalVal = 0;
    let detail = "";

    if (mode === 'add') {
      const gstAmount = result * (rate / 100);
      finalVal = result + gstAmount;
      detail = `${result} + ${rate}% GST`;
    } else {
      finalVal = result / (1 + (rate / 100));
      detail = `${result} - ${rate}% GST`;
    }
    finalVal = parseFloat(finalVal.toFixed(2));
    expression = finalVal.toString();
    updateDisplay(expression);
    addToHistory(`${detail} = ${finalVal}`);
    playClick();
  } catch (e) {
    display.value = "Error";
  }
}

function startVoiceControl() {
  if (!('webkitSpeechRecognition' in window)) {
    alert("Voice control is supported in Chrome/Edge.");
    return;
  }
  const recognition = new webkitSpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  const btn = document.getElementById('voice-btn');
  btn.style.color = '#ef4444';
  btn.classList.add('pulse-anim');

  recognition.onresult = function (event) {
    const transcript = event.results[0][0].transcript.toLowerCase();

    // Voice Command for "Stop"
    if (transcript.includes("stop") || transcript.includes("cancel")) {
      btn.style.color = 'var(--text-main)';
      btn.classList.remove('pulse-anim');
      return;
    }

    let command = transcript;
    command = command.replace(/plus/g, '+').replace(/minus/g, '-')
      .replace(/multiply by/g, '*').replace(/times/g, '*')
      .replace(/divided by/g, '/').replace(/equals/g, '=');

    let cleanCommand = command.replace(/[^0-9+\-*/.=]/g, '');
    if (cleanCommand) {
      expression = cleanCommand.replace('=', '');
      updateDisplay(expression);
      if (command.includes('=')) {
        calculate();
        // Voice Output handled in calculate
      }
      playClick();
    }
  };

  recognition.onerror = function (event) {
    btn.style.color = 'var(--text-main)';
    btn.classList.remove('pulse-anim');
  };
  recognition.onend = function () {
    btn.style.color = 'var(--text-main)';
    btn.classList.remove('pulse-anim');
  };
  recognition.start();
}

/* --- DATE, UNIT, CASH, BMI, LOAN LOGIC (Preserved) --- */
function showDateMode(mode) {
  document.querySelectorAll('.date-mode-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.converter-select-type .type-btn').forEach(el => el.classList.remove('active'));
  if (mode === 'age') {
    document.getElementById('age-calc').style.display = 'flex';
    document.querySelector('.converter-select-type .type-btn:nth-child(1)').classList.add('active');
  } else {
    document.getElementById('diff-calc').style.display = 'flex';
    document.querySelector('.converter-select-type .type-btn:nth-child(2)').classList.add('active');
  }
  playClick();
}

function calculateAge() {
  const dobStr = document.getElementById('dob').value;
  if (!dobStr) return;
  const dob = new Date(dobStr);
  const today = new Date();
  let years = today.getFullYear() - dob.getFullYear();
  let months = today.getMonth() - dob.getMonth();
  let days = today.getDate() - dob.getDate();
  if (days < 0) { months--; days += new Date(today.getFullYear(), today.getMonth(), 0).getDate(); }
  if (months < 0) { years--; months += 12; }
  document.getElementById('ageResult').innerText = `${years} Y, ${months} M, ${days} D`;
  const nextBday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
  if (today > nextBday) nextBday.setFullYear(today.getFullYear() + 1);
  const diffDays = Math.ceil(Math.abs(nextBday - today) / (1000 * 60 * 60 * 24));
  document.getElementById('nextBday').innerText = `Next Birthday in: ${diffDays} days`;
  playClick();
}

function calculateDateDiff() {
  const d1 = document.getElementById('date1').value;
  const d2 = document.getElementById('date2').value;
  if (!d1 || !d2) return;
  const diffDays = Math.ceil(Math.abs(new Date(d2) - new Date(d1)) / (1000 * 60 * 60 * 24));
  document.getElementById('diffResult').innerText = `${diffDays} Days`;
  playClick();
}

function validateCashInput(input) {
  input.value = input.value.replace(/\D/g, '').slice(0, 9);
}

function updateCashTotal() {
  let total = 0;
  const notes = [{ value: 500, id: 'c500', totalId: 't500' }, { value: 200, id: 'c200', totalId: 't200' }, { value: 100, id: 'c100', totalId: 't100' }, { value: 50, id: 'c50', totalId: 't50' }, { value: 20, id: 'c20', totalId: 't20' }, { value: 10, id: 'c10', totalId: 't10' }];
  const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
  notes.forEach(note => {
    const count = parseInt(document.getElementById(note.id).value) || 0;
    const noteTotal = count * note.value;
    total += noteTotal;
    const tSpan = document.getElementById(note.totalId);
    if (tSpan) tSpan.innerText = formatter.format(noteTotal);
  });
  const coins = parseInt(document.getElementById("coins").value) || 0;
  total += coins;
  document.getElementById("tcoins").innerText = formatter.format(coins);
  document.getElementById("cashTotal").innerText = `Total: ${formatter.format(total)}`;
}

function clearCashInputs() {
  document.querySelectorAll(".cash-table input[type='number']").forEach(i => i.value = "");
  updateCashTotal();
  playClick();
}

function saveCashToExcel() {
  const notes = [
    { value: 500, id: 'c500' },
    { value: 200, id: 'c200' },
    { value: 100, id: 'c100' },
    { value: 50, id: 'c50' },
    { value: 20, id: 'c20' },
    { value: 10, id: 'c10' }
  ];
  const coins = parseInt(document.getElementById("coins").value) || 0;
  const grandTotal = document.getElementById("cashTotal").innerText;

  // Check for converted total
  const convertedTotalElement = document.getElementById("convertedTotal");
  const convertedTotalText = convertedTotalElement ? convertedTotalElement.innerText : "";

  const now = new Date();
  const date = now.toLocaleDateString("en-GB");
  const time = now.toLocaleTimeString();

  // Create Data Array
  const data = [
    ["Smart Calculator - Cash Summary"],
    ["Date:", date],
    ["Time:", time],
    [],
    ["Denomination", "Count", "Total"]
  ];

  let totalCount = 0;
  let numericTotal = 0;

  notes.forEach(n => {
    const count = parseInt(document.getElementById(n.id).value) || 0;
    if (count > 0) {
      const lineTotal = n.value * count;
      data.push([n.value, count, lineTotal]);
      totalCount += count;
      numericTotal += lineTotal;
    }
  });

  if (coins > 0) {
    data.push(["Coins", "", coins]);
    numericTotal += coins;
  }

  data.push([]);
  data.push(["Grand Total", "", grandTotal]);

  if (convertedTotalText && !convertedTotalText.includes("Fetching") && !convertedTotalText.includes("Error")) {
    data.push(["Converted Total", "", convertedTotalText]);
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Column Widths
  ws['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 20 }];

  XLSX.utils.book_append_sheet(wb, ws, "Summary");
  XLSX.writeFile(wb, `Cash_Summary_${date.replace(/\//g, "-")}.xlsx`);
  playClick();
}

async function convertCurrency() {
  // ... Existing logic, placeholder implementation ...
  alert("Currency conversion API key required.");
}

function printCashSummary() {
  if (document.getElementById("cash").classList.contains("active")) {
    const notesData = [{ value: 500, count: parseInt(document.getElementById('c500').value) || 0 }, { value: 200, count: parseInt(document.getElementById('c200').value) || 0 }, { value: 100, count: parseInt(document.getElementById('c100').value) || 0 }, { value: 50, count: parseInt(document.getElementById('c50').value) || 0 }, { value: 20, count: parseInt(document.getElementById('c20').value) || 0 }, { value: 10, count: parseInt(document.getElementById('c10').value) || 0 }];
    const coins = parseInt(document.getElementById("coins").value) || 0;
    const grandTotalText = document.getElementById("cashTotal").innerText;

    // Check for converted total if it exists (might need elements from original)
    const convertedTotalElement = document.getElementById("convertedTotal");
    const convertedTotalText = convertedTotalElement ? convertedTotalElement.innerText : "";

    const inrFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

    const summaryItemsHtml = notesData.map(item => {
      const total = item.count * item.value;
      return `<div class="summary-item"><strong>${inrFormatter.format(item.value)}:</strong><span>${item.count} pc(s) = ${inrFormatter.format(total)}</span></div>`;
    }).join('') + `<div class="summary-item"><strong>Coins:</strong><span>${inrFormatter.format(coins)}</span></div>`;

    let convertedTotalHtml = '';
    if (convertedTotalText && !convertedTotalText.includes("Fetching") && !convertedTotalText.includes("Error")) {
      convertedTotalHtml = `<div class="summary-item"><strong>Converted Total:</strong> <span>${convertedTotalText.replace('Converted Total: ', '')}</span></div>`;
    }

    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const formattedDate = now.toLocaleDateString(undefined, options);
    const formattedTime = now.toLocaleTimeString();

    const printContent = `
        <html><head><title>Cash Summary</title><style>
                body { font-family: Arial, sans-serif; padding: 20px; color: #000; } h2 { text-align: center; margin-bottom: 20px; }
                .datetime { text-align: center; margin-bottom: 15px; font-size: 0.9rem; color: #555; }
                .summary-item { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dotted #ccc; font-size: 1rem; }
                .summary-item span { flex-shrink: 0; text-align: right; min-width: 150px; }
                #grandTotal { margin-top: 20px; padding: 10px 0; border-top: 2px solid #000; font-size: 1.5rem; font-weight: bold; text-align: right; }
                #grandTotal strong { font-weight: bold; margin-right: 15px; } #grandTotal span { font-weight: normal; }
            </style></head><body><h2>Cash Summary</h2><div class="datetime">${formattedDate} - ${formattedTime}</div><div class="summary-items-list">${summaryItemsHtml}</div>
            <div id="grandTotal"><strong>Total:</strong> <span>${grandTotalText.replace('Total: ', '')}</span></div>
            ${convertedTotalHtml}</body></html>`;

    const printWindow = window.open("", "_blank");
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
    printWindow.close();
    playClick();
  }
}

let loanChartInstance = null;

function calculateLoan() {
  const P = parseFloat(document.getElementById('loanAmount').value);
  const R_annual = parseFloat(document.getElementById('loanRate').value);
  const N_years = parseFloat(document.getElementById('loanTerm').value);
  const extraEMI = parseFloat(document.getElementById('loanExtra').value) || 0;

  if (!P || !R_annual || !N_years) return alert("Invalid Input");

  const R = (R_annual / 12) / 100;
  const N = N_years * 12;

  // Standard EMI Calculation
  const emi = (P * R * Math.pow(1 + R, N)) / (Math.pow(1 + R, N) - 1);
  const totalPaymentStandard = emi * N;
  const totalInterestStandard = totalPaymentStandard - P;

  // Extra Payment Calculation (Amortization)
  let balance = P;
  let totalInterestNew = 0;
  let monthsNew = 0;
  let totalPaymentNew = 0;
  const totalMonthlyPayment = emi + extraEMI;

  // Simple amortization loop
  // To avoid infinite loops in case of weird inputs, cap at 100 years
  // Also, if totalMonthlyPayment <= interest, loan never closes.
  if (totalMonthlyPayment <= P * R) {
    alert("Extra payment is too low. It must cover at least the interest.");
    return;
  }

  while (balance > 0 && monthsNew < 1200) {
    let interestForMonth = balance * R;
    let principalForMonth = totalMonthlyPayment - interestForMonth;

    // Last month adjustment
    if (balance < principalForMonth) {
      principalForMonth = balance;
      interestForMonth = balance * R; // Approx for last bit
      // Correction: actual final payment is balance + interest
      totalPaymentNew += (balance + interestForMonth);
      totalInterestNew += interestForMonth;
      balance = 0;
    } else {
      balance -= principalForMonth;
      totalInterestNew += interestForMonth;
      totalPaymentNew += totalMonthlyPayment;
    }
    monthsNew++;
  }

  const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  // Display Standard Results
  document.getElementById('emiResult').innerText = fmt(Math.round(emi));
  document.getElementById('interestResult').innerText = fmt(Math.round(totalInterestStandard));
  document.getElementById('paymentResult').innerText = fmt(Math.round(totalPaymentStandard));

  // Savings Calculation
  if (extraEMI > 0) {
    const interestSaved = totalInterestStandard - totalInterestNew;
    const timeSavedMonths = N - monthsNew;

    document.getElementById('savedInterest').innerText = fmt(Math.round(interestSaved));

    const yearsSaved = Math.floor(timeSavedMonths / 12);
    const monthsRemainder = Math.ceil(timeSavedMonths % 12);
    let timeText = "";
    if (yearsSaved > 0) timeText += `${yearsSaved} Yr `;
    if (monthsRemainder > 0) timeText += `${monthsRemainder} Mo`;
    if (timeText === "") timeText = "0 Mo";

    document.getElementById('savedTime').innerText = timeText;
    document.getElementById('savingsBox').style.display = 'flex';
  } else {
    document.getElementById('savingsBox').style.display = 'none';
  }

  document.getElementById('loanResults').style.display = 'block';
  drawLoanChart(P, totalInterestStandard, totalInterestNew, extraEMI > 0);
  playClick();
}

function drawLoanChart(principal, interestStd, interestNew, hasExtra) {
  const ctx = document.getElementById('loanChart').getContext('2d');

  if (loanChartInstance) {
    loanChartInstance.destroy();
  }

  // Create Gradients
  const principalGrad = ctx.createLinearGradient(0, 0, 0, 400);
  principalGrad.addColorStop(0, '#3b82f6');
  principalGrad.addColorStop(1, 'rgba(59, 130, 246, 0.2)');

  const interestStdGrad = ctx.createLinearGradient(0, 0, 0, 400);
  interestStdGrad.addColorStop(0, '#ef4444');
  interestStdGrad.addColorStop(1, 'rgba(239, 68, 68, 0.2)');

  const interestNewGrad = ctx.createLinearGradient(0, 0, 0, 400);
  interestNewGrad.addColorStop(0, '#10b981');
  interestNewGrad.addColorStop(1, 'rgba(16, 185, 129, 0.2)');

  const dataStd = [principal, interestStd];
  const dataNew = hasExtra ? [principal, interestNew] : [principal, interestStd];

  const chartData = {
    labels: hasExtra ? ['Standard Loan', 'With Extra Pay'] : ['Loan Breakdown'],
    datasets: [
      {
        label: 'Principal',
        data: hasExtra ? [principal, principal] : [principal],
        backgroundColor: principalGrad,
        borderColor: '#3b82f6',
        borderWidth: 1,
        barThickness: 50,
        borderRadius: 8, // Rounded bars
      },
      {
        label: 'Interest',
        data: hasExtra ? [interestStd, interestNew] : [interestStd],
        backgroundColor: hasExtra ? [interestStdGrad, interestNewGrad] : interestStdGrad,
        borderColor: hasExtra ? ['#ef4444', '#10b981'] : '#ef4444',
        borderWidth: 1,
        barThickness: 50,
        borderRadius: 8,
      }
    ]
  };

  // Let's stick to Stacked Bar for consistency
  loanChartInstance = new Chart(ctx, {
    type: 'bar',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, grid: { display: false, color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af', font: { family: 'Poppins' } } },
        y: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af', font: { family: 'Poppins' }, callback: function (value) { return '₹' + value / 1000 + 'k'; } } }
      },
      plugins: {
        legend: { labels: { color: '#9ca3af', font: { family: 'Poppins' } } },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          titleColor: '#f8fafc',
          titleFont: { family: 'Poppins', size: 14 },
          bodyFont: { family: 'Poppins' },
          padding: 12,
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          callbacks: {
            label: function (context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed.y !== null) {
                label += new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(context.parsed.y);
              }
              return label;
            }
          }
        }
      }
    }
  });
}

function clearLoanInputs() {
  document.getElementById('loanAmount').value = "";
  document.getElementById('loanRate').value = "";
  document.getElementById('loanTerm').value = "";
  document.getElementById('loanExtra').value = "";
  document.getElementById('loanResults').style.display = 'none';
  document.getElementById('savingsBox').style.display = 'none';
  if (loanChartInstance) {
    loanChartInstance.destroy();
    loanChartInstance = null;
  }
  playClick();
}

/* UNIT CONVERTER LOGIC (Simplified for brevity, ensuring critical path works) */
let currentConverterType = 'length';
const units = {
  length: { base: 'm', rates: { m: 1, km: 0.001, cm: 100, ft: 3.28084 } },
  data: { base: 'GB', rates: { GB: 1, MB: 1024, TB: 0.001 } },
  mass: { base: 'kg', rates: { kg: 1, g: 1000, lb: 2.20462 } },
  currency: { base: 'USD', rates: { USD: 1, INR: 83.5, EUR: 0.85 } }
};

function setConverterType(type) {
  currentConverterType = type;
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`button[onclick="setConverterType('${type}')"]`).classList.add('active');
  populateConverterOptions();
  convertUnit();
  playClick();
}

function populateConverterOptions() {
  const s1 = document.getElementById('unitFrom');
  const s2 = document.getElementById('unitTo');
  s1.innerHTML = ''; s2.innerHTML = '';
  Object.keys(units[currentConverterType].rates).forEach(k => {
    s1.add(new Option(k, k));
    s2.add(new Option(k, k));
  });
}

function convertUnit() {
  const val = parseFloat(document.getElementById('convertInput').value);
  const from = document.getElementById('unitFrom').value;
  const to = document.getElementById('unitTo').value;
  if (isNaN(val)) return;
  const rate = units[currentConverterType].rates;
  const res = (val / rate[from]) * rate[to];
  document.getElementById('convertOutput').value = parseFloat(res.toFixed(4));
}

function clearConverterInputs() {
  document.getElementById('convertInput').value = "";
  document.getElementById('convertOutput').value = "";
}

/* BMI LOGIC */
/* --- BMI LOGIC --- */
function calculateBMI() {
  const weight = parseFloat(document.getElementById('bmiWeight').value);
  let heightCm = 0;

  const unitEl = document.getElementById('bmiHeightUnit');
  const unit = unitEl ? unitEl.value : 'cm';

  if (unit === 'cm') {
    heightCm = parseFloat(document.getElementById('bmiHeight').value);
  } else {
    const ft = parseFloat(document.getElementById('bmiFeet').value);
    const inch = parseFloat(document.getElementById('bmiInches').value);
    if (ft > 0 || inch >= 0) {
      heightCm = (ft * 30.48) + ((inch || 0) * 2.54);
    }
  }

  if (!weight || !heightCm || weight <= 0 || heightCm <= 0) {
    alert("Please enter valid positive numbers for weight and height.");
    return;
  }

  // BMI = Weight(kg) / (Height(m) * Height(m))
  const heightM = heightCm / 100;
  const bmi = weight / (heightM * heightM);
  const roundedBMI = bmi.toFixed(1);

  let category = "";
  let color = "";

  if (bmi < 18.5) {
    category = "Underweight";
    color = "#eab308"; // Yellow
  } else if (bmi < 25) {
    category = "Normal Weight";
    color = "#10b981"; // Green
  } else if (bmi < 30) {
    category = "Overweight";
    color = "#f97316"; // Orange
  } else {
    category = "Obese";
    color = "#ef4444"; // Red
  }

  const resultEl = document.getElementById('bmiResult');
  const catEl = document.getElementById('bmiCategory');

  resultEl.innerText = roundedBMI;
  resultEl.style.color = color;

  catEl.innerText = category;
  catEl.style.color = color;

  playClick();
}

function toggleBMIHeightUnit() {
  const unit = document.getElementById('bmiHeightUnit').value;
  const cmInput = document.getElementById('bmiHeight');
  const ftInInput = document.getElementById('bmiHeightFtIn');

  if (unit === 'cm') {
    cmInput.style.display = 'block';
    ftInInput.style.display = 'none';
  } else {
    cmInput.style.display = 'none';
    ftInInput.style.display = 'flex';
  }
  playClick();
}

function clearBMIInputs() {
  document.getElementById('bmiWeight').value = "";
  document.getElementById('bmiHeight').value = "";
  if (document.getElementById('bmiFeet')) document.getElementById('bmiFeet').value = "";
  if (document.getElementById('bmiInches')) document.getElementById('bmiInches').value = "";
  document.getElementById('bmiResult').innerText = "--";
  document.getElementById('bmiResult').style.color = "#10b981";
  document.getElementById('bmiCategory').innerText = "--";
  playClick();
}

/* --- KEYBOARD NAVIGATION & SHORTCUTS (Restored & Enhanced) --- */
document.addEventListener('keydown', function (e) {
  const key = e.key;

  /* 1. Global Tab Switching Shortcuts */
  if (e.ctrlKey) {
    if (key === '1') { showCalculator('standard'); e.preventDefault(); return; }
    if (key === '2') { showCalculator('cash'); e.preventDefault(); return; }
    if (key === '3') { showCalculator('loan'); e.preventDefault(); return; }
    if (key === '4') { showCalculator('cheque'); e.preventDefault(); return; } // New
    if (key === '5') { showCalculator('unit'); e.preventDefault(); return; }
    if (key === '6') { showCalculator('date'); e.preventDefault(); return; }
    if (key === '7') { showCalculator('bmi'); e.preventDefault(); return; }
  }

  /* 2. Determine Active Mode */
  const activeStandard = document.getElementById("standard").classList.contains("active");
  const activeCash = document.getElementById("cash").classList.contains("active");
  const activeLoan = document.getElementById("loan").classList.contains("active");
  const activeConvert = document.getElementById("convert").classList.contains("active"); // ID is convert
  const activeDate = document.getElementById("date").classList.contains("active");
  const activeBMI = document.getElementById("bmi").classList.contains("active");
  const activeCheque = document.getElementById("cheque").classList.contains("active");

  /* 3. STANDARD CALCULATOR HANDLER */
  if (activeStandard) {
    // Allow typing in other inputs (like GST select) without interference
    if ((e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') && e.target.id !== 'display') {
      return;
    }

    // Global capture for Standard Mode (Direct typing)
    if (!e.ctrlKey && ((key >= '0' && key <= '9') || ['+', '-', '*', '/', '.', '(', ')', '%'].includes(key))) {
      e.preventDefault();
      press(key);
    }
    else if (key === '^') { e.preventDefault(); press('^'); }
    else if (key === 'Enter' || key === '=') { e.preventDefault(); calculate(); }
    else if (key === 'Backspace') { e.preventDefault(); backspace(); }
    else if (key === 'Delete') { e.preventDefault(); clearDisplay(); }
    else if (e.ctrlKey) {
      if (key === 'm') { memoryRecall(); e.preventDefault(); }
      else if (key === '+') { memoryAdd(); e.preventDefault(); }
      else if (key === '-') { memorySubtract(); e.preventDefault(); }
    }
  }

  /* 4. CASH CALCULATOR HANDLER */
  if (activeCash) {
    // Global delete to clear all
    if (key === 'Delete') { e.preventDefault(); clearCashInputs(); }

    // Arrow Key Navigation (Fix for user issue: count changing)
    if (e.target.tagName === 'INPUT' && e.target.closest('.cash-row')) {
      const currentRow = e.target.closest('.cash-row');
      if (key === 'ArrowUp') {
        e.preventDefault(); // STOP number increment
        const prevRow = currentRow.previousElementSibling;
        if (prevRow && prevRow.querySelector('input')) {
          prevRow.querySelector('input').focus();
        }
      } else if (key === 'ArrowDown') {
        e.preventDefault(); // STOP number decrement
        const nextRow = currentRow.nextElementSibling;
        if (nextRow && nextRow.querySelector('input')) {
          nextRow.querySelector('input').focus();
        }
      }
    }
  }

  /* 5. OTHER MODES Handlers */
  if (activeLoan && key === 'Delete') { e.preventDefault(); clearLoanInputs(); }
  if (activeConvert && key === 'Delete') { e.preventDefault(); clearConverterInputs(); }
  if (activeDate && key === 'Delete') { e.preventDefault(); document.getElementById('dob').value = ""; document.getElementById('date1').value = ""; document.getElementById('date2').value = ""; }
  if (activeBMI && key === 'Delete') { e.preventDefault(); clearBMIInputs(); }
  if (activeCheque && key === 'Delete') { e.preventDefault(); clearChequeInput(); }
});
