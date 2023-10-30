/**
 * V1 Safe Wallets are the oldest type of wallets that BitGo supports. They were
 * created back in 2013-14 and don't use HD chains. Instead, they have only one
 * P2SH address per wallet whose redeem script uses uncompressed public keys.
 * */
/// <reference types="node" />
import { Network } from '../../networks';
export declare function toUncompressedPub(pubkey: Buffer): Buffer;
export declare function toCompressedPub(pubkey: Buffer): Buffer;
/** create p2sh scripts with uncompressed pubkeys */
export declare function createLegacySafeOutputScript2of3(pubkeys: Buffer[], network?: Network): {
    scriptPubKey: Buffer;
    redeemScript: Buffer;
};
//# sourceMappingURL=index.d.ts.map