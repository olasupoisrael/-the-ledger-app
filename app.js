const SUPABASE_URL = 'https://hdwunghgazmbpbhqbbki.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhkd3VuZ2hnYXptYnBiaHFiYmtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyOTU2ODEsImV4cCI6MjEwNDg3MTY4MX0.9DU2wGVMnFgONt62Ntb4uIALlcXZQ1gvDuoULcqIZ64';

// IMPORTANT: replace with your own account's email to unlock admin (pod creation) features
const ADMIN_EMAILS = ["Israelolasupo26@gmail.com"];

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let state = {
  user: null,
  profile: null,
  categories: [],
  pods: [],
  myPodIds: [],
  view: 'feed', // feed | pods | profile
  feedFilter: { category: null, pod: null },
  authMode: 'login', // login | signup
  loading: true,
  lastUsedCat: null,
  lastUsedPod: ''
};

const app = document.getElementById('app');

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

// ===== CUSTOM DIALOGS (replace native confirm/prompt/alert) =====

function showConfirmModal({ title, message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box">
        <h3 class="modal-title display">${esc(title)}</h3>
        <p style="color:var(--ink-soft);font-size:15px;line-height:1.5;margin:0;">${esc(message)}</p>
        <div class="modal-actions">
          <button class="btn" id="confirm-cancel">Cancel</button>
          <button class="btn ${danger ? '' : 'btn-primary'}" id="confirm-ok" ${danger ? 'style="background:var(--coral);color:white;box-shadow:var(--shadow-coral);"' : ''}>${esc(confirmLabel)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const cleanup = (result) => { overlay.remove(); resolve(result); };
    document.getElementById('confirm-cancel').onclick = () => cleanup(false);
    document.getElementById('confirm-ok').onclick = () => cleanup(true);
    overlay.onclick = (e) => { if (e.target === overlay) cleanup(false); };
  });
}

function showPromptModal({ title, message, placeholder = '', optional = true }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box">
        <h3 class="modal-title display">${esc(title)}</h3>
        ${message ? `<p style="color:var(--ink-soft);font-size:14px;margin:0 0 14px;">${esc(message)}</p>` : ''}
        <div class="field" style="margin-bottom:0;">
          <textarea id="prompt-input" rows="3" placeholder="${esc(placeholder)}"></textarea>
        </div>
        <div class="modal-actions">
          ${optional ? `<button class="btn" id="prompt-skip">Skip</button>` : `<button class="btn" id="prompt-skip">Cancel</button>`}
          <button class="btn btn-primary" id="prompt-ok">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('prompt-input').focus();
    const cleanup = (result) => { overlay.remove(); resolve(result); };
    document.getElementById('prompt-skip').onclick = () => cleanup(optional ? '' : null);
    document.getElementById('prompt-ok').onclick = () => cleanup(document.getElementById('prompt-input').value.trim());
    overlay.onclick = (e) => { if (e.target === overlay) cleanup(optional ? '' : null); };
  });
}

function showAlertModal({ title = 'Something went wrong', message }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box">
        <h3 class="modal-title display">${esc(title)}</h3>
        <p style="color:var(--ink-soft);font-size:15px;line-height:1.5;margin:0;">${esc(message)}</p>
        <div class="modal-actions">
          <button class="btn btn-primary" id="alert-ok">Got it</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const cleanup = () => { overlay.remove(); resolve(); };
    document.getElementById('alert-ok').onclick = cleanup;
    overlay.onclick = (e) => { if (e.target === overlay) cleanup(); };
  });
}

// ===== CUSTOM SELECT (replaces native <select> everywhere) =====
// Renders a styled trigger button + floating option panel. Supports
// click, tap, arrow-key navigation, Enter/Escape, and click-outside-to-close.

let customSelectCounter = 0;
const openCustomSelects = new Set();

function closeAllCustomSelects(exceptId) {
  openCustomSelects.forEach(id => {
    if (id === exceptId) return;
    const panel = document.getElementById(`csel-panel-${id}`);
    const trigger = document.getElementById(`csel-trigger-${id}`);
    if (panel) panel.classList.remove('open');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  });
  openCustomSelects.forEach(id => { if (id !== exceptId) openCustomSelects.delete(id); });
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.csel')) closeAllCustomSelects();
});

/**
 * Renders a custom select's HTML. Call renderCustomSelect() to get markup,
 * insert it, then call wireCustomSelect() with the same id + options to
 * attach behavior. onChange receives the selected option's value.
 */
