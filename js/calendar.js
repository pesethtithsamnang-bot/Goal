// Progressive-enhancement date picker.
// It keeps the ORIGINAL <input type="date"> in the DOM (hidden) so every other
// module can keep reading/writing `.value` exactly like before — this file
// just gives it a nicer face and fires a native 'change' event when a day is picked.

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW = ['S','M','T','W','T','F','S'];
const YEAR_MIN = new Date().getFullYear() - 80;
const YEAR_MAX = new Date().getFullYear() + 50;

function pad(n){ return String(n).padStart(2,'0'); }
function toISO(y,m,d){ return `${y}-${pad(m+1)}-${pad(d)}`; }
function fmtLabel(iso){
  if(!iso) return null;
  const [y,m,d] = iso.split('-').map(Number);
  return new Date(y, m-1, d).toLocaleDateString(undefined,{month:'short', day:'numeric', year:'numeric'});
}

let openPop = null;
function closeOpenPop(){
  if(openPop){
    openPop.pop.classList.remove('open');
    openPop.btn.classList.remove('open');
    if(openPop.reposition){
      window.removeEventListener('scroll', openPop.reposition, true);
      window.removeEventListener('resize', openPop.reposition);
    }
    if(openPop.pop.parentNode) openPop.pop.parentNode.removeChild(openPop.pop);
    openPop = null;
  }
}
document.addEventListener('click', (e) => {
  const path = e.composedPath();
  if (openPop && !path.includes(openPop.wrap) && !path.includes(openPop.pop)) {
    closeOpenPop();
  }
});
document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') closeOpenPop(); });

function positionPop(pop, btn){
  const r = btn.getBoundingClientRect();
  const popW = pop.offsetWidth || 360;
  let left = r.left;
  if(left + popW > window.innerWidth - 12) left = window.innerWidth - popW - 12;
  if(left < 12) left = 12;
  let top = r.bottom + 6;
  const popH = pop.offsetHeight || 380;
  if(top + popH > window.innerHeight - 12) top = Math.max(12, r.top - popH - 6);
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
}

