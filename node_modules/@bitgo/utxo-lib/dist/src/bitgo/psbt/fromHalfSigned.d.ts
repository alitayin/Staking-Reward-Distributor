/// <reference types="node" />
import { PsbtInputUpdate } from 'bip174/src/lib/interfaces';
import { TxOutput } from '../..';
import { UtxoTransaction } from '../UtxoTransaction';
export declare function getInputUpdate(tx: UtxoTransaction<bigint>, vin: number, prevOuts: (TxOutput<bigint> & {
    prevTx?: Buffer;
})[]): PsbtInputUpdate;
/**
 * Takes a partially signed transaction and removes the scripts and signatures.
 *
 * Inputs must be one of:
 *  - p2shP2pk
 *  - p2sh 2-of-3
 *  - p2shP2wsh 2-of-3
 *  - p2wsh 2-of-3
 *  - p2tr script path 2-of-2
 *
 * @param tx the partially signed transaction
 * @param prevOuts
 *
 * @return the removed scripts and signatures, ready to be added to a PSBT
 */
export declare function unsign(tx: UtxoTransaction<bigint>, prevOuts: TxOutput<bigint>[]): PsbtInputUpdate[];
//# sourceMappingURL=fromHalfSigned.d.ts.map