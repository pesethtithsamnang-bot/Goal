import { sb } from './supabaseClient.js';
import { $, escapeHtml, fmtDate, showToast, armDelete, refreshIcons } from './utils.js';
import { refreshDateButton } from './calendar.js';

let todos = [];
let editingTodoId = null;

export async function loadTodos(){
  const { data } = await sb.from('todos').select('*').order('created_at', { ascending: false });
  todos = data || [];
  renderTodos();
}

function fmtTime(t){
  if(!t) return '';
  const [h, m] = t.split(':').map(Number);
  const d = new Date(); d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function renderTodos(){
  const list = $('todoList'); list.innerHTML = '';
  $('todoEmpty').classList.toggle('hidden', todos.length > 0);
  todos.slice()
    .sort((a,b)=> (a.done - b.done) || (new Date(b.created_at) - new Date(a.created_at)))
    .forEach(t=>{
      const el = document.createElement('div');
      el.className = 'todo-item' + (t.done ? ' done' : '');
      const dueText = t.due_date ? `Due ${fmtDate(t.due_date)}${t.due_time ? ' · ' + fmtTime(t.due_time) : ''}` : '';
      el.innerHTML = `
        <div class="todo-check ${t.done ? 'done' : ''}" data-id="${t.id}">${t.done ? '<i data-lucide="check" class="ic"></i>' : ''}</div>
        <div class="todo-body">
          <div class="todo-title">${escapeHtml(t.title)}</div>
          ${dueText ? `<div class="todo-due">${dueText}</div>` : ''}
          ${t.notes ? `<div class="todo-notes">${escapeHtml(t.notes)}</div>` : ''}
        </div>
        <div class="item-actions">
          <button class="btn btn-blue btn-sm tEdit" data-id="${t.id}">Edit</button>
          <button class="btn btn-red btn-sm tDelete" data-id="${t.id}">Delete</button>
        </div>`;
      list.appendChild(el);
    });
  refreshIcons();
}

async function addTodo(){
  const title = $('newTodoInput').value.trim();
  if(!title) return;
  $('newTodoInput').value = '';
  const sessionRes = await sb.auth.getSession();
  await sb.from('todos').insert({ title, user_id: sessionRes.data.session.user.id });
  await loadTodos();
}

export function initTodos(){
  $('addTodoBtn').addEventListener('click', addTodo);
  $('newTodoInput').addEventListener('keydown', (e)=>{ if(e.key === 'Enter') addTodo(); });

  $('todoList').addEventListener('click', async (e)=>{
    const checkEl = e.target.closest('.todo-check');
    const editEl = e.target.closest('.tEdit');
    const delEl = e.target.closest('.tDelete');
    if(checkEl){
      const t = todos.find(x => x.id === checkEl.dataset.id);
      await sb.from('todos').update({ done: !t.done }).eq('id', t.id);
      await loadTodos();
    } else if(editEl){
      openTodoModal(editEl.dataset.id);
    } else if(delEl){
      armDelete(delEl.dataset.id, delEl, async ()=>{
        await sb.from('todos').delete().eq('id', delEl.dataset.id);
        showToast('Todo deleted');
        await loadTodos();
      });
    }
  });

  $('tCancelBtn').addEventListener('click', ()=> $('todoModalOverlay').classList.remove('open'));
  $('todoModalOverlay').addEventListener('click', (e)=>{ if(e.target.id === 'todoModalOverlay') $('todoModalOverlay').classList.remove('open'); });

  $('tSaveBtn').addEventListener('click', async ()=>{
    const title = $('tTitle').value.trim();
    if(!title){ $('tErrTitle').classList.remove('hidden'); return; }
    $('tErrTitle').classList.add('hidden');

    const payload = {
      title,
      due_date: $('tDueDate').value || null,
      due_time: $('tDueTime').value || null,
      notes: $('tNotes').value.trim() || null
    };

    if(editingTodoId){
      await sb.from('todos').update(payload).eq('id', editingTodoId);
      showToast('Todo updated');
    } else {
      const sessionRes = await sb.auth.getSession();
      payload.user_id = sessionRes.data.session.user.id;
      await sb.from('todos').insert(payload);
      showToast('Todo added');
    }
    $('todoModalOverlay').classList.remove('open');
    await loadTodos();
  });
}

export function openTodoModal(id){
  editingTodoId = id || null;
  $('tErrTitle').classList.add('hidden');

  if(id){
    const t = todos.find(x => x.id === id);
    $('todoModalHeading').textContent = 'Edit todo';
    $('tTitle').value = t.title;
    $('tDueDate').value = t.due_date || ''; refreshDateButton($('tDueDate'));
    $('tDueTime').value = t.due_time ? t.due_time.slice(0,5) : '';
    $('tNotes').value = t.notes || '';
  } else {
    $('todoModalHeading').textContent = 'New todo';
    $('tTitle').value = '';
    $('tDueDate').value = ''; refreshDateButton($('tDueDate'));
    $('tDueTime').value = ''; $('tNotes').value = '';
  }
  $('todoModalOverlay').classList.add('open');
  setTimeout(()=>$('tTitle').focus(), 50);
}
