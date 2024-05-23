const {app, BrowserWindow, session} = require('electron');
const fs = require('fs');

const killHandler = function() {
    session.defaultSession.clearStorageData()
        .then(() => console.debug('Cleared session storage data.'));
    if (serverProcess) {
        console.debug('Attempting to terminate the Java process.')
        if (!serverProcess.kill('SIGKILL')) {
            console.warn('Could not terminate Java process, attempting forceful shutdown.');
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
const backendUrl = 'http://localhost:8080/';
const serverStorage = `${app.getPath('appData')}/${app.getName()}/storage/`;
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
            fs.mkdirSync(serverStorage, {recursive: true});
        }

        fs.copyFileSync(`${serverPath}/rsa-2048bit-key-pair.pem`, `${serverStorage}/rsa-2048bit-key-pair.pem`);
        fs.readdir(`${serverPath}/core/`, (err, files) => {
            const loadJar = (prefix) => {
                return files.filter(file => file.indexOf(prefix) > -1)[0];
            }

            const coreJars = [
                `${serverPath}/core/${loadJar('fintrack-api-')}`,
                `${serverPath}/core/${loadJar('pledger-ui-')}`,
                `${serverPath}/core/${loadJar('jpa-repository-')}`,
                `${serverPath}/core/${loadJar('bpmn-process-')}`,
                `${serverPath}/core/${loadJar('rule-engine-')}`,
                `${serverPath}/core/${loadJar('domain-')}`,
                `${serverPath}/core/${loadJar('core-')}`,
                `${serverPath}/core/${loadJar('transaction-importer-api-')}`,
                `${serverPath}/core/${loadJar('transaction-importer-csv-')}`,
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
                            MICRONAUT_ENVIRONMENTS: 'h2',
                            MICRONAUT_SERVER_HOST: '0.0.0.0'
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

    console.log('Waiting for server to start on endpoint ' + backendUrl + '.');
    const requestOptions = {
        method: 'GET',
        hostname: 'localhost',
        port: 8080,
        path: '/ui/login',
        protocol: 'http:',
    }
    requestPromise(requestOptions).then(
        response => {
            console.log('Server started!');
            startHandler();
        },
        response => {
            console.log(response.statusMessage)
            if (executionCount > 5) {
                console.log('Server failed to start after 5 attempts.');
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
        title: 'Pledger.io: Personal Finance Manager',
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
            console.log('Waiting for server to start.');
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
