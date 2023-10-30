/// <reference types="node" />
import * as bitcoinjs from 'bitcoinjs-lib';
import { Network } from '../..';
import { ZcashNetwork, ZcashTransaction } from './ZcashTransaction';
import { UtxoTransactionBuilder } from '../UtxoTransactionBuilder';
export declare class ZcashTransactionBuilder<TNumber extends number | bigint = number> extends UtxoTransactionBuilder<TNumber, ZcashTransaction<TNumber>> {
    constructor(network: ZcashNetwork);
    protected createInitialTransaction(network: Network): ZcashTransaction<TNumber>;
    static fromTransaction<TNumber extends number | bigint = number>(transaction: ZcashTransaction<TNumber>, network?: Network, prevOutput?: bitcoinjs.TxOutput<TNumber>[]): ZcashTransactionBuilder<TNumber>;
    setVersion(version: number, overwinter?: boolean): void;
    setDefaultsForVersion(network: Network, version: number): void;
    private hasSignatures;
    private setPropertyCheckSignatures;
    setConsensusBranchId(consensusBranchId: number): void;
    setVersionGroupId(versionGroupId: number): void;
    setExpiryHeight(expiryHeight: number): void;
    build(): ZcashTransaction<TNumber>;
    buildIncomplete(): ZcashTransaction<TNumber>;
    addOutput(scriptPubKey: string | Buffer, value: TNumber): number;
}
//# sourceMappingURL=ZcashTransactionBuilder.d.ts.map