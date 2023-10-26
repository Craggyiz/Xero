export default {
    serverOptions: {
        useSSL: false,
        obfuscateClientCode: true,
        websitePort: 3000
    },

    proxyOptions: {
        scrape: true,
        checkProxys: false,
        usePremium: false,
        premiumProxyType: 'http',
    },

    botOptions: {
        accounts: ['', '', ''],
        botNames: ['Xero-Bots', 'xerobots.xyz', 'Made by Tatsuya'],
        getName() { return this.botNames[Math.floor(Math.random() * this.botNames.length)] }
    }
}