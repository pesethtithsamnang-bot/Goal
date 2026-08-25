import { sb } from './supabaseClient.js';
import { $, escapeHtml, fmtDate, showToast, armDelete, refreshIcons } from './utils.js';
import { refreshDateButton } from './calendar.js';

let schedules = [];
let editingSchedId = null;

export async function loadSchedules(){
  const { data } = await sb.from('schedules').select('*').order('start_date', { ascending: true, nullsFirst: false });
  schedules = data || [];
  renderSchedules();
}

function fmtTime(t){
  if(!t) return '';
  const [h, m] = t.split(':').map(Number);
  const d = new Date(); d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function isMultiDay(s){
  return s.end_date && s.start_date && s.end_date !== s.start_date;
}

function isOverdue(s){
  const end = s.end_date || s.start_date;
  if(!end) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  return new Date(end + 'T00:00:00') < today;
}

function renderSchedules(){
  const list = $('schedList'); list.innerHTML = '';
  $('schedEmpty').classList.toggle('hidden', schedules.length > 0);

  schedules.slice()
    .sort((a,b)=> new Date(a.start_date || '9999-12-31') - new Date(b.start_date || '9999-12-31'))
    .forEach(s=>{
      const overdue = isOverdue(s);
      const dateText = s.start_date
        ? (isMultiDay(s) ? `${fmtDate(s.start_date)} → ${fmtDate(s.end_date)}` : fmtDate(s.start_date))
        : 'No date set';
      const timeText = (s.start_time || s.end_time)
        ? `${s.start_time ? fmtTime(s.start_time) : '?'}${s.end_time ? ' – ' + fmtTime(s.end_time) : ''}`
        : '';

      const el = document.createElement('div');
      el.className = 'sched-card' + (overdue ? ' overdue' : '');
      el.innerHTML = `
        <div class="sched-info">
          <div class="goal-top">
            ${s.app_name ? `<span class="badge link">${escapeHtml(s.app_name)}</span>` : ''}
            ${isMultiDay(s) ? `<span class="badge long">Range</span>` : ''}
          </div>
          <div class="goal-title" style="font-size:16px;">${escapeHtml(s.title)}</div>
          <div class="sched-next"><i data-lucide="calendar-range" class="ic"></i> ${dateText}</div>
          ${timeText ? `<div class="sched-time"><i data-lucide="clock" class="ic"></i> ${timeText}</div>` : ''}
          ${s.notes ? `<div class="sched-time">${escapeHtml(s.notes)}</div>` : ''}
        </div>
        <div class="item-actions" style="flex-direction:column;">
          <button class="btn btn-blue btn-sm sEdit" data-id="${s.id}">Edit</button>
          <button class="btn btn-red btn-sm sDelete" data-id="${s.id}">Delete</button>
        </div>`;
      list.appendChild(el);
    });
  refreshIcons();
}

export function initSchedule(){
  $('schedList').addEventListener('click', (e)=>{
    const delBtn = e.target.closest('.sDelete');
    const editBtn = e.target.closest('.sEdit');
    if(editBtn){ openSchedModal(editBtn.dataset.id); return; }
    if(!delBtn) return;
    armDelete(delBtn.dataset.id, delBtn, async ()=>{
      await sb.from('schedules').delete().eq('id', delBtn.dataset.id);
      showToast('Schedule item deleted');
      await loadSchedules();
    });
  });

  $('sCancelBtn').addEventListener('click', ()=> $('schedModalOverlay').classList.remove('open'));
  $('schedModalOverlay').addEventListener('click', (e)=>{ if(e.target.id === 'schedModalOverlay') $('schedModalOverlay').classList.remove('open'); });

  $('sSaveBtn').addEventListener('click', async ()=>{
    const title = $('sTitle').value.trim();
    let valid = true;
    if(!title){ $('sErrTitle').classList.remove('hidden'); valid = false; } else $('sErrTitle').classList.add('hidden');
    const start = $('sStartDate').value || null;
    const end = $('sEndDate').value || null;
    if(start && end && end < start){ $('sErrDate').classList.remove('hidden'); valid = false; } else $('sErrDate').classList.add('hidden');
    if(!valid) return;

    const payload = {
      title,
      start_date: start,
      end_date: end,
      start_time: $('sStartTime').value || null,
      end_time: $('sEndTime').value || null,
      app_name: $('sAppName').value.trim() || null,
      notes: $('sNotes').value.trim() || null
    };

    if(editingSchedId){
      await sb.from('schedules').update(payload).eq('id', editingSchedId);
      showToast('Schedule item updated');
    } else {
      const sessionRes = await sb.auth.getSession();
      payload.user_id = sessionRes.data.session.user.id;
      await sb.from('schedules').insert(payload);
      showToast('Schedule item added');
    }
    $('schedModalOverlay').classList.remove('open');
    await loadSchedules();
  });
}

export function openSchedModal(id){
  editingSchedId = id || null;
  $('sErrTitle').classList.add('hidden'); $('sErrDate').classList.add('hidden');

  if(id){
    const s = schedules.find(x => x.id === id);
    $('schedModalHeading').textContent = 'Edit schedule item';
    $('sTitle').value = s.title;
    $('sAppName').value = s.app_name || '';
    $('sStartDate').value = s.start_date || ''; refreshDateButton($('sStartDate'));
    $('sEndDate').value = s.end_date || ''; refreshDateButton($('sEndDate'));
    $('sStartTime').value = s.start_time ? s.start_time.slice(0,5) : '';
    $('sEndTime').value = s.end_time ? s.end_time.slice(0,5) : '';
    $('sNotes').value = s.notes || '';
  } else {
    $('schedModalHeading').textContent = 'New schedule item';
    $('sTitle').value = ''; $('sAppName').value = '';
    $('sStartDate').value = new Date().toISOString().slice(0,10); refreshDateButton($('sStartDate'));
    $('sEndDate').value = ''; refreshDateButton($('sEndDate'));
    $('sStartTime').value = ''; $('sEndTime').value = ''; $('sNotes').value = '';
  }
  $('schedModalOverlay').classList.add('open');
  setTimeout(()=>$('sTitle').focus(), 50);
}
