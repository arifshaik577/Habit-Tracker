// State
let habits = JSON.parse(localStorage.getItem('habits_data')) || [
  { id: '1', title: 'Drink 2L Water', category: 'Health', history: {} },
  { id: '2', title: 'Read 20 Mins', category: 'Mindset', history: {} }
];

let dailyPieChartInstance = null;
let monthlyPieChartInstance = null;

// Helper: Get past N days as YYYY-MM-DD
function getDaysList(count = 7) {
  const days = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

const weekDates = getDaysList(7);
const monthDates = getDaysList(30);

// Month History State
const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
let selectedYear = new Date().getFullYear();
let selectedMonth = new Date().getMonth();

// Save state to localStorage and re-render all views
function saveHabits() {
  localStorage.setItem('habits_data', JSON.stringify(habits));
  render();
  renderCharts();
  renderMonthCalendar();
}

// Built-in Web Audio API sound generator
function playTone(type = 'check') {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();

    if (type === 'check') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'complete') {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.08);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.35);
        o.start(ctx.currentTime + idx * 0.08);
        o.stop(ctx.currentTime + idx * 0.08 + 0.35);
      });
    }
  } catch {
    // Audio context fallback
  }
}

// Celebration burst
function fireConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 90,
      spread: 75,
      origin: { y: 0.6 }
    });
  }
}

