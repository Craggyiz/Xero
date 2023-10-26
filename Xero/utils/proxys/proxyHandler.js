import config from '../../server/config.js';
import axios from 'axios';
import ProxyAgent from 'proxy-agent';
import { color, log, red, green, cyan, cyanBright } from 'console-log-colors';
import path from 'node:path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import Sources from './Sources.js';
import net from 'net';
import { getRandom } from 'random-useragent';
import pLimit from 'p-limit';

class Scraper {
    constructor(source) {
        this.config = source;
        this.url = this.config.url;
        this.method = this.config.method;
        this.protocol = this.config.protocol;
        this.parser = this.config.parser || {};
        this.parser_type = Object.keys(this.parser)[0];
        this.parser_config = Object.values(this.parser)[0];
        this.request_timeout = 1000;
        this.is_succeed = false;

        //console.info(`Source: ${this.config.id} initiated.`);
    }

    isValidIP(ip) {
        return net.isIP(ip);
    }

    isValidPort(port) {
        const parsedPort = parseInt(port, 10);
        return parsedPort >= 0 && parsedPort <= 65535;
    }

    async scrape() {
        const proxies = [];

        try {
            const response = await axios({
                method: this.method,
                url: this.url,
                timeout: this.request_timeout,
                headers: {
                    'User-Agent': getRandom()
                }
            });

            if (response.status === 200) {
                const body = response.data;

                if (this.parser_type === 'txt') {
                    let lines = body.split('\n');
                    lines.forEach(line => {
                        let [ip, port] = line.split(':');
                        if (this.isValidIP(ip) && this.isValidPort(port)) {
                            proxies.push({
                                ip: ip,
                                port: port,
                                protocol: this.protocol
                            });
                        }
                    });
                }

                this.is_succeed = true;
            } else {
                throw new Error(`Error code ${response.status} when requesting ${this.url}`);
            }
        } catch (error) {
            this.is_succeed = false;
            //console.error(`Source: ${this.config.id} encountered an error during scrape!`);
            //console.error(error);
        }

        return proxies;
    }

    async initialize() {
        const proxies = await this.scrape();

        return { isSucceed: this.is_succeed, proxiesRes: proxies };
    }
}

class Checker {
    constructor(ip, port, protocol) {
        this.ip = ip;
        this.port = port;
        this.proxy = {
            protocol: protocol,
            host: this.ip,
            port: this.port
        };
        //console.log(`Checking Proxy: ${this.proxy.protocol}://${this.proxy.host}:${this.proxy.port} IP: ${this.proxy.host} Port: ${this.proxy.port} Protocol: ${this.proxy.protocol}`);
    }

    httpCheck() {
        // Implement
        return true;
    }

    httpsCheck() {
        // Implement
        return true;
    }

    socksCheck() {
        // Implement
        return true;
    }

    socks4Check() {
        // Implement
        return true;
    }

    socks5Check() {
        // Implement
        return true;
    }

    premiumCheck() {
        // Implement
        return true;
    }

    async check() {
        switch (this.proxy.protocol) {
            case 'http':
                // perform http check
                //console.log(`Performing HTTP check for ${this.proxy.host}:${this.proxy.port}`);
                return this.httpCheck();
            case 'https':
                // perform https check
                //console.log(`Performing HTTPS check for ${this.proxy.host}:${this.proxy.port}`);
                return this.httpsCheck();
            case 'socks':
                // perform socks check
                //console.log(`Performing SOCKS check for ${this.proxy.host}:${this.proxy.port}`);
                return this.socksCheck();
            case 'socks4':
                // perform socks4 check
                //console.log(`Performing SOCKS4 check for ${this.proxy.host}:${this.proxy.port}`);
                return this.socks4Check();
            case 'socks5':
                // perform socks5 check
                //console.log(`Performing SOCKS5 check for ${this.proxy.host}:${this.proxy.port}`);
                return this.socks5Check();
            case 'premium':
                // perform premium check
                //console.log(`Performing PREMIUM check for ${this.proxy.host}:${this.proxy.port}`);
                return this.premiumCheck();
            default:
                return false;
        }
    }

