import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const cfg = window.APP_CONFIG || {};
const setupStatus = document.getElementById('setupStatus');
const setupPanel = document.getElementById('setupPanel');
const authPanel = document.getElementById('authPanel');
const appMain = document.getElementById('appMain');
const bottomNav = document.getElementById('bottomNav');
const signOutBtn = document.getElementById('signOutBtn');
const syncStatus = document.getElementById('syncStatus');

const PLACEHOLDER_URL = 'https://YOUR_PROJECT.supabase.co';
const PLACEHOLDER_KEY = 'YOUR_PUBLISHABLE_OR_ANON_KEY';
let supabase = null;

if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || cfg.SUPABASE_URL === PLACEHOLDER_URL || cfg.SUPABASE_ANON_KEY === PLACEHOLDER_KEY) {
  setupStatus.textContent = '未設定です。config.js の SUPABASE_URL / SUPABASE_ANON_KEY を置き換えてください。';
} else {
  setupStatus.textContent = '設定OK。ログインしてください。';
  supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
}

const el = {
  email: document.getElementById('emailInput'),
  password: document.getElementById('passwordInput'),
  signIn: document.getElementById('signInBtn'),
  sessionDate: document.getElementById('sessionDate'),
  bodyweight: document.getElementById('bodyweight'),
  sessionPain: document.getElementById('sessionPain'),
  sessionNote: document.getElementById('sessionNote'),
  exerciseName: document.getElementById('exerciseName'),
  weightKg: document.getElementById('weightKg'),
  reps: document.getElementById('reps'),
  setsCount: document.getElementById('setsCount'),
  rir: document.getElementById('rir'),
  setPain: document.getElementById('setPain'),
  setNote: document.getElementById('setNote'),
  addSet: document.getElementById('addSetBtn'),
  copyLast: document.getElementById('copyLastBtn'),
  saveSession: document.getElementById('saveSessionBtn'),
  entryList: document.getElementById('entryList'),
  todaySummary: document.getElementById('todaySummary'),
  entryTpl: document.getElementById('entryItemTpl'),
  historyTpl: document.getElementById('historyItemTpl'),
  historyList: document.getElementById('historyList'),
  refresh: document.getElementById('refreshBtn'),
  newSession: document.getElementById('newSessionBtn'),
  duplicateLast: document.getElementById('duplicateLastBtn'),
  chips: document.getElementById('exerciseChips'),
  exerciseList: document.getElementById('exerciseList')
};

const draftKey = 'workout-log-draft-v2';
const presets = ['ベンチプレス', 'スクワット', 'レッグプレス', 'ラットプル', 'シーテッドロウ', 'チェストプレス', 'サイドレイズ', 'アームカール'];
let currentUser = null;
let currentSessionId = null;
let entries = [];
let historyRows = [];
let editingEntryIndex = null;

function isoToday() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

function toast(message, kind='ok') {
  const div = document.createElement('div');
  div.className = 'toast';
  div.textContent = message;
  if (kind === 'err') div.style.borderColor = '#7f1d1d';
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 2600);
}

function setLoading(message) {
  syncStatus.textContent = message;
}

function normalizeEntry(entry) {
  return {
    exercise_name: (entry.exercise_name || '').trim(),
    weight_kg: entry.weight_kg === '' || entry.weight_kg == null ? null : Number(entry.weight_kg),
    reps: entry.reps === '' || entry.reps == null ? null : Number(entry.reps),
    sets: entry.sets === '' || entry.sets == null ? 1 : Number(entry.sets),
    rir: entry.rir === '' || entry.rir == null ? null : Number(entry.rir),
    pain_0_10: entry.pain_0_10 === '' || entry.pain_0_10 == null ? null : Number(entry.pain_0_10),
    note: (entry.note || '').trim()
  };
}

