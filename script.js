/* Meu Spotify Offline - Vanilla JS + IndexedDB + Login por email */

const DB_NAME = 'meu_spotify_db';
const DB_STORE = 'tracks';
let db;
let tracks = [];
let currentIndex = -1;
let audio = new Audio();
audio.preload = 'metadata';

let currentEmail = localStorage.getItem('ms_current_email') || '';

// UI refs
const fileInput = document.getElementById('file-input');
const btnAddFiles = document.getElementById('btn-add-files');
const btnAddUrl = document.getElementById('btn-add-url');
const btnRefresh = document.getElementById('btn-refresh');
const tracksListEl = document.getElementById('tracks-list');
const searchEl = document.getElementById('search');
const coverEl = document.getElementById('cover');
const titleEl = document.getElementById('track-title');
const subEl = document.getElementById('track-sub');
const playBtn = document.getElementById('play');
const pauseBtn = document.getElementById('pause');
const nextBtn = document.getElementById('next');
const prevBtn = document.getElementById('prev');
const progressEl = document.getElementById('progress');
const timeCurrent = document.getElementById('time-current');
const timeDuration = document.getElementById('time-duration');
const modalUrl = document.getElementById('modal-url');
const downloadUrlInput = document.getElementById('download-url');
const downloadStart = document.getElementById('download-start');
const downloadCancel = document.getElementById('download-cancel');
const btnRefreshEl = document.getElementById('btn-refresh');

// Login UI
const loginScreen = document.getElementById('login-screen');
const loginEmail = document.getElementById('login-email');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const app = document.querySelector('.app');

//// IndexedDB helper ////
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const idb = e.target.result;
      if (!idb.objectStoreNames.contains(DB_STORE)) {
        const store = idb.createObjectStore(DB_STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('artist', 'artist', { unique: false });
        store.createIndex('email', 'email', { unique: false }); // para separar usuários
      }
    };
    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror = (e) => reject(e);
  });
}

function addTrackToDB(obj) {
  obj.email = currentEmail; // salva o e-mail do usuário
  return new Promise((resolve, reject) => {
    const tx = db.transaction([DB_STORE], 'readwrite');
    const store = tx.objectStore(DB_STORE);
    const req = store.add(obj);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e);
  });
}

function getAllTracksFromDB() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([DB_STORE], 'readonly');
    const store = tx.objectStore(DB_STORE);
    const index = store.index('email');
    const req = index.getAll(IDBKeyRange.only(currentEmail));
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e);
  });
}

function deleteTrackFromDB(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([DB_STORE], 'readwrite');
    const store = tx.objectStore(DB_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e);
  });
}

