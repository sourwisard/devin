/**
 * Bio Page Worker
 * A single-file Cloudflare Worker that renders a customizable profile/bio page,
 * inspired by gaming "link in bio" sites — animated backdrop, avatar, status,
 * socials, and a mini audio player.
 *
 * Deploy: wrangler deploy   (or paste into a Worker in the Cloudflare dashboard)
 *
 * Everything you'd want to change lives in the CONFIG object below.
 */

// pfp.webp, hosted on GitHub (raw content URL, so it's a direct image link not a webpage)
const PFP_DATA_URI = "https://raw.githubusercontent.com/sourwisard/images/main/pfp.webp";

// bgg.webp, hosted on GitHub (raw content URL, so it's a direct image link not a webpage)
const BG_DATA_URI = "https://raw.githubusercontent.com/sourwisard/images/main/bgg.webp";


const CONFIG = {
  name: "Kat",
  taglines: [
  "hey cutie :3",
  "Love you 🤍",
	"wish the best for you",
	"cutie kat",
	"you're cute",
  "want you back some day",
	"won't forget about you",
  "is this cringy meh i'm doing it anyways heh :3",
	"i'll always be waiting for you",
	"won't change my mind too late",
	"seriously i miss you though",
	"is obsession really a bad thing?",
  "i can't get you out of my mind",
	"this took a long time",
	"i wonder if you'll see this",
	"hope you're okay :3",
	"i'll always welcome you back",
	"you're on my mind more than i want to admit",
	"still my favorite person",
	"hope i entertained you just for a little",
	"made this for you hope you like it",
	"now lets run it back",
  ], // cycles with a typing/backspacing animation
  avatarImage: PFP_DATA_URI, // set to "" to fall back to avatarEmoji instead
  viewerCount: 0,
  accentColor: "#7dd3fc", // primary glow / link color
  accentColor2: "#c084fc", // secondary gradient stop
  backgroundImage: BG_DATA_URI, // base64-encoded background image
  imageCaption: "made this for you hope you like it.", // text shown next to the icon above the image — fill this in
  bgGradient: ["#0b0f1a", "#161229", "#1a0f1f"], // dark backdrop stops


};

const REPO_OWNER  = "sourwisard";
const REPO_NAME   = "depo";
const REPO_BRANCH = "main";

const RAW_BASE     = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}/`;
const METADATA_URL = RAW_BASE + "metadata.json";

function renderAvatar(cfg) {
  if (cfg.avatarImage) {
    return `<div class="avatar avatar-img"><img src="${cfg.avatarImage}" alt="${escapeAttr(cfg.name)}" /></div>`;
  }
  return `<div class="avatar">${cfg.avatarEmoji}</div>`;
}

function renderPlayer(cfg) {
  return `
  <div class="player">
    <div class="player-status" id="playerStatus">Loading tracks…</div>
    <div class="player-top" id="playerTop" style="display:none;">
      <div class="player-art"><img id="playerArt" src="" alt="" /></div>
      <div class="player-meta">
        <div class="player-title" id="playerTitle"></div>
        <div class="player-artist" id="playerArtist"></div>
        <div class="player-bar">
          <span id="cur">0:00</span>
          <input id="seek" type="range" min="0" max="100" value="0" />
          <span id="dur">0:00</span>
        </div>
      </div>
    </div>
    <div class="player-controls" id="playerControls" style="display:none;">
      <button id="prevBtn" class="skip-btn" aria-label="Previous">⏮</button>
      <button id="playBtn" class="play-btn" aria-label="Play"><svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5v11l10-5.5z"/></svg></button>
      <button id="nextBtn" class="skip-btn" aria-label="Next">⏭</button>
      <span class="player-count" id="playerCount"></span>
    </div>
    <div class="volume-group" id="volumeGroup" style="display:none;">
      <button id="volBtn" class="vol-btn" aria-label="Volume">
        <svg id="volIcon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M2 6h2.6L8 3.2v9.6L4.6 10H2z"/><path d="M10.2 5.2a3 3 0 0 1 0 5.6v-1.3a1.7 1.7 0 0 0 0-3z"/></svg>
      </button>
      <input id="volSlider" class="vol-slider" type="range" min="0" max="100" value="100" aria-label="Volume level" />
    </div>
    <audio id="audio" preload="metadata"></audio>
    <div class="playlists-panel" id="playlistsPanel" style="display:none;">
      <div class="playlists-label">Playlists</div>
      <div class="playlists-row" id="playlistsRow"></div>
    </div>
  </div>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}
