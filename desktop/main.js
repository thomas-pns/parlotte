'use strict';
// Parlotte — application de bureau.
// Deux modes : « Héberger » (le serveur tourne dans l'app) ou « Rejoindre » (se connecter au serveur d'un ami).
const { app, BrowserWindow, ipcMain, session, desktopCapturer, Tray, Menu, nativeImage, shell, dialog, Notification, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }
app.setAppUserModelId('fr.parlotte.app'); // notifications Windows au nom de Parlotte

const UI = path.join(__dirname, 'ui');
const SERVER_DIR = app.isPackaged ? path.join(process.resourcesPath, 'server')
  : fs.existsSync(path.join(__dirname, 'server')) ? path.join(__dirname, 'server') : path.join(__dirname, '..', 'server');
const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');
const DATA_DIR = path.join(app.getPath('userData'), 'serveur');

// ---------------------------------------------------------------- Configuration
const defaults = { mode: null, joinUrl: '', recent: [], trusted: {}, minimizeToTray: true, trayHintShown: false };
let config = { ...defaults };
try { config = { ...defaults, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) }; } catch {}
const saveConfig = () => { try { fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true }); fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2)); } catch {} };

let win = null, tray = null, serverProc = null, serverInfo = null, currentOrigin = null, quitting = false;