function readDraft() {
  try {
    const raw = localStorage.getItem(draftKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeDraft() {
  const payload = {
    currentSessionId,
    sessionDate: el.sessionDate.value,
    bodyweight: el.bodyweight.value,
    sessionPain: el.sessionPain.value,
    sessionNote: el.sessionNote.value,
    entries
  };
  localStorage.setItem(draftKey, JSON.stringify(payload));
}

function clearDraft() {
  localStorage.removeItem(draftKey);
}

function resetCurrentSession({ keepDate = false } = {}) {
  currentSessionId = null;
  entries = [];
  editingEntryIndex = null;
  el.bodyweight.value = '';
  el.sessionPain.value = '0';
  el.sessionNote.value = '';
  if (!keepDate) el.sessionDate.value = isoToday();
  renderEntries();
  writeDraft();
}

function fillFromSession(row, { clone = false } = {}) {
  currentSessionId = clone ? null : row.id;
  el.sessionDate.value = clone ? isoToday() : row.workout_date;
  el.bodyweight.value = row.bodyweight_kg ?? '';
  el.sessionPain.value = row.pain_shoulder ?? 0;
  el.sessionNote.value = row.session_note || '';
  entries = Array.isArray(row.entries) ? row.entries.map(normalizeEntry) : [];
  editingEntryIndex = null;
  renderEntries();
  writeDraft();
}

function currentPayload() {
  return {
    workout_date: el.sessionDate.value || isoToday(),
    bodyweight_kg: el.bodyweight.value === '' ? null : Number(el.bodyweight.value),
    pain_shoulder: el.sessionPain.value === '' ? 0 : Number(el.sessionPain.value),
    session_note: el.sessionNote.value.trim(),
    entries: entries.map(normalizeEntry)
  };
}

function formEntry() {
  const entry = normalizeEntry({
    exercise_name: el.exerciseName.value,
    weight_kg: el.weightKg.value,
    reps: el.reps.value,
    sets: el.setsCount.value,
    rir: el.rir.value,
    pain_0_10: el.setPain.value,
    note: el.setNote.value
  });
  if (!entry.exercise_name) {
    toast('種目名は必須', 'err');
    return null;
  }
  return entry;
}

function resetEntryForm() {
  el.exerciseName.value = '';
  el.weightKg.value = '';
  el.reps.value = '';
  el.setsCount.value = '1';
  el.rir.value = '';
  el.setPain.value = '';
  el.setNote.value = '';
  editingEntryIndex = null;
}

function renderEntries() {
  if (!entries.length) {
    el.entryList.className = 'entry-list empty-state';
    el.entryList.textContent = 'まだ何も追加していません。';
    el.todaySummary.textContent = '0種目';
    return;
  }
  el.entryList.className = 'entry-list';
  el.entryList.innerHTML = '';
  entries.forEach((entry, idx) => {
    const node = el.entryTpl.content.firstElementChild.cloneNode(true);
    node.querySelector('h4').textContent = entry.exercise_name;
    node.querySelector('.entry-meta').textContent =
      `重量 ${entry.weight_kg ?? '-'}kg / 回数 ${entry.reps ?? '-'} / セット ${entry.sets ?? '-'} / RIR ${entry.rir ?? '-'} / 痛み ${entry.pain_0_10 ?? '-'}`;
    node.querySelector('.entry-note').textContent = entry.note || 'メモなし';
    node.querySelector('.edit-entry').addEventListener('click', () => {
      editingEntryIndex = idx;
      el.exerciseName.value = entry.exercise_name || '';
      el.weightKg.value = entry.weight_kg ?? '';
      el.reps.value = entry.reps ?? '';
      el.setsCount.value = entry.sets ?? 1;
      el.rir.value = entry.rir ?? '';
      el.setPain.value = entry.pain_0_10 ?? '';
      el.setNote.value = entry.note || '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    node.querySelector('.delete-entry').addEventListener('click', () => {
      entries.splice(idx, 1);
      renderEntries();
      writeDraft();
    });
    el.entryList.appendChild(node);
  });
  el.todaySummary.textContent = `${entries.length}種目`;
}

function renderHistory() {
  if (!historyRows.length) {
    el.historyList.className = 'history-list empty-state';
    el.historyList.textContent = '保存済みの記録はまだありません。';
    return;
  }
  el.historyList.className = 'history-list';
  el.historyList.innerHTML = '';
  historyRows.forEach((row) => {
    const node = el.historyTpl.content.firstElementChild.cloneNode(true);
    node.querySelector('h4').textContent = `${row.workout_date} / ${row.entries?.length ?? 0}種目`;
    node.querySelector('.history-meta').textContent =
      `体重 ${row.bodyweight_kg ?? '-'}kg / 肩痛 ${row.pain_shoulder ?? 0} / 更新 ${new Date(row.updated_at).toLocaleString('ja-JP')}`;
    node.querySelector('.history-note').textContent = row.session_note || 'メモなし';
    node.querySelector('.load-session').addEventListener('click', () => {
      fillFromSession(row, { clone: false });
      showPanel('todayPanel');
      toast('履歴を読み込みました');
    });
    node.querySelector('.clone-session').addEventListener('click', () => {
      fillFromSession(row, { clone: true });
      showPanel('todayPanel');
      toast('前回内容を複製しました');
    });
    node.querySelector('.delete-session').addEventListener('click', async () => {
      if (!confirm('この履歴を削除しますか？')) return;
      const { error } = await supabase.from('workout_logs').delete().eq('id', row.id);
      if (error) {
        toast(`削除失敗: ${error.message}`, 'err');
        return;
      }
      if (currentSessionId === row.id) resetCurrentSession({ keepDate: true });
      await loadHistory();
      toast('削除しました');
    });
    el.historyList.appendChild(node);
  });
}

function showPanel(targetId) {
  document.querySelectorAll('main > .panel').forEach(panel => panel.classList.add('hidden'));
  document.getElementById(targetId).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.target === targetId);
  });
}

function renderChips() {
  el.chips.innerHTML = '';
  el.exerciseList.innerHTML = '';
  presets.forEach(name => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = name;
    chip.addEventListener('click', () => { el.exerciseName.value = name; });
    el.chips.appendChild(chip);

    const opt = document.createElement('option');
    opt.value = name;
    el.exerciseList.appendChild(opt);
  });
}

