/// <reference types="node" />
import { Base58CheckResult } from 'bitcoinjs-lib/src/address';
import { Network } from '../../networks';
export declare function fromBase58Check(address: string): Base58CheckResult;
export declare function toBase58Check(hash: Buffer, version: number): string;
export declare function fromOutputScript(outputScript: Buffer, network: Network): string;
export declare function toOutputScript(address: string, network: Network): Buffer;
//# sourceMappingURL=address.d.ts.map