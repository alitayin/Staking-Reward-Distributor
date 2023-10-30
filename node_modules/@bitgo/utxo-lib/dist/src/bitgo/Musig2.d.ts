/// <reference types="node" />
import { SessionKey } from '@brandonblack/musig';
import { Tuple } from './types';
import { PsbtInput } from 'bip174/src/lib/interfaces';
import { ProprietaryKeyValue } from './PsbtUtil';
/**
 *  Participant key value object.
 */
export interface PsbtMusig2Participants {
    tapOutputKey: Buffer;
    tapInternalKey: Buffer;
    participantPubKeys: Tuple<Buffer>;
}
export interface PsbtMusig2DeterministicParams {
    privateKey: Buffer;
    otherNonce: Buffer;
    publicKeys: Tuple<Buffer>;
    internalPubKey: Buffer;
    tapTreeRoot: Buffer;
    hash: Buffer;
}
/**
 *  Nonce key value object.
 */
export interface PsbtMusig2PubNonce {
    participantPubKey: Buffer;
    tapOutputKey: Buffer;
    pubNonce: Buffer;
}
/**
 *  Partial signature key value object.
 */
export interface PsbtMusig2PartialSig {
    participantPubKey: Buffer;
    tapOutputKey: Buffer;
    partialSig: Buffer;
}
/**
 * Because musig uses reference-equal buffers to cache nonces, we wrap it here to allow using
 * nonces that are byte-equal but not reference-equal.
 */
export declare class Musig2NonceStore {
    private nonces;
    /**
     * Get original Buffer instance for nonce (which may be a copy).
     * @return byte-equal buffer that is reference-equal to what was stored earlier in createMusig2Nonce
     */
    getRef(nonce: Uint8Array): Uint8Array;
    /**
     * Creates musig2 nonce and stores buffer reference.
     * tapInternalkey, tapMerkleRoot, tapBip32Derivation for rootWalletKey are required per p2trMusig2 key path input.
     * Also participant keys are required from psbt proprietary key values.
     * Ref: https://gist.github.com/sanket1729/4b525c6049f4d9e034d27368c49f28a6
     * @param privateKey - signer private key
     * @param publicKey - signer xy public key
     * @param xOnlyPublicKey - tweaked aggregated key (tapOutputKey)
     * @param sessionId Additional entropy. If provided it must either be a counter unique to this secret key,
     * (converted to an array of 32 bytes), or 32 uniformly random bytes.
     */
    createMusig2Nonce(privateKey: Uint8Array, publicKey: Uint8Array, xOnlyPublicKey: Uint8Array, txHash: Uint8Array, sessionId?: Buffer): Uint8Array;
}
/**
 * Psbt proprietary key val util function for participants pub keys. SubType is 0x01
 * Ref: https://gist.github.com/sanket1729/4b525c6049f4d9e034d27368c49f28a6
 * @return x-only tapOutputKey||tapInternalKey as sub keydata, plain sigining participant keys as valuedata
 */
export declare function encodePsbtMusig2Participants(participants: PsbtMusig2Participants): ProprietaryKeyValue;
/**
 * Psbt proprietary key val util function for pub nonce. SubType is 0x02
 * Ref: https://gist.github.com/sanket1729/4b525c6049f4d9e034d27368c49f28a6
 * @return plain-participantPubKey||x-only-tapOutputKey as sub keydata, 66 bytes of 2 pub nonces as valuedata
 */
export declare function encodePsbtMusig2PubNonce(nonce: PsbtMusig2PubNonce): ProprietaryKeyValue;
export declare function encodePsbtMusig2PartialSig(partialSig: PsbtMusig2PartialSig): ProprietaryKeyValue;
/**
 * Decodes proprietary key value data for participant pub keys
 * @param kv
 */
export declare function decodePsbtMusig2Participants(kv: ProprietaryKeyValue): PsbtMusig2Participants;
/**
 * Decodes proprietary key value data for musig2 nonce
 * @param kv
 */
