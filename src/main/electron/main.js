const {app, BrowserWindow} = require('electron');
const fs = require('fs');

let window;
let serverProcess;

const appBasePath = process.cwd();
const backendUrl = 'http://localhost:8080';
const serverStorage = `${app.getPath('appData')}/${app.getName()}/FinTrack/storage/`;
const serverLog = app.getPath('logs') + '/server.log';
const serverLibPath = `${appBasePath}/fintrack/lib`;

console.log('Setting up application with known paths: ')
console.log(`  root: ${appBasePath}`);
console.log(`  serverStorage: ${serverStorage}`);
console.log(`  serverLog: ${serverLog}`);
console.log(`  serverLibrary: ${serverLibPath}`);

function startServer(callback) {
    const killServer = function() {
        if (serverProcess) {
            const kill = require('tree-kill');
            kill(serverProcess.pid, 'SIGTERM', function () {
                console.log('Server process killed');
                serverProcess = null;
            });
        }
    }

    const serverOutput = fs.createWriteStream(serverLog);
    const dataLogger = function(data) {
        console.debug(`Server output: ${data}`);
        serverOutput.write(`${data}`);
    }

    console.log('Attempting to read in the classpath from ' + serverLibPath)
    fs.readdir(serverLibPath, (err, files) => {
        try {
            let javaClasspath = '';
            files.forEach(function(file) {
                if (javaClasspath !== '') {
                    javaClasspath = `${javaClasspath};`;
                }

                javaClasspath = `${javaClasspath}${serverLibPath}/${file}`;
            })

            serverOutput.write(`Starting server with classpath "${javaClasspath}"`);
            serverProcess = require('child_process')
                .spawn('java',
                    [
                        '-cp', `"${javaClasspath}"`,
                        '-Dmicronaut.environments=h2',
                        `-Dmicronaut.application.storage.location=${serverStorage}`,
                        '--enable-preview',
                        'com.jongsoft.finance.Application'
                    ],
                    {
                        cwd: appBasePath + '/fintrack'
                    });

            serverProcess.stdout.on('data', dataLogger);
            serverProcess.stderr.on('data', dataLogger);
        } catch (e) {
            console.log(e);
            serverProcess = null;
        }

        callback(serverProcess != null, killServer);
    });
}

const waitForServer = function (executionCount, killHandler, startHandler) {
    const requestPromise = require('minimal-request-promise');

    requestPromise.get(backendUrl).then(function (response) {
        console.log('Server started!');
        startHandler();
    }, function (response) {
        console.log(executionCount + ' - Waiting for the server start...');
        if (executionCount > 3) {
            console.log('Unable to start the server correctly')
            killHandler();
            app.quit();
            return;
        } else {
            setTimeout(function () {
                waitForServer(executionCount + 1, killHandler, startHandler);
            }, 200);
        }
    });
};

function initializeApplication() {
    const mainWindow = new BrowserWindow({
        title: 'FinTrack: Personal Finance Manager',
        width: 800,
        height: 600,
        autoHideMenuBar: true
    });
    mainWindow.loadFile(`${appBasePath}/resources/index.html`);

    startServer(function (success, killHandler) {
        if (!success) {
            console.log('Was unable to start the backend server');
            mainWindow.loadFile(`${appBasePath}/resources/failed.html`);
            setTimeout(app.quit, 1000);
        } else {
            waitForServer(
                0,
                killHandler,
                function () {
                    mainWindow.loadURL(backendUrl);
                    mainWindow.on('close', function(e){
                        e.preventDefault();
                        mainWindow.close();
                        killHandler();
                    });
                });
        }
    });
}

app.on('ready', initializeApplication)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
});

app.on('activate', () => {
    if (window === null) {
        initializeApplication();
    }
});
