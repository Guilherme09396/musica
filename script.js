/* Meu Spotify Online (com backend Node.js + Express) */

const API_URL = "https://music-back-35mx.onrender.com"; // backend local
let tracks = [];
let currentIndex = -1;
let audio = new Audio();
audio.preload = "metadata";

let currentEmail = localStorage.getItem("ms_current_email") || "";

// UI refs
const fileInput = document.getElementById("file-input");
const btnAddFiles = document.getElementById("btn-add-files");
const tracksListEl = document.getElementById("tracks-list");
const searchEl = document.getElementById("search");
const coverEl = document.getElementById("cover");
const titleEl = document.getElementById("track-title");
const subEl = document.getElementById("track-sub");
const playBtn = document.getElementById("play");
const pauseBtn = document.getElementById("pause");
const nextBtn = document.getElementById("next");
const prevBtn = document.getElementById("prev");
const progressEl = document.getElementById("progress");
const timeCurrent = document.getElementById("time-current");
const timeDuration = document.getElementById("time-duration");
const btnRefresh = document.getElementById("btn-refresh");

// Login UI
const loginScreen = document.getElementById("login-screen");
const loginEmail = document.getElementById("login-email");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const app = document.querySelector(".app");

// =============== API =================

async function uploadMusic(file, email) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("email", email);

  const res = await fetch(`${API_URL}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error("Erro ao enviar arquivo");
  return res.json();
}

async function fetchSongs(email) {
  const res = await fetch(`${API_URL}/songs/${email}`);
  if (!res.ok) throw new Error("Erro ao carregar músicas");
  return res.json();
}

// =============== APP =================

async function init() {
  if (currentEmail) {
    loginScreen.classList.add("hidden");
    app.classList.remove("hidden");
    document.body.style.overflow = "auto";
    await loadTracksFromServer();
  } else {
    loginScreen.classList.remove("hidden");
    app.classList.add("hidden");
    document.body.style.overflow = "hidden";
  }
}

async function loadTracksFromServer() {
  try {
    const songs = await fetchSongs(currentEmail);
    tracks = songs.map((s) => ({
      id: s.filename,
      name: s.original,
      artist: "Desconhecido",
      album: "—",
      url: `${API_URL}/uploads/${s.filename}`,
      duration: 0,
    }));
    renderTracks();
  } catch (err) {
    console.error(err);
    tracksListEl.innerHTML = `<div style="color:var(--muted);padding:20px">Erro ao carregar músicas.</div>`;
  }
}

function renderTracks(filter = "") {
  tracksListEl.innerHTML = "";
  const q = filter.trim().toLowerCase();
  const filtered = tracks.filter((t) =>
    (t.name || "").toLowerCase().includes(q)
  );

  if (filtered.length === 0) {
    tracksListEl.innerHTML = `<div style="color:var(--muted);padding:20px">Nenhuma faixa encontrada — adicione suas músicas.</div>`;
    return;
  }

  for (const t of filtered) {
    const card = document.createElement("div");
    card.className = "track-card";

    // capa
    const cover = document.createElement("div");
    cover.className = "track-cover";
    cover.textContent = t.name.slice(0, 2).toUpperCase();

    // metadados
    const meta = document.createElement("div");
    meta.className = "track-meta";
    meta.innerHTML = `<div class="title">${t.name}</div><div class="sub">${t.artist} • ${t.album}</div>`;

    // ações
    const actions = document.createElement("div");
    actions.className = "track-actions";

    // botão tocar
    const btnPlay = document.createElement("button");
    btnPlay.textContent = "▶ Tocar";
    btnPlay.onclick = () => {
      const idx = tracks.findIndex((x) => x.id === t.id);
      if (idx >= 0) startPlayByIndex(idx);
    };

    // botão excluir
    const btnDelete = document.createElement("button");
    btnDelete.textContent = "🗑 Excluir";
    btnDelete.onclick = async () => {
      if (!confirm("Deseja excluir esta música?")) return;
      try {
        await fetch(`${API_URL}/songs/${currentEmail}/${t.filename}`, {
          method: "DELETE",
        });
        await loadTracksFromServer();
      } catch (err) {
        console.error("Erro ao deletar música:", err);
        alert("Falha ao excluir a música do servidor.");
      }
    };

    // montar card
    actions.appendChild(btnPlay);
    actions.appendChild(btnDelete);
    card.appendChild(cover);
    card.appendChild(meta);
    card.appendChild(actions);
    tracksListEl.appendChild(card);
  }
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
  coverEl.style.background = "#222";
  coverEl.src = "";
}

audio.ontimeupdate = () => {
  const cur = audio.currentTime || 0;
  const dur = audio.duration || 0;
  progressEl.value = dur ? (cur / dur) * 100 : 0;
  timeCurrent.textContent = fmtTime(cur);
  timeDuration.textContent = fmtTime(dur);
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
audio.onended = () => {
  if (tracks.length) {
    currentIndex = (currentIndex + 1) % tracks.length;
    startPlayByIndex(currentIndex);
  }
};

function fmtTime(sec = 0) {
  if (!isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// Upload handler
btnAddFiles.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", async (e) => {
  const files = Array.from(e.target.files);
  for (const f of files) {
    await uploadMusic(f, currentEmail);
  }
  await loadTracksFromServer();
});

// Search
searchEl.addEventListener("input", (e) => renderTracks(e.target.value));
btnRefresh.addEventListener("click", () => loadTracksFromServer());

// Login / Logout
loginBtn.onclick = async () => {
  const email = loginEmail.value.trim().toLowerCase();
  if (!email) return alert("Digite um e-mail válido");
  currentEmail = email;
  localStorage.setItem("ms_current_email", currentEmail);
  loginScreen.classList.add("hidden");
  app.classList.remove("hidden");
  document.body.style.overflow = "auto";
  await loadTracksFromServer();
};

logoutBtn.onclick = () => {
  currentEmail = "";
  localStorage.removeItem("ms_current_email");
  loginScreen.classList.remove("hidden");
  app.classList.add("hidden");
  document.body.style.overflow = "hidden";
};

window.addEventListener("load", init);