// ---------------------------------------------------------------- Serveur intégré
function startServer() {
  return new Promise((resolve, reject) => {
    if (serverProc && serverInfo) return resolve(serverInfo);
    const script = path.join(SERVER_DIR, 'server.js');
    if (!fs.existsSync(script)) return reject(new Error('Fichiers du serveur introuvables : ' + script));
    serverProc = fork(script, [], {
      cwd: SERVER_DIR,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', PARLOTTE_DATA: DATA_DIR, PORT: '3000', HTTPS_PORT: '3443' },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    let log = '';
    serverProc.stdout.on('data', d => { log += d; });
    serverProc.stderr.on('data', d => { log += d; });
    const timer = setTimeout(() => reject(new Error('Le serveur ne répond pas.\n' + log.slice(-800))), 20000);
    serverProc.on('message', m => {
      if (m?.type === 'ready') { clearTimeout(timer); serverInfo = m; updateTray(); resolve(m); }
      if (m?.type === 'error') { clearTimeout(timer); reject(new Error(m.message)); }
    });
    serverProc.on('exit', code => {
      clearTimeout(timer);
      const wasReady = !!serverInfo; serverProc = null; serverInfo = null; updateTray();
      if (!wasReady) reject(new Error(`Le serveur s'est arrêté (code ${code}).\n${log.slice(-800)}`));
      else if (!quitting) { dialog.showErrorBox('Parlotte', 'Le serveur intégré s\'est arrêté de façon inattendue.\n\n' + log.slice(-800)); showLauncher(); }
    });
  });
}
function stopServer() {
  return new Promise(res => {
    if (!serverProc) return res();
    const p = serverProc; const t = setTimeout(() => { try { p.kill(); } catch {} res(); }, 3000);
    p.once('exit', () => { clearTimeout(t); res(); });
    try { p.send('shutdown'); } catch { p.kill(); }
  });
}

// ---------------------------------------------------------------- Adresses et certificat
// « 192.168.1.20 » → https://192.168.1.20:3443 ; « http://x:3000 » (autre PC) → https://x:3443 (le micro exige HTTPS).
function normalizeUrl(input) {
  let s = String(input || '').trim();
  if (!s) throw new Error('Entre l\'adresse du serveur');
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  const u = new URL(s);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  if (!local && (u.protocol === 'http:' || !u.port)) { u.protocol = 'https:'; if (!u.port || u.port === '3000') u.port = '3443'; }
  return u.origin;
}
// Confiance au premier usage : on mémorise l'empreinte du certificat de chaque serveur.
// Si elle change ensuite, on prévient (quelqu'un pourrait se faire passer pour le serveur).
async function trustCertificate(origin, cert) {
  const fp = cert.fingerprint, known = config.trusted[origin];
  if (known === fp) return true;
  const { response } = await dialog.showMessageBox(win, {
    type: known ? 'warning' : 'question',
    buttons: known ? ['Annuler', 'Faire confiance quand même'] : ['Annuler', 'Faire confiance'],
    defaultId: known ? 0 : 1, cancelId: 0, noLink: true,
    title: 'Parlotte — certificat du serveur',
    message: known ? '⚠️ Le certificat de ce serveur a changé !' : 'Première connexion à ce serveur',
    detail: (known
      ? 'C\'est normal si l\'hébergeur a changé de réseau ou réinstallé Parlotte. Sinon, quelqu\'un essaie peut-être de se faire passer pour lui.\n\n'
      : 'Ce serveur utilise un certificat fait maison (normal pour Parlotte). Vérifie avec l\'hébergeur que l\'empreinte correspond (visible dans son menu « Adresses pour tes amis »).\n\n')
      + `Serveur : ${origin}\nEmpreinte : ${fp}`,
  });
  if (response !== 1) return false;
  config.trusted[origin] = fp; saveConfig(); return true;
}
// Vérification au niveau réseau : couvre la page, le WebSocket et le service worker.
const pendingCert = new Map();
function setupCertificates() {
  session.defaultSession.setCertificateVerifyProc((req, callback) => {
    if (req.verificationResult === 'net::OK') return callback(0);           // certificat reconnu normalement
    let origin = null;
    try { if (currentOrigin && new URL(currentOrigin).hostname === req.hostname) origin = currentOrigin; } catch {}
    if (!origin) return callback(-2);                                          // un autre site : on refuse
    const fp = req.certificate.fingerprint;
    if (config.trusted[origin] === fp) return callback(0);
    const key = origin + '|' + fp;
    if (!pendingCert.has(key)) pendingCert.set(key, trustCertificate(origin, req.certificate).finally(() => setTimeout(() => pendingCert.delete(key), 2000)));
    pendingCert.get(key).then(ok => callback(ok ? 0 : -2));
  });
}

// ---------------------------------------------------------------- Fenêtre
function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 380, minHeight: 500, show: false, backgroundColor: '#313338',
    title: 'Parlotte', icon: path.join(__dirname, 'build', 'icon.png'), autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, spellcheck: true },
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => win.show());
  win.on('close', e => {
    if (quitting || !config.minimizeToTray) return;
    e.preventDefault(); win.hide();
    if (!config.trayHintShown && Notification.isSupported()) {
      new Notification({ title: 'Parlotte tourne en arrière-plan', body: 'Retrouve-la dans les icônes près de l\'horloge. Clic droit → Quitter pour la fermer.' }).show();
      config.trayHintShown = true; saveConfig();
    }
  });
  win.on('focus', () => win.flashFrame(false));
  // Liens externes dans le navigateur, pas dans l'app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url) && !(currentOrigin && url.startsWith(currentOrigin + '/uploads/'))) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    const o = new URL(url).origin;
    if (url.startsWith('file:') || o === currentOrigin) return;
    e.preventDefault(); shell.openExternal(url);
  });
  // Raccourcis : F5 recharger, Ctrl+Maj+I outils de développement, Ctrl+molette zoom (natif)
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F5') win.webContents.reload();
    if (input.control && input.shift && input.key.toLowerCase() === 'i') win.webContents.toggleDevTools();
  });
  win.webContents.on('render-process-gone', () => { if (!quitting) win.webContents.reload(); });
  win.webContents.on('did-fail-load', (e, code, desc, url, isMain) => {
    if (!isMain || code === -3) return; // -3 = navigation annulée
    showLauncher(`Impossible d'ouvrir ${url}\n(${desc}). Le serveur est-il lancé et sur le même réseau ?`);
  });
}

function showLauncher(error) {
  currentOrigin = null; updateTray();
  win.loadFile(path.join(UI, 'launcher.html'), { query: error ? { error } : {} });
  win.show(); win.focus();
}
async function openHost() {
  try {
    const info = await startServer();
    config.mode = 'host'; saveConfig();
    currentOrigin = `http://localhost:${info.port}`; updateTray();
    await win.loadURL(currentOrigin + '/');
  } catch (e) { showLauncher(e.message); }
}
async function openJoin(input) {
  let origin;
  try { origin = normalizeUrl(input); } catch (e) { return showLauncher(e.message); }
  config.mode = 'join'; config.joinUrl = origin;
  config.recent = [origin, ...config.recent.filter(x => x !== origin)].slice(0, 5); saveConfig();
  currentOrigin = origin; updateTray();
  win.loadURL(origin + '/').catch(() => {});
}

