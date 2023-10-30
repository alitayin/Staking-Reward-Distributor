/// <reference types="node" />
import { TxOutput } from 'bitcoinjs-lib';
import { Network } from '../networks';
import { UtxoPsbt, PsbtOpts } from './UtxoPsbt';
import { UtxoTransaction } from './UtxoTransaction';
import { UtxoTransactionBuilder } from './UtxoTransactionBuilder';
export declare function createTransactionFromBuffer(buf: Buffer, network: Network, params: {
    version?: number;
    amountType: 'bigint';
}): UtxoTransaction<bigint>;
export declare function createTransactionFromBuffer<TNumber extends number | bigint>(buf: Buffer, network: Network, params?: {
    version?: number;
    amountType?: 'number' | 'bigint';
}): UtxoTransaction<TNumber>;
/** @deprecated - use createTransactionFromBuffer instead */
export declare function createTransactionFromHex(hex: string, network: Network, p: {
    amountType: 'bigint';
}): UtxoTransaction<bigint>;
/** @deprecated - use createTransactionFromBuffer instead */
export declare function createTransactionFromHex(hex: string, network: Network, p: {
    amountType: 'number';
}): UtxoTransaction;
/** @deprecated - use createTransactionFromBuffer instead */
export declare function createTransactionFromHex<TNumber extends number | bigint = number>(hex: string, network: Network, p?: {
    amountType?: 'number' | 'bigint';
} | 'number' | 'bigint'): UtxoTransaction<TNumber>;
export declare function createPsbtFromBuffer(buf: Buffer, network: Network, bip32PathsAbsolute?: boolean): UtxoPsbt;
export declare function createPsbtFromHex(hex: string, network: Network, bip32PathsAbsolute?: boolean): UtxoPsbt;
export declare function createPsbtFromTransaction(tx: UtxoTransaction<bigint>, prevOuts: TxOutput<bigint>[]): UtxoPsbt;
export declare function getDefaultTransactionVersion(network: Network): number;
export declare function setTransactionBuilderDefaults<TNumber extends number | bigint>(txb: UtxoTransactionBuilder<TNumber>, network: Network, { version }?: {
    version?: number;
}): void;
export declare function setPsbtDefaults(psbt: UtxoPsbt, network: Network, { version }?: {
    version?: number;
}): void;
export declare function createPsbtForNetwork(psbtOpts: PsbtOpts, { version }?: {
    version?: number;
}): UtxoPsbt;
export declare function createTransactionBuilderForNetwork<TNumber extends number | bigint = number>(network: Network, { version }?: {
    version?: number;
}): UtxoTransactionBuilder<TNumber>;
export declare function createTransactionBuilderFromTransaction<TNumber extends number | bigint>(tx: UtxoTransaction<TNumber>, prevOutputs?: TxOutput<TNumber>[]): UtxoTransactionBuilder<TNumber>;
//# sourceMappingURL=transaction.d.ts.map