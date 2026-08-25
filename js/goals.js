import { sb } from './supabaseClient.js';
import { $, escapeHtml, fmtDate, showToast, armDelete, refreshIcons } from './utils.js';
import { enhanceDateInputs, refreshDateButton } from './calendar.js';
import { mountCountdown, clearCountdowns } from './countdown.js';

let goals = [];
let goalDocs = [];
let financeEntries = []; // needed to compute "$ saved toward this goal"
let goalTab = 'active';
let editingGoalId = null;
let goalFormType = 'short';

export function getGoals(){ return goals; }

export async function loadGoals(){
  const { data } = await sb.from('goals').select('*').order('created_at', { ascending: false });
  goals = data || [];
  renderGoals();
}
export async function loadGoalDocs(){
  const { data } = await sb.from('goal_documents').select('*');
  goalDocs = data || [];
  renderGoals();
}
// called by finance.js whenever entries reload, so savings progress stays accurate
export function setFinanceEntriesRef(entries){
  financeEntries = entries;
  renderGoals();
}

function isOverdue(g){
  if(g.completed || !g.deadline) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  return new Date(g.deadline + 'T00:00:00') < today;
}

async function recalcParentProgress(parentId){
  if(!parentId) return;
  const children = goals.filter(g => g.parent_goal_id === parentId);
  if(children.length === 0) return;
  const avg = Math.round(children.reduce((s,c)=> s + (c.completed ? 100 : c.progress), 0) / children.length);
  const parent = goals.find(g => g.id === parentId);
  if(!parent) return;
  await sb.from('goals').update({
    progress: avg, completed: avg >= 100,
    completed_at: avg >= 100 ? (parent.completed_at || new Date().toISOString()) : null
  }).eq('id', parentId);
}

function savedTowardGoal(goalId){
  return financeEntries
    .filter(f => f.goal_id === goalId && f.type === 'income')
    .reduce((sum, f) => sum + parseFloat(f.amount), 0);
}

function renderGoals(){
  let list = goals.slice();
  if(goalTab === 'active') list = list.filter(g => !g.completed);
  else if(goalTab === 'short') list = list.filter(g => g.type === 'short' && !g.completed);
  else if(goalTab === 'long') list = list.filter(g => g.type === 'long' && !g.completed);
  else if(goalTab === 'completed') list = list.filter(g => g.completed);

  list.sort((a,b)=>{
    if(goalTab === 'completed') return new Date(b.completed_at||0) - new Date(a.completed_at||0);
    const ao = isOverdue(a), bo = isOverdue(b);
    if(ao !== bo) return ao ? -1 : 1;
    if(!a.deadline) return 1; if(!b.deadline) return -1;
    return new Date(a.deadline) - new Date(b.deadline);
  });

  clearCountdowns();
  const grid = $('goalGrid');
  grid.innerHTML = '';
  $('goalEmpty').classList.toggle('hidden', list.length > 0);
  list.forEach(g => grid.appendChild(goalCard(g)));
  refreshIcons();
}

