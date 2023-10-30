/// <reference types="node" />
import { UtxoTransaction } from '../UtxoTransaction';
import { Network, networks } from '../../networks';
export declare type LitecoinNetwork = typeof networks.litecoin | typeof networks.litecoinTest;
/**
 * We only care about reading a transaction that can have a potentially different advanced transaction flag,
 * but we dont need to write one.
 */
export declare class LitecoinTransaction<TNumber extends number | bigint = number> extends UtxoTransaction<TNumber> {
    static MWEB_PEGOUT_TX_FLAG: number;
    constructor(network: Network, tx?: LitecoinTransaction<bigint | number>, amountType?: 'bigint' | 'number');
    protected static newTransaction<TNumber extends number | bigint = number>(network: Network, transaction?: LitecoinTransaction<number | bigint>, amountType?: 'number' | 'bigint'): LitecoinTransaction<TNumber>;
    clone<TN2 extends bigint | number = TNumber>(amountType?: 'number' | 'bigint'): LitecoinTransaction<TN2>;
    static fromBuffer<TNumber extends number | bigint = number>(buffer: Buffer, noStrict: boolean, amountType?: 'number' | 'bigint', network?: LitecoinNetwork): LitecoinTransaction<TNumber>;
}
//# sourceMappingURL=LitecoinTransaction.d.ts.map