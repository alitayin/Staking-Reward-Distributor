/// <reference types="node" />
import * as bitcoinjs from 'bitcoinjs-lib';
import { Network } from '../networks';
export declare function varSliceSize(slice: Buffer): number;
export declare class UtxoTransaction<TNumber extends number | bigint = number> extends bitcoinjs.Transaction<TNumber> {
    network: Network;
    static SIGHASH_FORKID: number;
    /** @deprecated use SIGHASH_FORKID */
    static SIGHASH_BITCOINCASHBIP143: number;
    constructor(network: Network, transaction?: bitcoinjs.Transaction<bigint | number>, amountType?: 'bigint' | 'number');
    protected static newTransaction<TNumber extends number | bigint = number>(network: Network, transaction?: bitcoinjs.Transaction<bigint | number>, amountType?: 'number' | 'bigint'): UtxoTransaction<TNumber>;
    static fromBuffer<TNumber extends number | bigint = number>(buf: Buffer, noStrict: boolean, amountType?: 'number' | 'bigint', network?: Network, prevOutput?: bitcoinjs.TxOutput<TNumber>[]): UtxoTransaction<TNumber>;
    addForkId(hashType: number): number;
    hashForWitnessV0(inIndex: number, prevOutScript: Buffer, value: TNumber, hashType: number): Buffer;
    /**
     * Calculate the hash to verify the signature against
     */
    hashForSignatureByNetwork(inIndex: number, prevoutScript: Buffer, value: TNumber | undefined, hashType: number): Buffer;
    hashForSignature(inIndex: number, prevOutScript: Buffer, hashType: number, value?: TNumber): Buffer;
    clone<TN2 extends bigint | number = TNumber>(amountType?: 'number' | 'bigint'): UtxoTransaction<TN2>;
}
//# sourceMappingURL=UtxoTransaction.d.ts.map