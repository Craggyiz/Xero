import WebSocket from "ws";
import { grabConfig } from "../server/index.js";
import proxyHandler from "../utils/proxys/proxyHandler.js";
import { generateHeaders } from '../utils/headers.js';
import axios from "axios";

export class Minion {
    constructor() {
        this.agent = proxyHandler.grabProxy();
        this.startedBots = false;
        this.isReconnecting = false;
        this.useID = false;
        this.abortController = new AbortController();
    }

    async connect(url) {
        this.startedBots = true;
        this.serverUrl = url;

        this.newParsedUrl = await this.requestRegionCode(url).catch(() => null);
        if (!this.newParsedUrl || !this.startedBots) {
            this.startedBots = false;
            return this.onClose();
        }

        this.ws = new WebSocket(this.newParsedUrl, {
            agent: this.agent,
            rejectUnauthorized: false,
            headers: generateHeaders('https://agar.cc'),
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

    async requestRegionCode(originalURL) {
        try {
            const response = await axios.get("https://agar.cc/", {
                signal: this.abortController.signal,
                httpsAgent: this.agent,
                timeout: 5000
            });

            const keyValue = this.extractKeyValue(response.data);
            if (keyValue) {
                const updatedURL = this.replaceKeyValueInURL(originalURL, keyValue);
                return updatedURL;
            } else {
                throw new Error("Key value not found in the response body.");
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                //console.log('Fetch aborted');
            } else {
                //throw new Error(`Error: ${error}`);
            }
        }
    }

    replaceKeyValueInURL(url, keyValue) {
        const regex = /\?key=[^"'\s]+/;
        return url.replace(regex, `?key=${keyValue}`);
    }

    extractKeyValue(body) {
        const regex = /\?key=([^"'\s]+)/;
        const match = body.match(regex);
        if (match && match[1]) {
            return match[1];
        }
        return null;
    }

    onMessage(message) { }

    onOpen() {
        var msg = this.Buffer(5);
        msg.setUint8(0, 254);
        msg.setUint32(1, 5, true);
        this.send(msg);
        var msg = this.Buffer(5);
        msg.setUint8(0, 255);
        msg.setUint32(1, 123456789, true);
        this.send(msg);
        this.sendNickName();
        this.sendHand();

        this.spawnInterval = setInterval(() => {
            this.sendNickName();
        }, 3000);
    }

    sendNickName() {
        var msg = this.Buffer(1 + 2 * this.name.length);

        msg.setUint8(0, 192);
        for (var i = 0; i < this.name.length; ++i) msg.setUint16(1 + 2 * i, this.name.charCodeAt(i), true);
        this.send(msg);
    }

    sendHand() {
        var hash = "12321321";
        var msg = this.Buffer(1 + 2 * hash.length);
        msg.setUint8(0, 56);
        for (var i = 0; i < hash.length; ++i) msg.setUint16(1 + 2 * i, hash.charCodeAt(i), true);
        this.send(msg);
    }

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

        this.abortController.abort();
        this.abortController = new AbortController();
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

    split() {
        this.sendUint8(17);
    }

    eject() {
        this.sendUint8(21);
    }

    sendUint8(offset) {
        const onebyte = this.Buffer(1);
        onebyte.setUint8(0, offset)
        this.send(onebyte);
    }

    sendMove(x, y) {
        var msg = this.Buffer(21);
        msg.setUint8(0, 16);
        msg.setFloat64(1, x, true);
        msg.setFloat64(9, y, true);
        msg.setUint32(17, 0, true);
        this.send(msg);
    }

    sendChat(message) {
        var msg = this.Buffer(2 + 2 * message.length);
        var offset = 0;
        var flags = 0;
        msg.setUint8(offset++, 206);
        msg.setUint8(offset++, flags);
        for (var i = 0; i < message.length; ++i) {
            msg.setUint16(offset, message.charCodeAt(i), true);
            offset += 2;
        }

        this.send(msg);
    }

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