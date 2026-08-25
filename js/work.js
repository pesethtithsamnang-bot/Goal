import { sb } from './supabaseClient.js';
import { $, escapeHtml, showToast } from './utils.js';

let sessions = [];
let timerInterval = null;

export async function loadSessions(){
  const { data } = await sb.from('work_sessions').select('*').order('start_time', { ascending: false });
  sessions = data || [];
  renderWork();
}

function activeSession(){ return sessions.find(s => !s.end_time); }

function fmtDur(ms){
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

function renderWork(){
  const active = activeSession();
  $('nowWorkingBlock').classList.toggle('hidden', !active);
  $('startWorkBlock').classList.toggle('hidden', !!active);
  if(active){
    $('nowJobName').textContent = active.job_name;
    $('nowSince').textContent = 'Since ' + new Date(active.start_time).toLocaleString();
  }
  const list = $('sessionList'); list.innerHTML = '';
  const past = sessions.filter(s => s.end_time);
  $('sessionEmpty').classList.toggle('hidden', past.length > 0 || !!active);
  past.forEach(s=>{
    const dur = new Date(s.end_time) - new Date(s.start_time);
    const el = document.createElement('div');
    el.className = 'session-card';
    el.innerHTML = `
      <div>
        <div class="session-job">${escapeHtml(s.job_name)}</div>
        <div class="session-time">${new Date(s.start_time).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})} → ${new Date(s.end_time).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}</div>
        ${s.notes ? `<div class="session-notes">${escapeHtml(s.notes)}</div>` : ''}
      </div>
      <div class="session-dur">${fmtDur(dur)}</div>`;
    list.appendChild(el);
  });
}

function startTimerLoop(){
  clearInterval(timerInterval);
  timerInterval = setInterval(()=>{
    const active = activeSession();
    if(active) $('nowTimer').textContent = fmtDur(new Date() - new Date(active.start_time));
  }, 1000);
}
export function stopTimerLoop(){ clearInterval(timerInterval); }

export function initWork(){
  $('startWorkBtn').addEventListener('click', async ()=>{
    const job = $('newJobInput').value.trim();
    if(!job){ showToast("Enter what you're starting"); return; }
    const sessionRes = await sb.auth.getSession();
    const active = activeSession();
    if(active) await sb.from('work_sessions').update({ end_time: new Date().toISOString() }).eq('id', active.id);
    await sb.from('work_sessions').insert({ job_name: job, user_id: sessionRes.data.session.user.id });
    $('newJobInput').value = '';
    showToast('Started: ' + job);
    await loadSessions();
  });

  $('stopWorkBtn').addEventListener('click', async ()=>{
    const active = activeSession();
    if(!active) return;
    const notes = prompt('Add a note about this session? (optional)') || null;
    await sb.from('work_sessions').update({ end_time: new Date().toISOString(), notes }).eq('id', active.id);
    showToast('Stopped work');
    await loadSessions();
  });

  startTimerLoop();
}
