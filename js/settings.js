import { sb } from './supabaseClient.js';
import { $, escapeHtml, showToast, armDelete, refreshIcons } from './utils.js';

let accounts = [];
let categories = [];
let catFilterType = 'expense';

const DEFAULT_ACCOUNTS = ['Bank', 'Savings', 'Education'];
const DEFAULT_CATEGORIES = {
  expense: ['Food', 'Transport', 'Rent', 'Utilities', 'Entertainment'],
  income: ['Salary', 'Freelance', 'Gift']
};

export function getAccounts(){ return accounts; }
export function getCategories(type){ return categories.filter(c => c.type === type); }

export async function loadFinanceAccounts(){
  let { data } = await sb.from('finance_accounts').select('*').order('created_at', { ascending: true });
  if(!data || data.length === 0){
    const sessionRes = await sb.auth.getSession();
    const uid = sessionRes.data.session.user.id;
    await sb.from('finance_accounts').insert(
      DEFAULT_ACCOUNTS.map(name => ({ user_id: uid, name, is_default: true }))
    );
    ({ data } = await sb.from('finance_accounts').select('*').order('created_at', { ascending: true }));
  }
  accounts = data || [];
  renderAccounts();
}

export async function loadFinanceCategories(){
  let { data } = await sb.from('finance_categories').select('*').order('name', { ascending: true });
  if(!data || data.length === 0){
    const sessionRes = await sb.auth.getSession();
    const uid = sessionRes.data.session.user.id;
    const seed = [
      ...DEFAULT_CATEGORIES.expense.map(name => ({ user_id: uid, name, type: 'expense' })),
      ...DEFAULT_CATEGORIES.income.map(name => ({ user_id: uid, name, type: 'income' }))
    ];
    await sb.from('finance_categories').insert(seed);
    ({ data } = await sb.from('finance_categories').select('*').order('name', { ascending: true }));
  }
  categories = data || [];
  renderCategories();
}

function renderAccounts(){
  const list = $('acctList');
  if(!list) return;
  list.innerHTML = '';
  accounts.forEach(a=>{
    const el = document.createElement('div');
    el.className = 'todo-item';
    el.innerHTML = `
      <div class="todo-body">
        <div class="todo-title"><i data-lucide="wallet" class="ic"></i> ${escapeHtml(a.name)}</div>
      </div>
      ${!a.is_default ? `<button class="btn btn-red btn-sm acctDelete" data-id="${a.id}">Delete</button>` : `<span class="badge link">Default</span>`}`;
    list.appendChild(el);
  });
  refreshIcons();
}

function renderCategories(){
  const list = $('catList2');
  if(!list) return;
  list.innerHTML = '';
  document.querySelectorAll('#settingsCatToggle button').forEach(b=>b.classList.toggle('active', b.dataset.v === catFilterType));
  categories.filter(c => c.type === catFilterType).forEach(c=>{
    const el = document.createElement('div');
    el.className = 'todo-item';
    el.innerHTML = `
      <div class="todo-body">
        <div class="todo-title">${escapeHtml(c.name)}</div>
      </div>
      <button class="btn btn-red btn-sm catDelete" data-id="${c.id}">Delete</button>`;
    list.appendChild(el);
  });
  refreshIcons();
}

export function initSettings(){
  document.querySelectorAll('#settingsCatToggle button').forEach(b=>{
    b.addEventListener('click', ()=>{ catFilterType = b.dataset.v; renderCategories(); });
  });

  $('acctAddBtn').addEventListener('click', async ()=>{
    const name = $('newAcctInput').value.trim();
    if(!name) return;
    if(accounts.some(a => a.name.toLowerCase() === name.toLowerCase())){ showToast('Account already exists'); return; }
    const sessionRes = await sb.auth.getSession();
    const { error } = await sb.from('finance_accounts').insert({ user_id: sessionRes.data.session.user.id, name, is_default: false });
    if(error){ showToast('Could not add account'); return; }
    $('newAcctInput').value = '';
    showToast('Account added');
    await loadFinanceAccounts();
  });
  $('newAcctInput').addEventListener('keydown', (e)=>{ if(e.key === 'Enter') $('acctAddBtn').click(); });

  $('acctList').addEventListener('click', (e)=>{
    const btn = e.target.closest('.acctDelete');
    if(!btn) return;
    armDelete('acct-'+btn.dataset.id, btn, async ()=>{
      await sb.from('finance_accounts').delete().eq('id', btn.dataset.id);
      showToast('Account deleted');
      await loadFinanceAccounts();
    });
  });

  $('catAddBtn').addEventListener('click', async ()=>{
    const name = $('newCatInput').value.trim();
    if(!name) return;
    if(categories.some(c => c.type === catFilterType && c.name.toLowerCase() === name.toLowerCase())){ showToast('Category already exists'); return; }
    const sessionRes = await sb.auth.getSession();
    const { error } = await sb.from('finance_categories').insert({ user_id: sessionRes.data.session.user.id, name, type: catFilterType });
    if(error){ showToast('Could not add category'); return; }
    $('newCatInput').value = '';
    showToast('Category added');
    await loadFinanceCategories();
  });
  $('newCatInput').addEventListener('keydown', (e)=>{ if(e.key === 'Enter') $('catAddBtn').click(); });

  $('catList2').addEventListener('click', (e)=>{
    const btn = e.target.closest('.catDelete');
    if(!btn) return;
    armDelete('cat-'+btn.dataset.id, btn, async ()=>{
      await sb.from('finance_categories').delete().eq('id', btn.dataset.id);
      showToast('Category deleted');
      await loadFinanceCategories();
    });
  });
}