function escapeAttr(str) {
  return escapeHtml(str);
}

function renderPage(cfg) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(cfg.name)}</title>
<style>
  :root {
    --accent: ${cfg.accentColor};
    --accent2: ${cfg.accentColor2};
  }
  * { box-sizing: border-box; }
  html, body {
    min-height: 100%;
    margin: 0;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #f4f3f7;
  }
  body {
    background: radial-gradient(circle at 50% 0%, #2a1248 0%, #160a2e 45%, #0a0414 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    position: relative;
    padding: 48px 20px;
    gap: 48px;
    overflow-x: hidden;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  .image-caption {
    width: min(380px, 90vw);
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 20px 18px;
    border-radius: 14px;
    background: rgba(18, 16, 28, 0.55);
    backdrop-filter: blur(18px);
    border: 1px solid rgba(255,255,255,0.08);
    box-shadow: 0 10px 30px rgba(0,0,0,0.4);
  }
  .image-caption-text {
    font-size: 13.5px;
    color: rgba(244,243,247,0.85);
    line-height: 1.7;
    text-align: left;
    word-wrap: break-word;
    overflow-wrap: anywhere;
  }
  .playlist-btn {
    width: min(380px, 90vw);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 14px 20px;
    border-radius: 999px;
    background: rgba(18, 16, 28, 0.55);
    backdrop-filter: blur(18px);
    border: 1px solid rgba(255,255,255,0.08);
    box-shadow: 0 10px 30px rgba(0,0,0,0.4);
    color: #f4f3f7;
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: transform .15s ease, background .15s ease;
  }
  .playlist-btn:hover {
    transform: translateY(-2px);
    background: rgba(255,255,255,0.1);
  }
  .playlist-btn img {
    width: 50px;
    height: 50px;
    object-fit: contain;
    flex-shrink: 0;
  }
  .bg-image {
    width: min(380px, 90vw);
    border-radius: 16px;
    box-shadow: 0 20px 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06);
    display: block;
    cursor: zoom-in;
    transition: transform .15s ease;
  }
  .bg-image:hover {
    transform: scale(1.015);
  }
  .lightbox {
    position: fixed;
    inset: 0;
    background: rgba(5,2,12,0.92);
    z-index: 100;
    display: none;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    touch-action: none;
  }
  .lightbox.open {
    display: flex;
  }
  .lightbox img {
    max-width: 92vw;
    max-height: 92vh;
    width: auto;
    height: auto;
    user-select: none;
    -webkit-user-drag: none;
    will-change: transform;
    cursor: grab;
  }
  .lightbox img.dragging {
    cursor: grabbing;
  }
  .lightbox-close {
    position: absolute;
    top: 18px;
    right: 22px;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.15);
    background: rgba(255,255,255,0.08);
    color: #f4f3f7;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .lightbox-hint {
    position: absolute;
    bottom: 18px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 12px;
    color: rgba(244,243,247,0.5);
  }
  .stars {
    position: fixed;
    inset: 0;
    pointer-events: none;
    background-image:
      radial-gradient(1px 1px at 10% 20%, rgba(255,255,255,.5), transparent),
      radial-gradient(1px 1px at 80% 10%, rgba(255,255,255,.4), transparent),
      radial-gradient(2px 2px at 60% 70%, rgba(255,255,255,.3), transparent),
      radial-gradient(1px 1px at 30% 80%, rgba(255,255,255,.4), transparent),
      radial-gradient(1px 1px at 90% 60%, rgba(255,255,255,.3), transparent);
    animation: drift 60s linear infinite;
    opacity: .8;
  }
  @keyframes drift {
    from { transform: translateY(0); }
    to { transform: translateY(-200px); }
  }
  .card {
    position: relative;
    z-index: 2;
    width: min(380px, 90vw);
    padding: 36px 28px 28px;
    border-radius: 20px;
    background: rgba(18, 16, 28, 0.55);
    backdrop-filter: blur(18px);
    border: 1px solid rgba(255,255,255,0.08);
    box-shadow: 0 0 60px -10px var(--accent2), 0 20px 60px rgba(0,0,0,0.5);
    text-align: center;
    animation: rise .6s ease;
  }
  @keyframes rise {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .avatar {
    width: 92px;
    height: 92px;
    margin: 0 auto 14px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 42px;
    background: linear-gradient(140deg, var(--accent), var(--accent2));
    box-shadow: 0 0 0 4px rgba(255,255,255,0.06), 0 0 30px -4px var(--accent);
    animation: float 4s ease-in-out infinite;
  }
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }
  .avatar-img {
    overflow: hidden;
    background: #000;
  }
  .avatar-img img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  /* To use your own background image instead of the gradient, add a class
     like this and apply it to <body>, or just edit the body{} rule above
     to add: background-image: url('data:image/webp;base64,...');
     (see the chat instructions for how to generate that string) */
  .name {
    font-size: 22px;
    font-weight: 700;
    background: linear-gradient(90deg, var(--accent), var(--accent2));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    margin-bottom: 6px;
    letter-spacing: 0.5px;
  }
  .tagline {
    font-size: 13.5px;
    color: rgba(244,243,247,0.75);
    margin-bottom: 18px;
    line-height: 1.4;
    text-align: left;
    height: 80px;
  }
  .tagline-inner {
    display: flex;
    align-items: flex-start;
    text-align: left;
    width: 100%;
    gap: 10px;
  }
  .typing-icon {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    object-fit: cover;
    border-radius: 50%;
    background: rgba(255,255,255,0.08);
    border: none;
    padding: 0;
    box-sizing: border-box;
    margin-top: 2px;
  }
  .tagline-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
    font-weight: 500;
  }
  .tagline-username {
    color: #ffffff;
    font-weight: 600;
  }
  .tagline-timestamp {
    font-size: 12px;
    color: rgba(244,243,247,0.5);
  }
  .tagline-bubble {
    display: block;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 16px;
    padding: 9px 13px;
    max-width: 100%;
    min-height: 2.8em;
    line-height: 1.4;
  }
  .tagline .cursor {
    display: inline-block;
    width: 2px;
    height: 1em;
    vertical-align: middle;
    margin-left: 1px;
    background: rgba(244,243,247,0.6);
    animation: blink 0.9s step-end infinite;
  }
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
  .player {
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px;
    padding: 12px 14px;
    text-align: left;
    width: 100%;
  }
  .player-top {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  .player-art {
    width: 44px;
    height: 44px;
    border-radius: 8px;
    background: linear-gradient(140deg, var(--accent2), var(--accent));
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    overflow: hidden;
  }
  .player-art img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .player-meta { flex: 1; min-width: 0; }
  .player-title {
    font-size: 12.5px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .player-artist {
    font-size: 11px;
    color: rgba(244,243,247,0.5);
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .player-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: rgba(244,243,247,0.5);
    min-width: 0;
  }
  .player-bar span {
    flex-shrink: 0;
    white-space: nowrap;
  }
  .player-bar input[type="range"] {
    flex: 1;
    min-width: 0;
    height: 3px;
    accent-color: var(--accent);
    cursor: pointer;
  }
  .player-status {
    font-size: 11.5px;
    color: rgba(244,243,247,0.5);
    text-align: center;
    padding: 4px 0;
  }
  .player-status.error {
    color: #ff8080;
  }

  .player-controls {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding-right: 0;
    width: 100%;
    order: 1;
  }
  .play-btn {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: none;
    background: var(--accent);
    color: var(--play-text);
    cursor: pointer;
    flex-shrink: 0;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform .15s ease;
  }
  .play-btn:active {
    transform: scale(0.92);
  }
  .skip-btn {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: none;
    background: rgba(255,255,255,0.08);
    color: rgba(244,243,247,0.8);
    cursor: pointer;
    flex-shrink: 0;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform .15s ease, color .15s ease, background .15s ease;
  }
  .skip-btn:hover {
    color: var(--accent);
    background: rgba(255,255,255,0.14);
  }
  .skip-btn:active {
    transform: scale(0.92);
  }
  .player-count {
    position: absolute;
    right: 0;
    font-size: 10.5px;
    color: rgba(244,243,247,0.45);
    flex-shrink: 0;
  }
  .volume-group {
    position: relative;
    left: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    order: 2;
  }
  .vol-btn {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: none;
    background: rgba(255,255,255,0.08);
    color: rgba(244,243,247,0.75);
    cursor: pointer;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color .15s ease, background .15s ease;
  }
  .vol-btn:hover {
    color: var(--accent);
    background: rgba(255,255,255,0.14);
  }
  .vol-slider {
    width: 100%;
    opacity: 1;
    height: 3px;
    accent-color: var(--accent);
    cursor: pointer;
    transition: width .2s ease, opacity .2s ease, margin .2s ease;
    margin-left: 2px;
    flex: 1;
  }
  .volume-group:hover .vol-slider,
  .volume-group:focus-within .vol-slider {
    width: 100%;
    opacity: 1;
    margin-left: 2px;
  }
  .playlists-panel {
    margin-top: 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .playlists-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: rgba(244,243,247,0.45);
    padding: 0 2px;
  }
  .playlists-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .playlist-pill {
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.05);
    color: rgba(244,243,247,0.8);
    font-size: 12px;
    font-weight: 600;
    padding: 7px 14px;
    border-radius: 999px;
    cursor: pointer;
    transition: background .15s ease, border-color .15s ease, color .15s ease, transform .15s ease;
  }
  .playlist-pill:hover {
    background: rgba(255,255,255,0.1);
    transform: translateY(-1px);
  }
  .playlist-pill.active {
    background: linear-gradient(120deg, var(--accent), var(--accent2));
    border-color: transparent;
    color: #fff;
  }
  .page-content {
    transition: filter .6s ease;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 32px;
  }
  .page-content.blurred {
    filter: blur(18px);
    pointer-events: none;
  }
  .enter-screen {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(5,2,12,0.55);
    cursor: pointer;
    transition: opacity .6s ease;
  }
  .enter-screen.hidden {
    opacity: 0;
    pointer-events: none;
  }
  .enter-box {
    text-align: center;
  }
  .enter-text {
    font-size: 14px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #f4f3f7;
    padding: 16px 28px;
    border: 1px solid rgba(255,255,255,0.25);
    border-radius: 999px;
    background: rgba(255,255,255,0.06);
    backdrop-filter: blur(6px);
    animation: pulseEnter 1.8s ease-in-out infinite;
  }
  @keyframes pulseEnter {
    0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.12); }
    50% { box-shadow: 0 0 0 10px rgba(255,255,255,0); }
  }
