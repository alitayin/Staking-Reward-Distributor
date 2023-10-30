"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.musig2DeterministicSign = exports.createMusig2DeterministicNonce = exports.getSigHashTypeFromSigs = exports.assertPsbtMusig2Nonces = exports.assertPsbtMusig2Participants = exports.parsePsbtMusig2PartialSigs = exports.parsePsbtMusig2Nonces = exports.parsePsbtMusig2Participants = exports.createMusig2SigningSession = exports.musig2AggregateSigs = exports.musig2PartialSigVerify = exports.musig2PartialSign = exports.createTapTweak = exports.createAggregateNonce = exports.createTapOutputKey = exports.createTapInternalKey = exports.decodePsbtMusig2PartialSig = exports.decodePsbtMusig2Nonce = exports.decodePsbtMusig2Participants = exports.encodePsbtMusig2PartialSig = exports.encodePsbtMusig2PubNonce = exports.encodePsbtMusig2Participants = exports.Musig2NonceStore = void 0;
const outputScripts_1 = require("./outputScripts");
const noble_ecc_1 = require("../noble_ecc");
const taproot_1 = require("../taproot");
const index_1 = require("../index");
const PsbtUtil_1 = require("./PsbtUtil");
/**
 * Because musig uses reference-equal buffers to cache nonces, we wrap it here to allow using
 * nonces that are byte-equal but not reference-equal.
 */
class Musig2NonceStore {
    constructor() {
        this.nonces = [];
    }
    /**
     * Get original Buffer instance for nonce (which may be a copy).
     * @return byte-equal buffer that is reference-equal to what was stored earlier in createMusig2Nonce
     */
    getRef(nonce) {
        for (const b of this.nonces) {
            if (Buffer.from(b).equals(nonce)) {
                return b;
            }
        }
        throw new Error(`unknown nonce`);
    }
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
    createMusig2Nonce(privateKey, publicKey, xOnlyPublicKey, txHash, sessionId) {
        if (txHash.length != 32) {
            throw new Error(`Invalid txHash size ${txHash}`);
        }
        const buf = noble_ecc_1.musig.nonceGen({ secretKey: privateKey, publicKey, xOnlyPublicKey, msg: txHash, sessionId });
        this.nonces.push(buf);
        return buf;
    }
}
exports.Musig2NonceStore = Musig2NonceStore;
/**
 * Psbt proprietary key val util function for participants pub keys. SubType is 0x01
 * Ref: https://gist.github.com/sanket1729/4b525c6049f4d9e034d27368c49f28a6
 * @return x-only tapOutputKey||tapInternalKey as sub keydata, plain sigining participant keys as valuedata
 */
function encodePsbtMusig2Participants(participants) {
    const keydata = [participants.tapOutputKey, participants.tapInternalKey].map((pubkey) => outputScripts_1.checkXOnlyPublicKey(pubkey));
    const value = participants.participantPubKeys.map((pubkey) => outputScripts_1.checkPlainPublicKey(pubkey));
    const key = {
        identifier: PsbtUtil_1.PSBT_PROPRIETARY_IDENTIFIER,
        subtype: PsbtUtil_1.ProprietaryKeySubtype.MUSIG2_PARTICIPANT_PUB_KEYS,
        keydata: Buffer.concat(keydata),
    };
    return { key, value: Buffer.concat(value) };
}
exports.encodePsbtMusig2Participants = encodePsbtMusig2Participants;
/**
 * Psbt proprietary key val util function for pub nonce. SubType is 0x02
 * Ref: https://gist.github.com/sanket1729/4b525c6049f4d9e034d27368c49f28a6
 * @return plain-participantPubKey||x-only-tapOutputKey as sub keydata, 66 bytes of 2 pub nonces as valuedata
 */
function encodePsbtMusig2PubNonce(nonce) {
    if (nonce.pubNonce.length !== 66) {
        throw new Error(`Invalid pubNonces length ${nonce.pubNonce.length}`);
    }
    const keydata = Buffer.concat([
        outputScripts_1.checkPlainPublicKey(nonce.participantPubKey),
        outputScripts_1.checkXOnlyPublicKey(nonce.tapOutputKey),
    ]);
    const key = {
        identifier: PsbtUtil_1.PSBT_PROPRIETARY_IDENTIFIER,
        subtype: PsbtUtil_1.ProprietaryKeySubtype.MUSIG2_PUB_NONCE,
        keydata,
    };
    return { key, value: nonce.pubNonce };
}
exports.encodePsbtMusig2PubNonce = encodePsbtMusig2PubNonce;
function encodePsbtMusig2PartialSig(partialSig) {
    if (partialSig.partialSig.length !== 32 && partialSig.partialSig.length !== 33) {
        throw new Error(`Invalid partialSig length ${partialSig.partialSig.length}`);
    }
    const keydata = Buffer.concat([
        outputScripts_1.checkPlainPublicKey(partialSig.participantPubKey),
        outputScripts_1.checkXOnlyPublicKey(partialSig.tapOutputKey),
    ]);
    const key = {
        identifier: PsbtUtil_1.PSBT_PROPRIETARY_IDENTIFIER,
        subtype: PsbtUtil_1.ProprietaryKeySubtype.MUSIG2_PARTIAL_SIG,
        keydata,
    };
    return { key, value: partialSig.partialSig };
}
exports.encodePsbtMusig2PartialSig = encodePsbtMusig2PartialSig;
/**
 * Decodes proprietary key value data for participant pub keys
 * @param kv
 */
function decodePsbtMusig2Participants(kv) {
    if (kv.key.identifier !== PsbtUtil_1.PSBT_PROPRIETARY_IDENTIFIER ||
        kv.key.subtype !== PsbtUtil_1.ProprietaryKeySubtype.MUSIG2_PARTICIPANT_PUB_KEYS) {
        throw new Error(`Invalid identifier ${kv.key.identifier} or subtype ${kv.key.subtype} for participants pub keys`);
    }
    const key = kv.key.keydata;
    if (key.length !== 64) {
        throw new Error(`Invalid keydata size ${key.length} for participant pub keys`);
    }
    const value = kv.value;
    if (value.length !== 66) {
        throw new Error(`Invalid valuedata size ${value.length} for participant pub keys`);
    }
    const participantPubKeys = [value.subarray(0, 33), value.subarray(33)];
    if (participantPubKeys[0].equals(participantPubKeys[1])) {
        throw new Error(`Duplicate participant pub keys found`);
    }
    return { tapOutputKey: key.subarray(0, 32), tapInternalKey: key.subarray(32), participantPubKeys };
}
exports.decodePsbtMusig2Participants = decodePsbtMusig2Participants;
/**
 * Decodes proprietary key value data for musig2 nonce
 * @param kv
 */
function decodePsbtMusig2Nonce(kv) {
    if (kv.key.identifier !== PsbtUtil_1.PSBT_PROPRIETARY_IDENTIFIER || kv.key.subtype !== PsbtUtil_1.ProprietaryKeySubtype.MUSIG2_PUB_NONCE) {
        throw new Error(`Invalid identifier ${kv.key.identifier} or subtype ${kv.key.subtype} for nonce`);
    }
    const key = kv.key.keydata;
    if (key.length !== 65) {
        throw new Error(`Invalid keydata size ${key.length} for nonce`);
    }
    const value = kv.value;
    if (value.length !== 66) {
        throw new Error(`Invalid valuedata size ${value.length} for nonce`);
    }
    return { participantPubKey: key.subarray(0, 33), tapOutputKey: key.subarray(33), pubNonce: value };
}
exports.decodePsbtMusig2Nonce = decodePsbtMusig2Nonce;
/**
 * Decodes proprietary key value data for musig2 partial sig
 * @param kv
 */