// ---------------------------------------------------------------- Permissions (micro, caméra, écran, notifications)
function setupPermissions() {
  const ok = new Set(['media', 'notifications', 'clipboard-sanitized-write', 'fullscreen', 'display-capture', 'speaker-selection']);
  const fromUs = url => { try { return !!currentOrigin && new URL(url).origin === currentOrigin; } catch { return false; } };
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb, details) => cb(ok.has(perm) && fromUs(details.requestingUrl || wc.getURL())));
  session.defaultSession.setPermissionCheckHandler((wc, perm, origin) => ok.has(perm) && fromUs(origin));
  // Partage d'écran : petite fenêtre pour choisir l'écran ou la fenêtre
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 320, height: 180 }, fetchWindowIcons: false });
      const chosen = await pickSource(sources.filter(s => s.name !== 'Parlotte' || s.id.startsWith('screen')));
      if (chosen) callback({ video: chosen }); else callback({});
    } catch { callback({}); }
  }, { useSystemPicker: false });
}
function pickSource(sources) {
  return new Promise(resolve => {
    const picker = new BrowserWindow({
      parent: win, modal: true, width: 760, height: 560, resizable: false, minimizable: false, maximizable: false,
      title: 'Partager mon écran', backgroundColor: '#313338', autoHideMenuBar: true, show: false,
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true },
    });
    let done = false;
    const finish = id => { if (done) return; done = true; resolve(sources.find(s => s.id === id) || null); if (!picker.isDestroyed()) picker.close(); };
    ipcMain.once('picker:choose', (e, id) => finish(id));
    picker.on('closed', () => finish(null));
    picker.loadFile(path.join(UI, 'picker.html'));
    picker.webContents.once('did-finish-load', () => {
      picker.webContents.send('picker:sources', sources.map(s => ({ id: s.id, name: s.name, thumb: s.thumbnail.toDataURL(), screen: s.id.startsWith('screen') })));
      picker.show();
    });
  });
}

// ---------------------------------------------------------------- Icône près de l'horloge
function addressesText() {
  if (!serverInfo) return '';
  return serverInfo.ips.map(ip => `https://${ip}:${serverInfo.httpsPort}`).join('\n');
}
function showAddresses() {
  if (!serverInfo) return;
  const list = addressesText();
  dialog.showMessageBox(win, {
    type: 'info', title: 'Adresses pour tes amis', buttons: ['Copier l\'adresse', 'Fermer'], noLink: true,
    message: 'Donne cette adresse à tes amis (même wifi) :',
    detail: `${list || '(aucun réseau détecté)'}\n\nSur ton PC : http://localhost:${serverInfo.port}\n\nEmpreinte du certificat (pour vérifier) :\n${serverInfo.fingerprint}\n\nDans l'app Parlotte, ils choisissent « Rejoindre » et collent l'adresse. Dans un navigateur, ils acceptent l'avertissement de sécurité la première fois.`,
  }).then(r => { if (r.response === 0 && list) clipboard.writeText(list.split('\n')[0]); });
}
function updateTray() {
  if (!tray) return;
  const login = app.getLoginItemSettings().openAtLogin;
  tray.setToolTip(serverInfo ? `Parlotte — serveur actif (${serverInfo.ips[0] || 'localhost'})` : 'Parlotte');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Ouvrir Parlotte', click: () => { win.show(); win.focus(); } },
    { type: 'separator' },
    ...(serverInfo ? [{ label: '📡 Adresses pour tes amis…', click: showAddresses }] : []),
    { label: 'Changer de serveur…', click: () => { win.show(); showLauncher(); } },
    { type: 'separator' },
    { label: 'Lancer au démarrage de Windows', type: 'checkbox', checked: login, click: m => { app.setLoginItemSettings({ openAtLogin: m.checked, args: ['--hidden'] }); } },
    { label: 'Réduire dans la barre (au lieu de quitter)', type: 'checkbox', checked: config.minimizeToTray, click: m => { config.minimizeToTray = m.checked; saveConfig(); } },
    { type: 'separator' },
    { label: serverInfo ? 'Quitter (arrête le serveur)' : 'Quitter', click: () => { quitting = true; app.quit(); } },
  ]));
}
function createTray() {
  const img = nativeImage.createFromPath(path.join(UI, 'tray.png'));
  tray = new Tray(img);
  tray.on('click', () => { if (win.isVisible() && win.isFocused()) win.hide(); else { win.show(); win.focus(); } });
  updateTray();
}

