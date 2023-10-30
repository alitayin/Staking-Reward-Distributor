/*! musig-js - MIT License (c) 2022 Brandon Black */
export interface MuSig {
    getXOnlyPubkey(ctx: KeyGenContext | SessionKey): Uint8Array;
    getPlainPubkey(ctx: KeyGenContext | SessionKey): Uint8Array;
    keySort(publicKeys: Uint8Array[]): Uint8Array[];
    keyAgg(publicKeys: Uint8Array[], ...tweaks: Tweak[]): KeyGenContext;
    addTweaks(ctx: KeyGenContext, ...tweaks: Tweak[]): KeyGenContext;
    nonceGen(args: {
        sessionId?: Uint8Array;
        secretKey?: Uint8Array;
        publicKey: Uint8Array;
        xOnlyPublicKey?: Uint8Array;
        msg?: Uint8Array;
        extraInput?: Uint8Array;
    }): Uint8Array;
    addExternalNonce(publicNonce: Uint8Array, secretNonce: Uint8Array): void;
    nonceAgg(nonces: Uint8Array[]): Uint8Array;
    startSigningSession(aggNonce: Uint8Array, msg: Uint8Array, publicKeys: Uint8Array[], ...tweaks: Tweak[]): SessionKey;
    partialSign(args: {
        secretKey: Uint8Array;
        publicNonce: Uint8Array;
        sessionKey: SessionKey;
        verify?: boolean;
    }): Uint8Array;
    partialVerify(args: {
        sig: Uint8Array;
        publicKey: Uint8Array;
        publicNonce: Uint8Array;
        sessionKey: SessionKey;
    }): boolean;
    signAgg(sigs: Uint8Array[], sessionKey: SessionKey): Uint8Array;
    deterministicSign(args: {
        secretKey: Uint8Array;
        aggOtherNonce: Uint8Array;
        publicKeys: Uint8Array[];
        tweaks?: Tweak[];
        msg: Uint8Array;
        rand?: Uint8Array;
        verify?: boolean;
    }): {
        sig: Uint8Array;
        sessionKey: SessionKey;
        publicNonce: Uint8Array;
    };
    deterministicNonceGen(args: {
        secretKey: Uint8Array;
        aggOtherNonce: Uint8Array;
        publicKeys: Uint8Array[];
        tweaks?: Tweak[];
        msg: Uint8Array;
        rand?: Uint8Array;
    }): {
        publicNonce: Uint8Array;
    };
}
export interface Crypto {
    pointAddTweak(p: Uint8Array, t: Uint8Array, compressed: boolean): Uint8Array | null;
    pointAdd(a: Uint8Array, b: Uint8Array, compressed: boolean): Uint8Array | null;
    pointMultiplyUnsafe(p: Uint8Array, a: Uint8Array, compressed: boolean): Uint8Array | null;
    pointMultiplyAndAddUnsafe(p1: Uint8Array, a: Uint8Array, p2: Uint8Array, compressed: boolean): Uint8Array | null;
    pointNegate(p: Uint8Array): Uint8Array;
    pointCompress(p: Uint8Array, compress?: boolean): Uint8Array;
    scalarAdd(a: Uint8Array, b: Uint8Array): Uint8Array;
    scalarMultiply(a: Uint8Array, b: Uint8Array): Uint8Array;
    scalarNegate(a: Uint8Array): Uint8Array;
    scalarMod(a: Uint8Array): Uint8Array;
    isScalar(s: Uint8Array): boolean;
    isSecret(s: Uint8Array): boolean;
    isPoint(p: Uint8Array): boolean;
    isXOnlyPoint(p: Uint8Array): boolean;
    liftX(p: Uint8Array): Uint8Array | null;
    pointX(p: Uint8Array): Uint8Array;
    hasEvenY(p: Uint8Array): boolean;
    getPublicKey(s: Uint8Array, compressed: boolean): Uint8Array | null;
    taggedHash(tag: string, ...messages: Uint8Array[]): Uint8Array;
    sha256(...messages: Uint8Array[]): Uint8Array;
}
export type Tweak = TypedTweak | Uint8Array;
export interface TypedTweak {
    tweak: Uint8Array;
    xOnly?: boolean;
}
export interface KeyGenContext {
    aggPublicKey: Uint8Array;
    gacc: Uint8Array;
    tacc: Uint8Array;
}
export interface SessionKey {
    publicKey: Uint8Array;
    aggNonce: Uint8Array;
    msg: Uint8Array;
}
export declare function MuSigFactory(ecc: Crypto): MuSig;
