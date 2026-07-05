"""
Scarlet - GitHub Uploader (v2)
================================
Paste any YouTube URL or playlist, preview tracks with the
built-in audio player, then upload selected tracks to GitHub.

Requirements:
    pip install yt-dlp pillow
    ffplay and ffmpeg must be in PATH  (both come with the ffmpeg install)
    (ffmpeg is used to convert downloaded tracks to .mp4 before upload)
"""

import io
import json
import os
import shutil
import subprocess
import tempfile
import threading
import time
import tkinter as tk
from tkinter import messagebox, ttk
from tkinter import font as tkfont
from typing import Optional
import urllib.request as _urlreq
import urllib.parse
import re

import yt_dlp

try:
    from PIL import Image, ImageTk
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False


# ── Paths & constants ──────────────────────────────────────────
_SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
_CONFIG_FILE = os.path.join(_SCRIPT_DIR, "uploader_config.json")
_CLONE_DIR   = os.path.join(_SCRIPT_DIR, "repo_clone")
_DL_DIR      = os.path.join(tempfile.gettempdir(), "scarlet_gh_dl")
os.makedirs(_DL_DIR, exist_ok=True)

_DEFAULT_REPO = "git@github.com:sourwisard/depo.git"
_SSH_KEY      = r"C:\Users\vfvrt\.ssh\id_ed25519"

BG       = "#0f0f0f"
SURFACE  = "#161616"
CARD     = "#1e1e1e"
BORDER   = "#2a2a2a"
ACCENT   = "#e8454a"
ACCENT2  = "#ff6b6f"
TEXT     = "#f0f0f0"
MUTED    = "#888888"
DIM      = "#444444"
SUCCESS  = "#4ade80"
WARN     = "#facc15"

FONT_TITLE = ("Georgia", 11, "bold")
FONT_BODY  = ("Georgia", 10)
FONT_SMALL = ("Georgia", 9)
FONT_BIG   = ("Georgia", 15, "bold")
FONT_MONO  = ("Courier New", 9)
FONT_TINY  = ("Courier New", 8)


# ── Config ─────────────────────────────────────────────────────
def load_config() -> dict:
    try:
        with open(_CONFIG_FILE, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"repo_url": _DEFAULT_REPO, "ssh_key": _SSH_KEY}

def save_config(cfg: dict):
    try:
        with open(_CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)
    except Exception as e:
        print(f"[Config] {e}")


# ── yt-dlp helpers ─────────────────────────────────────────────
def _ytmusic_to_youtube(url: str) -> str:
    return url.replace("music.youtube.com", "www.youtube.com")

def _best_thumbnail(entry: dict) -> str:
    for t in reversed(entry.get("thumbnails") or []):
        if t and t.get("url"):
            return t["url"]
    if entry.get("thumbnail"):
        return entry["thumbnail"]
    vid = entry.get("id", "")
    return f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg" if vid else ""

def _base_opts(**extra) -> dict:
    opts = {"quiet": True, "no_warnings": True, "socket_timeout": 20, **extra}
    cookie_path = os.path.join(_SCRIPT_DIR, "cookies.txt")
    if os.path.isfile(cookie_path):
        opts["cookiefile"] = cookie_path
    return opts

def _track_from_entry(entry: dict) -> dict:
    vid_url = entry.get("url") or entry.get("webpage_url") or ""
    if vid_url and not vid_url.startswith("http"):
        vid_url = "https://www.youtube.com/watch?v=" + vid_url.lstrip("/")
    return {
        "title":     entry.get("title", "Unknown"),
        "uploader":  entry.get("uploader") or entry.get("channel", ""),
        "duration":  entry.get("duration") or 0,
        "url":       vid_url,
        "id":        entry.get("id", ""),
        "thumbnail": _best_thumbnail(entry),
    }

