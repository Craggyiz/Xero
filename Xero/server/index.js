import config from './config.js';
import { MainServer } from './mainServer.js';

export function grabConfig() {
    return config;
}

(function UwU () {
    // For now.
    var server = new MainServer();
    server.beginServer();
})();