</style>
</head>
<body>
  <div id="enterScreen" class="enter-screen">
    <div class="enter-box">
      <div class="enter-text">click to enter</div>
    </div>
  </div>
  <div id="pageContent" class="page-content blurred">
  <div class="stars"></div>
  <div class="card">
    ${renderAvatar(cfg)}
    <div class="name">${escapeHtml(cfg.name)}</div>
    <div class="tagline"><div class="tagline-inner"><img class="typing-icon" src="https://raw.githubusercontent.com/sourwisard/images/main/pwep.png" alt="" /><div style="flex: 1;"><div class="tagline-header"><span class="tagline-username">sourwisard</span></div><span class="tagline-bubble"><span id="taglineText"></span><span class="cursor"></span></span></div></div></div>
    ${renderPlayer(cfg)}
  </div>
  ${cfg.backgroundImage ? `<a class="playlist-btn" href="https://music.youtube.com/playlist?list=PLIDKt1VOzMKQN199j9FCCflJDSx90xnoX&si=J7a_ScRTl7Nx1Mkx" target="_blank" rel="noopener">
    <img src="https://raw.githubusercontent.com/sourwisard/images/main/on_platform_logo_dark.svg" alt="" />
    <span>the playlist of this</span>
  </a>
  <img id="bgImage" class="bg-image" src="${escapeAttr(cfg.backgroundImage)}" alt="" />
  <div class="lightbox" id="lightbox">
    <button class="lightbox-close" id="lightboxClose" aria-label="Close">✕</button>
    <img id="lightboxImg" src="${escapeAttr(cfg.backgroundImage)}" alt="" />
    <div class="lightbox-hint">scroll/pinch to zoom · drag to pan</div>
  </div>` : ""}
  </div>

