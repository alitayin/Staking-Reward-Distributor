import { Network } from '../..';
import { ChainCode } from '..';
import { RootWalletKeys } from './WalletKeys';
import { SpendableScript } from '../outputScripts';
export declare function getWalletOutputScripts(keys: RootWalletKeys, chain: ChainCode, index: number): SpendableScript;
export declare function getWalletAddress(keys: RootWalletKeys, chain: ChainCode, index: number, network: Network): string;
//# sourceMappingURL=WalletScripts.d.ts.map