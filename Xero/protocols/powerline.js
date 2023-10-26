import WebSocket from "ws";
import { grabConfig } from "../server/index.js";
import proxyHandler from "../utils/proxys/proxyHandler.js";
import { generateHeaders } from '../utils/headers.js';

export class Minion {
    constructor(url) {
        this.agent = proxyHandler.grabProxy();
        this.startedBots = false;
        this.isReconnecting = false;
        this.useID = false;

        this.connect(url)
    }

    connect(url) {
        this.startedBots = true;
        this.serverUrl = url;

        this.ws = new WebSocket(url, {
            agent: this.agent,
            rejectUnauthorized: false,
            headers: generateHeaders('https://powerline.io'),
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

    onMessage(message) {
        var reader = new DataView(message.data);
        var opcode = reader.getUint8(0);

        switch (opcode) {
            case 0:
                var offset = 1;
                this.myPing = reader.getUint16(offset, true);
                break;
            case 161:
                var offset = 1;
                var getId = reader.getUint32(offset, true);
                this.UserID = getId;
                console.log('got client ID: ' + this.UserID);
                break;
            case 163:
                var offset = 1;
                var id = reader.getUint16(offset, true);

                if (this.UserID === id) {
                    var currentX = reader.getFloat32(4, true) * 10.0;
                    var currentY = -reader.getFloat32(8, true) * 10.0;
                    this.x = currentX;
                    this.y = currentY;
                    this.lastSpeed = reader.getFloat32(12, true) * 10.0 * 0x3;
                    this.startZigzag();
                    this.addTurnPoint(2, currentX)
                    //console.log('Bot position: ', 'Current X: ' + currentX, 'Current Y: ' + currentY, 'Bot ID: ' + this.UserID);
                }
                break;
        }
    }

    onOpen() {
        var buf = new ArrayBuffer(1 + 2 + 2);
        var view = new DataView(buf);
        view.setUint8(0, 0xBF);
        view.setUint16(1, 104.5, true);
        view.setUint16(3, 75.7, true);
        this.send(buf);

        this.ping();
        this.spawn();
        this.spawnTimeout = setInterval(this.spawn.bind(this), 3000);
    }

    ping() {
        var buf = new ArrayBuffer(1);
        var view = new DataView(buf);
        view.setUint8(0, 0x00);
        this.send(buf);
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
    }

    startZigzag() {
        setTimeout(() => {
            this.turn(2) //left
            setTimeout(() => {
                this.turn(3) //down
                setTimeout(() => {
                    this.turn(2) //left
                    setTimeout(() => {
                        this.turn(1) //up
                        //startZigzag(bot)
                    }, 50)
                }, 100)
            }, 50)
        }, 100)
    }

    turn(direction) {
        var a = new ArrayBuffer(3),
            b = new DataView(a);
        b.setUint8(0, 5);
        b.setUint8(1, direction, true);
        b.setUint8(2, 0, true);
        this.send(a);
    }

    addTurnPoint(direction, vector) {
        var c = new ArrayBuffer(11),
            g = new DataView(c),
            f = 0;
        g.setUint8(f, 6);
        f += 1;
        g.setUint8(f, direction, true);
        f += 1;
        g.setFloat32(f, vector, true);
        let isFocused = 1
        g.setUint8(f + 4, isFocused, true);
        this.send(c);
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

    spawn() {
        var buf = new ArrayBuffer(3 + this.name.length * 2);
        var view = new DataView(buf);
        view.setUint8(0, 0x03);

        for (var i = 0; i < this.name.length; ++i) {
            view.setUint16(1 + i * 2, this.name.charCodeAt(i), true);
        }
        this.send(buf);
    }

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
            this.ws.send(data);
        }
    }
};