function decodePsbtMusig2PartialSig(kv) {
    if (kv.key.identifier !== PsbtUtil_1.PSBT_PROPRIETARY_IDENTIFIER ||
        kv.key.subtype !== PsbtUtil_1.ProprietaryKeySubtype.MUSIG2_PARTIAL_SIG) {
        throw new Error(`Invalid identifier ${kv.key.identifier} or subtype ${kv.key.subtype} for partial sig`);
    }
    const key = kv.key.keydata;
    if (key.length !== 65) {
        throw new Error(`Invalid keydata size ${key.length} for partial sig`);
    }
    const value = kv.value;
    if (value.length !== 32 && value.length !== 33) {
        throw new Error(`Invalid valuedata size ${value.length} for partial sig`);
    }
    return { participantPubKey: key.subarray(0, 33), tapOutputKey: key.subarray(33), partialSig: value };
}
exports.decodePsbtMusig2PartialSig = decodePsbtMusig2PartialSig;
function createTapInternalKey(plainPubKeys) {
    return Buffer.from(noble_ecc_1.musig.getXOnlyPubkey(noble_ecc_1.musig.keyAgg(plainPubKeys)));
}
exports.createTapInternalKey = createTapInternalKey;
function createTapOutputKey(internalPubKey, tapTreeRoot) {
    return Buffer.from(taproot_1.tapTweakPubkey(noble_ecc_1.ecc, outputScripts_1.toXOnlyPublicKey(internalPubKey), outputScripts_1.checkTapMerkleRoot(tapTreeRoot)).xOnlyPubkey);
}
exports.createTapOutputKey = createTapOutputKey;
function createAggregateNonce(pubNonces) {
    return Buffer.from(noble_ecc_1.musig.nonceAgg(pubNonces));
}
exports.createAggregateNonce = createAggregateNonce;
function createTapTweak(tapInternalKey, tapMerkleRoot) {
    return Buffer.from(taproot_1.calculateTapTweak(outputScripts_1.checkXOnlyPublicKey(tapInternalKey), outputScripts_1.checkTapMerkleRoot(tapMerkleRoot)));
}
exports.createTapTweak = createTapTweak;
function startMusig2SigningSession(aggNonce, hash, publicKeys, tweak) {
    return noble_ecc_1.musig.startSigningSession(aggNonce, hash, publicKeys, { tweak, xOnly: true });
}
function musig2PartialSign(privateKey, publicNonce, sessionKey, nonceStore) {
    outputScripts_1.checkTxHash(Buffer.from(sessionKey.msg));
    return Buffer.from(noble_ecc_1.musig.partialSign({
        secretKey: privateKey,
        publicNonce: nonceStore.getRef(publicNonce),
        sessionKey,
    }));
}
exports.musig2PartialSign = musig2PartialSign;
function musig2PartialSigVerify(sig, publicKey, publicNonce, sessionKey) {
    outputScripts_1.checkTxHash(Buffer.from(sessionKey.msg));
    return noble_ecc_1.musig.partialVerify({ sig, publicKey, publicNonce, sessionKey });
}
exports.musig2PartialSigVerify = musig2PartialSigVerify;
function musig2AggregateSigs(sigs, sessionKey) {
    return Buffer.from(noble_ecc_1.musig.signAgg(sigs, sessionKey));
}
exports.musig2AggregateSigs = musig2AggregateSigs;
/** @return session key that can be used to reference the session later */
function createMusig2SigningSession(sessionArgs) {
    outputScripts_1.checkTxHash(sessionArgs.txHash);
    const aggNonce = createAggregateNonce(sessionArgs.pubNonces);
    const tweak = createTapTweak(sessionArgs.internalPubKey, sessionArgs.tapTreeRoot);
    return startMusig2SigningSession(aggNonce, sessionArgs.txHash, sessionArgs.pubKeys, tweak);
}
exports.createMusig2SigningSession = createMusig2SigningSession;
/**
 * @returns psbt proprietary key for musig2 participant key value data
 * If no key value exists, undefined is returned.
 */
function parsePsbtMusig2Participants(input) {
    const participantsKeyVals = PsbtUtil_1.getPsbtInputProprietaryKeyVals(input, {
        identifier: PsbtUtil_1.PSBT_PROPRIETARY_IDENTIFIER,
        subtype: PsbtUtil_1.ProprietaryKeySubtype.MUSIG2_PARTICIPANT_PUB_KEYS,
    });
    if (!participantsKeyVals.length) {
        return undefined;
    }
    if (participantsKeyVals.length > 1) {
        throw new Error(`Found ${participantsKeyVals.length} matching participant key value instead of 1`);
    }
    return decodePsbtMusig2Participants(participantsKeyVals[0]);
}
exports.parsePsbtMusig2Participants = parsePsbtMusig2Participants;
/**
 * @returns psbt proprietary key for musig2 public nonce key value data
 * If no key value exists, undefined is returned.
 */
function parsePsbtMusig2Nonces(input) {
    const nonceKeyVals = PsbtUtil_1.getPsbtInputProprietaryKeyVals(input, {
        identifier: PsbtUtil_1.PSBT_PROPRIETARY_IDENTIFIER,
        subtype: PsbtUtil_1.ProprietaryKeySubtype.MUSIG2_PUB_NONCE,
    });
    if (!nonceKeyVals.length) {
        return undefined;
    }
    if (nonceKeyVals.length > 2) {
        throw new Error(`Found ${nonceKeyVals.length} matching nonce key value instead of 1 or 2`);
    }
    return nonceKeyVals.map((kv) => decodePsbtMusig2Nonce(kv));
}
exports.parsePsbtMusig2Nonces = parsePsbtMusig2Nonces;
/**
 * @returns psbt proprietary key for musig2 partial sig key value data
 * If no key value exists, undefined is returned.
 */
function parsePsbtMusig2PartialSigs(input) {
    const sigKeyVals = PsbtUtil_1.getPsbtInputProprietaryKeyVals(input, {
        identifier: PsbtUtil_1.PSBT_PROPRIETARY_IDENTIFIER,
        subtype: PsbtUtil_1.ProprietaryKeySubtype.MUSIG2_PARTIAL_SIG,
    });
    if (!sigKeyVals.length) {
        return undefined;
    }
    if (sigKeyVals.length > 2) {
        throw new Error(`Found ${sigKeyVals.length} matching partial signature key value instead of 1 or 2`);
    }
    return sigKeyVals.map((kv) => decodePsbtMusig2PartialSig(kv));
}
exports.parsePsbtMusig2PartialSigs = parsePsbtMusig2PartialSigs;
/**
 * Assert musig2 participant key value data with tapInternalKey and tapMerkleRoot.
 * <tapOutputKey><tapInputKey> => <participantKey1><participantKey2>
 * Using tapMerkleRoot and 2 participant keys, the tapInputKey is validated and using tapMerkleRoot and tapInputKey,
 * the tapOutputKey is validated.
 */
function assertPsbtMusig2Participants(participantKeyValData, tapInternalKey, tapMerkleRoot) {
    outputScripts_1.checkXOnlyPublicKey(tapInternalKey);
    outputScripts_1.checkTapMerkleRoot(tapMerkleRoot);
    const participantPubKeys = participantKeyValData.participantPubKeys;
    const internalKey = createTapInternalKey(participantPubKeys);
    if (!internalKey.equals(participantKeyValData.tapInternalKey)) {
        throw new Error('Invalid participants keydata tapInternalKey');
    }
    const outputKey = createTapOutputKey(internalKey, tapMerkleRoot);
    if (!outputKey.equals(participantKeyValData.tapOutputKey)) {
        throw new Error('Invalid participants keydata tapOutputKey');
    }
    if (!internalKey.equals(tapInternalKey)) {
        throw new Error('tapInternalKey and aggregated participant pub keys does not match');
    }
}
exports.assertPsbtMusig2Participants = assertPsbtMusig2Participants;
/**
 * Assert musig2 public nonce key value data with participant key value data
 * (refer assertPsbtMusig2ParticipantsKeyValData).
 * <participantKey1><tapOutputKey> => <pubNonce1>
 * <participantKey2><tapOutputKey> => <pubNonce2>
 * Checks against participant keys and tapOutputKey
 */
function assertPsbtMusig2Nonces(noncesKeyValData, participantKeyValData) {
    outputScripts_1.checkXOnlyPublicKey(participantKeyValData.tapOutputKey);
    participantKeyValData.participantPubKeys.forEach((kv) => outputScripts_1.checkPlainPublicKey(kv));
    if (participantKeyValData.participantPubKeys[0].equals(participantKeyValData.participantPubKeys[1])) {
        throw new Error(`Duplicate participant pub keys found`);
    }
    if (noncesKeyValData.length > 2) {
        throw new Error(`Invalid nonce key value count ${noncesKeyValData.length}`);
    }
    noncesKeyValData.forEach((nonceKv) => {
        const index = participantKeyValData.participantPubKeys.findIndex((pubKey) => nonceKv.participantPubKey.equals(pubKey));
        if (index < 0) {
            throw new Error('Invalid nonce keydata participant pub key');
        }
        if (!nonceKv.tapOutputKey.equals(participantKeyValData.tapOutputKey)) {
            throw new Error('Invalid nonce keydata tapOutputKey');
        }
    });
}
exports.assertPsbtMusig2Nonces = assertPsbtMusig2Nonces;
/**
 * @returns Input object but sig hash type data is taken out from partialSig field.
 * If sig hash type is not common for all sigs, error out, otherwise returns the modified object and single hash type.
 */