function goalCard(g){
  const card = document.createElement('div');
  const overdue = isOverdue(g);
  card.className = 'goal-card' + (g.completed ? ' completed' : '') + (overdue ? ' overdue' : '');

  let dateInfo = '';
  if(g.completed){
    dateInfo = `<span class="icon-inline"><i data-lucide="flag" class="ic"></i>Done ${g.completed_at ? fmtDate(g.completed_at.slice(0,10)) : ''}</span>`;
  }

  // parent (this goal is linked TO a long-term goal)
  let linkNote = '';
  if(g.type === 'short' && g.parent_goal_id){
    const parent = goals.find(p => p.id === g.parent_goal_id);
    if(parent) linkNote = `<div class="goal-link-note"><i data-lucide="link-2" class="ic"></i>Part of "${escapeHtml(parent.title)}"</div>`;
  }

  // children (this long-term goal has short-term goals feeding into it)
  let childrenHTML = '';
  if(g.type === 'long'){
    const children = goals.filter(c => c.parent_goal_id === g.id);
    if(children.length){
      childrenHTML = `<div class="goal-children">${children.map(c=>
        `<div class="goal-child-row ${c.completed?'done':''}"><i data-lucide="${c.completed?'check-circle-2':'circle'}" class="ic"></i>${escapeHtml(c.title)} — ${c.completed?'100':c.progress}%</div>`
      ).join('')}</div>`;
    }
  }

  // savings target (this long-term goal tracks $ saved via linked finance entries)
  let savingsHTML = '';
  let progressOverride = null;
  if(g.type === 'long' && g.target_amount){
    const saved = savedTowardGoal(g.id);
    const pct = Math.min(100, Math.round((saved / g.target_amount) * 100));
    progressOverride = pct;
    savingsHTML = `<div class="goal-notes"><i data-lucide="piggy-bank" class="ic"></i> $${saved.toFixed(2)} saved of $${parseFloat(g.target_amount).toFixed(2)} target</div>`;
  }
  const displayProgress = progressOverride !== null ? progressOverride : g.progress;

  const notesHTML = g.notes ? `<div class="goal-notes"><i data-lucide="sticky-note" class="ic"></i> ${escapeHtml(g.notes)}</div>` : '';

  let docsHTML = '';
  if(g.completed){
    const docs = goalDocs.filter(d => d.goal_id === g.id);
    const docItems = docs.map(d => `
      <div class="doc-item">
        <a href="#" class="doc-link gViewDoc" data-path="${d.file_path}"><i data-lucide="file-text" class="ic"></i> ${escapeHtml(d.file_name)}</a>
        <button class="btn btn-red btn-sm gDelDoc" data-id="${d.id}"><i data-lucide="trash-2" class="ic"></i></button>
      </div>`).join('');
    docsHTML = `
      <div class="docs-section">
        <h4>Attachments (${docs.length}/20)</h4>
        ${docItems}
        ${docs.length < 20 ? `
          <div style="margin-top:8px;">
            <input type="file" id="file-${g.id}" accept=".pdf, image/jpeg, image/png" style="display:none;" class="gFileInput" data-gid="${g.id}">
            <button class="btn btn-grey btn-sm btn-block gTriggerFile" data-gid="${g.id}"><i data-lucide="upload" class="ic"></i> Upload Proof</button>
          </div>` : ''}
      </div>`;
  }

  card.innerHTML = `
    ${g.completed ? '<div class="completed-check"><i data-lucide="check" class="ic"></i></div>' : ''}
    <div class="goal-top"><span class="badge ${g.type}">${g.type === 'short' ? 'Short-term' : 'Long-term'}</span></div>
    <h3 class="goal-title">${escapeHtml(g.title)}</h3>
    ${linkNote}
    <div class="goal-dates">
      <span class="icon-inline"><i data-lucide="calendar-range" class="ic"></i>${fmtDate(g.start_date)} → ${fmtDate(g.deadline)}</span>
      ${dateInfo}
    </div>
    ${g.deadline && !g.completed ? '<div class="countdown-slot"></div>' : ''}
    <div class="progress-outer"><div class="progress-inner" style="width:${displayProgress}%"></div></div>
    <span class="progress-pct">${displayProgress}%</span>
    ${(!g.completed && progressOverride === null) ? `<div class="progress-controls"><input type="range" min="0" max="100" value="${g.progress}" class="gSlider" data-id="${g.id}"></div>` : ''}
    ${savingsHTML}
    ${notesHTML}
    ${childrenHTML}
    ${docsHTML}
    <div class="goal-actions">
      ${!g.completed ? `<button class="btn btn-orange btn-sm gComplete" data-id="${g.id}">Mark complete</button>` : `<button class="btn btn-grey btn-sm gReopen" data-id="${g.id}">Reopen</button>`}
      <button class="btn btn-blue btn-sm gEdit" data-id="${g.id}">Edit</button>
      <button class="btn btn-red btn-sm gDelete" data-id="${g.id}">Delete</button>
    </div>`;

  if(g.deadline && !g.completed){
    mountCountdown(card.querySelector('.countdown-slot'), g.deadline);
  }
  return card;
}

function populateParentSelect(){
  const sel = $('gParentGoal');
  const longGoals = goals.filter(g => g.type === 'long' && !g.completed && g.id !== editingGoalId);
  sel.innerHTML = '<option value="">— None —</option>' + longGoals.map(g => `<option value="${g.id}">${escapeHtml(g.title)}</option>`).join('');
}

