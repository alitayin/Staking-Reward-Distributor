"use strict";
/*

The values for the various fork coins can be found in these files:

property       filename                  varname                           notes
------------------------------------------------------------------------------------------------------------------------
messagePrefix  src/validation.cpp        strMessageMagic                   Format `${CoinName} Signed Message`
bech32_hrp     src/chainparams.cpp       bech32_hrp                        Only for some networks
bip32.public   src/chainparams.cpp       base58Prefixes[EXT_PUBLIC_KEY]    Mainnets have same value, testnets have same value
bip32.private  src/chainparams.cpp       base58Prefixes[EXT_SECRET_KEY]    Mainnets have same value, testnets have same value
pubKeyHash     src/chainparams.cpp       base58Prefixes[PUBKEY_ADDRESS]
scriptHash     src/chainparams.cpp       base58Prefixes[SCRIPT_ADDRESS]
wif            src/chainparams.cpp       base58Prefixes[SECRET_KEY]        Testnets have same value
forkId         src/script/interpreter.h  FORKID_*

*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportsTaproot = exports.supportsSegwit = exports.isValidNetwork = exports.isZcash = exports.isLitecoin = exports.isDogecoin = exports.isDash = exports.isBitcoinSV = exports.isBitcoinGold = exports.isECash = exports.isBitcoinCash = exports.isBitcoin = exports.getTestnet = exports.isSameCoin = exports.isTestnet = exports.isMainnet = exports.getMainnet = exports.getNetworkName = exports.getNetworkList = exports.networks = void 0;
/**
 * @deprecated
 */
const coins = {
    /*
     * The original Bitcoin Cash was renamed to bitcoin-abc, and bitcoin-cash-node forked from it.
     * Later, bitcoin-abc is rebranded to ecash. Here, 'bch' corresponds to bitcoin-cash-node, and
     * 'bcha' corresponds to ecash. Ref: https://github.com/bitcoin-cash-node/bitcoin-cash-node
     * */
    BCH: 'bch',
    BCHA: 'bcha',
    BSV: 'bsv',
    BTC: 'btc',
    BTG: 'btg',
    LTC: 'ltc',
    ZEC: 'zec',
    DASH: 'dash',
    DOGE: 'doge',
};
function getDefaultBip32Mainnet() {
    return {
        // base58 'xpub'
        public: 0x0488b21e,
        // base58 'xprv'
        private: 0x0488ade4,
    };
}
function getDefaultBip32Testnet() {
    return {
        // base58 'tpub'
        public: 0x043587cf,
        // base58 'tprv'
        private: 0x04358394,
    };
}
exports.networks = {
    // https://github.com/bitcoin/bitcoin/blob/master/src/validation.cpp
    // https://github.com/bitcoin/bitcoin/blob/master/src/chainparams.cpp
    bitcoin: {
        messagePrefix: '\x18Bitcoin Signed Message:\n',
        bech32: 'bc',
        bip32: getDefaultBip32Mainnet(),
        pubKeyHash: 0x00,
        scriptHash: 0x05,
        wif: 0x80,
        coin: coins.BTC,
    },
    testnet: {
        messagePrefix: '\x18Bitcoin Signed Message:\n',
        bech32: 'tb',
        bip32: getDefaultBip32Testnet(),
        pubKeyHash: 0x6f,
        scriptHash: 0xc4,
        wif: 0xef,
        coin: coins.BTC,
    },
    // https://github.com/bitcoin-cash-node/bitcoin-cash-node/blob/master/src/validation.cpp
    // https://github.com/bitcoin-cash-node/bitcoin-cash-node/blob/master/src/chainparams.cpp
    // https://github.com/bitcoincashorg/bitcoincash.org/blob/master/spec/cashaddr.md
    bitcoincash: {
        messagePrefix: '\x18Bitcoin Signed Message:\n',
        bip32: getDefaultBip32Mainnet(),
        pubKeyHash: 0x00,
        scriptHash: 0x05,
        wif: 0x80,
        coin: coins.BCH,
        forkId: 0x00,
        cashAddr: {
            prefix: 'bitcoincash',
            pubKeyHash: 0x00,
            scriptHash: 0x08,
        },
    },
    bitcoincashTestnet: {
        messagePrefix: '\x18Bitcoin Signed Message:\n',
        bip32: getDefaultBip32Testnet(),
        pubKeyHash: 0x6f,
        scriptHash: 0xc4,
        wif: 0xef,
        coin: coins.BCH,
        cashAddr: {
            prefix: 'bchtest',
            pubKeyHash: 0x00,
            scriptHash: 0x08,
        },
    },
    // https://github.com/BTCGPU/BTCGPU/blob/master/src/validation.cpp
    // https://github.com/BTCGPU/BTCGPU/blob/master/src/chainparams.cpp
    // https://github.com/BTCGPU/BTCGPU/blob/master/src/script/interpreter.h
    bitcoingold: {
        messagePrefix: '\x18Bitcoin Gold Signed Message:\n',
        bech32: 'btg',
        bip32: getDefaultBip32Mainnet(),
        pubKeyHash: 0x26,
        scriptHash: 0x17,
        wif: 0x80,
        forkId: 79,
        coin: coins.BTG,
    },
    bitcoingoldTestnet: {
        messagePrefix: '\x18Bitcoin Gold Signed Message:\n',
        bech32: 'tbtg',
        bip32: getDefaultBip32Testnet(),
        pubKeyHash: 111,
        scriptHash: 196,
        wif: 0xef,
        forkId: 79,
        coin: coins.BTG,
    },
    // https://github.com/bitcoin-sv/bitcoin-sv/blob/master/src/validation.cpp
    // https://github.com/bitcoin-sv/bitcoin-sv/blob/master/src/chainparams.cpp
    bitcoinsv: {
        messagePrefix: '\x18Bitcoin Signed Message:\n',
        bip32: getDefaultBip32Mainnet(),
        pubKeyHash: 0x00,
        scriptHash: 0x05,
        wif: 0x80,
        coin: coins.BSV,
        forkId: 0x00,
    },
    bitcoinsvTestnet: {
        messagePrefix: '\x18Bitcoin Signed Message:\n',
        bip32: getDefaultBip32Testnet(),
        pubKeyHash: 0x6f,
        scriptHash: 0xc4,
        wif: 0xef,
        coin: coins.BSV,
        forkId: 0x00,
    },
    // https://github.com/dashpay/dash/blob/master/src/validation.cpp
    // https://github.com/dashpay/dash/blob/master/src/chainparams.cpp
    dash: {
        messagePrefix: '\x19DarkCoin Signed Message:\n',
        bip32: getDefaultBip32Mainnet(),
        pubKeyHash: 0x4c,
        scriptHash: 0x10,
        wif: 0xcc,
        coin: coins.DASH,
    },
    dashTest: {
        messagePrefix: '\x19DarkCoin Signed Message:\n',
        bip32: getDefaultBip32Testnet(),
        pubKeyHash: 0x8c,
        scriptHash: 0x13,
        wif: 0xef,
        coin: coins.DASH,
    },
    // https://github.com/dogecoin/dogecoin/blob/master/src/validation.cpp
    // https://github.com/dogecoin/dogecoin/blob/master/src/chainparams.cpp
    // Mainnet bip32 here does not match dogecoin core, this is intended (see BG-53241)
    dogecoin: {
        messagePrefix: '\x19Dogecoin Signed Message:\n',
        bip32: getDefaultBip32Mainnet(),
        pubKeyHash: 0x1e,
        scriptHash: 0x16,
        wif: 0x9e,
        coin: coins.DOGE,
    },
    dogecoinTest: {
        messagePrefix: '\x19Dogecoin Signed Message:\n',
        bip32: getDefaultBip32Testnet(),
        pubKeyHash: 0x71,
        scriptHash: 0xc4,
        wif: 0xf1,
        coin: coins.DOGE,
    },
    // https://github.com/Bitcoin-ABC/bitcoin-abc/blob/master/src/validation.cpp
    // https://github.com/Bitcoin-ABC/bitcoin-abc/blob/master/src/chainparams.cpp
    // https://github.com/Bitcoin-ABC/bitcoin-abc/blob/master/src/util/message.cpp
    ecash: {
        messagePrefix: '\x16eCash Signed Message:\n',
        bip32: getDefaultBip32Mainnet(),
        pubKeyHash: 0x00,
        scriptHash: 0x05,
        wif: 0x80,
        coin: coins.BCHA,
        forkId: 0x00,
        cashAddr: {
            prefix: 'ecash',
            pubKeyHash: 0x00,
            scriptHash: 0x08,
        },
    },
    ecashTest: {
        messagePrefix: '\x16eCash Signed Message:\n',
        bip32: getDefaultBip32Testnet(),
        pubKeyHash: 0x6f,
        scriptHash: 0xc4,
        wif: 0xef,
        coin: coins.BCHA,
        cashAddr: {
            prefix: 'ectest',
            pubKeyHash: 0x00,
            scriptHash: 0x08,
        },
    },
    // https://github.com/litecoin-project/litecoin/blob/master/src/validation.cpp
    // https://github.com/litecoin-project/litecoin/blob/master/src/chainparams.cpp
    litecoin: {
        messagePrefix: '\x19Litecoin Signed Message:\n',
        bech32: 'ltc',
        bip32: getDefaultBip32Mainnet(),
        pubKeyHash: 0x30,
        scriptHash: 0x32,
        wif: 0xb0,
        coin: coins.LTC,
    },
    litecoinTest: {
        messagePrefix: '\x19Litecoin Signed Message:\n',
        bech32: 'tltc',
        bip32: getDefaultBip32Testnet(),
        pubKeyHash: 0x6f,
        scriptHash: 0x3a,
        wif: 0xef,
        coin: coins.LTC,
    },
    // https://github.com/zcash/zcash/blob/master/src/validation.cpp
    // https://github.com/zcash/zcash/blob/master/src/chainparams.cpp
    zcash: {
        messagePrefix: '\x18ZCash Signed Message:\n',
        bip32: getDefaultBip32Mainnet(),
        pubKeyHash: 0x1cb8,
        scriptHash: 0x1cbd,
        wif: 0x80,
        coin: coins.ZEC,
    },
    zcashTest: {
        messagePrefix: '\x18ZCash Signed Message:\n',
        bip32: getDefaultBip32Testnet(),
        pubKeyHash: 0x1d25,
        scriptHash: 0x1cba,
        wif: 0xef,
        coin: coins.ZEC,
    },
};
/**
 * @returns {Network[]} all known networks as array
 */
