/// <reference types="node" />
import { Transaction } from 'bitcoinjs-lib';
import { UtxoTransaction } from '../UtxoTransaction';
import { Network } from '../../networks';
export declare class DashTransaction<TNumber extends number | bigint = number> extends UtxoTransaction<TNumber> {
    static DASH_NORMAL: number;
    static DASH_PROVIDER_REGISTER: number;
    static DASH_PROVIDER_UPDATE_SERVICE: number;
    static DASH_PROVIDER_UPDATE_REGISTRAR: number;
    static DASH_PROVIDER_UPDATE_REVOKE: number;
    static DASH_COINBASE: number;
    static DASH_QUORUM_COMMITMENT: number;
    type: number;
    extraPayload?: Buffer;
    constructor(network: Network, tx?: Transaction<bigint | number>, amountType?: 'bigint' | 'number');
    protected static newTransaction<TNumber extends number | bigint = number>(network: Network, transaction?: DashTransaction<number | bigint>, amountType?: 'number' | 'bigint'): DashTransaction<TNumber>;
    static fromBuffer<TNumber extends number | bigint = number>(buffer: Buffer, noStrict: boolean, amountType: "number" | "bigint" | undefined, network: Network): DashTransaction<TNumber>;
    clone<TN2 extends bigint | number = TNumber>(amountType?: 'number' | 'bigint'): DashTransaction<TN2>;
    byteLength(_ALLOW_WITNESS?: boolean): number;
    /**
     * Helper to override `__toBuffer()` of bitcoinjs.Transaction.
     * Since the method is private, we use a hack in the constructor to make it work.
     *
     * TODO: remove `private` modifier in bitcoinjs `__toBuffer()` or find some other solution
     *
     * @param buffer - optional target buffer
     * @param initialOffset - can only be undefined or 0. Other values are only used for serialization in blocks.
     * @param _ALLOW_WITNESS - ignored
     */
    private toBufferWithExtraPayload;
    getHash(forWitness?: boolean): Buffer;
    /**
     * Build a hash for all or none of the transaction inputs depending on the hashtype
     * @param hashType
     * @returns Buffer
     */
    getPrevoutHash(hashType: number): Buffer;
}
//# sourceMappingURL=DashTransaction.d.ts.map