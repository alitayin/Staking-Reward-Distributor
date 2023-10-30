export declare type NetworkName = 'bitcoin' | 'testnet' | 'bitcoincash' | 'bitcoincashTestnet' | 'ecash' | 'ecashTest' | 'bitcoingold' | 'bitcoingoldTestnet' | 'bitcoinsv' | 'bitcoinsvTestnet' | 'dash' | 'dashTest' | 'dogecoin' | 'dogecoinTest' | 'litecoin' | 'litecoinTest' | 'zcash' | 'zcashTest';
export declare type Network = {
    messagePrefix: string;
    pubKeyHash: number;
    scriptHash: number;
    wif: number;
    bip32: {
        public: number;
        private: number;
    };
    cashAddr?: {
        prefix: string;
        pubKeyHash: number;
        scriptHash: number;
    };
    bech32?: string;
    forkId?: number;
    /**
     * @deprecated
     */
    coin: string;
};
export declare const networks: Record<NetworkName, Network>;
/**
 * @returns {Network[]} all known networks as array
 */
export declare function getNetworkList(): Network[];
/**
 * @param {Network} network
 * @returns {NetworkName} the name of the network. Returns undefined if network is not a value
 *                        of `networks`
 */
export declare function getNetworkName(network: Network): NetworkName | undefined;
/**
 * @param {Network} network
 * @returns {Object} the mainnet corresponding to a testnet
 */
export declare function getMainnet(network: Network): Network;
/**
 * @param {Network} network
 * @returns {boolean} true iff network is a mainnet
 */
export declare function isMainnet(network: Network): boolean;
/**
 * @param {Network} network
 * @returns {boolean} true iff network is a testnet
 */
export declare function isTestnet(network: Network): boolean;
/**
 *
 * @param {Network} network
 * @param {Network} otherNetwork
 * @returns {boolean} true iff both networks are for the same coin
 */
export declare function isSameCoin(network: Network, otherNetwork: Network): boolean;
/**
 * @param {Network} network
 * @returns {Network|undefined} - The testnet corresponding to a mainnet.
 *                               Returns undefined if a network has no testnet.
 */
export declare function getTestnet(network: Network): Network | undefined;
/**
 * @param {Network} network
 * @returns {boolean} true iff network bitcoin or testnet
 */
export declare function isBitcoin(network: Network): boolean;
/**
 * @param {Network} network
 * @returns {boolean} true iff network is bitcoincash or bitcoincashTestnet
 */
export declare function isBitcoinCash(network: Network): boolean;
/**
 * @param {Network} network
 * @returns {boolean} true iff network is ecash or ecashTest
 */
export declare function isECash(network: Network): boolean;
/**
 * @param {Network} network
 * @returns {boolean} true iff network is bitcoingold
 */
export declare function isBitcoinGold(network: Network): boolean;
/**
 * @param {Network} network
 * @returns {boolean} true iff network is bitcoinsv or bitcoinsvTestnet
 */
export declare function isBitcoinSV(network: Network): boolean;
/**
 * @param {Network} network
 * @returns {boolean} true iff network is dash or dashTest
 */
export declare function isDash(network: Network): boolean;
/**
 * @param {Network} network
 * @returns {boolean} true iff network is dogecoin or dogecoinTest
 */
export declare function isDogecoin(network: Network): boolean;
/**
 * @param {Network} network
 * @returns {boolean} true iff network is litecoin or litecoinTest
 */
export declare function isLitecoin(network: Network): boolean;
/**
 * @param {Network} network
 * @returns {boolean} true iff network is zcash or zcashTest
 */
export declare function isZcash(network: Network): boolean;
/**
 * @param {unknown} network
 * @returns {boolean} returns true iff network is any of the network stated in the argument
 */
export declare function isValidNetwork(network: unknown): network is Network;
export declare function supportsSegwit(network: Network): boolean;
export declare function supportsTaproot(network: Network): boolean;
//# sourceMappingURL=networks.d.ts.map