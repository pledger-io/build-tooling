const {app, BrowserWindow} = require('electron');
const fs = require('fs');
const console = require("node:console");
const appBasePath = process.cwd();

function createDirectory(directory) {
    if (!fs.existsSync(directory)) {
        console.debug(`Creating directory: ${directory}`);
        fs.mkdirSync(directory, { recursive: true }) || console.error(`Failed to create directory: ${directory}`);
    }
}

function BackendServer(serverPath, storagePath) {
    let serverHandle;
    let loggingStream;

    console.debug('--------------------------------------------------');
    console.debug('Setting up the backend server, with locations:');
    console.debug(`  root:\t\t ${serverPath}`);
    console.debug(`  storage:\t ${storagePath}`);
    console.debug(`  log:\t\t ${serverPath}/logging`);
    console.debug('--------------------------------------------------');

    const prepareServer = () => {
        try {
            createDirectory(`${storagePath}`);
            createDirectory(`${storagePath}/logs`);
            loggingStream = fs.createWriteStream(`${storagePath}/logs/server.log`);
            fs.copyFileSync(`${serverPath}/rsa-2048bit-key-pair.pem`, `${storagePath}/rsa-2048bit-key-pair.pem`);
        } catch (error) {
            console.error(`Error preparing server: ${error}`);
        }
    }

    const libSeparator = process.platform === 'win32' ? ';' : ':';
    return {
        start: function () {
            try {
                prepareServer();
                serverHandle = require('child_process')
                    .spawn('java',
                        [
                            '-cp', `${serverPath}/core/*${libSeparator}${serverPath}/libs/*`,
                            `-Dmicronaut.application.storage.location=${storagePath}`,
                            'com.jongsoft.finance.Pledger'
                        ],
                        {
                            cwd: appBasePath + '/server',
                            env: {
                                MICRONAUT_ENVIRONMENTS: 'h2,jpa',
                                MICRONAUT_SERVER_HOST: '0.0.0.0',
                                SINGLE_USER_ENABLED: 'true',
                            }
                        });
                serverHandle.stdout.on('data', (chunk) => loggingStream.write(chunk))
                serverHandle.stderr.on('data', (chunk) => loggingStream.write(chunk))
                return true
            } catch (error) {
                return false
            }
        },
        terminate: function () {
            if (!serverHandle) {
                console.log('Server shutdown requested, but not yet started.')
                return
            }

            console.debug('Shutdown of backend application.')
            if (!serverHandle.kill()) {
                console.warn('Failed to terminate the backend server gracefully.')
            }
            console.debug('Backend server terminated.')
        }
    }
}

function FrontEnd(resourcePath) {
    window = new BrowserWindow({
        title: 'Pledger.io: Personal Finance Manager',
        width: 1300,
        height: 900,
        autoHideMenuBar: true,
        center: true,
        icon: `${resourcePath}/icon.png`
    })

    console.debug('Starting front-end browser locations:');
    console.debug(`  resources: ${resourcePath}`);
    console.debug('--------------------------------------------------');

    return {
        displayApplication: () => window.loadURL('http://localhost:8080/ui/dashboard'),
        loadingScreen: () => window.loadFile(`${resourcePath}/index.html`),
        errorScreen: () => window.loadFile(`${resourcePath}/failed.html`),
        onClose: (callback) => window.on('close', callback),
    }
}

async function waitOnBackend() {
    const requestPromise = require('minimal-request-promise');
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    console.log('Waiting for server to start.');
    const requestOptions = {
        method: 'GET',
        hostname: 'localhost',
        port: 8080,
        path: '/ui/login',
        protocol: 'http:',
    }

    for (let i = 0; i < 10; i++) {
        try {
            const response = await requestPromise(requestOptions)
            return response.statusCode === 200
        } catch (error) {
            console.debug(`Backend not yet ready after attempt ${i + 1}`);
            await delay(5000)
        }
    }

    return false;
}

app.whenReady()
    .then(async () => {
        const basePath = process.cwd()

        const serverControl = BackendServer(`${basePath}/server`, `${app.getPath('appData')}/${app.getName()}/storage/`)
        const frontEndControl = FrontEnd(`${basePath}/resources`)

        frontEndControl.onClose(() => serverControl.terminate())
        frontEndControl.loadingScreen()

        if (serverControl.start() && await waitOnBackend()) {
            frontEndControl.displayApplication()
        } else {
            console.error('Failed to launch the server, terminating the application.')
            frontEndControl.errorScreen()
            setTimeout(() => {
                serverControl.terminate()
                app.quit()
            }, 1500)
        }
    })

// termination hook required for OSx
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
});
