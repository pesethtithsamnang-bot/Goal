import { $ } from './utils.js';
import { initAuth } from './auth.js';
import { initTabs, currentPanel } from './router.js';
import { enhanceDateInputs } from './calendar.js';
import { initGoals, loadGoals, loadGoalDocs, openGoalModal } from './goals.js';
import { initFinance, loadFinances, openFinModal } from './finance.js';
import { initSchedule, loadSchedules, openSchedModal } from './schedule.js';
import { initWork, loadSessions, stopTimerLoop } from './work.js';
import { initTodos, loadTodos, openTodoModal } from './todos.js';
import { initSettings, loadFinanceAccounts, loadFinanceCategories } from './settings.js';

async function loadAll(){
  // accounts/categories load first — finance rendering depends on the account list
  await Promise.all([loadFinanceAccounts(), loadFinanceCategories()]);
  await Promise.all([loadGoals(), loadTodos(), loadSchedules(), loadSessions(), loadFinances(), loadGoalDocs()]);
}

function openAddForCurrentPanel(){
  const p = currentPanel();
  if(p === 'goals') openGoalModal(null);
  else if(p === 'schedule') openSchedModal();
  else if(p === 'todos') openTodoModal(null);
  else if(p === 'finance') openFinModal();
}

function init(){
  initGoals();
  initFinance();
  initSchedule();
  initWork();
  initTodos();
  initSettings();

  initTabs(()=>{ /* panel already swapped by router; nothing extra needed */ });

  $('addBtn').addEventListener('click', openAddForCurrentPanel);
  $('fabAddBtn').addEventListener('click', openAddForCurrentPanel);

  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape'){
      $('goalModalOverlay').classList.remove('open');
      $('schedModalOverlay').classList.remove('open');
      $('finModalOverlay').classList.remove('open');
      $('todoModalOverlay').classList.remove('open');
    }
  });

  // Turn every native date input (in modals) into the custom calendar widget
  enhanceDateInputs(document);

  initAuth({
    onSignedIn: () => { loadAll(); },
    onSignedOut: () => { stopTimerLoop(); }
  });
}

document.addEventListener('DOMContentLoaded', init);