<script>
  (function () {
    const enterScreen = document.getElementById('enterScreen');
    const pageContent = document.getElementById('pageContent');
    const audio = document.getElementById('audio');

    enterScreen.addEventListener('click', () => {
      pageContent.classList.remove('blurred');
      enterScreen.classList.add('hidden');
      document.body.style.overflow = '';
      if (audio) {
        audio.play().catch(() => {});
        const playBtn = document.getElementById('playBtn');
        if (playBtn) playBtn.textContent = '❚❚';
      }
      setTimeout(() => enterScreen.remove(), 600);
      window.dispatchEvent(new Event('pageEntered'));
    }, { once: true });
  })();
</script>
<script>
  (function () {
    const taglines = ${JSON.stringify(cfg.taglines)};
    const el = document.getElementById('taglineText');
    if (!el || !taglines.length) return;

    let textIndex = 0;
    let charIndex = 0;
    let deleting = false;

    const TYPE_SPEED = 55;
    const DELETE_SPEED = 30;
    const HOLD_AFTER_TYPE = 2800;
    const HOLD_AFTER_DELETE = 300;

    function tick() {
      const current = taglines[textIndex];

      if (!deleting) {
        charIndex++;
        el.textContent = current.slice(0, charIndex);
        if (charIndex === current.length) {
          deleting = true;
          setTimeout(tick, HOLD_AFTER_TYPE);
          return;
        }
        setTimeout(tick, TYPE_SPEED);
      } else {
        charIndex--;
        el.textContent = current.slice(0, charIndex);
        if (charIndex === 0) {
          deleting = false;
          textIndex = (textIndex + 1) % taglines.length;
          setTimeout(tick, HOLD_AFTER_DELETE);
          return;
        }
        setTimeout(tick, DELETE_SPEED);
      }
    }

    window.addEventListener('pageEntered', tick, { once: true });
  })();
