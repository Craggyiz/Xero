import qs from 'querystring';
import request from 'request';
import proxyHandler from '../../proxys/proxyHandler.js';

export class RecaptchaSolver {
    constructor() {
        this.characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        this.recaptchaVersion = 'khH7Ei3klcvfRI74FvDcfuOo'; // Invisible latest
    }

    generateFakeCallbackParam() {
        let fakeCallbackParam = '';

        for (let i = 0; i < 10; i++) {
            fakeCallbackParam += this.characters.charAt(Math.floor(Math.random() * this.characters.length));
        }

        return fakeCallbackParam;
    }

    async requestAnchor(anchorUrlbuild, proxy) {
        return new Promise((resolve, reject) => {
            request.get(anchorUrlbuild, { timeout: 15000, agent: proxy }, (err, _req, body) => {
                if (err) {
                    reject(`Error: ${err}`);
                } else {
                    resolve(body);
                }
            });
        });
    }

    async requestReload(url, form, proxy) {
        return new Promise((resolve, reject) => {
            request.post(url, { form: form, timeout: 15000, agent: proxy }, (err, _req, body) => {
                if (err) {
                    reject(`Error: ${err}`);
                } else {
                    resolve(body);
                }
            });
        });
    }

    extractToken(body, separator, errorMessage) {
        const token = body.split(separator)[1]?.split('"')[0];
        if (!token) {
            throw new Error(errorMessage);
        }
        return token;
    }

    encodeSiteOrigin(origin) {
        const httpsDefaultPort = ":443";

        if (!origin.endsWith(httpsDefaultPort)) {
            origin += httpsDefaultPort;
        }

        const encoded = Buffer.from(origin).toString('base64');

        return encoded;
    }

    async solveRecaptchaV2(origin, siteKey, action, proxy) {
        let token2 = null;

        try {
            const encodedSiteOrigin = this.encodeSiteOrigin(origin);
            var randomProxy = proxy || proxyHandler.grabProxy();

            var ar = '1';
            var hostLanguage = 'en';
            var recaptchaType = 'invisible';
            var callbackFunction = this.generateFakeCallbackParam();

            var anchorUrlbuild = `https://www.google.com/recaptcha/api2/anchor?ar=${ar}&k=${siteKey}&co=${encodedSiteOrigin}&hl=${hostLanguage}&v=${this.recaptchaVersion}&size=${recaptchaType}&cb=${callbackFunction}`;

            const body1 = await this.requestAnchor(anchorUrlbuild, randomProxy);

            if (!body1) {
                throw new Error('Error: empty body');
            }

            const token1 = this.extractToken(body1, 'recaptcha-token" value="', 'Error: token1 not found');

            const payload = {
                "v": this.recaptchaVersion,
                "reason": "q",
                "c": token1,
                "k": siteKey,
                "co": encodedSiteOrigin,
                "hl": "en",
                "size": "invisible",
                "chr": '[95,88,25]',
                "vh": '13599012192',
                "bg": 'transparent'
            };

            if (action) {
                payload['action'] = action;
            }

            const form = qs.stringify(payload);

            const body2 = await this.requestReload(`https://www.google.com/recaptcha/api2/reload?k=${siteKey}`, form, randomProxy);

            if (!body2) {
                throw new Error('Error: empty body');
            }

            token2 = this.extractToken(body2, '"rresp","', 'Error: token2 not found');

        } catch (err) {
            // Usually proxy timeout.
            // console.error(err);
        }

        return token2;
    }
}