    async isUsable() {
        this.is_valid = await this.check();

        return this.is_valid;
    }
}

class ProxyHandler {
    constructor() {
        this.extractedProxies = {
            http: [],
            https: [],
            socks: [],
            socks4: [],
            socks5: [],
            premium: [],
        };
        // For Check:
        this.useuableProxies = {
            http: [],
            https: [],
            socks: [],
            socks4: [],
            socks5: [],
            premium: [],
        };
        this.check_proxies = config.proxyOptions.checkProxys;
        this.max_workers = 300;
        this.proxy_scrape = config.proxyOptions.scrape;
    }

    grabProxy(type) {
        if (type) {
            let randomProxy = this.useuableProxies[type][Math.floor(Math.random() * this.useuableProxies[type].length)];
            return new ProxyAgent(`${config.proxyOptions.usePremium && type === 'premium' ? config.proxyOptions.premiumProxyType : type}://${randomProxy}`);
        } else {
            let proxyTypes = Object.keys(this.useuableProxies).filter(t => t !== 'premium' && this.useuableProxies[t] && this.useuableProxies[t].length > 0);
            if (proxyTypes.length === 0) {
                return this.grabProxy();
            }
            let randomType = proxyTypes[Math.floor(Math.random() * proxyTypes.length)];
            let randomProxy = this.useuableProxies[randomType][Math.floor(Math.random() * this.useuableProxies[randomType].length)];
            return new ProxyAgent(`${randomType}://${randomProxy}`);
        }
    }    

    async proxyScrape() {
        let totalProxiesScraped = 0;
        let totalProxiesParsed = 0;

        let scrapers = Sources.map(source => new Scraper(source));

        let results = await Promise.all(scrapers.map(scraper => scraper.initialize()));

        let source_states = results.map((result, i) => {
            return {
                "id": Sources[i].id,
                "url": Sources[i].url,
                "protocol": Sources[i].protocol,
                ...result
            };
        });

        source_states.forEach(state => {
            if (state.isSucceed && state.proxiesRes.length > 0) {
                totalProxiesScraped += state.proxiesRes.length;
                state.proxiesRes.forEach(proxy => {
                    this.extractedProxies[state.protocol].push(proxy);
                });
            }
        });

        log.green(`[Xero-Bots]: ${totalProxiesScraped} proxies successfully scraped.`);

        if (this.check_proxies) {
            const limit = pLimit(this.max_workers);

            const promises = [];
            Object.keys(this.extractedProxies).forEach(proxyProtocol => {
                this.extractedProxies[proxyProtocol].forEach(proxy => {
                    const { ip, port, protocol } = proxy;
                    promises.push(limit(async () => {
                        const checker = new Checker(ip, port, protocol);
                        if (await checker.isUsable()) {
                            this.useuableProxies[proxyProtocol].push(`${checker.ip}:${checker.port}`);
                            totalProxiesParsed++;
                        }
                    }));
                });
            });

            await Promise.all(promises);
        } else {
            Object.keys(this.extractedProxies).forEach(proxyProtocol => {
                this.extractedProxies[proxyProtocol].forEach(proxy => {
                    this.useuableProxies[proxyProtocol].push(`${proxy.ip}:${proxy.port}`);
                    totalProxiesParsed++;
                });
            });
        }

        //
        this.useuableProxies = Object.fromEntries(
            Object.entries(this.useuableProxies).filter(([key, value]) => value.length > 0)
        );
        //

        log.green(`[Xero-Bots]: ${totalProxiesParsed} proxies parsed successfully.`);

        return this.useuableProxies;
    }

    async proxyHandler() {
        log.yellow(`Proxy Handler started. Scrape: ${this.proxy_scrape}`);
        if (this.proxy_scrape) {
            return await this.proxyScrape();
        } else {
            throw new Error('Implement the if statement in case proxy scrape is not true.');
        }
    }
}

export default new ProxyHandler();