//// utilities
function fmtTime(sec = 0) {
  if (!isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

async function init() {
  if (currentEmail) {
    loginScreen.classList.add('hidden');
    app.classList.remove('hidden');
    document.body.style.overflow = 'auto';
    await openDB();
    await loadTracksFromDB();
    renderPlaylists();
    registerServiceWorker();
  } else {
    loginScreen.classList.remove('hidden');
    app.classList.add('hidden');
    document.body.style.overflow = 'hidden';
  }
}

async function loadTracksFromDB() {
  const rows = await getAllTracksFromDB();
  tracks = rows.map(r => {
    const url = URL.createObjectURL(r.blob);
    return {
      id: r.id, name: r.name, artist: r.artist || 'Desconhecido',
      album: r.album || '—', blob: r.blob, url, duration: r.duration || 0, coverBlob: r.coverBlob || null
    };
  });
  renderTracks();
}

function renderTracks(filter = '') {
  tracksListEl.innerHTML = '';
  const q = filter.trim().toLowerCase();
  const filtered = tracks.filter(t => {
    if (!q) return true;
    return (t.name || '').toLowerCase().includes(q) || (t.artist || '').toLowerCase().includes(q) || (t.album || '').toLowerCase().includes(q);
  });

  if (filtered.length === 0) {
    tracksListEl.innerHTML = `<div style="color:var(--muted);padding:20px">Nenhuma faixa encontrada — adicione suas músicas.</div>`;
    return;
  }

  for (const t of filtered) {
    const card = document.createElement('div');
    card.className = 'track-card';
    const cover = document.createElement('div');
    cover.className = 'track-cover';
    if (t.coverBlob) {
      const u = URL.createObjectURL(t.coverBlob);
      cover.style.backgroundImage = `url(${u})`;
      cover.style.backgroundSize = 'cover';
    } else {
      cover.textContent = t.name.slice(0, 2).toUpperCase();
    }

    const meta = document.createElement('div');
    meta.className = 'track-meta';
    meta.innerHTML = `<div class="title">${t.name}</div><div class="sub">${t.artist} • ${t.album}</div>`;

    const actions = document.createElement('div');
    actions.className = 'track-actions';
    const btnPlay = document.createElement('button');
    btnPlay.textContent = '▶ Tocar';
    btnPlay.onclick = () => {
      const idx = tracks.findIndex(x => x.id === t.id);
      if (idx >= 0) startPlayByIndex(idx);
    };

    const btnDelete = document.createElement('button');
    btnDelete.textContent = '🗑 Remover';
    btnDelete.onclick = async () => {
      if (!confirm('Remover essa faixa do banco local?')) return;
      await deleteTrackFromDB(t.id);
      URL.revokeObjectURL(t.url);
      await loadTracksFromDB();
    };

    actions.appendChild(btnPlay);
    actions.appendChild(btnDelete);

    card.appendChild(cover);
    card.appendChild(meta);
    card.appendChild(actions);
    tracksListEl.appendChild(card);
  }
}

// File upload
async function handleFiles(files) {
  const list = Array.from(files);
  for (const file of list) {
    await addFileAsTrack(file);
  }
  await loadTracksFromDB();
}

async function addFileAsTrack(file) {
  const blob = file.slice(0, file.size, file.type);
  const tmpUrl = URL.createObjectURL(blob);
  const tmpAudio = new Audio(tmpUrl);
  const dur = await new Promise((res) => {
    tmpAudio.addEventListener('loadedmetadata', () => { res(tmpAudio.duration || 0); URL.revokeObjectURL(tmpUrl); });
    tmpAudio.addEventListener('error', () => { res(0); URL.revokeObjectURL(tmpUrl); });
  });

  await addTrackToDB({ name: file.name, artist: '', album: '', blob, duration: dur, coverBlob: null });
}

// Playback
async function startPlayByIndex(i) {
  if (!tracks[i]) return;
  currentIndex = i;
  const t = tracks[i];
  audio.src = t.url;
  audio.play();
  updatePlayerUI(t);
}

function updatePlayerUI(t) {
  titleEl.textContent = t.name;
  subEl.textContent = `${t.artist} • ${t.album}`;
  if (t.coverBlob) {
    coverEl.src = URL.createObjectURL(t.coverBlob);
  } else {
    coverEl.src = '';
    coverEl.style.background = '#222';
  }
}

audio.ontimeupdate = () => {
  const cur = audio.currentTime || 0;
  const dur = audio.duration || tracks[currentIndex]?.duration || 0;
  progressEl.value = (dur ? (cur / dur) * 100 : 0);
  timeCurrent.textContent = fmtTime(cur);
  timeDuration.textContent = fmtTime(dur);
};

progressEl.oninput = () => {
  const dur = audio.duration || tracks[currentIndex]?.duration || 0;
  audio.currentTime = (progressEl.value / 100) * dur;
};

playBtn.onclick = () => audio.play();
pauseBtn.onclick = () => audio.pause();
nextBtn.onclick = () => { if (tracks.length) { currentIndex = (currentIndex + 1) % tracks.length; startPlayByIndex(currentIndex); } };
prevBtn.onclick = () => { if (tracks.length) { currentIndex = (currentIndex - 1 + tracks.length) % tracks.length; startPlayByIndex(currentIndex); } };
audio.onended = () => { if (tracks.length) { currentIndex = (currentIndex + 1) % tracks.length; startPlayByIndex(currentIndex); } };

// Search
searchEl.addEventListener('input', (e) => renderTracks(e.target.value));

// Buttons
btnAddFiles.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

btnAddUrl.addEventListener('click', () => {
  modalUrl.classList.remove('hidden');
  downloadUrlInput.value = '';
});
downloadCancel.addEventListener('click', () => modalUrl.classList.add('hidden'));

downloadStart.addEventListener('click', async () => {
  const url = downloadUrlInput.value.trim();
  if (!url) return alert('Cole uma URL válida');
  modalUrl.classList.add('hidden');
  try {
    await downloadAndStore(url);
    alert('Download salvo no seu banco local!');
    await loadTracksFromDB();
  } catch (err) {
    console.error(err);
    alert('Erro ao baixar (provável CORS). Baixe manualmente e importe.');
  }
});

btnRefreshEl.addEventListener('click', () => loadTracksFromDB());

async function downloadAndStore(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Resposta inválida: ' + resp.status);
  const blob = await resp.blob();
  let name = url.split('/').pop() || 'download.mp3';
  const tmpUrl = URL.createObjectURL(blob);
  const tmpAudio = new Audio(tmpUrl);
  const dur = await new Promise(res => {
    tmpAudio.addEventListener('loadedmetadata', () => { res(tmpAudio.duration || 0); URL.revokeObjectURL(tmpUrl); });
    tmpAudio.addEventListener('error', () => { res(0); URL.revokeObjectURL(tmpUrl); });
  });
  await addTrackToDB({ name, artist: '', album: '', blob, duration: dur, coverBlob: null });
}

// Playlists
function renderPlaylists() {
  const container = document.getElementById('playlists-list');
  container.innerHTML = '';
  const stored = JSON.parse(localStorage.getItem(`ms_playlists_${currentEmail}`) || '[]');
  if (stored.length === 0) {
    container.innerHTML = `<li style="color:var(--muted)">Sem playlists</li>`;
    return;
  }
  stored.forEach(p => {
    const li = document.createElement('li');
    li.textContent = `${p.name} (${p.trackIds.length})`;
    li.onclick = async () => {
      const all = await getAllTracksFromDB();
      const t = all.find(x => x.id === p.trackIds[0]);
      if (t) {
        await loadTracksFromDB();
        const idx = tracks.findIndex(x => x.id === t.id);
        if (idx >= 0) startPlayByIndex(idx);
      } else alert('Playlist vazia ou faixas removidas.');
    };
    container.appendChild(li);
  });
}

document.getElementById('create-playlist').addEventListener('click', () => {
  const name = document.getElementById('new-playlist-name').value.trim();
  if (!name) return alert('Nome inválido');
  const stored = JSON.parse(localStorage.getItem(`ms_playlists_${currentEmail}`) || '[]');
  stored.push({ name, trackIds: [] });
  localStorage.setItem(`ms_playlists_${currentEmail}`, JSON.stringify(stored));
  document.getElementById('new-playlist-name').value = '';
  renderPlaylists();
});

document.getElementById('save-playlist').addEventListener('click', async () => {
  if (tracks.length === 0) return alert('Nenhuma faixa para salvar');
  const stored = JSON.parse(localStorage.getItem(`ms_playlists_${currentEmail}`) || '[]');
  const name = prompt('Nome da playlist:', `Minha playlist ${new Date().toLocaleString()}`);
  if (!name) return;
  const trackIds = tracks.map(t => t.id);
  stored.push({ name, trackIds });
  localStorage.setItem(`ms_playlists_${currentEmail}`, JSON.stringify(stored));
  renderPlaylists();
});

// Login / Logout
loginBtn.onclick = () => {
  const email = loginEmail.value.trim().toLowerCase();
  if (!email) return alert('Digite um e-mail válido');
  currentEmail = email;
  localStorage.setItem('ms_current_email', currentEmail);
  loginScreen.classList.add('hidden');
  app.classList.remove('hidden');
  document.body.style.overflow = 'auto';
  openDB().then(loadTracksFromDB).then(renderPlaylists).then(registerServiceWorker);
};

logoutBtn.onclick = () => {
  currentEmail = '';
  localStorage.removeItem('ms_current_email');
  loginScreen.classList.remove('hidden');
  app.classList.add('hidden');
  document.body.style.overflow = 'hidden';
};

// Service Worker
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(err => console.warn('SW registration failed', err));
  }
}

window.addEventListener('load', init);