function renderCustomSelect({ id, options, value, placeholder = 'Select…' }) {
  const selected = options.find(o => String(o.value) === String(value));
  const label = selected ? selected.label : placeholder;
  return `
    <div class="csel" data-csel-id="${id}">
      <button type="button" class="csel-trigger" id="csel-trigger-${id}" aria-haspopup="listbox" aria-expanded="false">
        <span class="csel-trigger-label">${esc(label)}</span>
        <i class="ti ti-chevron-down csel-chevron"></i>
      </button>
      <div class="csel-panel" id="csel-panel-${id}" role="listbox">
        ${options.map(o => `
          <div class="csel-option ${String(o.value) === String(value) ? 'selected' : ''}" role="option" data-value="${esc(String(o.value))}" tabindex="-1">${esc(o.label)}</div>
        `).join('')}
      </div>
    </div>
  `;
}

function wireCustomSelect({ id, options, getValue, onChange }) {
  const trigger = document.getElementById(`csel-trigger-${id}`);
  const panel = document.getElementById(`csel-panel-${id}`);
  if (!trigger || !panel) return;

  let highlighted = -1;

  const setOpen = (open) => {
    if (open) {
      closeAllCustomSelects(id);
      panel.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
      openCustomSelects.add(id);
      const currentVal = String(getValue());
      highlighted = options.findIndex(o => String(o.value) === currentVal);
      updateHighlight();
    } else {
      panel.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
      openCustomSelects.delete(id);
    }
  };

  const updateHighlight = () => {
    const opts = panel.querySelectorAll('.csel-option');
    opts.forEach((el, i) => el.classList.toggle('highlighted', i === highlighted));
    if (opts[highlighted]) opts[highlighted].scrollIntoView({ block: 'nearest' });
  };

  const selectValue = (val) => {
    const opt = options.find(o => String(o.value) === String(val));
    if (!opt) return;
    trigger.querySelector('.csel-trigger-label').textContent = opt.label;
    panel.querySelectorAll('.csel-option').forEach(el => {
      el.classList.toggle('selected', el.dataset.value === String(val));
    });
    onChange(opt.value);
    setOpen(false);
  };

  trigger.onclick = (e) => {
    e.stopPropagation();
    setOpen(!panel.classList.contains('open'));
  };

  trigger.onkeydown = (e) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Escape'].includes(e.key)) e.preventDefault();
    if (!panel.classList.contains('open') && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') { highlighted = Math.min(highlighted + 1, options.length - 1); updateHighlight(); }
    else if (e.key === 'ArrowUp') { highlighted = Math.max(highlighted - 1, 0); updateHighlight(); }
    else if (e.key === 'Enter' && highlighted >= 0) { selectValue(options[highlighted].value); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  panel.querySelectorAll('.csel-option').forEach(el => {
    el.onclick = (e) => { e.stopPropagation(); selectValue(el.dataset.value); };
    el.onmouseenter = () => {
      highlighted = Array.from(panel.querySelectorAll('.csel-option')).indexOf(el);
      updateHighlight();
    };
  });
}


function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  const days = Math.floor(diff / 86400);
  if (days < 7) return days + 'd ago';
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function isAdmin() {
  return state.user && ADMIN_EMAILS.includes(state.user.email);
}

// ===== SKELETON LOADERS =====

function skeletonEntries(count = 3) {
  return `
    <div class="skeleton-wrap">
      ${Array.from({ length: count }).map(() => `
        <div class="skel skel-entry">
          <div class="skel-circle"></div>
          <div class="skel-lines">
            <div class="skel-line skel-line-sm"></div>
            <div class="skel-line skel-line-lg"></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function skeletonLeaderboard(count = 5) {
  return `
    <div class="leaderboard skeleton-wrap">
      ${Array.from({ length: count }).map(() => `
        <div class="skel skel-lb-row">
          <div class="skel-circle skel-circle-sm"></div>
          <div class="skel-line skel-line-md"></div>
          <div class="skel-line skel-line-sm" style="margin-left:auto;"></div>
        </div>
      `).join('')}
    </div>
  `;
}


async function init() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    state.user = session.user;
    await loadProfile();
  }
  await loadCategories();
  if (state.user) await loadPods();
  state.loading = false;
  render();

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN') {
      state.user = session.user;
      await loadProfile();
      await loadPods();
      render();
    } else if (event === 'SIGNED_OUT') {
      state.user = null;
      state.profile = null;
      render();
    }
  });
}

async function loadProfile() {
  if (!state.user) return;
  const { data } = await sb.from('profiles').select('*').eq('id', state.user.id).single();
  state.profile = data;
}

async function loadCategories() {
  const { data } = await sb.from('categories').select('*').order('id');
  state.categories = data || [];
}

async function loadPods() {
  const { data: pods } = await sb.from('pods').select('*').order('created_at', { ascending: false });
  state.pods = pods || [];
  if (state.user) {
    const { data: memberships } = await sb.from('pod_members').select('pod_id').eq('user_id', state.user.id);
    state.myPodIds = (memberships || []).map(m => m.pod_id);
  }
}

