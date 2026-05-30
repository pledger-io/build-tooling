const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const treeKill = require('tree-kill');

const BACKEND_PORT = 8080;
const BACKEND_ENVIRONMENTS = 'h2,jpa';
const HEALTH_CHECK_INTERVAL_MS = 5000;
const HEALTH_CHECK_FAILURES_BEFORE_ERROR = 3;

function createDirectory(directory) {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }
}

function resolvePaths() {
    const isPackaged = app.isPackaged;
    const installDir = isPackaged ? path.dirname(process.execPath) : path.join(__dirname, '..', '..', '..');
    const serverDir = isPackaged
        ? path.join(installDir, 'server')
        : path.join(installDir, 'build', 'native', 'nativeCompile');
    const resourcesDir = isPackaged
        ? path.join(process.resourcesPath, 'resources')
        : path.join(__dirname, 'resources');
    const storageDir = path.join(app.getPath('appData'), app.getName(), 'storage');
    const backendExe = path.join(serverDir, process.platform === 'win32' ? 'pledger-io.exe' : 'pledger-io');
    const bundledKey = path.join(serverDir, 'rsa-2048bit-key-pair.pem');
    const serverLogPath = path.join(storageDir, 'logs', 'server.log');

    return { isPackaged, installDir, serverDir, resourcesDir, storageDir, backendExe, bundledKey, serverLogPath };
}

function ensureJwtKey(storageDir, bundledKey) {
    const keyFile = path.join(storageDir, 'rsa-2048bit-key-pair.pem');
    if (fs.existsSync(keyFile)) {
        return;
    }
    if (fs.existsSync(bundledKey)) {
        fs.copyFileSync(bundledKey, keyFile);
        return;
    }
    throw new Error(`Missing JWT signing key: ${keyFile}`);
}

function BackendServer(serverDir, storageDir, backendExe) {
    let serverHandle;
    let loggingStream;
    let intentionalShutdown = false;
    let onCrash = () => {};

    const prepareServer = () => {
        createDirectory(storageDir);
        createDirectory(path.join(storageDir, 'logs'));
        loggingStream = fs.createWriteStream(path.join(storageDir, 'logs', 'server.log'), { flags: 'a' });
        ensureJwtKey(storageDir, path.join(serverDir, 'rsa-2048bit-key-pair.pem'));
    };

    const attachProcessHandlers = () => {
        serverHandle.stdout.on('data', (chunk) => loggingStream?.write(chunk));
        serverHandle.stderr.on('data', (chunk) => loggingStream?.write(chunk));
        serverHandle.on('error', (error) => {
            console.error(`Backend process error: ${error}`);
            if (!intentionalShutdown) {
                onCrash({ reason: 'crash', detail: error.message });
            }
        });
        serverHandle.on('exit', (code, signal) => {
            loggingStream?.end();
            loggingStream = undefined;

            if (!intentionalShutdown) {
                onCrash({ reason: 'crash', exitCode: code, signal });
            }
            serverHandle = undefined;
        });
    };

    return {
        onCrash(callback) {
            onCrash = callback;
        },
        isRunning() {
            return Boolean(serverHandle?.pid);
        },
        start() {
            intentionalShutdown = false;

            if (!fs.existsSync(backendExe)) {
                console.error(`Backend executable not found: ${backendExe}`);
                return false;
            }

            try {
                prepareServer();
                serverHandle = spawn(
                    backendExe,
                    [
                        '--enable-native-access=ALL-UNNAMED',
                        `-Dmicronaut.environments=${BACKEND_ENVIRONMENTS}`,
                        `-Dmicronaut.application.storage.location=${storageDir}`,
                        '-Dmicronaut.server.host=0.0.0.0',
                    ],
                    {
                        cwd: serverDir,
                        env: {
                            ...process.env,
                            SINGLE_USER_ENABLED: 'true',
                        },
                        windowsHide: true,
                    },
                );

                attachProcessHandlers();
                return true;
            } catch (error) {
                console.error(`Error starting backend: ${error}`);
                return false;
            }
        },
        terminate() {
            intentionalShutdown = true;
            if (!serverHandle?.pid) {
                return Promise.resolve();
            }

            const pid = serverHandle.pid;
            return new Promise((resolve) => {
                treeKill(pid, 'SIGTERM', (error) => {
                    if (error) {
                        console.warn(`Failed to terminate backend (pid ${pid}): ${error}`);
                    }
                    resolve();
                });
            });
        },
    };
}

