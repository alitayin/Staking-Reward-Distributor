/// <reference types="node" />
import { BIP32Interface } from 'bip32';
import { TxOutput } from 'bitcoinjs-lib';
import { UtxoTransaction } from './UtxoTransaction';
import { UtxoTransactionBuilder } from './UtxoTransactionBuilder';
import { ScriptType, ScriptType2Of3 } from './outputScripts';
import { Triple } from './types';
import { Network } from '../networks';
/**
 * Constraints for signature verifications.
 * Parameters are conjunctive: if multiple parameters are set, a verification for an individual
 * signature must satisfy all of them.
 */
export declare type VerificationSettings = {
    /**
     * The index of the signature to verify. Only iterates over non-empty signatures.
     */
    signatureIndex?: number;
    /**
     * The public key to verify.
     */
    publicKey?: Buffer;
};
/**
 * Result for a individual signature verification
 */
export declare type SignatureVerification = {
    /** Set to the public key that signed for the signature */
    signedBy: Buffer;
    /** Set to the signature buffer */
    signature: Buffer;
} | {
    signedBy: undefined;
    signature: undefined;
};
/**
 * @deprecated - use {@see verifySignaturesWithPublicKeys} instead
 * Get signature verifications for multsig transaction
 * @param transaction
 * @param inputIndex
 * @param amount - must be set for segwit transactions and BIP143 transactions
 * @param verificationSettings
 * @param prevOutputs - must be set for p2tr and p2trMusig2 transactions
 * @returns SignatureVerification[] - in order of parsed non-empty signatures
 */
export declare function getSignatureVerifications<TNumber extends number | bigint>(transaction: UtxoTransaction<TNumber>, inputIndex: number, amount: TNumber, verificationSettings?: VerificationSettings, prevOutputs?: TxOutput<TNumber>[]): SignatureVerification[];
/**
 * @deprecated use {@see verifySignatureWithPublicKeys} instead
 * @param transaction
 * @param inputIndex
 * @param amount
 * @param verificationSettings - if publicKey is specified, returns true iff any signature is signed by publicKey.
 * @param prevOutputs - must be set for p2tr transactions
 */
export declare function verifySignature<TNumber extends number | bigint>(transaction: UtxoTransaction<TNumber>, inputIndex: number, amount: TNumber, verificationSettings?: VerificationSettings, prevOutputs?: TxOutput<TNumber>[]): boolean;
/**
 * @param transaction
 * @param inputIndex
 * @param prevOutputs
 * @param publicKeys
 * @return array with signature corresponding to n-th key, undefined if no match found
 */
export declare function getSignaturesWithPublicKeys<TNumber extends number | bigint>(transaction: UtxoTransaction<TNumber>, inputIndex: number, prevOutputs: TxOutput<TNumber>[], publicKeys: Buffer[]): Array<Buffer | undefined>;
/**
 * @param transaction
 * @param inputIndex
 * @param prevOutputs - transaction outputs for inputs
 * @param publicKeys - public keys to check signatures for
 * @return array of booleans indicating a valid signature for every pubkey in _publicKeys_
 */
export declare function verifySignatureWithPublicKeys<TNumber extends number | bigint>(transaction: UtxoTransaction<TNumber>, inputIndex: number, prevOutputs: TxOutput<TNumber>[], publicKeys: Buffer[]): boolean[];
/**
 * Wrapper for {@see verifySignatureWithPublicKeys} for single pubkey
 * @param transaction
 * @param inputIndex
 * @param prevOutputs
 * @param publicKey
 * @return true iff signature is valid
 */
export declare function verifySignatureWithPublicKey<TNumber extends number | bigint>(transaction: UtxoTransaction<TNumber>, inputIndex: number, prevOutputs: TxOutput<TNumber>[], publicKey: Buffer): boolean;
export declare function getDefaultSigHash(network: Network, scriptType?: ScriptType): number;
export declare function signInputP2shP2pk<TNumber extends number | bigint>(txBuilder: UtxoTransactionBuilder<TNumber>, vin: number, keyPair: BIP32Interface): void;
export declare function signInput2Of3<TNumber extends number | bigint>(txBuilder: UtxoTransactionBuilder<TNumber>, vin: number, scriptType: ScriptType2Of3, pubkeys: Triple<Buffer>, keyPair: BIP32Interface, cosigner: Buffer, amount: TNumber): void;
//# sourceMappingURL=signature.d.ts.map