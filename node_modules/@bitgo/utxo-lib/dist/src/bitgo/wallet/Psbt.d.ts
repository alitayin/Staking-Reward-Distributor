/// <reference types="node" />
import { PsbtInput } from 'bip174/src/lib/interfaces';
import { BIP32Interface } from 'bip32';
import { UtxoPsbt } from '../UtxoPsbt';
import { UtxoTransaction } from '../UtxoTransaction';
import { RootWalletKeys } from './WalletKeys';
import { WalletUnspent } from './Unspent';
import { ParsedPubScriptP2ms, ParsedPubScriptTaprootScriptPath, ParsedPubScriptTaprootKeyPath, ParsedPubScriptP2shP2pk, ParsedScriptType } from '../parseInput';
import { Triple } from '../types';
import { TxInput } from 'bitcoinjs-lib';
declare type BaseSignatureContainer<T> = {
    signatures: T;
};
declare type UnsignedSignatureContainer = BaseSignatureContainer<undefined>;
declare type HalfSignedSignatureContainer = BaseSignatureContainer<[Buffer]>;
declare type FullSignedSignatureContainer = BaseSignatureContainer<[Buffer, Buffer]>;
declare type SignatureContainer = UnsignedSignatureContainer | HalfSignedSignatureContainer | FullSignedSignatureContainer;
/**
 * Contents of a pre-finalized PSBT Input for p2trMusig2 key path in the non-finalized state.
 * T is [Buffer] for first signature, [Buffer, Buffer] for both signatures and `undefined` for no signatures.
 */
declare type BaseTaprootKeyPathSignatureContainer<T> = {
    signatures: T;
    /** Only contains participants that have added a signature */
    participantPublicKeys: T;
};
declare type UnsignedTaprootKeyPathSignatureContainer = BaseTaprootKeyPathSignatureContainer<undefined>;
declare type HalfSignedTaprootKeyPathSignatureContainer = BaseTaprootKeyPathSignatureContainer<[Buffer]>;
declare type FullSignedTaprootKeyPathSignatureContainer = BaseTaprootKeyPathSignatureContainer<[Buffer, Buffer]>;
declare type TaprootKeyPathSignatureContainer = UnsignedTaprootKeyPathSignatureContainer | HalfSignedTaprootKeyPathSignatureContainer | FullSignedTaprootKeyPathSignatureContainer;
/**
 * To hold parsed psbt data for p2ms based script types - p2sh, p2wsh, and p2shP2wsh
 */
export declare type ParsedPsbtP2ms = ParsedPubScriptP2ms & SignatureContainer;
/**
 * To hold parsed psbt data for TaprootKeyPathSpend script type.
 */
export declare type ParsedPsbtTaprootKeyPath = ParsedPubScriptTaprootKeyPath & TaprootKeyPathSignatureContainer;
/**
 * To hold parsed psbt data for TaprootScriptPathSpend script path script type.
 */
export declare type ParsedPsbtTaprootScriptPath = ParsedPubScriptTaprootScriptPath & SignatureContainer & {
    controlBlock: Buffer;
    leafVersion: number;
    /** Indicates the level inside the taptree. */
    scriptPathLevel: number;
};
export declare type ParsedPsbtTaproot = ParsedPsbtTaprootKeyPath | ParsedPsbtTaprootScriptPath;
declare type P2shP2pkSignatureContainer = UnsignedSignatureContainer | HalfSignedSignatureContainer;
export declare type ParsedPsbtP2shP2pk = ParsedPubScriptP2shP2pk & P2shP2pkSignatureContainer;
/**
 * psbt input index and its user, backup, bitgo signatures status
 */
export declare type SignatureValidation = [index: number, sigTriple: Triple<boolean>];
/**
 * @return PSBT filled with metatdata as per input params tx, unspents and rootWalletKeys.
 * Unsigned PSBT for taproot input with witnessUtxo
 * Unsigned PSBT for other input with witnessUtxo/nonWitnessUtxo, redeemScript/witnessScript, bip32Derivation
 * Signed PSBT for taproot input with witnessUtxo, tapLeafScript, tapBip32Derivation, tapScriptSig
 * Signed PSBT for other input with witnessUtxo/nonWitnessUtxo, redeemScript/witnessScript, bip32Derivation, partialSig
 */
export declare function toWalletPsbt(tx: UtxoTransaction<bigint>, unspents: WalletUnspent<bigint>[], rootWalletKeys: RootWalletKeys): UtxoPsbt;
/**
 * @param psbt
 * @param inputIndex
 * @param signer
 * @param unspent
 * @return signed PSBT with signer's key for unspent
 */