function getSigHashTypeFromSigs(partialSigs) {
    if (!partialSigs.length) {
        throw new Error('partialSigs array can not be empty');
    }
    const pSigsWithHashType = partialSigs.map((kv) => {
        const { partialSig, participantPubKey, tapOutputKey } = kv;
        return partialSig.length === 33
            ? { pSig: { partialSig: partialSig.slice(0, 32), participantPubKey, tapOutputKey }, sigHashType: partialSig[32] }
            : { pSig: { partialSig, participantPubKey, tapOutputKey }, sigHashType: index_1.Transaction.SIGHASH_DEFAULT };
    });
    const sigHashType = pSigsWithHashType[0].sigHashType;
    if (!pSigsWithHashType.every((pSig) => pSig.sigHashType === sigHashType)) {
        throw new Error('signatures must use same sig hash type');
    }
    return { partialSigs: pSigsWithHashType.map(({ pSig }) => pSig), sigHashType };
}
exports.getSigHashTypeFromSigs = getSigHashTypeFromSigs;
function createMusig2DeterministicNonce(params) {
    return Buffer.from(noble_ecc_1.musig.deterministicNonceGen({
        secretKey: params.privateKey,
        aggOtherNonce: noble_ecc_1.musig.nonceAgg([params.otherNonce]),
        publicKeys: params.publicKeys,
        tweaks: [{ tweak: createTapTweak(params.internalPubKey, params.tapTreeRoot), xOnly: true }],
        msg: params.hash,
    }).publicNonce);
}
exports.createMusig2DeterministicNonce = createMusig2DeterministicNonce;
function musig2DeterministicSign(params) {
    const { sig, sessionKey, publicNonce } = noble_ecc_1.musig.deterministicSign({
        secretKey: params.privateKey,
        aggOtherNonce: noble_ecc_1.musig.nonceAgg([params.otherNonce]),
        publicKeys: params.publicKeys,
        tweaks: [{ tweak: createTapTweak(params.internalPubKey, params.tapTreeRoot), xOnly: true }],
        msg: params.hash,
    });
    return { sig: Buffer.from(sig), sessionKey, publicNonce: Buffer.from(publicNonce) };
}
exports.musig2DeterministicSign = musig2DeterministicSign;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTXVzaWcyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2JpdGdvL011c2lnMi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFFQSxtREFNeUI7QUFDekIsNENBQTBDO0FBRTFDLHdDQUErRDtBQUMvRCxvQ0FBdUM7QUFFdkMseUNBS29CO0FBc0NwQjs7O0dBR0c7QUFDSCxNQUFhLGdCQUFnQjtJQUE3QjtRQUNVLFdBQU0sR0FBaUIsRUFBRSxDQUFDO0lBd0NwQyxDQUFDO0lBdENDOzs7T0FHRztJQUNILE1BQU0sQ0FBQyxLQUFpQjtRQUN0QixLQUFLLE1BQU0sQ0FBQyxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDM0IsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRTtnQkFDaEMsT0FBTyxDQUFDLENBQUM7YUFDVjtTQUNGO1FBQ0QsTUFBTSxJQUFJLEtBQUssQ0FBQyxlQUFlLENBQUMsQ0FBQztJQUNuQyxDQUFDO0lBRUQ7Ozs7Ozs7Ozs7T0FVRztJQUNILGlCQUFpQixDQUNmLFVBQXNCLEVBQ3RCLFNBQXFCLEVBQ3JCLGNBQTBCLEVBQzFCLE1BQWtCLEVBQ2xCLFNBQWtCO1FBRWxCLElBQUksTUFBTSxDQUFDLE1BQU0sSUFBSSxFQUFFLEVBQUU7WUFDdkIsTUFBTSxJQUFJLEtBQUssQ0FBQyx1QkFBdUIsTUFBTSxFQUFFLENBQUMsQ0FBQztTQUNsRDtRQUNELE1BQU0sR0FBRyxHQUFHLGlCQUFLLENBQUMsUUFBUSxDQUFDLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsY0FBYyxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQztRQUN6RyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUN0QixPQUFPLEdBQUcsQ0FBQztJQUNiLENBQUM7Q0FDRjtBQXpDRCw0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Q0FBQyxJQUFJO0tBQ2pCLENBQUMsQ0FBQyxXQUFXLENBQ2YsQ0FBQztBQUNKLENBQUM7QUFWRCx3RUFVQztBQUVELFNBQWdCLHVCQUF1QixDQUFDLE1BQXFDO0lBSzNFLE1BQU0sRUFBRSxHQUFHLEVBQUUsVUFBVSxFQUFFLFdBQVcsRUFBRSxHQUFHLGlCQUFLLENBQUMsaUJBQWlCLENBQUM7UUFDL0QsU0FBUyxFQUFFLE1BQU0sQ0FBQyxVQUFVO1FBQzVCLGFBQWEsRUFBRSxpQkFBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNsRCxVQUFVLEVBQUUsTUFBTSxDQUFDLFVBQVU7UUFDN0IsTUFBTSxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsY0FBYyxDQUFDLE1BQU0sQ0FBQyxjQUFjLEVBQUUsTUFBTSxDQUFDLFdBQVcsQ0FBQyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsQ0FBQztRQUMzRixHQUFHLEVBQUUsTUFBTSxDQUFDLElBQUk7S0FDakIsQ0FBQyxDQUFDO0lBQ0gsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDO0FBQ3RGLENBQUM7QUFiRCwwREFhQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFNlc3Npb25LZXkgfSBmcm9tICdAYnJhbmRvbmJsYWNrL211c2lnJztcblxuaW1wb3J0IHtcbiAgY2hlY2tQbGFpblB1YmxpY0tleSxcbiAgY2hlY2tUYXBNZXJrbGVSb290LFxuICBjaGVja1R4SGFzaCxcbiAgY2hlY2tYT25seVB1YmxpY0tleSxcbiAgdG9YT25seVB1YmxpY0tleSxcbn0gZnJvbSAnLi9vdXRwdXRTY3JpcHRzJztcbmltcG9ydCB7IGVjYywgbXVzaWcgfSBmcm9tICcuLi9ub2JsZV9lY2MnO1xuaW1wb3J0IHsgVHVwbGUgfSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IGNhbGN1bGF0ZVRhcFR3ZWFrLCB0YXBUd2Vha1B1YmtleSB9IGZyb20gJy4uL3RhcHJvb3QnO1xuaW1wb3J0IHsgVHJhbnNhY3Rpb24gfSBmcm9tICcuLi9pbmRleCc7XG5pbXBvcnQgeyBQc2J0SW5wdXQgfSBmcm9tICdiaXAxNzQvc3JjL2xpYi9pbnRlcmZhY2VzJztcbmltcG9ydCB7XG4gIGdldFBzYnRJbnB1dFByb3ByaWV0YXJ5S2V5VmFscyxcbiAgUHJvcHJpZXRhcnlLZXlTdWJ0eXBlLFxuICBQcm9wcmlldGFyeUtleVZhbHVlLFxuICBQU0JUX1BST1BSSUVUQVJZX0lERU5USUZJRVIsXG59IGZyb20gJy4vUHNidFV0aWwnO1xuXG4vKipcbiAqICBQYXJ0aWNpcGFudCBrZXkgdmFsdWUgb2JqZWN0LlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFBzYnRNdXNpZzJQYXJ0aWNpcGFudHMge1xuICB0YXBPdXRwdXRLZXk6IEJ1ZmZlcjtcbiAgdGFwSW50ZXJuYWxLZXk6IEJ1ZmZlcjtcbiAgcGFydGljaXBhbnRQdWJLZXlzOiBUdXBsZTxCdWZmZXI+O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFBzYnRNdXNpZzJEZXRlcm1pbmlzdGljUGFyYW1zIHtcbiAgcHJpdmF0ZUtleTogQnVmZmVyO1xuICBvdGhlck5vbmNlOiBCdWZmZXI7XG4gIHB1YmxpY0tleXM6IFR1cGxlPEJ1ZmZlcj47XG4gIGludGVybmFsUHViS2V5OiBCdWZmZXI7XG4gIHRhcFRyZWVSb290OiBCdWZmZXI7XG4gIGhhc2g6IEJ1ZmZlcjtcbn1cblxuLyoqXG4gKiAgTm9uY2Uga2V5IHZhbHVlIG9iamVjdC5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQc2J0TXVzaWcyUHViTm9uY2Uge1xuICBwYXJ0aWNpcGFudFB1YktleTogQnVmZmVyO1xuICB0YXBPdXRwdXRLZXk6IEJ1ZmZlcjtcbiAgcHViTm9uY2U6IEJ1ZmZlcjtcbn1cblxuLyoqXG4gKiAgUGFydGlhbCBzaWduYXR1cmUga2V5IHZhbHVlIG9iamVjdC5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQc2J0TXVzaWcyUGFydGlhbFNpZyB7XG4gIHBhcnRpY2lwYW50UHViS2V5OiBCdWZmZXI7XG4gIHRhcE91dHB1dEtleTogQnVmZmVyO1xuICBwYXJ0aWFsU2lnOiBCdWZmZXI7XG59XG5cbi8qKlxuICogQmVjYXVzZSBtdXNpZyB1c2VzIHJlZmVyZW5jZS1lcXVhbCBidWZmZXJzIHRvIGNhY2hlIG5vbmNlcywgd2Ugd3JhcCBpdCBoZXJlIHRvIGFsbG93IHVzaW5nXG4gKiBub25jZXMgdGhhdCBhcmUgYnl0ZS1lcXVhbCBidXQgbm90IHJlZmVyZW5jZS1lcXVhbC5cbiAqL1xuZXhwb3J0IGNsYXNzIE11c2lnMk5vbmNlU3RvcmUge1xuICBwcml2YXRlIG5vbmNlczogVWludDhBcnJheVtdID0gW107XG5cbiAgLyoqXG4gICAqIEdldCBvcmlnaW5hbCBCdWZmZXIgaW5zdGFuY2UgZm9yIG5vbmNlICh3aGljaCBtYXkgYmUgYSBjb3B5KS5cbiAgICogQHJldHVybiBieXRlLWVxdWFsIGJ1ZmZlciB0aGF0IGlzIHJlZmVyZW5jZS1lcXVhbCB0byB3aGF0IHdhcyBzdG9yZWQgZWFybGllciBpbiBjcmVhdGVNdXNpZzJOb25jZVxuICAgKi9cbiAgZ2V0UmVmKG5vbmNlOiBVaW50OEFycmF5KTogVWludDhBcnJheSB7XG4gICAgZm9yIChjb25zdCBiIG9mIHRoaXMubm9uY2VzKSB7XG4gICAgICBpZiAoQnVmZmVyLmZyb20oYikuZXF1YWxzKG5vbmNlKSkge1xuICAgICAgICByZXR1cm4gYjtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmtub3duIG5vbmNlYCk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBtdXNpZzIgbm9uY2UgYW5kIHN0b3JlcyBidWZmZXIgcmVmZXJlbmNlLlxuICAgKiB0YXBJbnRlcm5hbGtleSwgdGFwTWVya2xlUm9vdCwgdGFwQmlwMzJEZXJpdmF0aW9uIGZvciByb290V2FsbGV0S2V5IGFyZSByZXF1aXJlZCBwZXIgcDJ0ck11c2lnMiBrZXkgcGF0aCBpbnB1dC5cbiAgICogQWxzbyBwYXJ0aWNpcGFudCBrZXlzIGFyZSByZXF1aXJlZCBmcm9tIHBzYnQgcHJvcHJpZXRhcnkga2V5IHZhbHVlcy5cbiAgICogUmVmOiBodHRwczovL2dpc3QuZ2l0aHViLmNvbS9zYW5rZXQxNzI5LzRiNTI1YzYwNDlmNGQ5ZTAzNGQyNzM2OGM0OWYyOGE2XG4gICAqIEBwYXJhbSBwcml2YXRlS2V5IC0gc2lnbmVyIHByaXZhdGUga2V5XG4gICAqIEBwYXJhbSBwdWJsaWNLZXkgLSBzaWduZXIgeHkgcHVibGljIGtleVxuICAgKiBAcGFyYW0geE9ubHlQdWJsaWNLZXkgLSB0d2Vha2VkIGFnZ3JlZ2F0ZWQga2V5ICh0YXBPdXRwdXRLZXkpXG4gICAqIEBwYXJhbSBzZXNzaW9uSWQgQWRkaXRpb25hbCBlbnRyb3B5LiBJZiBwcm92aWRlZCBpdCBtdXN0IGVpdGhlciBiZSBhIGNvdW50ZXIgdW5pcXVlIHRvIHRoaXMgc2VjcmV0IGtleSxcbiAgICogKGNvbnZlcnRlZCB0byBhbiBhcnJheSBvZiAzMiBieXRlcyksIG9yIDMyIHVuaWZvcm1seSByYW5kb20gYnl0ZXMuXG4gICAqL1xuICBjcmVhdGVNdXNpZzJOb25jZShcbiAgICBwcml2YXRlS2V5OiBVaW50OEFycmF5LFxuICAgIHB1YmxpY0tleTogVWludDhBcnJheSxcbiAgICB4T25seVB1YmxpY0tleTogVWludDhBcnJheSxcbiAgICB0eEhhc2g6IFVpbnQ4QXJyYXksXG4gICAgc2Vzc2lvbklkPzogQnVmZmVyXG4gICk6IFVpbnQ4QXJyYXkge1xuICAgIGlmICh0eEhhc2gubGVuZ3RoICE9IDMyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgdHhIYXNoIHNpemUgJHt0eEhhc2h9YCk7XG4gICAgfVxuICAgIGNvbnN0IGJ1ZiA9IG11c2lnLm5vbmNlR2VuKHsgc2VjcmV0S2V5OiBwcml2YXRlS2V5LCBwdWJsaWNLZXksIHhPbmx5UHVibGljS2V5LCBtc2c6IHR4SGFzaCwgc2Vzc2lvbklkIH0pO1xuICAgIHRoaXMubm9uY2VzLnB1c2goYnVmKTtcbiAgICByZXR1cm4gYnVmO1xuICB9XG59XG5cbi8qKlxuICogUHNidCBwcm9wcmlldGFyeSBrZXkgdmFsIHV0aWwgZnVuY3Rpb24gZm9yIHBhcnRpY2lwYW50cyBwdWIga2V5cy4gU3ViVHlwZSBpcyAweDAxXG4gKiBSZWY6IGh0dHBzOi8vZ2lzdC5naXRodWIuY29tL3NhbmtldDE3MjkvNGI1MjVjNjA0OWY0ZDllMDM0ZDI3MzY4YzQ5ZjI4YTZcbiAqIEByZXR1cm4geC1vbmx5IHRhcE91dHB1dEtleXx8dGFwSW50ZXJuYWxLZXkgYXMgc3ViIGtleWRhdGEsIHBsYWluIHNpZ2luaW5nIHBhcnRpY2lwYW50IGtleXMgYXMgdmFsdWVkYXRhXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBlbmNvZGVQc2J0TXVzaWcyUGFydGljaXBhbnRzKHBhcnRpY2lwYW50czogUHNidE11c2lnMlBhcnRpY2lwYW50cyk6IFByb3ByaWV0YXJ5S2V5VmFsdWUge1xuICBjb25zdCBrZXlkYXRhID0gW3BhcnRpY2lwYW50cy50YXBPdXRwdXRLZXksIHBhcnRpY2lwYW50cy50YXBJbnRlcm5hbEtleV0ubWFwKChwdWJrZXkpID0+IGNoZWNrWE9ubHlQdWJsaWNLZXkocHVia2V5KSk7XG4gIGNvbnN0IHZhbHVlID0gcGFydGljaXBhbnRzLnBhcnRpY2lwYW50UHViS2V5cy5tYXAoKHB1YmtleSkgPT4gY2hlY2tQbGFpblB1YmxpY0tleShwdWJrZXkpKTtcbiAgY29uc3Qga2V5ID0ge1xuICAgIGlkZW50aWZpZXI6IFBTQlRfUFJPUFJJRVRBUllfSURFTlRJRklFUixcbiAgICBzdWJ0eXBlOiBQcm9wcmlldGFyeUtleVN1YnR5cGUuTVVTSUcyX1BBUlRJQ0lQQU5UX1BVQl9LRVlTLFxuICAgIGtleWRhdGE6IEJ1ZmZlci5jb25jYXQoa2V5ZGF0YSksXG4gIH07XG4gIHJldHVybiB7IGtleSwgdmFsdWU6IEJ1ZmZlci5jb25jYXQodmFsdWUpIH07XG59XG5cbi8qKlxuICogUHNidCBwcm9wcmlldGFyeSBrZXkgdmFsIHV0aWwgZnVuY3Rpb24gZm9yIHB1YiBub25jZS4gU3ViVHlwZSBpcyAweDAyXG4gKiBSZWY6IGh0dHBzOi8vZ2lzdC5naXRodWIuY29tL3NhbmtldDE3MjkvNGI1MjVjNjA0OWY0ZDllMDM0ZDI3MzY4YzQ5ZjI4YTZcbiAqIEByZXR1cm4gcGxhaW4tcGFydGljaXBhbnRQdWJLZXl8fHgtb25seS10YXBPdXRwdXRLZXkgYXMgc3ViIGtleWRhdGEsIDY2IGJ5dGVzIG9mIDIgcHViIG5vbmNlcyBhcyB2YWx1ZWRhdGFcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGVuY29kZVBzYnRNdXNpZzJQdWJOb25jZShub25jZTogUHNidE11c2lnMlB1Yk5vbmNlKTogUHJvcHJpZXRhcnlLZXlWYWx1ZSB7XG4gIGlmIChub25jZS5wdWJOb25jZS5sZW5ndGggIT09IDY2KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHB1Yk5vbmNlcyBsZW5ndGggJHtub25jZS5wdWJOb25jZS5sZW5ndGh9YCk7XG4gIH1cbiAgY29uc3Qga2V5ZGF0YSA9IEJ1ZmZlci5jb25jYXQoW1xuICAgIGNoZWNrUGxhaW5QdWJsaWNLZXkobm9uY2UucGFydGljaXBhbnRQdWJLZXkpLFxuICAgIGNoZWNrWE9ubHlQdWJsaWNLZXkobm9uY2UudGFwT3V0cHV0S2V5KSxcbiAgXSk7XG4gIGNvbnN0IGtleSA9IHtcbiAgICBpZGVudGlmaWVyOiBQU0JUX1BST1BSSUVUQVJZX0lERU5USUZJRVIsXG4gICAgc3VidHlwZTogUHJvcHJpZXRhcnlLZXlTdWJ0eXBlLk1VU0lHMl9QVUJfTk9OQ0UsXG4gICAga2V5ZGF0YSxcbiAgfTtcbiAgcmV0dXJuIHsga2V5LCB2YWx1ZTogbm9uY2UucHViTm9uY2UgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVuY29kZVBzYnRNdXNpZzJQYXJ0aWFsU2lnKHBhcnRpYWxTaWc6IFBzYnRNdXNpZzJQYXJ0aWFsU2lnKTogUHJvcHJpZXRhcnlLZXlWYWx1ZSB7XG4gIGlmIChwYXJ0aWFsU2lnLnBhcnRpYWxTaWcubGVuZ3RoICE9PSAzMiAmJiBwYXJ0aWFsU2lnLnBhcnRpYWxTaWcubGVuZ3RoICE9PSAzMykge1xuICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBwYXJ0aWFsU2lnIGxlbmd0aCAke3BhcnRpYWxTaWcucGFydGlhbFNpZy5sZW5ndGh9YCk7XG4gIH1cbiAgY29uc3Qga2V5ZGF0YSA9IEJ1ZmZlci5jb25jYXQoW1xuICAgIGNoZWNrUGxhaW5QdWJsaWNLZXkocGFydGlhbFNpZy5wYXJ0aWNpcGFudFB1YktleSksXG4gICAgY2hlY2tYT25seVB1YmxpY0tleShwYXJ0aWFsU2lnLnRhcE91dHB1dEtleSksXG4gIF0pO1xuICBjb25zdCBrZXkgPSB7XG4gICAgaWRlbnRpZmllcjogUFNCVF9QUk9QUklFVEFSWV9JREVOVElGSUVSLFxuICAgIHN1YnR5cGU6IFByb3ByaWV0YXJ5S2V5U3VidHlwZS5NVVNJRzJfUEFSVElBTF9TSUcsXG4gICAga2V5ZGF0YSxcbiAgfTtcbiAgcmV0dXJuIHsga2V5LCB2YWx1ZTogcGFydGlhbFNpZy5wYXJ0aWFsU2lnIH07XG59XG5cbi8qKlxuICogRGVjb2RlcyBwcm9wcmlldGFyeSBrZXkgdmFsdWUgZGF0YSBmb3IgcGFydGljaXBhbnQgcHViIGtleXNcbiAqIEBwYXJhbSBrdlxuICovXG5leHBvcnQgZnVuY3Rpb24gZGVjb2RlUHNidE11c2lnMlBhcnRpY2lwYW50cyhrdjogUHJvcHJpZXRhcnlLZXlWYWx1ZSk6IFBzYnRNdXNpZzJQYXJ0aWNpcGFudHMge1xuICBpZiAoXG4gICAga3Yua2V5LmlkZW50aWZpZXIgIT09IFBTQlRfUFJPUFJJRVRBUllfSURFTlRJRklFUiB8fFxuICAgIGt2LmtleS5zdWJ0eXBlICE9PSBQcm9wcmlldGFyeUtleVN1YnR5cGUuTVVTSUcyX1BBUlRJQ0lQQU5UX1BVQl9LRVlTXG4gICkge1xuICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBpZGVudGlmaWVyICR7a3Yua2V5LmlkZW50aWZpZXJ9IG9yIHN1YnR5cGUgJHtrdi5rZXkuc3VidHlwZX0gZm9yIHBhcnRpY2lwYW50cyBwdWIga2V5c2ApO1xuICB9XG5cbiAgY29uc3Qga2V5ID0ga3Yua2V5LmtleWRhdGE7XG4gIGlmIChrZXkubGVuZ3RoICE9PSA2NCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBrZXlkYXRhIHNpemUgJHtrZXkubGVuZ3RofSBmb3IgcGFydGljaXBhbnQgcHViIGtleXNgKTtcbiAgfVxuXG4gIGNvbnN0IHZhbHVlID0ga3YudmFsdWU7XG4gIGlmICh2YWx1ZS5sZW5ndGggIT09IDY2KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHZhbHVlZGF0YSBzaXplICR7dmFsdWUubGVuZ3RofSBmb3IgcGFydGljaXBhbnQgcHViIGtleXNgKTtcbiAgfVxuICBjb25zdCBwYXJ0aWNpcGFudFB1YktleXM6IFR1cGxlPEJ1ZmZlcj4gPSBbdmFsdWUuc3ViYXJyYXkoMCwgMzMpLCB2YWx1ZS5zdWJhcnJheSgzMyldO1xuICBpZiAocGFydGljaXBhbnRQdWJLZXlzWzBdLmVxdWFscyhwYXJ0aWNpcGFudFB1YktleXNbMV0pKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBEdXBsaWNhdGUgcGFydGljaXBhbnQgcHViIGtleXMgZm91bmRgKTtcbiAgfVxuXG4gIHJldHVybiB7IHRhcE91dHB1dEtleToga2V5LnN1YmFycmF5KDAsIDMyKSwgdGFwSW50ZXJuYWxLZXk6IGtleS5zdWJhcnJheSgzMiksIHBhcnRpY2lwYW50UHViS2V5cyB9O1xufVxuXG4vKipcbiAqIERlY29kZXMgcHJvcHJpZXRhcnkga2V5IHZhbHVlIGRhdGEgZm9yIG11c2lnMiBub25jZVxuICogQHBhcmFtIGt2XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZWNvZGVQc2J0TXVzaWcyTm9uY2Uoa3Y6IFByb3ByaWV0YXJ5S2V5VmFsdWUpOiBQc2J0TXVzaWcyUHViTm9uY2Uge1xuICBpZiAoa3Yua2V5LmlkZW50aWZpZXIgIT09IFBTQlRfUFJPUFJJRVRBUllfSURFTlRJRklFUiB8fCBrdi5rZXkuc3VidHlwZSAhPT0gUHJvcHJpZXRhcnlLZXlTdWJ0eXBlLk1VU0lHMl9QVUJfTk9OQ0UpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgaWRlbnRpZmllciAke2t2LmtleS5pZGVudGlmaWVyfSBvciBzdWJ0eXBlICR7a3Yua2V5LnN1YnR5cGV9IGZvciBub25jZWApO1xuICB9XG5cbiAgY29uc3Qga2V5ID0ga3Yua2V5LmtleWRhdGE7XG4gIGlmIChrZXkubGVuZ3RoICE9PSA2NSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBrZXlkYXRhIHNpemUgJHtrZXkubGVuZ3RofSBmb3Igbm9uY2VgKTtcbiAgfVxuXG4gIGNvbnN0IHZhbHVlID0ga3YudmFsdWU7XG4gIGlmICh2YWx1ZS5sZW5ndGggIT09IDY2KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHZhbHVlZGF0YSBzaXplICR7dmFsdWUubGVuZ3RofSBmb3Igbm9uY2VgKTtcbiAgfVxuXG4gIHJldHVybiB7IHBhcnRpY2lwYW50UHViS2V5OiBrZXkuc3ViYXJyYXkoMCwgMzMpLCB0YXBPdXRwdXRLZXk6IGtleS5zdWJhcnJheSgzMyksIHB1Yk5vbmNlOiB2YWx1ZSB9O1xufVxuXG4vKipcbiAqIERlY29kZXMgcHJvcHJpZXRhcnkga2V5IHZhbHVlIGRhdGEgZm9yIG11c2lnMiBwYXJ0aWFsIHNpZ1xuICogQHBhcmFtIGt2XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZWNvZGVQc2J0TXVzaWcyUGFydGlhbFNpZyhrdjogUHJvcHJpZXRhcnlLZXlWYWx1ZSk6IFBzYnRNdXNpZzJQYXJ0aWFsU2lnIHtcbiAgaWYgKFxuICAgIGt2LmtleS5pZGVudGlmaWVyICE9PSBQU0JUX1BST1BSSUVUQVJZX0lERU5USUZJRVIgfHxcbiAgICBrdi5rZXkuc3VidHlwZSAhPT0gUHJvcHJpZXRhcnlLZXlTdWJ0eXBlLk1VU0lHMl9QQVJUSUFMX1NJR1xuICApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgaWRlbnRpZmllciAke2t2LmtleS5pZGVudGlmaWVyfSBvciBzdWJ0eXBlICR7a3Yua2V5LnN1YnR5cGV9IGZvciBwYXJ0aWFsIHNpZ2ApO1xuICB9XG5cbiAgY29uc3Qga2V5ID0ga3Yua2V5LmtleWRhdGE7XG4gIGlmIChrZXkubGVuZ3RoICE9PSA2NSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBrZXlkYXRhIHNpemUgJHtrZXkubGVuZ3RofSBmb3IgcGFydGlhbCBzaWdgKTtcbiAgfVxuXG4gIGNvbnN0IHZhbHVlID0ga3YudmFsdWU7XG4gIGlmICh2YWx1ZS5sZW5ndGggIT09IDMyICYmIHZhbHVlLmxlbmd0aCAhPT0gMzMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgdmFsdWVkYXRhIHNpemUgJHt2YWx1ZS5sZW5ndGh9IGZvciBwYXJ0aWFsIHNpZ2ApO1xuICB9XG5cbiAgcmV0dXJuIHsgcGFydGljaXBhbnRQdWJLZXk6IGtleS5zdWJhcnJheSgwLCAzMyksIHRhcE91dHB1dEtleToga2V5LnN1YmFycmF5KDMzKSwgcGFydGlhbFNpZzogdmFsdWUgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVRhcEludGVybmFsS2V5KHBsYWluUHViS2V5czogQnVmZmVyW10pOiBCdWZmZXIge1xuICByZXR1cm4gQnVmZmVyLmZyb20obXVzaWcuZ2V0WE9ubHlQdWJrZXkobXVzaWcua2V5QWdnKHBsYWluUHViS2V5cykpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVRhcE91dHB1dEtleShpbnRlcm5hbFB1YktleTogQnVmZmVyLCB0YXBUcmVlUm9vdDogQnVmZmVyKTogQnVmZmVyIHtcbiAgcmV0dXJuIEJ1ZmZlci5mcm9tKFxuICAgIHRhcFR3ZWFrUHVia2V5KGVjYywgdG9YT25seVB1YmxpY0tleShpbnRlcm5hbFB1YktleSksIGNoZWNrVGFwTWVya2xlUm9vdCh0YXBUcmVlUm9vdCkpLnhPbmx5UHVia2V5XG4gICk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVBZ2dyZWdhdGVOb25jZShwdWJOb25jZXM6IFR1cGxlPEJ1ZmZlcj4pOiBCdWZmZXIge1xuICByZXR1cm4gQnVmZmVyLmZyb20obXVzaWcubm9uY2VBZ2cocHViTm9uY2VzKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVUYXBUd2Vhayh0YXBJbnRlcm5hbEtleTogQnVmZmVyLCB0YXBNZXJrbGVSb290OiBCdWZmZXIpOiBCdWZmZXIge1xuICByZXR1cm4gQnVmZmVyLmZyb20oY2FsY3VsYXRlVGFwVHdlYWsoY2hlY2tYT25seVB1YmxpY0tleSh0YXBJbnRlcm5hbEtleSksIGNoZWNrVGFwTWVya2xlUm9vdCh0YXBNZXJrbGVSb290KSkpO1xufVxuXG5mdW5jdGlvbiBzdGFydE11c2lnMlNpZ25pbmdTZXNzaW9uKFxuICBhZ2dOb25jZTogQnVmZmVyLFxuICBoYXNoOiBCdWZmZXIsXG4gIHB1YmxpY0tleXM6IFR1cGxlPEJ1ZmZlcj4sXG4gIHR3ZWFrOiBCdWZmZXJcbik6IFNlc3Npb25LZXkge1xuICByZXR1cm4gbXVzaWcuc3RhcnRTaWduaW5nU2Vzc2lvbihhZ2dOb25jZSwgaGFzaCwgcHVibGljS2V5cywgeyB0d2VhaywgeE9ubHk6IHRydWUgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtdXNpZzJQYXJ0aWFsU2lnbihcbiAgcHJpdmF0ZUtleTogQnVmZmVyLFxuICBwdWJsaWNOb25jZTogVWludDhBcnJheSxcbiAgc2Vzc2lvbktleTogU2Vzc2lvbktleSxcbiAgbm9uY2VTdG9yZTogTXVzaWcyTm9uY2VTdG9yZVxuKTogQnVmZmVyIHtcbiAgY2hlY2tUeEhhc2goQnVmZmVyLmZyb20oc2Vzc2lvbktleS5tc2cpKTtcbiAgcmV0dXJuIEJ1ZmZlci5mcm9tKFxuICAgIG11c2lnLnBhcnRpYWxTaWduKHtcbiAgICAgIHNlY3JldEtleTogcHJpdmF0ZUtleSxcbiAgICAgIHB1YmxpY05vbmNlOiBub25jZVN0b3JlLmdldFJlZihwdWJsaWNOb25jZSksXG4gICAgICBzZXNzaW9uS2V5LFxuICAgIH0pXG4gICk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtdXNpZzJQYXJ0aWFsU2lnVmVyaWZ5KFxuICBzaWc6IEJ1ZmZlcixcbiAgcHVibGljS2V5OiBCdWZmZXIsXG4gIHB1YmxpY05vbmNlOiBCdWZmZXIsXG4gIHNlc3Npb25LZXk6IFNlc3Npb25LZXlcbik6IGJvb2xlYW4ge1xuICBjaGVja1R4SGFzaChCdWZmZXIuZnJvbShzZXNzaW9uS2V5Lm1zZykpO1xuICByZXR1cm4gbXVzaWcucGFydGlhbFZlcmlmeSh7IHNpZywgcHVibGljS2V5LCBwdWJsaWNOb25jZSwgc2Vzc2lvbktleSB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG11c2lnMkFnZ3JlZ2F0ZVNpZ3Moc2lnczogQnVmZmVyW10sIHNlc3Npb25LZXk6IFNlc3Npb25LZXkpOiBCdWZmZXIge1xuICByZXR1cm4gQnVmZmVyLmZyb20obXVzaWcuc2lnbkFnZyhzaWdzLCBzZXNzaW9uS2V5KSk7XG59XG5cbi8qKiBAcmV0dXJuIHNlc3Npb24ga2V5IHRoYXQgY2FuIGJlIHVzZWQgdG8gcmVmZXJlbmNlIHRoZSBzZXNzaW9uIGxhdGVyICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTXVzaWcyU2lnbmluZ1Nlc3Npb24oc2Vzc2lvbkFyZ3M6IHtcbiAgcHViTm9uY2VzOiBUdXBsZTxCdWZmZXI+O1xuICB0eEhhc2g6IEJ1ZmZlcjtcbiAgcHViS2V5czogVHVwbGU8QnVmZmVyPjtcbiAgaW50ZXJuYWxQdWJLZXk6IEJ1ZmZlcjtcbiAgdGFwVHJlZVJvb3Q6IEJ1ZmZlcjtcbn0pOiBTZXNzaW9uS2V5IHtcbiAgY2hlY2tUeEhhc2goc2Vzc2lvbkFyZ3MudHhIYXNoKTtcbiAgY29uc3QgYWdnTm9uY2UgPSBjcmVhdGVBZ2dyZWdhdGVOb25jZShzZXNzaW9uQXJncy5wdWJOb25jZXMpO1xuICBjb25zdCB0d2VhayA9IGNyZWF0ZVRhcFR3ZWFrKHNlc3Npb25BcmdzLmludGVybmFsUHViS2V5LCBzZXNzaW9uQXJncy50YXBUcmVlUm9vdCk7XG4gIHJldHVybiBzdGFydE11c2lnMlNpZ25pbmdTZXNzaW9uKGFnZ05vbmNlLCBzZXNzaW9uQXJncy50eEhhc2gsIHNlc3Npb25BcmdzLnB1YktleXMsIHR3ZWFrKTtcbn1cblxuLyoqXG4gKiBAcmV0dXJucyBwc2J0IHByb3ByaWV0YXJ5IGtleSBmb3IgbXVzaWcyIHBhcnRpY2lwYW50IGtleSB2YWx1ZSBkYXRhXG4gKiBJZiBubyBrZXkgdmFsdWUgZXhpc3RzLCB1bmRlZmluZWQgaXMgcmV0dXJuZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVBzYnRNdXNpZzJQYXJ0aWNpcGFudHMoaW5wdXQ6IFBzYnRJbnB1dCk6IFBzYnRNdXNpZzJQYXJ0aWNpcGFudHMgfCB1bmRlZmluZWQge1xuICBjb25zdCBwYXJ0aWNpcGFudHNLZXlWYWxzID0gZ2V0UHNidElucHV0UHJvcHJpZXRhcnlLZXlWYWxzKGlucHV0LCB7XG4gICAgaWRlbnRpZmllcjogUFNCVF9QUk9QUklFVEFSWV9JREVOVElGSUVSLFxuICAgIHN1YnR5cGU6IFByb3ByaWV0YXJ5S2V5U3VidHlwZS5NVVNJRzJfUEFSVElDSVBBTlRfUFVCX0tFWVMsXG4gIH0pO1xuXG4gIGlmICghcGFydGljaXBhbnRzS2V5VmFscy5sZW5ndGgpIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG5cbiAgaWYgKHBhcnRpY2lwYW50c0tleVZhbHMubGVuZ3RoID4gMSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgRm91bmQgJHtwYXJ0aWNpcGFudHNLZXlWYWxzLmxlbmd0aH0gbWF0Y2hpbmcgcGFydGljaXBhbnQga2V5IHZhbHVlIGluc3RlYWQgb2YgMWApO1xuICB9XG5cbiAgcmV0dXJuIGRlY29kZVBzYnRNdXNpZzJQYXJ0aWNpcGFudHMocGFydGljaXBhbnRzS2V5VmFsc1swXSk7XG59XG5cbi8qKlxuICogQHJldHVybnMgcHNidCBwcm9wcmlldGFyeSBrZXkgZm9yIG11c2lnMiBwdWJsaWMgbm9uY2Uga2V5IHZhbHVlIGRhdGFcbiAqIElmIG5vIGtleSB2YWx1ZSBleGlzdHMsIHVuZGVmaW5lZCBpcyByZXR1cm5lZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlUHNidE11c2lnMk5vbmNlcyhpbnB1dDogUHNidElucHV0KTogUHNidE11c2lnMlB1Yk5vbmNlW10gfCB1bmRlZmluZWQge1xuICBjb25zdCBub25jZUtleVZhbHMgPSBnZXRQc2J0SW5wdXRQcm9wcmlldGFyeUtleVZhbHMoaW5wdXQsIHtcbiAgICBpZGVudGlmaWVyOiBQU0JUX1BST1BSSUVUQVJZX0lERU5USUZJRVIsXG4gICAgc3VidHlwZTogUHJvcHJpZXRhcnlLZXlTdWJ0eXBlLk1VU0lHMl9QVUJfTk9OQ0UsXG4gIH0pO1xuXG4gIGlmICghbm9uY2VLZXlWYWxzLmxlbmd0aCkge1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cblxuICBpZiAobm9uY2VLZXlWYWxzLmxlbmd0aCA+IDIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEZvdW5kICR7bm9uY2VLZXlWYWxzLmxlbmd0aH0gbWF0Y2hpbmcgbm9uY2Uga2V5IHZhbHVlIGluc3RlYWQgb2YgMSBvciAyYCk7XG4gIH1cblxuICByZXR1cm4gbm9uY2VLZXlWYWxzLm1hcCgoa3YpID0+IGRlY29kZVBzYnRNdXNpZzJOb25jZShrdikpO1xufVxuXG4vKipcbiAqIEByZXR1cm5zIHBzYnQgcHJvcHJpZXRhcnkga2V5IGZvciBtdXNpZzIgcGFydGlhbCBzaWcga2V5IHZhbHVlIGRhdGFcbiAqIElmIG5vIGtleSB2YWx1ZSBleGlzdHMsIHVuZGVmaW5lZCBpcyByZXR1cm5lZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlUHNidE11c2lnMlBhcnRpYWxTaWdzKGlucHV0OiBQc2J0SW5wdXQpOiBQc2J0TXVzaWcyUGFydGlhbFNpZ1tdIHwgdW5kZWZpbmVkIHtcbiAgY29uc3Qgc2lnS2V5VmFscyA9IGdldFBzYnRJbnB1dFByb3ByaWV0YXJ5S2V5VmFscyhpbnB1dCwge1xuICAgIGlkZW50aWZpZXI6IFBTQlRfUFJPUFJJRVRBUllfSURFTlRJRklFUixcbiAgICBzdWJ0eXBlOiBQcm9wcmlldGFyeUtleVN1YnR5cGUuTVVTSUcyX1BBUlRJQUxfU0lHLFxuICB9KTtcblxuICBpZiAoIXNpZ0tleVZhbHMubGVuZ3RoKSB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxuXG4gIGlmIChzaWdLZXlWYWxzLmxlbmd0aCA+IDIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEZvdW5kICR7c2lnS2V5VmFscy5sZW5ndGh9IG1hdGNoaW5nIHBhcnRpYWwgc2lnbmF0dXJlIGtleSB2YWx1ZSBpbnN0ZWFkIG9mIDEgb3IgMmApO1xuICB9XG5cbiAgcmV0dXJuIHNpZ0tleVZhbHMubWFwKChrdikgPT4gZGVjb2RlUHNidE11c2lnMlBhcnRpYWxTaWcoa3YpKTtcbn1cblxuLyoqXG4gKiBBc3NlcnQgbXVzaWcyIHBhcnRpY2lwYW50IGtleSB2YWx1ZSBkYXRhIHdpdGggdGFwSW50ZXJuYWxLZXkgYW5kIHRhcE1lcmtsZVJvb3QuXG4gKiA8dGFwT3V0cHV0S2V5Pjx0YXBJbnB1dEtleT4gPT4gPHBhcnRpY2lwYW50S2V5MT48cGFydGljaXBhbnRLZXkyPlxuICogVXNpbmcgdGFwTWVya2xlUm9vdCBhbmQgMiBwYXJ0aWNpcGFudCBrZXlzLCB0aGUgdGFwSW5wdXRLZXkgaXMgdmFsaWRhdGVkIGFuZCB1c2luZyB0YXBNZXJrbGVSb290IGFuZCB0YXBJbnB1dEtleSxcbiAqIHRoZSB0YXBPdXRwdXRLZXkgaXMgdmFsaWRhdGVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0UHNidE11c2lnMlBhcnRpY2lwYW50cyhcbiAgcGFydGljaXBhbnRLZXlWYWxEYXRhOiBQc2J0TXVzaWcyUGFydGljaXBhbnRzLFxuICB0YXBJbnRlcm5hbEtleTogQnVmZmVyLFxuICB0YXBNZXJrbGVSb290OiBCdWZmZXJcbik6IHZvaWQge1xuICBjaGVja1hPbmx5UHVibGljS2V5KHRhcEludGVybmFsS2V5KTtcbiAgY2hlY2tUYXBNZXJrbGVSb290KHRhcE1lcmtsZVJvb3QpO1xuXG4gIGNvbnN0IHBhcnRpY2lwYW50UHViS2V5cyA9IHBhcnRpY2lwYW50S2V5VmFsRGF0YS5wYXJ0aWNpcGFudFB1YktleXM7XG5cbiAgY29uc3QgaW50ZXJuYWxLZXkgPSBjcmVhdGVUYXBJbnRlcm5hbEtleShwYXJ0aWNpcGFudFB1YktleXMpO1xuICBpZiAoIWludGVybmFsS2V5LmVxdWFscyhwYXJ0aWNpcGFudEtleVZhbERhdGEudGFwSW50ZXJuYWxLZXkpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHBhcnRpY2lwYW50cyBrZXlkYXRhIHRhcEludGVybmFsS2V5Jyk7XG4gIH1cblxuICBjb25zdCBvdXRwdXRLZXkgPSBjcmVhdGVUYXBPdXRwdXRLZXkoaW50ZXJuYWxLZXksIHRhcE1lcmtsZVJvb3QpO1xuICBpZiAoIW91dHB1dEtleS5lcXVhbHMocGFydGljaXBhbnRLZXlWYWxEYXRhLnRhcE91dHB1dEtleSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgcGFydGljaXBhbnRzIGtleWRhdGEgdGFwT3V0cHV0S2V5Jyk7XG4gIH1cblxuICBpZiAoIWludGVybmFsS2V5LmVxdWFscyh0YXBJbnRlcm5hbEtleSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3RhcEludGVybmFsS2V5IGFuZCBhZ2dyZWdhdGVkIHBhcnRpY2lwYW50IHB1YiBrZXlzIGRvZXMgbm90IG1hdGNoJyk7XG4gIH1cbn1cblxuLyoqXG4gKiBBc3NlcnQgbXVzaWcyIHB1YmxpYyBub25jZSBrZXkgdmFsdWUgZGF0YSB3aXRoIHBhcnRpY2lwYW50IGtleSB2YWx1ZSBkYXRhXG4gKiAocmVmZXIgYXNzZXJ0UHNidE11c2lnMlBhcnRpY2lwYW50c0tleVZhbERhdGEpLlxuICogPHBhcnRpY2lwYW50S2V5MT48dGFwT3V0cHV0S2V5PiA9PiA8cHViTm9uY2UxPlxuICogPHBhcnRpY2lwYW50S2V5Mj48dGFwT3V0cHV0S2V5PiA9PiA8cHViTm9uY2UyPlxuICogQ2hlY2tzIGFnYWluc3QgcGFydGljaXBhbnQga2V5cyBhbmQgdGFwT3V0cHV0S2V5XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRQc2J0TXVzaWcyTm9uY2VzKFxuICBub25jZXNLZXlWYWxEYXRhOiBQc2J0TXVzaWcyUHViTm9uY2VbXSxcbiAgcGFydGljaXBhbnRLZXlWYWxEYXRhOiBQc2J0TXVzaWcyUGFydGljaXBhbnRzXG4pOiB2b2lkIHtcbiAgY2hlY2tYT25seVB1YmxpY0tleShwYXJ0aWNpcGFudEtleVZhbERhdGEudGFwT3V0cHV0S2V5KTtcbiAgcGFydGljaXBhbnRLZXlWYWxEYXRhLnBhcnRpY2lwYW50UHViS2V5cy5mb3JFYWNoKChrdikgPT4gY2hlY2tQbGFpblB1YmxpY0tleShrdikpO1xuICBpZiAocGFydGljaXBhbnRLZXlWYWxEYXRhLnBhcnRpY2lwYW50UHViS2V5c1swXS5lcXVhbHMocGFydGljaXBhbnRLZXlWYWxEYXRhLnBhcnRpY2lwYW50UHViS2V5c1sxXSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYER1cGxpY2F0ZSBwYXJ0aWNpcGFudCBwdWIga2V5cyBmb3VuZGApO1xuICB9XG5cbiAgaWYgKG5vbmNlc0tleVZhbERhdGEubGVuZ3RoID4gMikge1xuICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBub25jZSBrZXkgdmFsdWUgY291bnQgJHtub25jZXNLZXlWYWxEYXRhLmxlbmd0aH1gKTtcbiAgfVxuXG4gIG5vbmNlc0tleVZhbERhdGEuZm9yRWFjaCgobm9uY2VLdikgPT4ge1xuICAgIGNvbnN0IGluZGV4ID0gcGFydGljaXBhbnRLZXlWYWxEYXRhLnBhcnRpY2lwYW50UHViS2V5cy5maW5kSW5kZXgoKHB1YktleSkgPT5cbiAgICAgIG5vbmNlS3YucGFydGljaXBhbnRQdWJLZXkuZXF1YWxzKHB1YktleSlcbiAgICApO1xuICAgIGlmIChpbmRleCA8IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBub25jZSBrZXlkYXRhIHBhcnRpY2lwYW50IHB1YiBrZXknKTtcbiAgICB9XG5cbiAgICBpZiAoIW5vbmNlS3YudGFwT3V0cHV0S2V5LmVxdWFscyhwYXJ0aWNpcGFudEtleVZhbERhdGEudGFwT3V0cHV0S2V5KSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIG5vbmNlIGtleWRhdGEgdGFwT3V0cHV0S2V5Jyk7XG4gICAgfVxuICB9KTtcbn1cblxuLyoqXG4gKiBAcmV0dXJucyBJbnB1dCBvYmplY3QgYnV0IHNpZyBoYXNoIHR5cGUgZGF0YSBpcyB0YWtlbiBvdXQgZnJvbSBwYXJ0aWFsU2lnIGZpZWxkLlxuICogSWYgc2lnIGhhc2ggdHlwZSBpcyBub3QgY29tbW9uIGZvciBhbGwgc2lncywgZXJyb3Igb3V0LCBvdGhlcndpc2UgcmV0dXJucyB0aGUgbW9kaWZpZWQgb2JqZWN0IGFuZCBzaW5nbGUgaGFzaCB0eXBlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0U2lnSGFzaFR5cGVGcm9tU2lncyhwYXJ0aWFsU2lnczogUHNidE11c2lnMlBhcnRpYWxTaWdbXSk6IHtcbiAgcGFydGlhbFNpZ3M6IFBzYnRNdXNpZzJQYXJ0aWFsU2lnW107XG4gIHNpZ0hhc2hUeXBlOiBudW1iZXI7XG59IHtcbiAgaWYgKCFwYXJ0aWFsU2lncy5sZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3BhcnRpYWxTaWdzIGFycmF5IGNhbiBub3QgYmUgZW1wdHknKTtcbiAgfVxuICBjb25zdCBwU2lnc1dpdGhIYXNoVHlwZSA9IHBhcnRpYWxTaWdzLm1hcCgoa3YpID0+IHtcbiAgICBjb25zdCB7IHBhcnRpYWxTaWcsIHBhcnRpY2lwYW50UHViS2V5LCB0YXBPdXRwdXRLZXkgfSA9IGt2O1xuICAgIHJldHVybiBwYXJ0aWFsU2lnLmxlbmd0aCA9PT0gMzNcbiAgICAgID8geyBwU2lnOiB7IHBhcnRpYWxTaWc6IHBhcnRpYWxTaWcuc2xpY2UoMCwgMzIpLCBwYXJ0aWNpcGFudFB1YktleSwgdGFwT3V0cHV0S2V5IH0sIHNpZ0hhc2hUeXBlOiBwYXJ0aWFsU2lnWzMyXSB9XG4gICAgICA6IHsgcFNpZzogeyBwYXJ0aWFsU2lnLCBwYXJ0aWNpcGFudFB1YktleSwgdGFwT3V0cHV0S2V5IH0sIHNpZ0hhc2hUeXBlOiBUcmFuc2FjdGlvbi5TSUdIQVNIX0RFRkFVTFQgfTtcbiAgfSk7XG5cbiAgY29uc3Qgc2lnSGFzaFR5cGUgPSBwU2lnc1dpdGhIYXNoVHlwZVswXS5zaWdIYXNoVHlwZTtcbiAgaWYgKCFwU2lnc1dpdGhIYXNoVHlwZS5ldmVyeSgocFNpZykgPT4gcFNpZy5zaWdIYXNoVHlwZSA9PT0gc2lnSGFzaFR5cGUpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdzaWduYXR1cmVzIG11c3QgdXNlIHNhbWUgc2lnIGhhc2ggdHlwZScpO1xuICB9XG5cbiAgcmV0dXJuIHsgcGFydGlhbFNpZ3M6IHBTaWdzV2l0aEhhc2hUeXBlLm1hcCgoeyBwU2lnIH0pID0+IHBTaWcpLCBzaWdIYXNoVHlwZSB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTXVzaWcyRGV0ZXJtaW5pc3RpY05vbmNlKHBhcmFtczogUHNidE11c2lnMkRldGVybWluaXN0aWNQYXJhbXMpOiBCdWZmZXIge1xuICByZXR1cm4gQnVmZmVyLmZyb20oXG4gICAgbXVzaWcuZGV0ZXJtaW5pc3RpY05vbmNlR2VuKHtcbiAgICAgIHNlY3JldEtleTogcGFyYW1zLnByaXZhdGVLZXksXG4gICAgICBhZ2dPdGhlck5vbmNlOiBtdXNpZy5ub25jZUFnZyhbcGFyYW1zLm90aGVyTm9uY2VdKSxcbiAgICAgIHB1YmxpY0tleXM6IHBhcmFtcy5wdWJsaWNLZXlzLFxuICAgICAgdHdlYWtzOiBbeyB0d2VhazogY3JlYXRlVGFwVHdlYWsocGFyYW1zLmludGVybmFsUHViS2V5LCBwYXJhbXMudGFwVHJlZVJvb3QpLCB4T25seTogdHJ1ZSB9XSxcbiAgICAgIG1zZzogcGFyYW1zLmhhc2gsXG4gICAgfSkucHVibGljTm9uY2VcbiAgKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG11c2lnMkRldGVybWluaXN0aWNTaWduKHBhcmFtczogUHNidE11c2lnMkRldGVybWluaXN0aWNQYXJhbXMpOiB7XG4gIHNpZzogQnVmZmVyO1xuICBzZXNzaW9uS2V5OiBTZXNzaW9uS2V5O1xuICBwdWJsaWNOb25jZTogQnVmZmVyO1xufSB7XG4gIGNvbnN0IHsgc2lnLCBzZXNzaW9uS2V5LCBwdWJsaWNOb25jZSB9ID0gbXVzaWcuZGV0ZXJtaW5pc3RpY1NpZ24oe1xuICAgIHNlY3JldEtleTogcGFyYW1zLnByaXZhdGVLZXksXG4gICAgYWdnT3RoZXJOb25jZTogbXVzaWcubm9uY2VBZ2coW3BhcmFtcy5vdGhlck5vbmNlXSksXG4gICAgcHVibGljS2V5czogcGFyYW1zLnB1YmxpY0tleXMsXG4gICAgdHdlYWtzOiBbeyB0d2VhazogY3JlYXRlVGFwVHdlYWsocGFyYW1zLmludGVybmFsUHViS2V5LCBwYXJhbXMudGFwVHJlZVJvb3QpLCB4T25seTogdHJ1ZSB9XSxcbiAgICBtc2c6IHBhcmFtcy5oYXNoLFxuICB9KTtcbiAgcmV0dXJuIHsgc2lnOiBCdWZmZXIuZnJvbShzaWcpLCBzZXNzaW9uS2V5LCBwdWJsaWNOb25jZTogQnVmZmVyLmZyb20ocHVibGljTm9uY2UpIH07XG59XG4iXX0=