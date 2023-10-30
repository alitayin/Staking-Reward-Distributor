/// <reference types="node" />
/**
 * Transaction (de)serialization helpers.
 * Only supports full transparent transactions without shielded inputs or outputs.
 *
 * References:
 * - https://github.com/zcash/zcash/blob/v4.5.1/src/primitives/transaction.h#L771
 */
import { TxInput, TxOutput } from 'bitcoinjs-lib';
import { BufferReader, BufferWriter } from 'bitcoinjs-lib/src/bufferutils';
import { ZcashTransaction } from './ZcashTransaction';
export declare const VALUE_INT64_ZERO: Buffer;
export declare function readInputs(bufferReader: BufferReader): TxInput[];
export declare function readOutputs<TNumber extends number | bigint>(bufferReader: BufferReader, amountType?: 'number' | 'bigint'): TxOutput<TNumber>[];
export declare function readEmptyVector(bufferReader: BufferReader): void;
export declare function readEmptyOrchardBundle(bufferReader: BufferReader): void;
export declare function writeEmptyOrchardBundle(bufferWriter: BufferWriter): void;
export declare function readEmptySaplingBundle(bufferReader: BufferReader): void;
export declare function writeEmptySamplingBundle(bufferWriter: BufferWriter): void;
export declare function fromBufferV4<TNumber extends number | bigint>(bufferReader: BufferReader, tx: ZcashTransaction<TNumber>, amountType?: 'number' | 'bigint'): void;
export declare function fromBufferV5<TNumber extends number | bigint>(bufferReader: BufferReader, tx: ZcashTransaction<TNumber>, amountType?: 'number' | 'bigint'): void;
export declare function writeInputs(bufferWriter: BufferWriter, ins: TxInput[]): void;
export declare function writeOutputs<TNumber extends number | bigint>(bufferWriter: BufferWriter, outs: TxOutput<TNumber>[]): void;
export declare function toBufferV4<TNumber extends number | bigint>(bufferWriter: BufferWriter, tx: ZcashTransaction<TNumber>): void;
export declare function toBufferV5<TNumber extends number | bigint>(bufferWriter: BufferWriter, tx: ZcashTransaction<TNumber>): void;
//# sourceMappingURL=ZcashBufferutils.d.ts.map