async function updateStreak() {
  if (!state.profile) return;
  const today = new Date().toISOString().split('T')[0];
  const last = state.profile.last_active_date;
  if (last === today) return; // already counted today

  let newStreak = 1;
  if (last) {
    const lastDate = new Date(last);
    const todayDate = new Date(today);
    const dayDiff = Math.round((todayDate - lastDate) / 86400000);
    if (dayDiff === 1) newStreak = state.profile.current_streak + 1;
  }
  const longest = Math.max(newStreak, state.profile.longest_streak || 0);

  await sb.from('profiles').update({
    current_streak: newStreak,
    longest_streak: longest,
    last_active_date: today
  }).eq('id', state.user.id);

  state.profile.current_streak = newStreak;
  state.profile.longest_streak = longest;
  state.profile.last_active_date = today;
}

// ===== RENDER =====

function render() {
  if (state.loading) {
    app.innerHTML = `<div class="loading-screen display">Loading your streak…</div>`;
    return;
  }
  if (!state.user) {
    renderAuth();
    return;
  }
  renderApp();
}

function renderAuth() {
  const isLogin = state.authMode === 'login';
  app.innerHTML = `
    <div class="auth-wrap">
      <h1 class="auth-title display">Streak</h1>
      <p class="auth-sub">Say what you'll do today, then show up. No hiding, no editing history — just an honest streak.</p>
      <div id="auth-error"></div>
      <form id="auth-form">
        ${!isLogin ? `
        <div class="field">
          <label>Display name</label>
          <input type="text" id="display-name" placeholder="How others will see you" required />
        </div>` : ''}
        <div class="field">
          <label>Email</label>
          <input type="email" id="email" placeholder="you@example.com" required />
        </div>
        <div class="field">
          <label>Password</label>
          <input type="password" id="password" placeholder="At least 6 characters" required minlength="6" />
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%">${isLogin ? 'Log in' : 'Create account'}</button>
      </form>
      <p class="auth-switch">
        ${isLogin ? "New here?" : "Already have an account?"}
        <a id="switch-mode">${isLogin ? 'Create an account' : 'Log in'}</a>
      </p>
    </div>
  `;

  document.getElementById('switch-mode').onclick = () => {
    state.authMode = isLogin ? 'signup' : 'login';
    render();
  };

  document.getElementById('auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const errorBox = document.getElementById('auth-error');
    errorBox.innerHTML = '';

    if (isLogin) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        errorBox.innerHTML = `<div class="error-msg">${esc(error.message)}</div>`;
      } else {
        state.loading = true;
        render();
        await loadProfile();
        await loadPods();
        state.loading = false;
        render();
      }
    } else {
      const displayName = document.getElementById('display-name').value.trim();
      const { data, error } = await sb.auth.signUp({
        email, password,
        options: { data: { display_name: displayName } }
      });
      if (error) {
        errorBox.innerHTML = `<div class="error-msg">${esc(error.message)}</div>`;
      } else if (data.session) {
        state.loading = true;
        render();
        await loadProfile();
        await loadPods();
        state.loading = false;
        render();
      } else {
        errorBox.innerHTML = `<div class="error-msg" style="background:var(--emerald-bg);color:var(--emerald)">Check your email to confirm your account, then log in.</div>`;
      }
    }
  };
}

function renderApp() {
  const streak = state.profile ? state.profile.current_streak : 0;
  const navItems = [
    { view: 'feed', label: 'Feed', icon: 'ti-list-check' },
    { view: 'pods', label: 'Pods', icon: 'ti-users' },
    { view: 'leaderboard', label: 'Ranks', icon: 'ti-trophy' },
    { view: 'profile', label: 'Profile', icon: 'ti-user-circle' }
  ];

  app.innerHTML = `
    <div class="site-header">
      <div>
        <h1 class="site-title display">Streak<span>${esc(state.profile ? state.profile.display_name : '')}</span></h1>
      </div>
      <div class="header-right">
        <div class="streak-badge">
          <i class="ti ti-flame flame"></i>
          <div class="streak-num mono">${streak}</div>
          <div class="streak-label">day streak</div>
        </div>
        <button class="btn btn-ghost" id="logout-btn" title="Log out"><i class="ti ti-logout"></i>Log out</button>
      </div>
    </div>
    <div class="tabs">
      ${navItems.map(n => `<button class="tab ${state.view === n.view ? 'active' : ''}" data-view="${n.view}">${n.label}</button>`).join('')}
    </div>
    <div id="view-content"></div>
    <nav class="bottom-nav">
      ${navItems.map(n => `
        <button class="bottom-nav-item ${state.view === n.view ? 'active' : ''}" data-view="${n.view}">
          <i class="ti ${n.icon}"></i>
          <span>${n.label}</span>
        </button>
      `).join('')}
    </nav>
  `;

  document.getElementById('logout-btn').onclick = async () => {
    await sb.auth.signOut();
  };

  document.querySelectorAll('.tab, .bottom-nav-item').forEach(t => {
    t.onclick = () => { state.view = t.dataset.view; render(); };
  });

  if (state.view === 'feed') renderFeed();
  else if (state.view === 'pods') renderPods();
  else if (state.view === 'leaderboard') renderLeaderboard();
  else if (state.view === 'profile') renderProfile();
}