async function loadHistory() {
  setLoading('履歴を読込中...');
  const { data, error } = await supabase
    .from('workout_logs')
    .select('id, workout_date, bodyweight_kg, pain_shoulder, session_note, entries, created_at, updated_at')
    .order('workout_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    setLoading(`読込失敗: ${error.message}`);
    toast(`読込失敗: ${error.message}`, 'err');
    return;
  }
  historyRows = data || [];
  renderHistory();
  setLoading('保存先: Supabase / GitHub反映は自動同期');
}

async function signIn() {
  if (!supabase) return;
  setLoading('ログイン中...');
  const { error } = await supabase.auth.signInWithPassword({
    email: el.email.value.trim(),
    password: el.password.value
  });
  if (error) {
    setLoading('ログイン失敗');
    toast(`ログイン失敗: ${error.message}`, 'err');
    return;
  }
  toast('ログインしました');
}

async function handleAuth(session) {
  currentUser = session?.user || null;
  const loggedIn = Boolean(currentUser);
  authPanel.classList.toggle('hidden', loggedIn);
  appMain.classList.toggle('hidden', !loggedIn);
  bottomNav.classList.toggle('hidden', !loggedIn);
  signOutBtn.classList.toggle('hidden', !loggedIn);
  if (loggedIn) {
    await loadHistory();
  }
}

async function saveSession() {
  if (!currentUser) return;
  if (!entries.length) {
    toast('1種目以上追加してから保存してください', 'err');
    return;
  }
  const payload = {
    user_id: currentUser.id,
    ...currentPayload()
  };
  setLoading('クラウド保存中...');
  let result;
  if (currentSessionId) {
    result = await supabase.from('workout_logs').update(payload).eq('id', currentSessionId).select('id').single();
  } else {
    result = await supabase.from('workout_logs').insert(payload).select('id').single();
  }
  if (result.error) {
    setLoading(`保存失敗: ${result.error.message}`);
    toast(`保存失敗: ${result.error.message}`, 'err');
    return;
  }
  currentSessionId = result.data.id;
  writeDraft();
  await loadHistory();
  setLoading('保存完了。GitHub側は自動同期待ち');
  toast('保存しました');
}

async function copyLastExercise() {
  const exerciseName = el.exerciseName.value.trim();
  if (!exerciseName) {
    toast('先に種目名を入れてください', 'err');
    return;
  }
  for (const row of historyRows) {
    const match = (row.entries || []).find(x => x.exercise_name === exerciseName);
    if (match) {
      el.weightKg.value = match.weight_kg ?? '';
      el.reps.value = match.reps ?? '';
      el.setsCount.value = match.sets ?? 1;
      el.rir.value = match.rir ?? '';
      el.setPain.value = match.pain_0_10 ?? '';
      el.setNote.value = match.note ?? '';
      toast('前回の同種目をコピーしました');
      return;
    }
  }
  toast('同種目の履歴がありません', 'err');
}

async function duplicateLastSession() {
  if (!historyRows.length) {
    toast('履歴がありません', 'err');
    return;
  }
  fillFromSession(historyRows[0], { clone: true });
  showPanel('todayPanel');
  toast('前回内容を複製しました');
}

function addEntry() {
  const entry = formEntry();
  if (!entry) return;
  if (editingEntryIndex != null) {
    entries.splice(editingEntryIndex, 1, entry);
  } else {
    entries.push(entry);
  }
  renderEntries();
  resetEntryForm();
  writeDraft();
}

function bootDraft() {
  const draft = readDraft();
  if (!draft) {
    el.sessionDate.value = isoToday();
    return;
  }
  currentSessionId = draft.currentSessionId || null;
  el.sessionDate.value = draft.sessionDate || isoToday();
  el.bodyweight.value = draft.bodyweight || '';
  el.sessionPain.value = draft.sessionPain || '0';
  el.sessionNote.value = draft.sessionNote || '';
  entries = Array.isArray(draft.entries) ? draft.entries.map(normalizeEntry) : [];
  renderEntries();
}

function bindNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showPanel(btn.dataset.target));
  });
}

function bindInputs() {
  [el.sessionDate, el.bodyweight, el.sessionPain, el.sessionNote].forEach(node => {
    node.addEventListener('input', writeDraft);
  });
}

async function init() {
  renderChips();
  bootDraft();
  bindNav();
  bindInputs();
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
  el.signIn.addEventListener('click', signIn);
  signOutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    resetCurrentSession();
    toast('ログアウトしました');
  });
  el.addSet.addEventListener('click', addEntry);
  el.copyLast.addEventListener('click', copyLastExercise);
  el.saveSession.addEventListener('click', saveSession);
  el.refresh.addEventListener('click', loadHistory);
  el.newSession.addEventListener('click', () => resetCurrentSession());
  el.duplicateLast.addEventListener('click', duplicateLastSession);

  if (!supabase) return;

  const { data } = await supabase.auth.getSession();
  await handleAuth(data.session);
  supabase.auth.onAuthStateChange(async (_event, session) => {
    await handleAuth(session);
  });
}

init().catch(err => {
  console.error(err);
  toast(`初期化失敗: ${err.message}`, 'err');
});