</script>
<script>
  (function () {
    const trigger = document.getElementById('bgImage');
    const lightbox = document.getElementById('lightbox');
    if (!trigger || !lightbox) return;
    const img = document.getElementById('lightboxImg');
    const closeBtn = document.getElementById('lightboxClose');

    let scale = 1, panX = 0, panY = 0;
    let dragging = false, startX = 0, startY = 0, startPanX = 0, startPanY = 0;
    const MIN_SCALE = 1, MAX_SCALE = 6;

    function apply() {
      img.style.transform = 'translate(' + panX + 'px,' + panY + 'px) scale(' + scale + ')';
    }

    function reset() {
      scale = 1; panX = 0; panY = 0;
      apply();
    }

    function clampPan() {
      // simple clamp so the image can't be dragged absurdly far off screen
      const maxOffset = 600 * scale;
      panX = Math.max(-maxOffset, Math.min(maxOffset, panX));
      panY = Math.max(-maxOffset, Math.min(maxOffset, panY));
    }

    function open() {
      reset();
      lightbox.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function close() {
      lightbox.classList.remove('open');
      document.body.style.overflow = '';
    }

    trigger.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && lightbox.classList.contains('open')) close();
    });

    // wheel to zoom
    lightbox.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.0015;
      scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale + delta * scale));
      clampPan();
      apply();
    }, { passive: false });

    // mouse drag to pan
    img.addEventListener('mousedown', (e) => {
      dragging = true;
      img.classList.add('dragging');
      startX = e.clientX; startY = e.clientY;
      startPanX = panX; startPanY = panY;
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      panX = startPanX + (e.clientX - startX);
      panY = startPanY + (e.clientY - startY);
      clampPan();
      apply();
    });
    window.addEventListener('mouseup', () => {
      dragging = false;
      img.classList.remove('dragging');
    });

    // touch: drag + pinch zoom
    let pinchStartDist = 0, pinchStartScale = 1;

    function touchDist(touches) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    }

    img.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        dragging = true;
        startX = e.touches[0].clientX; startY = e.touches[0].clientY;
        startPanX = panX; startPanY = panY;
      } else if (e.touches.length === 2) {
        dragging = false;
        pinchStartDist = touchDist(e.touches);
        pinchStartScale = scale;
      }
    }, { passive: true });

    img.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && dragging) {
        panX = startPanX + (e.touches[0].clientX - startX);
        panY = startPanY + (e.touches[0].clientY - startY);
        clampPan();
        apply();
      } else if (e.touches.length === 2) {
        const dist = touchDist(e.touches);
        scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinchStartScale * (dist / pinchStartDist)));
        clampPan();
        apply();
      }
    }, { passive: true });

    img.addEventListener('touchend', () => {
      dragging = false;
    });

    // double click / double tap to reset
    img.addEventListener('dblclick', reset);
  })();