// ===== FEED =====

async function renderFeed() {
  const container = document.getElementById('view-content');

  const catOptions = state.categories.map(c => ({ value: c.id, label: `${c.emoji} ${c.name}` }));
  const podOptions = [
    { value: '', label: 'Public feed' },
    ...state.pods.filter(p => state.myPodIds.includes(p.id)).map(p => ({ value: p.id, label: `${p.name} (pod only)` }))
  ];

  let selectedCat = state.lastUsedCat != null ? state.lastUsedCat : (state.categories[0] && state.categories[0].id);
  let selectedPod = state.lastUsedPod || '';

  container.innerHTML = `
    <div class="composer">
      <div class="composer-label">Today I will&hellip;</div>
      <textarea id="commit-text" placeholder="Read chapter 4 of Atomic Habits" rows="2"></textarea>
      <div class="composer-row">
        ${renderCustomSelect({ id: 'commit-cat', options: catOptions, value: selectedCat })}
        ${renderCustomSelect({ id: 'commit-pod', options: podOptions, value: selectedPod })}
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--violet);">
          <input type="checkbox" id="commit-milestone" style="width:auto;" /> Milestone
        </label>
        <button class="btn btn-primary" id="commit-submit" style="margin-left:auto">Post</button>
      </div>
    </div>
    <div class="feed-filters" id="feed-filters"></div>
    <div id="feed-list">${skeletonEntries(3)}</div>
  `;

  wireCustomSelect({ id: 'commit-cat', options: catOptions, getValue: () => selectedCat, onChange: (v) => { selectedCat = v; } });
  wireCustomSelect({ id: 'commit-pod', options: podOptions, getValue: () => selectedPod, onChange: (v) => { selectedPod = v; } });

  const filters = document.getElementById('feed-filters');
  filters.innerHTML = `
    <button class="chip ${!state.feedFilter.category ? 'active' : ''}" data-cat="">All</button>
    ${state.categories.map(c => `<button class="chip ${state.feedFilter.category === c.id ? 'active' : ''}" data-cat="${c.id}">${c.emoji} ${esc(c.name)}</button>`).join('')}
  `;
  filters.querySelectorAll('.chip').forEach(chip => {
    chip.onclick = () => {
      state.feedFilter.category = chip.dataset.cat ? parseInt(chip.dataset.cat) : null;
      renderFeed();
    };
  });

  document.getElementById('commit-submit').onclick = async () => {
    const text = document.getElementById('commit-text').value.trim();
    if (!text) return;
    const catId = parseInt(selectedCat);
    const podId = selectedPod || null;
    const isMilestone = document.getElementById('commit-milestone').checked;

    state.lastUsedCat = catId;
    state.lastUsedPod = podId || '';

    const btn = document.getElementById('commit-submit');
    btn.disabled = true;
    btn.textContent = 'Posting…';

    const { error } = await sb.from('commitments').insert({
      user_id: state.user.id,
      category_id: catId,
      pod_id: podId,
      text: text,
      is_milestone: isMilestone
    });

    if (!error) {
      await updateStreak();
      renderFeed();
    } else {
      btn.disabled = false;
      btn.textContent = 'Post';
      await showAlertModal({ title: 'Could not post', message: error.message });
    }
  };

  await loadFeedEntries();
}

async function loadFeedEntries() {
  let query = sb.from('commitments')
    .select('*, profiles(display_name), categories(name, emoji)')
    .order('created_at', { ascending: false })
    .limit(50);

  if (state.feedFilter.category) query = query.eq('category_id', state.feedFilter.category);
  query = query.is('pod_id', null); // public feed excludes pod-only commitments

  const { data, error } = await query;
  const list = document.getElementById('feed-list');

  if (error) {
    list.innerHTML = `<div class="empty-state"><i class="ti ti-wifi-off empty-icon"></i><div class="display">Couldn't load the feed</div>Check your connection and try refreshing.</div>`;
    return;
  }

  if (!data || data.length === 0) {
    if (state.feedFilter.category) {
      const catName = (state.categories.find(c => c.id === state.feedFilter.category) || {}).name || 'this category';
      list.innerHTML = `<div class="empty-state"><i class="ti ti-filter-off empty-icon"></i><div class="display">No ${esc(catName)} entries yet</div>Try a different category, or post the first one.</div>`;
    } else {
      list.innerHTML = `<div class="empty-state"><i class="ti ti-flag-3 empty-icon"></i><div class="display">Your feed starts here</div>Write down something you'll do today, then come back and mark it off.</div>`;
    }
    return;
  }

  list.innerHTML = data.map(entry => renderEntry(entry)).join('');

  wireEntryActions(data);
}

