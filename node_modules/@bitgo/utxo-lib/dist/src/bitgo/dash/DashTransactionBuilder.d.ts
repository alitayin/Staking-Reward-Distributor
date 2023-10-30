/// <reference types="node" />
import * as bitcoinjs from 'bitcoinjs-lib';
import { Network } from '../../networks';
import { UtxoTransactionBuilder } from '../UtxoTransactionBuilder';
import { DashTransaction } from './DashTransaction';
import { UtxoTransaction } from '../UtxoTransaction';
export declare class DashTransactionBuilder<TNumber extends number | bigint = number> extends UtxoTransactionBuilder<TNumber, DashTransaction<TNumber>> {
    constructor(network: Network, tx?: UtxoTransaction<TNumber>);
    protected static newTransactionBuilder<TNumber extends number | bigint>(network: Network, tx: UtxoTransaction<TNumber>): DashTransactionBuilder<TNumber>;
    protected createInitialTransaction(network: Network, tx?: bitcoinjs.Transaction<TNumber>): DashTransaction<TNumber>;
    setType(type: number): void;
    setExtraPayload(extraPayload?: Buffer): void;
}
//# sourceMappingURL=DashTransactionBuilder.d.ts.map