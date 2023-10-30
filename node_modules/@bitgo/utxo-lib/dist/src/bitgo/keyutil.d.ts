/// <reference types="node" />
import { ECPairInterface } from 'ecpair';
import { Network } from '../networks';
/**
 * Create an ECPair from the raw private key bytes
 * @param {Buffer} buffer - Private key for the ECPair. Must be exactly 32 bytes.
 * @param {Object} [network] - Network for the ECPair. Defaults to bitcoin.
 * @return {ECPair}
 */
export declare function privateKeyBufferToECPair(buffer: Buffer, network?: Network): ECPairInterface;
/**
 * Get the private key as a 32 bytes buffer. If it is smaller than 32 bytes, pad it with zeros
 * @param {ECPair} ecPair
 * @return Buffer 32 bytes
 */
export declare function privateKeyBufferFromECPair(ecPair: ECPairInterface): Buffer;
//# sourceMappingURL=keyutil.d.ts.map