</script>
<script>
  (function () {
    const audio = document.getElementById('audio');
    if (!audio) return;

    const METADATA_URL = ${JSON.stringify(METADATA_URL)};
    const RAW_BASE = ${JSON.stringify(RAW_BASE)};

    const statusEl       = document.getElementById('playerStatus');
    const topEl          = document.getElementById('playerTop');
    const controlsEl     = document.getElementById('playerControls');
    const volumeEl       = document.getElementById('volumeGroup');
    const art            = document.getElementById('playerArt');
    const titleEl        = document.getElementById('playerTitle');
    const artistEl       = document.getElementById('playerArtist');
    const countEl        = document.getElementById('playerCount');
    const seek           = document.getElementById('seek');
    const cur            = document.getElementById('cur');
    const dur            = document.getElementById('dur');
    const playBtn        = document.getElementById('playBtn');
    const prevBtn        = document.getElementById('prevBtn');
    const nextBtn        = document.getElementById('nextBtn');
    const volBtn         = document.getElementById('volBtn');
    const volIcon        = document.getElementById('volIcon');
    const volSlider      = document.getElementById('volSlider');
    const playlistsPanel = document.getElementById('playlistsPanel');
    const playlistsRow   = document.getElementById('playlistsRow');

    const PLAY_ICON = '<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5v11l10-5.5z"/></svg>';
    const PAUSE_ICON = '<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="2.5" width="3.5" height="11" rx="1"/><rect x="9.5" y="2.5" width="3.5" height="11" rx="1"/></svg>';
    const VOL_ICON = '<path d="M2 6h2.6L8 3.2v9.6L4.6 10H2z"/><path d="M10.2 5.2a3 3 0 0 1 0 5.6v-1.3a1.7 1.7 0 0 0 0-3z"/>';
    const VOL_MUTE_ICON = '<path d="M2 6h2.6L8 3.2v9.6L4.6 10H2z"/><path d="M10.5 5.5l3.5 5M14 5.5l-3.5 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>';

    // Only playlists tagged "showOnKat: true" in metadata.json's
    // "playlists" settings are ever used here -- there is no "Play All" /
    // all-tracks fallback anymore.
    let playlists = [];         // [{ name, tracks }]
    let activePlaylist = null;
    let tracks = [];
    let index = 0;
    let lastVolume = 1;
    let entered = false;
    window.addEventListener('pageEntered', () => { entered = true; }, { once: true });

    function rawUrl(path) {
      return RAW_BASE + String(path).split('/').map(encodeURIComponent).join('/');
    }

    function fmt(s) {
      if (!isFinite(s)) return '0:00';
      const m = Math.floor(s / 60), sec = Math.floor(s % 60);
      return m + ':' + String(sec).padStart(2, '0');
    }

    function loadTrack(i, autoplay) {
      if (!tracks.length) return;
      index = ((i % tracks.length) + tracks.length) % tracks.length;
      const t = tracks[index];
      audio.src = t.file;
      if (art) art.src = t.cover || '';
      if (titleEl) titleEl.textContent = t.title;
      if (artistEl) artistEl.textContent = t.artist;
      if (countEl) countEl.textContent = (index + 1) + ' / ' + tracks.length;
      seek.value = 0;
      cur.textContent = '0:00';
      dur.textContent = '0:00';
      if (autoplay) {
        audio.play().catch(() => {});
        playBtn.innerHTML = PAUSE_ICON;
      } else {
        playBtn.innerHTML = PLAY_ICON;
      }
    }

    playBtn.addEventListener('click', () => {
      if (!tracks.length) return;
      if (audio.paused) { audio.play(); playBtn.innerHTML = PAUSE_ICON; }
      else { audio.pause(); playBtn.innerHTML = PLAY_ICON; }
    });
    if (prevBtn) prevBtn.addEventListener('click', () => loadTrack(index - 1, true));
    if (nextBtn) nextBtn.addEventListener('click', () => loadTrack(index + 1, true));
    audio.addEventListener('ended', () => loadTrack(index + 1, true));
    audio.addEventListener('loadedmetadata', () => { dur.textContent = fmt(audio.duration); });
    audio.addEventListener('timeupdate', () => {
      cur.textContent = fmt(audio.currentTime);
      if (audio.duration) seek.value = (audio.currentTime / audio.duration) * 100;
    });
    seek.addEventListener('input', () => {
      if (audio.duration) audio.currentTime = (seek.value / 100) * audio.duration;
    });

    function setVolume(v) {
      audio.volume = v;
      volSlider.value = Math.round(v * 100);
      if (volIcon) volIcon.innerHTML = v === 0 ? VOL_MUTE_ICON : VOL_ICON;
    }

    if (volSlider) {
      setVolume(1);
      volSlider.addEventListener('input', () => {
        const v = parseFloat(volSlider.value) / 100;
        if (v > 0) lastVolume = v;
        setVolume(v);
      });
    }
    if (volBtn) {
      volBtn.addEventListener('click', () => {
        if (audio.volume > 0) {
          lastVolume = audio.volume;
          setVolume(0);
        } else {
          setVolume(lastVolume || 1);
        }
      });
    }

    function selectPlaylist(name, autoplay) {
      activePlaylist = name;
      const found = playlists.find((p) => p.name === name);
      tracks = found ? found.tracks : [];
      renderPlaylistPills();
      if (tracks.length) {
        loadTrack(0, !!autoplay);
      } else {
        if (titleEl) titleEl.textContent = 'Empty playlist';
        if (artistEl) artistEl.textContent = '';
        if (countEl) countEl.textContent = '0 / 0';
      }
    }

    function renderPlaylistPills() {
      playlistsRow.innerHTML = '';
      playlists.forEach((pl) => {
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'playlist-pill' + (activePlaylist === pl.name ? ' active' : '');
        pill.textContent = pl.name;
        pill.addEventListener('click', () => selectPlaylist(pl.name));
        playlistsRow.appendChild(pill);
      });
    }

    // ── Fetch metadata.json from GitHub and build only the tagged playlists ──
    fetch(METADATA_URL, { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then((meta) => {
        // Supports the current { tracks, playlists } object format. The
        // legacy bare-array format has no playlist tags, so there's
        // nothing taggable to show here -- upload/tag through the
        // uploader app first.
        const rawTracks = Array.isArray(meta) ? meta : (Array.isArray(meta.tracks) ? meta.tracks : []);
        const playlistSettings = (!Array.isArray(meta) && meta.playlists && typeof meta.playlists === 'object')
          ? meta.playlists : {};

        const allowedNames = new Set(
          Object.keys(playlistSettings).filter((name) => playlistSettings[name] && playlistSettings[name].showOnKat)
        );

        if (!allowedNames.size) {
          statusEl.textContent = 'No playlists are tagged to show here yet.';
          return;
        }

        const allTracks = rawTracks.map((e) => {
          let playlistOrders = {};
          const pl = e.playlists;
          if (pl && typeof pl === 'object' && !Array.isArray(pl)) {
            playlistOrders = pl;
          } else if (Array.isArray(pl)) {
            pl.forEach((name, i) => { if (name) playlistOrders[name] = i; });
          } else if (e.playlist) {
            playlistOrders[e.playlist] = 0;
          }
          return {
            title:  e.title || 'Unknown',
            artist: e.uploader || '',
            file:   rawUrl(e.file || ''),
            cover:  e.thumbnail || '',
            playlistOrders,
          };
        });

        const byName = new Map();
        allTracks.forEach((t) => {
          Object.keys(t.playlistOrders).forEach((name) => {
            if (!allowedNames.has(name)) return;
            if (!byName.has(name)) byName.set(name, []);
            byName.get(name).push(t);
          });
        });
        playlists = Array.from(byName, ([name, list]) => {
          list.sort((a, b) => a.playlistOrders[name] - b.playlistOrders[name]);
          return { name, tracks: list };
        });

        if (!playlists.length) {
          statusEl.textContent = 'No tracks found in the tagged playlists yet.';
          return;
        }

        playlistsPanel.style.display = 'flex';
        selectPlaylist(playlists[0].name, entered);

        statusEl.style.display = 'none';
        topEl.style.display = 'flex';
        controlsEl.style.display = 'flex';
        volumeEl.style.display = 'flex';
      })
      .catch((err) => {
        statusEl.textContent = 'Failed to load metadata.json: ' + err.message;
        statusEl.classList.add('error');
      });
  })();
</script>
</body>
</html>`;
}

export default {
  async fetch(request, env, ctx) {
    const html = renderPage(CONFIG);
    return new Response(html, {
      headers: { "content-type": "text/html;charset=UTF-8" },
    });
  },
};