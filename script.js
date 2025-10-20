const API_URL = "https://music-back-35mx.onrender.com"; // backend
let tracks = [];
let currentIndex = -1;
let audio = new Audio();
audio.preload = "metadata";

let currentEmail = localStorage.getItem("ms_current_email") || "";

// UI refs (igual ao seu código)
const tracksListEl = document.getElementById("tracks-list");
const playBtn = document.getElementById("play");
const pauseBtn = document.getElementById("pause");
const nextBtn = document.getElementById("next");
const prevBtn = document.getElementById("prev");
const progressEl = document.getElementById("progress");
const titleEl = document.getElementById("track-title");
const subEl = document.getElementById("track-sub");
const coverEl = document.getElementById("cover");

// ================== CACHE DE MÚSICAS ==================
async function cacheMusic(url) {
  if (!('caches' in window)) return;
  try {
    const cache = await caches.open('musicas-cache');
    const match = await cache.match(url);
    if (!match) {
      const response = await fetch(url);
      cache.put(url, response.clone());
    }
  } catch (err) {
    console.error('Erro ao salvar música no cache:', err);
  }
}

// ================== FETCH COM FALLBACK ==================
async function fetchSongs(email) {
  try {
    const res = await fetch(`${API_URL}/songs/${email}`);
    if (!res.ok) throw new Error('Erro ao carregar músicas do servidor');
    const songs = await res.json();

    // Salvar no cache
    if ('caches' in window) {
      const cache = await caches.open('musicas-cache');
      cache.put(`songs/${email}`, new Response(JSON.stringify(songs)));
    }

    return songs;
  } catch (err) {
    console.warn('Falha ao buscar músicas do servidor, tentando cache...');
    if ('caches' in window) {
      const cache = await caches.open('musicas-cache');
      const cached = await cache.match(`songs/${email}`);
      if (cached) return cached.json();
    }
    return []; // fallback vazio
  }
}

// ================== TOCAR MÚSICA ==================
async function startPlayByIndex(i) {
  if (!tracks[i]) return;
  currentIndex = i;
  const t = tracks[i];

  // Salva música no cache antes de tocar
  await cacheMusic(t.url);

  audio.src = t.url;
  audio.play();
  updatePlayerUI(t);
}

function updatePlayerUI(t) {
  titleEl.textContent = t.name;
  subEl.textContent = `${t.artist} • ${t.album}`;
  coverEl.style.background = "#222";
  coverEl.src = "";
}

// ================== CONTROLES ==================
audio.ontimeupdate = () => {
  const cur = audio.currentTime || 0;
  const dur = audio.duration || 0;
  progressEl.value = dur ? (cur / dur) * 100 : 0;
};

progressEl.oninput = () => {
  const dur = audio.duration || 0;
  audio.currentTime = (progressEl.value / 100) * dur;
};

playBtn.onclick = () => audio.play();
pauseBtn.onclick = () => audio.pause();
nextBtn.onclick = () => {
  if (tracks.length) {
    currentIndex = (currentIndex + 1) % tracks.length;
    startPlayByIndex(currentIndex);
  }
};
prevBtn.onclick = () => {
  if (tracks.length) {
    currentIndex = (currentIndex - 1 + tracks.length) % tracks.length;
    startPlayByIndex(currentIndex);
  }
};

// ================== INIT ==================
async function init() {
  if (currentEmail) {
    const songs = await fetchSongs(currentEmail);
    tracks = songs.map((s) => ({
      id: s.filename,
      name: s.original,
      artist: "Desconhecido",
      album: "—",
      url: `${API_URL}/uploads/${s.filename}`
    }));
    renderTracks();
  }
}

function renderTracks() {
  tracksListEl.innerHTML = "";
  if (!tracks.length) {
    tracksListEl.innerHTML = `<div style="color:var(--muted);padding:20px">Nenhuma faixa encontrada.</div>`;
    return;
  }
  tracks.forEach((t, i) => {
    const card = document.createElement("div");
    card.className = "track-card";
    card.innerHTML = `
      <div class="track-cover">${t.name.slice(0, 2).toUpperCase()}</div>
      <div class="track-meta"><div class="title">${t.name}</div><div class="sub">${t.artist} • ${t.album}</div></div>
      <div class="track-actions">
        <button onclick="startPlayByIndex(${i})">▶ Tocar</button>
      </div>`;
    tracksListEl.appendChild(card);
  });
}

window.addEventListener("load", init);

// ================== REGISTRO SERVICE WORKER ==================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(() => console.log('Service Worker registrado com sucesso'))
      .catch(err => console.log('Erro ao registrar Service Worker:', err));
  });
}
