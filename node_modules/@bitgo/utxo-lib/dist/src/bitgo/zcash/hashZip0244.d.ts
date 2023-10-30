/// <reference types="node" />
/**
 * Implements hashing methods described in https://zips.z.cash/zip-0244.
 * Only supports full transparent transactions without shielded inputs or outputs.
 */
import { TxInput, TxOutput } from 'bitcoinjs-lib';
import { ZcashTransaction } from './ZcashTransaction';
declare type SignatureParams<TNumber extends number | bigint = number> = {
    inIndex?: number;
    prevOutScript: Buffer;
    value: TNumber;
    hashType: number;
};
/**
 * Blake2b hashing algorithm for Zcash
 * @param buffer
 * @param personalization
 * @returns 256-bit BLAKE2b hash
 */
export declare function getBlake2bHash(buffer: Buffer, personalization: string | Buffer): Buffer;
export declare function getPrevoutsDigest<TNumber extends number | bigint>(ins: TxInput[], tag?: string, sigParams?: SignatureParams<TNumber>): Buffer;
export declare function getSequenceDigest<TNumber extends number | bigint>(ins: TxInput[], tag?: string, sigParams?: SignatureParams<TNumber>): Buffer;
export declare function getOutputsDigest<TNumber extends number | bigint>(outs: TxOutput<TNumber>[], tag?: string, sigParams?: SignatureParams<TNumber>): Buffer;
export declare function getTxidDigest<TNumber extends number | bigint>(tx: ZcashTransaction<TNumber>): Buffer;
export declare function getSignatureDigest<TNumber extends number | bigint>(tx: ZcashTransaction<TNumber>, inIndex: number | undefined, prevOutScript: Buffer, value: TNumber, hashType: number): Buffer;
export {};
//# sourceMappingURL=hashZip0244.d.ts.map