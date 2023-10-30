import { TxInput } from '../';
/**
 * @param input - Input of non-standard half-signed transaction created with `tx.build()` instead of `tx.buildIncomplete()`.
 * @param signatureIndex - Position to map the existing signatures to. Other signatures will be padded with OP_0.
 */
export declare function padInputScript(input: TxInput, signatureIndex: number): void;
//# sourceMappingURL=nonStandardHalfSigned.d.ts.map