import { sb } from './supabaseClient.js';
import { $ } from './utils.js';

let session = null;
let authMode = 'signin';

export function getSession(){ return session; }

function toggleAuthMode(){
  authMode = authMode === 'signin' ? 'signup' : 'signin';
  $('authHeading').textContent = authMode === 'signin' ? 'Welcome back' : 'Create your account';
  $('authSub').textContent = authMode === 'signin' ? 'Log in to your private SKETING app' : 'This becomes your private, permanent tracker';
  $('authSubmitBtn').textContent = authMode === 'signin' ? 'Log in' : 'Create account';
  $('authToggle').innerHTML = authMode === 'signin'
    ? 'New here? <a id="authToggleLink">Create an account</a>'
    : 'Already have an account? <a id="authToggleLink">Log in</a>';
  $('authToggleLink').addEventListener('click', toggleAuthMode);
  $('authMsg').textContent = ''; $('authMsg').className = '';
}

export function initAuth({ onSignedIn, onSignedOut }){
  $('authToggleLink').addEventListener('click', toggleAuthMode);

  $('authSubmitBtn').addEventListener('click', async ()=>{
    const email = $('authEmail').value.trim();
    const password = $('authPassword').value;
    const msg = $('authMsg');
    if(!email || !password){ msg.textContent = 'Enter an email and password.'; msg.className = 'err'; return; }
    $('authSubmitBtn').disabled = true;
    try{
      if(authMode === 'signin'){
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if(error) throw error;
      } else {
        const { error } = await sb.auth.signUp({ email, password });
        if(error) throw error;
        msg.textContent = 'Account created — check your email if confirmation is required, then log in.';
        msg.className = 'ok';
      }
    } catch(e){
      msg.textContent = e.message || 'Something went wrong.';
      msg.className = 'err';
    }
    $('authSubmitBtn').disabled = false;
  });

  $('signOutBtn').addEventListener('click', async ()=>{ await sb.auth.signOut(); });

  sb.auth.onAuthStateChange((event, sess)=>{
    session = sess;
    if(session){
      $('authScreen').classList.add('hidden');
      $('appScreen').style.display = 'block';
      $('userEmail').textContent = session.user.email;
      onSignedIn();
    } else {
      $('authScreen').classList.remove('hidden');
      $('appScreen').style.display = 'none';
      onSignedOut();
    }
  });
}