function updateModalFieldsForType(){
  $('gParentField').classList.toggle('hidden', goalFormType !== 'short');
  $('gTargetField').classList.toggle('hidden', goalFormType !== 'long');
}

export function initGoals(){
  document.querySelectorAll('[data-goaltab]').forEach(b=>{
    b.addEventListener('click', ()=>{
      document.querySelectorAll('[data-goaltab]').forEach(x=>x.classList.remove('active'));
      b.classList.add('active'); goalTab = b.dataset.goaltab; renderGoals();
    });
  });

  $('goalGrid').addEventListener('input', (e)=>{
    if(e.target.classList.contains('gSlider')){
      const g = goals.find(x => x.id === e.target.dataset.id);
      g.progress = parseInt(e.target.value, 10);
      const card = e.target.closest('.goal-card');
      card.querySelector('.progress-inner').style.width = g.progress + '%';
      card.querySelector('.progress-pct').textContent = g.progress + '%';
    }
  });

  $('goalGrid').addEventListener('change', async (e)=>{
    if(e.target.classList.contains('gSlider')){
      const g = goals.find(x => x.id === e.target.dataset.id);
      await sb.from('goals').update({ progress: g.progress }).eq('id', g.id);
      await recalcParentProgress(g.parent_goal_id);
      await loadGoals();
    }
    if(e.target.classList.contains('gFileInput')){
      const file = e.target.files[0];
      if(!file) return;
      const gid = e.target.dataset.gid;
      if(!['application/pdf','image/jpeg','image/png'].includes(file.type)){ showToast('Invalid file type'); return; }
      const docsCount = goalDocs.filter(d => d.goal_id === gid).length;
      if(docsCount >= 20){ showToast('Max 20 attachments allowed'); return; }
      const ext = file.name.split('.').pop();
      const sessionRes = await sb.auth.getSession();
      const uid = sessionRes.data.session.user.id;
      const filePath = `${uid}/${gid}/${Date.now()}.${ext}`;
      showToast('Uploading...');
      const { error: uploadError } = await sb.storage.from('goal-proofs').upload(filePath, file);
      if(uploadError){ showToast('Upload failed'); return; }
      await sb.from('goal_documents').insert({ user_id: uid, goal_id: gid, file_path: filePath, file_name: file.name, file_type: file.type });
      showToast('Uploaded successfully');
      await loadGoalDocs();
    }
  });

  $('goalGrid').addEventListener('click', async (e)=>{
    const btn = e.target.closest('button, a');
    if(!btn) return;

    if(btn.classList.contains('gTriggerFile')){
      document.getElementById(`file-${btn.dataset.gid}`)?.click();
    } else if(btn.classList.contains('gViewDoc')){
      e.preventDefault();
      const { data, error } = await sb.storage.from('goal-proofs').createSignedUrl(btn.dataset.path, 60);
      if(!error && data) window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } else if(btn.classList.contains('gDelDoc')){
      armDelete('doc-'+btn.dataset.id, btn, async ()=>{
        const doc = goalDocs.find(d => d.id === btn.dataset.id);
        await sb.storage.from('goal-proofs').remove([doc.file_path]);
        await sb.from('goal_documents').delete().eq('id', btn.dataset.id);
        showToast('Attachment deleted'); await loadGoalDocs();
      });
    } else if(btn.classList.contains('gComplete')){
      const g = goals.find(x => x.id === btn.dataset.id);
      await sb.from('goals').update({ completed: true, progress: 100, completed_at: new Date().toISOString() }).eq('id', g.id);
      await recalcParentProgress(g.parent_goal_id);
      showToast('Goal completed!'); await loadGoals();
    } else if(btn.classList.contains('gReopen')){
      const g = goals.find(x => x.id === btn.dataset.id);
      await sb.from('goals').update({ completed: false, completed_at: null }).eq('id', g.id);
      await recalcParentProgress(g.parent_goal_id);
      await loadGoals();
    } else if(btn.classList.contains('gEdit')){
      openGoalModal(btn.dataset.id);
    } else if(btn.classList.contains('gDelete')){
      armDelete(btn.dataset.id, btn, async ()=>{
        const g = goals.find(x => x.id === btn.dataset.id);
        await sb.from('goals').delete().eq('id', btn.dataset.id);
        showToast('Goal deleted');
        await loadGoals();
        if(g) await recalcParentProgress(g.parent_goal_id);
      });
    }
  });

  document.querySelectorAll('#goalModalOverlay .type-toggle button').forEach(b=>{
    b.addEventListener('click', ()=>{
      document.querySelectorAll('#goalModalOverlay .type-toggle button').forEach(x=>x.classList.remove('active'));
      b.classList.add('active'); goalFormType = b.dataset.v;
      updateModalFieldsForType();
    });
  });
  $('gProgress').addEventListener('input', ()=>{ $('gProgressVal').textContent = $('gProgress').value + '%'; });
  $('gCancelBtn').addEventListener('click', ()=> $('goalModalOverlay').classList.remove('open'));
  $('goalModalOverlay').addEventListener('click', (e)=>{ if(e.target.id === 'goalModalOverlay') $('goalModalOverlay').classList.remove('open'); });

  $('gSaveBtn').addEventListener('click', async ()=>{
    const title = $('gTitle').value.trim();
    let valid = true;
    if(!title){ $('gErrTitle').classList.remove('hidden'); valid = false; } else $('gErrTitle').classList.add('hidden');
    if($('gStart').value && $('gDeadline').value && $('gDeadline').value < $('gStart').value){ $('gErrDate').classList.remove('hidden'); valid = false; } else $('gErrDate').classList.add('hidden');
    if(!valid) return;

    const progress = parseInt($('gProgress').value, 10);
    const payload = {
      title, type: goalFormType,
      start_date: $('gStart').value || null,
      deadline: $('gDeadline').value || null,
      progress, completed: progress >= 100,
      completed_at: progress >= 100 ? new Date().toISOString() : null,
      notes: $('gNotes').value.trim() || null,
      parent_goal_id: goalFormType === 'short' ? ($('gParentGoal').value || null) : null,
      target_amount: goalFormType === 'long' && $('gTargetAmount').value ? parseFloat($('gTargetAmount').value) : null
    };

    if(editingGoalId){
      await sb.from('goals').update(payload).eq('id', editingGoalId);
      showToast('Goal updated');
    } else {
      const sessionRes = await sb.auth.getSession();
      payload.user_id = sessionRes.data.session.user.id;
      await sb.from('goals').insert(payload);
      showToast('Goal added — you got this.');
    }
    $('goalModalOverlay').classList.remove('open');
    await loadGoals();
    if(payload.parent_goal_id) await recalcParentProgress(payload.parent_goal_id);
  });
}

