"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unsign = exports.getInputUpdate = void 0;
const assert = require("assert");
const __1 = require("../..");
const parseInput_1 = require("../parseInput");
const signature_1 = require("../signature");
const outputScripts_1 = require("../outputScripts");
function omitUndefined(v) {
    return Object.fromEntries(Object.entries(v).filter(([k, v]) => v !== undefined));
}
function getInputUpdate(tx, vin, prevOuts) {
    const nonWitnessUtxo = prevOuts[vin].prevTx;
    const { script, witness } = tx.ins[vin];
    if (script.length === 0 && witness.length === 0) {
        return nonWitnessUtxo ? { nonWitnessUtxo } : {};
    }
    const parsedInput = parseInput_1.parseSignatureScript(tx.ins[vin]);
    assert.ok(parsedInput.scriptType !== 'taprootKeyPathSpend');
    function getPartialSigs() {
        assert.ok(parsedInput.scriptType !== 'taprootKeyPathSpend');
        return signature_1.getSignaturesWithPublicKeys(tx, vin, prevOuts, parsedInput.publicKeys).flatMap((signature, i) => signature
            ? [
                {
                    pubkey: parsedInput.publicKeys[i],
                    signature,
                },
            ]
            : []);
    }
    // Because Zcash directly hashes the value for non-segwit transactions, we do not need to check indirectly
    // with the previous transaction. Therefore, we can treat Zcash non-segwit transactions as Bitcoin
    // segwit transactions
    if (parsedInput.scriptType !== 'taprootScriptPathSpend' &&
        !outputScripts_1.hasWitnessData(parsedInput.scriptType) &&
        !nonWitnessUtxo &&
        __1.getMainnet(tx.network) !== __1.networks.zcash) {
        throw new Error(`scriptType ${parsedInput.scriptType} requires prevTx Buffer`);
    }
    switch (parsedInput.scriptType) {
        case 'p2shP2pk':
            return {
                nonWitnessUtxo,
                partialSig: [{ pubkey: parsedInput.publicKeys[0], signature: parsedInput.signatures[0] }],
            };
        case 'p2sh':
        case 'p2wsh':
        case 'p2shP2wsh':
            return omitUndefined({
                nonWitnessUtxo,
                partialSig: getPartialSigs(),
                redeemScript: parsedInput.redeemScript,
                witnessScript: parsedInput.witnessScript,
            });
        case 'taprootScriptPathSpend':
            const leafHash = __1.taproot.getTapleafHash(__1.ecc, parsedInput.controlBlock, parsedInput.pubScript);
            return {
                tapLeafScript: [
                    {
                        controlBlock: parsedInput.controlBlock,
                        script: parsedInput.pubScript,
                        leafVersion: parsedInput.leafVersion,
                    },
                ],
                tapScriptSig: getPartialSigs().map((obj) => ({ ...obj, leafHash })),
            };
    }
}
exports.getInputUpdate = getInputUpdate;
/**
 * Takes a partially signed transaction and removes the scripts and signatures.
 *
 * Inputs must be one of:
 *  - p2shP2pk
 *  - p2sh 2-of-3
 *  - p2shP2wsh 2-of-3
 *  - p2wsh 2-of-3
 *  - p2tr script path 2-of-2
 *
 * @param tx the partially signed transaction
 * @param prevOuts
 *
 * @return the removed scripts and signatures, ready to be added to a PSBT
 */
