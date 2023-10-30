/// <reference types="node" />
import { ProprietaryKey } from 'bip174/src/lib/proprietaryKeyVal';
import { PsbtInput } from 'bip174/src/lib/interfaces';
import { Psbt } from 'bitcoinjs-lib/src/psbt';
/**
 * bitgo proprietary key identifier
 */
export declare const PSBT_PROPRIETARY_IDENTIFIER = "BITGO";
/**
 * subtype for proprietary keys that bitgo uses
 */
export declare enum ProprietaryKeySubtype {
    ZEC_CONSENSUS_BRANCH_ID = 0,
    MUSIG2_PARTICIPANT_PUB_KEYS = 1,
    MUSIG2_PUB_NONCE = 2,
    MUSIG2_PARTIAL_SIG = 3
}
/**
 * Psbt proprietary keydata object.
 * <compact size uint identifier length> <bytes identifier> <compact size uint subtype> <bytes subkeydata>
 * => <bytes valuedata>
 */
export interface ProprietaryKeyValue {
    key: ProprietaryKey;
    value: Buffer;
}
/**
 * Psbt proprietary keydata object search fields.
 * <compact size uint identifier length> <bytes identifier> <compact size uint subtype> <bytes subkeydata>
 */
export interface ProprietaryKeySearch {
    identifier: string;
    subtype?: number;
    keydata?: Buffer;
    identifierEncoding?: BufferEncoding;
}
/**
 * Search any data from psbt proprietary key value against keydata.
 * Default identifierEncoding is utf-8 for identifier.
 */
export declare function getPsbtInputProprietaryKeyVals(input: PsbtInput, keySearch?: ProprietaryKeySearch): ProprietaryKeyValue[];
/**
 * @return partialSig/tapScriptSig/MUSIG2_PARTIAL_SIG count iff input is not finalized
 */
export declare function getPsbtInputSignatureCount(input: PsbtInput): number;
/**
 * @return true iff PSBT input is finalized
 */
export declare function isPsbtInputFinalized(input: PsbtInput): boolean;
/**
 * @return true iff data starts with magic PSBT byte sequence
 * @param data byte array or hex string
 * */
export declare function isPsbt(data: Buffer | string): boolean;
/**
 * This function allows signing or validating a psbt with non-segwit inputs those do not contain nonWitnessUtxo.
 */
export declare function withUnsafeNonSegwit<T>(psbt: Psbt, fn: () => T, unsafe?: boolean): T;
//# sourceMappingURL=PsbtUtil.d.ts.map