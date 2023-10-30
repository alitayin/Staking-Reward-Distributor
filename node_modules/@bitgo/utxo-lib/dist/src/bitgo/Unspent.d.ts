/// <reference types="node" />
import { TxOutput } from 'bitcoinjs-lib';
import { Network } from '..';
import { UtxoTransactionBuilder } from './UtxoTransactionBuilder';
import { UtxoTransaction } from './UtxoTransaction';
/**
 * Public unspent data in BitGo-specific representation.
 */
export interface Unspent<TNumber extends number | bigint = number> {
    /**
     * Format: ${txid}:${vout}.
     * Use `parseOutputId(id)` to parse.
     */
    id: string;
    /**
     * The network-specific encoded address.
     * Use `toOutputScript(address, network)` to obtain scriptPubKey.
     */
    address: string;
    /**
     * The amount in satoshi.
     */
    value: TNumber;
}
export interface UnspentWithPrevTx<TNumber extends number | bigint = number> extends Unspent<TNumber> {
    prevTx: Buffer;
}
export declare function isUnspentWithPrevTx<TNumber extends number | bigint, TUnspent extends Unspent<TNumber>>(u: Unspent<TNumber>): u is TUnspent & {
    prevTx: Buffer;
};
/**
 * @return TxOutput from Unspent
 */
export declare function toOutput<TNumber extends number | bigint>(u: Unspent<TNumber>, network: Network): TxOutput<TNumber>;
/**
 * @return Unspent from TxOutput
 */
export declare function fromOutput<TNumber extends number | bigint>(tx: UtxoTransaction<TNumber>, vout: number): Unspent<TNumber>;
export declare function fromOutputWithPrevTx<TNumber extends number | bigint>(tx: UtxoTransaction<TNumber>, vout: number): UnspentWithPrevTx<TNumber>;
/**
 * @param outputId
 * @return TxOutPoint
 */
export declare function parseOutputId(outputId: string): TxOutPoint;
/**
 * @param txid
 * @param vout
 * @return outputId
 */
export declare function formatOutputId({ txid, vout }: TxOutPoint): string;
export declare function getOutputIdForInput(i: {
    hash: Buffer;
    index: number;
}): TxOutPoint;
/**
 * Reference to output of an existing transaction
 */
export declare type TxOutPoint = {
    txid: string;
    vout: number;
};
/**
 * Output reference and script data.
 * Suitable for use for `txb.addInput()`
 */
export declare type PrevOutput<TNumber extends number | bigint = number> = TxOutPoint & TxOutput<TNumber> & {
    prevTx?: Buffer;
};
/**
 * @return PrevOutput from Unspent
 */
export declare function toPrevOutput<TNumber extends number | bigint>(u: Unspent<TNumber>, network: Network): PrevOutput<TNumber>;
/**
 * @return PrevOutput with prevTx from Unspent
 */
export declare function toPrevOutputWithPrevTx<TNumber extends number | bigint>(u: Unspent<TNumber> & {
    prevTx?: unknown;
}, network: Network): PrevOutput<TNumber>;
/**
 * @param txb
 * @param u
 * @param sequence - sequenceId
 */
export declare function addToTransactionBuilder<TNumber extends number | bigint>(txb: UtxoTransactionBuilder<TNumber>, u: Unspent<TNumber>, sequence?: number): void;
/**
 * Sum the values of the unspents.
 * Throws error if sum is not a safe integer value, or if unspent amount types do not match `amountType`
 * @param unspents - array of unspents to sum
 * @param amountType - expected value type of unspents
 * @return unspentSum - type matches amountType
 */
export declare function unspentSum<TNumber extends number | bigint>(unspents: {
    value: TNumber;
}[], amountType?: 'number' | 'bigint'): TNumber;
//# sourceMappingURL=Unspent.d.ts.map