function FrontEnd(resourcesDir) {
    const preloadPath = path.join(__dirname, 'preload.js');
    const window = new BrowserWindow({
        title: 'Pledger.io: Personal Finance Manager',
        width: 1300,
        height: 900,
        autoHideMenuBar: true,
        center: true,
        icon: path.join(resourcesDir, 'icon.png'),
        show: false,
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    window.once('ready-to-show', () => window.show());

    return {
        window,
        displayApplication: () => window.loadURL(`http://localhost:${BACKEND_PORT}/ui/dashboard`),
        loadingScreen: () => window.loadFile(path.join(resourcesDir, 'index.html')),
        errorScreen: ({ reason, exitCode, signal } = {}) => {
            const query = { reason: reason || 'unknown' };
            if (exitCode !== undefined && exitCode !== null) {
                query.exitCode = String(exitCode);
            }
            if (signal) {
                query.signal = signal;
            }
            return window.loadFile(path.join(resourcesDir, 'failed.html'), { query });
        },
        onClose: (callback) => window.on('close', callback),
    };
}

async function isBackendHealthy() {
    const requestPromise = require('minimal-request-promise');
    const response = await requestPromise({
        method: 'GET',
        hostname: 'localhost',
        port: BACKEND_PORT,
        path: '/ui/login',
        protocol: 'http:',
        timeout: 3000,
    });
    return response.statusCode === 200;
}

async function waitOnBackend() {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    for (let attempt = 1; attempt <= 60; attempt++) {
        try {
            if (await isBackendHealthy()) {
                return true;
            }
        } catch {
            console.debug(`Backend not ready (attempt ${attempt}/60)`);
        }
        await delay(1000);
    }

    return false;
}

function BackendHealthMonitor(serverControl, onUnhealthy) {
    let intervalId;
    let consecutiveFailures = 0;
    let stopped = false;

    const tick = async () => {
        if (stopped) {
            return;
        }

        if (!serverControl.isRunning()) {
            stopped = true;
            clearInterval(intervalId);
            onUnhealthy({ reason: 'crash' });
            return;
        }

        try {
            if (await isBackendHealthy()) {
                consecutiveFailures = 0;
                return;
            }
            consecutiveFailures += 1;
        } catch {
            consecutiveFailures += 1;
        }

        if (consecutiveFailures >= HEALTH_CHECK_FAILURES_BEFORE_ERROR) {
            stopped = true;
            clearInterval(intervalId);
            onUnhealthy({ reason: 'health' });
        }
    };

    return {
        start() {
            stopped = false;
            consecutiveFailures = 0;
            intervalId = setInterval(() => {
                tick().catch((error) => console.error(`Health check failed: ${error}`));
            }, HEALTH_CHECK_INTERVAL_MS);
        },
        stop() {
            stopped = true;
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = undefined;
            }
        },
    };
}

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
    app.quit();
} else {
    let mainWindow = null;
    let serverControl = null;
    let healthMonitor = null;
    let paths = null;
    let frontEndControl = null;
    let shuttingDown = false;
    let showingError = false;

    const showBackendError = async ({ reason, exitCode, signal } = {}) => {
        if (showingError || shuttingDown || !frontEndControl) {
            return;
        }

        showingError = true;
        healthMonitor?.stop();
        console.error(`Backend unavailable (${reason})`);

        await frontEndControl.errorScreen({ reason, exitCode, signal });
    };

    const startApplication = async () => {
        showingError = false;
        frontEndControl.loadingScreen();

        serverControl = BackendServer(paths.serverDir, paths.storageDir, paths.backendExe);
        serverControl.onCrash(({ reason, exitCode, signal }) => {
            showBackendError({ reason, exitCode, signal });
        });

        if (!serverControl.start()) {
            await showBackendError({ reason: 'missing' });
            return;
        }

        if (!(await waitOnBackend())) {
            await showBackendError({ reason: 'startup' });
            return;
        }

        healthMonitor?.stop();
        healthMonitor = BackendHealthMonitor(serverControl, (details) => {
            showBackendError(details);
        });
        healthMonitor.start();

        await frontEndControl.displayApplication();
    };

    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }
            mainWindow.focus();
        }
    });

    ipcMain.on('desktop:quit', () => {
        shuttingDown = true;
        app.quit();
    });

    ipcMain.on('desktop:restart', async () => {
        healthMonitor?.stop();
        await serverControl?.terminate();
        await startApplication();
    });

    ipcMain.handle('desktop:get-log-path', () => paths?.serverLogPath ?? null);

    app.whenReady().then(async () => {
        paths = resolvePaths();

        console.debug('Pledger.io desktop starting');
        console.debug(`  packaged:  ${paths.isPackaged}`);
        console.debug(`  server:    ${paths.serverDir}`);
        console.debug(`  storage:   ${paths.storageDir}`);
        console.debug(`  backend:   ${paths.backendExe}`);

        frontEndControl = FrontEnd(paths.resourcesDir);
        mainWindow = frontEndControl.window;
        frontEndControl.onClose(() => {
            shuttingDown = true;
            healthMonitor?.stop();
            serverControl?.terminate();
        });

        await startApplication();
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    app.on('before-quit', () => {
        shuttingDown = true;
        healthMonitor?.stop();
        serverControl?.terminate();
    });
}
