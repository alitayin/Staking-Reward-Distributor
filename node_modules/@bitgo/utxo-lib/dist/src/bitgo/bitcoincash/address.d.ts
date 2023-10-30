/// <reference types="node" />
import { Network } from '../../networks';
import { AddressFormat } from '../../addressFormat';
/**
 * @param network
 * @return network-specific cashaddr prefix
 */
export declare function getPrefix(network: Network): string;
/**
 * @param outputScript
 * @param network
 * @return outputScript encoded as cashaddr (prefixed, lowercase)
 */
export declare function fromOutputScriptToCashAddress(outputScript: Buffer, network: Network): string;
/**
 * @param address - Accepts addresses with and without prefix. Accepts all-lowercase and all-uppercase addresses. Rejects mixed-case addresses.
 * @param network
 * @return decoded output script
 */
export declare function toOutputScriptFromCashAddress(address: string, network: Network): Buffer;
/**
 * @param outputScript
 * @param format
 * @param network
 * @return address in specified format
 */
export declare function fromOutputScriptWithFormat(outputScript: Buffer, format: AddressFormat, network: Network): string;
/**
 * @param address
 * @param format
 * @param network
 * @return output script from address in specified format
 */
export declare function toOutputScriptWithFormat(address: string, format: AddressFormat, network: Network): Buffer;
//# sourceMappingURL=address.d.ts.map