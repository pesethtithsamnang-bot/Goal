import { $ } from './utils.js';

const FADE_OUT_MS = 120;

export function currentPanel(){
  return document.querySelector('.panel.active').id.replace('panel-', '');
}

/** Swaps the active panel with a short fade, so tabs never "flash". */
export function switchPanel(name, onShown){
  const current = document.querySelector('.panel.active');
  const target = $('panel-' + name);
  if(!target || current === target) return;

  current.classList.add('panel-fade-out');
  setTimeout(()=>{
    current.classList.remove('active', 'panel-fade-out');
    target.classList.add('active', 'panel-fade-in');
    if(typeof onShown === 'function') onShown(name);
    setTimeout(()=> target.classList.remove('panel-fade-in'), 200);
  }, FADE_OUT_MS);
}

export function initTabs(onSwitch){
  $('mainTabs').addEventListener('click', (e)=>{
    if(e.target.tagName !== 'BUTTON') return;
    document.querySelectorAll('#mainTabs button').forEach(b=>b.classList.remove('active'));
    e.target.classList.add('active');
    const p = e.target.dataset.panel;
    switchPanel(p, onSwitch);
    $('addBtn').style.display = (p === 'work' || p === 'settings') ? 'none' : 'inline-block';
    $('fabAddBtn').classList.toggle('show', p !== 'work' && p !== 'settings' && window.innerWidth <= 640);
  });
}
