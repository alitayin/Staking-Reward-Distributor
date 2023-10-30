/// <reference types="node" />
import { DashTransaction } from './DashTransaction';
import { PsbtOpts, UtxoPsbt } from '../UtxoPsbt';
import { Network } from '../../networks';
import { Psbt as PsbtBase } from 'bip174';
export declare class DashPsbt extends UtxoPsbt<DashTransaction<bigint>> {
    protected static transactionFromBuffer(buffer: Buffer, network: Network): DashTransaction<bigint>;
    static createPsbt(opts: PsbtOpts, data?: PsbtBase): DashPsbt;
    setType(type: number): DashPsbt;
    setExtraPayload(extraPayload?: Buffer): DashPsbt;
}
//# sourceMappingURL=DashPsbt.d.ts.map