export declare function signWalletPsbt(psbt: UtxoPsbt, inputIndex: number, signer: BIP32Interface, unspent: WalletUnspent<bigint>): void;
/**
 * @returns script type of the input
 */
export declare function getPsbtInputScriptType(input: PsbtInput): ParsedScriptType;
/**
 * @return psbt metadata are parsed as per below conditions.
 * redeemScript/witnessScript/tapLeafScript matches BitGo.
 * signature and public key count matches BitGo.
 * P2SH-P2PK => scriptType, redeemScript, public key, signature.
 * P2SH => scriptType, redeemScript, public keys, signatures.
 * PW2SH => scriptType, witnessScript, public keys, signatures.
 * P2SH-PW2SH => scriptType, redeemScript, witnessScript, public keys, signatures.
 * P2TR and P2TR MUSIG2 script path => scriptType (taprootScriptPathSpend), pubScript (leaf script), controlBlock,
 * scriptPathLevel, leafVersion, public keys, signatures.
 * P2TR MUSIG2 kep path => scriptType (taprootKeyPathSpend), pubScript (scriptPubKey), participant pub keys (signer),
 * public key (tapOutputkey), signatures (partial signer sigs).
 */
export declare function parsePsbtInput(input: PsbtInput): ParsedPsbtP2ms | ParsedPsbtTaproot | ParsedPsbtP2shP2pk;
/**
 * @returns strictly parse the input and get signature count.
 * unsigned(0), half-signed(1) or fully-signed(2)
 */
export declare function getStrictSignatureCount(input: TxInput | PsbtInput): 0 | 1 | 2;
/**
 * @returns strictly parse input and get signature count for all inputs.
 * 0=unsigned, 1=half-signed or 2=fully-signed
 */
export declare function getStrictSignatureCounts(tx: UtxoPsbt | UtxoTransaction<number | bigint> | PsbtInput[] | TxInput[]): (0 | 1 | 2)[];
/**
 * @return true iff inputs array is of PsbtInputType type
 * */
export declare function isPsbtInputArray(inputs: PsbtInput[] | TxInput[]): inputs is PsbtInput[];
/**
 * @return true iff inputs array is of TxInput type
 * */
export declare function isTxInputArray(inputs: PsbtInput[] | TxInput[]): inputs is TxInput[];
/**
 * @returns true iff given psbt/transaction/tx-input-array/psbt-input-array contains at least one taproot key path spend input
 */
export declare function isTransactionWithKeyPathSpendInput(data: UtxoPsbt | UtxoTransaction<bigint | number> | PsbtInput[] | TxInput[]): boolean;
/**
 * Set the RootWalletKeys as the globalXpubs on the psbt
 *
 * We do all the matching of the (tap)bip32Derivations masterFingerprint to the fingerprint of the
 * extendedPubkey.
 */
export declare function addXpubsToPsbt(psbt: UtxoPsbt, rootWalletKeys: RootWalletKeys): void;
/**
 * validates signatures for each 2 of 3 input against user, backup, bitgo keys derived from rootWalletKeys.
 * @returns array of input index and its [is valid user sig exist, is valid backup sig exist, is valid user bitgo exist]
 * For p2shP2pk input, [false, false, false] is returned since it is not a 2 of 3 sig input.
 */
export declare function getSignatureValidationArrayPsbt(psbt: UtxoPsbt, rootWalletKeys: RootWalletKeys): SignatureValidation[];
/**
 * Extracts the half signed transaction from the psbt for p2ms based script types - p2sh, p2wsh, and p2shP2wsh.
 * The purpose is to provide backward compatibility to keyternal (KRS) that only supports network transaction and p2ms script types.
 */
export declare function extractP2msOnlyHalfSignedTx(psbt: UtxoPsbt): UtxoTransaction<bigint>;
/**
 * Clones the psbt without nonWitnessUtxo for non-segwit inputs and witnessUtxo is added instead.
 * It is not BIP-174 compliant, so use it carefully.
 */
export declare function clonePsbtWithoutNonWitnessUtxo(psbt: UtxoPsbt): UtxoPsbt;
/**
 * Deletes witnessUtxo for non-segwit inputs to make the PSBT BIP-174 compliant.
 */
export declare function deleteWitnessUtxoForNonSegwitInputs(psbt: UtxoPsbt): void;
export {};
//# sourceMappingURL=Psbt.d.ts.map