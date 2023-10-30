/// <reference types="node" />
/**
 * Classes for deriving key triples for wallet addresses.
 *
 * By default, BitGo wallets consist of a triple of bip32 extend keypairs.
 * Every wallet address can be identified by _(chain: number, index: number)_.
 * The key set for a particular address can be obtained by deriving with the path
 * `0/0/${chain}/${index}`. (In rare cases the prefix 0/0 can be different)
 *
 * Since we never use other derivations for utxo address scripts, the classes defined here only
 * allow exactly one level of derivation.
 */
import { BIP32Interface } from 'bip32';
import { Triple } from '../types';
export declare type KeyName = 'user' | 'backup' | 'bitgo';
export declare function eqPublicKey(a: BIP32Interface, b: BIP32Interface): boolean;
/**
 * Base class for RootWalletKeys and DerivedWalletKeys.
 * Keys can be either public keys or private keys.
 */
export declare class WalletKeys {
    readonly triple: Triple<BIP32Interface>;
    readonly publicKeys: Triple<Buffer>;
    /**
     * @param triple - bip32 key triple
     */
    constructor(triple: Triple<BIP32Interface>);
    get user(): BIP32Interface;
    get backup(): BIP32Interface;
    get bitgo(): BIP32Interface;
}
/**
 * Set of WalletKeys derived from RootWalletKeys. Suitable for signing transaction inputs.
 * Contains reference to the RootWalletKeys this was derived from as well as the paths used
 * for derivation.
 */
export declare class DerivedWalletKeys extends WalletKeys {
    parent: RootWalletKeys;
    paths: Triple<string>;
    /**
     * @param parent - wallet keys to derive from
     * @param paths - paths to derive with
     */
    constructor(parent: RootWalletKeys, paths: Triple<string>);
}
/**
 * Set of root wallet keys, typically instantiated using the wallet xpub triple.
 */
export declare class RootWalletKeys extends WalletKeys {
    readonly derivationPrefixes: Triple<string>;
    static readonly defaultPrefix = "0/0";
    /**
     * @param triple - bip32 key triple
     * @param derivationPrefixes - Certain v1 wallets or their migrated v2 counterparts
     *                             can have a nonstandard prefix.
     */
    constructor(triple: Triple<BIP32Interface>, derivationPrefixes?: Triple<string>);
    /**
     * @param key
     * @param chain
     * @param index
     * @return full derivation path for key, including key-specific prefix
     */
    getDerivationPath(key: BIP32Interface, chain: number, index: number): string;
    /**
     * @param chain
     * @param index
     * @return walletKeys for a particular address identified by (chain, index)
     */
    deriveForChainAndIndex(chain: number, index: number): DerivedWalletKeys;
}
//# sourceMappingURL=WalletKeys.d.ts.map