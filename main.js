/**
 * Theme Editor Worker — sourwisard.workers.dev
 * ============================================
 * This replaces the old landing hub with a visual THEME EDITOR for the bio
 * pages. Pick colors with per-color pickers, choose a background effect, watch
 * a live preview, then hit "Export" to copy a ready-to-paste CONFIG color block
 * plus the chosen effect's HTML/CSS (and a JSON blob) into the actual pages.
 *
 * The original hub page is safe to overwrite -- backups exist elsewhere.
 *
 * Deploy: wrangler deploy  (or paste into a Worker in the Cloudflare dashboard)
 *
 * The default theme the editor opens with lives in CONFIG below.
 */

// Default theme the editor starts from (mirrors the current bio-page theme).
const CONFIG = {
  accentColor:  "#7dd3fc",
  accentColor2: "#c084fc",
  bodyBg:       "#2a1248 0%, #160a2e 45%, #0a0414 100%",
  panelBg:      "rgba(18, 16, 28, 0.55)",
  textColor:    "#f4f3f7",
  overlayDark:  "rgba(5, 2, 12, 0.92)",
  playBtnText:  "#ffffff",
  // Which background effect is selected by default (key from EFFECTS below).
  backgroundEffect: "stars",
};

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function renderPage(cfg) {
  const initialTheme = {
    accentColor:  cfg.accentColor,
    accentColor2: cfg.accentColor2,
    bodyBg:       cfg.bodyBg,
    panelBg:      cfg.panelBg,
    textColor:    cfg.textColor,
    overlayDark:  cfg.overlayDark,
    playBtnText:  cfg.playBtnText,
  };
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Theme Editor · sourwisard</title>
<style>
  :root {
    --ui-bg: #0c0714;
    --ui-panel: #150d24;
    --ui-panel2: #1d1330;
    --ui-border: rgba(255,255,255,0.10);
    --ui-text: #ece9f5;
    --ui-muted: #a99fc4;
    --ui-accent: #b98bff;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: var(--ui-bg);
    color: var(--ui-text);
    overflow: hidden;
  }
  .editor {
    display: grid;
    grid-template-columns: 380px 1fr;
    height: 100vh;
  }
  @media (max-width: 820px) {
    .editor { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; }
    body { overflow: auto; }
  }

  /* ── Controls panel ── */
  .controls {
    background: var(--ui-panel);
    border-right: 1px solid var(--ui-border);
    padding: 20px;
    overflow-y: auto;
  }
  .controls h1 { font-size: 18px; margin: 0 0 2px; letter-spacing: .3px; }
  .controls .sub { font-size: 12px; color: var(--ui-muted); margin: 0 0 18px; line-height: 1.5; }
  .controls h2 {
    font-size: 11px; text-transform: uppercase; letter-spacing: .8px;
    color: var(--ui-muted); margin: 22px 0 10px; font-weight: 700;
  }

  .field {
    display: flex; align-items: center; gap: 10px;
    padding: 7px 0;
  }
  .field label {
    flex: 1; font-size: 13px; color: var(--ui-text);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  input[type="color"] {
    width: 34px; height: 30px; padding: 0; border: 1px solid var(--ui-border);
    border-radius: 8px; background: none; cursor: pointer; flex-shrink: 0;
  }
  input[type="text"] {
    width: 150px; font-family: ui-monospace, "Cascadia Code", Menlo, monospace;
    font-size: 11.5px; padding: 6px 8px; border-radius: 8px;
    border: 1px solid var(--ui-border); background: var(--ui-panel2);
    color: var(--ui-text);
  }
  input[type="text"].wide { width: 100%; }
  input[type="range"] { width: 76px; accent-color: var(--ui-accent); cursor: pointer; flex-shrink: 0; }
  input[type="number"] {
    width: 58px; font-size: 11.5px; padding: 6px 6px; border-radius: 8px;
    border: 1px solid var(--ui-border); background: var(--ui-panel2); color: var(--ui-text);
  }

  .grad-stop { display: flex; align-items: center; gap: 8px; padding: 5px 0; }
  .grad-stop .pos-unit { font-size: 12px; color: var(--ui-muted); }
  .mini-btn {
    border: 1px solid var(--ui-border); background: var(--ui-panel2);
    color: var(--ui-muted); border-radius: 8px; cursor: pointer;
    font-size: 13px; width: 28px; height: 28px; line-height: 1; flex-shrink: 0;
  }
  .mini-btn:hover { color: #ff9a9a; border-color: #ff9a9a55; }
  .add-stop {
    margin-top: 6px; font-size: 12px; padding: 6px 12px; width: auto;
    height: auto; color: var(--ui-text);
  }
  .add-stop:hover { color: var(--ui-accent); border-color: var(--ui-accent); }

  /* ── Effect option grid ── */
  .fx-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .fx-opt {
    border: 1px solid var(--ui-border); background: var(--ui-panel2);
    border-radius: 10px; padding: 10px; cursor: pointer; text-align: left;
    color: var(--ui-text); font-size: 12.5px; font-weight: 600;
    transition: border-color .15s ease, background .15s ease, transform .1s ease;
    position: relative; overflow: hidden; height: 52px;
  }
  .fx-opt .swatch {
    position: absolute; inset: 0; opacity: .5; pointer-events: none;
  }
  .fx-opt span { position: relative; z-index: 1; }
  .fx-opt:hover { transform: translateY(-1px); }
  .fx-opt.active { border-color: var(--ui-accent); background: #241640; }

  .actions { display: flex; gap: 10px; margin-top: 24px; }
  .btn {
    flex: 1; padding: 11px 14px; border-radius: 10px; border: none;
    font-size: 13px; font-weight: 700; cursor: pointer;
    background: linear-gradient(120deg, #7dd3fc, #c084fc); color: #10071c;
  }
  .btn:hover { filter: brightness(1.06); }
  .btn.ghost { background: var(--ui-panel2); color: var(--ui-muted); border: 1px solid var(--ui-border); }
  .btn.ghost:hover { color: var(--ui-text); }

  /* ── Preview ── */
  .preview {
    position: relative;
    overflow: hidden;
    transform: translateZ(0);   /* contains the position:fixed effect layer */
    display: flex; align-items: center; justify-content: center;
    padding: 32px;
  }
  #previewRoot {
    position: absolute; inset: 0;
    background: radial-gradient(circle at 50% 0%, ${escapeHtml(cfg.bodyBg)});
    --accent: ${escapeHtml(cfg.accentColor)};
    --accent2: ${escapeHtml(cfg.accentColor2)};
    --panel-bg: ${escapeHtml(cfg.panelBg)};
    --text: ${escapeHtml(cfg.textColor)};
    --overlay-dark: ${escapeHtml(cfg.overlayDark)};
    --play-text: ${escapeHtml(cfg.playBtnText)};
  }
  .preview-scroll {
    position: relative; z-index: 2; width: 100%;
    max-height: 100%; overflow-y: auto;
    display: flex; flex-direction: column; align-items: center; gap: 18px;
    padding: 8px;
  }
  .preview-hint {
    position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
    z-index: 3; font-size: 11px; color: rgba(255,255,255,0.5);
    background: rgba(0,0,0,0.35); padding: 5px 12px; border-radius: 999px;
    backdrop-filter: blur(6px);
  }

  /* base effect layer -- SAME rule the exported effect uses */
  .bg-fx { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }

  /* ── Mock bio card (mirrors the real page classes) ── */
  .card {
    width: min(360px, 88vw); padding: 30px 24px 24px; border-radius: 20px;
    background: var(--panel-bg); backdrop-filter: blur(18px);
    border: 1px solid rgba(255,255,255,0.08);
    box-shadow: 0 0 60px -10px var(--accent2), 0 20px 60px rgba(0,0,0,0.5);
    text-align: center; color: var(--text);
  }
  .avatar {
    width: 84px; height: 84px; margin: 0 auto 14px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; font-size: 38px;
    background: linear-gradient(140deg, var(--accent), var(--accent2));
    box-shadow: 0 0 0 4px rgba(255,255,255,0.06), 0 0 30px -4px var(--accent);
  }
  .name {
    font-size: 22px; font-weight: 700; letter-spacing: .5px; margin-bottom: 8px;
    background: linear-gradient(90deg, var(--accent), var(--accent2));
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .tagline-bubble {
    display: inline-block; font-size: 13px; color: rgba(255,255,255,0.8);
    background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 16px; padding: 8px 13px; margin-bottom: 16px;
  }
  .player {
    display: flex; flex-direction: column; gap: 10px; text-align: left;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px; padding: 12px;
  }
  .player-top { display: flex; align-items: center; gap: 10px; }
  .player-art {
    width: 42px; height: 42px; border-radius: 8px; flex-shrink: 0;
    background: linear-gradient(140deg, var(--accent2), var(--accent));
  }
  .player-title { font-size: 12.5px; font-weight: 600; color: var(--text); }
  .player-artist { font-size: 11px; color: rgba(255,255,255,0.5); }
  .seek { height: 3px; border-radius: 2px; background: rgba(255,255,255,0.15); margin-top: 8px; }
  .seek > i { display: block; width: 40%; height: 100%; border-radius: 2px; background: var(--accent); }
  .player-controls { display: flex; align-items: center; justify-content: center; gap: 14px; margin-top: 4px; }
  .play-btn {
    width: 32px; height: 32px; border-radius: 50%; border: none;
    background: var(--accent); color: var(--play-text);
    display: flex; align-items: center; justify-content: center;
  }
  .skip { color: rgba(255,255,255,0.75); font-size: 12px; }
  .pills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .pill {
    font-size: 12px; font-weight: 600; padding: 6px 13px; border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.8);
    background: rgba(255,255,255,0.05);
  }
  .pill.active { background: linear-gradient(120deg, var(--accent), var(--accent2)); color: #fff; border-color: transparent; }
  .enter-chip {
    font-size: 12px; letter-spacing: 1.2px; text-transform: uppercase;
    color: var(--text); padding: 12px 22px; border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.25); background: var(--overlay-dark);
  }

  /* ── Export modal ── */
  .modal {
    position: fixed; inset: 0; z-index: 500; display: none;
    align-items: center; justify-content: center;
    background: rgba(4,2,10,0.7); backdrop-filter: blur(4px); padding: 24px;
  }
  .modal.open { display: flex; }
  .modal-box {
    width: min(680px, 95vw); max-height: 88vh; overflow: hidden;
    background: var(--ui-panel); border: 1px solid var(--ui-border);
    border-radius: 16px; display: flex; flex-direction: column;
  }
  .modal-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid var(--ui-border); }
  .modal-head h2 { margin: 0; font-size: 15px; }
  .modal-body { padding: 16px 18px; overflow-y: auto; }
  .modal textarea {
    width: 100%; height: 320px; resize: vertical;
    font-family: ui-monospace, "Cascadia Code", Menlo, monospace; font-size: 12px;
    line-height: 1.5; padding: 12px; border-radius: 10px;
    border: 1px solid var(--ui-border); background: #0c0818; color: #d7d2ea;
  }
  .modal-foot { display: flex; gap: 10px; padding: 14px 18px; border-top: 1px solid var(--ui-border); }
</style>
</head>
<body>
  <div class="editor">
    <aside class="controls">
      <h1>Theme Editor</h1>
      <p class="sub">Tweak colors and pick a background, watch the live preview, then export a ready-to-paste block for the bio pages.</p>

      <h2>Colors</h2>
      <div id="colorFields"></div>

      <h2>Body gradient</h2>
      <div id="gradFields"></div>
      <button class="mini-btn add-stop" id="addStop">+ add stop</button>

      <h2>Background effect</h2>
      <div class="fx-grid" id="fxGrid"></div>

      <div class="actions">
        <button class="btn" id="exportBtn">Export</button>
        <button class="btn ghost" id="resetBtn">Reset</button>
      </div>
    </aside>

    <main class="preview">
      <div id="previewRoot"></div>
      <div id="fxLayer"></div>
      <div class="preview-hint">live preview</div>
      <div class="preview-scroll">
        <div class="card">
          <div class="avatar">🌙</div>
          <div class="name">sourwisard</div>
          <div class="tagline-bubble">preview of your theme :3</div>
          <div class="player">
            <div class="player-top">
              <div class="player-art"></div>
              <div>
                <div class="player-title">Late Night Walks</div>
                <div class="player-artist">Teddy Vogel</div>
                <div class="seek"><i></i></div>
              </div>
            </div>
            <div class="player-controls">
              <span class="skip">⏮</span>
              <button class="play-btn">▶</button>
              <span class="skip">⏭</span>
            </div>
            <div class="pills">
              <span class="pill active">chill</span>
              <span class="pill">hype</span>
              <span class="pill">late</span>
            </div>
          </div>
        </div>
        <div class="enter-chip">click to enter</div>
      </div>
    </main>
  </div>

  <div class="modal" id="modal">
    <div class="modal-box">
      <div class="modal-head">
        <h2>Export theme</h2>
        <button class="mini-btn" id="modalClose">✕</button>
      </div>
      <div class="modal-body">
        <textarea id="exportText" spellcheck="false" readonly></textarea>
      </div>
      <div class="modal-foot">
        <button class="btn" id="copyBtn">Copy to clipboard</button>
        <button class="btn ghost" id="modalClose2">Close</button>
      </div>
    </div>
  </div>

  <!-- Background-effect definitions. Each template's text is the effect's CSS;
       the layer element is always <div class="bg-fx bg-fx-KEY"></div>. Same CSS
       is used for the live preview AND the export, so what you see is what ships. -->
  <div id="fxDefs" hidden>
    <template data-fx="none" data-label="None"></template>

    <template data-fx="stars" data-label="Stars">
.bg-fx-stars {
  background-image:
    radial-gradient(1px 1px at 10% 20%, rgba(255,255,255,.5), transparent),
    radial-gradient(1px 1px at 80% 10%, rgba(255,255,255,.4), transparent),
    radial-gradient(2px 2px at 60% 70%, rgba(255,255,255,.3), transparent),
    radial-gradient(1px 1px at 30% 80%, rgba(255,255,255,.4), transparent),
    radial-gradient(1px 1px at 90% 60%, rgba(255,255,255,.3), transparent);
  animation: bgfx-drift 60s linear infinite;
  opacity: .8;
}
@keyframes bgfx-drift { from { transform: translateY(0); } to { transform: translateY(-200px); } }
    </template>

    <template data-fx="twinkle" data-label="Twinkle">
.bg-fx-twinkle {
  background-image:
    radial-gradient(1px 1px at 15% 25%, rgba(255,255,255,.6), transparent),
    radial-gradient(1px 1px at 70% 15%, rgba(255,255,255,.5), transparent),
    radial-gradient(2px 2px at 45% 60%, rgba(255,255,255,.4), transparent),
    radial-gradient(1px 1px at 85% 75%, rgba(255,255,255,.5), transparent);
}
.bg-fx-twinkle::after {
  content: ""; position: absolute; inset: 0;
  background-image:
    radial-gradient(1px 1px at 30% 40%, #fff, transparent),
    radial-gradient(1px 1px at 60% 80%, #fff, transparent),
    radial-gradient(1px 1px at 90% 30%, #fff, transparent),
    radial-gradient(2px 2px at 20% 90%, #fff, transparent);
  animation: bgfx-twinkle 3.5s ease-in-out infinite alternate;
}
@keyframes bgfx-twinkle { from { opacity: .15; } to { opacity: .9; } }
    </template>

    <template data-fx="aurora" data-label="Aurora">
.bg-fx-aurora::before, .bg-fx-aurora::after {
  content: ""; position: absolute; border-radius: 50%;
  filter: blur(70px); opacity: .55;
}
.bg-fx-aurora::before {
  width: 65vw; height: 65vw; left: -12vw; top: -22vh;
  background: radial-gradient(circle, var(--accent), transparent 60%);
  animation: bgfx-aurora1 18s ease-in-out infinite alternate;
}
.bg-fx-aurora::after {
  width: 58vw; height: 58vw; right: -12vw; bottom: -22vh;
  background: radial-gradient(circle, var(--accent2), transparent 60%);
  animation: bgfx-aurora2 22s ease-in-out infinite alternate;
}
@keyframes bgfx-aurora1 { from { transform: translate(0,0); } to { transform: translate(18vw,10vh); } }
@keyframes bgfx-aurora2 { from { transform: translate(0,0); } to { transform: translate(-16vw,-10vh); } }
    </template>

    <template data-fx="nebula" data-label="Nebula">
.bg-fx-nebula {
  background:
    radial-gradient(42vw 42vw at 22% 22%, color-mix(in srgb, var(--accent) 32%, transparent), transparent 70%),
    radial-gradient(42vw 42vw at 78% 62%, color-mix(in srgb, var(--accent2) 32%, transparent), transparent 70%);
  filter: blur(24px);
  animation: bgfx-nebula 20s ease-in-out infinite alternate;
}
@keyframes bgfx-nebula { from { transform: scale(1) translate(0,0); } to { transform: scale(1.15) translate(0,-4vh); } }
    </template>

    <template data-fx="snow" data-label="Snow">
.bg-fx-snow, .bg-fx-snow::after {
  background-image:
    radial-gradient(2px 2px at 20% 10%, #fff, transparent),
    radial-gradient(2px 2px at 60% 30%, #fff, transparent),
    radial-gradient(1px 1px at 80% 50%, #fff, transparent),
    radial-gradient(2px 2px at 40% 70%, #fff, transparent),
    radial-gradient(1px 1px at 10% 90%, #fff, transparent);
  background-size: 200px 200px;
  animation: bgfx-snow 9s linear infinite;
  opacity: .7;
}
.bg-fx-snow::after { content: ""; position: absolute; inset: 0; background-size: 320px 320px; animation-duration: 15s; opacity: .4; }
@keyframes bgfx-snow { from { background-position: 0 -200px; } to { background-position: 0 200px; } }
    </template>

    <template data-fx="drift" data-label="Color drift">
.bg-fx-drift {
  background: linear-gradient(120deg,
    transparent 0%,
    color-mix(in srgb, var(--accent) 20%, transparent) 28%,
    transparent 55%,
    color-mix(in srgb, var(--accent2) 20%, transparent) 80%,
    transparent 100%);
  background-size: 220% 220%;
  animation: bgfx-driftmove 16s ease infinite;
}
@keyframes bgfx-driftmove { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
    </template>

    <template data-fx="grid" data-label="Neon grid">
.bg-fx-grid {
  background-image:
    linear-gradient(to right, color-mix(in srgb, var(--accent) 24%, transparent) 1px, transparent 1px),
    linear-gradient(to bottom, color-mix(in srgb, var(--accent) 24%, transparent) 1px, transparent 1px);
  background-size: 44px 44px;
  -webkit-mask-image: radial-gradient(circle at 50% 0%, #000 30%, transparent 78%);
  mask-image: radial-gradient(circle at 50% 0%, #000 30%, transparent 78%);
  animation: bgfx-grid 6s linear infinite;
  opacity: .55;
}
@keyframes bgfx-grid { from { background-position: 0 0, 0 0; } to { background-position: 0 44px, 44px 0; } }
    </template>
  </div>

<script>
  (function () {
    var INITIAL_THEME = ${JSON.stringify(initialTheme)};
    var INITIAL_EFFECT = ${JSON.stringify(cfg.backgroundEffect || "none")};

    var COLOR_FIELDS = [
      { key: "accentColor",  label: "Accent",          type: "hex"  },
      { key: "accentColor2", label: "Accent 2",        type: "hex"  },
      { key: "textColor",    label: "Text",            type: "hex"  },
      { key: "playBtnText",  label: "Play-button icon", type: "hex" },
      { key: "panelBg",      label: "Panel",           type: "rgba" },
      { key: "overlayDark",  label: "Overlay",         type: "rgba" }
    ];

    var theme = {};
    for (var k in INITIAL_THEME) theme[k] = INITIAL_THEME[k];
    var stops = parseGradient(theme.bodyBg);
    var effect = INITIAL_EFFECT;

    // ── color helpers ──
    function clamp255(n) { n = Math.round(n); return n < 0 ? 0 : n > 255 ? 255 : n; }
    function hexToRgb(hex) {
      hex = String(hex).trim().replace("#", "");
      if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
      var n = parseInt(hex, 16);
      if (isNaN(n) || hex.length !== 6) return { r: 255, g: 255, b: 255 };
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    function rgbToHex(r, g, b) {
      function h(v) { v = clamp255(v).toString(16); return v.length === 1 ? "0" + v : v; }
      return "#" + h(r) + h(g) + h(b);
    }
    function parseRgba(str) {
      var m = String(str).match(/(-?\\d*\\.?\\d+)/g);
      if (m && m.length >= 3) {
        return { r: +m[0], g: +m[1], b: +m[2], a: m.length >= 4 ? +m[3] : 1 };
      }
      var rgb = hexToRgb(str);
      return { r: rgb.r, g: rgb.g, b: rgb.b, a: 1 };
    }
    function composeRgba(r, g, b, a) {
      return "rgba(" + clamp255(r) + ", " + clamp255(g) + ", " + clamp255(b) + ", " + a + ")";
    }
    function isHex(v) { return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(v).trim()); }

    function parseGradient(str) {
      return String(str).split(",").map(function (part) {
        part = part.trim();
        var mm = part.match(/(.*?)\\s+(-?\\d*\\.?\\d+)%$/);
        if (mm) return { color: mm[1].trim(), pos: +mm[2] };
        return { color: part, pos: 0 };
      });
    }
    function composeGradient(list) {
      return list.map(function (s) { return s.color + " " + s.pos + "%"; }).join(", ");
    }

    // ── build color controls ──
    var colorFields = document.getElementById("colorFields");
    COLOR_FIELDS.forEach(function (f) {
      var row = document.createElement("div");
      row.className = "field";
      var lbl = document.createElement("label");
      lbl.textContent = f.label;
      row.appendChild(lbl);

      if (f.type === "hex") {
        var picker = document.createElement("input");
        picker.type = "color";
        picker.value = isHex(theme[f.key]) ? theme[f.key] : "#ffffff";
        var text = document.createElement("input");
        text.type = "text"; text.value = theme[f.key];
        picker.addEventListener("input", function () { theme[f.key] = picker.value; text.value = picker.value; apply(); });
        text.addEventListener("input", function () {
          theme[f.key] = text.value.trim();
          if (isHex(theme[f.key])) picker.value = theme[f.key];
          apply();
        });
        row.appendChild(picker); row.appendChild(text);
      } else { // rgba
        var c = parseRgba(theme[f.key]);
        var picker2 = document.createElement("input");
        picker2.type = "color"; picker2.value = rgbToHex(c.r, c.g, c.b);
        var alpha = document.createElement("input");
        alpha.type = "range"; alpha.min = "0"; alpha.max = "100"; alpha.value = Math.round(c.a * 100);
        var text2 = document.createElement("input");
        text2.type = "text"; text2.value = theme[f.key];
        function recompose() {
          var rgb = hexToRgb(picker2.value);
          var a = (+alpha.value) / 100;
          theme[f.key] = composeRgba(rgb.r, rgb.g, rgb.b, a);
          text2.value = theme[f.key]; apply();
        }
        picker2.addEventListener("input", recompose);
        alpha.addEventListener("input", recompose);
        text2.addEventListener("input", function () {
          theme[f.key] = text2.value.trim();
          var p = parseRgba(theme[f.key]);
          picker2.value = rgbToHex(p.r, p.g, p.b);
          alpha.value = Math.round(p.a * 100);
          apply();
        });
        row.appendChild(picker2); row.appendChild(alpha); row.appendChild(text2);
      }
      colorFields.appendChild(row);
    });

    // ── build gradient controls ──
    var gradFields = document.getElementById("gradFields");
    function renderGradientRows() {
      gradFields.innerHTML = "";
      stops.forEach(function (s, i) {
        var row = document.createElement("div");
        row.className = "grad-stop";
        var picker = document.createElement("input");
        picker.type = "color"; picker.value = isHex(s.color) ? s.color : "#000000";
        picker.addEventListener("input", function () { s.color = picker.value; syncGradient(); });
        var text = document.createElement("input");
        text.type = "text"; text.value = s.color;
        text.style.width = "96px";
        text.addEventListener("input", function () { s.color = text.value.trim(); if (isHex(s.color)) picker.value = s.color; syncGradient(); });
        var pos = document.createElement("input");
        pos.type = "number"; pos.min = "0"; pos.max = "100"; pos.value = s.pos;
        pos.addEventListener("input", function () { s.pos = +pos.value; syncGradient(); });
        var unit = document.createElement("span"); unit.className = "pos-unit"; unit.textContent = "%";
        var del = document.createElement("button");
        del.className = "mini-btn"; del.textContent = "✕";
        del.title = "remove stop";
        del.addEventListener("click", function () {
          if (stops.length <= 2) return;
          stops.splice(i, 1); renderGradientRows(); syncGradient();
        });
        row.appendChild(picker); row.appendChild(text); row.appendChild(pos); row.appendChild(unit); row.appendChild(del);
        gradFields.appendChild(row);
      });
    }
    function syncGradient() { theme.bodyBg = composeGradient(stops); apply(); }
    document.getElementById("addStop").addEventListener("click", function () {
      var last = stops[stops.length - 1];
      stops.push({ color: last ? last.color : "#000000", pos: 100 });
      renderGradientRows(); syncGradient();
    });
    renderGradientRows();

    // ── background effects ──
    var EFFECTS = {};   // key -> { label, css }
    var fxGrid = document.getElementById("fxGrid");
    var defs = document.querySelectorAll("#fxDefs template");
    for (var i = 0; i < defs.length; i++) {
      var t = defs[i];
      var key = t.getAttribute("data-fx");
      EFFECTS[key] = { label: t.getAttribute("data-label"), css: (t.innerHTML || "").trim() };
    }
    Object.keys(EFFECTS).forEach(function (key) {
      var opt = document.createElement("button");
      opt.className = "fx-opt" + (key === effect ? " active" : "");
      opt.setAttribute("data-fx", key);
      var swatch = document.createElement("div");
      swatch.className = "swatch" + (key !== "none" ? " bg-fx-" + key : "");
      // give the swatch its own theme colors so the mini-preview reads well
      swatch.style.setProperty("--accent", "#7dd3fc");
      swatch.style.setProperty("--accent2", "#c084fc");
      var span = document.createElement("span");
      span.textContent = EFFECTS[key].label;
      opt.appendChild(swatch); opt.appendChild(span);
      opt.addEventListener("click", function () {
        effect = this.getAttribute("data-fx");
        var all = fxGrid.querySelectorAll(".fx-opt");
        for (var j = 0; j < all.length; j++) all[j].classList.remove("active");
        this.classList.add("active");
        apply();
      });
      fxGrid.appendChild(opt);
    });

    // per-swatch CSS lives in a global style tag (uses the same effect CSS)
    var swatchStyle = document.createElement("style");
    var swatchCss = "";
    Object.keys(EFFECTS).forEach(function (key) { swatchCss += EFFECTS[key].css + "\\n"; });
    swatchStyle.textContent = swatchCss;
    document.head.appendChild(swatchStyle);

    // ── apply to preview ──
    var previewRoot = document.getElementById("previewRoot");
    var stage = document.querySelector(".preview");
    var fxLayer = document.getElementById("fxLayer");
    var fxStyle = document.createElement("style");
    document.head.appendChild(fxStyle);

    function apply() {
      // vars go on the shared stage so BOTH the card and the effect layer inherit them
      stage.style.setProperty("--accent", theme.accentColor);
      stage.style.setProperty("--accent2", theme.accentColor2);
      stage.style.setProperty("--panel-bg", theme.panelBg);
      stage.style.setProperty("--text", theme.textColor);
      stage.style.setProperty("--overlay-dark", theme.overlayDark);
      stage.style.setProperty("--play-text", theme.playBtnText);
      previewRoot.style.background = "radial-gradient(circle at 50% 0%, " + theme.bodyBg + ")";
      fxLayer.className = (effect && effect !== "none") ? "bg-fx bg-fx-" + effect : "";
      fxStyle.textContent = (effect && EFFECTS[effect]) ? EFFECTS[effect].css : "";
    }
    apply();

    // ── export ──
    function pad(s, n) { s = String(s); while (s.length < n) s += " "; return s; }
    function buildExport() {
      var lines = [];
      lines.push("/* ── Theme colors — paste into each page's CONFIG ── */");
      lines.push('  ' + pad("accentColor:", 14) + '"' + theme.accentColor + '",');
      lines.push('  ' + pad("accentColor2:", 14) + '"' + theme.accentColor2 + '",');
      lines.push('  ' + pad("bodyBg:", 14) + '"' + theme.bodyBg + '",');
      lines.push('  ' + pad("panelBg:", 14) + '"' + theme.panelBg + '",');
      lines.push('  ' + pad("textColor:", 14) + '"' + theme.textColor + '",');
      lines.push('  ' + pad("overlayDark:", 14) + '"' + theme.overlayDark + '",');
      lines.push('  ' + pad("playBtnText:", 14) + '"' + theme.playBtnText + '",');
      lines.push("");

      if (effect && effect !== "none") {
        lines.push("/* ── Background effect: \\"" + effect + "\\" ── */");
        lines.push("/* 1) drop this element in right after <body> (replaces the old <div class=\\"stars\\">): */");
        lines.push('<div class="bg-fx bg-fx-' + effect + '"></div>');
        lines.push("");
        lines.push("/* 2) add this CSS to the page <style> (it reads --accent/--accent2 from :root): */");
        lines.push(".bg-fx { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }");
        lines.push(EFFECTS[effect].css);
        lines.push("");
      } else {
        lines.push("/* Background effect: none */");
        lines.push("");
      }

      lines.push("/* ── JSON (for tooling) ── */");
      lines.push(JSON.stringify({
        colors: {
          accentColor: theme.accentColor, accentColor2: theme.accentColor2,
          bodyBg: theme.bodyBg, panelBg: theme.panelBg, textColor: theme.textColor,
          overlayDark: theme.overlayDark, playBtnText: theme.playBtnText
        },
        backgroundEffect: effect
      }, null, 2));
      return lines.join("\\n");
    }

    var modal = document.getElementById("modal");
    var exportText = document.getElementById("exportText");
    function openModal() { exportText.value = buildExport(); modal.classList.add("open"); }
    function closeModal() { modal.classList.remove("open"); }
    document.getElementById("exportBtn").addEventListener("click", openModal);
    document.getElementById("modalClose").addEventListener("click", closeModal);
    document.getElementById("modalClose2").addEventListener("click", closeModal);
    modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
    document.getElementById("copyBtn").addEventListener("click", function () {
      exportText.removeAttribute("readonly");
      exportText.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) {}
      if (navigator.clipboard) { navigator.clipboard.writeText(exportText.value).catch(function(){}); ok = true; }
      exportText.setAttribute("readonly", "readonly");
      var btn = document.getElementById("copyBtn");
      var old = btn.textContent; btn.textContent = ok ? "Copied!" : "Press Ctrl+C";
      setTimeout(function () { btn.textContent = old; }, 1400);
    });

    // ── reset ──
    document.getElementById("resetBtn").addEventListener("click", function () {
      for (var kk in INITIAL_THEME) theme[kk] = INITIAL_THEME[kk];
      stops = parseGradient(theme.bodyBg);
      effect = INITIAL_EFFECT;
      // rebuild the whole panel simply by reloading (keeps code small + correct)
      location.reload();
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
