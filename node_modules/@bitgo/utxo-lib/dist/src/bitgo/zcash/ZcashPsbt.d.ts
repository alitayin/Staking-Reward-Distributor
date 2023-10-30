/// <reference types="node" />
import { PsbtOpts, UtxoPsbt } from '../UtxoPsbt';
import { ZcashTransaction } from './ZcashTransaction';
import { Network, Signer } from '../../';
import { Psbt as PsbtBase } from 'bip174';
import { ValidateSigFunction } from 'bitcoinjs-lib/src/psbt';
export declare class ZcashPsbt extends UtxoPsbt<ZcashTransaction<bigint>> {
    protected static transactionFromBuffer(buffer: Buffer, network: Network): ZcashTransaction<bigint>;
    static createPsbt(opts: PsbtOpts, data?: PsbtBase): ZcashPsbt;
    /**
     * In version < 5 of Zcash transactions, the consensus branch ID is not serialized in the transaction
     * whereas in version 5 it is. If the transaction is less than a version 5, set the consensus branch id
     * in the global map in the psbt. If it is a version 5 transaction, throw an error if the consensus
     * branch id is set in the psbt (because it should be on the transaction already).
     * @param buffer Psbt buffer
     * @param opts options
     */
    static fromBuffer(buffer: Buffer, opts: PsbtOpts): UtxoPsbt<ZcashTransaction<bigint>>;
    /**
     * If it is a version 4 transaction, add the consensus branch id to
     * the global map. If it is a version 5 transaction, just return the
     * buffer because the consensus branch id is already serialized in
     * the transaction.
     */
    toBuffer(): Buffer;
    setVersion(version: number, overwinter?: boolean): this;
    setDefaultsForVersion(network: Network, version: number): void;
    signInput(inputIndex: number, keyPair: Signer, sighashTypes?: number[]): this;
    validateSignaturesOfInput(inputIndex: number, validator: ValidateSigFunction, pubkey?: Buffer): boolean;
    private setPropertyCheckSignatures;
    setConsensusBranchId(consensusBranchId: number): void;
    setVersionGroupId(versionGroupId: number): void;
    setExpiryHeight(expiryHeight: number): void;
}
//# sourceMappingURL=ZcashPsbt.d.ts.map