export declare function decodePsbtMusig2Nonce(kv: ProprietaryKeyValue): PsbtMusig2PubNonce;
/**
 * Decodes proprietary key value data for musig2 partial sig
 * @param kv
 */
export declare function decodePsbtMusig2PartialSig(kv: ProprietaryKeyValue): PsbtMusig2PartialSig;
export declare function createTapInternalKey(plainPubKeys: Buffer[]): Buffer;
export declare function createTapOutputKey(internalPubKey: Buffer, tapTreeRoot: Buffer): Buffer;
export declare function createAggregateNonce(pubNonces: Tuple<Buffer>): Buffer;
export declare function createTapTweak(tapInternalKey: Buffer, tapMerkleRoot: Buffer): Buffer;
export declare function musig2PartialSign(privateKey: Buffer, publicNonce: Uint8Array, sessionKey: SessionKey, nonceStore: Musig2NonceStore): Buffer;
export declare function musig2PartialSigVerify(sig: Buffer, publicKey: Buffer, publicNonce: Buffer, sessionKey: SessionKey): boolean;
export declare function musig2AggregateSigs(sigs: Buffer[], sessionKey: SessionKey): Buffer;
/** @return session key that can be used to reference the session later */
export declare function createMusig2SigningSession(sessionArgs: {
    pubNonces: Tuple<Buffer>;
    txHash: Buffer;
    pubKeys: Tuple<Buffer>;
    internalPubKey: Buffer;
    tapTreeRoot: Buffer;
}): SessionKey;
/**
 * @returns psbt proprietary key for musig2 participant key value data
 * If no key value exists, undefined is returned.
 */
export declare function parsePsbtMusig2Participants(input: PsbtInput): PsbtMusig2Participants | undefined;
/**
 * @returns psbt proprietary key for musig2 public nonce key value data
 * If no key value exists, undefined is returned.
 */
export declare function parsePsbtMusig2Nonces(input: PsbtInput): PsbtMusig2PubNonce[] | undefined;
/**
 * @returns psbt proprietary key for musig2 partial sig key value data
 * If no key value exists, undefined is returned.
 */
export declare function parsePsbtMusig2PartialSigs(input: PsbtInput): PsbtMusig2PartialSig[] | undefined;
/**
 * Assert musig2 participant key value data with tapInternalKey and tapMerkleRoot.
 * <tapOutputKey><tapInputKey> => <participantKey1><participantKey2>
 * Using tapMerkleRoot and 2 participant keys, the tapInputKey is validated and using tapMerkleRoot and tapInputKey,
 * the tapOutputKey is validated.
 */
export declare function assertPsbtMusig2Participants(participantKeyValData: PsbtMusig2Participants, tapInternalKey: Buffer, tapMerkleRoot: Buffer): void;
/**
 * Assert musig2 public nonce key value data with participant key value data
 * (refer assertPsbtMusig2ParticipantsKeyValData).
 * <participantKey1><tapOutputKey> => <pubNonce1>
 * <participantKey2><tapOutputKey> => <pubNonce2>
 * Checks against participant keys and tapOutputKey
 */
export declare function assertPsbtMusig2Nonces(noncesKeyValData: PsbtMusig2PubNonce[], participantKeyValData: PsbtMusig2Participants): void;
/**
 * @returns Input object but sig hash type data is taken out from partialSig field.
 * If sig hash type is not common for all sigs, error out, otherwise returns the modified object and single hash type.
 */
export declare function getSigHashTypeFromSigs(partialSigs: PsbtMusig2PartialSig[]): {
    partialSigs: PsbtMusig2PartialSig[];
    sigHashType: number;
};
export declare function createMusig2DeterministicNonce(params: PsbtMusig2DeterministicParams): Buffer;
export declare function musig2DeterministicSign(params: PsbtMusig2DeterministicParams): {
    sig: Buffer;
    sessionKey: SessionKey;
    publicNonce: Buffer;
};
//# sourceMappingURL=Musig2.d.ts.map