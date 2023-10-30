/// <reference types="node" />
import { PsbtOpts, UtxoPsbt } from '../UtxoPsbt';
import { Network } from '../../networks';
import { Psbt as PsbtBase } from 'bip174';
import { LitecoinTransaction } from './LitecoinTransaction';
export declare class LitecoinPsbt extends UtxoPsbt<LitecoinTransaction<bigint>> {
    protected static transactionFromBuffer(buffer: Buffer, network: Network): LitecoinTransaction<bigint>;
    static createPsbt(opts: PsbtOpts, data?: PsbtBase): LitecoinPsbt;
}
//# sourceMappingURL=LitecoinPsbt.d.ts.map