function wireEntryActions(data) {
  data.forEach(entry => {
    if (entry.user_id !== state.user.id) return;
    const doneBtn = document.getElementById(`done-${entry.id}`);
    const missBtn = document.getElementById(`miss-${entry.id}`);
    const delBtn = document.getElementById(`del-${entry.id}`);
    if (doneBtn) doneBtn.onclick = () => resolveCommitment(entry.id, 'done');
    if (missBtn) missBtn.onclick = () => resolveCommitment(entry.id, 'not_done');
    if (delBtn) delBtn.onclick = () => deleteCommitment(entry.id);
  });
}

function renderEntry(entry) {
  const name = entry.profiles ? entry.profiles.display_name : 'Someone';
  const cat = entry.categories || {};
  const isMine = entry.user_id === state.user.id;
  const canResolve = isMine && entry.status === 'pending';

  const markContent = entry.status === 'done' ? '<i class="ti ti-check"></i>'
    : entry.status === 'not_done' ? '<i class="ti ti-x"></i>'
    : '';

  return `
    <div class="entry ${entry.is_milestone ? 'milestone' : ''}">
      <div class="status-mark ${entry.status}">${markContent}</div>
      <div class="entry-body">
        <div class="entry-meta">
          <span class="name">${esc(name)}</span>
          <span>&middot;</span>
          <span>${timeAgo(entry.created_at)}</span>
          <span class="cat-tag">${cat.emoji || ''} ${esc(cat.name || '')}</span>
          ${entry.is_milestone ? '<span class="milestone-tag">Milestone</span>' : ''}
        </div>
        <div class="entry-text">${esc(entry.text)}</div>
        ${entry.outcome_note ? `<div class="entry-note">${esc(entry.outcome_note)}</div>` : ''}
        <div class="entry-actions">
          ${canResolve ? `
            <button class="btn btn-sm action-done" id="done-${entry.id}">Mark done</button>
            <button class="btn btn-sm action-miss" id="miss-${entry.id}">Didn't happen</button>
          ` : ''}
          ${isMine ? `<button class="btn btn-sm btn-delete" id="del-${entry.id}" title="Delete this entry"><i class="ti ti-trash"></i> Delete</button>` : ''}
        </div>
      </div>
    </div>
  `;
}

async function resolveCommitment(id, status) {
  let outcomeNote = null;
  if (status === 'done') {
    outcomeNote = await showPromptModal({
      title: 'Nice work 🎉',
      message: 'Want to add a note about how it went? (optional)',
      placeholder: 'It went well because…',
      optional: true
    });
    if (outcomeNote === '') outcomeNote = null;
  }
  await sb.from('commitments').update({
    status,
    outcome_note: outcomeNote,
    resolved_at: new Date().toISOString()
  }).eq('id', id);
  renderFeed();
}

async function deleteCommitment(id) {
  const confirmed = await showConfirmModal({
    title: 'Delete this entry?',
    message: 'This cannot be undone.',
    confirmLabel: 'Delete',
    danger: true
  });
  if (!confirmed) return;
  const { error } = await sb.from('commitments').delete().eq('id', id);
  if (error) {
    await showAlertModal({ title: 'Could not delete', message: error.message });
    return;
  }
  if (state.view === 'feed') renderFeed();
  else if (state.view === 'profile') renderProfile();
}

// ===== LEADERBOARD =====

async function renderLeaderboard() {
  const container = document.getElementById('view-content');
  container.innerHTML = skeletonLeaderboard(6);

  const { data, error } = await sb
    .from('profiles')
    .select('id, display_name, current_streak, longest_streak')
    .order('current_streak', { ascending: false })
    .limit(50);

  if (error) {
    container.innerHTML = `<div class="empty-state"><i class="ti ti-wifi-off empty-icon"></i><div class="display">Couldn't load the leaderboard</div>Check your connection and try again.</div>`;
    return;
  }

  container.innerHTML = renderLeaderboardTable(data, 'No one has a streak going yet — post something today to be first.');
}

