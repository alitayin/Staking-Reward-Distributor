/// <reference types="node" />
import { KeyValue, Transaction, TransactionFromBuffer } from '../interfaces';
import { PsbtAttributes } from './index';
export declare function psbtFromBuffer(buffer: Buffer, txGetter: TransactionFromBuffer, { bip32PathsAbsolute }?: {
    bip32PathsAbsolute?: boolean | undefined;
}): PsbtAttributes;
interface PsbtFromKeyValsArg {
    globalMapKeyVals: KeyValue[];
    inputKeyVals: KeyValue[][];
    outputKeyVals: KeyValue[][];
}
export declare function checkKeyBuffer(type: string, keyBuf: Buffer, keyNum: number): void;
export declare function psbtFromKeyVals(unsignedTx: Transaction, { globalMapKeyVals, inputKeyVals, outputKeyVals }: PsbtFromKeyValsArg, { bip32PathsAbsolute }?: {
    bip32PathsAbsolute?: boolean | undefined;
}): PsbtAttributes;
export {};
