class Client {
    constructor() {
        this.isDebugging = true;
        [this.socketServerURL, this.requestGuiURL] = this.isDebugging ? ['ws://localhost:3000/', 'http://localhost:3000/botGUI'] : ['wss://xerobots.xyz/', 'https://xerobots.xyz/botGUI'];
        this.clientSocketURL = '';
        this.coordinates = {
            'x': 0,
            'y': 0
        };
        this.startedBots = false;
        this.injectedUI = false;
        this.queue = [];
        this.getID = id => document.getElementById(id);
        this.injectUI();
        this.setKeyboardInput();
        this.connectToSocket();
        this.beginMouseInterval();
    }
    async injectUI(retries = 0) {
        const maxRetries = 3;
        const retryDelay = 3000;
        const timeout = 5000;

        try {
            this.uiCode = await this.fetchWithTimeout(this.fetchGUI(), timeout);
            if (!this.uiCode) {
                throw new Error('Error fetching the Bot GUI');
            }
            if (!this.isUIAppended()) {
                this.appendGUI(this.uiCode);
            } else return;
        } catch (error) {
            alert('Failed to fetch botUI, retrying...');
            if (retries < maxRetries) {
                await this.delay(retryDelay);
                return this.injectUI(retries + 1);
            } else {
                return alert(`An error occurred: ${error.message}. If this issue persists, refresh the page or contact a developer.`);
            }
        }
    }
    isUIAppended() {
        const uiContainer = document.getElementById('uiRoot');
        return !!uiContainer;
    }
    async fetchWithTimeout(fetchPromise, timeout) {
        let timeoutId;

        const timeoutPromise = new Promise((resolve, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error('Request timed out'));
            }, timeout);
        });

        return Promise.race([fetchPromise, timeoutPromise]).finally(() => {
            clearTimeout(timeoutId);
        });
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async fetchGUI() {
        const guiUrl = await fetch(this.requestGuiURL);
        if (!guiUrl.ok) {
            throw new Error(`Fetch failed with status code ${guiUrl.status} and status text "${guiUrl.statusText}"`);
        }
        return await guiUrl.text();
    }
    appendGUI(html) {
        const div = document.createElement('div');
        div.id = 'uiRoot';
        div.innerHTML = html;
        document.body.appendChild(div);

        this.divIDs = {
            botCount: 'uiRootBotCounter',
            startButton: 'uiRootStartStop',
            botStatus: 'uiRootBotStatus'
        };

        this.injectedUI = true;

        this.getID(this.divIDs.startButton).addEventListener('click', (event) => {
            if (event.isTrusted) {
                this.setStartedInput();
            }
        });

        while (this.queue.length) {
            let [functionName, args] = this.queue.shift();
            this[functionName](...args);
        };
    }
    updateGUIStatus(color, status) {
        if (!this.injectedUI) {
            this.queue.push([
                'updateGUIStatus', [color, status]
            ]);
            return;
        }
        this.getID(this.divIDs.botStatus).style.color = color;
        this.getID(this.divIDs.botStatus).innerHTML = status;
    }
    updateGUICounter(spawned, max) {
        if (!this.injectedUI) return;
        this.getID(this.divIDs.botCount).innerHTML = spawned + " / " + max;
    }
    updateGUIStarted(check) {
        if (!this.injectedUI) return;
        if (!check) {
            this.getID(this.divIDs.startButton).innerHTML = 'Start';
            this.getID(this.divIDs.startButton).style.color = '#4287f5';
        } else {
            this.getID(this.divIDs.startButton).innerHTML = 'Stop';
            this.getID(this.divIDs.startButton).style.color = '#ebd907';
        }
    }
    resetGUI() {
        if (!this.injectedUI) {
            this.queue.push([
                'resetGUI', []
            ]);
            return;
        }
        this.updateGUIStatus('#FF6961', 'Offline');
        this.updateGUIStarted(this.startedBots);
        this.getID(this.divIDs.botCount).innerHTML = "0 / 0";
    }
    setKeyboardInput() {
        window.addEventListener('keypress', (event) => {
            if (event.isTrusted) {
                switch (event.key) {
                    case 'e':
                        // Split
                        this.sendUint8(2);
                        break;
                    case 'r':
                        // Eject
                        this.sendUint8(3);
                        break;
                }
            }
        });
    }
    beginMouseInterval() {
        this.isMouseMoved = false;
        this.mouseInt = setInterval(() => {
            if (!this.isMouseMoved) return;
            this.isMouseMoved = false;

            var test = this.Buffer(26);
            test.setUint8(0, 0x4, true);
            test.setFloat64(1, this.coordinates.x, true);
            test.setFloat64(9, this.coordinates.y, true);
            this.sendMsg(test);
        }, 50);
    }
    dataParse(args) {
        if (args instanceof ArrayBuffer) {
            return new Uint8Array(args);
        }

        if (args instanceof DataView) {
            return new Uint8Array(args.buffer);
        }

        if (args instanceof Uint8Array) {
            return args;
        }

        if (args instanceof Array) {
            return new Uint8Array(args);
        }

        throw new Error(`Unsupported data type: ${args}`);
    }
    mouseNavigation(data, ws) {
        try {
            data = this.dataParse(data);
            switch (data.length) {
                case 21:
                case 17:
                    data = new DataView(data.buffer);
                    var datax = data.getFloat64(1, true);
                    var datay = data.getFloat64(9, true);
                    this.clientSocketURL = ws.url;
                    if (this.coordinates.x !== datax || this.coordinates.y !== datay) {
                        this.isMouseMoved = true;
                    }
                    this.coordinates.x = datax;
                    this.coordinates.y = datay;
                    break;
                case 9:
                case 13:
                    data = new DataView(data.buffer);
                    datax = data.getInt32(1, true);
                    datay = data.getInt32(5, true);
                    this.clientSocketURL = ws.url;
                    if (this.coordinates.x !== datax || this.coordinates.y !== datay) {
                        this.isMouseMoved = true;
                    }
                    this.coordinates.x = datax;
                    this.coordinates.y = datay;
                    break;
                default:
                    this.clientSocketURL = ws.url;
                    break;
            }
        } catch (error) {
            console.log(`Error in parsing data: ${error}`);
        }
    }
    connectToSocket() {
        this.socket = new WebSocket(this.socketServerURL);
        this.socket.binaryType = 'arraybuffer';
        this.socket.onmessage = this.onmessage.bind(this);
        this.socket.onerror = this.onerror.bind(this);
        this.socket.onclose = this.onclose.bind(this);
        this.socket.onopen = this.onopen.bind(this);
    }
    onopen() {
        this.updateGUIStatus('#50C878', 'Online');
    }
    onmessage(message) {
        try {
            message = this.dataParse(message.data);
            var data = new DataView(message.buffer);
            var opcode = data.getUint8(0);

            switch (opcode) {
                case 0x6:
                    var spawnedBots = data.getUint32(1, true);
                    var maxBots = data.getUint32(10, true);
                    this.updateGUICounter(spawnedBots, maxBots);
                    break;
            }

        } catch (error) {
            console.log(`Error in parsing data: ${error}`);
        }
    }
    onclose(msg) {
        if (msg.code == 1006) {
            setTimeout(this.connectToSocket.bind(this), 6000);
        } else {
            setTimeout(this.connectToSocket.bind(this), 10000);
        }
        this.startedBots = false;
        this.resetGUI();
    }
    onerror() { }
    setStartedInput() {
        if (this.startedBots) {
            this.startedBots = !this.stopBots();
        } else {
            this.startedBots = this.startBots();
        };
        this.updateGUIStarted(this.startedBots);
    }
    startBots() {
        if (!this.clientSocketURL || this.clientSocketURL.includes(this.socketServerURL)) return false;

        var serverData = this.Buffer(1 + 2 * this.clientSocketURL.length);
        serverData.setUint8(0, 0);
        for (var i = 0; i < this.clientSocketURL.length; ++i) {
            serverData.setUint16(1 + 2 * i, this.clientSocketURL.charCodeAt(i), true);
        }
        this.sendMsg(serverData);

        return true;
    }
    stopBots() {
        this.sendUint8(1);

        return true;
    }
    get open() {
        return this.socket && this.socket.readyState === 1;
    }
    Buffer(buffer = 1) {
        return new DataView(new ArrayBuffer(buffer));
    }
    sendUint8(offset) {
        var oneByte = this.Buffer(1);
        oneByte.setUint8(0, offset);
        this.sendMsg(oneByte);
    }
    sendMsg(message) {
        try {
            if (this.open) {
                this.socket.send(message);
            }
        } catch (error) {
            console.log(`Failed to send data: ${error}`);
        }
    }
}

function isAllowedHost() {
    const allowedHosts = [
        'agarpowers.xyz',
        'agar.live',
        'agar.cc'
    ];
    return allowedHosts.includes(location.host);
}

if (isAllowedHost()) {
    var usr;

    WebSocket.prototype.send = new Proxy(WebSocket.prototype.send, {
        apply: (target, thisArg, args) => {
            var ret = target.apply(thisArg, args);
            if (thisArg.url.includes(usr?.socketServerURL)) return ret;
            usr?.mouseNavigation(...args, thisArg);
            return ret;
        }
    });

    window.addEventListener('load', () => {
        usr = new Client();
    });
} else {
    alert(`Error occured while starting the script! Please DM a Developer this message: ${btoa(location.host)}`);
}