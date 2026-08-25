const YEAR_MS = 365.25 * 24 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;

let activeIntervals = [];

function partsUntil(targetISO){
  const target = new Date(targetISO + 'T23:59:59');
  const diff = target - new Date();
  const overdue = diff < 0;
  const abs = Math.abs(diff);
  const years = Math.floor(abs / YEAR_MS);
  let rem = abs - years * YEAR_MS;
  const days = Math.floor(rem / DAY_MS);
  rem -= days * DAY_MS;
  const hours = Math.floor(rem / 3600000);
  rem -= hours * 3600000;
  const minutes = Math.floor(rem / 60000);
  rem -= minutes * 60000;
  const seconds = Math.floor(rem / 1000);
  return { overdue, years, days, hours, minutes, seconds };
}

function render(p){
  const bits = [];
  if(p.years) bits.push(`${p.years}<span class="unit">y</span>`);
  if(p.years || p.days) bits.push(`${p.days}<span class="unit">d</span>`);
  bits.push(`${String(p.hours).padStart(2,'0')}<span class="unit">h</span>`);
  bits.push(`${String(p.minutes).padStart(2,'0')}<span class="unit">m</span>`);
  bits.push(`${String(p.seconds).padStart(2,'0')}<span class="unit">s</span>`);
  return bits.join(' ');
}

/** Stop every running countdown timer (call before re-rendering a list). */
export function clearCountdowns(){
  activeIntervals.forEach(clearInterval);
  activeIntervals = [];
}

/**
 * Mounts a live countdown chip into `container` for the given deadline (YYYY-MM-DD).
 * Returns the chip element (already appended to the container).
 */
export function mountCountdown(container, deadlineISO){
  const chip = document.createElement('span');
  chip.className = 'countdown-chip';
  container.appendChild(chip);

  function tick(){
    const p = partsUntil(deadlineISO);
    chip.classList.toggle('overdue', p.overdue);
    chip.innerHTML = (p.overdue ? '<i data-lucide="alarm-clock" class="ic"></i> overdue by ' : '<i data-lucide="alarm-clock" class="ic"></i> ') + render(p);
    if(window.lucide) lucide.createIcons();
  }
  tick();
  const id = setInterval(tick, 1000);
  activeIntervals.push(id);
  return chip;
}
