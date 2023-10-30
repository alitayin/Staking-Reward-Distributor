"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateWalletOutputForPsbt = exports.addWalletOutputToPsbt = void 0;
const bitcoinjs_lib_1 = require("bitcoinjs-lib");
const chains_1 = require("./chains");
const outputScripts_1 = require("../outputScripts");
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
function addWalletOutputToPsbt(psbt, rootWalletKeys, chain, index, value) {
    const walletKeys = rootWalletKeys.deriveForChainAndIndex(chain, index);
    const scriptType = chains_1.scriptTypeForChain(chain);
    if (scriptType === 'p2tr' || scriptType === 'p2trMusig2') {
        const payment = scriptType === 'p2tr' ? outputScripts_1.createPaymentP2tr(walletKeys.publicKeys) : outputScripts_1.createPaymentP2trMusig2(walletKeys.publicKeys);
        psbt.addOutput({ script: payment.output, value });
    }
    else {
        const { scriptPubKey: script } = outputScripts_1.createOutputScript2of3(walletKeys.publicKeys, scriptType);
        psbt.addOutput({ script, value });
    }
    updateWalletOutputForPsbt(psbt, rootWalletKeys, psbt.data.outputs.length - 1, chain, index);
}
exports.addWalletOutputToPsbt = addWalletOutputToPsbt;
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
function updateWalletOutputForPsbt(psbt, rootWalletKeys, outputIndex, chain, index) {
    if (psbt.data.outputs.length <= outputIndex) {
        throw new Error(`outputIndex (${outputIndex}) is too large for the number of outputs (${psbt.data.outputs.length})`);
    }
    const outputScript = psbt.getOutputScript(outputIndex);
    const walletKeys = rootWalletKeys.deriveForChainAndIndex(chain, index);
    const scriptType = chains_1.scriptTypeForChain(chain);
    const output = psbt.data.outputs[outputIndex];
    const update = {};
    if (scriptType === 'p2tr' || scriptType === 'p2trMusig2') {
        const payment = scriptType === 'p2tr' ? outputScripts_1.createPaymentP2tr(walletKeys.publicKeys) : outputScripts_1.createPaymentP2trMusig2(walletKeys.publicKeys);
        if (!payment.output || !payment.output.equals(outputScript)) {
            throw new Error(`cannot update a p2tr output where the scripts do not match - Failing.`);
        }
        const allLeafHashes = payment.redeems.map((r) => bitcoinjs_lib_1.taproot.hashTapLeaf(r.output));
        if (!output.tapTree) {
            update.tapTree = payment.tapTree;
        }
        if (!output.tapInternalKey) {
            update.tapInternalKey = payment.internalPubkey;
        }
        if (!output.tapBip32Derivation) {
            update.tapBip32Derivation = [0, 1, 2].map((idx) => {
                const pubkey = outputScripts_1.toXOnlyPublicKey(walletKeys.triple[idx].publicKey);
                const leafHashes = [];
                payment.redeems.forEach((r, idx) => {
                    if (r.pubkeys.find((pk) => pk.equals(pubkey))) {
                        leafHashes.push(allLeafHashes[idx]);
                    }
                });
                return {
                    leafHashes,
                    pubkey,
                    path: walletKeys.paths[idx],
                    masterFingerprint: rootWalletKeys.triple[idx].fingerprint,
                };
            });
        }
    }
    else {
        const { scriptPubKey, witnessScript, redeemScript } = outputScripts_1.createOutputScript2of3(walletKeys.publicKeys, scriptType);
        if (!scriptPubKey.equals(outputScript)) {
            throw new Error(`cannot update an output where the scripts do not match - Failing.`);
        }
        if (!output.bip32Derivation) {
            update.bip32Derivation = [0, 1, 2].map((idx) => ({
                pubkey: walletKeys.triple[idx].publicKey,
                path: walletKeys.paths[idx],
                masterFingerprint: rootWalletKeys.triple[idx].fingerprint,
            }));
        }
        if (!output.witnessScript && witnessScript) {
            update.witnessScript = witnessScript;
        }
        if (!output.redeemScript && redeemScript) {
            update.redeemScript = redeemScript;
        }
    }
    psbt.updateOutput(outputIndex, update);
}
exports.updateWalletOutputForPsbt = updateWalletOutputForPsbt;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiV2FsbGV0T3V0cHV0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2JpdGdvL3dhbGxldC9XYWxsZXRPdXRwdXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsaURBQXdDO0FBSXhDLHFDQUF5RDtBQUN6RCxvREFBd0g7QUFFeEg7Ozs7Ozs7Ozs7OztHQVlHO0FBQ0gsU0FBZ0IscUJBQXFCLENBQ25DLElBQWMsRUFDZCxjQUE4QixFQUM5QixLQUFnQixFQUNoQixLQUFhLEVBQ2IsS0FBYTtJQUViLE1BQU0sVUFBVSxHQUFHLGNBQWMsQ0FBQyxzQkFBc0IsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDdkUsTUFBTSxVQUFVLEdBQUcsMkJBQWtCLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDN0MsSUFBSSxVQUFVLEtBQUssTUFBTSxJQUFJLFVBQVUsS0FBSyxZQUFZLEVBQUU7UUFDeEQsTUFBTSxPQUFPLEdBQ1gsVUFBVSxLQUFLLE1BQU0sQ0FBQyxDQUFDLENBQUMsaUNBQWlCLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyx1Q0FBdUIsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDcEgsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxPQUFPLENBQUMsTUFBTyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7S0FDcEQ7U0FBTTtRQUNMLE1BQU0sRUFBRSxZQUFZLEVBQUUsTUFBTSxFQUFFLEdBQUcsc0NBQXNCLENBQUMsVUFBVSxDQUFDLFVBQVUsRUFBRSxVQUFVLENBQUMsQ0FBQztRQUMzRixJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7S0FDbkM7SUFDRCx5QkFBeUIsQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFD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aW1wb3J0IHsgdGFwcm9vdCB9IGZyb20gJ2JpdGNvaW5qcy1saWInO1xuaW1wb3J0IHsgUHNidE91dHB1dFVwZGF0ZSB9IGZyb20gJ2JpcDE3NC9zcmMvbGliL2ludGVyZmFjZXMnO1xuaW1wb3J0IHsgVXR4b1BzYnQgfSBmcm9tICcuLi9VdHhvUHNidCc7XG5pbXBvcnQgeyBSb290V2FsbGV0S2V5cyB9IGZyb20gJy4vV2FsbGV0S2V5cyc7XG5pbXBvcnQgeyBDaGFpbkNvZGUsIHNjcmlwdFR5cGVGb3JDaGFpbiB9IGZyb20gJy4vY2hhaW5zJztcbmltcG9ydCB7IGNyZWF0ZU91dHB1dFNjcmlwdDJvZjMsIGNyZWF0ZVBheW1lbnRQMnRyLCBjcmVhdGVQYXltZW50UDJ0ck11c2lnMiwgdG9YT25seVB1YmxpY0tleSB9IGZyb20gJy4uL291dHB1dFNjcmlwdHMnO1xuXG4vKipcbiAqIEFkZCBhIHZlcmlmaWFibGUgd2FsbGV0IG91dHB1dCB0byB0aGUgUFNCVC4gVGhlIG91dHB1dCBhbmQgYWxsIGRhdGFcbiAqIG5lZWRlZCB0byB2ZXJpZnkgaXQgZnJvbSBwdWJsaWMga2V5cyBvbmx5IGFyZSBhZGRlZCB0byB0aGUgUFNCVC5cbiAqIFR5cGljYWxseSB0aGVzZSBhcmUgY2hhbmdlIG91dHB1dHMuXG4gKlxuICogQHBhcmFtIHBzYnQgdGhlIFBTQlQgdG8gYWRkIGNoYW5nZSBvdXRwdXQgdG9cbiAqIEBwYXJhbSByb290V2FsbGV0S2V5cyBrZXlzIHRoYXQgd2lsbCBiZSBhYmxlIHRvIHNwZW5kIHRoZSBvdXRwdXRcbiAqIEBwYXJhbSBjaGFpbiBjaGFpbiBjb2RlIHRvIHVzZSBmb3IgZGVyaXZpbmcgc2NyaXB0cyAoYW5kIHRvIGRldGVybWluZSBzY3JpcHRcbiAqICAgICAgICAgICAgICB0eXBlKSBjaGFpbiBpcyBhbiBBUEkgcGFyYW1ldGVyIGluIHRoZSBCaXRHbyBBUEksIGFuZCBtYXkgYmVcbiAqICAgICAgICAgICAgICBhbnkgdmFsaWQgQ2hhaW5Db2RlXG4gKiBAcGFyYW0gaW5kZXggZGVyaXZhdGlvbiBpbmRleCBmb3IgdGhlIGNoYW5nZSBhZGRyZXNzXG4gKiBAcGFyYW0gdmFsdWUgdmFsdWUgb2YgdGhlIGNoYW5nZSBvdXRwdXRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFkZFdhbGxldE91dHB1dFRvUHNidChcbiAgcHNidDogVXR4b1BzYnQsXG4gIHJvb3RXYWxsZXRLZXlzOiBSb290V2FsbGV0S2V5cyxcbiAgY2hhaW46IENoYWluQ29kZSxcbiAgaW5kZXg6IG51bWJlcixcbiAgdmFsdWU6IGJpZ2ludFxuKTogdm9pZCB7XG4gIGNvbnN0IHdhbGxldEtleXMgPSByb290V2FsbGV0S2V5cy5kZXJpdmVGb3JDaGFpbkFuZEluZGV4KGNoYWluLCBpbmRleCk7XG4gIGNvbnN0IHNjcmlwdFR5cGUgPSBzY3JpcHRUeXBlRm9yQ2hhaW4oY2hhaW4pO1xuICBpZiAoc2NyaXB0VHlwZSA9PT0gJ3AydHInIHx8IHNjcmlwdFR5cGUgPT09ICdwMnRyTXVzaWcyJykge1xuICAgIGNvbnN0IHBheW1lbnQgPVxuICAgICAgc2NyaXB0VHlwZSA9PT0gJ3AydHInID8gY3JlYXRlUGF5bWVudFAydHIod2FsbGV0S2V5cy5wdWJsaWNLZXlzKSA6IGNyZWF0ZVBheW1lbnRQMnRyTXVzaWcyKHdhbGxldEtleXMucHVibGljS2V5cyk7XG4gICAgcHNidC5hZGRPdXRwdXQoeyBzY3JpcHQ6IHBheW1lbnQub3V0cHV0ISwgdmFsdWUgfSk7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgeyBzY3JpcHRQdWJLZXk6IHNjcmlwdCB9ID0gY3JlYXRlT3V0cHV0U2NyaXB0Mm9mMyh3YWxsZXRLZXlzLnB1YmxpY0tleXMsIHNjcmlwdFR5cGUpO1xuICAgIHBzYnQuYWRkT3V0cHV0KHsgc2NyaXB0LCB2YWx1ZSB9KTtcbiAgfVxuICB1cGRhdGVXYWxsZXRPdXRwdXRGb3JQc2J0KHBzYnQsIHJvb3RXYWxsZXRLZXlzLCBwc2J0LmRhdGEub3V0cHV0cy5sZW5ndGggLSAxLCBjaGFpbiwgaW5kZXgpO1xufVxuXG4vKipcbiAqIFVwZGF0ZSB0aGUgd2FsbGV0IG91dHB1dCB3aXRoIHRoZSByZXF1aXJlZCBpbmZvcm1hdGlvbiB3aGVuIG5lY2Vzc2FyeS4gSWYgdGhlXG4gKiBpbmZvcm1hdGlvbiBpcyB0aGVyZSBhbHJlYWR5LCBpdCB3aWxsIHNraXAgb3ZlciBpdC5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIGFzc3VtZXMgdGhhdCB0aGUgb3V0cHV0IHNjcmlwdCBhbmQgdmFsdWUgaGF2ZSBhbHJlYWR5IGJlZW4gc2V0LlxuICpcbiAqIEBwYXJhbSBwc2J0IHRoZSBQU0JUIHRvIHVwZGF0ZSBjaGFuZ2Ugb3V0cHV0IGF0XG4gKiBAcGFyYW0gcm9vdFdhbGxldEtleXMga2V5cyB0aGF0IHdpbGwgYmUgYWJsZSB0byBzcGVuZCB0aGUgb3V0cHV0XG4gKiBAcGFyYW0gb3V0cHV0SW5kZXggb3V0cHV0IGluZGV4IHdoZXJlIHRvIHVwZGF0ZSB0aGUgb3V0cHV0XG4gKiBAcGFyYW0gY2hhaW4gY2hhaW4gY29kZSB0byB1c2UgZm9yIGRlcml2aW5nIHNjcmlwdHMgKGFuZCB0byBkZXRlcm1pbmUgc2NyaXB0XG4gKiAgICAgICAgICAgICAgdHlwZSkgY2hhaW4gaXMgYW4gQVBJIHBhcmFtZXRlciBpbiB0aGUgQml0R28gQVBJLCBhbmQgbWF5IGJlXG4gKiAgICAgICAgICAgICAgYW55IHZhbGlkIENoYWluQ29kZVxuICogQHBhcmFtIGluZGV4IGRlcml2YXRpb24gaW5kZXggZm9yIHRoZSBjaGFuZ2UgYWRkcmVzc1xuICogQHBhcmFtIHZhbHVlIHZhbHVlIG9mIHRoZSBjaGFuZ2Ugb3V0cHV0XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB1cGRhdGVXYWxsZXRPdXRwdXRGb3JQc2J0KFxuICBwc2J0OiBVdHhvUHNidCxcbiAgcm9vdFdhbGxldEtleXM6IFJvb3RXYWxsZXRLZXlzLFxuICBvdXRwdXRJbmRleDogbnVtYmVyLFxuICBjaGFpbjogQ2hhaW5Db2RlLFxuICBpbmRleDogbnVtYmVyXG4pOiB2b2lkIHtcbiAgaWYgKHBzYnQuZGF0YS5vdXRwdXRzLmxlbmd0aCA8PSBvdXRwdXRJbmRleCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBvdXRwdXRJbmRleCAoJHtvdXRwdXRJbmRleH0pIGlzIHRvbyBsYXJnZSBmb3IgdGhlIG51bWJlciBvZiBvdXRwdXRzICgke3BzYnQuZGF0YS5vdXRwdXRzLmxlbmd0aH0pYFxuICAgICk7XG4gIH1cblxuICBjb25zdCBvdXRwdXRTY3JpcHQgPSBwc2J0LmdldE91dHB1dFNjcmlwdChvdXRwdXRJbmRleCk7XG5cbiAgY29uc3Qgd2FsbGV0S2V5cyA9IHJvb3RXYWxsZXRLZXlzLmRlcml2ZUZvckNoYWluQW5kSW5kZXgoY2hhaW4sIGluZGV4KTtcbiAgY29uc3Qgc2NyaXB0VHlwZSA9IHNjcmlwdFR5cGVGb3JDaGFpbihjaGFpbik7XG4gIGNvbnN0IG91dHB1dCA9IHBzYnQuZGF0YS5vdXRwdXRzW291dHB1dEluZGV4XTtcbiAgY29uc3QgdXBkYXRlOiBQc2J0T3V0cHV0VXBkYXRlID0ge307XG4gIGlmIChzY3JpcHRUeXBlID09PSAncDJ0cicgfHwgc2NyaXB0VHlwZSA9PT0gJ3AydHJNdXNpZzInKSB7XG4gICAgY29uc3QgcGF5bWVudCA9XG4gICAgICBzY3JpcHRUeXBlID09PSAncDJ0cicgPyBjcmVhdGVQYXltZW50UDJ0cih3YWxsZXRLZXlzLnB1YmxpY0tleXMpIDogY3JlYXRlUGF5bWVudFAydHJNdXNpZzIod2FsbGV0S2V5cy5wdWJsaWNLZXlzKTtcbiAgICBpZiAoIXBheW1lbnQub3V0cHV0IHx8ICFwYXltZW50Lm91dHB1dC5lcXVhbHMob3V0cHV0U2NyaXB0KSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBjYW5ub3QgdXBkYXRlIGEgcDJ0ciBvdXRwdXQgd2hlcmUgdGhlIHNjcmlwdHMgZG8gbm90IG1hdGNoIC0gRmFpbGluZy5gKTtcbiAgICB9XG4gICAgY29uc3QgYWxsTGVhZkhhc2hlcyA9IHBheW1lbnQucmVkZWVtcyEubWFwKChyKSA9PiB0YXByb290Lmhhc2hUYXBMZWFmKHIub3V0cHV0ISkpO1xuXG4gICAgaWYgKCFvdXRwdXQudGFwVHJlZSkge1xuICAgICAgdXBkYXRlLnRhcFRyZWUgPSBwYXltZW50LnRhcFRyZWU7XG4gICAgfVxuICAgIGlmICghb3V0cHV0LnRhcEludGVybmFsS2V5KSB7XG4gICAgICB1cGRhdGUudGFwSW50ZXJuYWxLZXkgPSBwYXltZW50LmludGVybmFsUHVia2V5O1xuICAgIH1cbiAgICBpZiAoIW91dHB1dC50YXBCaXAzMkRlcml2YXRpb24pIHtcbiAgICAgIHVwZGF0ZS50YXBCaXAzMkRlcml2YXRpb24gPSBbMCwgMSwgMl0ubWFwKChpZHgpID0+IHtcbiAgICAgICAgY29uc3QgcHVia2V5ID0gdG9YT25seVB1YmxpY0tleSh3YWxsZXRLZXlzLnRyaXBsZVtpZHhdLnB1YmxpY0tleSk7XG4gICAgICAgIGNvbnN0IGxlYWZIYXNoZXM6IEJ1ZmZlcltdID0gW107XG4gICAgICAgIHBheW1lbnQucmVkZWVtcyEuZm9yRWFjaCgociwgaWR4KSA9PiB7XG4gICAgICAgICAgaWYgKHIucHVia2V5cyEuZmluZCgocGspID0+IHBrLmVxdWFscyhwdWJrZXkpKSkge1xuICAgICAgICAgICAgbGVhZkhhc2hlcy5wdXNoKGFsbExlYWZIYXNoZXNbaWR4XSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBsZWFmSGFzaGVzLFxuICAgICAgICAgIHB1YmtleSxcbiAgICAgICAgICBwYXRoOiB3YWxsZXRLZXlzLnBhdGhzW2lkeF0sXG4gICAgICAgICAgbWFzdGVyRmluZ2VycHJpbnQ6IHJvb3RXYWxsZXRLZXlzLnRyaXBsZVtpZHhdLmZpbmdlcnByaW50LFxuICAgICAgICB9O1xuICAgICAgfSk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGNvbnN0IHsgc2NyaXB0UHViS2V5LCB3aXRuZXNzU2NyaXB0LCByZWRlZW1TY3JpcHQgfSA9IGNyZWF0ZU91dHB1dFNjcmlwdDJvZjMod2FsbGV0S2V5cy5wdWJsaWNLZXlzLCBzY3JpcHRUeXBlKTtcbiAgICBpZiAoIXNjcmlwdFB1YktleS5lcXVhbHMob3V0cHV0U2NyaXB0KSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBjYW5ub3QgdXBkYXRlIGFuIG91dHB1dCB3aGVyZSB0aGUgc2NyaXB0cyBkbyBub3QgbWF0Y2ggLSBGYWlsaW5nLmApO1xuICAgIH1cbiAgICBpZiAoIW91dHB1dC5iaXAzMkRlcml2YXRpb24pIHtcbiAgICAgIHVwZGF0ZS5iaXAzMkRlcml2YXRpb24gPSBbMCwgMSwgMl0ubWFwKChpZHgpID0+ICh7XG4gICAgICAgIHB1YmtleTogd2FsbGV0S2V5cy50cmlwbGVbaWR4XS5wdWJsaWNLZXksXG4gICAgICAgIHBhdGg6IHdhbGxldEtleXMucGF0aHNbaWR4XSxcbiAgICAgICAgbWFzdGVyRmluZ2VycHJpbnQ6IHJvb3RXYWxsZXRLZXlzLnRyaXBsZVtpZHhdLmZpbmdlcnByaW50LFxuICAgICAgfSkpO1xuICAgIH1cbiAgICBpZiAoIW91dHB1dC53aXRuZXNzU2NyaXB0ICYmIHdpdG5lc3NTY3JpcHQpIHtcbiAgICAgIHVwZGF0ZS53aXRuZXNzU2NyaXB0ID0gd2l0bmVzc1NjcmlwdDtcbiAgICB9XG4gICAgaWYgKCFvdXRwdXQucmVkZWVtU2NyaXB0ICYmIHJlZGVlbVNjcmlwdCkge1xuICAgICAgdXBkYXRlLnJlZGVlbVNjcmlwdCA9IHJlZGVlbVNjcmlwdDtcbiAgICB9XG4gIH1cbiAgcHNidC51cGRhdGVPdXRwdXQob3V0cHV0SW5kZXgsIHVwZGF0ZSk7XG59XG4iXX0=