"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZcashPsbt = void 0;
const UtxoPsbt_1 = require("../UtxoPsbt");
const ZcashTransaction_1 = require("./ZcashTransaction");
const __1 = require("../../");
const bip174_1 = require("bip174");
const types = require("bitcoinjs-lib/src/types");
const PsbtUtil_1 = require("../PsbtUtil");
const typeforce = require('typeforce');
const CONSENSUS_BRANCH_ID_KEY = Buffer.concat([
    Buffer.of(0xfc),
    Buffer.of(0x05),
    Buffer.from(PsbtUtil_1.PSBT_PROPRIETARY_IDENTIFIER),
    Buffer.of(PsbtUtil_1.ProprietaryKeySubtype.ZEC_CONSENSUS_BRANCH_ID),
]);
class ZcashPsbt extends UtxoPsbt_1.UtxoPsbt {
    static transactionFromBuffer(buffer, network) {
        return ZcashTransaction_1.ZcashTransaction.fromBuffer(buffer, false, 'bigint', network);
    }
    static createPsbt(opts, data) {
        return new ZcashPsbt(opts, data || new bip174_1.Psbt(new __1.PsbtTransaction({ tx: new ZcashTransaction_1.ZcashTransaction(opts.network) })));
    }
    /**
     * In version < 5 of Zcash transactions, the consensus branch ID is not serialized in the transaction
     * whereas in version 5 it is. If the transaction is less than a version 5, set the consensus branch id
     * in the global map in the psbt. If it is a version 5 transaction, throw an error if the consensus
     * branch id is set in the psbt (because it should be on the transaction already).
     * @param buffer Psbt buffer
     * @param opts options
     */
    static fromBuffer(buffer, opts) {
        var _a;
        const psbt = super.fromBuffer(buffer, opts);
        // Read `consensusBranchId` from the global-map
        let consensusBranchId = undefined;
        (_a = psbt.data.globalMap.unknownKeyVals) === null || _a === void 0 ? void 0 : _a.forEach(({ key, value }, i) => {
            if (key.equals(CONSENSUS_BRANCH_ID_KEY)) {
                consensusBranchId = value.readUint32LE();
            }
        });
        switch (psbt.tx.version) {
            case 4:
            case ZcashTransaction_1.ZcashTransaction.VERSION4_BRANCH_CANOPY:
            case ZcashTransaction_1.ZcashTransaction.VERSION4_BRANCH_NU5:
                if (!consensusBranchId || !psbt.data.globalMap.unknownKeyVals) {
                    throw new Error('Could not find consensus branch id on psbt for version 4 Zcash transaction');
                }
                psbt.tx.consensusBranchId = consensusBranchId;
                psbt.data.globalMap.unknownKeyVals = psbt.data.globalMap.unknownKeyVals.filter(({ key }) => key !== CONSENSUS_BRANCH_ID_KEY);
                // Delete consensusBranchId from globalMap so that if we were to serialize the psbt again
                // we would not add a duplicate key into the global map
                psbt.data.globalMap.unknownKeyVals.pop();
                return psbt;
            case 5:
            case ZcashTransaction_1.ZcashTransaction.VERSION5_BRANCH_NU5:
                if (consensusBranchId) {
                    throw new Error('Found consensus branch id in psbt global-map for version 5 Zcash transaction');
                }
                return psbt;
            default:
                throw new Error(`Unsupported transaction version ${psbt.tx.version}`);
        }
    }
    /**
     * If it is a version 4 transaction, add the consensus branch id to
     * the global map. If it is a version 5 transaction, just return the
     * buffer because the consensus branch id is already serialized in
     * the transaction.
     */
    toBuffer() {
        if (this.tx.version === 5 || this.tx.version === ZcashTransaction_1.ZcashTransaction.VERSION5_BRANCH_NU5) {
            return super.toBuffer();
        }
        const value = Buffer.alloc(4);
        value.writeUint32LE(this.tx.consensusBranchId);
        this.addUnknownKeyValToGlobal({ key: CONSENSUS_BRANCH_ID_KEY, value });
        if (!this.data.globalMap.unknownKeyVals) {
            throw new Error('Failed adding consensus branch id to unknownKeyVals');
        }
        const buff = super.toBuffer();
        this.data.globalMap.unknownKeyVals.pop();
        return buff;
    }
    setVersion(version, overwinter = true) {
        typeforce(types.UInt32, version);
        this.tx.overwintered = overwinter ? 1 : 0;
        this.tx.version = version;
        return this;
    }
    setDefaultsForVersion(network, version) {
        switch (version) {
            case 4:
            case ZcashTransaction_1.ZcashTransaction.VERSION4_BRANCH_CANOPY:
            case ZcashTransaction_1.ZcashTransaction.VERSION4_BRANCH_NU5:
                this.setVersion(4);
                break;
            case 5:
            case ZcashTransaction_1.ZcashTransaction.VERSION5_BRANCH_NU5:
                this.setVersion(5);
                break;
            default:
                throw new Error(`invalid version ${version}`);
        }
        this.tx.versionGroupId = ZcashTransaction_1.getDefaultVersionGroupIdForVersion(version);
        this.tx.consensusBranchId = ZcashTransaction_1.getDefaultConsensusBranchIdForVersion(network, version);
    }
    // For Zcash transactions, we do not have to have non-witness UTXO data for non-segwit
    // transactions because zcash hashes the value directly. Thus, it is unnecessary to have
    // the previous transaction hash on the unspent.
    signInput(inputIndex, keyPair, sighashTypes) {
        return PsbtUtil_1.withUnsafeNonSegwit(this, super.signInput.bind(this, inputIndex, keyPair, sighashTypes));
    }
    validateSignaturesOfInput(inputIndex, validator, pubkey) {
        return PsbtUtil_1.withUnsafeNonSegwit(this, super.validateSignaturesOfInput.bind(this, inputIndex, validator, pubkey));
    }
    setPropertyCheckSignatures(propName, value) {
        if (this.tx[propName] === value) {
            return;
        }
        this.checkForSignatures(propName);
        this.tx[propName] = value;
    }
    setConsensusBranchId(consensusBranchId) {
        typeforce(types.UInt32, consensusBranchId);
        this.setPropertyCheckSignatures('consensusBranchId', consensusBranchId);
    }
    setVersionGroupId(versionGroupId) {
        typeforce(types.UInt32, versionGroupId);
        this.setPropertyCheckSignatures('versionGroupId', versionGroupId);
    }
    setExpiryHeight(expiryHeight) {
        typeforce(types.UInt32, expiryHeight);
        this.setPropertyCheckSignatures('expiryHeight', expiryHeight);
    }
}
exports.ZcashPsbt = ZcashPsbt;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiWmNhc2hQc2J0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2JpdGdvL3pjYXNoL1pjYXNoUHNidC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSwwQ0FBaUQ7QUFDakQseURBSTRCO0FBQzVCLDhCQUEwRDtBQUMxRCxtQ0FBMEM7QUFDMUMsaURBQWlEO0FBRWpELDBDQUFzRztBQUN0RyxNQUFNLFNBQVMsR0FBRyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUM7QUFFdkMsTUFBTSx1QkFBdUIsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDO0lBQzVDLE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDO0lBQ2YsTUFBTSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUM7SUFDZixNQUFNLENBQUMsSUFBSSxDQUFDLHNDQUEyQixDQUFDO0lBQ3hDLE1BQU0sQ0FBQyxFQUFFLENBQUMsZ0NBQXFCLENBQUMsdUJBQXVCLENBQUM7Q0FDekQsQ0FBQyxDQUFDO0FBRUgsTUFBYSxTQUFVLFNBQVEsbUJBQWtDO0lBQ3JELE1BQU0sQ0FBQyxxQkFBcUIsQ0FBQyxNQUFjLEVBQUUsT0FBZ0I7UUFDckUsT0FBTyxtQ0FBZ0IsQ0FBQyxVQUFVLENBQVMsTUFBTSxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDL0UsQ0FBQztJQUVELE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBYyxFQUFFLElBQWU7UUFDL0MsT0FBTyxJQUFJLFNBQVMsQ0FDbEIsSUFBSSxFQUNKLElBQUksSUFBSSxJQUFJLGFBQVEsQ0FBQyxJQUFJLG1CQUFlLENBQUMsRUFBRSxFQUFFLEVBQUUsSUFBSSxtQ0FBZ0IsQ0FBUyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQzlGLENBQUM7SUFDSixDQUFDO0lBRUQ7Ozs7Ozs7T0FPRztJQUNILE1BQU0sQ0FBQyxVQUFVLENBQUMsTUFBYyxFQUFFLElBQWM7O1FBQzlD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b1BzYnQnO1xuaW1wb3J0IHtcbiAgZ2V0RGVmYXVsdENvbnNlbnN1c0JyYW5jaElkRm9yVmVyc2lvbixcbiAgZ2V0RGVmYXVsdFZlcnNpb25Hcm91cElkRm9yVmVyc2lvbixcbiAgWmNhc2hUcmFuc2FjdGlvbixcbn0gZnJvbSAnLi9aY2FzaFRyYW5zYWN0aW9uJztcbmltcG9ydCB7IE5ldHdvcmssIFBzYnRUcmFuc2FjdGlvbiwgU2lnbmVyIH0gZnJvbSAnLi4vLi4vJztcbmltcG9ydCB7IFBzYnQgYXMgUHNidEJhc2UgfSBmcm9tICdiaXAxNzQnO1xuaW1wb3J0ICogYXMgdHlwZXMgZnJvbSAnYml0Y29pbmpzLWxpYi9zcmMvdHlwZXMnO1xuaW1wb3J0IHsgVmFsaWRhdGVTaWdGdW5jdGlvbiB9IGZyb20gJ2JpdGNvaW5qcy1saWIvc3JjL3BzYnQnO1xuaW1wb3J0IHsgUHJvcHJpZXRhcnlLZXlTdWJ0eXBlLCBQU0JUX1BST1BSSUVUQVJZX0lERU5USUZJRVIsIHdpdGhVbnNhZmVOb25TZWd3aXQgfSBmcm9tICcuLi9Qc2J0VXRpbCc7XG5jb25zdCB0eXBlZm9yY2UgPSByZXF1aXJlKCd0eXBlZm9yY2UnKTtcblxuY29uc3QgQ09OU0VOU1VTX0JSQU5DSF9JRF9LRVkgPSBCdWZmZXIuY29uY2F0KFtcbiAgQnVmZmVyLm9mKDB4ZmMpLFxuICBCdWZmZXIub2YoMHgwNSksXG4gIEJ1ZmZlci5mcm9tKFBTQlRfUFJPUFJJRVRBUllfSURFTlRJRklFUiksXG4gIEJ1ZmZlci5vZihQcm9wcmlldGFyeUtleVN1YnR5cGUuWkVDX0NPTlNFTlNVU19CUkFOQ0hfSUQpLFxuXSk7XG5cbmV4cG9ydCBjbGFzcyBaY2FzaFBzYnQgZXh0ZW5kcyBVdHhvUHNidDxaY2FzaFRyYW5zYWN0aW9uPGJpZ2ludD4+IHtcbiAgcHJvdGVjdGVkIHN0YXRpYyB0cmFuc2FjdGlvbkZyb21CdWZmZXIoYnVmZmVyOiBCdWZmZXIsIG5ldHdvcms6IE5ldHdvcmspOiBaY2FzaFRyYW5zYWN0aW9uPGJpZ2ludD4ge1xuICAgIHJldHVybiBaY2FzaFRyYW5zYWN0aW9uLmZyb21CdWZmZXI8YmlnaW50PihidWZmZXIsIGZhbHNlLCAnYmlnaW50JywgbmV0d29yayk7XG4gIH1cblxuICBzdGF0aWMgY3JlYXRlUHNidChvcHRzOiBQc2J0T3B0cywgZGF0YT86IFBzYnRCYXNlKTogWmNhc2hQc2J0IHtcbiAgICByZXR1cm4gbmV3IFpjYXNoUHNidChcbiAgICAgIG9wdHMsXG4gICAgICBkYXRhIHx8IG5ldyBQc2J0QmFzZShuZXcgUHNidFRyYW5zYWN0aW9uKHsgdHg6IG5ldyBaY2FzaFRyYW5zYWN0aW9uPGJpZ2ludD4ob3B0cy5uZXR3b3JrKSB9KSlcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIEluIHZlcnNpb24gPCA1IG9mIFpjYXNoIHRyYW5zYWN0aW9ucywgdGhlIGNvbnNlbnN1cyBicmFuY2ggSUQgaXMgbm90IHNlcmlhbGl6ZWQgaW4gdGhlIHRyYW5zYWN0aW9uXG4gICAqIHdoZXJlYXMgaW4gdmVyc2lvbiA1IGl0IGlzLiBJZiB0aGUgdHJhbnNhY3Rpb24gaXMgbGVzcyB0aGFuIGEgdmVyc2lvbiA1LCBzZXQgdGhlIGNvbnNlbnN1cyBicmFuY2ggaWRcbiAgICogaW4gdGhlIGdsb2JhbCBtYXAgaW4gdGhlIHBzYnQuIElmIGl0IGlzIGEgdmVyc2lvbiA1IHRyYW5zYWN0aW9uLCB0aHJvdyBhbiBlcnJvciBpZiB0aGUgY29uc2Vuc3VzXG4gICAqIGJyYW5jaCBpZCBpcyBzZXQgaW4gdGhlIHBzYnQgKGJlY2F1c2UgaXQgc2hvdWxkIGJlIG9uIHRoZSB0cmFuc2FjdGlvbiBhbHJlYWR5KS5cbiAgICogQHBhcmFtIGJ1ZmZlciBQc2J0IGJ1ZmZlclxuICAgKiBAcGFyYW0gb3B0cyBvcHRpb25zXG4gICAqL1xuICBzdGF0aWMgZnJvbUJ1ZmZlcihidWZmZXI6IEJ1ZmZlciwgb3B0czogUHNidE9wdHMpOiBVdHhvUHNidDxaY2FzaFRyYW5zYWN0aW9uPGJpZ2ludD4+IHtcbiAgICBjb25zdCBwc2J0ID0gc3VwZXIuZnJvbUJ1ZmZlcihidWZmZXIsIG9wdHMpIGFzIFpjYXNoUHNidDtcblxuICAgIC8vIFJlYWQgYGNvbnNlbnN1c0JyYW5jaElkYCBmcm9tIHRoZSBnbG9iYWwtbWFwXG4gICAgbGV0IGNvbnNlbnN1c0JyYW5jaElkOiBudW1iZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gICAgcHNidC5kYXRhLmdsb2JhbE1hcC51bmtub3duS2V5VmFscz8uZm9yRWFjaCgoeyBrZXksIHZhbHVlIH0sIGkpID0+IHtcbiAgICAgIGlmIChrZXkuZXF1YWxzKENPTlNFTlNVU19CUkFOQ0hfSURfS0VZKSkge1xuICAgICAgICBjb25zZW5zdXNCcmFuY2hJZCA9IHZhbHVlLnJlYWRVaW50MzJMRSgpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHN3aXRjaCAocHNidC50eC52ZXJzaW9uKSB7XG4gICAgICBjYXNlIDQ6XG4gICAgICBjYXNlIFpjYXNoVHJhbnNhY3Rpb24uVkVSU0lPTjRfQlJBTkNIX0NBTk9QWTpcbiAgICAgIGNhc2UgWmNhc2hUcmFuc2FjdGlvbi5WRVJTSU9ONF9CUkFOQ0hfTlU1OlxuICAgICAgICBpZiAoIWNvbnNlbnN1c0JyYW5jaElkIHx8ICFwc2J0LmRhdGEuZ2xvYmFsTWFwLnVua25vd25LZXlWYWxzKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb3VsZCBub3QgZmluZCBjb25zZW5zdXMgYnJhbmNoIGlkIG9uIHBzYnQgZm9yIHZlcnNpb24gNCBaY2FzaCB0cmFuc2FjdGlvbicpO1xuICAgICAgICB9XG4gICAgICAgIHBzYnQudHguY29uc2Vuc3VzQnJhbmNoSWQgPSBjb25zZW5zdXNCcmFuY2hJZDtcbiAgICAgICAgcHNidC5kYXRhLmdsb2JhbE1hcC51bmtub3duS2V5VmFscyA9IHBzYnQuZGF0YS5nbG9iYWxNYXAudW5rbm93bktleVZhbHMuZmlsdGVyKFxuICAgICAgICAgICh7IGtleSB9KSA9PiBrZXkgIT09IENPTlNFTlNVU19CUkFOQ0hfSURfS0VZXG4gICAgICAgICk7XG5cbiAgICAgICAgLy8gRGVsZXRlIGNvbnNlbnN1c0JyYW5jaElkIGZyb20gZ2xvYmFsTWFwIHNvIHRoYXQgaWYgd2Ugd2VyZSB0byBzZXJpYWxpemUgdGhlIHBzYnQgYWdhaW5cbiAgICAgICAgLy8gd2Ugd291bGQgbm90IGFkZCBhIGR1cGxpY2F0ZSBrZXkgaW50byB0aGUgZ2xvYmFsIG1hcFxuICAgICAgICBwc2J0LmRhdGEuZ2xvYmFsTWFwLnVua25vd25LZXlWYWxzLnBvcCgpO1xuICAgICAgICByZXR1cm4gcHNidDtcbiAgICAgIGNhc2UgNTpcbiAgICAgIGNhc2UgWmNhc2hUcmFuc2FjdGlvbi5WRVJTSU9ONV9CUkFOQ0hfTlU1OlxuICAgICAgICBpZiAoY29uc2Vuc3VzQnJhbmNoSWQpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZvdW5kIGNvbnNlbnN1cyBicmFuY2ggaWQgaW4gcHNidCBnbG9iYWwtbWFwIGZvciB2ZXJzaW9uIDUgWmNhc2ggdHJhbnNhY3Rpb24nKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcHNidDtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgdHJhbnNhY3Rpb24gdmVyc2lvbiAke3BzYnQudHgudmVyc2lvbn1gKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSWYgaXQgaXMgYSB2ZXJzaW9uIDQgdHJhbnNhY3Rpb24sIGFkZCB0aGUgY29uc2Vuc3VzIGJyYW5jaCBpZCB0b1xuICAgKiB0aGUgZ2xvYmFsIG1hcC4gSWYgaXQgaXMgYSB2ZXJzaW9uIDUgdHJhbnNhY3Rpb24sIGp1c3QgcmV0dXJuIHRoZVxuICAgKiBidWZmZXIgYmVjYXVzZSB0aGUgY29uc2Vuc3VzIGJyYW5jaCBpZCBpcyBhbHJlYWR5IHNlcmlhbGl6ZWQgaW5cbiAgICogdGhlIHRyYW5zYWN0aW9uLlxuICAgKi9cbiAgdG9CdWZmZXIoKTogQnVmZmVyIHtcbiAgICBpZiAodGhpcy50eC52ZXJzaW9uID09PSA1IHx8IHRoaXMudHgudmVyc2lvbiA9PT0gWmNhc2hUcmFuc2FjdGlvbi5WRVJTSU9ONV9CUkFOQ0hfTlU1KSB7XG4gICAgICByZXR1cm4gc3VwZXIudG9CdWZmZXIoKTtcbiAgICB9XG4gICAgY29uc3QgdmFsdWUgPSBCdWZmZXIuYWxsb2MoNCk7XG4gICAgdmFsdWUud3JpdGVVaW50MzJMRSh0aGlzLnR4LmNvbnNlbnN1c0JyYW5jaElkKTtcbiAgICB0aGlzLmFkZFVua25vd25LZXlWYWxUb0dsb2JhbCh7IGtleTogQ09OU0VOU1VTX0JSQU5DSF9JRF9LRVksIHZhbHVlIH0pO1xuICAgIGlmICghdGhpcy5kYXRhLmdsb2JhbE1hcC51bmtub3duS2V5VmFscykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgYWRkaW5nIGNvbnNlbnN1cyBicmFuY2ggaWQgdG8gdW5rbm93bktleVZhbHMnKTtcbiAgICB9XG4gICAgY29uc3QgYnVmZiA9IHN1cGVyLnRvQnVmZmVyKCk7XG4gICAgdGhpcy5kYXRhLmdsb2JhbE1hcC51bmtub3duS2V5VmFscy5wb3AoKTtcbiAgICByZXR1cm4gYnVmZjtcbiAgfVxuXG4gIHNldFZlcnNpb24odmVyc2lvbjogbnVtYmVyLCBvdmVyd2ludGVyID0gdHJ1ZSk6IHRoaXMge1xuICAgIHR5cGVmb3JjZSh0eXBlcy5VSW50MzIsIHZlcnNpb24pO1xuICAgIHRoaXMudHgub3ZlcndpbnRlcmVkID0gb3ZlcndpbnRlciA/IDEgOiAwO1xuICAgIHRoaXMudHgudmVyc2lvbiA9IHZlcnNpb247XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBzZXREZWZhdWx0c0ZvclZlcnNpb24obmV0d29yazogTmV0d29yaywgdmVyc2lvbjogbnVtYmVyKTogdm9pZCB7XG4gICAgc3dpdGNoICh2ZXJzaW9uKSB7XG4gICAgICBjYXNlIDQ6XG4gICAgICBjYXNlIFpjYXNoVHJhbnNhY3Rpb24uVkVSU0lPTjRfQlJBTkNIX0NBTk9QWTpcbiAgICAgIGNhc2UgWmNhc2hUcmFuc2FjdGlvbi5WRVJTSU9ONF9CUkFOQ0hfTlU1OlxuICAgICAgICB0aGlzLnNldFZlcnNpb24oNCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSA1OlxuICAgICAgY2FzZSBaY2FzaFRyYW5zYWN0aW9uLlZFUlNJT041X0JSQU5DSF9OVTU6XG4gICAgICAgIHRoaXMuc2V0VmVyc2lvbig1KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGludmFsaWQgdmVyc2lvbiAke3ZlcnNpb259YCk7XG4gICAgfVxuXG4gICAgdGhpcy50eC52ZXJzaW9uR3JvdXBJZCA9IGdldERlZmF1bHRWZXJzaW9uR3JvdXBJZEZvclZlcnNpb24odmVyc2lvbik7XG4gICAgdGhpcy50eC5jb25zZW5zdXNCcmFuY2hJZCA9IGdldERlZmF1bHRDb25zZW5zdXNCcmFuY2hJZEZvclZlcnNpb24obmV0d29yaywgdmVyc2lvbik7XG4gIH1cblxuICAvLyBGb3IgWmNhc2ggdHJhbnNhY3Rpb25zLCB3ZSBkbyBub3QgaGF2ZSB0byBoYXZlIG5vbi13aXRuZXNzIFVUWE8gZGF0YSBmb3Igbm9uLXNlZ3dpdFxuICAvLyB0cmFuc2FjdGlvbnMgYmVjYXVzZSB6Y2FzaCBoYXNoZXMgdGhlIHZhbHVlIGRpcmVjdGx5LiBUaHVzLCBpdCBpcyB1bm5lY2Vzc2FyeSB0byBoYXZlXG4gIC8vIHRoZSBwcmV2aW91cyB0cmFuc2FjdGlvbiBoYXNoIG9uIHRoZSB1bnNwZW50LlxuICBzaWduSW5wdXQoaW5wdXRJbmRleDogbnVtYmVyLCBrZXlQYWlyOiBTaWduZXIsIHNpZ2hhc2hUeXBlcz86IG51bWJlcltdKTogdGhpcyB7XG4gICAgcmV0dXJuIHdpdGhVbnNhZmVOb25TZWd3aXQodGhpcywgc3VwZXIuc2lnbklucHV0LmJpbmQodGhpcywgaW5wdXRJbmRleCwga2V5UGFpciwgc2lnaGFzaFR5cGVzKSk7XG4gIH1cblxuICB2YWxpZGF0ZVNpZ25hdHVyZXNPZklucHV0KGlucHV0SW5kZXg6IG51bWJlciwgdmFsaWRhdG9yOiBWYWxpZGF0ZVNpZ0Z1bmN0aW9uLCBwdWJrZXk/OiBCdWZmZXIpOiBib29sZWFuIHtcbiAgICByZXR1cm4gd2l0aFVuc2FmZU5vblNlZ3dpdCh0aGlzLCBzdXBlci52YWxpZGF0ZVNpZ25hdHVyZXNPZklucHV0LmJpbmQodGhpcywgaW5wdXRJbmRleCwgdmFsaWRhdG9yLCBwdWJrZXkpKTtcbiAgfVxuXG4gIHByaXZhdGUgc2V0UHJvcGVydHlDaGVja1NpZ25hdHVyZXMocHJvcE5hbWU6IGtleW9mIFpjYXNoVHJhbnNhY3Rpb248YmlnaW50PiwgdmFsdWU6IHVua25vd24pIHtcbiAgICBpZiAodGhpcy50eFtwcm9wTmFtZV0gPT09IHZhbHVlKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMuY2hlY2tGb3JTaWduYXR1cmVzKHByb3BOYW1lKTtcbiAgICB0aGlzLnR4W3Byb3BOYW1lXSA9IHZhbHVlIGFzIGFueTtcbiAgfVxuXG4gIHNldENvbnNlbnN1c0JyYW5jaElkKGNvbnNlbnN1c0JyYW5jaElkOiBudW1iZXIpOiB2b2lkIHtcbiAgICB0eXBlZm9yY2UodHlwZXMuVUludDMyLCBjb25zZW5zdXNCcmFuY2hJZCk7XG4gICAgdGhpcy5zZXRQcm9wZXJ0eUNoZWNrU2lnbmF0dXJlcygnY29uc2Vuc3VzQnJhbmNoSWQnLCBjb25zZW5zdXNCcmFuY2hJZCk7XG4gIH1cblxuICBzZXRWZXJzaW9uR3JvdXBJZCh2ZXJzaW9uR3JvdXBJZDogbnVtYmVyKTogdm9pZCB7XG4gICAgdHlwZWZvcmNlKHR5cGVzLlVJbnQzMiwgdmVyc2lvbkdyb3VwSWQpO1xuICAgIHRoaXMuc2V0UHJvcGVydHlDaGVja1NpZ25hdHVyZXMoJ3ZlcnNpb25Hcm91cElkJywgdmVyc2lvbkdyb3VwSWQpO1xuICB9XG5cbiAgc2V0RXhwaXJ5SGVpZ2h0KGV4cGlyeUhlaWdodDogbnVtYmVyKTogdm9pZCB7XG4gICAgdHlwZWZvcmNlKHR5cGVzLlVJbnQzMiwgZXhwaXJ5SGVpZ2h0KTtcbiAgICB0aGlzLnNldFByb3BlcnR5Q2hlY2tTaWduYXR1cmVzKCdleHBpcnlIZWlnaHQnLCBleHBpcnlIZWlnaHQpO1xuICB9XG59XG4iXX0=