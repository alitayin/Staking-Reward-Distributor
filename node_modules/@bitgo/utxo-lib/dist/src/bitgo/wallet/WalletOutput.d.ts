import { UtxoPsbt } from '../UtxoPsbt';
import { RootWalletKeys } from './WalletKeys';
import { ChainCode } from './chains';
/**
 * Add a verifiable wallet output to the PSBT. The output and all data
 * needed to verify it from public keys only are added to the PSBT.
 * Typically these are change outputs.
 *
 * @param psbt the PSBT to add change output to
 * @param rootWalletKeys keys that will be able to spend the output
 * @param chain chain code to use for deriving scripts (and to determine script
 *              type) chain is an API parameter in the BitGo API, and may be
 *              any valid ChainCode
 * @param index derivation index for the change address
 * @param value value of the change output
 */
export declare function addWalletOutputToPsbt(psbt: UtxoPsbt, rootWalletKeys: RootWalletKeys, chain: ChainCode, index: number, value: bigint): void;
/**
 * Update the wallet output with the required information when necessary. If the
 * information is there already, it will skip over it.
 *
 * This function assumes that the output script and value have already been set.
 *
 * @param psbt the PSBT to update change output at
 * @param rootWalletKeys keys that will be able to spend the output
 * @param outputIndex output index where to update the output
 * @param chain chain code to use for deriving scripts (and to determine script
 *              type) chain is an API parameter in the BitGo API, and may be
 *              any valid ChainCode
 * @param index derivation index for the change address
 * @param value value of the change output
 */
export declare function updateWalletOutputForPsbt(psbt: UtxoPsbt, rootWalletKeys: RootWalletKeys, outputIndex: number, chain: ChainCode, index: number): void;
//# sourceMappingURL=WalletOutput.d.ts.map