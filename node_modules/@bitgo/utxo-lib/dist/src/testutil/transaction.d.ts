import { ScriptType, ScriptType2Of3 } from '../bitgo/outputScripts';
import { KeyName, RootWalletKeys, Unspent, UtxoTransactionBuilder } from '../bitgo';
import { Network } from '../networks';
/**
 * input script type and value.
 */
export declare type TxnInputScriptType = Exclude<ScriptType, 'p2trMusig2'>;
export declare type TxnOutputScriptType = ScriptType2Of3;
/**
 * output script type and value
 */
export interface TxnInput<TNumber extends number | bigint> {
    scriptType: TxnInputScriptType;
    value: TNumber;
}
/**
 * should set either address or scriptType, never both.
 * set isInternalAddress=true for internal output address
 */
export interface TxnOutput<TNumber extends number | bigint> {
    address?: string;
    scriptType?: TxnOutputScriptType;
    value: TNumber;
    isInternalAddress?: boolean;
}
/**
 * array of supported input script types.
 */
export declare const txnInputScriptTypes: readonly ["p2sh", "p2shP2wsh", "p2wsh", "p2tr", "p2shP2pk"];
/**
 * array of supported output script types.
 */
export declare const txnOutputScriptTypes: readonly ["p2sh", "p2shP2wsh", "p2wsh", "p2tr", "p2trMusig2"];
/**
 * create unspent object from input script type, index, network and root wallet key.
 */
export declare function toTxnUnspent<TNumber extends number | bigint>(input: TxnInput<TNumber>, index: number, network: Network, rootWalletKeys: RootWalletKeys): Unspent<TNumber>;
/**
 * returns signer and cosigner names for TxnInputScriptType.
 * user and undefined as signer and cosigner respectively for p2shP2pk.
 * user and bitgo as signer and cosigner respectively for other input script types.
 */
export declare function getTxnSigners(inputType: TxnInputScriptType): {
    signerName: KeyName;
    cosignerName?: KeyName;
};
/**
 * signs with first or second signature for single input.
 * p2shP2pk is signed only with first sign.
 */
export declare function signTxnInput<TNumber extends number | bigint>(txb: UtxoTransactionBuilder<TNumber>, input: TxnInput<TNumber>, inputIndex: number, rootWalletKeys: RootWalletKeys, sign: 'halfsigned' | 'fullsigned', signers?: {
    signerName: KeyName;
    cosignerName?: KeyName;
}): void;
/**
 * signs with first or second signature for all inputs.
 * p2shP2pk is signed only with first sign.
 */
export declare function signAllTxnInputs<TNumber extends number | bigint>(txb: UtxoTransactionBuilder<TNumber>, inputs: TxnInput<TNumber>[], rootWalletKeys: RootWalletKeys, sign: 'halfsigned' | 'fullsigned', signers?: {
    signerName: KeyName;
    cosignerName?: KeyName;
}): void;
/**
 * construct transaction for given inputs, outputs, network and root wallet keys.
 */
export declare function constructTxnBuilder<TNumber extends number | bigint>(inputs: TxnInput<TNumber>[], outputs: TxnOutput<TNumber>[], network: Network, rootWalletKeys: RootWalletKeys, sign: 'unsigned' | 'halfsigned' | 'fullsigned', signers?: {
    signerName: KeyName;
    cosignerName?: KeyName;
}): UtxoTransactionBuilder<TNumber>;
//# sourceMappingURL=transaction.d.ts.map