export function openGoalModal(id){
  editingGoalId = id || null;
  $('gErrTitle').classList.add('hidden'); $('gErrDate').classList.add('hidden');

  if(id){
    const g = goals.find(x => x.id === id);
    $('goalModalHeading').textContent = 'Edit goal';
    $('gTitle').value = g.title;
    $('gStart').value = g.start_date || ''; refreshDateButton($('gStart'));
    $('gDeadline').value = g.deadline || ''; refreshDateButton($('gDeadline'));
    $('gProgress').value = g.progress; $('gProgressVal').textContent = g.progress + '%';
    $('gNotes').value = g.notes || '';
    $('gTargetAmount').value = g.target_amount || '';
    goalFormType = g.type;
    populateParentSelect();
    $('gParentGoal').value = g.parent_goal_id || '';
  } else {
    $('goalModalHeading').textContent = 'New goal';
    $('gTitle').value = '';
    $('gStart').value = new Date().toISOString().slice(0,10); refreshDateButton($('gStart'));
    $('gDeadline').value = ''; refreshDateButton($('gDeadline'));
    $('gProgress').value = 0; $('gProgressVal').textContent = '0%';
    $('gNotes').value = ''; $('gTargetAmount').value = '';
    goalFormType = 'short';
    populateParentSelect();
    $('gParentGoal').value = '';
  }
  document.querySelectorAll('#goalModalOverlay .type-toggle button').forEach(b => b.classList.toggle('active', b.dataset.v === goalFormType));
  updateModalFieldsForType();
  $('goalModalOverlay').classList.add('open');
  setTimeout(()=>$('gTitle').focus(), 50);
}