function renderLeaderboardTable(rows, emptyMessage) {
  if (!rows || rows.length === 0) {
    return `<div class="empty-state"><i class="ti ti-trophy empty-icon"></i><div class="display">The board is empty</div>${esc(emptyMessage)}</div>`;
  }

  const rankStyles = {
    1: { bg: '#F0A83B', color: 'white' },   // gold
    2: { bg: '#C9CDD6', color: 'white' },   // silver
    3: { bg: '#D8935B', color: 'white' }    // bronze
  };

  return `
    <div class="leaderboard">
      ${rows.map((r, i) => {
        const isMe = r.id === state.user.id;
        const rank = i + 1;
        const style = rankStyles[rank];
        const rankBadge = style
          ? `<div class="lb-rank lb-rank-medal" style="background:${style.bg};color:${style.color};">${rank}</div>`
          : `<div class="lb-rank">${rank}</div>`;
        return `
          <div class="lb-row ${isMe ? 'lb-me' : ''}">
            ${rankBadge}
            <div class="lb-name">${esc(r.display_name)}${isMe ? ' <span class="lb-you">(you)</span>' : ''}</div>
            <div class="lb-streak">
              <span class="lb-streak-num mono">${r.current_streak || 0}</span>
              <span class="lb-streak-label">day streak</span>
            </div>
            <div class="lb-best">best: ${r.longest_streak || 0}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

async function renderPods() {
  const container = document.getElementById('view-content');
  container.innerHTML = `
    ${isAdmin() ? `<button class="btn btn-primary" id="new-pod-btn" style="margin-bottom:20px"><i class="ti ti-plus"></i> New pod</button>` : ''}
    <div id="pods-list"></div>
  `;

  if (isAdmin()) {
    document.getElementById('new-pod-btn').onclick = showNewPodModal;
  }

  const list = document.getElementById('pods-list');
  if (state.pods.length === 0) {
    list.innerHTML = `<div class="empty-state"><i class="ti ti-users-group empty-icon"></i><div class="display">No pods yet</div>${isAdmin() ? 'Create one to start a smaller circle of accountability.' : 'Check back soon — an admin will set these up.'}</div>`;
    return;
  }

  list.innerHTML = state.pods.map(pod => {
    const isMember = state.myPodIds.includes(pod.id);
    const canEdit = pod.created_by === state.user.id;
    return `
      <div class="pod-card">
        <div>
          <div class="pod-name">${esc(pod.name)}</div>
          ${pod.description ? `<div class="pod-desc">${esc(pod.description)}</div>` : ''}
          <div class="pod-meta">Entries here stay inside the pod — they won't show on the public feed.</div>
        </div>
        <div style="display:flex;gap:6px;">
          ${isMember ? `<button class="btn btn-sm" id="pod-view-${pod.id}">View feed</button>` : ''}
          ${canEdit ? `<button class="btn btn-sm btn-ghost" id="pod-edit-${pod.id}" title="Edit pod"><i class="ti ti-pencil"></i></button>` : ''}
          <button class="btn btn-sm ${isMember ? '' : 'btn-primary'}" id="pod-toggle-${pod.id}">${isMember ? 'Leave' : 'Join'}</button>
        </div>
      </div>
    `;
  }).join('');

  state.pods.forEach(pod => {
    const btn = document.getElementById(`pod-toggle-${pod.id}`);
    const viewBtn = document.getElementById(`pod-view-${pod.id}`);
    const editBtn = document.getElementById(`pod-edit-${pod.id}`);
    if (viewBtn) viewBtn.onclick = () => renderPodFeed(pod);
    if (editBtn) editBtn.onclick = () => showEditPodModal(pod);
    if (!btn) return;
    const isMember = state.myPodIds.includes(pod.id);
    btn.onclick = async () => {
      if (isMember) {
        await sb.from('pod_members').delete().eq('pod_id', pod.id).eq('user_id', state.user.id);
      } else {
        await sb.from('pod_members').insert({ pod_id: pod.id, user_id: state.user.id });
      }
      await loadPods();
      renderPods();
    };
  });
}

function showEditPodModal(pod) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <h3 class="modal-title display">Edit pod</h3>
      <div class="field">
        <label>Name</label>
        <input type="text" id="pod-edit-name" value="${esc(pod.name)}" />
      </div>
      <div class="field">
        <label>Description (optional)</label>
        <textarea id="pod-edit-desc" rows="2">${esc(pod.description || '')}</textarea>
      </div>
      <div id="pod-edit-error"></div>
      <div class="modal-actions">
        <button class="btn" id="pod-edit-cancel">Cancel</button>
        <button class="btn btn-primary" id="pod-edit-save">Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('pod-edit-cancel').onclick = () => overlay.remove();
  document.getElementById('pod-edit-save').onclick = async () => {
    const name = document.getElementById('pod-edit-name').value.trim();
    const errorBox = document.getElementById('pod-edit-error');
    if (!name) {
      errorBox.innerHTML = `<div class="error-msg">Pod name can't be empty.</div>`;
      return;
    }
    const desc = document.getElementById('pod-edit-desc').value.trim();

    const { error } = await sb.from('pods')
      .update({ name, description: desc || null })
      .eq('id', pod.id);

    if (error) {
      errorBox.innerHTML = `<div class="error-msg">Could not save: ${esc(error.message)}</div>`;
      return;
    }
    overlay.remove();
    await loadPods();
    renderPods();
  };
}