// ---------------------------------------------------------------- Messages venant des pages
ipcMain.handle('launcher:state', () => ({ mode: config.mode, joinUrl: config.joinUrl, recent: config.recent, version: app.getVersion(),
  hasData: fs.existsSync(path.join(DATA_DIR, 'data.json')) }));
// Importer les données de l'ancienne version (dossier contenant data.json, ex. C:\Users\…\Krunker\parlotte)
ipcMain.handle('launcher:import', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Choisis le dossier de ton ancien Parlotte (celui qui contient data.json)', properties: ['openDirectory'] });
  if (r.canceled || !r.filePaths[0]) return { ok: false };
  const src = r.filePaths[0], file = path.join(src, 'data.json');
  if (!fs.existsSync(file)) return { ok: false, error: 'Pas de fichier data.json dans ce dossier.' };
  let db; try { db = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return { ok: false, error: 'data.json est illisible.' }; }
  if (fs.existsSync(path.join(DATA_DIR, 'data.json'))) {
    const { response } = await dialog.showMessageBox(win, { type: 'warning', buttons: ['Annuler', 'Remplacer'], defaultId: 0, cancelId: 0, noLink: true,
      message: 'L\'app contient déjà des données', detail: 'Les remplacer par celles du dossier choisi ? (une copie de sauvegarde est gardée)' });
    if (response !== 1) return { ok: false };
    fs.copyFileSync(path.join(DATA_DIR, 'data.json'), path.join(DATA_DIR, `data-sauvegarde-${Date.now()}.json`));
  }
  await stopServer(); serverProc = null; serverInfo = null;
  fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });
  fs.copyFileSync(file, path.join(DATA_DIR, 'data.json'));
  let files = 0;
  const up = path.join(src, 'uploads');
  if (fs.existsSync(up)) for (const f of fs.readdirSync(up)) { fs.copyFileSync(path.join(up, f), path.join(DATA_DIR, 'uploads', f)); files++; }
  return { ok: true, users: Object.keys(db.users || {}).length, servers: Object.keys(db.servers || {}).length, messages: (db.messages || []).length, files };
});
ipcMain.on('launcher:host', () => openHost());
ipcMain.on('launcher:join', (e, url) => openJoin(url));
ipcMain.on('app:launcher', () => showLauncher());
ipcMain.on('app:addresses', () => showAddresses());
ipcMain.handle('app:info', () => ({ hosting: !!serverInfo, addresses: addressesText().split('\n').filter(Boolean), version: app.getVersion() }));
let badgeImg = null;
ipcMain.on('app:badge', (e, n) => {
  n = Number(n) || 0;
  if (process.platform === 'win32') {
    badgeImg = badgeImg || nativeImage.createFromPath(path.join(UI, 'badge.png'));
    win.setOverlayIcon(n ? badgeImg : null, n ? `${n} non lu(s)` : '');
  } else app.setBadgeCount(n);
});
ipcMain.on('app:attention', () => { if (!win.isFocused()) win.flashFrame(true); });

// ---------------------------------------------------------------- Démarrage
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
app.whenReady().then(() => {
  setupPermissions();
  setupCertificates();
  createWindow();
  createTray();
  const hidden = process.argv.includes('--hidden');
  if (config.mode === 'host') openHost();
  else if (config.mode === 'join' && config.joinUrl) openJoin(config.joinUrl);
  else showLauncher();
  if (hidden) win.once('ready-to-show', () => win.hide());
});
app.on('before-quit', e => {
  quitting = true;
  if (serverProc) { e.preventDefault(); stopServer().then(() => { serverProc = null; app.quit(); }); }
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
