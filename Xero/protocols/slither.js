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

        this.connect(url);
    }

    getHost(a) {
        a = a.replace(/[/slither]/g, '');
        a = a.replace(/[ws]/g, '');
        a = a.replace(/[/]/g, '');
        a = a.substr(1);
        //console.log(a);
        return a;
    }

    connect(url) {
        this.startedBots = true;
        this.serverUrl = url;

        this.ws = new WebSocket(url, {
            agent: this.agent,
            rejectUnauthorized: false,
            headers: {
                'Origin': 'http://slither.io',
                'Accept-Encoding': 'gzip, deflate',
                'Accept-Language': 'en-US,en;q=0.8',
                'Cache-Control': 'no-cache',
                'Connection': 'Upgrade',
                'Host': this.getHost(url), //104.207.132.60:4041
                'Pragma': 'no-cache',
                'Upgrade': 'websocket',
                'Sec-WebSocket-Version': '13',
                'Sec-WebSocket-Extensions': 'permessage-deflate; client_max_window_bits',
                'User-Agent': 'Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36'
            }//generateHeaders(''),
            //timeout: 5000
        });

        this.ws.binaryType = 'nodebuffer';

        this.ws.onmessage = this.onMessage.bind(this);
        this.ws.onopen = this.onOpen.bind(this);
        this.ws.onclose = this.onClose.bind(this);
        this.ws.onerror = this.onError.bind(this);

        this.id = Math.floor(Math.pow(2, 14) * Math.random()).toString(36);
        this.name = grabConfig().botOptions.getName() + (this.useID ? ' | ' + this.id : '');
    }

    decodeSecrect(secret) {
        var result = new Uint8Array(24);
        var globalValue = 0;
        for (var i = 0; i < 24; i++) {
            var value1 = secret[17 + i * 2];
            if (value1 <= 96) {
                value1 += 32;
            }
            value1 = (value1 - 98 - i * 34) % 26;
            if (value1 < 0) {
                value1 += 26;
            }

            var value2 = secret[18 + i * 2];
            if (value2 <= 96) {
                value2 += 32;
            }
            value2 = (value2 - 115 - i * 34) % 26;
            if (value2 < 0) {
                value2 += 26;
            }

            var interimResult = (value1 << 4) | value2;
            var offset = interimResult >= 97 ? 97 : 65;
            interimResult -= offset;
            if (i == 0) {
                globalValue = 2 + interimResult;
            }
            result[i] = ((interimResult + globalValue) % 26 + offset);
            globalValue += 3 + interimResult;
        }

        return result;

    }

    getValue(originX, originY, targetX, targetY) {
        var dx = originX - targetX;
        var dy = originY - targetY;

        // var theta = Math.atan2(dy, dx);  // [0, Ⲡ] then [-Ⲡ, 0]; clockwise; 0° = west
        // theta *= 180 / Math.PI;          // [0, 180] then [-180, 0]; clockwise; 0° = west
        // if (theta < 0) theta += 360;     // [0, 360]; clockwise; 0° = west

        // var theta = Math.atan2(-dy, dx); // [0, Ⲡ] then [-Ⲡ, 0]; anticlockwise; 0° = west
        // theta *= 180 / Math.PI;          // [0, 180] then [-180, 0]; anticlockwise; 0° = west
        // if (theta < 0) theta += 360;     // [0, 360]; anticlockwise; 0° = west

        // var theta = Math.atan2(dy, -dx); // [0, Ⲡ] then [-Ⲡ, 0]; anticlockwise; 0° = east
        // theta *= 180 / Math.PI;          // [0, 180] then [-180, 0]; anticlockwise; 0° = east
        // if (theta < 0) theta += 360;     // [0, 360]; anticlockwise; 0° = east

        //var theta = Math.atan2(-dy, -dx); // [0, Ⲡ] then [-Ⲡ, 0]; clockwise; 0° = east
        var theta = Math.atan2(-dy, -dx);
        //if(theta < 0) {theta += 2*Math.PI}
        theta *= 125 / Math.PI; // [0, 180] then [-180, 0]; clockwise; 0° = east
        if (theta < 0) theta += 250; // [0, 360]; clockwise; 0° = east

        return theta
    }

    moveTo(x, y) {
        //var randomInt = getRandomInt(-25, 25);
        var value = this.getValue(this.snakeX, this.snakeY, x, y);
        this.snakeAngle = value;
        if (value < 0 || value > 250) {
            console.log("Error!");
        }
        //

        //console.log("x "+this.snakeX+" y "+this.snakeY + " v "+Math.ceil(value));
        //var buf = new Buffer(value * 251 / (2*Math.PI));
        var buf = new Buffer([Math.floor(value)]);
        this.send(buf);
    }

    onMessage(b) {
        var lol = new Uint8Array(b.data);
        var f = String.fromCharCode(lol[2]);
        var snakeSpeed, lastPacket, etm;
        //console.log(b);
        if (2 <= lol.length) {
            if ("6" == f) {
                console.log("PerInitRespone");
                var e = 165;
                var c = 3;
                var h = "";
                for (h = ""; c < e;) {
                    h += String.fromCharCode(lol[c]),
                        c++;
                }
                this.send(this.decodeSecrect(lol));
                this.spawn();
            } else if ("p" == f) {
                this.needPing = true;
            } else if ("a" == f) {
                console.log("Initial setup");
                setInterval(() => {
                    this.moveTo(this.xPos, this.yPos);
                }, 100);
                setInterval(() => {
                    //if(client.needPing){
                    this.send(new Buffer([251]));
                    //}
                }, 250);
            } else if ("v" == f) {
                console.log("dead");
                this.haveSnakeID = false;
                this.disconnect();
                //this.disconnect();
            } else if ("g" == f) {
                //this.updatePos(lol, "g");

                if ((lol[3] << 8 | lol[4]) == this.snakeID) {
                    this.snakeX = lol[5] << 8 | lol[6];
                    this.snakeY = lol[7] << 8 | lol[8];
                }
            } else if ("n" == f) {
                //this.updatePos(lol, "n");

                if ((lol[3] << 8 | lol[4]) == this.snakeID) {
                    this.snakeX = lol[5] << 8 | lol[6];
                    this.snakeY = lol[7] << 8 | lol[8];
                }
            } else if ("G" == f) {
                //this.updatePos(lol, "G");

                if ((lol[3] << 8 | lol[4]) == this.snakeID) {
                    this.snakeX = this.snakeX + lol[5] - 128;
                    this.snakeY = this.snakeY + lol[6] - 128;
                }
            } else if ("N" == f) {
                //this.updatePos(lol, "N");
                if ((lol[3] << 8 | lol[4]) == this.snakeID) {
                    this.snakeX = this.snakeX + lol[5] - 128;
                    this.snakeY = this.snakeY + lol[6] - 128;
                }

            } else if ("s" == f) {
                if (!this.haveSnakeID) {
                    this.snakeID = lol[3] << 8 | lol[4];
                    this.haveSnakeID = true;
                }
                if ((lol[3] << 8 | lol[4]) == this.snakeID) {
                    if (lol.length >= 31) {
                        snakeSpeed = (lol[12] << 8 | lol[13]) / 1e3;

                    }
                    if (lol.length >= 31 && (((((lol[18] << 16) | (lol[19] << 8) | lol[20]) / 5.0) > 99) || ((((lol[21] << 16) | (lol[22] << 8) | lol[23]) / 5.0) > 99))) {
                        this.snakeX = ((lol[18] << 16) | (lol[19] << 8) | lol[20]) / 5.0;
                        this.snakeY = ((lol[21] << 16) | (lol[22] << 8) | lol[23]) / 5.0;
                    }
                }

            } else if ("g" || "n" || "G" || "N" && (lol[3] << 8 | lol[4]) === this.snakeID) {

                if (lastPacket != null) {
                    var deltaTime = Date.now() - lastPacket;


                    var distance = snakeSpeed * deltaTime / 4.0;
                    this.snakeX += Math.cos(this.snakeAngle) * distance;
                    this.snakeY += Math.sin(this.snakeAngle) * distance;
                }
                lastPacket = Date.now();

            }
        }
    }

    onOpen() {
        this.send(new Buffer([99]));
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
        var spawnBuf = new Uint8Array([115,10,1,15,32,42,78,101,119,42,77,101,77,101,122,66,111,116,115]);
        this.send(spawnBuf);
    }

    split() { }

    eject() { }

    sendUint8(offset) {
        const onebyte = this.Buffer(1);
        onebyte.setUint8(0, offset);
        this.send(onebyte);
    }

    sendMove(x, y) {
        this.xPos = x;
        this.yPos = y;
    }

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