function getNetworkList() {
    return Object.values(exports.networks);
}
exports.getNetworkList = getNetworkList;
/**
 * @param {Network} network
 * @returns {NetworkName} the name of the network. Returns undefined if network is not a value
 *                        of `networks`
 */
function getNetworkName(network) {
    return Object.keys(exports.networks).find((n) => exports.networks[n] === network);
}
exports.getNetworkName = getNetworkName;
/**
 * @param {Network} network
 * @returns {Object} the mainnet corresponding to a testnet
 */
function getMainnet(network) {
    switch (network) {
        case exports.networks.bitcoin:
        case exports.networks.testnet:
            return exports.networks.bitcoin;
        case exports.networks.bitcoincash:
        case exports.networks.bitcoincashTestnet:
            return exports.networks.bitcoincash;
        case exports.networks.bitcoingold:
        case exports.networks.bitcoingoldTestnet:
            return exports.networks.bitcoingold;
        case exports.networks.bitcoinsv:
        case exports.networks.bitcoinsvTestnet:
            return exports.networks.bitcoinsv;
        case exports.networks.dash:
        case exports.networks.dashTest:
            return exports.networks.dash;
        case exports.networks.ecash:
        case exports.networks.ecashTest:
            return exports.networks.ecash;
        case exports.networks.litecoin:
        case exports.networks.litecoinTest:
            return exports.networks.litecoin;
        case exports.networks.zcash:
        case exports.networks.zcashTest:
            return exports.networks.zcash;
        case exports.networks.dogecoin:
        case exports.networks.dogecoinTest:
            return exports.networks.dogecoin;
    }
    throw new TypeError(`invalid network`);
}
exports.getMainnet = getMainnet;
/**
 * @param {Network} network
 * @returns {boolean} true iff network is a mainnet
 */
function isMainnet(network) {
    return getMainnet(network) === network;
}
exports.isMainnet = isMainnet;
/**
 * @param {Network} network
 * @returns {boolean} true iff network is a testnet
 */
function isTestnet(network) {
    return getMainnet(network) !== network;
}
exports.isTestnet = isTestnet;
/**
 *
 * @param {Network} network
 * @param {Network} otherNetwork
 * @returns {boolean} true iff both networks are for the same coin
 */
function isSameCoin(network, otherNetwork) {
    return getMainnet(network) === getMainnet(otherNetwork);
}
exports.isSameCoin = isSameCoin;
const mainnets = getNetworkList().filter(isMainnet);
const testnets = getNetworkList().filter(isTestnet);
/**
 * Map where keys are mainnet networks and values are testnet networks
 * @type {Map<Network, Network[]>}
 */
const mainnetTestnetPairs = new Map(mainnets.map((m) => [m, testnets.filter((t) => getMainnet(t) === m)]));
/**
 * @param {Network} network
 * @returns {Network|undefined} - The testnet corresponding to a mainnet.
 *                               Returns undefined if a network has no testnet.
 */
function getTestnet(network) {
    if (isTestnet(network)) {
        return network;
    }
    const testnets = mainnetTestnetPairs.get(network);
    if (testnets === undefined) {
        throw new Error(`invalid argument`);
    }
    if (testnets.length === 0) {
        return;
    }
    if (testnets.length === 1) {
        return testnets[0];
    }
    throw new Error(`more than one testnet for ${getNetworkName(network)}`);
}
exports.getTestnet = getTestnet;
/**
 * @param {Network} network
 * @returns {boolean} true iff network bitcoin or testnet
 */
function isBitcoin(network) {
    return getMainnet(network) === exports.networks.bitcoin;
}
exports.isBitcoin = isBitcoin;
/**
 * @param {Network} network
 * @returns {boolean} true iff network is bitcoincash or bitcoincashTestnet
 */
function isBitcoinCash(network) {
    return getMainnet(network) === exports.networks.bitcoincash;
}
exports.isBitcoinCash = isBitcoinCash;
/**
 * @param {Network} network
 * @returns {boolean} true iff network is ecash or ecashTest
 */
function isECash(network) {
    return getMainnet(network) === exports.networks.ecash;
}
exports.isECash = isECash;
/**
 * @param {Network} network
 * @returns {boolean} true iff network is bitcoingold
 */
function isBitcoinGold(network) {
    return getMainnet(network) === exports.networks.bitcoingold;
}
exports.isBitcoinGold = isBitcoinGold;
/**
 * @param {Network} network
 * @returns {boolean} true iff network is bitcoinsv or bitcoinsvTestnet
 */
function isBitcoinSV(network) {
    return getMainnet(network) === exports.networks.bitcoinsv;
}
exports.isBitcoinSV = isBitcoinSV;
/**
 * @param {Network} network
 * @returns {boolean} true iff network is dash or dashTest
 */
function isDash(network) {
    return getMainnet(network) === exports.networks.dash;
}
exports.isDash = isDash;
/**
 * @param {Network} network
 * @returns {boolean} true iff network is dogecoin or dogecoinTest
 */
