const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const BOOKMARKS_FILE = 'bookmarks.json';
const CACHE_DIR = 'book_cache';

function getBookmarksPath() {
    return path.join(app.getPath('userData'), BOOKMARKS_FILE);
}

function getCacheDir() {
    return path.join(app.getPath('userData'), CACHE_DIR);
}

function ensureUserDataDirs() {
    fs.mkdirSync(getCacheDir(), { recursive: true });
}

function migrateLegacyCache() {
    const legacyDir = path.join(app.getAppPath(), CACHE_DIR);
    const newDir = getCacheDir();

    if (!fs.existsSync(legacyDir) || legacyDir === newDir) {
        return;
    }

    try {
        for (const file of fs.readdirSync(legacyDir)) {
            const src = path.join(legacyDir, file);
            const dest = path.join(newDir, file);
            if (!fs.existsSync(dest) && fs.statSync(src).isFile()) {
                fs.copyFileSync(src, dest);
                console.log('Migrated cache file:', file);
            }
        }
    } catch (err) {
        console.error('Legacy cache migration failed:', err);
    }
}

function registerStorageHandlers() {
    ipcMain.handle('storage:get-paths', () => ({
        userData: app.getPath('userData'),
        cacheDir: getCacheDir(),
        bookmarksPath: getBookmarksPath(),
    }));

    ipcMain.handle('bookmarks:load', () => {
        const filePath = getBookmarksPath();
        if (!fs.existsSync(filePath)) {
            return null;
        }

        try {
            const raw = fs.readFileSync(filePath, 'utf8');
            return raw ? JSON.parse(raw) : {};
        } catch (err) {
            console.error('Failed to load bookmarks:', err);
            return {};
        }
    });

    ipcMain.handle('bookmarks:save', (_event, bookmarks) => {
        const filePath = getBookmarksPath();
        fs.writeFileSync(filePath, JSON.stringify(bookmarks, null, 2), 'utf8');
    });
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1000,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false,
        },
        backgroundColor: '#121212',
    });

    win.loadFile('index.html');
}

app.whenReady().then(() => {
    ensureUserDataDirs();
    migrateLegacyCache();
    registerStorageHandlers();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
