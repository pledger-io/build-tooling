const {app, BrowserWindow} = require('electron');
const fs = require('fs');

const killHandler = function() {
    if (serverProcess) {
        console.debug('Attempting to terminate the Java process.')
        if (!serverProcess.kill('SIGINT')) {
            console.warn('Could not terminate Java process, attempting forceful shutdown.');
            console.log('Force kill response: '+ serverProcess.kill('SIGQUIT'));
            app.quit();
        } else {
            console.debug('Closing application, server terminated.')
            app.quit();
        }
    } else {
        app.quit();
    }
};

const appBasePath = process.cwd();
const backendUrl = 'http://localhost:8080';
const serverStorage = `${app.getPath('appData')}/${app.getName()}/FinTrack/storage/`;
const serverLog = app.getPath('logs') + '/server.log';
const serverPath = `${appBasePath}/fintrack`;

console.log('Setting up application with known paths: ')
console.log(`  root: ${appBasePath}`);
console.log(`  server-storage: ${serverStorage}`);
console.log(`  server-log: ${serverLog}`);
console.log(`  server-path: ${serverPath}`);

let window;
let mainWindow;
let serverProcess;

function startServer(callback) {
    const serverOutput = fs.createWriteStream(serverLog);
    const libSeparator = process.platform === 'win32' ? ';' : ':';
    const dataLogger = (data) => serverOutput.write(`${data}`);

    try {
        if (!fs.existsSync(serverStorage)) {
            console.debug('Server storage path was not found, creating new one.');
            fs.mkdirSync(serverStorage);
        }

        fs.copyFileSync(`${serverPath}/rsa-2048bit-key-pair.pem`, `${serverStorage}/rsa-2048bit-key-pair.pem`);
        fs.readdir(`${serverPath}/core/`, (err, files) => {
            let domainJar = files.filter(file => file.indexOf('domain-') > -1)[0];
            let versionMatch = /domain-([\w.\-]+)\.jar/.exec(domainJar)[1];

            const coreJars = [
                `${serverPath}/core/fintrack-api-${versionMatch}.jar`,
                `${serverPath}/core/fintrack-ui-${versionMatch}.jar`,
                `${serverPath}/core/jpa-repository-${versionMatch}.jar`,
                `${serverPath}/core/bpmn-process-${versionMatch}.jar`,
                `${serverPath}/core/rule-engine-${versionMatch}.jar`,
                `${serverPath}/core/domain-${versionMatch}.jar`,
                `${serverPath}/core/core-${versionMatch}.jar`,
            ].join(libSeparator);

            console.debug('Starting backend Java server.')
            serverProcess = require('child_process')
                .spawn('java',
                    [
                        '--enable-preview',
                        '-cp', `${coreJars}${libSeparator}${serverPath}/libs/*`,
                        `-Dmicronaut.application.storage.location=${serverStorage}`,
                        'com.jongsoft.finance.Application'
                    ],
                    {
                        cwd: appBasePath + '/fintrack',
                        env: {
                            MICRONAUT_ENVIRONMENTS: 'h2'
                        }
                    });

            serverProcess.stdout.on('data', dataLogger);
            serverProcess.stderr.on('data', dataLogger);

            callback(serverProcess != null);
        });
    } catch (e) {
        console.log(e);
        callback(false);
    }
}

const waitForServer = function (executionCount, startHandler) {
    const requestPromise = require('minimal-request-promise');

    requestPromise.get(backendUrl).then(
        response => {
            console.log('Server started!');
            startHandler();
        },
        response => {
            if (executionCount > 5) {
                mainWindow.loadFile(`${appBasePath}/resources/failed.html`);
                setTimeout(() => {
                    killHandler();
                    app.quit();
                }, 1500);
            } else {
                setTimeout(() => {
                    waitForServer(executionCount + 1, startHandler);
                }, 5000);
            }
        });
};

function initializeApplication() {
    mainWindow = new BrowserWindow({
        title: 'FinTrack: Personal Finance Manager',
        width: 1024,
        height: 786,
        autoHideMenuBar: true,
        center: true
    });
    mainWindow.on('close', e => killHandler());
    mainWindow.loadFile(`${appBasePath}/resources/index.html`);

    startServer(success => {
        if (!success) {
            console.log('Was unable to start the backend server');
            mainWindow.loadFile(`${appBasePath}/resources/failed.html`);
            setTimeout(app.quit, 1000);
        } else {
            waitForServer(
                0,
                () => mainWindow.loadURL(backendUrl));
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