function isDogecoin(network) {
    return getMainnet(network) === exports.networks.dogecoin;
}
exports.isDogecoin = isDogecoin;
/**
 * @param {Network} network
 * @returns {boolean} true iff network is litecoin or litecoinTest
 */
function isLitecoin(network) {
    return getMainnet(network) === exports.networks.litecoin;
}
exports.isLitecoin = isLitecoin;
/**
 * @param {Network} network
 * @returns {boolean} true iff network is zcash or zcashTest
 */
function isZcash(network) {
    return getMainnet(network) === exports.networks.zcash;
}
exports.isZcash = isZcash;
/**
 * @param {unknown} network
 * @returns {boolean} returns true iff network is any of the network stated in the argument
 */
function isValidNetwork(network) {
    return getNetworkList().includes(network);
}
exports.isValidNetwork = isValidNetwork;
function supportsSegwit(network) {
    return [exports.networks.bitcoin, exports.networks.litecoin, exports.networks.bitcoingold].includes(getMainnet(network));
}
exports.supportsSegwit = supportsSegwit;
function supportsTaproot(network) {
    return getMainnet(network) === exports.networks.bitcoin;
}
exports.supportsTaproot = supportsTaproot;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmV0d29ya3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvbmV0d29ya3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7Ozs7Ozs7RUFlRTs7O0FBRUY7O0dBRUc7QUFDSCxNQUFNLEtBQUssR0FBRztJQUNaOzs7O1NBSUs7SUFDTCxHQUFHLEVBQUUsS0FBSztJQUNWLElBQUksRUFBRSxNQUFNO0lBQ1osR0FBRyxFQUFFLEtBQUs7SUFDVixHQUFHLEVBQUUsS0FBSztJQUNWLEdBQUcsRUFBRSxLQUFLO0lBQ1YsR0FBRyxFQUFFLEtBQUs7SUFDVixHQUFHLEVBQUUsS0FBSztJQUNWLElBQUksRUFBRSxNQUFNO0lBQ1osSUFBSSxFQUFFLE1BQU07Q0FDSixDQUFDO0FBNENYLFNBQVMsc0JBQXNCO0lBQzdCLE9BQU87UUFDTCxnQkFBZ0I7UUFDaEIsTUFBTSxFQUFFLFVBQVU7UUFDbEIsZ0JBQWdCO1FBQ2hCLE9BQU8sRUFBRSxVQUFVO0tBQ3BCLENBQUM7QUFDSixDQUFDO0FBRUQsU0FBUyxzQkFBc0I7SUFDN0IsT0FBTztRQUNMLGdCQUFnQjtRQUNoQixNQUFNLEVBQUUsVUFBVTtRQUNsQixnQkFBZ0I7UUFDaEIsT0FBTyxFQUFFLFVBQVU7S0FDcEIsQ0FBQztBQUNKLENBQUM7QUFFWSxRQUFBLFFBQVEsR0FBaUM7SUFDcEQsb0VBQW9FO0lBQ3BFLHFFQUFxRTtJQUNyRSxPQUFPLEVBQUU7UUFDUCxhQUFhLEVBQUUsK0JBQStCO1FBQzlDLE1BQU0sRUFBRSxJQUFJO1FBQ1osS0FBSyxFQUFFLHNCQUFzQixFQUFFO1FBQy9CLFVBQVUsRUFBRSxJQUFJO1FBQ2hCLFVBQVUsRUFBRSxJQUFJO1FBQ2hCLEdBQUcsRUFBRSxJQUFJO1FBQ1QsSUFBSSxFQUFFLEtBQUssQ0FBQyxHQUFHO0tBQ2hCO0lBQ0QsT0FBTyxFQUFFO1FBQ1AsYUFBYSxFQUFFLCtCQUErQjtRQUM5QyxNQUFNLEVBQUUsSUFBSTtRQUNaLEtB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Q0FBQyxXQUFXLENBQWUsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7QUFDbEgsQ0FBQztBQUZELHdDQUVDO0FBRUQsU0FBZ0IsZUFBZSxDQUFDLE9BQWdCO0lBQzlDLE9BQU8sVUFBVSxDQUFDLE9BQU8sQ0FBQyxLQUFLLGdCQUFRLENBQUMsT0FBTyxDQUFDO0FBQ2xELENBQUM7QUFGRCwwQ0FFQyIsInNvdXJjZXNDb250ZW50IjpbIi8qXG5cblRoZSB2YWx1ZXMgZm9yIHRoZSB2YXJpb3VzIGZvcmsgY29pbnMgY2FuIGJlIGZvdW5kIGluIHRoZXNlIGZpbGVzOlxuXG5wcm9wZXJ0eSAgICAgICBmaWxlbmFtZSAgICAgICAgICAgICAgICAgIHZhcm5hbWUgICAgICAgICAgICAgICAgICAgICAgICAgICBub3Rlc1xuLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5tZXNzYWdlUHJlZml4ICBzcmMvdmFsaWRhdGlvbi5jcHAgICAgICAgIHN0ck1lc3NhZ2VNYWdpYyAgICAgICAgICAgICAgICAgICBGb3JtYXQgYCR7Q29pbk5hbWV9IFNpZ25lZCBNZXNzYWdlYFxuYmVjaDMyX2hycCAgICAgc3JjL2NoYWlucGFyYW1zLmNwcCAgICAgICBiZWNoMzJfaHJwICAgICAgICAgICAgICAgICAgICAgICAgT25seSBmb3Igc29tZSBuZXR3b3Jrc1xuYmlwMzIucHVibGljICAgc3JjL2NoYWlucGFyYW1zLmNwcCAgICAgICBiYXNlNThQcmVmaXhlc1tFWFRfUFVCTElDX0tFWV0gICAgTWFpbm5ldHMgaGF2ZSBzYW1lIHZhbHVlLCB0ZXN0bmV0cyBoYXZlIHNhbWUgdmFsdWVcbmJpcDMyLnByaXZhdGUgIHNyYy9jaGFpbnBhcmFtcy5jcHAgICAgICAgYmFzZTU4UHJlZml4ZXNbRVhUX1NFQ1JFVF9LRVldICAgIE1haW5uZXRzIGhhdmUgc2FtZSB2YWx1ZSwgdGVzdG5ldHMgaGF2ZSBzYW1lIHZhbHVlXG5wdWJLZXlIYXNoICAgICBzcmMvY2hhaW5wYXJhbXMuY3BwICAgICAgIGJhc2U1OFByZWZpeGVzW1BVQktFWV9BRERSRVNTXVxuc2NyaXB0SGFzaCAgICAgc3JjL2NoYWlucGFyYW1zLmNwcCAgICAgICBiYXNlNThQcmVmaXhlc1tTQ1JJUFRfQUREUkVTU11cbndpZiAgICAgICAgICAgIHNyYy9jaGFpbnBhcmFtcy5jcHAgICAgICAgYmFzZTU4UHJlZml4ZXNbU0VDUkVUX0tFWV0gICAgICAgIFRlc3RuZXRzIGhhdmUgc2FtZSB2YWx1ZVxuZm9ya0lkICAgICAgICAgc3JjL3NjcmlwdC9pbnRlcnByZXRlci5oICBGT1JLSURfKlxuXG4qL1xuXG4vKipcbiAqIEBkZXByZWNhdGVkXG4gKi9cbmNvbnN0IGNvaW5zID0ge1xuICAvKlxuICAgKiBUaGUgb3JpZ2luYWwgQml0Y29pbiBDYXNoIHdhcyByZW5hbWVkIHRvIGJpdGNvaW4tYWJjLCBhbmQgYml0Y29pbi1jYXNoLW5vZGUgZm9ya2VkIGZyb20gaXQuXG4gICAqIExhdGVyLCBiaXRjb2luLWFiYyBpcyByZWJyYW5kZWQgdG8gZWNhc2guIEhlcmUsICdiY2gnIGNvcnJlc3BvbmRzIHRvIGJpdGNvaW4tY2FzaC1ub2RlLCBhbmRcbiAgICogJ2JjaGEnIGNvcnJlc3BvbmRzIHRvIGVjYXNoLiBSZWY6IGh0dHBzOi8vZ2l0aHViLmNvbS9iaXRjb2luLWNhc2gtbm9kZS9iaXRjb2luLWNhc2gtbm9kZVxuICAgKiAqL1xuICBCQ0g6ICdiY2gnLFxuICBCQ0hBOiAnYmNoYScsXG4gIEJTVjogJ2JzdicsXG4gIEJUQzogJ2J0YycsXG4gIEJURzogJ2J0ZycsXG4gIExUQzogJ2x0YycsXG4gIFpFQzogJ3plYycsXG4gIERBU0g6ICdkYXNoJyxcbiAgRE9HRTogJ2RvZ2UnLFxufSBhcyBjb25zdDtcblxuZXhwb3J0IHR5cGUgTmV0d29ya05hbWUgPVxuICB8ICdiaXRjb2luJ1xuICB8ICd0ZXN0bmV0J1xuICB8ICdiaXRjb2luY2FzaCdcbiAgfCAnYml0Y29pbmNhc2hUZXN0bmV0J1xuICB8ICdlY2FzaCdcbiAgfCAnZWNhc2hUZXN0J1xuICB8ICdiaXRjb2luZ29sZCdcbiAgfCAnYml0Y29pbmdvbGRUZXN0bmV0J1xuICB8ICdiaXRjb2luc3YnXG4gIHwgJ2JpdGNvaW5zdlRlc3RuZXQnXG4gIHwgJ2Rhc2gnXG4gIHwgJ2Rhc2hUZXN0J1xuICB8ICdkb2dlY29pbidcbiAgfCAnZG9nZWNvaW5UZXN0J1xuICB8ICdsaXRlY29pbidcbiAgfCAnbGl0ZWNvaW5UZXN0J1xuICB8ICd6Y2FzaCdcbiAgfCAnemNhc2hUZXN0JztcblxuZXhwb3J0IHR5cGUgTmV0d29yayA9IHtcbiAgbWVzc2FnZVByZWZpeDogc3RyaW5nO1xuICBwdWJLZXlIYXNoOiBudW1iZXI7XG4gIHNjcmlwdEhhc2g6IG51bWJlcjtcbiAgd2lmOiBudW1iZXI7XG4gIGJpcDMyOiB7XG4gICAgcHVibGljOiBudW1iZXI7XG4gICAgcHJpdmF0ZTogbnVtYmVyO1xuICB9O1xuICBjYXNoQWRkcj86IHtcbiAgICBwcmVmaXg6IHN0cmluZztcbiAgICBwdWJLZXlIYXNoOiBudW1iZXI7XG4gICAgc2NyaXB0SGFzaDogbnVtYmVyO1xuICB9O1xuICBiZWNoMzI/OiBzdHJpbmc7XG4gIGZvcmtJZD86IG51bWJlcjtcbiAgLyoqXG4gICAqIEBkZXByZWNhdGVkXG4gICAqL1xuICBjb2luOiBzdHJpbmc7XG59O1xuXG5mdW5jdGlvbiBnZXREZWZhdWx0QmlwMzJNYWlubmV0KCkge1xuICByZXR1cm4ge1xuICAgIC8vIGJhc2U1OCAneHB1YidcbiAgICBwdWJsaWM6IDB4MDQ4OGIyMWUsXG4gICAgLy8gYmFzZTU4ICd4cHJ2J1xuICAgIHByaXZhdGU6IDB4MDQ4OGFkZTQsXG4gIH07XG59XG5cbmZ1bmN0aW9uIGdldERlZmF1bHRCaXAzMlRlc3RuZXQoKSB7XG4gIHJldHVybiB7XG4gICAgLy8gYmFzZTU4ICd0cHViJ1xuICAgIHB1YmxpYzogMHgwNDM1ODdjZixcbiAgICAvLyBiYXNlNTggJ3RwcnYnXG4gICAgcHJpdmF0ZTogMHgwNDM1ODM5NCxcbiAgfTtcbn1cblxuZXhwb3J0IGNvbnN0IG5ldHdvcmtzOiBSZWNvcmQ8TmV0d29ya05hbWUsIE5ldHdvcms+ID0ge1xuICAvLyBodHRwczovL2dpdGh1Yi5jb20vYml0Y29pbi9iaXRjb2luL2Jsb2IvbWFzdGVyL3NyYy92YWxpZGF0aW9uLmNwcFxuICAvLyBodHRwczovL2dpdGh1Yi5jb20vYml0Y29pbi9iaXRjb2luL2Jsb2IvbWFzdGVyL3NyYy9jaGFpbnBhcmFtcy5jcHBcbiAgYml0Y29pbjoge1xuICAgIG1lc3NhZ2VQcmVmaXg6ICdcXHgxOEJpdGNvaW4gU2lnbmVkIE1lc3NhZ2U6XFxuJyxcbiAgICBiZWNoMzI6ICdiYycsXG4gICAgYmlwMzI6IGdldERlZmF1bHRCaXAzMk1haW5uZXQoKSxcbiAgICBwdWJLZXlIYXNoOiAweDAwLFxuICAgIHNjcmlwdEhhc2g6IDB4MDUsXG4gICAgd2lmOiAweDgwLFxuICAgIGNvaW46IGNvaW5zLkJUQyxcbiAgfSxcbiAgdGVzdG5ldDoge1xuICAgIG1lc3NhZ2VQcmVmaXg6ICdcXHgxOEJpdGNvaW4gU2lnbmVkIE1lc3NhZ2U6XFxuJyxcbiAgICBiZWNoMzI6ICd0YicsXG4gICAgYmlwMzI6IGdldERlZmF1bHRCaXAzMlRlc3RuZXQoKSxcbiAgICBwdWJLZXlIYXNoOiAweDZmLFxuICAgIHNjcmlwdEhhc2g6IDB4YzQsXG4gICAgd2lmOiAweGVmLFxuICAgIGNvaW46IGNvaW5zLkJUQyxcbiAgfSxcblxuICAvLyBodHRwczovL2dpdGh1Yi5jb20vYml0Y29pbi1jYXNoLW5vZGUvYml0Y29pbi1jYXNoLW5vZGUvYmxvYi9tYXN0ZXIvc3JjL3ZhbGlkYXRpb24uY3BwXG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9iaXRjb2luLWNhc2gtbm9kZS9iaXRjb2luLWNhc2gtbm9kZS9ibG9iL21hc3Rlci9zcmMvY2hhaW5wYXJhbXMuY3BwXG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9iaXRjb2luY2FzaG9yZy9iaXRjb2luY2FzaC5vcmcvYmxvYi9tYXN0ZXIvc3BlYy9jYXNoYWRkci5tZFxuICBiaXRjb2luY2FzaDoge1xuICAgIG1lc3NhZ2VQcmVmaXg6ICdcXHgxOEJpdGNvaW4gU2lnbmVkIE1lc3NhZ2U6XFxuJyxcbiAgICBiaXAzMjogZ2V0RGVmYXVsdEJpcDMyTWFpbm5ldCgpLFxuICAgIHB1YktleUhhc2g6IDB4MDAsXG4gICAgc2NyaXB0SGFzaDogMHgwNSxcbiAgICB3aWY6IDB4ODAsXG4gICAgY29pbjogY29pbnMuQkNILFxuICAgIGZvcmtJZDogMHgwMCxcbiAgICBjYXNoQWRkcjoge1xuICAgICAgcHJlZml4OiAnYml0Y29pbmNhc2gnLFxuICAgICAgcHViS2V5SGFzaDogMHgwMCxcbiAgICAgIHNjcmlwdEhhc2g6IDB4MDgsXG4gICAgfSxcbiAgfSxcbiAgYml0Y29pbmNhc2hUZXN0bmV0OiB7XG4gICAgbWVzc2FnZVByZWZpeDogJ1xceDE4Qml0Y29pbiBTaWduZWQgTWVzc2FnZTpcXG4nLFxuICAgIGJpcDMyOiBnZXREZWZhdWx0QmlwMzJUZXN0bmV0KCksXG4gICAgcHViS2V5SGFzaDogMHg2ZixcbiAgICBzY3JpcHRIYXNoOiAweGM0LFxuICAgIHdpZjogMHhlZixcbiAgICBjb2luOiBjb2lucy5CQ0gsXG4gICAgY2FzaEFkZHI6IHtcbiAgICAgIHByZWZpeDogJ2JjaHRlc3QnLFxuICAgICAgcHViS2V5SGFzaDogMHgwMCxcbiAgICAgIHNjcmlwdEhhc2g6IDB4MDgsXG4gICAgfSxcbiAgfSxcblxuICAvLyBodHRwczovL2dpdGh1Yi5jb20vQlRDR1BVL0JUQ0dQVS9ibG9iL21hc3Rlci9zcmMvdmFsaWRhdGlvbi5jcHBcbiAgLy8gaHR0cHM6Ly9naXRodWIuY29tL0JUQ0dQVS9CVENHUFUvYmxvYi9tYXN0ZXIvc3JjL2NoYWlucGFyYW1zLmNwcFxuICAvLyBodHRwczovL2dpdGh1Yi5jb20vQlRDR1BVL0JUQ0dQVS9ibG9iL21hc3Rlci9zcmMvc2NyaXB0L2ludGVycHJldGVyLmhcbiAgYml0Y29pbmdvbGQ6IHtcbiAgICBtZXNzYWdlUHJlZml4OiAnXFx4MThCaXRjb2luIEdvbGQgU2lnbmVkIE1lc3NhZ2U6XFxuJyxcbiAgICBiZWNoMzI6ICdidGcnLFxuICAgIGJpcDMyOiBnZXREZWZhdWx0QmlwMzJNYWlubmV0KCksXG4gICAgcHViS2V5SGFzaDogMHgyNixcbiAgICBzY3JpcHRIYXNoOiAweDE3LFxuICAgIHdpZjogMHg4MCxcbiAgICBmb3JrSWQ6IDc5LFxuICAgIGNvaW46IGNvaW5zLkJURyxcbiAgfSxcbiAgYml0Y29pbmdvbGRUZXN0bmV0OiB7XG4gICAgbWVzc2FnZVByZWZpeDogJ1xceDE4Qml0Y29pbiBHb2xkIFNpZ25lZCBNZXNzYWdlOlxcbicsXG4gICAgYmVjaDMyOiAndGJ0ZycsXG4gICAgYmlwMzI6IGdldERlZmF1bHRCaXAzMlRlc3RuZXQoKSxcbiAgICBwdWJLZXlIYXNoOiAxMTEsXG4gICAgc2NyaXB0SGFzaDogMTk2LFxuICAgIHdpZjogMHhlZixcbiAgICBmb3JrSWQ6IDc5LFxuICAgIGNvaW46IGNvaW5zLkJURyxcbiAgfSxcblxuICAvLyBodHRwczovL2dpdGh1Yi5jb20vYml0Y29pbi1zdi9iaXRjb2luLXN2L2Jsb2IvbWFzdGVyL3NyYy92YWxpZGF0aW9uLmNwcFxuICAvLyBodHRwczovL2dpdGh1Yi5jb20vYml0Y29pbi1zdi9iaXRjb2luLXN2L2Jsb2IvbWFzdGVyL3NyYy9jaGFpbnBhcmFtcy5jcHBcbiAgYml0Y29pbnN2OiB7XG4gICAgbWVzc2FnZVByZWZpeDogJ1xceDE4Qml0Y29pbiBTaWduZWQgTWVzc2FnZTpcXG4nLFxuICAgIGJpcDMyOiBnZXREZWZhdWx0QmlwMzJNYWlubmV0KCksXG4gICAgcHViS2V5SGFzaDogMHgwMCxcbiAgICBzY3JpcHRIYXNoOiAweDA1LFxuICAgIHdpZjogMHg4MCxcbiAgICBjb2luOiBjb2lucy5CU1YsXG4gICAgZm9ya0lkOiAweDAwLFxuICB9LFxuICBiaXRjb2luc3ZUZXN0bmV0OiB7XG4gICAgbWVzc2FnZVByZWZpeDogJ1xceDE4Qml0Y29pbiBTaWduZWQgTWVzc2FnZTpcXG4nLFxuICAgIGJpcDMyOiBnZXREZWZhdWx0QmlwMzJUZXN0bmV0KCksXG4gICAgcHViS2V5SGFzaDogMHg2ZixcbiAgICBzY3JpcHRIYXNoOiAweGM0LFxuICAgIHdpZjogMHhlZixcbiAgICBjb2luOiBjb2lucy5CU1YsXG4gICAgZm9ya0lkOiAweDAwLFxuICB9LFxuXG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9kYXNocGF5L2Rhc2gvYmxvYi9tYXN0ZXIvc3JjL3ZhbGlkYXRpb24uY3BwXG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9kYXNocGF5L2Rhc2gvYmxvYi9tYXN0ZXIvc3JjL2NoYWlucGFyYW1zLmNwcFxuICBkYXNoOiB7XG4gICAgbWVzc2FnZVByZWZpeDogJ1xceDE5RGFya0NvaW4gU2lnbmVkIE1lc3NhZ2U6XFxuJyxcbiAgICBiaXAzMjogZ2V0RGVmYXVsdEJpcDMyTWFpbm5ldCgpLFxuICAgIHB1YktleUhhc2g6IDB4NGMsXG4gICAgc2NyaXB0SGFzaDogMHgxMCxcbiAgICB3aWY6IDB4Y2MsXG4gICAgY29pbjogY29pbnMuREFTSCxcbiAgfSxcbiAgZGFzaFRlc3Q6IHtcbiAgICBtZXNzYWdlUHJlZml4OiAnXFx4MTlEYXJrQ29pbiBTaWduZWQgTWVzc2FnZTpcXG4nLFxuICAgIGJpcDMyOiBnZXREZWZhdWx0QmlwMzJUZXN0bmV0KCksXG4gICAgcHViS2V5SGFzaDogMHg4YyxcbiAgICBzY3JpcHRIYXNoOiAweDEzLFxuICAgIHdpZjogMHhlZixcbiAgICBjb2luOiBjb2lucy5EQVNILFxuICB9LFxuXG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9kb2dlY29pbi9kb2dlY29pbi9ibG9iL21hc3Rlci9zcmMvdmFsaWRhdGlvbi5jcHBcbiAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2RvZ2Vjb2luL2RvZ2Vjb2luL2Jsb2IvbWFzdGVyL3NyYy9jaGFpbnBhcmFtcy5jcHBcbiAgLy8gTWFpbm5ldCBiaXAzMiBoZXJlIGRvZXMgbm90IG1hdGNoIGRvZ2Vjb2luIGNvcmUsIHRoaXMgaXMgaW50ZW5kZWQgKHNlZSBCRy01MzI0MSlcbiAgZG9nZWNvaW46IHtcbiAgICBtZXNzYWdlUHJlZml4OiAnXFx4MTlEb2dlY29pbiBTaWduZWQgTWVzc2FnZTpcXG4nLFxuICAgIGJpcDMyOiBnZXREZWZhdWx0QmlwMzJNYWlubmV0KCksXG4gICAgcHViS2V5SGFzaDogMHgxZSxcbiAgICBzY3JpcHRIYXNoOiAweDE2LFxuICAgIHdpZjogMHg5ZSxcbiAgICBjb2luOiBjb2lucy5ET0dFLFxuICB9LFxuICBkb2dlY29pblRlc3Q6IHtcbiAgICBtZXNzYWdlUHJlZml4OiAnXFx4MTlEb2dlY29pbiBTaWduZWQgTWVzc2FnZTpcXG4nLFxuICAgIGJpcDMyOiBnZXREZWZhdWx0QmlwMzJUZXN0bmV0KCksXG4gICAgcHViS2V5SGFzaDogMHg3MSxcbiAgICBzY3JpcHRIYXNoOiAweGM0LFxuICAgIHdpZjogMHhmMSxcbiAgICBjb2luOiBjb2lucy5ET0dFLFxuICB9LFxuXG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9CaXRjb2luLUFCQy9iaXRjb2luLWFiYy9ibG9iL21hc3Rlci9zcmMvdmFsaWRhdGlvbi5jcHBcbiAgLy8gaHR0cHM6Ly9naXRodWIuY29tL0JpdGNvaW4tQUJDL2JpdGNvaW4tYWJjL2Jsb2IvbWFzdGVyL3NyYy9jaGFpbnBhcmFtcy5jcHBcbiAgLy8gaHR0cHM6Ly9naXRodWIuY29tL0JpdGNvaW4tQUJDL2JpdGNvaW4tYWJjL2Jsb2IvbWFzdGVyL3NyYy91dGlsL21lc3NhZ2UuY3BwXG4gIGVjYXNoOiB7XG4gICAgbWVzc2FnZVByZWZpeDogJ1xceDE2ZUNhc2ggU2lnbmVkIE1lc3NhZ2U6XFxuJyxcbiAgICBiaXAzMjogZ2V0RGVmYXVsdEJpcDMyTWFpbm5ldCgpLFxuICAgIHB1YktleUhhc2g6IDB4MDAsXG4gICAgc2NyaXB0SGFzaDogMHgwNSxcbiAgICB3aWY6IDB4ODAsXG4gICAgY29pbjogY29pbnMuQkNIQSxcbiAgICBmb3JrSWQ6IDB4MDAsXG4gICAgY2FzaEFkZHI6IHtcbiAgICAgIHByZWZpeDogJ2VjYXNoJyxcbiAgICAgIHB1YktleUhhc2g6IDB4MDAsXG4gICAgICBzY3JpcHRIYXNoOiAweDA4LFxuICAgIH0sXG4gIH0sXG4gIGVjYXNoVGVzdDoge1xuICAgIG1lc3NhZ2VQcmVmaXg6ICdcXHgxNmVDYXNoIFNpZ25lZCBNZXNzYWdlOlxcbicsXG4gICAgYmlwMzI6IGdldERlZmF1bHRCaXAzMlRlc3RuZXQoKSxcbiAgICBwdWJLZXlIYXNoOiAweDZmLFxuICAgIHNjcmlwdEhhc2g6IDB4YzQsXG4gICAgd2lmOiAweGVmLFxuICAgIGNvaW46IGNvaW5zLkJDSEEsXG4gICAgY2FzaEFkZHI6IHtcbiAgICAgIHByZWZpeDogJ2VjdGVzdCcsXG4gICAgICBwdWJLZXlIYXNoOiAweDAwLFxuICAgICAgc2NyaXB0SGFzaDogMHgwOCxcbiAgICB9LFxuICB9LFxuXG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9saXRlY29pbi1wcm9qZWN0L2xpdGVjb2luL2Jsb2IvbWFzdGVyL3NyYy92YWxpZGF0aW9uLmNwcFxuICAvLyBodHRwczovL2dpdGh1Yi5jb20vbGl0ZWNvaW4tcHJvamVjdC9saXRlY29pbi9ibG9iL21hc3Rlci9zcmMvY2hhaW5wYXJhbXMuY3BwXG4gIGxpdGVjb2luOiB7XG4gICAgbWVzc2FnZVByZWZpeDogJ1xceDE5TGl0ZWNvaW4gU2lnbmVkIE1lc3NhZ2U6XFxuJyxcbiAgICBiZWNoMzI6ICdsdGMnLFxuICAgIGJpcDMyOiBnZXREZWZhdWx0QmlwMzJNYWlubmV0KCksXG4gICAgcHViS2V5SGFzaDogMHgzMCxcbiAgICBzY3JpcHRIYXNoOiAweDMyLFxuICAgIHdpZjogMHhiMCxcbiAgICBjb2luOiBjb2lucy5MVEMsXG4gIH0sXG4gIGxpdGVjb2luVGVzdDoge1xuICAgIG1lc3NhZ2VQcmVmaXg6ICdcXHgxOUxpdGVjb2luIFNpZ25lZCBNZXNzYWdlOlxcbicsXG4gICAgYmVjaDMyOiAndGx0YycsXG4gICAgYmlwMzI6IGdldERlZmF1bHRCaXAzMlRlc3RuZXQoKSxcbiAgICBwdWJLZXlIYXNoOiAweDZmLFxuICAgIHNjcmlwdEhhc2g6IDB4M2EsXG4gICAgd2lmOiAweGVmLFxuICAgIGNvaW46IGNvaW5zLkxUQyxcbiAgfSxcblxuICAvLyBodHRwczovL2dpdGh1Yi5jb20vemNhc2gvemNhc2gvYmxvYi9tYXN0ZXIvc3JjL3ZhbGlkYXRpb24uY3BwXG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS96Y2FzaC96Y2FzaC9ibG9iL21hc3Rlci9zcmMvY2hhaW5wYXJhbXMuY3BwXG4gIHpjYXNoOiB7XG4gICAgbWVzc2FnZVByZWZpeDogJ1xceDE4WkNhc2ggU2lnbmVkIE1lc3NhZ2U6XFxuJyxcbiAgICBiaXAzMjogZ2V0RGVmYXVsdEJpcDMyTWFpbm5ldCgpLFxuICAgIHB1YktleUhhc2g6IDB4MWNiOCxcbiAgICBzY3JpcHRIYXNoOiAweDFjYmQsXG4gICAgd2lmOiAweDgwLFxuICAgIGNvaW46IGNvaW5zLlpFQyxcbiAgfSxcbiAgemNhc2hUZXN0OiB7XG4gICAgbWVzc2FnZVByZWZpeDogJ1xceDE4WkNhc2ggU2lnbmVkIE1lc3NhZ2U6XFxuJyxcbiAgICBiaXAzMjogZ2V0RGVmYXVsdEJpcDMyVGVzdG5ldCgpLFxuICAgIHB1YktleUhhc2g6IDB4MWQyNSxcbiAgICBzY3JpcHRIYXNoOiAweDFjYmEsXG4gICAgd2lmOiAweGVmLFxuICAgIGNvaW46IGNvaW5zLlpFQyxcbiAgfSxcbn07XG5cbi8qKlxuICogQHJldHVybnMge05ldHdvcmtbXX0gYWxsIGtub3duIG5ldHdvcmtzIGFzIGFycmF5XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXROZXR3b3JrTGlzdCgpOiBOZXR3b3JrW10ge1xuICByZXR1cm4gT2JqZWN0LnZhbHVlcyhuZXR3b3Jrcyk7XG59XG5cbi8qKlxuICogQHBhcmFtIHtOZXR3b3JrfSBuZXR3b3JrXG4gKiBAcmV0dXJucyB7TmV0d29ya05hbWV9IHRoZSBuYW1lIG9mIHRoZSBuZXR3b3JrLiBSZXR1cm5zIHVuZGVmaW5lZCBpZiBuZXR3b3JrIGlzIG5vdCBhIHZhbHVlXG4gKiAgICAgICAgICAgICAgICAgICAgICAgIG9mIGBuZXR3b3Jrc2BcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldE5ldHdvcmtOYW1lKG5ldHdvcms6IE5ldHdvcmspOiBOZXR3b3JrTmFtZSB8IHVuZGVmaW5lZCB7XG4gIHJldHVybiBPYmplY3Qua2V5cyhuZXR3b3JrcykuZmluZCgobikgPT4gKG5ldHdvcmtzIGFzIFJlY29yZDxzdHJpbmcsIE5ldHdvcms+KVtuXSA9PT0gbmV0d29yaykgYXNcbiAgICB8IE5ldHdvcmtOYW1lXG4gICAgfCB1bmRlZmluZWQ7XG59XG5cbi8qKlxuICogQHBhcmFtIHtOZXR3b3JrfSBuZXR3b3JrXG4gKiBAcmV0dXJucyB7T2JqZWN0fSB0aGUgbWFpbm5ldCBjb3JyZXNwb25kaW5nIHRvIGEgdGVzdG5ldFxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0TWFpbm5ldChuZXR3b3JrOiBOZXR3b3JrKTogTmV0d29yayB7XG4gIHN3aXRjaCAobmV0d29yaykge1xuICAgIGNhc2UgbmV0d29ya3MuYml0Y29pbjpcbiAgICBjYXNlIG5ldHdvcmtzLnRlc3RuZXQ6XG4gICAgICByZXR1cm4gbmV0d29ya3MuYml0Y29pbjtcblxuICAgIGNhc2UgbmV0d29ya3MuYml0Y29pbmNhc2g6XG4gICAgY2FzZSBuZXR3b3Jrcy5iaXRjb2luY2FzaFRlc3RuZXQ6XG4gICAgICByZXR1cm4gbmV0d29ya3MuYml0Y29pbmNhc2g7XG5cbiAgICBjYXNlIG5ldHdvcmtzLmJpdGNvaW5nb2xkOlxuICAgIGNhc2UgbmV0d29ya3MuYml0Y29pbmdvbGRUZXN0bmV0OlxuICAgICAgcmV0dXJuIG5ldHdvcmtzLmJpdGNvaW5nb2xkO1xuXG4gICAgY2FzZSBuZXR3b3Jrcy5iaXRjb2luc3Y6XG4gICAgY2FzZSBuZXR3b3Jrcy5iaXRjb2luc3ZUZXN0bmV0OlxuICAgICAgcmV0dXJuIG5ldHdvcmtzLmJpdGNvaW5zdjtcblxuICAgIGNhc2UgbmV0d29ya3MuZGFzaDpcbiAgICBjYXNlIG5ldHdvcmtzLmRhc2hUZXN0OlxuICAgICAgcmV0dXJuIG5ldHdvcmtzLmRhc2g7XG5cbiAgICBjYXNlIG5ldHdvcmtzLmVjYXNoOlxuICAgIGNhc2UgbmV0d29ya3MuZWNhc2hUZXN0OlxuICAgICAgcmV0dXJuIG5ldHdvcmtzLmVjYXNoO1xuXG4gICAgY2FzZSBuZXR3b3Jrcy5saXRlY29pbjpcbiAgICBjYXNlIG5ldHdvcmtzLmxpdGVjb2luVGVzdDpcbiAgICAgIHJldHVybiBuZXR3b3Jrcy5saXRlY29pbjtcblxuICAgIGNhc2UgbmV0d29ya3MuemNhc2g6XG4gICAgY2FzZSBuZXR3b3Jrcy56Y2FzaFRlc3Q6XG4gICAgICByZXR1cm4gbmV0d29ya3MuemNhc2g7XG5cbiAgICBjYXNlIG5ldHdvcmtzLmRvZ2Vjb2luOlxuICAgIGNhc2UgbmV0d29ya3MuZG9nZWNvaW5UZXN0OlxuICAgICAgcmV0dXJuIG5ldHdvcmtzLmRvZ2Vjb2luO1xuICB9XG4gIHRocm93IG5ldyBUeXBlRXJyb3IoYGludmFsaWQgbmV0d29ya2ApO1xufVxuXG4vKipcbiAqIEBwYXJhbSB7TmV0d29ya30gbmV0d29ya1xuICogQHJldHVybnMge2Jvb2xlYW59IHRydWUgaWZmIG5ldHdvcmsgaXMgYSBtYWlubmV0XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc01haW5uZXQobmV0d29yazogTmV0d29yayk6IGJvb2xlYW4ge1xuICByZXR1cm4gZ2V0TWFpbm5ldChuZXR3b3JrKSA9PT0gbmV0d29yaztcbn1cblxuLyoqXG4gKiBAcGFyYW0ge05ldHdvcmt9IG5ldHdvcmtcbiAqIEByZXR1cm5zIHtib29sZWFufSB0cnVlIGlmZiBuZXR3b3JrIGlzIGEgdGVzdG5ldFxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNUZXN0bmV0KG5ldHdvcms6IE5ldHdvcmspOiBib29sZWFuIHtcbiAgcmV0dXJuIGdldE1haW5uZXQobmV0d29yaykgIT09IG5ldHdvcms7XG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7TmV0d29ya30gbmV0d29ya1xuICogQHBhcmFtIHtOZXR3b3JrfSBvdGhlck5ldHdvcmtcbiAqIEByZXR1cm5zIHtib29sZWFufSB0cnVlIGlmZiBib3RoIG5ldHdvcmtzIGFyZSBmb3IgdGhlIHNhbWUgY29pblxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNTYW1lQ29pbihuZXR3b3JrOiBOZXR3b3JrLCBvdGhlck5ldHdvcms6IE5ldHdvcmspOiBib29sZWFuIHtcbiAgcmV0dXJuIGdldE1haW5uZXQobmV0d29yaykgPT09IGdldE1haW5uZXQob3RoZXJOZXR3b3JrKTtcbn1cblxuY29uc3QgbWFpbm5ldHMgPSBnZXROZXR3b3JrTGlzdCgpLmZpbHRlcihpc01haW5uZXQpO1xuY29uc3QgdGVzdG5ldHMgPSBnZXROZXR3b3JrTGlzdCgpLmZpbHRlcihpc1Rlc3RuZXQpO1xuXG4vKipcbiAqIE1hcCB3aGVyZSBrZXlzIGFyZSBtYWlubmV0IG5ldHdvcmtzIGFuZCB2YWx1ZXMgYXJlIHRlc3RuZXQgbmV0d29ya3NcbiAqIEB0eXBlIHtNYXA8TmV0d29yaywgTmV0d29ya1tdPn1cbiAqL1xuY29uc3QgbWFpbm5ldFRlc3RuZXRQYWlycyA9IG5ldyBNYXAobWFpbm5ldHMubWFwKChtKSA9PiBbbSwgdGVzdG5ldHMuZmlsdGVyKCh0KSA9PiBnZXRNYWlubmV0KHQpID09PSBtKV0pKTtcblxuLyoqXG4gKiBAcGFyYW0ge05ldHdvcmt9IG5ldHdvcmtcbiAqIEByZXR1cm5zIHtOZXR3b3JrfHVuZGVmaW5lZH0gLSBUaGUgdGVzdG5ldCBjb3JyZXNwb25kaW5nIHRvIGEgbWFpbm5ldC5cbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFJldHVybnMgdW5kZWZpbmVkIGlmIGEgbmV0d29yayBoYXMgbm8gdGVzdG5ldC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFRlc3RuZXQobmV0d29yazogTmV0d29yayk6IE5ldHdvcmsgfCB1bmRlZmluZWQge1xuICBpZiAoaXNUZXN0bmV0KG5ldHdvcmspKSB7XG4gICAgcmV0dXJuIG5ldHdvcms7XG4gIH1cbiAgY29uc3QgdGVzdG5ldHMgPSBtYWlubmV0VGVzdG5ldFBhaXJzLmdldChuZXR3b3JrKTtcbiAgaWYgKHRlc3RuZXRzID09PSB1bmRlZmluZWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYGludmFsaWQgYXJndW1lbnRgKTtcbiAgfVxuICBpZiAodGVzdG5ldHMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmICh0ZXN0bmV0cy5sZW5ndGggPT09IDEpIHtcbiAgICByZXR1cm4gdGVzdG5ldHNbMF07XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKGBtb3JlIHRoYW4gb25lIHRlc3RuZXQgZm9yICR7Z2V0TmV0d29ya05hbWUobmV0d29yayl9YCk7XG59XG5cbi8qKlxuICogQHBhcmFtIHtOZXR3b3JrfSBuZXR3b3JrXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gdHJ1ZSBpZmYgbmV0d29yayBiaXRjb2luIG9yIHRlc3RuZXRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzQml0Y29pbihuZXR3b3JrOiBOZXR3b3JrKTogYm9vbGVhbiB7XG4gIHJldHVybiBnZXRNYWlubmV0KG5ldHdvcmspID09PSBuZXR3b3Jrcy5iaXRjb2luO1xufVxuXG4vKipcbiAqIEBwYXJhbSB7TmV0d29ya30gbmV0d29ya1xuICogQHJldHVybnMge2Jvb2xlYW59IHRydWUgaWZmIG5ldHdvcmsgaXMgYml0Y29pbmNhc2ggb3IgYml0Y29pbmNhc2hUZXN0bmV0XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0JpdGNvaW5DYXNoKG5ldHdvcms6IE5ldHdvcmspOiBib29sZWFuIHtcbiAgcmV0dXJuIGdldE1haW5uZXQobmV0d29yaykgPT09IG5ldHdvcmtzLmJpdGNvaW5jYXNoO1xufVxuXG4vKipcbiAqIEBwYXJhbSB7TmV0d29ya30gbmV0d29ya1xuICogQHJldHVybnMge2Jvb2xlYW59IHRydWUgaWZmIG5ldHdvcmsgaXMgZWNhc2ggb3IgZWNhc2hUZXN0XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0VDYXNoKG5ldHdvcms6IE5ldHdvcmspOiBib29sZWFuIHtcbiAgcmV0dXJuIGdldE1haW5uZXQobmV0d29yaykgPT09IG5ldHdvcmtzLmVjYXNoO1xufVxuXG4vKipcbiAqIEBwYXJhbSB7TmV0d29ya30gbmV0d29ya1xuICogQHJldHVybnMge2Jvb2xlYW59IHRydWUgaWZmIG5ldHdvcmsgaXMgYml0Y29pbmdvbGRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzQml0Y29pbkdvbGQobmV0d29yazogTmV0d29yayk6IGJvb2xlYW4ge1xuICByZXR1cm4gZ2V0TWFpbm5ldChuZXR3b3JrKSA9PT0gbmV0d29ya3MuYml0Y29pbmdvbGQ7XG59XG5cbi8qKlxuICogQHBhcmFtIHtOZXR3b3JrfSBuZXR3b3JrXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gdHJ1ZSBpZmYgbmV0d29yayBpcyBiaXRjb2luc3Ygb3IgYml0Y29pbnN2VGVzdG5ldFxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNCaXRjb2luU1YobmV0d29yazogTmV0d29yayk6IGJvb2xlYW4ge1xuICByZXR1cm4gZ2V0TWFpbm5ldChuZXR3b3JrKSA9PT0gbmV0d29ya3MuYml0Y29pbnN2O1xufVxuXG4vKipcbiAqIEBwYXJhbSB7TmV0d29ya30gbmV0d29ya1xuICogQHJldHVybnMge2Jvb2xlYW59IHRydWUgaWZmIG5ldHdvcmsgaXMgZGFzaCBvciBkYXNoVGVzdFxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNEYXNoKG5ldHdvcms6IE5ldHdvcmspOiBib29sZWFuIHtcbiAgcmV0dXJuIGdldE1haW5uZXQobmV0d29yaykgPT09IG5ldHdvcmtzLmRhc2g7XG59XG5cbi8qKlxuICogQHBhcmFtIHtOZXR3b3JrfSBuZXR3b3JrXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gdHJ1ZSBpZmYgbmV0d29yayBpcyBkb2dlY29pbiBvciBkb2dlY29pblRlc3RcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzRG9nZWNvaW4obmV0d29yazogTmV0d29yayk6IGJvb2xlYW4ge1xuICByZXR1cm4gZ2V0TWFpbm5ldChuZXR3b3JrKSA9PT0gbmV0d29ya3MuZG9nZWNvaW47XG59XG5cbi8qKlxuICogQHBhcmFtIHtOZXR3b3JrfSBuZXR3b3JrXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gdHJ1ZSBpZmYgbmV0d29yayBpcyBsaXRlY29pbiBvciBsaXRlY29pblRlc3RcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzTGl0ZWNvaW4obmV0d29yazogTmV0d29yayk6IGJvb2xlYW4ge1xuICByZXR1cm4gZ2V0TWFpbm5ldChuZXR3b3JrKSA9PT0gbmV0d29ya3MubGl0ZWNvaW47XG59XG5cbi8qKlxuICogQHBhcmFtIHtOZXR3b3JrfSBuZXR3b3JrXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gdHJ1ZSBpZmYgbmV0d29yayBpcyB6Y2FzaCBvciB6Y2FzaFRlc3RcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzWmNhc2gobmV0d29yazogTmV0d29yayk6IGJvb2xlYW4ge1xuICByZXR1cm4gZ2V0TWFpbm5ldChuZXR3b3JrKSA9PT0gbmV0d29ya3MuemNhc2g7XG59XG5cbi8qKlxuICogQHBhcmFtIHt1bmtub3dufSBuZXR3b3JrXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gcmV0dXJucyB0cnVlIGlmZiBuZXR3b3JrIGlzIGFueSBvZiB0aGUgbmV0d29yayBzdGF0ZWQgaW4gdGhlIGFyZ3VtZW50XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1ZhbGlkTmV0d29yayhuZXR3b3JrOiB1bmtub3duKTogbmV0d29yayBpcyBOZXR3b3JrIHtcbiAgcmV0dXJuIGdldE5ldHdvcmtMaXN0KCkuaW5jbHVkZXMobmV0d29yayBhcyBOZXR3b3JrKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN1cHBvcnRzU2Vnd2l0KG5ldHdvcms6IE5ldHdvcmspOiBib29sZWFuIHtcbiAgcmV0dXJuIChbbmV0d29ya3MuYml0Y29pbiwgbmV0d29ya3MubGl0ZWNvaW4sIG5ldHdvcmtzLmJpdGNvaW5nb2xkXSBhcyBOZXR3b3JrW10pLmluY2x1ZGVzKGdldE1haW5uZXQobmV0d29yaykpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3VwcG9ydHNUYXByb290KG5ldHdvcms6IE5ldHdvcmspOiBib29sZWFuIHtcbiAgcmV0dXJuIGdldE1haW5uZXQobmV0d29yaykgPT09IG5ldHdvcmtzLmJpdGNvaW47XG59XG4iXX0=