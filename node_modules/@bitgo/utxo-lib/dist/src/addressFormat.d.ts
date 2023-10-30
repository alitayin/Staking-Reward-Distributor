/// <reference types="node" />
/**
 * Implements methods for nonstandard (non-canonical) address formats.
 *
 * Use `toOutputScriptTryFormats()` instead of `toOutputScript()` to parse addresses in
 * non-canonical formats
 */
import { Network } from './networks';
export declare const addressFormats: readonly ["default", "cashaddr"];
export declare type AddressFormat = (typeof addressFormats)[number];
/**
 * @param format
 * @param network
 * @return true iff format is supported for network
 */
export declare function isSupportedAddressFormat(format: AddressFormat, network: Network): boolean;
/**
 * @param outputScript
 * @param format
 * @param network
 * @return address formatted using provided AddressFormat
 */
export declare function fromOutputScriptWithFormat(outputScript: Buffer, format: AddressFormat, network: Network): string;
/**
 * @param address
 * @param format
 * @param network
 * @return output script parsed with provided AddressFormat
 */
export declare function toOutputScriptWithFormat(address: string, format: AddressFormat, network: Network): Buffer;
/**
 * Attempts to parse address with different address formats, returns first hit.
 * @param address
 * @param network
 * @param formats - defaults to all supported address formats for network
 * @return tuple with [AddressFormat, Buffer] containing format and parsed output script
 */
export declare function toOutputScriptAndFormat(address: string, network: Network, formats?: AddressFormat[]): [AddressFormat, Buffer];
/**
 * Same as `toOutputScriptAndFormat`, only returning script
 * @param address - {@see toOutputScriptAndFormat}
 * @param network - {@see toOutputScriptAndFormat}
 * @param formats - {@see toOutputScriptAndFormat}
 * @return parsed output script
 */
export declare function toOutputScriptTryFormats(address: string, network: Network, formats?: AddressFormat[]): Buffer;
/**
 * @param address
 * @param network
 * @return address in canonical format
 */
export declare function toCanonicalFormat(address: string, network: Network): string;
//# sourceMappingURL=addressFormat.d.ts.map