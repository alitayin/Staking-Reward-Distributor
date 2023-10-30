/// <reference types="node" />
import { BIP32Interface } from 'bip32';
import { Network } from '../networks';
import { ChainCode, NonWitnessWalletUnspent, outputScripts, RootWalletKeys, Unspent, UnspentWithPrevTx, UtxoTransaction, WalletUnspent } from '../bitgo';
export declare type InputType = outputScripts.ScriptType2Of3;
export declare function mockPrevTx(vout: number, outputScript: Buffer, value: bigint, network: Network): UtxoTransaction<bigint>;
export declare const replayProtectionKeyPair: BIP32Interface;
export declare function isReplayProtectionUnspent<TNumber extends bigint | number>(u: Unspent<TNumber>, network: Network): boolean;
export declare function mockReplayProtectionUnspent<TNumber extends number | bigint>(network: Network, value: TNumber, { key, vout }?: {
    key?: BIP32Interface;
    vout?: number;
}): UnspentWithPrevTx<TNumber>;
export declare function mockWalletUnspent<TNumber extends number | bigint>(network: Network, value: TNumber, { chain, index, keys, vout, id, }?: {
    chain?: ChainCode;
    index?: number;
    keys?: RootWalletKeys;
    vout?: number;
    id?: string;
}): WalletUnspent<TNumber> | NonWitnessWalletUnspent<TNumber>;
export declare function mockUnspents<TNumber extends number | bigint>(rootWalletKeys: RootWalletKeys, inputScriptTypes: (InputType | outputScripts.ScriptTypeP2shP2pk)[], testOutputAmount: TNumber, network: Network): (Unspent<TNumber> | WalletUnspent<TNumber>)[];
//# sourceMappingURL=mock.d.ts.map