async function renderPodFeed(pod) {
  const container = document.getElementById('view-content');
  const catOptions = state.categories.map(c => ({ value: c.id, label: `${c.emoji} ${c.name}` }));
  let podSelectedCat = state.categories[0] && state.categories[0].id;

  container.innerHTML = `
    <button class="btn btn-sm btn-ghost" id="back-to-pods" style="margin-bottom:16px;"><i class="ti ti-arrow-left"></i> All pods</button>
    <div class="pod-tabs">
      <button class="pod-tab active" data-podview="feed">Feed</button>
      <button class="pod-tab" data-podview="leaderboard">Leaderboard</button>
    </div>
    <div id="pod-view-content">
      <div class="composer">
        <div class="composer-label">Today I will&hellip; <span style="color:var(--violet)">(in ${esc(pod.name)})</span></div>
        <textarea id="pod-commit-text" placeholder="Only ${esc(pod.name)} members will see this" rows="2"></textarea>
        <div class="composer-row">
          ${renderCustomSelect({ id: 'pod-commit-cat', options: catOptions, value: podSelectedCat })}
          <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--violet);">
            <input type="checkbox" id="pod-commit-milestone" style="width:auto;" /> Milestone
          </label>
          <button class="btn btn-primary" id="pod-commit-submit" style="margin-left:auto">Post</button>
        </div>
      </div>
      <div id="pod-feed-list">${skeletonEntries(2)}</div>
    </div>
  `;

  wireCustomSelect({ id: 'pod-commit-cat', options: catOptions, getValue: () => podSelectedCat, onChange: (v) => { podSelectedCat = v; } });

  document.getElementById('back-to-pods').onclick = renderPods;

  document.querySelectorAll('.pod-tab').forEach(t => {
    t.onclick = async () => {
      document.querySelectorAll('.pod-tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      if (t.dataset.podview === 'leaderboard') {
        await renderPodLeaderboard(pod);
      } else {
        await renderPodFeedContent(pod);
      }
    };
  });

  document.getElementById('pod-commit-submit').onclick = async () => {
    const text = document.getElementById('pod-commit-text').value.trim();
    if (!text) return;
    const catId = parseInt(podSelectedCat);
    const isMilestone = document.getElementById('pod-commit-milestone').checked;

    const { error } = await sb.from('commitments').insert({
      user_id: state.user.id,
      category_id: catId,
      pod_id: pod.id,
      text: text,
      is_milestone: isMilestone
    });

    if (!error) {
      await updateStreak();
      renderPodFeed(pod);
    } else {
      await showAlertModal({ title: 'Could not post', message: error.message });
    }
  };

  await renderPodFeedContent(pod);
}

async function renderPodFeedContent(pod) {
  const { data, error } = await sb.from('commitments')
    .select('*, profiles(display_name), categories(name, emoji)')
    .eq('pod_id', pod.id)
    .order('created_at', { ascending: false })
    .limit(50);

  const list = document.getElementById('pod-feed-list');
  if (!list) return; // user may have switched tabs already
  if (error) {
    list.innerHTML = `<div class="empty-state"><i class="ti ti-wifi-off empty-icon"></i><div class="display">Couldn't load this pod's feed</div>Check your connection and try refreshing.</div>`;
    return;
  }
  if (!data || data.length === 0) {
    list.innerHTML = `<div class="empty-state"><i class="ti ti-users empty-icon"></i><div class="display">Quiet in here</div>Be the first to post in ${esc(pod.name)}.</div>`;
    return;
  }
  list.innerHTML = data.map(entry => renderEntry(entry)).join('');
  wireEntryActions(data);
}

async function renderPodLeaderboard(pod) {
  const container = document.getElementById('pod-view-content');
  container.innerHTML = skeletonLeaderboard(4);

  const { data: members, error } = await sb
    .from('pod_members')
    .select('profiles(id, display_name, current_streak, longest_streak)')
    .eq('pod_id', pod.id);

  if (error) {
    container.innerHTML = `<div class="empty-state"><i class="ti ti-wifi-off empty-icon"></i><div class="display">Couldn't load this leaderboard</div>Check your connection and try again.</div>`;
    return;
  }

  const rows = (members || [])
    .map(m => m.profiles)
    .filter(Boolean)
    .sort((a, b) => (b.current_streak || 0) - (a.current_streak || 0));

  container.innerHTML = renderLeaderboardTable(rows, `Join ${esc(pod.name)} and post to get on the board.`);
}

function showNewPodModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <h3 class="modal-title display">New pod</h3>
      <div class="field">
        <label>Name</label>
        <input type="text" id="pod-name-input" placeholder="Coding accountability squad" />
      </div>
      <div class="field">
        <label>Description (optional)</label>
        <textarea id="pod-desc-input" placeholder="What's this pod about?" rows="2"></textarea>
      </div>
      <div class="modal-actions">
        <button class="btn" id="pod-cancel">Cancel</button>
        <button class="btn btn-primary" id="pod-create">Create pod</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('pod-cancel').onclick = () => overlay.remove();
  document.getElementById('pod-create').onclick = async () => {
    const name = document.getElementById('pod-name-input').value.trim();
    if (!name) return;
    const desc = document.getElementById('pod-desc-input').value.trim();
    await sb.from('pods').insert({ name, description: desc || null, created_by: state.user.id });
    overlay.remove();
    await loadPods();
    renderPods();
  };
}

