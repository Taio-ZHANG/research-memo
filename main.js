const { app, BrowserWindow, ipcMain, globalShortcut, Menu, Tray } = require('electron');
const path = require('path');
const fs = require('fs');

const LEGACY_DATA_FILE = path.join(__dirname, 'data.json');

function getDataFile() {
  return path.join(app.getPath('userData'), 'data.json');
}

function migrateDataIfNeeded() {
  const dest = getDataFile();
  if (fs.existsSync(dest) || !fs.existsSync(LEGACY_DATA_FILE)) return;
  try {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(LEGACY_DATA_FILE, dest);
  } catch (e) {
    console.error('migrate data failed', e);
  }
}
const STATE_FILE = path.join(__dirname, 'window-state.json');
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
const ICON_PATH = path.join(__dirname, 'assets', 'app-icon.png');
const TRAY_ICON_PATH = path.join(__dirname, 'assets', 'tray-icon.ico');

const DEFAULT_W = 384;
const DEFAULT_H = 580;
const COLLAPSED_H = 56;

let win = null;
let tray = null;
let collapsed = false;
let expandedHeight = DEFAULT_H;
let quitting = false;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      if (win.isVisible()) {
        win.focus();
      } else {
        win.show();
        win.focus();
      }
    }
  });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, obj) {
  try {
    fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {
    console.error('write failed', file, e);
  }
}

function loadWindowState() {
  const s = readJson(STATE_FILE, {});
  const bounds = { width: DEFAULT_W, height: DEFAULT_H };
  if (typeof s.width === 'number') bounds.width = s.width;
  if (typeof s.height === 'number') bounds.height = s.height;
  if (typeof s.x === 'number') bounds.x = s.x;
  if (typeof s.y === 'number') bounds.y = s.y;
  return bounds;
}

let stateTimer = null;
function saveWindowState() {
  if (!win || win.isDestroyed() || collapsed) return;
  clearTimeout(stateTimer);
  stateTimer = setTimeout(() => {
    if (!win || win.isDestroyed() || collapsed) return;
    const b = win.getBounds();
    writeJson(STATE_FILE, { x: b.x, y: b.y, width: b.width, height: b.height });
  }, 400);
}

function createTray() {
  // Pass the multi-resolution ICO directly so Windows can select its DPI size.
  tray = new Tray(TRAY_ICON_PATH);
  tray.setToolTip('课题备忘');
  tray.setIgnoreDoubleClickEvents(true);
  tray.on('click', toggleWindow);
  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray || tray.isDestroyed()) return;
  const visible = win && !win.isDestroyed() && win.isVisible();
  const menu = Menu.buildFromTemplate([
    { label: visible ? '隐藏' : '显示', click: toggleWindow },
    { type: 'separator' },
    { label: '开机自启', type: 'checkbox', checked: isAutostartOn(), click: (mi) => setAutostart(mi.checked) },
    { type: 'separator' },
    { label: '退出', click: () => { quitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
}

function toggleWindow() {
  if (!win || win.isDestroyed()) return;
  if (win.isVisible()) {
    win.hide();
  } else {
    win.show();
    win.focus();
  }
  updateTrayMenu();
}

function isAutostartOn() {
  try {
    return app.getLoginItemSettings().openAtLogin;
  } catch {
    return false;
  }
}

function setAutostart(on) {
  app.setLoginItemSettings({
    openAtLogin: !!on,
    path: process.execPath,
    args: [__dirname],
  });
  updateTrayMenu();
}

function createWindow() {
  const bounds = loadWindowState();
  expandedHeight = bounds.height;

  win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 320,
    minHeight: COLLAPSED_H,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: false,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    icon: ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.on('moved', saveWindowState);
  win.on('resized', () => {
    if (!collapsed) saveWindowState();
  });
  win.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      win.hide();
      updateTrayMenu();
    }
  });
  win.on('show', updateTrayMenu);
  win.on('hide', updateTrayMenu);
  win.on('closed', () => {
    win = null;
  });
}

function setCollapsed(next) {
  if (!win || win.isDestroyed()) return collapsed;
  const b = win.getBounds();
  if (next === collapsed) return collapsed;
  if (next) {
    expandedHeight = Math.max(b.height, 260);
    win.setBounds({ x: b.x, y: b.y, width: b.width, height: COLLAPSED_H }, false);
    collapsed = true;
  } else {
    win.setBounds({ x: b.x, y: b.y, width: b.width, height: expandedHeight }, false);
    collapsed = false;
    saveWindowState();
  }
  return collapsed;
}

function toggleShow() {
  if (!win || win.isDestroyed()) {
    createWindow();
    return;
  }
  if (win.isVisible() && win.isFocused()) {
    win.hide();
  } else {
    win.show();
    win.focus();
  }
  updateTrayMenu();
}

app.whenReady().then(() => {
  migrateDataIfNeeded();
  Menu.setApplicationMenu(null);

  // 首次升级到带自启功能的版本时默认开启一次，之后由托盘开关管理
  const settings = readJson(SETTINGS_FILE, {});
  if (!settings.autostartInit) {
    setAutostart(true);
    writeJson(SETTINGS_FILE, { autostartInit: true });
  }

  createTray();
  createWindow();

  globalShortcut.register('Control+Alt+M', toggleShow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else if (win) { win.show(); win.focus(); }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('before-quit', () => {
  quitting = true;
});

ipcMain.handle('data:load', () => {
  return readJson(getDataFile(), { members: [], tasks: [] });
});

ipcMain.handle('data:save', (_e, data) => {
  writeJson(getDataFile(), data);
  return true;
});

ipcMain.handle('win:toggle-collapse', () => {
  return { collapsed: setCollapsed(!collapsed) };
});

ipcMain.handle('win:get-state', () => {
  return {
    collapsed,
    alwaysOnTop: win ? win.isAlwaysOnTop() : false,
  };
});

ipcMain.handle('win:set-top', (_e, value) => {
  if (!win || win.isDestroyed()) return false;
  win.setAlwaysOnTop(!!value, 'floating');
  return win.isAlwaysOnTop();
});

ipcMain.on('win:close', () => {
  quitting = true;
  app.quit();
});

ipcMain.on('win:hide', () => {
  if (win && !win.isDestroyed()) {
    win.hide();
    updateTrayMenu();
  }
});

ipcMain.on('win:minimize', () => {
  if (win && !win.isDestroyed()) win.minimize();
});
