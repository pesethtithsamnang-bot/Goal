import { sb } from './supabaseClient.js';
import { $, escapeHtml, fmtDate, showToast, armDelete, refreshIcons } from './utils.js';
import { refreshDateButton } from './calendar.js';
import { getGoals, setFinanceEntriesRef } from './goals.js';
import { getAccounts, getCategories } from './settings.js';

let finances = [];
let finFormType = 'expense';
let editingFinId = null;

let filterType = 'all';
let filterAccount = 'all';
let filterPeriodMode = 'all';
let sortCol = 'entry_date';
let sortDir = 'desc';

export async function loadFinances(){
  const { data } = await sb.from('finance_entries').select('*').order('entry_date', { ascending: false });
  finances = data || [];
  // only income/expense entries feed "$ saved toward goal" tracking
  setFinanceEntriesRef(finances.filter(f => f.type !== 'transfer'));
  renderFinance();
}

// An entry "counts" once today has reached its active_from date (if any).
// Non-recurring entries simply behave like a normal date; recurring ones
// keep counting every month from active_from onward.
function isActive(f, refDate){
  if(!f.active_from) return true;
  return new Date(f.active_from + 'T00:00:00') <= refDate;
}

function fmtTime(t){
  if(!t) return '';
  const [h, m] = t.split(':').map(Number);
  const d = new Date(); d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function computeBalances(){
  const now = new Date();
  const balances = {};
  getAccounts().forEach(a => balances[a.name] = 0);
  finances.forEach(f=>{
    if(!isActive(f, now)) return;
    const amt = parseFloat(f.amount);
    if(f.type === 'income') balances[f.account] = (balances[f.account] || 0) + amt;
    else if(f.type === 'expense') balances[f.account] = (balances[f.account] || 0) - amt;
    else if(f.type === 'transfer'){
      balances[f.account] = (balances[f.account] || 0) - amt;
      balances[f.to_account] = (balances[f.to_account] || 0) + amt;
    }
  });
  return balances;
}

function renderDashboard(){
  const now = new Date();
  const cm = now.getMonth(), cy = now.getFullYear();
  let iMo = 0, eMo = 0, iYr = 0, eYr = 0;
  const catMap = {};

  finances.forEach(f=>{
    if(f.type === 'transfer') return; // transfers never count as income/expense
    const amt = parseFloat(f.amount);
    if(!isActive(f, now)) return; // deferred & not started yet

    if(f.recurring){
      if(f.type === 'income') { iMo += amt; iYr += amt; } else { eMo += amt; eYr += amt; catMap[f.category] = (catMap[f.category]||0) + amt; }
      return;
    }

    const fd = new Date(f.entry_date + 'T00:00:00');
    const m = fd.getMonth(), y = fd.getFullYear();
    if(y === cy){
      if(f.type === 'income') iYr += amt; else eYr += amt;
      if(m === cm){
        if(f.type === 'income') iMo += amt;
        else { eMo += amt; catMap[f.category] = (catMap[f.category]||0) + amt; }
      }
    }
  });

  $('finIncMo').textContent = '$' + iMo.toFixed(2);
  $('finExpMo').textContent = '$' + eMo.toFixed(2);
  $('finNetMo').textContent = '$' + (iMo - eMo).toFixed(2);
  $('finIncYr').textContent = '$' + iYr.toFixed(2);
  $('finExpYr').textContent = '$' + eYr.toFixed(2);
  $('finNetYr').textContent = '$' + (iYr - eYr).toFixed(2);

  const catBrk = $('finCategoryBreakdown');
  catBrk.innerHTML = '';
  if(eMo > 0){
    Object.keys(catMap).sort((a,b)=>catMap[b]-catMap[a]).forEach(c=>{
      const pct = Math.round((catMap[c] / eMo) * 100);
      catBrk.innerHTML += `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span>${escapeHtml(c)} <span style="color:var(--ink-soft);font-size:12px;">(${pct}%)</span></span>
          <span style="font-weight:700;">$${catMap[c].toFixed(2)}</span>
        </div>
        <div class="progress-outer" style="height:6px;margin-bottom:12px;"><div class="progress-inner" style="width:${pct}%"></div></div>`;
    });
  } else {
    catBrk.innerHTML = '<span style="color:var(--ink-soft);">No expenses this month.</span>';
  }

  // account balances
  const balances = computeBalances();
  const acctBox = $('finAcctBalances');
  acctBox.innerHTML = Object.keys(balances).map(name => `
    <div class="stat-box">
      <div class="stat-label">${escapeHtml(name)}</div>
      <div class="stat-val ${balances[name] < 0 ? 'val-neg' : ''}">$${balances[name].toFixed(2)}</div>
    </div>`).join('');
}

function periodMatches(f){
  if(filterPeriodMode === 'all') return true;
  if(!f.entry_date) return false;
  if(filterPeriodMode === 'day'){
    const v = $('finPeriodDay').value;
    return !!v && f.entry_date === v;
  }
  if(filterPeriodMode === 'month'){
    const v = $('finPeriodMonth').value; // YYYY-MM
    return !!v && f.entry_date.slice(0,7) === v;
  }
  if(filterPeriodMode === 'year'){
    const v = $('finPeriodYear').value;
    return !!v && f.entry_date.slice(0,4) === String(v);
  }
  return true;
}

function getFilteredSorted(){
  let list = finances.filter(f=>{
    if(filterType !== 'all' && f.type !== filterType) return false;
    if(filterAccount !== 'all' && f.account !== filterAccount && f.to_account !== filterAccount) return false;
    if(!periodMatches(f)) return false;
    return true;
  });
  list.sort((a,b)=>{
    let av, bv;
    if(sortCol === 'amount'){ av = parseFloat(a.amount); bv = parseFloat(b.amount); }
    else if(sortCol === 'entry_date'){ av = (a.entry_date||'') + (a.entry_time||''); bv = (b.entry_date||'') + (b.entry_time||''); }
    else { av = (a[sortCol]||'').toString().toLowerCase(); bv = (b[sortCol]||'').toString().toLowerCase(); }
    if(av < bv) return sortDir === 'asc' ? -1 : 1;
    if(av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });
  return list;
}

function renderTable(){
  const list = getFilteredSorted();
  const body = $('finTableBody');
  body.innerHTML = '';
  $('financeEmpty').classList.toggle('hidden', finances.length > 0);
  $('finTableWrap').classList.toggle('hidden', list.length === 0);
  $('finNoResults').classList.toggle('hidden', !(finances.length > 0 && list.length === 0));

  list.forEach(f=>{
    const isInc = f.type === 'income';
    const isTr = f.type === 'transfer';
    const goal = f.goal_id ? getGoals().find(g => g.id === f.goal_id) : null;
    const pending = f.active_from && new Date(f.active_from + 'T00:00:00') > new Date();
    const acctText = isTr ? `${escapeHtml(f.account)} → ${escapeHtml(f.to_account || '?')}` : escapeHtml(f.account || '');
    const amtClass = isTr ? '' : (isInc ? 'val-pos' : 'val-neg');
    const amtSign = isTr ? '' : (isInc ? '+' : '-');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fmtDate(f.entry_date)}</td>
      <td>${f.entry_time ? fmtTime(f.entry_time) : '—'}</td>
      <td><span class="badge ${isTr ? 'link' : (isInc ? 'short' : 'long')}">${f.type}</span></td>
      <td>${acctText}</td>
      <td>${escapeHtml(f.category || '')}${goal ? `<br><span class="badge link" style="margin-top:4px;"><i data-lucide="link-2" class="ic"></i> ${escapeHtml(goal.title)}</span>` : ''}${f.recurring ? '<br><span class="fin-deferred">Recurring</span>' : ''}${pending ? `<br><span class="fin-deferred">Starts ${fmtDate(f.active_from)}</span>` : ''}</td>
      <td>${escapeHtml(f.note || '')}</td>
      <td class="${amtClass}" style="font-weight:800;text-align:right;">${amtSign}$${parseFloat(f.amount).toFixed(2)}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-blue btn-sm fEdit" data-id="${f.id}">Edit</button>
        <button class="btn btn-red btn-sm fDelete" data-id="${f.id}">Del</button>
      </td>`;
    body.appendChild(tr);
  });
  document.querySelectorAll('#finTable th[data-sort]').forEach(th=>{
    th.classList.toggle('sorted-asc', th.dataset.sort === sortCol && sortDir === 'asc');
    th.classList.toggle('sorted-desc', th.dataset.sort === sortCol && sortDir === 'desc');
  });
  refreshIcons();
}

function renderFinance(){
  renderDashboard();
  populateAccountFilterSelect();
  renderTable();
}

function populateGoalSelect(){
  const sel = $('fGoalLink');
  const savingsGoals = getGoals().filter(g => g.type === 'long' && !g.completed);
  sel.innerHTML = '<option value="">— None —</option>' + savingsGoals.map(g => `<option value="${g.id}">${escapeHtml(g.title)}</option>`).join('');
}

function populateAccountSelects(){
  const opts = getAccounts().map(a => `<option value="${escapeHtml(a.name)}">${escapeHtml(a.name)}</option>`).join('');
  $('fAccount').innerHTML = opts;
  $('fToAccount').innerHTML = opts;
}

function populateAccountFilterSelect(){
  const sel = $('finAccountFilter');
  const current = sel.value || 'all';
  sel.innerHTML = '<option value="all">All accounts</option>' + getAccounts().map(a => `<option value="${escapeHtml(a.name)}">${escapeHtml(a.name)}</option>`).join('');
  sel.value = current;
}

function populateCategoryDatalist(){
  const type = finFormType === 'income' ? 'income' : 'expense';
  const cats = getCategories(type).map(c => c.name);
  $('catList').innerHTML = cats.map(c => `<option value="${escapeHtml(c)}">`).join('');
}

function updateModalFieldsForType(){
  $('fCategoryField').classList.toggle('hidden', finFormType === 'transfer');
  $('fGoalLinkField').classList.toggle('hidden', finFormType !== 'income');
  $('fToAccountField').classList.toggle('hidden', finFormType !== 'transfer');
  $('fAccountLabel').textContent = finFormType === 'transfer' ? 'From account' : 'Account';
  populateCategoryDatalist();
}

export function initFinance(){
  document.querySelectorAll('#finTypeFilter button').forEach(b=>{
    b.addEventListener('click', ()=>{
      document.querySelectorAll('#finTypeFilter button').forEach(x=>x.classList.remove('active'));
      b.classList.add('active'); filterType = b.dataset.v; renderTable();
    });
  });
  $('finAccountFilter').addEventListener('change', ()=>{ filterAccount = $('finAccountFilter').value; renderTable(); });
  $('finPeriodMode').addEventListener('change', ()=>{
    filterPeriodMode = $('finPeriodMode').value;
    $('finPeriodDay').classList.toggle('hidden', filterPeriodMode !== 'day');
    $('finPeriodMonth').classList.toggle('hidden', filterPeriodMode !== 'month');
    $('finPeriodYear').classList.toggle('hidden', filterPeriodMode !== 'year');
    renderTable();
  });
  $('finPeriodDay').addEventListener('change', renderTable);
  $('finPeriodMonth').addEventListener('change', renderTable);
  $('finPeriodYear').addEventListener('input', renderTable);

  document.querySelectorAll('#finTable th[data-sort]').forEach(th=>{
    th.addEventListener('click', ()=>{
      const col = th.dataset.sort;
      if(sortCol === col) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      else { sortCol = col; sortDir = 'asc'; }
      renderTable();
    });
  });

  $('finTableBody').addEventListener('click', (e)=>{
    const editBtn = e.target.closest('.fEdit');
    const delBtn = e.target.closest('.fDelete');
    if(editBtn){ openFinModal(editBtn.dataset.id); return; }
    if(!delBtn) return;
    armDelete(delBtn.dataset.id, delBtn, async ()=>{
      await sb.from('finance_entries').delete().eq('id', delBtn.dataset.id);
      showToast('Entry deleted');
      await loadFinances();
    });
  });

  document.querySelectorAll('#finModalOverlay .type-toggle button').forEach(b=>{
    b.addEventListener('click', ()=>{
      document.querySelectorAll('#finModalOverlay .type-toggle button').forEach(x=>x.classList.remove('active'));
      b.classList.add('active'); finFormType = b.dataset.v;
      updateModalFieldsForType();
    });
  });

  $('fRecurring').addEventListener('change', ()=>{
    $('fActiveFromField').classList.toggle('hidden', !$('fRecurring').checked);
  });

  $('fCancelBtn').addEventListener('click', ()=> $('finModalOverlay').classList.remove('open'));
  $('finModalOverlay').addEventListener('click', (e)=>{ if(e.target.id === 'finModalOverlay') $('finModalOverlay').classList.remove('open'); });

  $('fSaveBtn').addEventListener('click', async ()=>{
    const amt = $('fAmount').value;
    let valid = true;
    if(!amt || amt <= 0){ $('fErrAmount').classList.remove('hidden'); valid = false; } else $('fErrAmount').classList.add('hidden');

    let cat = $('fCategory').value.trim();
    if(finFormType !== 'transfer'){
      if(!cat){ $('fErrCategory').classList.remove('hidden'); valid = false; } else $('fErrCategory').classList.add('hidden');
    } else {
      $('fErrCategory').classList.add('hidden');
    }

    const account = $('fAccount').value;
    const toAccount = $('fToAccount').value;
    if(finFormType === 'transfer'){
      if(account === toAccount){ showToast('Pick two different accounts'); valid = false; }
      else cat = `Transfer to ${toAccount}`;
    }
    if(!valid) return;

    const payload = {
      type: finFormType, amount: parseFloat(amt), category: cat,
      account,
      to_account: finFormType === 'transfer' ? toAccount : null,
      entry_date: $('fDate').value || new Date().toISOString().slice(0,10),
      entry_time: $('fTime').value || null,
      note: $('fNote').value.trim() || null,
      goal_id: finFormType === 'income' ? ($('fGoalLink').value || null) : null,
      recurring: $('fRecurring').checked,
      active_from: $('fRecurring').checked ? ($('fActiveFrom').value || null) : null
    };

    if(editingFinId){
      await sb.from('finance_entries').update(payload).eq('id', editingFinId);
      showToast('Entry updated');
    } else {
      const sessionRes = await sb.auth.getSession();
      payload.user_id = sessionRes.data.session.user.id;
      await sb.from('finance_entries').insert(payload);
      showToast('Entry saved');
    }
    $('finModalOverlay').classList.remove('open');
    await loadFinances();
  });
}

export function openFinModal(id){
  editingFinId = id || null;
  $('fErrAmount').classList.add('hidden'); $('fErrCategory').classList.add('hidden');
  populateAccountSelects();
  populateGoalSelect();

  if(id){
    const f = finances.find(x => x.id === id);
    $('finModalHeading').textContent = 'Edit entry';
    finFormType = f.type;
    $('fAmount').value = f.amount;
    $('fCategory').value = f.type === 'transfer' ? '' : (f.category || '');
    $('fDate').value = f.entry_date || ''; refreshDateButton($('fDate'));
    $('fTime').value = f.entry_time ? f.entry_time.slice(0,5) : '';
    $('fNote').value = f.note || '';
    $('fAccount').value = f.account || '';
    $('fToAccount').value = f.to_account || '';
    $('fRecurring').checked = !!f.recurring;
    $('fActiveFrom').value = f.active_from || ''; refreshDateButton($('fActiveFrom'));
    $('fActiveFromField').classList.toggle('hidden', !f.recurring);
    populateCategoryDatalist();
    $('fGoalLink').value = f.goal_id || '';
  } else {
    $('finModalHeading').textContent = 'New entry';
    $('fAmount').value = ''; $('fCategory').value = '';
    $('fDate').value = new Date().toISOString().slice(0,10); refreshDateButton($('fDate'));
    $('fTime').value = '';
    $('fNote').value = ''; $('fRecurring').checked = false;
    $('fActiveFrom').value = ''; refreshDateButton($('fActiveFrom'));
    $('fActiveFromField').classList.add('hidden');
    finFormType = 'expense';
    $('fAccount').value = getAccounts()[0]?.name || '';
    $('fToAccount').value = getAccounts()[1]?.name || '';
  }
  document.querySelectorAll('#finModalOverlay .type-toggle button').forEach(b => b.classList.toggle('active', b.dataset.v === finFormType));
  updateModalFieldsForType();
  $('finModalOverlay').classList.add('open');
  setTimeout(()=>$('fAmount').focus(), 50);
}
