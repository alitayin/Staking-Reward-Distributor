/// <reference types="node" />
import { TxInput } from 'bitcoinjs-lib';
export declare function isPlaceholderSignature(v: number | Buffer): boolean;
/**
 * @return true iff P2TR script path's control block matches BitGo's need
 */
export declare function isValidControlBock(controlBlock: Buffer): boolean;
/**
 * @return script path level for P2TR control block
 */
export declare function calculateScriptPathLevel(controlBlock: Buffer): number;
/**
 * @return leaf version for P2TR control block.
 */
export declare function getLeafVersion(controlBlock: Buffer): number;
export declare type ParsedScriptType2Of3 = 'p2sh' | 'p2shP2wsh' | 'p2wsh' | 'taprootKeyPathSpend' | 'taprootScriptPathSpend';
export declare type ParsedScriptType = ParsedScriptType2Of3 | 'p2shP2pk';
export declare type ParsedPubScript = {
    scriptType: ParsedScriptType;
};
export declare type ParsedSignatureScript = {
    scriptType: ParsedScriptType;
};
export interface ParsedSignatureScriptP2shP2pk extends ParsedSignatureScript {
    scriptType: 'p2shP2pk';
    publicKeys: [Buffer];
    signatures: [Buffer];
}
export interface ParsedPubScriptTaprootKeyPath extends ParsedPubScript {
    scriptType: 'taprootKeyPathSpend';
    publicKeys: [Buffer];
    pubScript: Buffer;
}
export interface ParsedPubScriptTaprootScriptPath extends ParsedPubScript {
    scriptType: 'taprootScriptPathSpend';
    publicKeys: [Buffer, Buffer];
    pubScript: Buffer;
}
export declare type ParsedPubScriptTaproot = ParsedPubScriptTaprootKeyPath | ParsedPubScriptTaprootScriptPath;
export interface ParsedPubScriptP2ms extends ParsedPubScript {
    scriptType: 'p2sh' | 'p2shP2wsh' | 'p2wsh';
    publicKeys: [Buffer, Buffer, Buffer];
    pubScript: Buffer;
    redeemScript: Buffer | undefined;
    witnessScript: Buffer | undefined;
}
export interface ParsedPubScriptP2shP2pk extends ParsedPubScript {
    scriptType: 'p2shP2pk';
    publicKeys: [Buffer];
    pubScript: Buffer;
    redeemScript: Buffer;
}
export interface ParsedSignatureScriptP2ms extends ParsedSignatureScript {
    scriptType: 'p2sh' | 'p2shP2wsh' | 'p2wsh';
    publicKeys: [Buffer, Buffer, Buffer];
    signatures: [Buffer, Buffer] | [Buffer | 0, Buffer | 0, Buffer | 0];
    pubScript: Buffer;
    redeemScript: Buffer | undefined;
    witnessScript: Buffer | undefined;
}
/**
 * Keypath spends only have a single signature
 */
export interface ParsedSignatureScriptTaprootKeyPath extends ParsedSignatureScript {
    scriptType: 'taprootKeyPathSpend';
    signatures: [Buffer];
}
/**
 * Taproot Scriptpath spends are more similar to regular p2ms spends and have two public keys and
 * two signatures
 */
export interface ParsedSignatureScriptTaprootScriptPath extends ParsedSignatureScript {
    scriptType: 'taprootScriptPathSpend';
    publicKeys: [Buffer, Buffer];
    signatures: [Buffer, Buffer];
    controlBlock: Buffer;
    leafVersion: number;
    /** Indicates the level inside the taptree. */
    scriptPathLevel: number;
    pubScript: Buffer;
}
export declare type ParsedSignatureScriptTaproot = ParsedSignatureScriptTaprootKeyPath | ParsedSignatureScriptTaprootScriptPath;
export declare type InputPubScript = Buffer;
/**
 * Parse a transaction's signature script to obtain public keys, signatures, the sig script,
 * and other properties.
 *
 * Only supports script types used in BitGo transactions.
 *
 * @param input
 * @returns ParsedSignatureScript
 */
export declare function parseSignatureScript(input: TxInput): ParsedSignatureScriptP2shP2pk | ParsedSignatureScriptP2ms | ParsedSignatureScriptTaproot;
export declare function parseSignatureScript2Of3(input: TxInput): ParsedSignatureScriptP2ms | ParsedSignatureScriptTaproot;
/**
 * @return pubScript (scriptPubKey/redeemScript/witnessScript) is parsed.
 * P2SH => scriptType, pubScript (redeemScript), redeemScript, public keys
 * PW2SH => scriptType, pubScript (witnessScript), witnessScript, public keys.
 * P2SH-PW2SH => scriptType, pubScript (witnessScript), witnessScript, public keys.
 * taprootScriptPathSpend (P2TR and P2TRMUISG2 script path) => scriptType, pubScript, pub keys.
 * taprootKeyPathSpend (P2TRMUISG2 key path) => scriptType, pubScript (34-byte output script), pub key (tapOutputKey).
 */
export declare function parsePubScript2Of3(inputPubScript: InputPubScript, scriptType: 'taprootKeyPathSpend'): ParsedPubScriptTaprootKeyPath;
export declare function parsePubScript2Of3(inputPubScript: InputPubScript, scriptType: 'taprootScriptPathSpend'): ParsedPubScriptTaprootScriptPath;
export declare function parsePubScript2Of3(inputPubScript: InputPubScript, scriptType: 'p2sh' | 'p2shP2wsh' | 'p2wsh'): ParsedPubScriptP2ms;
export declare function parsePubScript2Of3(inputPubScript: InputPubScript, scriptType: ParsedScriptType2Of3): ParsedPubScriptP2ms | ParsedPubScriptTaproot;
/**
 * @return pubScript (scriptPubKey/redeemScript/witnessScript) is parsed.
 * P2SH => scriptType, pubScript (redeemScript), redeemScript, public keys
 * PW2SH => scriptType, pubScript (witnessScript), witnessScript, public keys.
 * P2SH-PW2SH => scriptType, pubScript (witnessScript), witnessScript, public keys.
 * taprootScriptPathSpend (P2TR and P2TRMUISG2 script path) => scriptType, pubScript, pub keys.
 * taprootKeyPathSpend (P2TRMUISG2 key path) => scriptType, pubScript (34-byte output script), pub key (tapOutputKey).
 * P2SH-P2PK => scriptType, pubScript, pub key, redeemScript.
 */
export declare function parsePubScript(inputPubScript: InputPubScript, scriptType: 'taprootKeyPathSpend'): ParsedPubScriptTaprootKeyPath;
export declare function parsePubScript(inputPubScript: InputPubScript, scriptType: 'taprootScriptPathSpend'): ParsedPubScriptTaprootScriptPath;
export declare function parsePubScript(inputPubScript: InputPubScript, scriptType: 'p2shP2pk'): ParsedPubScriptP2shP2pk;
export declare function parsePubScript(inputPubScript: InputPubScript, scriptType: 'p2sh' | 'p2shP2wsh' | 'p2wsh'): ParsedPubScriptP2ms;
export declare function parsePubScript(inputPubScript: InputPubScript, scriptType: ParsedScriptType): ParsedPubScriptP2ms | ParsedPubScriptTaproot | ParsedPubScriptP2shP2pk;
//# sourceMappingURL=parseInput.d.ts.map