def fmt_duration(secs) -> str:
    if not secs:
        return "--:--"
    secs = int(secs)
    m, s = divmod(secs, 60)
    h, m = divmod(m, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"

def fetch_tracks(url: str, status_cb=None):
    url = _ytmusic_to_youtube(url.strip())
    if status_cb:
        status_cb("Fetching track info...")
    opts = _base_opts(extract_flat="in_playlist", noplaylist=False)
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
    if not info:
        raise RuntimeError("yt-dlp returned no info.")
    playlist_title = info.get("title") or info.get("playlist_title") or ""
    entries = info.get("entries")
    if entries:
        return [_track_from_entry(e) for e in entries if e], playlist_title
    track = {
        "title":     info.get("title", "Unknown"),
        "uploader":  info.get("uploader") or info.get("channel", ""),
        "duration":  info.get("duration") or 0,
        "url":       info.get("webpage_url") or url,
        "id":        info.get("id", ""),
        "thumbnail": _best_thumbnail(info),
    }
    return [track], playlist_title

def get_stream_url(video_url: str) -> str:
    cookie_args = []
    cookie_path = os.path.join(_SCRIPT_DIR, "cookies.txt")
    if os.path.isfile(cookie_path):
        cookie_args = ["--cookies", cookie_path]
        
    cmd = ["yt-dlp", "-g", "-f", "bestaudio/best", *cookie_args, video_url]
    res = subprocess.run(cmd, capture_output=True, text=True, creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    
    if res.returncode != 0:
        cmd = ["yt-dlp", "-g", "-f", "best", *cookie_args, video_url]
        res = subprocess.run(cmd, capture_output=True, text=True, creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        
    if res.returncode == 0 and res.stdout.strip():
        # -g might return multiple lines if video and audio are separate but bestaudio/best usually returns 1
        return res.stdout.strip().split('\n')[0]
    raise RuntimeError(f"Could not resolve stream URL: {res.stderr}")

def download_track(video_url: str, dest_dir: str, progress_cb=None) -> str:
    cookie_args = []
    cookie_path = os.path.join(_SCRIPT_DIR, "cookies.txt")
    if os.path.isfile(cookie_path):
        cookie_args = ["--cookies", cookie_path]

    # Get video ID first so we can find the file
    cmd_id = ["yt-dlp", "--get-id", *cookie_args, video_url]
    res_id = subprocess.run(cmd_id, capture_output=True, text=True, creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    video_id = res_id.stdout.strip()

    out_tmpl = os.path.join(dest_dir, "%(id)s.%(ext)s")
    cmd_dl = ["yt-dlp", "-f", "bestaudio/best", "-o", out_tmpl,
              "--retries", "10", "--fragment-retries", "10",
              *cookie_args, video_url]

    def _run_dl(cmd):
        lines_seen = []
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        for line in proc.stdout:
            lines_seen.append(line)
            if progress_cb and "[download]" in line and "%" in line:
                try:
                    pct_str = line.split("%")[0].split()[-1]
                    progress_cb(f"dl {pct_str}%")
                except Exception:
                    pass
        proc.wait()
        return proc.returncode, "".join(lines_seen)

    if progress_cb: progress_cb("starting dl...")
    rc, out1 = _run_dl(cmd_dl)
    out2 = ""
    if rc != 0:
        if progress_cb: progress_cb("fallback dl...")
        cmd_dl[2] = "best"
        rc, out2 = _run_dl(cmd_dl)

    candidates = [os.path.join(dest_dir, f) for f in os.listdir(dest_dir)
                  if video_id and f.startswith(video_id)]
    if not candidates:
        all_files = [os.path.join(dest_dir, f) for f in os.listdir(dest_dir)]
        candidates = sorted(all_files, key=os.path.getmtime, reverse=True) if all_files else []

    if rc != 0 and not candidates:
        tail = (out2 or out1).strip().splitlines()
        detail = "\n".join(tail[-8:]) if tail else "(no output captured)"
        raise RuntimeError(f"yt-dlp download failed:\n{detail}")

    if rc != 0 and candidates:
        # yt-dlp exited non-zero (commonly a dropped HLS fragment near the
        # end of the stream) but still produced a usable file -- accept it
        # rather than throwing away an otherwise-fine download.
        if progress_cb:
            progress_cb("dl had warnings, using output")

    if not candidates:
        raise RuntimeError("No output file found after download.")
    return max(candidates, key=os.path.getsize)


def convert_to_mp4(local_file: str, status_cb=None) -> str:
    """Convert a downloaded audio file to an .mp4 container if it isn't one
    already. Uses ffmpeg (AAC audio, no video track). Returns the path to
    the file that should actually be uploaded (original if already .mp4)."""
    ext = os.path.splitext(local_file)[1].lower()
    if ext == ".mp4":
        return local_file

    out_file = os.path.splitext(local_file)[0] + ".mp4"
    if status_cb:
        status_cb("converting to mp4...")

    cmd = ["ffmpeg", "-y", "-i", local_file,
           "-vn", "-c:a", "aac", "-b:a", "192k", out_file]
    result = subprocess.run(
        cmd, capture_output=True, text=True,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)

    if result.returncode != 0 or not os.path.isfile(out_file):
        raise RuntimeError(
            f"ffmpeg conversion to mp4 failed: {(result.stderr or '')[-400:]}")

    try:
        os.remove(local_file)
    except Exception:
        pass
    return out_file


# ── Thumbnail & Lyrics ─────────────────────────────────────────
def _fetch_thumbnail(url: str, size=(48, 48)):
    if not PIL_AVAILABLE or not url:
        return None
    try:
        req = _urlreq.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with _urlreq.urlopen(req, timeout=8) as resp:
            data = resp.read()
        img = Image.open(io.BytesIO(data)).convert("RGB")
        img.thumbnail(size, Image.LANCZOS)
        bg = Image.new("RGB", size, (30, 30, 30))
        off = ((size[0] - img.width) // 2, (size[1] - img.height) // 2)
        bg.paste(img, off)
        return ImageTk.PhotoImage(bg)
    except Exception:
        return None

def fetch_lyrics(title: str, artist: str) -> str:
    if artist:
        artist_clean = re.sub(r'(?i)\s*-\s*Topic$', '', artist).strip()
        url = f"https://lrclib.net/api/search?track_name={urllib.parse.quote(title)}&artist_name={urllib.parse.quote(artist_clean)}"
    else:
        title_clean = re.sub(r'\([^)]*\)', '', title).strip()
        url = f"https://lrclib.net/api/search?q={urllib.parse.quote(title_clean)}"
        
    req = _urlreq.Request(url, headers={'User-Agent': 'ScarletUploader/1.0'})
    try:
        with _urlreq.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            if data and isinstance(data, list) and len(data) > 0:
                best = next((r for r in data if r.get('syncedLyrics')), None)
                if not best:
                    best = next((r for r in data if r.get('plainLyrics')), data[0])
                return best.get('syncedLyrics') or best.get('plainLyrics') or ""
    except Exception:
        pass
    return ""


# ── Audio player (ffplay) ───────────────────────────────────────
class AudioPlayer:
    def __init__(self):
        self._proc: Optional[subprocess.Popen] = None
        self._lock = threading.Lock()

    def play(self, stream_url: str, on_end=None):
        self.stop()
        def _run():
            try:
                cmd = ["ffplay", "-nodisp", "-autoexit",
                       "-loglevel", "quiet", stream_url]
                with self._lock:
                    self._proc = subprocess.Popen(
                        cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                self._proc.wait()
            except Exception as e:
                print(f"[Player] {e}")
            finally:
                with self._lock:
                    self._proc = None
                if on_end:
                    on_end()
        threading.Thread(target=_run, daemon=True).start()

    def stop(self):
        with self._lock:
            if self._proc and self._proc.poll() is None:
                try:
                    self._proc.terminate()
                except Exception:
                    pass
                self._proc = None

    @property
    def is_playing(self) -> bool:
        with self._lock:
            return self._proc is not None and self._proc.poll() is None


# ── Git helpers ─────────────────────────────────────────────────
def _git_env(ssh_key: str) -> dict:
    env = os.environ.copy()
    env["GIT_SSH_COMMAND"] = f'ssh -i "{ssh_key}" -o StrictHostKeyChecking=no'
    return env

def get_git_cmd():
    import shutil
    return shutil.which("git") or r"C:\Program Files\Microsoft Visual Studio\18\Community\Common7\IDE\CommonExtensions\Microsoft\TeamFoundation\Team Explorer\Git\cmd\git.exe"

def _run_git(*args, cwd=None, ssh_key=_SSH_KEY) -> str:
    result = subprocess.run(
        [get_git_cmd()] + list(args),
        cwd=cwd or _CLONE_DIR,
        env=_git_env(ssh_key),
        capture_output=True, text=True)
    out = (result.stdout or "") + (result.stderr or "")
    if result.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed:\n{out.strip()}")
    return out.strip()

def ensure_repo_cloned(repo_url: str, ssh_key: str, status_cb=None) -> str:
    if os.path.isdir(os.path.join(_CLONE_DIR, ".git")):
        return _CLONE_DIR
    if status_cb:
        status_cb("Cloning repo...")
    os.makedirs(_CLONE_DIR, exist_ok=True)
    result = subprocess.run(
        [get_git_cmd(), "clone", repo_url, _CLONE_DIR],
        env=_git_env(ssh_key), capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError("git clone failed:\n" +
                           (result.stdout or "") + (result.stderr or ""))
    return _CLONE_DIR

def push_track_to_github(track, local_file, repo_url, ssh_key, status_cb=None):
    kw = dict(ssh_key=ssh_key)
    ensure_repo_cloned(repo_url, ssh_key, status_cb=status_cb)
    if status_cb:
        status_cb("Pulling latest...")
    try:
        _run_git("pull", "--rebase", "--autostash", **kw)
    except RuntimeError as e:
        print(f"[Git] pull warning: {e}")

    music_dir = os.path.join(_CLONE_DIR, "music")
    os.makedirs(music_dir, exist_ok=True)

    ext       = os.path.splitext(local_file)[1]
    safe_id   = track.get("id") or "unknown"
    dest_name = f"{safe_id}{ext}"
    shutil.copy2(local_file, os.path.join(music_dir, dest_name))

    meta_path = os.path.join(_CLONE_DIR, "metadata.json")
    tracks, playlist_settings = load_metadata(meta_path)

    tracks = [e for e in tracks if e.get("id") != safe_id]
    tracks.append({
        "id":          safe_id,
        "title":       track.get("title", "Unknown"),
        "uploader":    track.get("uploader", ""),
        "duration":    track.get("duration", 0),
        "url":         track.get("url", ""),
        "thumbnail":   track.get("thumbnail", ""),
        "file":        f"music/{dest_name}",
        "lyrics":      track.get("lyrics", ""),
        "playlists":   track.get("playlists", {}),
        "uploaded_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    })
    # Make sure every playlist this track is tagged into has a settings
    # entry (defaulting to not shown on the worker until someone opens
    # Manage Library and checks it).
    for name in track.get("playlists", {}):
        playlist_settings.setdefault(name, default_playlist_settings())
    save_metadata(meta_path, tracks, playlist_settings)

    if status_cb:
        status_cb("Staging...")
    _run_git("add", f"music/{dest_name}", "metadata.json", **kw)
    _run_git("-c", "user.name=Scarlet Uploader", "-c", "user.email=scarlet@local",
             "commit", "-m", f"Add: {track.get('title','')[:80]}", **kw)
    if status_cb:
        status_cb("Pushing...")
    _run_git("push", "origin", "HEAD", **kw)
    try:
        return _run_git("rev-parse", "--short", "HEAD", **kw)
    except Exception:
        return "done"


def push_playlist_update_to_github(track_id, pl_dict, repo_url, ssh_key, status_cb=None):
    """Update just the 'playlists' field for a track that's already in
    metadata.json (already downloaded/uploaded), without touching its file."""
    kw = dict(ssh_key=ssh_key)
    ensure_repo_cloned(repo_url, ssh_key, status_cb=status_cb)
    if status_cb:
        status_cb("Pulling latest...")
    try:
        _run_git("pull", "--rebase", "--autostash", **kw)
    except RuntimeError as e:
        print(f"[Git] pull warning: {e}")

    meta_path = os.path.join(_CLONE_DIR, "metadata.json")
    tracks, playlist_settings = load_metadata(meta_path)

    found = False
    for entry in tracks:
        if isinstance(entry, dict) and entry.get("id") == track_id:
            entry["playlists"] = pl_dict
            found = True
            break
    if not found:
        return None

    for name in pl_dict:
        playlist_settings.setdefault(name, default_playlist_settings())

    save_metadata(meta_path, tracks, playlist_settings)

    if status_cb:
        status_cb("Staging...")
    _run_git("add", "metadata.json", **kw)
    _run_git("-c", "user.name=Scarlet Uploader", "-c", "user.email=scarlet@local",
             "commit", "-m", f"Update playlists: {track_id}", **kw)
    if status_cb:
        status_cb("Pushing...")
    _run_git("push", "origin", "HEAD", **kw)
    try:
        return _run_git("rev-parse", "--short", "HEAD", **kw)
    except Exception:
        return "done"


# ── Settings dialog ─────────────────────────────────────────────
class SettingsDialog(tk.Toplevel):
    def __init__(self, parent, cfg, on_save):
        super().__init__(parent)
        self.title("Settings")
        self.configure(bg=BG)
        self.resizable(False, False)
        self.grab_set()
        self._cfg = cfg
        self._on_save = on_save

        pad = dict(padx=16, pady=6)
        tk.Label(self, text="GitHub Repo URL (SSH)",
                 font=FONT_SMALL, bg=BG, fg=MUTED).pack(anchor="w", **pad)
        self._repo_var = tk.StringVar(value=cfg.get("repo_url", _DEFAULT_REPO))
        tk.Entry(self, textvariable=self._repo_var, width=54,
                 bg=CARD, fg=TEXT, insertbackground=TEXT,
                 relief="flat", bd=0, font=FONT_MONO).pack(padx=16, pady=(0,6), fill="x")

        tk.Label(self, text="SSH Key Path",
                 font=FONT_SMALL, bg=BG, fg=MUTED).pack(anchor="w", **pad)
        self._key_var = tk.StringVar(value=cfg.get("ssh_key", _SSH_KEY))
        tk.Entry(self, textvariable=self._key_var, width=54,
                 bg=CARD, fg=TEXT, insertbackground=TEXT,
                 relief="flat", bd=0, font=FONT_MONO).pack(padx=16, pady=(0,16), fill="x")

        row = tk.Frame(self, bg=BG)
        row.pack(fill="x", padx=16, pady=(0, 16))
        tk.Button(row, text="Save", font=FONT_BODY, bg=ACCENT, fg=TEXT,
                  activebackground=ACCENT2, relief="flat", bd=0,
                  padx=14, pady=6, command=self._save).pack(side="right")
        tk.Button(row, text="Cancel", font=FONT_BODY, bg=CARD, fg=MUTED,
                  activebackground=BORDER, relief="flat", bd=0,
                  padx=14, pady=6, command=self.destroy).pack(side="right", padx=(0,8))

    def _save(self):
        self._cfg["repo_url"] = self._repo_var.get().strip()
        self._cfg["ssh_key"]  = self._key_var.get().strip()
        save_config(self._cfg)
        self._on_save(self._cfg)
        self.destroy()


def _bind_wheel_recursive(widget, handler):
    """Bind mousewheel scrolling to a widget and every descendant, so
    scrolling works no matter which child widget (button, entry, label...)
    the cursor happens to be over -- plain canvas/frame bindings only fire
    when the pointer is over their own background, not over children."""
    widget.bind("<MouseWheel>", handler, add="+")
    for child in widget.winfo_children():
        _bind_wheel_recursive(child, handler)


def load_metadata(path):
    """Read metadata.json, returning (tracks, playlist_settings).

    Supports the current object format:
        {"tracks": [...], "playlists": {"Name": {"showOnWorker": bool, ...}}}
    as well as the legacy format where the file is just a bare array of
    track entries (in which case playlist_settings comes back empty --
    there's nothing tagged yet).
    """
    try:
        with open(path, encoding="utf-8") as f:
            raw = json.load(f)
    except Exception:
        return [], {}

    if isinstance(raw, dict):
        tracks = raw.get("tracks")
        playlists = raw.get("playlists")
        return (tracks if isinstance(tracks, list) else [],
                playlists if isinstance(playlists, dict) else {})
    if isinstance(raw, list):
        return raw, {}
    return [], {}


def save_metadata(path, tracks, playlist_settings):
    """Write metadata.json in the current {tracks, playlists} object format."""
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"tracks": tracks, "playlists": playlist_settings},
                   f, indent=2, ensure_ascii=False)


# The 4 placeholder fields are reserved for future per-playlist settings
# (not read by the worker yet) -- kept alongside showOnWorker so the
# schema doesn't need to change again when they're wired up later.
PLACEHOLDER_KEYS = ["placeholder1", "placeholder2", "placeholder3", "placeholder4"]


def default_playlist_settings():
    settings = {"showOnWorker": False}
    for key in PLACEHOLDER_KEYS:
        settings[key] = ""
    return settings


def get_track_playlist_orders(entry):
    """Read a track's playlist membership + per-playlist position, supporting:
    - the current format: 'playlists' is a dict of {name: position}
    - the previous format: 'playlists' is a plain list of names (position = index)
    - the original format: a single-string 'playlist' field
    """
    pl = entry.get("playlists")
    if isinstance(pl, dict):
        return {str(k).strip(): v for k, v in pl.items() if str(k).strip()}
    if isinstance(pl, list):
        return {name.strip(): i for i, name in enumerate(pl)
                if isinstance(name, str) and name.strip()}
    legacy = entry.get("playlist")
    if isinstance(legacy, str) and legacy.strip():
        return {legacy.strip(): 0}
    return {}


def get_track_playlists(entry):
    """List of playlist names a track belongs to, ordered by each name's
    stored position (for display in the comma-separated field)."""
    orders = get_track_playlist_orders(entry)
    return [name for name, _ in sorted(orders.items(), key=lambda kv: kv[1])]


class TrackRow(tk.Frame):
    def __init__(self, parent, track, index, on_play, on_check_change,
                 on_move=None, show_select=True, initial_playlists=None, **kwargs):
        row_bg = CARD if index % 2 == 0 else SURFACE
        super().__init__(parent, bg=row_bg, **kwargs)
        self._track    = track
        self._on_play  = on_play
        self._on_check = on_check_change
        self._on_move  = on_move
        self._row_bg   = row_bg
        self._thumb_img = None
        self._checked  = tk.BooleanVar(value=True)

        if on_move:
            nav = tk.Frame(self, bg=row_bg)
            nav.pack(side="left", padx=(6, 0))
            tk.Button(nav, text="▲", font=FONT_TINY, bg=BORDER, fg=MUTED,
                      activebackground=DIM, relief="flat", bd=0, width=2,
                      cursor="hand2",
                      command=lambda: self._on_move(self, -1)).pack(side="top")
            tk.Button(nav, text="▼", font=FONT_TINY, bg=BORDER, fg=MUTED,
                      activebackground=DIM, relief="flat", bd=0, width=2,
                      cursor="hand2",
                      command=lambda: self._on_move(self, 1)).pack(side="top")

        if show_select:
            tk.Checkbutton(
                self, variable=self._checked,
                bg=row_bg, activebackground=row_bg, fg=TEXT, selectcolor=CARD,
                relief="flat", bd=0, command=self._on_cb_toggle
            ).pack(side="left", padx=(8, 2))

        self._thumb_lbl = tk.Label(self, bg=row_bg, width=6)
        self._thumb_lbl.pack(side="left", padx=(0, 6))

        # Fixed-width controls on the right are packed BEFORE the expanding
        # info frame below. Pack allocates space in the order widgets are
        # added, so an expand=True frame packed first would claim all the
        # remaining room and push these off-screen whenever the window
        # isn't wide enough to fit everything at once.
        self._play_btn = tk.Button(
            self, text="Play",
            font=FONT_SMALL, bg=BORDER, fg=ACCENT,
            activebackground=DIM, activeforeground=ACCENT2,
            relief="flat", bd=0, padx=10, pady=4, cursor="hand2",
            command=lambda: self._on_play(track, self))
        self._play_btn.pack(side="right", padx=(0, 8))

        self._status_lbl = tk.Label(
            self, text="", font=FONT_TINY, bg=row_bg, fg=DIM,
            width=14, anchor="w")
        self._status_lbl.pack(side="right", padx=(0, 4))

        tk.Label(self, text=fmt_duration(track.get("duration", 0)),
                 font=FONT_TINY, bg=row_bg, fg=DIM,
                 width=7, anchor="e").pack(side="right", padx=(0, 6))

        info = tk.Frame(self, bg=row_bg)
        info.pack(side="left", fill="both", expand=True)

        self._title_lbl = tk.Label(
            info, text=track.get("title", "Unknown"),
            font=FONT_BODY, bg=row_bg, fg=TEXT, anchor="w", justify="left")
        self._title_lbl.pack(anchor="w", fill="x")
        self._sub_lbl = tk.Label(
            info, text=track.get("uploader", ""),
            font=FONT_SMALL, bg=row_bg, fg=MUTED, anchor="w", justify="left")
        self._sub_lbl.pack(anchor="w", fill="x")

        # Wrap long titles/artists onto a second line instead of letting
        # them overflow the row (which is what was pushing Play/status/
        # duration off-screen at smaller window widths).
        def _on_info_resize(event):
            wrap = max(event.width, 40)
            self._title_lbl.configure(wraplength=wrap)
            self._sub_lbl.configure(wraplength=wrap)
        info.bind("<Configure>", _on_info_resize)

        pl_row = tk.Frame(info, bg=row_bg)
        pl_row.pack(anchor="w", fill="x", pady=(2, 0))
        tk.Label(
            pl_row, text="Playlists:", font=FONT_TINY, bg=row_bg, fg=MUTED
        ).pack(side="left")
        initial_text = ", ".join(initial_playlists or [])
        self._playlist_var = tk.StringVar(value=initial_text)
        self._playlist_entry = tk.Entry(
            pl_row, textvariable=self._playlist_var, width=10,
            bg=CARD, fg=TEXT, insertbackground=TEXT,
            relief="flat", bd=0, font=FONT_TINY)
        self._playlist_entry.pack(side="left", padx=(4, 0), fill="x", expand=True)
        self._playlist_placeholder = "e.g. Chill, Study"
        if not initial_text:
            self._playlist_entry.insert(0, self._playlist_placeholder)
            self._playlist_entry.configure(fg=DIM)
        self._playlist_entry.bind("<FocusIn>", self._on_playlist_focus_in)
        self._playlist_entry.bind("<FocusOut>", self._on_playlist_focus_out)

    def set_playing(self, playing: bool):
        if playing:
            self._play_btn.configure(text="Stop", fg=ACCENT, bg=DIM)
            self.configure(bg="#221111")
            self._title_lbl.configure(bg="#221111", fg=ACCENT2)
            self._sub_lbl.configure(bg="#221111")
            self._status_lbl.configure(bg="#221111", text="playing", fg=ACCENT)
        else:
            self._play_btn.configure(text="Play", fg=ACCENT, bg=BORDER)
            self.configure(bg=self._row_bg)
            self._title_lbl.configure(bg=self._row_bg, fg=TEXT)
            self._sub_lbl.configure(bg=self._row_bg)
            self._status_lbl.configure(bg=self._row_bg, text="", fg=DIM)

    def set_upload_status(self, status: str, color: str = MUTED):
        self._status_lbl.configure(text=status, fg=color)

    def set_thumb(self, img):
        if img:
            self._thumb_img = img
            self._thumb_lbl.configure(image=img, width=48, height=48)

    @property
    def checked(self):
        return self._checked.get()

    def set_checked(self, val):
        self._checked.set(val)
        self._on_cb_toggle()

    def _on_cb_toggle(self):
        self._on_check()

    def _on_playlist_focus_in(self, event=None):
        if self._playlist_var.get() == self._playlist_placeholder:
            self._playlist_entry.delete(0, "end")
            self._playlist_entry.configure(fg=TEXT)

    def _on_playlist_focus_out(self, event=None):
        if not self._playlist_var.get().strip():
            self._playlist_entry.insert(0, self._playlist_placeholder)
            self._playlist_entry.configure(fg=DIM)

    def set_playlist_names(self, names_text: str):
        """Programmatically set the playlist field (used by 'Upload as playlist')."""
        self._playlist_var.set(names_text)
        if names_text.strip():
            self._playlist_entry.configure(fg=TEXT)
        else:
            self._on_playlist_focus_out()

    @property
    def playlist_names(self):
        """List of playlist names this track belongs to (deduped, order-preserved)."""
        text = self._playlist_var.get()
        if text == self._playlist_placeholder:
            return []
        raw = text.split(",")
        seen = set()
        names = []
        for name in raw:
            name = name.strip()
            if name and name not in seen:
                seen.add(name)
                names.append(name)
        return names


# ── Library manager (reorder + playlists for tracks already on GitHub) ──
class LibraryDialog(tk.Toplevel):
    def __init__(self, parent, cfg):
        super().__init__(parent)
        self.title("Manage Library")
        self.geometry("640x680")
        self.minsize(480, 420)
        self.configure(bg=BG)
        self._cfg = cfg
        self._player = AudioPlayer()
        self._rows: list = []
        self._playing_row: Optional[TrackRow] = None
        self._meta_path: Optional[str] = None
        self._thumb_images = []
        self._view: Optional[str] = None          # None = "All Tracks"
        self._playlist_orders: dict = {}           # name -> [TrackRow, ...]
        self._playlist_settings: dict = {}          # name -> {showOnWorker, placeholder1..4}

        top = tk.Frame(self, bg=SURFACE, pady=10, padx=16)
        top.pack(fill="x")
        tk.Label(top, text="Manage Library", font=FONT_TITLE,
                 bg=SURFACE, fg=TEXT).pack(side="left")
        tk.Label(top, text="reorder tracks & set playlists", font=FONT_SMALL,
                 bg=SURFACE, fg=MUTED).pack(side="left", padx=(10, 0))

        views = tk.Frame(self, bg=BG, padx=16)
        views.pack(fill="x", pady=(10, 0))
        self._views_frame = views
        tk.Label(views, text="Viewing:", font=FONT_SMALL, bg=BG, fg=MUTED
                 ).pack(side="left", padx=(0, 6))
        # Pack the refresh button (side="right") BEFORE the expanding pills
        # row -- packing order determines who gets space first, so an
        # expand=True widget packed earlier would claim the whole row and
        # push this off-screen.
        tk.Button(
            views, text="\u21bb Refresh playlists", font=FONT_TINY,
            bg=BORDER, fg=MUTED, activebackground=DIM, relief="flat", bd=0,
            padx=8, pady=3, cursor="hand2", command=self._refresh_pills
        ).pack(side="right")
        self._pills_row = tk.Frame(views, bg=BG)
        self._pills_row.pack(side="left", fill="x", expand=True)

        # Per-playlist settings: only shown while a specific playlist tab
        # (not "All Tracks") is selected. "Show on worker" is the tag that
        # decides whether the Cloudflare Worker (C1oud.js) will surface this
        # playlist at all -- untagged playlists never appear there. The 4
        # "Reserved" boxes aren't used by anything yet; they're just saved
        # alongside showOnWorker for future features.
        self._settings_frame = tk.Frame(self, bg=SURFACE, padx=16, pady=8)
        self._settings_name_lbl = tk.Label(
            self._settings_frame, text="", font=FONT_BODY, bg=SURFACE, fg=TEXT)
        self._settings_name_lbl.pack(side="left", padx=(0, 12))
        self._show_on_worker_var = tk.BooleanVar(value=False)
        tk.Checkbutton(
            self._settings_frame, text="Show on worker",
            variable=self._show_on_worker_var,
            bg=SURFACE, activebackground=SURFACE, fg=TEXT, selectcolor=CARD,
            relief="flat", bd=0, command=self._on_show_on_worker_toggle
        ).pack(side="left", padx=(0, 16))
        self._placeholder_entries = []
        for i, key in enumerate(PLACEHOLDER_KEYS):
            box = tk.Frame(self._settings_frame, bg=SURFACE)
            box.pack(side="left", padx=(0, 8))
            tk.Label(box, text=f"Reserved {i + 1}", font=FONT_TINY,
                     bg=SURFACE, fg=MUTED).pack(anchor="w")
            var = tk.StringVar(value="")
            entry = tk.Entry(
                box, textvariable=var, width=8,
                bg=CARD, fg=TEXT, insertbackground=TEXT,
                relief="flat", bd=0, font=FONT_TINY)
            entry.pack(anchor="w")
            entry.bind("<FocusOut>", lambda e, k=key: self._on_placeholder_change(k))
            entry.bind("<Return>", lambda e, k=key: self._on_placeholder_change(k))
            self._placeholder_entries.append((key, var))

        self._status_var = tk.StringVar(value="Loading library from GitHub...")
        tk.Label(self, textvariable=self._status_var, font=FONT_SMALL,
                 bg=BG, fg=MUTED, anchor="w", wraplength=600, justify="left"
                 ).pack(fill="x", padx=16, pady=(8, 0))

        list_outer = tk.Frame(self, bg=BG)
        list_outer.pack(fill="both", expand=True, padx=10, pady=10)
        self._canvas = tk.Canvas(list_outer, bg=BG, highlightthickness=0)
        canvas = self._canvas
        scrollbar = tk.Scrollbar(list_outer, orient="vertical",
                                 command=canvas.yview, bg=SURFACE, troughcolor=BG)
        canvas.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side="right", fill="y")
        canvas.pack(side="left", fill="both", expand=True)
        self._list_frame = tk.Frame(canvas, bg=BG)
        win = canvas.create_window((0, 0), window=self._list_frame, anchor="nw")
        self._list_frame.bind(
            "<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.bind("<Configure>", lambda e: canvas.itemconfig(win, width=e.width))

        def _on_wheel(event):
            canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")
        self._on_wheel = _on_wheel
        _bind_wheel_recursive(canvas, _on_wheel)
        _bind_wheel_recursive(self._list_frame, _on_wheel)

        self._last_pill_width = 0
        views.bind("<Configure>", self._on_views_resize)

        bottom = tk.Frame(self, bg=BG, padx=16, pady=12)
        bottom.pack(fill="x", side="bottom")
        self._save_btn = tk.Button(
            bottom, text="Save Order & Playlists", font=FONT_TITLE,
            bg=DIM, fg=MUTED, activebackground=ACCENT, activeforeground=TEXT,
            relief="flat", bd=0, padx=20, pady=10, cursor="hand2",
            state="disabled", command=self._save)
        self._save_btn.pack(fill="x")

        threading.Thread(target=self._load, daemon=True).start()

    def _load(self):
        repo_url = self._cfg.get("repo_url", _DEFAULT_REPO)
        ssh_key  = self._cfg.get("ssh_key", _SSH_KEY)
        try:
            ensure_repo_cloned(
                repo_url, ssh_key,
                status_cb=lambda m: self.after(0, lambda: self._status_var.set(m)))
            try:
                _run_git("pull", "--rebase", "--autostash", ssh_key=ssh_key)
            except Exception as e:
                print(f"[Git] pull warning: {e}")
            meta_path = os.path.join(_CLONE_DIR, "metadata.json")
            self._meta_path = meta_path
            tracks, playlist_settings = load_metadata(meta_path)
        except Exception as e:
            self.after(0, lambda: self._status_var.set(f"Load failed: {e}"))
            return
        self.after(0, lambda: self._on_loaded(tracks, playlist_settings))

    def _on_loaded(self, meta, playlist_settings):
        self._playlist_settings = dict(playlist_settings)
        if not meta:
            self._status_var.set("No tracks in metadata.json yet -- upload something first.")
            return
        # Build rows, and seed each playlist's stored order from whatever
        # per-track positions were already saved (so opening the dialog
        # doesn't reset a playlist's custom order back to library order).
        name_positions = {}  # name -> [(position, row), ...]
        for i, entry in enumerate(meta):
            existing = get_track_playlists(entry)
            row = TrackRow(
                self._list_frame, entry, i,
                on_play=self._play_track,
                on_check_change=lambda: None,
                on_move=self._move_row,
                show_select=False,
                initial_playlists=existing)
            _bind_wheel_recursive(row, self._on_wheel)
            self._rows.append(row)
            for name, pos in get_track_playlist_orders(entry).items():
                name_positions.setdefault(name, []).append((pos, row))
        for name, pairs in name_positions.items():
            pairs.sort(key=lambda p: p[0])
            self._playlist_orders[name] = [r for _, r in pairs]

        self._refresh_pills()
        self._select_view(None)  # default to "All Tracks"
        self._status_var.set(
            f"{len(meta)} track(s). Use \u25b2\u25bc to reorder -- within \"All Tracks\" this "
            "sets the overall library order, within a playlist tab it only reorders that "
            "playlist. Type playlist names (comma-separated) per track to set membership, "
            "then click Refresh playlists to see new tabs.")
        self._save_btn.configure(state="normal", bg=ACCENT, fg=TEXT)
        threading.Thread(target=self._load_thumbs, daemon=True).start()

    def _load_thumbs(self):
        for row in list(self._rows):
            thumb = row._track.get("thumbnail")
            if not thumb:
                continue
            try:
                img = _fetch_thumbnail(thumb, size=(48, 48))
                if img:
                    self._thumb_images.append(img)
                    self.after(0, lambda r=row, im=img: r.set_thumb(im))
            except Exception:
                pass
            time.sleep(0.05)

    # ── View tabs (All Tracks + one per playlist) ──────────────────────
    def _known_playlist_names(self):
        names = set()
        for row in self._rows:
            names.update(row.playlist_names)
        return sorted(names)

    def _on_views_resize(self, event):
        # Only rebuild the pill layout when the width actually changed
        # (Configure fires on height changes too, which would be wasteful).
        if abs(event.width - self._last_pill_width) > 4:
            self._last_pill_width = event.width
            self._refresh_pills()

    def _refresh_pills(self):
        for w in self._pills_row.winfo_children():
            w.destroy()

        entries = [("All Tracks", None)] + [(n, n) for n in self._known_playlist_names()]

        self._pills_row.update_idletasks()
        max_width = self._pills_row.winfo_width()
        if max_width <= 1:
            max_width = max(self.winfo_width() - 200, 260)

        pill_font = tkfont.Font(font=FONT_TINY)
        gap = 6

        row_frame = tk.Frame(self._pills_row, bg=BG)
        row_frame.pack(anchor="w", fill="x")
        cur_width = 0
        for label, view_name in entries:
            # Rough width estimate: text + horizontal button padding/border.
            est_width = pill_font.measure(label) + 26
            if cur_width > 0 and cur_width + gap + est_width > max_width:
                row_frame = tk.Frame(self._pills_row, bg=BG)
                row_frame.pack(anchor="w", fill="x", pady=(gap, 0))
                cur_width = 0
            active = (self._view == view_name)
            btn = tk.Button(
                row_frame, text=label, font=FONT_TINY,
                bg=(ACCENT if active else BORDER), fg=(TEXT if active else MUTED),
                activebackground=ACCENT, activeforeground=TEXT,
                relief="flat", bd=0, padx=10, pady=4, cursor="hand2",
                command=lambda v=view_name: self._select_view(v))
            btn.pack(side="left", padx=(0, gap))
            cur_width += est_width + gap

    def _get_playlist_order(self, name):
        """Return (and refresh) the custom order list for a playlist: keeps
        existing relative order, appends newly-added members at the end,
        and drops members that were removed from that playlist."""
        current_members = [r for r in self._rows if name in r.playlist_names]
        member_set = set(current_members)
        stored = self._playlist_orders.get(name, [])
        kept = [r for r in stored if r in member_set]
        kept_set = set(kept)
        for r in current_members:
            if r not in kept_set:
                kept.append(r)
        self._playlist_orders[name] = kept
        return kept

    def _select_view(self, name):
        self._view = name
        display_rows = self._rows if name is None else self._get_playlist_order(name)
        for r in self._rows:
            r.pack_forget()
        for r in display_rows:
            r.pack(fill="x")
        self._refresh_pills()
        self._show_settings_for(name)

    def _show_settings_for(self, name):
        """Populate and show the Show-on-worker / reserved-boxes panel for
        the given playlist name, or hide it entirely for 'All Tracks'
        (None) -- "All Tracks" isn't a real taggable playlist."""
        if name is None:
            self._settings_frame.pack_forget()
            return
        settings = self._playlist_settings.setdefault(name, default_playlist_settings())
        self._settings_name_lbl.configure(text=name)
        self._show_on_worker_var.set(bool(settings.get("showOnWorker", False)))
        for key, var in self._placeholder_entries:
            var.set(settings.get(key, ""))
        self._settings_frame.pack(fill="x", after=self._views_frame)

    def _on_show_on_worker_toggle(self):
        if self._view is None:
            return
        settings = self._playlist_settings.setdefault(self._view, default_playlist_settings())
        settings["showOnWorker"] = self._show_on_worker_var.get()

    def _on_placeholder_change(self, key):
        if self._view is None:
            return
        settings = self._playlist_settings.setdefault(self._view, default_playlist_settings())
        for k, var in self._placeholder_entries:
            if k == key:
                settings[key] = var.get()
                break

    def _move_row(self, row, direction):
        if self._view is None:
            lst = self._rows
        else:
            lst = self._playlist_orders.setdefault(
                self._view, self._get_playlist_order(self._view))
        try:
            idx = lst.index(row)
        except ValueError:
            return
        new_idx = idx + direction
        if new_idx < 0 or new_idx >= len(lst):
            return
        lst[idx], lst[new_idx] = lst[new_idx], lst[idx]
        for r in lst:
            r.pack_forget()
        for r in lst:
            r.pack(fill="x")

    def _play_track(self, track, row):
        if row is self._playing_row and self._player.is_playing:
            self._player.stop()
            row.set_playing(False)
            self._playing_row = None
            return
        if self._playing_row:
            self._playing_row.set_playing(False)
        self._playing_row = row
        row.set_playing(True)

        def _worker():
            try:
                stream = get_stream_url(track.get("url", ""))
                self._player.play(
                    stream,
                    on_end=lambda: self.after(0, lambda: self._on_ended(row)))
            except Exception as e:
                self.after(0, lambda: self._on_play_err(row, str(e)))

        threading.Thread(target=_worker, daemon=True).start()

    def _on_ended(self, row):
        if row is self._playing_row:
            row.set_playing(False)
            self._playing_row = None

    def _on_play_err(self, row, err):
        row.set_playing(False)
        row.set_upload_status("play failed", ACCENT)
        if row is self._playing_row:
            self._playing_row = None

    def _save(self):
        if not self._meta_path:
            return
        self._save_btn.configure(state="disabled", bg=DIM, fg=MUTED, text="Saving...")
        self._status_var.set("Saving order & playlists...")
        repo_url = self._cfg.get("repo_url", _DEFAULT_REPO)
        ssh_key  = self._cfg.get("ssh_key", _SSH_KEY)

        # Make sure every playlist's order list reflects current membership
        # (picks up any names typed but never viewed as a tab). We must also
        # recheck names that USED to have members but now have none -- if a
        # playlist's last remaining track gets cleared, that name disappears
        # from _known_playlist_names() entirely, and without this it would
        # never get refreshed, leaving its stale (pre-removal) member list
        # in place forever.
        names_to_refresh = set(self._known_playlist_names()) | set(self._playlist_orders.keys())
        for name in names_to_refresh:
            self._get_playlist_order(name)

        def _worker():
            try:
                # Pull whatever's newest first -- if the main uploader window
                # pushed changes (e.g. tagging existing tracks into a
                # playlist) while this dialog was open, we want to build on
                # top of that instead of clobbering it with our own
                # possibly-stale snapshot.
                try:
                    _run_git("pull", "--rebase", "--autostash", ssh_key=ssh_key)
                except RuntimeError as e:
                    print(f"[Git] pull warning: {e}")

                try:
                    latest_tracks, latest_playlist_settings = load_metadata(self._meta_path)
                except Exception:
                    latest_tracks, latest_playlist_settings = [], {}
                latest_by_id = {e.get("id"): e for e in latest_tracks if isinstance(e, dict)}

                new_meta = []
                known_ids = set()
                changed = 0
                for row in self._rows:
                    track_id = row._track.get("id")
                    known_ids.add(track_id)
                    # Start from the freshest copy on disk when we have one,
                    # so fields updated elsewhere (lyrics, thumbnails, other
                    # playlist tags) since this dialog loaded aren't lost --
                    # we only overwrite the order/playlists below.
                    source = latest_by_id.get(track_id, row._track)
                    before_names = set(get_track_playlist_orders(source).keys())
                    entry = dict(source)
                    entry.pop("playlist", None)
                    pl_dict = {}
                    for name, order_list in self._playlist_orders.items():
                        if row in order_list:
                            pl_dict[name] = order_list.index(row)
                    if set(pl_dict.keys()) != before_names:
                        changed += 1
                    entry["playlists"] = pl_dict
                    new_meta.append(entry)

                # Keep any tracks that appeared on the remote but weren't
                # loaded into this dialog (e.g. uploaded elsewhere while it
                # was open) instead of deleting them.
                for e in latest_tracks:
                    if isinstance(e, dict) and e.get("id") not in known_ids:
                        new_meta.append(e)

                # Merge playlist settings: start from whatever's newest on
                # the remote (so showOnWorker/reserved boxes toggled
                # elsewhere aren't lost), then layer our own edits on top,
                # and make sure every playlist that still has members ends
                # up with a settings entry (defaulting to not shown).
                merged_settings = dict(latest_playlist_settings)
                merged_settings.update(self._playlist_settings)
                for name in names_to_refresh:
                    merged_settings.setdefault(name, default_playlist_settings())

                save_metadata(self._meta_path, new_meta, merged_settings)
                _run_git("add", "metadata.json", ssh_key=ssh_key)
                try:
                    _run_git("-c", "user.name=Scarlet Uploader", "-c", "user.email=scarlet@local",
                              "commit", "-m", "Update track order/playlists", ssh_key=ssh_key)
                except RuntimeError as e:
                    if "nothing to commit" not in str(e).lower():
                        raise
                try:
                    _run_git("push", "origin", "HEAD", ssh_key=ssh_key)
                except RuntimeError:
                    # Remote moved on since our pull -- resync once and retry
                    # rather than failing outright.
                    _run_git("pull", "--rebase", "--autostash", ssh_key=ssh_key)
                    _run_git("push", "origin", "HEAD", ssh_key=ssh_key)
                commit = ""
                try:
                    commit = _run_git("rev-parse", "--short", "HEAD", ssh_key=ssh_key)
                except Exception:
                    pass
                self.after(0, lambda: self._on_saved(True, "", changed, commit))
            except Exception as e:
                self.after(0, lambda: self._on_saved(False, str(e), 0, ""))

        threading.Thread(target=_worker, daemon=True).start()

    def _on_saved(self, ok, err, changed=0, commit=""):
        if ok:
            detail = f"{changed} track(s) had playlist changes" if changed else "no playlist changes detected"
            self._status_var.set(
                f"Saved and pushed to GitHub! ({detail}, commit {commit or '?'})")
            self._save_btn.configure(state="normal", bg=SUCCESS, fg=BG, text="Saved!")
            self.after(4000, lambda: self._save_btn.configure(
                bg=ACCENT, fg=TEXT, text="Save Order & Playlists"))
        else:
            self._status_var.set(f"Save failed: {err}")
            self._save_btn.configure(state="normal", bg=ACCENT, fg=TEXT,
                                      text="Save Order & Playlists")
            messagebox.showerror("Save failed",
                                  f"Could not save order/playlists:\n\n{err}")


# ── Main Application ─────────────────────────────────────────────
class UploaderApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Scarlet - GitHub Uploader")
        self.geometry("920x700")
        self.minsize(720, 560)
        self.configure(bg=BG)
        self.protocol("WM_DELETE_WINDOW", self._on_close)

        self._cfg          = load_config()
        self._player       = AudioPlayer()
        self._tracks: list = []
        self._rows:   list = []
        self._playing_row: Optional[TrackRow] = None
        self._is_loading   = False
        self._is_uploading = False
        self._thumb_images = []

        self._build_ui()

    def _build_ui(self):
        # Top bar
        top = tk.Frame(self, bg=SURFACE, pady=10, padx=16)
        top.pack(fill="x", side="top")
        tk.Label(top, text="Scarlet", font=FONT_BIG,
                 bg=SURFACE, fg=ACCENT).pack(side="left")
        tk.Label(top, text="GitHub Uploader", font=FONT_BODY,
                 bg=SURFACE, fg=MUTED).pack(side="left", padx=(10, 0))
        tk.Button(top, text="Library", font=FONT_SMALL,
                  bg=CARD, fg=MUTED, activebackground=BORDER,
                  activeforeground=ACCENT, relief="flat", bd=0,
                  padx=10, pady=4, cursor="hand2",
                  command=self._open_library).pack(side="right", padx=(0, 8))
        tk.Button(top, text="Settings", font=FONT_SMALL,
                  bg=CARD, fg=MUTED, activebackground=BORDER,
                  activeforeground=ACCENT, relief="flat", bd=0,
                  padx=10, pady=4, cursor="hand2",
                  command=self._open_settings).pack(side="right")

        # URL row
        url_frame = tk.Frame(self, bg=BG, pady=12, padx=16)
        url_frame.pack(fill="x")
        tk.Label(url_frame,
                 text="YouTube / YouTube Music URL  (single video or full playlist)",
                 font=FONT_SMALL, bg=BG, fg=MUTED).pack(anchor="w")
        row = tk.Frame(url_frame, bg=BG)
        row.pack(fill="x", pady=(6, 0))
        self._url_var = tk.StringVar()
        self._url_entry = tk.Entry(
            row, textvariable=self._url_var,
            bg=CARD, fg=TEXT, insertbackground=ACCENT,
            relief="flat", bd=0, font=FONT_BODY,
            highlightthickness=1, highlightbackground=BORDER,
            highlightcolor=ACCENT)
        self._url_entry.pack(side="left", fill="x", expand=True, ipady=8, padx=(0,10))
        self._url_entry.bind("<Return>", lambda _: self._do_load())
        self._load_btn = tk.Button(
            row, text="Load",
            font=FONT_BODY, bg=ACCENT, fg=TEXT, activebackground=ACCENT2,
            relief="flat", bd=0, padx=20, pady=8, cursor="hand2",
            command=self._do_load)
        self._load_btn.pack(side="left")

        # Upload-as-playlist row: when checked, every track loaded from
        # this URL is auto-tagged with the given playlist name, so pulling
        # in an existing playlist and pushing it straight to GitHub as a
        # playlist doesn't require typing the name into every track row.
        pl_mode_row = tk.Frame(url_frame, bg=BG)
        pl_mode_row.pack(fill="x", pady=(8, 0))
        self._playlist_mode_var = tk.BooleanVar(value=False)
        self._playlist_mode_cb = tk.Checkbutton(
            pl_mode_row, text="Upload as playlist", variable=self._playlist_mode_var,
            font=FONT_SMALL, bg=BG, fg=TEXT, activebackground=BG,
            activeforeground=TEXT, selectcolor=CARD,
            relief="flat", bd=0, cursor="hand2",
            command=self._on_playlist_mode_toggle)
        self._playlist_mode_cb.pack(side="left")
        self._playlist_mode_var_name = tk.StringVar()
        self._playlist_mode_entry = tk.Entry(
            pl_mode_row, textvariable=self._playlist_mode_var_name,
            bg=CARD, fg=DIM, insertbackground=TEXT,
            relief="flat", bd=0, font=FONT_SMALL,
            highlightthickness=1, highlightbackground=BORDER,
            highlightcolor=ACCENT, state="disabled")
        self._playlist_mode_entry.pack(side="left", fill="x", expand=True,
                                        ipady=4, padx=(8, 0))
        self._playlist_mode_var_name.trace_add(
            "write", self._on_playlist_mode_name_changed)

        # Playlist header (hidden until loaded)
        self._header_frame = tk.Frame(self, bg=SURFACE, padx=16, pady=6)
        self._playlist_lbl = tk.Label(
            self._header_frame, text="", font=FONT_TITLE, bg=SURFACE, fg=TEXT)
        self._playlist_lbl.pack(side="left")
        self._count_lbl = tk.Label(
            self._header_frame, text="", font=FONT_SMALL, bg=SURFACE, fg=MUTED)
        self._count_lbl.pack(side="left", padx=(8, 0))
        sel_row = tk.Frame(self._header_frame, bg=SURFACE)
        sel_row.pack(side="right")
        tk.Button(sel_row, text="Select All", font=FONT_SMALL,
                  bg=CARD, fg=MUTED, activebackground=BORDER,
                  relief="flat", bd=0, padx=8, pady=3, cursor="hand2",
                  command=lambda: self._select_all(True)).pack(side="left", padx=(0,4))
        tk.Button(sel_row, text="Select None", font=FONT_SMALL,
                  bg=CARD, fg=MUTED, activebackground=BORDER,
                  relief="flat", bd=0, padx=8, pady=3, cursor="hand2",
                  command=lambda: self._select_all(False)).pack(side="left")

        # Scrollable track list
        list_outer = tk.Frame(self, bg=BG)
        list_outer.pack(fill="both", expand=True)
        self._canvas = tk.Canvas(list_outer, bg=BG, highlightthickness=0)
        self._scrollbar = tk.Scrollbar(
            list_outer, orient="vertical", command=self._canvas.yview,
            bg=SURFACE, troughcolor=BG, activebackground=BORDER)
        self._canvas.configure(yscrollcommand=self._scrollbar.set)
        self._scrollbar.pack(side="right", fill="y")
        self._canvas.pack(side="left", fill="both", expand=True)
        self._list_frame = tk.Frame(self._canvas, bg=BG)
        self._list_win = self._canvas.create_window(
            (0, 0), window=self._list_frame, anchor="nw")
        self._list_frame.bind("<Configure>", self._on_list_configure)
        self._canvas.bind("<Configure>",     self._on_canvas_configure)
        self._canvas.bind("<MouseWheel>",    self._on_mousewheel)
        self._list_frame.bind("<MouseWheel>", self._on_mousewheel)
        self._empty_lbl = tk.Label(
            self._list_frame,
            text="Paste a YouTube URL above and click Load\n"
                 "Supports individual videos and full playlists",
            font=FONT_BODY, bg=BG, fg=DIM, justify="center")
        self._empty_lbl.pack(pady=80)

        # Now-playing bar
        np_bar = tk.Frame(self, bg=SURFACE, pady=8, padx=16,
                          highlightthickness=1, highlightbackground=BORDER)
        np_bar.pack(fill="x", side="bottom")
        self._np_lbl = tk.Label(
            np_bar, text="Nothing playing",
            font=FONT_SMALL, bg=SURFACE, fg=MUTED, anchor="w")
        self._np_lbl.pack(side="left", fill="x", expand=True)
        tk.Button(np_bar, text="Stop", font=FONT_SMALL,
                  bg=CARD, fg=MUTED, activebackground=BORDER,
                  relief="flat", bd=0, padx=10, pady=4, cursor="hand2",
                  command=self._stop_playback).pack(side="right")

        # Action bar
        action_bar = tk.Frame(self, bg=BG, padx=16, pady=10)
        action_bar.pack(fill="x", side="bottom")
        self._upload_btn = tk.Button(
            action_bar, text="Upload Selected to GitHub",
            font=FONT_TITLE, bg=DIM, fg=MUTED,
            activebackground=ACCENT, activeforeground=TEXT,
            relief="flat", bd=0, padx=24, pady=10,
            cursor="hand2", state="disabled",
            command=self._do_upload)
        self._upload_btn.pack(side="left", fill="x", expand=True)
        self._sel_count_lbl = tk.Label(
            action_bar, text="", font=FONT_SMALL, bg=BG, fg=MUTED)
        self._sel_count_lbl.pack(side="left", padx=(12, 0))

        # Status bar
        status_bar = tk.Frame(self, bg=BG, padx=16, pady=4)
        status_bar.pack(fill="x", side="bottom")
        self._status_var = tk.StringVar(value="Ready.")
        self._status_lbl = tk.Label(
            status_bar, textvariable=self._status_var,
            font=FONT_SMALL, bg=BG, fg=MUTED, anchor="w")
        self._status_lbl.pack(side="left", fill="x", expand=True)
        style = ttk.Style()
        style.theme_use("clam")
        style.configure("S.Horizontal.TProgressbar",
                        troughcolor=CARD, background=ACCENT,
                        bordercolor=BORDER, lightcolor=ACCENT, darkcolor=ACCENT2)
        self._progress = ttk.Progressbar(
            status_bar, style="S.Horizontal.TProgressbar",
            mode="indeterminate", length=200)
        self._progress.pack(side="right")

    def _on_list_configure(self, _=None):
        self._canvas.configure(scrollregion=self._canvas.bbox("all"))

    def _on_canvas_configure(self, event):
        self._canvas.itemconfig(self._list_win, width=event.width)

    def _on_mousewheel(self, event):
        self._canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")

    def _set_status(self, msg, color=MUTED):
        self._status_var.set(msg)
        self._status_lbl.configure(fg=color)

    def _set_busy(self, busy):
        if busy:
            self._progress.start(12)
            self._load_btn.configure(state="disabled")
            self._url_entry.configure(state="disabled")
        else:
            self._progress.stop()
            self._load_btn.configure(state="normal")
            self._url_entry.configure(state="normal")

    def _update_sel_count(self):
        checked = sum(1 for r in self._rows if r.checked)
        total   = len(self._rows)
        self._sel_count_lbl.configure(text=f"{checked} / {total} selected")
        if checked > 0 and not self._is_uploading:
            self._upload_btn.configure(state="normal", bg=ACCENT, fg=TEXT)
        else:
            self._upload_btn.configure(state="disabled", bg=DIM, fg=MUTED)

    def _select_all(self, value):
        for row in self._rows:
            row.set_checked(value)
        self._update_sel_count()

    def _on_playlist_mode_toggle(self):
        if self._playlist_mode_var.get():
            self._playlist_mode_entry.configure(state="normal", fg=TEXT)
            self._playlist_mode_entry.focus_set()
        else:
            self._playlist_mode_entry.configure(state="disabled", fg=DIM)
        self._apply_playlist_tag_to_rows()

    def _on_playlist_mode_name_changed(self, *_args):
        self._apply_playlist_tag_to_rows()

    def _apply_playlist_tag_to_rows(self):
        """Push the 'Upload as playlist' name into every currently-loaded
        row's playlist field, live -- whether the box is checked before or
        after tracks were loaded."""
        if not self._playlist_mode_var.get():
            return
        name = self._playlist_mode_var_name.get().strip()
        if not name:
            return
        for row in self._rows:
            row.set_playlist_names(name)

    def _open_settings(self):
        SettingsDialog(self, self._cfg, lambda cfg: setattr(self, "_cfg", cfg))

    def _open_library(self):
        LibraryDialog(self, self._cfg)

    def _on_close(self):
        self._player.stop()
        self.destroy()

    # Load
    def _do_load(self):
        url = self._url_var.get().strip()
        if not url:
            messagebox.showwarning("No URL", "Please paste a YouTube URL first.")
            return
        if self._is_loading:
            return
        self._is_loading = True
        self._stop_playback()
        self._clear_track_list()
        self._set_busy(True)
        self._set_status("Resolving URL...")
        self._upload_btn.configure(state="disabled", bg=DIM, fg=MUTED)

        def _worker():
            try:
                tracks, pltitle = fetch_tracks(
                    url, status_cb=lambda m: self.after(0, lambda: self._set_status(m)))
                self.after(0, lambda: self._on_load_done(tracks, pltitle))
            except Exception as e:
                self.after(0, lambda: self._on_load_error(str(e)))

        threading.Thread(target=_worker, daemon=True).start()

    def _clear_track_list(self):
        for row in self._rows:
            row.destroy()
        self._rows.clear()
        self._tracks.clear()
        self._thumb_images.clear()
        self._playing_row = None

    def _on_load_done(self, tracks, playlist_title):
        self._is_loading = False
        self._set_busy(False)
        self._tracks = tracks
        if not tracks:
            self._set_status("No tracks found.", color=WARN)
            return
        self._playlist_lbl.configure(text=playlist_title or "Tracks")
        self._count_lbl.configure(text=f"({len(tracks)} tracks)")
        self._header_frame.pack(fill="x", after=self._url_entry.master)
        self._empty_lbl.pack_forget()
        playlist_tag = []
        if self._playlist_mode_var.get():
            name = self._playlist_mode_var_name.get().strip()
            if name:
                playlist_tag = [name]
        for i, track in enumerate(tracks):
            row = TrackRow(
                self._list_frame, track, i,
                on_play=self._play_track,
                on_check_change=self._update_sel_count,
                on_move=self._move_track,
                initial_playlists=playlist_tag)
            row.pack(fill="x")
            _bind_wheel_recursive(row, self._on_mousewheel)
            self._rows.append(row)
        self._update_sel_count()
        self._set_status(
            f"Loaded {len(tracks)} track(s). Press Play on any track to preview.",
            color=SUCCESS)
        threading.Thread(target=self._load_thumbnails, daemon=True).start()

    def _on_load_error(self, err):
        self._is_loading = False
        self._set_busy(False)
        self._set_status(f"Load failed: {err}", color=ACCENT)

    def _move_track(self, row, direction):
        try:
            idx = self._rows.index(row)
        except ValueError:
            return
        new_idx = idx + direction
        if new_idx < 0 or new_idx >= len(self._rows):
            return
        self._rows[idx], self._rows[new_idx] = self._rows[new_idx], self._rows[idx]
        self._tracks[idx], self._tracks[new_idx] = self._tracks[new_idx], self._tracks[idx]
        for r in self._rows:
            r.pack_forget()
        for r in self._rows:
            r.pack(fill="x")

    def _load_thumbnails(self):
        for track, row in zip(self._tracks, self._rows):
            if not track.get("thumbnail"):
                continue
            try:
                img = _fetch_thumbnail(track["thumbnail"], size=(48, 48))
                if img:
                    self._thumb_images.append(img)
                    self.after(0, lambda r=row, im=img: r.set_thumb(im))
            except Exception:
                pass
            time.sleep(0.05)

    # Playback
    def _play_track(self, track, row):
        if row is self._playing_row and self._player.is_playing:
            self._stop_playback()
            return
        self._stop_playback(update_ui=False)
        self._playing_row = row
        row.set_playing(True)
        title = track.get("title", "Unknown")
        self._np_lbl.configure(
            text=f"Playing: {title}  -  {track.get('uploader', '')}",
            fg=ACCENT2)
        self._set_status(f"Resolving stream: {title[:55]}...")

        def _worker():
            try:
                stream = get_stream_url(track["url"])
                self.after(0, lambda: self._set_status(f"Playing: {title[:65]}"))
                self._player.play(
                    stream,
                    on_end=lambda: self.after(0, lambda: self._on_playback_ended(row)))
            except Exception as e:
                self.after(0, lambda: self._on_play_error(row, str(e)))

        threading.Thread(target=_worker, daemon=True).start()

    def _stop_playback(self, update_ui=True):
        self._player.stop()
        if update_ui and self._playing_row:
            self._playing_row.set_playing(False)
        self._playing_row = None
        if update_ui:
            self._np_lbl.configure(text="Nothing playing", fg=MUTED)

    def _on_playback_ended(self, row):
        if row is self._playing_row:
            row.set_playing(False)
            self._playing_row = None
            self._np_lbl.configure(text="Nothing playing", fg=MUTED)
            self._set_status("Playback ended.")

    def _on_play_error(self, row, err):
        row.set_playing(False)
        if row is self._playing_row:
            self._playing_row = None
        self._np_lbl.configure(text="Nothing playing", fg=MUTED)
        self._set_status(f"Play failed: {err}", color=ACCENT)

    # Upload
    def _do_upload(self):
        if self._is_uploading:
            return
        selected = [(r, r._track) for r in self._rows if r.checked]
        if not selected:
            messagebox.showwarning("Nothing selected",
                                   "Check at least one track to upload.")
            return
        repo_url = self._cfg.get("repo_url", _DEFAULT_REPO)
        ssh_key  = self._cfg.get("ssh_key",  _SSH_KEY)
        self._is_uploading = True
        self._upload_btn.configure(
            state="disabled", bg=DIM, fg=MUTED, text="Uploading...")
        self._set_status(f"Uploading {len(selected)} track(s)...")

        def _worker():
            # Pre-sync repo to get the latest metadata for duplicate checking
            try:
                ensure_repo_cloned(repo_url, ssh_key, 
                    status_cb=lambda m: self.after(0, lambda: self._set_status(m)))
                _run_git("pull", "--rebase", "--autostash", ssh_key=ssh_key)
            except Exception as e:
                print(f"[Git] pre-sync warning: {e}")
            
            meta_path = os.path.join(_CLONE_DIR, "metadata.json")
            existing_meta, _existing_playlist_settings = load_metadata(meta_path)
            existing_ids = {e.get("id") for e in existing_meta if isinstance(e, dict)}

            # Track the highest existing position per playlist so newly
            # uploaded tracks get appended to the end of each playlist they're
            # tagged with, independently of any other playlist's order.
            playlist_max = {}
            for e in existing_meta:
                if not isinstance(e, dict):
                    continue
                for name, pos in get_track_playlist_orders(e).items():
                    playlist_max[name] = max(playlist_max.get(name, -1), pos)

            errors = []
            for idx, (row, track) in enumerate(selected):
                title = track.get("title", "Unknown")
                track_id = track.get("id")

                self.after(0, lambda t=title, i=idx, tot=len(selected):
                    self._set_status(f"[{i+1}/{tot}] {t[:55]}..."))

                if track_id and track_id in existing_ids:
                    # Already downloaded/uploaded before -- don't re-download,
                    # but do tag it into any playlist(s) it isn't in yet.
                    existing_entry = next(
                        (e for e in existing_meta
                         if isinstance(e, dict) and e.get("id") == track_id), None)
                    current_names = (set(get_track_playlist_orders(existing_entry).keys())
                                      if existing_entry else set())
                    new_names = [n for n in row.playlist_names if n not in current_names]
                    if not new_names:
                        self.after(0, lambda r=row: r.set_upload_status("skipped (exists)", MUTED))
                        continue

                    pl_dict = dict(get_track_playlist_orders(existing_entry)) if existing_entry else {}
                    for name in new_names:
                        playlist_max[name] = playlist_max.get(name, -1) + 1
                        pl_dict[name] = playlist_max[name]

                    self.after(0, lambda r=row: r.set_upload_status("tagging...", WARN))
                    try:
                        commit = push_playlist_update_to_github(
                            track_id, pl_dict, repo_url, ssh_key,
                            status_cb=lambda m, r=row: self.after(
                                0, lambda: r.set_upload_status(m[:16], MUTED)))
                        if existing_entry is not None:
                            existing_entry["playlists"] = pl_dict
                        self.after(0, lambda r=row, c=commit:
                            r.set_upload_status(f"tagged {c}" if c else "not found", SUCCESS))
                    except Exception as e:
                        import traceback
                        traceback.print_exc()
                        errors.append((title, str(e)))
                        self.after(0, lambda r=row: r.set_upload_status("FAILED", ACCENT))
                    continue

                pl_dict = {}
                for name in row.playlist_names:
                    playlist_max[name] = playlist_max.get(name, -1) + 1
                    pl_dict[name] = playlist_max[name]
                track["playlists"] = pl_dict

                self.after(0, lambda r=row: r.set_upload_status("waiting...", WARN))
                tmp_dir = tempfile.mkdtemp(dir=_DL_DIR)
                try:
                    def _prog(m, r=row):
                        self.after(0, lambda: r.set_upload_status(m[:16], MUTED))
                    self.after(0, lambda r=row: r.set_upload_status("downloading", MUTED))
                    local = download_track(track["url"], tmp_dir, progress_cb=_prog)

                    if os.path.splitext(local)[1].lower() != ".mp4":
                        self.after(0, lambda r=row: r.set_upload_status("converting", MUTED))
                        local = convert_to_mp4(local)

                    self.after(0, lambda r=row: r.set_upload_status("lyrics...", MUTED))
                    track["lyrics"] = fetch_lyrics(title, track.get("uploader", ""))
                    
                    self.after(0, lambda r=row: r.set_upload_status("pushing...", WARN))
                    commit = push_track_to_github(
                        track, local, repo_url, ssh_key,
                        status_cb=lambda m, r=row: self.after(
                            0, lambda: r.set_upload_status(m[:16], MUTED)))
                    self.after(0, lambda r=row, c=commit:
                        r.set_upload_status(f"done {c}", SUCCESS))
                except Exception as e:
                    import traceback
                    traceback.print_exc()
                    errors.append((title, str(e)))
                    self.after(0, lambda r=row: r.set_upload_status("FAILED", ACCENT))
                finally:
                    shutil.rmtree(tmp_dir, ignore_errors=True)
            self.after(0, lambda: self._on_upload_all_done(errors))

        threading.Thread(target=_worker, daemon=True).start()

    def _on_upload_all_done(self, errors):
        self._is_uploading = False
        self._update_sel_count()
        if errors:
            err_str = "\n".join(f"  {t}: {e}" for t, e in errors[:5])
            self._set_status(f"Done with {len(errors)} error(s).", color=WARN)
            messagebox.showerror("Some uploads failed",
                                 f"{len(errors)} track(s) failed:\n\n{err_str}")
        else:
            self._set_status("All tracks pushed to GitHub!", color=SUCCESS)
            self._upload_btn.configure(text="All Pushed!", bg=SUCCESS, fg=BG)
            self.after(4000, lambda: self._upload_btn.configure(
                text="Upload Selected to GitHub", bg=ACCENT, fg=TEXT))


if __name__ == "__main__":
    app = UploaderApp()
    app.mainloop()