function buildPopover(input, wrap, btn){
  const pop = document.createElement('div');
  pop.className = 'date-picker-pop';
  document.body.appendChild(pop);

  let viewDate = input.value ? new Date(input.value + 'T00:00:00') : new Date();
  let viewY = viewDate.getFullYear(), viewM = viewDate.getMonth();

  function render(){
    const todayISOStr = toISO(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    const first = new Date(viewY, viewM, 1);
    const startOffset = first.getDay();
    const daysInMonth = new Date(viewY, viewM+1, 0).getDate();
    const daysInPrev = new Date(viewY, viewM, 0).getDate();

    let cells = '';
    for(let i=startOffset-1;i>=0;i--) cells += `<div class="dp-day other">${daysInPrev-i}</div>`;
    for(let d=1; d<=daysInMonth; d++){
      const iso = toISO(viewY, viewM, d);
      const cls = ['dp-day'];
      if(iso === todayISOStr) cls.push('today');
      if(iso === input.value) cls.push('selected');
      cells += `<div class="${cls.join(' ')}" data-iso="${iso}">${d}</div>`;
    }
    const total = startOffset + daysInMonth;
    const trailing = (7 - (total % 7)) % 7;
    for(let d=1; d<=trailing; d++) cells += `<div class="dp-day other">${d}</div>`;

    const monthOpts = MONTH_NAMES.map((name,i)=>
      `<div class="dp-dd-item${i===viewM?' selected':''}" data-val="${i}">${name}</div>`).join('');
    let yearOpts = '';
    for(let y=YEAR_MAX; y>=YEAR_MIN; y--) yearOpts += `<div class="dp-dd-item${y===viewY?' selected':''}" data-val="${y}">${y}</div>`;

    pop.innerHTML = `
      <div class="dp-head">
        <button type="button" data-nav="-1" aria-label="Previous month">‹</button>
        <div class="dp-title">
          <div class="dp-dropdown" data-type="month">
            <button type="button" class="dp-dd-btn">${MONTH_NAMES[viewM]}<i data-lucide="chevron-down" class="ic"></i></button>
            <div class="dp-dd-list">${monthOpts}</div>
          </div>
          <div class="dp-dropdown" data-type="year">
            <button type="button" class="dp-dd-btn">${viewY}<i data-lucide="chevron-down" class="ic"></i></button>
            <div class="dp-dd-list">${yearOpts}</div>
          </div>
        </div>
        <button type="button" data-nav="1" aria-label="Next month">›</button>
      </div>
      <div class="dp-grid">${DOW.map(d=>`<div class="dp-dow">${d}</div>`).join('')}${cells}</div>
      <div class="dp-foot">
        <button type="button" data-action="today">Today</button>
        <button type="button" data-action="clear">Clear</button>
      </div>`;
    if(window.lucide) lucide.createIcons();
  }
  render();

  function closeDropdowns(){
    pop.querySelectorAll('.dp-dropdown.open').forEach(d=>d.classList.remove('open'));
  }

  pop.addEventListener('click', (e)=>{
    const ddBtn = e.target.closest('.dp-dd-btn');
    const ddItem = e.target.closest('.dp-dd-item');
    const nav = e.target.closest('[data-nav]');
    const day = e.target.closest('.dp-day[data-iso]');
    const action = e.target.closest('[data-action]');

    if(ddBtn){
      const dropdown = ddBtn.closest('.dp-dropdown');
      const wasOpen = dropdown.classList.contains('open');
      closeDropdowns();
      if(!wasOpen){
        dropdown.classList.add('open');
        const sel = dropdown.querySelector('.dp-dd-item.selected');
        if(sel) sel.scrollIntoView({block:'center'});
      }
    } else if(ddItem){
      const dropdown = ddItem.closest('.dp-dropdown');
      const val = parseInt(ddItem.dataset.val, 10);
      if(dropdown.dataset.type === 'month') viewM = val; else viewY = val;
      render();
    } else if(nav){
      viewM += parseInt(nav.dataset.nav,10);
      if(viewM < 0){ viewM = 11; viewY--; } else if(viewM > 11){ viewM = 0; viewY++; }
      render();
    } else if(day){
      setValue(day.dataset.iso);
      closeOpenPop();
    } else if(action){
      if(action.dataset.action === 'today') setValue(toISO(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));
      if(action.dataset.action === 'clear') setValue('');
      closeOpenPop();
    }
  });



  function setValue(iso){
    input.value = iso;
    input.dispatchEvent(new Event('change', {bubbles:true}));
    syncButton(input, btn);
  }

  return {
    pop,
    open(){
      if(!pop.parentNode) document.body.appendChild(pop);
      const d = input.value ? new Date(input.value+'T00:00:00') : new Date();
      viewY = d.getFullYear(); viewM = d.getMonth();
      render();
      pop.classList.add('open');
      positionPop(pop, btn);
      const reposition = ()=>positionPop(pop, btn);
      window.addEventListener('scroll', reposition, true);
      window.addEventListener('resize', reposition);
      return reposition;
    }
  };
}

function syncButton(input, btn){
  const label = fmtLabel(input.value);
  btn.innerHTML = label
    ? `<span>${label}</span><i data-lucide="calendar" class="ic"></i>`
    : `<span class="ph">${btn.dataset.placeholder || 'Select date'}</span><i data-lucide="calendar" class="ic"></i>`;
  if(window.lucide) lucide.createIcons();
}

/** Turns every input[type=date] under `root` into a custom calendar picker. */
export function enhanceDateInputs(root = document){
  root.querySelectorAll('input[type="date"]:not([data-enhanced])').forEach(input => {
    input.dataset.enhanced = '1';
    input.style.display = 'none';

    const wrap = document.createElement('div');
    wrap.className = 'date-picker-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'date-picker-btn';
    btn.dataset.placeholder = input.placeholder || 'Select date';
    wrap.appendChild(btn);

    const { open, pop } = buildPopover(input, wrap, btn);
    syncButton(input, btn);

    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const wasOpen = btn.classList.contains('open');
      closeOpenPop();
      if(!wasOpen){
        const reposition = open();
        btn.classList.add('open');
        openPop = { wrap, btn, pop, reposition };
      }
    });

    // keep the button label correct if code elsewhere sets input.value programmatically
    input.addEventListener('change', ()=>syncButton(input, btn));
    input._syncDateButton = ()=>syncButton(input, btn);
  });
}

/** Call after setting input.value from JS (e.g. when opening an edit modal). */
export function refreshDateButton(input){
  if(input && input._syncDateButton) input._syncDateButton();
}
