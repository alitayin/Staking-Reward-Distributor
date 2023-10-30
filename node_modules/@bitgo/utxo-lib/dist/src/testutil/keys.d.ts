import { BIP32Interface } from 'bip32';
import { Triple } from '../bitgo';
import { RootWalletKeys } from '../bitgo';
import { ECPairInterface } from '../noble_ecc';
export declare type KeyTriple = Triple<BIP32Interface>;
export declare type UncompressedKeyTriple = Triple<ECPairInterface>;
export declare function getKey(seed: string): BIP32Interface;
export declare function getKeyTriple(seed: string): KeyTriple;
export declare function getUncompressedKeyTriple(inputs: Triple<number>): UncompressedKeyTriple;
export declare function getKeyName(triple: Triple<BIP32Interface>, k: BIP32Interface): string | undefined;
export declare function getDefaultCosigner<T>(keyset: Triple<T>, signer: T): T;
export declare function getDefaultWalletKeys(): RootWalletKeys;
//# sourceMappingURL=keys.d.ts.map