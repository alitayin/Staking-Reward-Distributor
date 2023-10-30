/// <reference types="node" />
import { TxOutput, Transaction } from 'bitcoinjs-lib';
import { Network } from '..';
import { Signer, TransactionBuilder } from '../transaction_builder';
import { UtxoTransaction } from './UtxoTransaction';
export interface TxbSignArg<TNumber extends number | bigint = number> {
    prevOutScriptType: string;
    vin: number;
    keyPair: Signer;
    redeemScript?: Buffer;
    hashType?: number;
    witnessValue?: TNumber;
    witnessScript?: Buffer;
    controlBlock?: Buffer;
}
export declare class UtxoTransactionBuilder<TNumber extends number | bigint = number, T extends UtxoTransaction<TNumber> = UtxoTransaction<TNumber>> extends TransactionBuilder<TNumber> {
    constructor(network: Network, tx?: UtxoTransaction<TNumber>);
    protected static newTransactionBuilder<TNumber extends number | bigint>(network: Network, tx: UtxoTransaction<TNumber>): UtxoTransactionBuilder<TNumber>;
    protected createInitialTransaction(network: Network, tx?: Transaction<TNumber>): UtxoTransaction<TNumber>;
    static fromTransaction<TNumber extends number | bigint = number>(tx: UtxoTransaction<TNumber>, network?: Network, prevOutputs?: TxOutput<TNumber>[]): UtxoTransactionBuilder<TNumber>;
    get tx(): T;
    build(): T;
    buildIncomplete(): T;
    sign(signParams: number | TxbSignArg<TNumber>, keyPair?: Signer, redeemScript?: Buffer, hashType?: number, witnessValue?: TNumber, witnessScript?: Buffer): void;
}
//# sourceMappingURL=UtxoTransactionBuilder.d.ts.map