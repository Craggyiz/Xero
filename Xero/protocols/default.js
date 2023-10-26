import WebSocket from "ws";
import { grabConfig } from "../server/index.js";
import proxyHandler from "../utils/proxys/proxyHandler.js";
import { generateHeaders } from '../utils/headers.js';

export class Minion {
    constructor() {
        this.agent = proxyHandler.grabProxy();
        this.startedBots = false;
        this.isReconnecting = false;
        this.useID = false;
    }

    connect(url) {
        this.startedBots = true;
        this.serverUrl = url;

        this.ws = new WebSocket(url, {
            agent: this.agent,
            rejectUnauthorized: false,
            headers: generateHeaders(''),
            timeout: 5000
        });

        this.ws.binaryType = 'arraybuffer';

        this.ws.onmessage = this.onMessage.bind(this);
        this.ws.onopen = this.onOpen.bind(this);
        this.ws.onclose = this.onClose.bind(this);
        this.ws.onerror = this.onError.bind(this);

        this.id = Math.floor(Math.pow(2, 14) * Math.random()).toString(36);
        this.name = grabConfig().botOptions.getName() + (this.useID ? ' | ' + this.id : '');
    }

    onMessage(message) { }

    onOpen() { }

    onClose() {
        this.handleReconnection();
    }

    onError(error) {
        // No error handling for now.
        // console.error(error);
        this.handleReconnection();
    }

    disconnect() {
        this.startedBots = false;
        this.clearIntervals();

        if (this.ws) {
            this.ws.terminate();
            this.ws = null;
        }
    }

    reconnect() {
        this.clearIntervals();
        this.agent = proxyHandler.grabProxy();

        if (this.serverUrl && this.startedBots) {
            this.connect(this.serverUrl);
        }
    }

    clearIntervals() {
        clearInterval(this.pingInterval);
        clearTimeout(this.spawnInterval);
    }

    handleReconnection() {
        if (!this.isReconnecting) {
            this.isReconnecting = true;
            this.reconnect();
        }
    }

    spawn() { }

    split() { }

    eject() { }

    sendUint8(offset) {
        const onebyte = this.Buffer(1);
        onebyte.setUint8(0, offset);
        this.send(onebyte);
    }

    sendMove(x, y) { }

    sendChat(message) { }

    get wsOPEN() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }

    Buffer(buf = 1) {
        return new DataView(new ArrayBuffer(buf));
    }

    send(data) {
        if (this.wsOPEN) {
            this.ws.send(data['buffer']);
        }
    }
};