// ===== PROFILE =====

async function renderProfile() {
  const container = document.getElementById('view-content');
  const { data: mine } = await sb.from('commitments')
    .select('*, categories(name, emoji)')
    .eq('user_id', state.user.id)
    .order('created_at', { ascending: false });

  const total = mine ? mine.length : 0;
  const done = mine ? mine.filter(c => c.status === 'done').length : 0;

  container.innerHTML = `
    <div class="profile-stats">
      <div class="stat-block">
        <div class="stat-num mono">${state.profile.current_streak}</div>
        <div class="stat-label">current streak</div>
      </div>
      <div class="stat-block">
        <div class="stat-num mono">${state.profile.longest_streak}</div>
        <div class="stat-label">longest streak</div>
      </div>
      <div class="stat-block">
        <div class="stat-num mono">${done}/${total}</div>
        <div class="stat-label">completed</div>
      </div>
    </div>
    <div id="settings-link" style="margin-bottom:24px;">
      <button class="btn btn-sm" id="open-settings"><i class="ti ti-settings"></i> Account settings</button>
    </div>
    <div id="my-entries">
      ${!mine || mine.length === 0
        ? `<div class="empty-state"><i class="ti ti-notebook empty-icon"></i><div class="display">Your history starts here</div>Everything you commit to will show up in this list.<br><button class="btn btn-primary" id="go-to-feed" style="margin-top:16px;">Post your first commitment</button></div>`
        : mine.map(entry => renderEntry({ ...entry, profiles: { display_name: state.profile.display_name } })).join('')}
    </div>
  `;

  document.getElementById('open-settings').onclick = showSettingsModal;
  const goToFeedBtn = document.getElementById('go-to-feed');
  if (goToFeedBtn) goToFeedBtn.onclick = () => { state.view = 'feed'; renderApp(); };

  if (mine && mine.length > 0) wireEntryActions(mine);
}

function showSettingsModal() {
  const currentTime = (state.profile.reminder_time || '20:00:00').slice(0, 5);
  const enabled = state.profile.reminder_enabled !== false;
  const tzList = ['Africa/Lagos','Africa/Cairo','Africa/Nairobi','Africa/Johannesburg','Europe/London','America/New_York','America/Los_Angeles','Asia/Dubai','Asia/Kolkata','Asia/Singapore'];
  const tzOptions = tzList.map(tz => ({ value: tz, label: tz.replace('_', ' ') }));
  let selectedTz = state.profile.timezone || tzList[0];

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <h3 class="modal-title display">Account settings</h3>
      <div class="field">
        <label>Display name</label>
        <input type="text" id="settings-name" value="${esc(state.profile.display_name)}" maxlength="40" />
      </div>
      <div class="field">
        <label style="display:flex;align-items:center;gap:8px;">
          <input type="checkbox" id="settings-enabled" style="width:auto;" ${enabled ? 'checked' : ''} />
          Send me a reminder if I still have something pending
        </label>
      </div>
      <div class="field">
        <label>Remind me at (your local time)</label>
        <input type="time" id="settings-time" value="${currentTime}" />
      </div>
      <div class="field">
        <label>Timezone</label>
        ${renderCustomSelect({ id: 'settings-tz', options: tzOptions, value: selectedTz })}
      </div>
      <div id="settings-error"></div>
      <div class="modal-actions">
        <button class="btn" id="settings-cancel">Cancel</button>
        <button class="btn btn-primary" id="settings-save">Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  wireCustomSelect({ id: 'settings-tz', options: tzOptions, getValue: () => selectedTz, onChange: (v) => { selectedTz = v; } });

  document.getElementById('settings-cancel').onclick = () => overlay.remove();
  document.getElementById('settings-save').onclick = async () => {
    const name = document.getElementById('settings-name').value.trim();
    const time = document.getElementById('settings-time').value || '20:00';
    const tz = selectedTz;
    const enabled = document.getElementById('settings-enabled').checked;
    const errorBox = document.getElementById('settings-error');
    errorBox.innerHTML = '';

    if (!name) {
      errorBox.innerHTML = `<div class="error-msg">Display name can't be empty.</div>`;
      return;
    }

    const saveBtn = document.getElementById('settings-save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    const { error } = await sb.from('profiles').update({
      display_name: name,
      reminder_time: time + ':00',
      timezone: tz,
      reminder_enabled: enabled
    }).eq('id', state.user.id);

    if (error) {
      errorBox.innerHTML = `<div class="error-msg">Could not save: ${esc(error.message)}</div>`;
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
      return;
    }

    state.profile.display_name = name;
    state.profile.reminder_time = time + ':00';
    state.profile.timezone = tz;
    state.profile.reminder_enabled = enabled;
    overlay.remove();
    renderApp(); // refresh header name + profile view
  };
}

init();