export const $ = (id) => document.getElementById(id);

let toastTimer = null;
export function showToast(msg){
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>el.classList.remove('show'), 2200);
}

export function escapeHtml(str){
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

export function fmtDate(d){
  if(!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  if(isNaN(dt)) return d;
  return dt.toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'});
}

export function todayISO(){
  return new Date().toISOString().slice(0,10);
}

// Arm/confirm delete pattern shared by every "Delete" button in the app.
const armed = {};
export function armDelete(id, btn, onConfirm, label='Delete'){
  if(armed[id]){
    clearTimeout(armed[id]);
    delete armed[id];
    onConfirm();
  } else {
    const original = btn.innerHTML;
    btn.textContent = 'Confirm?';
    armed[id] = setTimeout(()=>{ btn.innerHTML = original; delete armed[id]; }, 2500);
  }
}

export function refreshIcons(){
  if(window.lucide) lucide.createIcons();
}