// Calculate streak
function calculateStreak(history) {
  let streak = 0;
  const d = new Date();
  
  while (true) {
    const key = d.toISOString().split('T')[0];
    if (history[key]) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// Toggle habit completion
function toggleHabit(habitId, dateStr) {
  const habit = habits.find(h => h.id === habitId);
  if (!habit) return;

  const todayStr = weekDates[weekDates.length - 1];

  if (habit.history[dateStr]) {
    delete habit.history[dateStr];
  } else {
    habit.history[dateStr] = true;
    playTone('check');
  }

  saveHabits();

  // Trigger celebration on 100% daily completion
  if (dateStr === todayStr && habits.length > 0) {
    const completedToday = habits.filter(h => h.history[todayStr]).length;
    if (completedToday === habits.length) {
      setTimeout(() => {
        playTone('complete');
        fireConfetti();
      }, 150);
    }
  }
}

// Delete habit
function deleteHabit(habitId) {
  habits = habits.filter(h => h.id !== habitId);
  saveHabits();
}

// Render Table
function render() {
  const habitsContainer = document.getElementById('habitsContainer');
  const weekHeaderLabels = document.getElementById('weekHeaderLabels');
  const activeHabitsCount = document.getElementById('activeHabitsCount');
  const completionRate = document.getElementById('completionRate');

  // Days Headers
  weekHeaderLabels.innerHTML = weekDates.map(d => {
    const dateObj = new Date(d + 'T00:00:00');
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'narrow' });
    const dayNum = dateObj.getDate();
    return `<div class="day-header"><span>${dayName}</span><strong>${dayNum}</strong></div>`;
  }).join('');

  // Habits rows
  if (habits.length === 0) {
    habitsContainer.innerHTML = `<div class="empty-state">No habits added yet. Start by adding one above!</div>`;
  } else {
    habitsContainer.innerHTML = habits.map(habit => {
      const currentStreak = calculateStreak(habit.history);
      const daysBoxes = weekDates.map(dateStr => {
        const isDone = !!habit.history[dateStr];
        return `
          <div 
            class="check-box ${isDone ? 'completed' : ''}" 
            onclick="toggleHabit('${habit.id}', '${dateStr}')"
          >
            ${isDone ? '✓' : ''}
          </div>
        `;
      }).join('');

      return `
        <div class="habit-row">
          <div class="habit-info-col">
            <h4>${habit.title}</h4>
            <span class="streak-tag">🔥 ${currentStreak} day streak</span>
          </div>
          <div class="days-grid">${daysBoxes}</div>
          <div class="col-actions">
            <button class="btn-del" onclick="deleteHabit('${habit.id}')" title="Delete">✕</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // Header stats
  activeHabitsCount.textContent = habits.length;
  const todayStr = weekDates[weekDates.length - 1];
  if (habits.length > 0) {
    const completedToday = habits.filter(h => h.history[todayStr]).length;
    completionRate.textContent = `${Math.round((completedToday / habits.length) * 100)}%`;
  } else {
    completionRate.textContent = '0%';
  }
}

// Render Daily & Monthly Percentage Doughnut Charts
function renderCharts() {
  if (typeof Chart === 'undefined') return;

  const todayStr = weekDates[weekDates.length - 1];

  // 1. Daily Progress
  const totalDaily = habits.length;
  const completedDaily = habits.filter(h => h.history[todayStr]).length;
  const dailyPercent = totalDaily > 0 ? Math.round((completedDaily / totalDaily) * 100) : 0;
  const dailyRemaining = Math.max(0, totalDaily - completedDaily);

  const dailyTextEl = document.getElementById('dailyPercentText');
  if (dailyTextEl) dailyTextEl.textContent = `${dailyPercent}%`;

  const dailyCtx = document.getElementById('dailyPieChart').getContext('2d');
  if (dailyPieChartInstance) dailyPieChartInstance.destroy();

  dailyPieChartInstance = new Chart(dailyCtx, {
    type: 'doughnut',
    data: {
      labels: ['Completed', 'Remaining'],
      datasets: [{
        data: totalDaily === 0 ? [0, 1] : [completedDaily, dailyRemaining],
        backgroundColor: ['#10b981', '#1e293b'],
        borderWidth: 0,
        cutout: '76%'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.raw} (${totalDaily > 0 ? Math.round((ctx.raw / totalDaily) * 100) : 0}%)`
          }
        }
      }
    }
  });

  // 2. Monthly Progress (Past 30 Days)
  const totalPossibleMonthly = habits.length * monthDates.length;
  let completedMonthly = 0;
  monthDates.forEach(dateStr => {
    habits.forEach(h => {
      if (h.history[dateStr]) completedMonthly++;
    });
  });

  const monthlyPercent = totalPossibleMonthly > 0 
    ? Math.round((completedMonthly / totalPossibleMonthly) * 100) 
    : 0;
  const monthlyRemaining = Math.max(0, totalPossibleMonthly - completedMonthly);

  const monthlyTextEl = document.getElementById('monthlyPercentText');
  if (monthlyTextEl) monthlyTextEl.textContent = `${monthlyPercent}%`;

  const monthlyCtx = document.getElementById('monthlyPieChart').getContext('2d');
  if (monthlyPieChartInstance) monthlyPieChartInstance.destroy();

  monthlyPieChartInstance = new Chart(monthlyCtx, {
    type: 'doughnut',
    data: {
      labels: ['Completed', 'Missed'],
      datasets: [{
        data: totalPossibleMonthly === 0 ? [0, 1] : [completedMonthly, monthlyRemaining],
        backgroundColor: ['#38bdf8', '#1e293b'],
        borderWidth: 0,
        cutout: '76%'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.raw} (${totalPossibleMonthly > 0 ? Math.round((ctx.raw / totalPossibleMonthly) * 100) : 0}%)`
          }
        }
      }
    }
  });
}

// Initialize Year and Month dropdowns
function initHistorySelectors() {
  const yearSelect = document.getElementById('historyYearSelect');
  const monthSelect = document.getElementById('historyMonthSelect');
  if (!yearSelect || !monthSelect) return;

  const currentYear = new Date().getFullYear();
  yearSelect.innerHTML = '';
  for (let y = currentYear - 1; y <= currentYear + 1; y++) {
    yearSelect.innerHTML += `<option value="${y}" ${y === selectedYear ? 'selected' : ''}>${y}</option>`;
  }

  monthSelect.innerHTML = monthNames.map((name, idx) => {
    return `<option value="${idx}" ${idx === selectedMonth ? 'selected' : ''}>${name}</option>`;
  }).join('');

  yearSelect.addEventListener('change', (e) => {
    selectedYear = parseInt(e.target.value);
    renderMonthCalendar();
  });

  monthSelect.addEventListener('change', (e) => {
    selectedMonth = parseInt(e.target.value);
    renderMonthCalendar();
  });
}

// Render Month Calendar Heatmap
function renderMonthCalendar() {
  const calendarGrid = document.getElementById('calendarGrid');
  const completionsCountEl = document.getElementById('monthCompletionsCount');
  const successRateEl = document.getElementById('monthSuccessRate');
  const activeDaysEl = document.getElementById('monthActiveDays');
  if (!calendarGrid) return;

  const firstDayIndex = new Date(selectedYear, selectedMonth, 1).getDay();
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

  let totalMonthCompletions = 0;
  let daysWithCompletions = 0;
  let cellsHTML = '';

  for (let i = 0; i < firstDayIndex; i++) {
    cellsHTML += `<div class="cal-cell empty"></div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const formattedMonth = String(selectedMonth + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    const dateStr = `${selectedYear}-${formattedMonth}-${formattedDay}`;

    let completedOnDay = 0;
    habits.forEach(h => {
      if (h.history && h.history[dateStr]) completedOnDay++;
    });

    totalMonthCompletions += completedOnDay;
    if (completedOnDay > 0) daysWithCompletions++;

    let intensityClass = '';
    if (habits.length > 0 && completedOnDay > 0) {
      const ratio = completedOnDay / habits.length;
      if (ratio === 1) intensityClass = 'intensity-high';
      else if (ratio >= 0.5) intensityClass = 'intensity-med';
      else intensityClass = 'intensity-low';
    }

    cellsHTML += `
      <div class="cal-cell ${intensityClass}" title="${dateStr}: ${completedOnDay} completed">
        <strong>${day}</strong>
        ${completedOnDay > 0 ? `<span class="cal-dots">✓ ${completedOnDay}</span>` : ''}
      </div>
    `;
  }

  calendarGrid.innerHTML = cellsHTML;
  completionsCountEl.textContent = totalMonthCompletions;
  activeDaysEl.textContent = `${daysWithCompletions}/${daysInMonth}`;

  const totalPossible = habits.length * daysInMonth;
  const rate = totalPossible > 0 ? Math.round((totalMonthCompletions / totalPossible) * 100) : 0;
  successRateEl.textContent = `${rate}%`;
}

// Habit Submission Form Handler
document.getElementById('habitForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('habitInput');
  const category = document.getElementById('habitCategory').value;
  const title = input.value.trim();
  if (!title) return;

  habits.push({
    id: Date.now().toString(),
    title,
    category,
    history: {}
  });

  saveHabits();
  input.value = '';
});

// App Initialization
render();
renderCharts();
initHistorySelectors();
renderMonthCalendar();