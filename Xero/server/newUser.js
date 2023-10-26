import { color, log, red, green, cyan, cyanBright } from 'console-log-colors';

export class User {
    constructor(ws, req, getProto, forwardedIp, serverStorage) {
        this.started = false;
        this.bots = [];
        this.ws = ws;
        this.origin = req.headers.origin;
        this.protocol = getProto;
        this.serverStorage = serverStorage;
        this.IP = forwardedIp;
        this.setUpClient();
    }
    setUpClient() {
        this.serverStorage.onlineUsers++;

        console.log(cyan(`[Xero-Bots]: A Client has successfully connected from IP: ${this.IP} Online Clients: ${this.serverStorage.onlineUsers}`));

        this.ws.on("message", this.onMessage.bind(this));
        this.ws.on("close", this.onClose.bind(this));
        this.ws.on("error", this.onError.bind(this));

        this.startBotCount();
    }
    onMessage(message) {
        try {
            var reader = Buffer.from(message);
            const header = reader.readUInt8(0, true);

            switch (header) {
                case 0:
                    var string = reader.toString('utf16le', 1);
                    this.startBots(string);
                    console.log(cyan(`[Xero-Bots]: A Client has started bots on origin: ${this.origin}, socket: ${string}`));
                    break;
                case 1:
                    this.stopBots();
                    break;
                case 2:
                    this.bots.forEach((bot) => {
                        bot.split();
                    });
                    break;
                case 3:
                    this.bots.forEach((bot) => {
                        bot.eject();
                    });
                    break;
                case 4:
                    var clientX = reader.readDoubleLE(1);
                    var clientY = reader.readDoubleLE(9);
                    this.moveBots(clientX, clientY);
                    break;
            }
        } catch (error) {
            this.ws.close();
            console.warn(red("Unrecognized message:" + error));
        }
    }
    moveBots(x, y) {
        if (x == 0 || y == 0) return;
        this.bots.forEach((bot) => {
            bot.sendMove(x, y);
        });
    }
    startBots(wss) {
        if (this.started) return;

        for (var i = 0; i < /*this.protocol.allowedMax*/ (this.protocol.allowedMax * this.protocol.connectionsPerIP); i++) {
            this.bots.push(new this.protocol.Minion(wss));
        } // Dynamically add.

        //this.bots.forEach((bot) => {
        //    bot.connect(wss);
        //});

        this.started = true;
    }
    stopBots() {
        if (!this.started) return;
        this.bots.forEach((bot) => {
            bot.disconnect();
        });
        this.bots = []; // Clear the bots array
        this.started = false;
    }
    onClose() {
        this.serverStorage.onlineUsers--;
        this.stopBots();
        this.bots = [];
        clearInterval(this.botCount);
        console.log(cyan(`[Xero-Bots]: A Client has disconnected from IP: ${this.IP} Online Clients: ${this.serverStorage.onlineUsers}`));
        if (this.IP in this.serverStorage.clients) {
            delete this.serverStorage.clients[this.IP];
        }
    }
    onError() {
        this.ws.close();
    }
    startBotCount() {
        this.botCount = setInterval(() => {

            var spawned = 0;

            this.bots.forEach((bot) => {
                if (bot.ws && bot.ws.readyState == 1) spawned++;
            });

            let botCount = this.Buffer(15);
            botCount.setUint8(0, 6);
            botCount.setUint32(1, spawned, true);
            botCount.setUint32(10, /*this.protocol.allowedMax*/(this.protocol.allowedMax * this.protocol.connectionsPerIP), true);
            this.send(botCount);

        }, 100);
    }
    Buffer(buffer = 1) {
        return new DataView(new ArrayBuffer(buffer));
    }
    get wsOPEN() {
        return this.ws && this.ws.readyState == 1;
    }
    send(message) {
        if (this.wsOPEN) {
            this.ws.send(message);
        }
    }
}