/**
 * Defines BitGo mappings between bip32 derivation path and script type.
 *
 * The scripts for a BitGo wallet address are defined by their derivation path.
 *
 * The derivation path has the format `0/0/${chain}/${index}` (in rare cases the prefix is not 0/0)
 *
 * The address script type (ScriptType2Of3) is defined by the `chain` parameter.
 *
 * This file defines the mapping between chain parameter and address type.
 */
import { ScriptType2Of3 } from '../outputScripts';
/**
 * All valid chain codes
 */
export declare const chainCodesP2sh: readonly [0, 1];
export declare const chainCodesP2shP2wsh: readonly [10, 11];
export declare const chainCodesP2wsh: readonly [20, 21];
export declare const chainCodesP2tr: readonly [30, 31];
export declare const chainCodesP2trMusig2: readonly [40, 41];
export declare const chainCodes: (0 | 30 | 1 | 10 | 11 | 20 | 21 | 31 | 40 | 41)[];
export declare type ChainCode = (typeof chainCodes)[number];
export declare function isChainCode(n: unknown): n is ChainCode;
/**
 * A script type maps to two ChainCodes:
 * External addresses are intended for deposits, internal addresses are intended for change outputs.
 */
export declare type ChainCodePair = Readonly<[external: ChainCode, internal: ChainCode]>;
/**
 * @return ChainCodePair for input
 */
export declare function toChainPair(v: ChainCodePair | ChainCode | ScriptType2Of3): ChainCodePair;
/**
 * @return ScriptType2Of3 for input
 */
export declare function scriptTypeForChain(chain: ChainCode): ScriptType2Of3;
/**
 * @return chain code intended for external addresses
 */
export declare function getExternalChainCode(v: ChainCodePair | ScriptType2Of3 | ChainCode): ChainCode;
/**
 * @return chain code intended for change outputs
 */
export declare function getInternalChainCode(v: ChainCodePair | ScriptType2Of3 | ChainCode): ChainCode;
/**
 * @return true iff chain code is external
 */
export declare function isExternalChainCode(v: ChainCode): boolean;
/**
 * @return true iff chain code is internal
 */
export declare function isInternalChainCode(v: ChainCode): boolean;
/**
 * @return true iff chain code is a segwit address
 */
export declare function isSegwit(v: ChainCode): boolean;
//# sourceMappingURL=chains.d.ts.map