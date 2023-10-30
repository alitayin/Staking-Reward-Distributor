import { BIP32Interface } from 'bip32';
import { DerivedWalletKeys, RootWalletKeys, WalletKeys } from './WalletKeys';
import { Triple } from '../types';
export declare class WalletUnspentSigner<T extends WalletKeys> {
    signer: BIP32Interface;
    cosigner: BIP32Interface;
    readonly walletKeys: T;
    static from(walletKeys: RootWalletKeys, signer: BIP32Interface, cosigner: BIP32Interface): WalletUnspentSigner<RootWalletKeys>;
    readonly signerIndex: any;
    readonly cosignerIndex: any;
    constructor(walletKeys: WalletKeys | Triple<BIP32Interface>, signer: BIP32Interface, cosigner: BIP32Interface);
    /**
     * @param chain
     * @param index
     * @return WalletUnspentSigner that contains keys for generating output scripts and signatures.
     */
    deriveForChainAndIndex(chain: number, index: number): WalletUnspentSigner<DerivedWalletKeys>;
}
//# sourceMappingURL=WalletUnspentSigner.d.ts.map