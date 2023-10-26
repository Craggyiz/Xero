import { WebSocketServer } from 'ws';
import proxyHandler from '../utils/proxys/proxyHandler.js';
import config from './config.js';
import http from 'node:http';
import fs from 'fs';
import { User } from './newUser.js';
import pkg from 'javascript-obfuscator';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'node:path';
import { sanitizeUrl } from "../utils/requests.js";
import { color, log, red, green, cyan, cyanBright } from 'console-log-colors';

export class MainServer {
    constructor() {
        this.config = config;

        this.__filename = fileURLToPath(import.meta.url);
        this.__dirname = dirname(this.__filename);

        this.fileCache = {};

        this.serverStorage = {
            clients: {},
            onlineUsers: 0
        };

        this.config.serverOptions.useSSL ? this.sslOptions = {
            cert: fs.readFileSync('../../../../etc/letsencrypt/live/xerobots.xyz/cert.pem'),
            key: fs.readFileSync('../../../../etc/letsencrypt/live/xerobots.xyz/privkey.pem')
        } : this.sslOptions = {};
    }

    async beginServer() {
        try {
            await Promise.all([proxyHandler.proxyHandler()]);
            this.loadAllFiles();
            this.startSocket();
        } catch (error) {
            console.error(error);
        }
    }

    loadAllFiles() {
        this.clientFile = "clientdeob.js";

        if (this.config.serverOptions.obfuscateClientCode) {
            const obfuscatedFile = path.resolve(this.__dirname, '..', 'clientSide', 'client.js');
            fs.writeFile(obfuscatedFile, '', 'utf-8', () => { })

            const clientMain = fs.readFileSync(path.resolve(this.__dirname, '..', 'clientSide', 'clientdeob.js'), 'utf-8');
            var obfuscateClientCode = pkg.obfuscate(clientMain);

            fs.writeFileSync(obfuscatedFile, obfuscateClientCode.getObfuscatedCode(), 'utf-8');
            this.clientFile = "client.js";
        }

        this.files = {
            '/botGUI': path.resolve(this.__dirname, '..', 'website', 'index.html'),
            '/client': path.resolve(this.__dirname, '..', 'clientSide', this.clientFile),
            '/script.user.js': path.resolve(this.__dirname, '..', 'clientSide', 'script.user.js'),
        };

        this.cacheFiles(this.files);

        console.log(green('[Xero-Bots]: Successfully loaded all server files.'));
    }

    startSocket() {
        if (this.config.serverOptions.useSSL) {
            this.createServer(this.siteListener.bind(this), this.sslOptions);
        } else {
            this.createServer(this.siteListener.bind(this));
        }

        console.log(green(`[Xero-Bots]: Server started. SSL: ${this.config.serverOptions.useSSL}`));
    }

    createServer(siteListener, options) {
        let server;

        if (options) {
            server = http.createServer(options, siteListener);
        } else {
            server = http.createServer(siteListener);
        }

        const wss = new WebSocketServer({ server, verifyClient: this.clientVerify.bind(this) });

        wss.on('connection', this.handleConnection.bind(this));

        server.listen(this.config.serverOptions.websitePort);
    }

    async clientVerify(info, callback) {
        let getProto = await this.grabProtocol(sanitizeUrl(info.origin));
        var forwardedIp = info.req.headers['x-forwarded-for'] || 'localhost';
        var isClientPresent = (forwardedIp in this.serverStorage.clients) ? true : false;

        if ((this.config.serverOptions.useSSL && !forwardedIp) || !getProto || isClientPresent || (getProto.ipAllowed && !getProto.ipAllowed.includes(forwardedIp))) {
            return callback(false, 401, 'Unauthorized');
        }

        callback(true);
    }

    async handleConnection(ws, req) {
        let getProto = await this.grabProtocol(req.headers.origin);
        var forwardedIp = req.headers['x-forwarded-for'] || 'localhost';

        this.serverStorage.clients[forwardedIp] = {
            User: new User(ws, req, getProto, forwardedIp, this.serverStorage)
        }
    }

    protocols(origin) {
        switch (origin) {
            case "https://agar.cc": {
                return {
                    file: "agarCC.js",
                    allowedMax: 300,
                    ipAllowed: this.config.serverOptions.useSSL ? ["EEER"] : ["localhost"],
                    connectionsPerIP: 4
                };
            }
            case "https://agar.live": {
                return {
                    file: "agarlive.js",
                    allowedMax: 300,
                    ipAllowed: this.config.serverOptions.useSSL ? ["EEER"] : ["localhost"],
                    connectionsPerIP: 3
                };
            }
            case "https://cellcraft.io": {
                return {
                    file: "cellcraft.js",
                    allowedMax: 300,
                    ipAllowed: this.config.serverOptions.useSSL ? ["EEER"] : ["localhost"],
                    connectionsPerIP: 1
                };
            }
            case "http://slither.io": {
                return {
                    file: "slither.js",
                    allowedMax: 700,
                    //ipAllowed: this.config.serverOptions.useSSL ? ["EEER"] : ["localhost"],
                    connectionsPerIP: 1
                };
            }
        }
    }

    async grabProtocol(origin) {
        var protocol = this.protocols(origin);
        if (!protocol) return false;
        if (!('Minion' in protocol)) {
            const { Minion } = await import(`../protocols/${protocol.file}`);
            protocol.Minion = Minion;
        }
        return protocol;
    }

    siteListener(req, res) {
        switch (req.url) {
            case "/botGUI": {
                const { status, data } = this.getCachedFile('/botGUI');
                res.writeHead(status, { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' });
                res.end(data);
                break;
            }
            case "/client": {
                const { status, data } = this.getCachedFile('/client');
                res.writeHead(status, { 'Content-Type': 'text/html' });
                res.end(data);
                break;
            }
            case "/script.user.js": {
                const { status, data } = this.getCachedFile('/script.user.js');
                res.writeHead(status, { 'Content-Type': 'text/html' });
                res.end(data);
                break;
            }
            default: {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end('<script>location.href = "https://discord.com/invite/bAstbAfem9";</script>')
                break;
            }
        }
    }

    cacheFiles(files) {
        Object.keys(files).forEach(fileName => {
            const filePath = files[fileName];
            fs.readFile(filePath, 'utf-8', (err, data) => {
                if (err) {
                    console.error(`Error reading file ${fileName}: ${err}`);
                    return;
                }
                this.fileCache[fileName] = data;
            });
        });
    }

    getCachedFile(fileName) {
        if (this.fileCache[fileName]) {
            return { status: 200, data: this.fileCache[fileName] };
        }
        return { status: 500, data: 'Error in req file' };
    }
}