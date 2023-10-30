import { ECPairAPI, ECPairInterface } from 'ecpair';
import { BIP32API, BIP32Interface } from 'bip32';
import { MuSig } from '@brandonblack/musig';
declare const ecc: {
    isPoint: (p: Uint8Array) => boolean;
    isPrivate: (d: Uint8Array) => boolean;
    isXOnlyPoint: (p: Uint8Array) => boolean;
    xOnlyPointAddTweak: (p: Uint8Array, tweak: Uint8Array) => {
        parity: 0 | 1;
        xOnlyPubkey: Uint8Array;
    } | null;
    pointFromScalar: (sk: Uint8Array, compressed?: boolean | undefined) => Uint8Array | null;
    pointCompress: (p: Uint8Array, compressed?: boolean | undefined) => Uint8Array;
    pointMultiply: (a: Uint8Array, tweak: Uint8Array, compressed?: boolean | undefined) => Uint8Array | null;
    pointAdd: (a: Uint8Array, b: Uint8Array, compressed?: boolean | undefined) => Uint8Array | null;
    pointAddScalar: (p: Uint8Array, tweak: Uint8Array, compressed?: boolean | undefined) => Uint8Array | null;
    privateAdd: (d: Uint8Array, tweak: Uint8Array) => Uint8Array | null;
    privateNegate: (d: Uint8Array) => Uint8Array;
    sign: (h: Uint8Array, d: Uint8Array, e?: Uint8Array | undefined) => Uint8Array;
    signSchnorr: (h: Uint8Array, d: Uint8Array, e?: Uint8Array) => Uint8Array;
    verify: (h: Uint8Array, Q: Uint8Array, signature: Uint8Array, strict?: boolean | undefined) => boolean;
    verifySchnorr: (h: Uint8Array, Q: Uint8Array, signature: Uint8Array) => boolean;
};
declare const ECPair: ECPairAPI;
declare const bip32: BIP32API;
declare const musig: MuSig;
export { ecc, ECPair, ECPairAPI, ECPairInterface, bip32, BIP32API, BIP32Interface, musig, MuSig };
//# sourceMappingURL=noble_ecc.d.ts.map