function unsign(tx, prevOuts) {
    return tx.ins.map((input, vin) => {
        const update = getInputUpdate(tx, vin, prevOuts);
        input.witness = [];
        input.script = Buffer.alloc(0);
        return update;
    });
}
exports.unsign = unsign;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZnJvbUhhbGZTaWduZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvYml0Z28vcHNidC9mcm9tSGFsZlNpZ25lZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxpQ0FBaUM7QUFFakMsNkJBQStFO0FBRS9FLDhDQUFxRDtBQUNyRCw0Q0FBMkQ7QUFDM0Qsb0RBQWtEO0FBRWxELFNBQVMsYUFBYSxDQUFvQyxDQUEwQjtJQUNsRixPQUFPLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxLQUFLLFNBQVMsQ0FBQyxDQUFNLENBQUM7QUFDeEYsQ0FBQztBQUVELFNBQWdCLGNBQWMsQ0FDNUIsRUFBMkIsRUFDM0IsR0FBVyxFQUNYLFFBQW9EO0lBRXBELE1BQU0sY0FBYyxHQUFHLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUM7SUFDNUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3hDLElBQUksTUFBTSxDQUFDLE1BQU0sS0FBSyxDQUFDLElBQUksT0FBTyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7UUFDL0MsT0FBTyxjQUFjLENBQUMsQ0FBQyxDQUFDLEVBQUUsY0FBYyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztLQUNqRDtJQUVELE1BQU0sV0FBVyxHQUFHLGlDQUFvQixDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUN0RCxNQUFNLENBQUMsRUFBRSxDQUFDLFdBQVcsQ0FBQyxVQUFVLEtBQUsscUJBQXFCLENBQUMsQ0FBQztJQUU1RCxTQUFTLGNBQWM7UUFDckIsTUFBTSxDQUFDLEVBQUUsQ0FBQyxXQUFXLENBQUMsVUFBVSxLQUFLLHFCQUFxQixDQUFDLENBQUM7UUFDNUQsT0FBTyx1Q0FBMkIsQ0FBQyxFQUFFLEVBQUUsR0FBRyxFQUFFLFFBQVEsRUFBRSxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsU0FBUyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQ3JHLFNBQVM7WUFDUCxDQUFDLENBQUM7Z0JBQ0U7b0JBQ0UsTUFBTSxFQUFFLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO29CQUNqQyxTQUFTO2lCQUNWO2FBQ0Y7WUFDSCxDQUFDLENBQUMsRUFBRSxDQUNQLENBQUM7SUFDSixDQUFDO0lBQ0QsMEdBQTBHO0lBQzFHLGtHQUFrRztJQUNsRyxzQkFBc0I7SUFDdEIsSUFDRSxXQUFXLENBQUMsVUFBVSxLQUFLLHdCQUF3QjtRQUNuRCxDQUFDLDhCQUFjLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQztRQUN2QyxDQUFDLGNBQWM7UUFDZixjQUFVLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxLQUFLLFlBQVEsQ0FBQyxLQUFLLEVBQ3pDO1FBQ0EsTUFBTSxJQUFJLEtBQUssQ0FBQyxjQUFjLFdBQVcsQ0FBQyxVQUFVLHlCQUF5QixDQUFDLENBQUM7S0FDaEY7SUFFRCxRQUFRLFdBQVcsQ0FBQyxVQUFVLEVBQUU7UUFDOUIsS0FBSyxVQUFVO1lBQ2IsT0FBTztnQkFDTCxjQUFjO2dCQUNkLFVBQVUsRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQUUsU0FBUyxFQUFFLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQzthQUMxRixDQUFDO1FBQ0osS0FBSyxNQUFNLENBQUM7UUFDWixLQUFLLE9BQU8sQ0FBQztRQUNiLEtBQUssV0FBVztZQUNkLE9BQU8sYUFBYSxDQUFDO2dCQUNuQixjQUFjO2dCQUNkLFVBQVUsRUFBRSxjQUFjLEVBQUU7Z0JBQzVCLFlBQVksRUFBRSxXQUFXLENBQUMsWUFBWTtnQkFDdEMsYUFBYSxFQUFFLFdBQVcsQ0FBQyxhQUFhO2FBQ3pDLENBQUMsQ0FBQztRQUNMLEtBQUssd0JBQXdCO1lBQzNCLE1BQU0sUUFBUSxHQUFHLFdBQU8sQ0FBQyxjQUFjLENBQUMsT0FBTSxFQUFFLFdBQVcsQ0FBQyxZQUFZLEVBQUUsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ2pHLE9BQU87Z0JBQ0wsYUFBYSxFQUFFO29CQUNiO3dCQUNFLFlBQVksRUFBRSxXQUFXLENBQUMsWUFBWTt3QkFDdEMsTUFBTSxFQUFFLFdBQVcsQ0FBQyxTQUFTO3dCQUM3QixXQUFXLEVBQUUsV0FBVyxDQUFDLFdBQVc7cUJBQ3JDO2lCQUNGO2dCQUNELFlBQVksRUFBRSxjQUFjLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBRSxHQUFHLEdBQUcsRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDO2FBQ3BFLENBQUM7S0FDTDtBQUNILENBQUM7QUFuRUQsd0NBbUVDO0FBRUQ7Ozs7Ozs7Ozs7Ozs7O0dBY0c7QUFDSCxTQUFnQixNQUFNLENBQUMsRUFBMkIsRUFBRSxRQUE0QjtJQUM5RSxPQUFPLEVBQUUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxFQUFFLEdBQUcsRUFBRSxFQUFFO1FBQy9CLE1BQU0sTUFBTSxHQUFHLGNBQWMsQ0FBQyxFQUFFLEVBQUUsR0FBRyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQ2pELEtBQUssQ0FBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO1FBQ25CLEtBQUssQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMvQixPQUFPLE1BQU0sQ0FBQztJQUNoQixDQUFDLENBQUMsQ0FBQztBQUNMLENBQUM7QUFQRCx3QkFPQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgUHNidElucHV0VXBkYXRlLCBQYXJ0aWFsU2lnIH0gZnJvbSAnYmlwMTc0L3NyYy9saWIvaW50ZXJmYWNlcyc7XG5pbXBvcnQgeyBlY2MgYXMgZWNjTGliLCBUeE91dHB1dCwgdGFwcm9vdCwgZ2V0TWFpbm5ldCwgbmV0d29ya3MgfSBmcm9tICcuLi8uLic7XG5pbXBvcnQgeyBVdHhvVHJhbnNhY3Rpb24gfSBmcm9tICcuLi9VdHhvVHJhbnNhY3Rpb24nO1xuaW1wb3J0IHsgcGFyc2VTaWduYXR1cmVTY3JpcHQgfSBmcm9tICcuLi9wYXJzZUlucHV0JztcbmltcG9ydCB7IGdldFNpZ25hdHVyZXNXaXRoUHVibGljS2V5cyB9IGZyb20gJy4uL3NpZ25hdHVyZSc7XG5pbXBvcnQgeyBoYXNXaXRuZXNzRGF0YSB9IGZyb20gJy4uL291dHB1dFNjcmlwdHMnO1xuXG5mdW5jdGlvbiBvbWl0VW5kZWZpbmVkPFQgZXh0ZW5kcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPj4odjogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pOiBUIHtcbiAgcmV0dXJuIE9iamVjdC5mcm9tRW50cmllcyhPYmplY3QuZW50cmllcyh2KS5maWx0ZXIoKFtrLCB2XSkgPT4gdiAhPT0gdW5kZWZpbmVkKSkgYXMgVDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldElucHV0VXBkYXRlKFxuICB0eDogVXR4b1RyYW5zYWN0aW9uPGJpZ2ludD4sXG4gIHZpbjogbnVtYmVyLFxuICBwcmV2T3V0czogKFR4T3V0cHV0PGJpZ2ludD4gJiB7IHByZXZUeD86IEJ1ZmZlciB9KVtdXG4pOiBQc2J0SW5wdXRVcGRhdGUge1xuICBjb25zdCBub25XaXRuZXNzVXR4byA9IHByZXZPdXRzW3Zpbl0ucHJldlR4O1xuICBjb25zdCB7IHNjcmlwdCwgd2l0bmVzcyB9ID0gdHguaW5zW3Zpbl07XG4gIGlmIChzY3JpcHQubGVuZ3RoID09PSAwICYmIHdpdG5lc3MubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG5vbldpdG5lc3NVdHhvID8geyBub25XaXRuZXNzVXR4byB9IDoge307XG4gIH1cblxuICBjb25zdCBwYXJzZWRJbnB1dCA9IHBhcnNlU2lnbmF0dXJlU2NyaXB0KHR4Lmluc1t2aW5dKTtcbiAgYXNzZXJ0Lm9rKHBhcnNlZElucHV0LnNjcmlwdFR5cGUgIT09ICd0YXByb290S2V5UGF0aFNwZW5kJyk7XG5cbiAgZnVuY3Rpb24gZ2V0UGFydGlhbFNpZ3MoKTogUGFydGlhbFNpZ1tdIHtcbiAgICBhc3NlcnQub2socGFyc2VkSW5wdXQuc2NyaXB0VHlwZSAhPT0gJ3RhcHJvb3RLZXlQYXRoU3BlbmQnKTtcbiAgICByZXR1cm4gZ2V0U2lnbmF0dXJlc1dpdGhQdWJsaWNLZXlzKHR4LCB2aW4sIHByZXZPdXRzLCBwYXJzZWRJbnB1dC5wdWJsaWNLZXlzKS5mbGF0TWFwKChzaWduYXR1cmUsIGkpID0+XG4gICAgICBzaWduYXR1cmVcbiAgICAgICAgPyBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHB1YmtleTogcGFyc2VkSW5wdXQucHVibGljS2V5c1tpXSxcbiAgICAgICAgICAgICAgc2lnbmF0dXJlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdXG4gICAgICAgIDogW11cbiAgICApO1xuICB9XG4gIC8vIEJlY2F1c2UgWmNhc2ggZGlyZWN0bHkgaGFzaGVzIHRoZSB2YWx1ZSBmb3Igbm9uLXNlZ3dpdCB0cmFuc2FjdGlvbnMsIHdlIGRvIG5vdCBuZWVkIHRvIGNoZWNrIGluZGlyZWN0bHlcbiAgLy8gd2l0aCB0aGUgcHJldmlvdXMgdHJhbnNhY3Rpb24uIFRoZXJlZm9yZSwgd2UgY2FuIHRyZWF0IFpjYXNoIG5vbi1zZWd3aXQgdHJhbnNhY3Rpb25zIGFzIEJpdGNvaW5cbiAgLy8gc2Vnd2l0IHRyYW5zYWN0aW9uc1xuICBpZiAoXG4gICAgcGFyc2VkSW5wdXQuc2NyaXB0VHlwZSAhPT0gJ3RhcHJvb3RTY3JpcHRQYXRoU3BlbmQnICYmXG4gICAgIWhhc1dpdG5lc3NEYXRhKHBhcnNlZElucHV0LnNjcmlwdFR5cGUpICYmXG4gICAgIW5vbldpdG5lc3NVdHhvICYmXG4gICAgZ2V0TWFpbm5ldCh0eC5uZXR3b3JrKSAhPT0gbmV0d29ya3MuemNhc2hcbiAgKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBzY3JpcHRUeXBlICR7cGFyc2VkSW5wdXQuc2NyaXB0VHlwZX0gcmVxdWlyZXMgcHJldlR4IEJ1ZmZlcmApO1xuICB9XG5cbiAgc3dpdGNoIChwYXJzZWRJbnB1dC5zY3JpcHRUeXBlKSB7XG4gICAgY2FzZSAncDJzaFAycGsnOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbm9uV2l0bmVzc1V0eG8sXG4gICAgICAgIHBhcnRpYWxTaWc6IFt7IHB1YmtleTogcGFyc2VkSW5wdXQucHVibGljS2V5c1swXSwgc2lnbmF0dXJlOiBwYXJzZWRJbnB1dC5zaWduYXR1cmVzWzBdIH1dLFxuICAgICAgfTtcbiAgICBjYXNlICdwMnNoJzpcbiAgICBjYXNlICdwMndzaCc6XG4gICAgY2FzZSAncDJzaFAyd3NoJzpcbiAgICAgIHJldHVybiBvbWl0VW5kZWZpbmVkKHtcbiAgICAgICAgbm9uV2l0bmVzc1V0eG8sXG4gICAgICAgIHBhcnRpYWxTaWc6IGdldFBhcnRpYWxTaWdzKCksXG4gICAgICAgIHJlZGVlbVNjcmlwdDogcGFyc2VkSW5wdXQucmVkZWVtU2NyaXB0LFxuICAgICAgICB3aXRuZXNzU2NyaXB0OiBwYXJzZWRJbnB1dC53aXRuZXNzU2NyaXB0LFxuICAgICAgfSk7XG4gICAgY2FzZSAndGFwcm9vdFNjcmlwdFBhdGhTcGVuZCc6XG4gICAgICBjb25zdCBsZWFmSGFzaCA9IHRhcHJvb3QuZ2V0VGFwbGVhZkhhc2goZWNjTGliLCBwYXJzZWRJbnB1dC5jb250cm9sQmxvY2ssIHBhcnNlZElucHV0LnB1YlNjcmlwdCk7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB0YXBMZWFmU2NyaXB0OiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgY29udHJvbEJsb2NrOiBwYXJzZWRJbnB1dC5jb250cm9sQmxvY2ssXG4gICAgICAgICAgICBzY3JpcHQ6IHBhcnNlZElucHV0LnB1YlNjcmlwdCxcbiAgICAgICAgICAgIGxlYWZWZXJzaW9uOiBwYXJzZWRJbnB1dC5sZWFmVmVyc2lvbixcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICB0YXBTY3JpcHRTaWc6IGdldFBhcnRpYWxTaWdzKCkubWFwKChvYmopID0+ICh7IC4uLm9iaiwgbGVhZkhhc2ggfSkpLFxuICAgICAgfTtcbiAgfVxufVxuXG4vKipcbiAqIFRha2VzIGEgcGFydGlhbGx5IHNpZ25lZCB0cmFuc2FjdGlvbiBhbmQgcmVtb3ZlcyB0aGUgc2NyaXB0cyBhbmQgc2lnbmF0dXJlcy5cbiAqXG4gKiBJbnB1dHMgbXVzdCBiZSBvbmUgb2Y6XG4gKiAgLSBwMnNoUDJwa1xuICogIC0gcDJzaCAyLW9mLTNcbiAqICAtIHAyc2hQMndzaCAyLW9mLTNcbiAqICAtIHAyd3NoIDItb2YtM1xuICogIC0gcDJ0ciBzY3JpcHQgcGF0aCAyLW9mLTJcbiAqXG4gKiBAcGFyYW0gdHggdGhlIHBhcnRpYWxseSBzaWduZWQgdHJhbnNhY3Rpb25cbiAqIEBwYXJhbSBwcmV2T3V0c1xuICpcbiAqIEByZXR1cm4gdGhlIHJlbW92ZWQgc2NyaXB0cyBhbmQgc2lnbmF0dXJlcywgcmVhZHkgdG8gYmUgYWRkZWQgdG8gYSBQU0JUXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB1bnNpZ24odHg6IFV0eG9UcmFuc2FjdGlvbjxiaWdpbnQ+LCBwcmV2T3V0czogVHhPdXRwdXQ8YmlnaW50PltdKTogUHNidElucHV0VXBkYXRlW10ge1xuICByZXR1cm4gdHguaW5zLm1hcCgoaW5wdXQsIHZpbikgPT4ge1xuICAgIGNvbnN0IHVwZGF0ZSA9IGdldElucHV0VXBkYXRlKHR4LCB2aW4sIHByZXZPdXRzKTtcbiAgICBpbnB1dC53aXRuZXNzID0gW107XG4gICAgaW5wdXQuc2NyaXB0ID0gQnVmZmVyLmFsbG9jKDApO1xuICAgIHJldHVybiB1cGRhdGU7XG4gIH0pO1xufVxuIl19