/// <reference types="node" />
import * as bitcoinjs from 'bitcoinjs-lib';
import { Base58CheckResult, Bech32Result } from 'bitcoinjs-lib/src/address';
import { Network } from './networks';
export declare function fromOutputScript(outputScript: Buffer, network: Network): string;
export declare function toOutputScript(address: string, network: Network): Buffer;
export declare function toBase58Check(hash: Buffer, version: number, network: Network): string;
export declare function fromBase58Check(address: string, network: Network): Base58CheckResult;
export declare const fromBech32: typeof bitcoinjs.address.fromBech32, toBech32: typeof bitcoinjs.address.toBech32;
export { Base58CheckResult, Bech32Result };
//# sourceMappingURL=address.d.ts.map