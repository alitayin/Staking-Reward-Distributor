"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZcashTransactionBuilder = void 0;
const types = require("bitcoinjs-lib/src/types");
const typeforce = require('typeforce');
const ZcashTransaction_1 = require("./ZcashTransaction");
const UtxoTransactionBuilder_1 = require("../UtxoTransactionBuilder");
const address_1 = require("./address");
class ZcashTransactionBuilder extends UtxoTransactionBuilder_1.UtxoTransactionBuilder {
    constructor(network) {
        super(network);
    }
    createInitialTransaction(network) {
        return new ZcashTransaction_1.ZcashTransaction(network);
    }
    static fromTransaction(transaction, network, prevOutput) {
        const txb = new ZcashTransactionBuilder(transaction.network);
        // Copy transaction fields
        txb.setVersion(transaction.version, !!transaction.overwintered);
        txb.setLockTime(transaction.locktime);
        // Copy Zcash overwinter fields. Omitted if the transaction builder is not for Zcash.
        if (txb.tx.isOverwinterCompatible()) {
            txb.setVersionGroupId(transaction.versionGroupId);
            txb.setExpiryHeight(transaction.expiryHeight);
        }
        txb.setConsensusBranchId(transaction.consensusBranchId);
        // Copy outputs (done first to avoid signature invalidation)
        transaction.outs.forEach(function (txOut) {
            txb.addOutput(txOut.script, txOut.value);
        });
        // Copy inputs
        transaction.ins.forEach(function (txIn) {
            txb.__addInputUnsafe(txIn.hash, txIn.index, {
                sequence: txIn.sequence,
                script: txIn.script,
                witness: txIn.witness,
                value: txIn.value,
            });
        });
        return txb;
    }
    setVersion(version, overwinter = true) {
        typeforce(types.UInt32, version);
        this.tx.overwintered = overwinter ? 1 : 0;
        this.tx.version = version;
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
    hasSignatures() {
        return this.__INPUTS.some(function (input) {
            return input.signatures !== undefined;
        });
    }
    setPropertyCheckSignatures(propName, value) {
        if (this.tx[propName] === value) {
            return;
        }
        if (this.hasSignatures()) {
            throw new Error(`Changing property ${propName} for a partially signed transaction would invalidate signatures`);
        }
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
    build() {
        return super.build();
    }
    buildIncomplete() {
        return super.buildIncomplete();
    }
    addOutput(scriptPubKey, value) {
        // Attempt to get a script if it's a base58 or bech32 address string
        if (typeof scriptPubKey === 'string') {
            scriptPubKey = address_1.toOutputScript(scriptPubKey, this.network);
        }
        return super.addOutput(scriptPubKey, value);
    }
}
exports.ZcashTransactionBuilder = ZcashTransactionBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiWmNhc2hUcmFuc2FjdGlvbkJ1aWxkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvYml0Z28vemNhc2gvWmNhc2hUcmFuc2FjdGlvbkJ1aWxkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQ0EsaURBQWlEO0FBQ2pELE1BQU0sU0FBUyxHQUFHLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUd2Qyx5REFLNEI7QUFDNUIsc0VBQW1FO0FBQ25FLHVDQUEyQztBQUUzQyxNQUFhLHVCQUFrRSxTQUFRLCtDQUd0RjtJQUNDLFlBQVksT0FBcUI7UUFDL0IsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ2pCLENBQUM7SUFFUyx3QkFBd0IsQ0FBQyxPQUFnQjtRQUNqRCxPQUFPLElBQUksbUNBQWdCLENBQVUsT0FBdUIsQ0FBQyxDQUFDO0lBQ2hFLENBQUM7SUFFRCxNQUFNLENBQUMsZUFBZSxDQUNwQixXQUFzQyxFQUN0QyxPQUFpQixFQUNqQixVQUEwQztRQUUxQyxNQUFNLEdBQUcsR0FBRyxJQUFJLHVCQUF1QixDQUFVLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUV0RSwwQkFBMEI7UUFDMUIsR0FBRyxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxXQUFXLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDaEUsR0FBRyxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFdEMscUZBQXFGO1FBQ3JGLElBQUksR0FBRyxDQUFDLEVBQUUsQ0FBQyxzQkFBc0IsRUFBRSxFQUFFO1lBQ25DLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxXQUFXLENBQUMsY0FBYyxDQUFDLENBQUM7WUFDbEQsR0FBRyxDQUFDLGVBQWUsQ0FBQyxXQUFXLENBQUMsWUFBWSxDQUFDLENBQUM7U0FDL0M7UUFFRCxHQUFHLENBQUMsb0JBQW9CLENBQUMsV0FBVyxDQUFDLGlCQUFp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LEtBQUssQ0FBQyxNQUFNLEVBQUUsY0FBYyxDQUFDLENBQUM7UUFDeEMsSUFBSSxDQUFDLDBCQUEwQixDQUFDLGdCQUFnQixFQUFFLGNBQWMsQ0FBQyxDQUFDO0lBQ3BFLENBQUM7SUFFRCxlQUFlLENBQUMsWUFBb0I7UUFDbEMsU0FBUyxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsWUFBWSxDQUFDLENBQUM7UUFDdEMsSUFBSSxDQUFDLDBCQUEwQixDQUFDLGNBQWMsRUFBRSxZQUFZLENBQUMsQ0FBQztJQUNoRSxDQUFDO0lBRUQsS0FBSztRQUNILE9BQU8sS0FBSyxDQUFDLEtBQUssRUFBK0IsQ0FBQztJQUNwRCxDQUFDO0lBRUQsZUFBZTtRQUNiLE9BQU8sS0FBSyxDQUFDLGVBQWUsRUFBK0IsQ0FBQztJQUM5RCxDQUFDO0lBRUQsU0FBUyxDQUFDLFlBQTZCLEVBQUUsS0FBYztRQUNyRCxvRUFBb0U7UUFDcEUsSUFBSSxPQUFPLFlBQVksS0FBSyxRQUFRLEVBQUU7WUFDcEMsWUFBWSxHQUFHLHdCQUFjLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQyxPQUFrQixDQUFDLENBQUM7U0FDdEU7UUFFRCxPQUFPLEtBQUssQ0FBQyxTQUFTLENBQUMsWUFBWSxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQzlDLENBQUM7Q0FDRjtBQXpIRCwwREF5SEMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBiaXRjb2luanMgZnJvbSAnYml0Y29pbmpzLWxpYic7XG5pbXBvcnQgKiBhcyB0eXBlcyBmcm9tICdiaXRjb2luanMtbGliL3NyYy90eXBlcyc7XG5jb25zdCB0eXBlZm9yY2UgPSByZXF1aXJlKCd0eXBlZm9yY2UnKTtcblxuaW1wb3J0IHsgTmV0d29yayB9IGZyb20gJy4uLy4uJztcbmltcG9ydCB7XG4gIGdldERlZmF1bHRDb25zZW5zdXNCcmFuY2hJZEZvclZlcnNpb24sXG4gIGdldERlZmF1bHRWZXJzaW9uR3JvdXBJZEZvclZlcnNpb24sXG4gIFpjYXNoTmV0d29yayxcbiAgWmNhc2hUcmFuc2FjdGlvbixcbn0gZnJvbSAnLi9aY2FzaFRyYW5zYWN0aW9uJztcbmltcG9ydCB7IFV0eG9UcmFuc2FjdGlvbkJ1aWxkZXIgfSBmcm9tICcuLi9VdHhvVHJhbnNhY3Rpb25CdWlsZGVyJztcbmltcG9ydCB7IHRvT3V0cHV0U2NyaXB0IH0gZnJvbSAnLi9hZGRyZXNzJztcblxuZXhwb3J0IGNsYXNzIFpjYXNoVHJhbnNhY3Rpb25CdWlsZGVyPFROdW1iZXIgZXh0ZW5kcyBudW1iZXIgfCBiaWdpbnQgPSBudW1iZXI+IGV4dGVuZHMgVXR4b1RyYW5zYWN0aW9uQnVpbGRlcjxcbiAgVE51bWJlcixcbiAgWmNhc2hUcmFuc2FjdGlvbjxUTnVtYmVyPlxuPiB7XG4gIGNvbnN0cnVjdG9yKG5ldHdvcms6IFpjYXNoTmV0d29yaykge1xuICAgIHN1cGVyKG5ldHdvcmspO1xuICB9XG5cbiAgcHJvdGVjdGVkIGNyZWF0ZUluaXRpYWxUcmFuc2FjdGlvbihuZXR3b3JrOiBOZXR3b3JrKTogWmNhc2hUcmFuc2FjdGlvbjxUTnVtYmVyPiB7XG4gICAgcmV0dXJuIG5ldyBaY2FzaFRyYW5zYWN0aW9uPFROdW1iZXI+KG5ldHdvcmsgYXMgWmNhc2hOZXR3b3JrKTtcbiAgfVxuXG4gIHN0YXRpYyBmcm9tVHJhbnNhY3Rpb248VE51bWJlciBleHRlbmRzIG51bWJlciB8IGJpZ2ludCA9IG51bWJlcj4oXG4gICAgdHJhbnNhY3Rpb246IFpjYXNoVHJhbnNhY3Rpb248VE51bWJlcj4sXG4gICAgbmV0d29yaz86IE5ldHdvcmssXG4gICAgcHJldk91dHB1dD86IGJpdGNvaW5qcy5UeE91dHB1dDxUTnVtYmVyPltdXG4gICk6IFpjYXNoVHJhbnNhY3Rpb25CdWlsZGVyPFROdW1iZXI+IHtcbiAgICBjb25zdCB0eGIgPSBuZXcgWmNhc2hUcmFuc2FjdGlvbkJ1aWxkZXI8VE51bWJlcj4odHJhbnNhY3Rpb24ubmV0d29yayk7XG5cbiAgICAvLyBDb3B5IHRyYW5zYWN0aW9uIGZpZWxkc1xuICAgIHR4Yi5zZXRWZXJzaW9uKHRyYW5zYWN0aW9uLnZlcnNpb24sICEhdHJhbnNhY3Rpb24ub3ZlcndpbnRlcmVkKTtcbiAgICB0eGIuc2V0TG9ja1RpbWUodHJhbnNhY3Rpb24ubG9ja3RpbWUpO1xuXG4gICAgLy8gQ29weSBaY2FzaCBvdmVyd2ludGVyIGZpZWxkcy4gT21pdHRlZCBpZiB0aGUgdHJhbnNhY3Rpb24gYnVpbGRlciBpcyBub3QgZm9yIFpjYXNoLlxuICAgIGlmICh0eGIudHguaXNPdmVyd2ludGVyQ29tcGF0aWJsZSgpKSB7XG4gICAgICB0eGIuc2V0VmVyc2lvbkdyb3VwSWQodHJhbnNhY3Rpb24udmVyc2lvbkdyb3VwSWQpO1xuICAgICAgdHhiLnNldEV4cGlyeUhlaWdodCh0cmFuc2FjdGlvbi5leHBpcnlIZWlnaHQpO1xuICAgIH1cblxuICAgIHR4Yi5zZXRDb25zZW5zdXNCcmFuY2hJZCh0cmFuc2FjdGlvbi5jb25zZW5zdXNCcmFuY2hJZCk7XG5cbiAgICAvLyBDb3B5IG91dHB1dHMgKGRvbmUgZmlyc3QgdG8gYXZvaWQgc2lnbmF0dXJlIGludmFsaWRhdGlvbilcbiAgICB0cmFuc2FjdGlvbi5vdXRzLmZvckVhY2goZnVuY3Rpb24gKHR4T3V0KSB7XG4gICAgICB0eGIuYWRkT3V0cHV0KHR4T3V0LnNjcmlwdCwgdHhPdXQudmFsdWUpO1xuICAgIH0pO1xuXG4gICAgLy8gQ29weSBpbnB1dHNcbiAgICB0cmFuc2FjdGlvbi5pbnMuZm9yRWFjaChmdW5jdGlvbiAodHhJbikge1xuICAgICAgKHR4YiBhcyBhbnkpLl9fYWRkSW5wdXRVbnNhZmUodHhJbi5oYXNoLCB0eEluLmluZGV4LCB7XG4gICAgICAgIHNlcXVlbmNlOiB0eEluLnNlcXVlbmNlLFxuICAgICAgICBzY3JpcHQ6IHR4SW4uc2NyaXB0LFxuICAgICAgICB3aXRuZXNzOiB0eEluLndpdG5lc3MsXG4gICAgICAgIHZhbHVlOiAodHhJbiBhcyBhbnkpLnZhbHVlLFxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdHhiO1xuICB9XG5cbiAgc2V0VmVyc2lvbih2ZXJzaW9uOiBudW1iZXIsIG92ZXJ3aW50ZXIgPSB0cnVlKTogdm9pZCB7XG4gICAgdHlwZWZvcmNlKHR5cGVzLlVJbnQzMiwgdmVyc2lvbik7XG4gICAgdGhpcy50eC5vdmVyd2ludGVyZWQgPSBvdmVyd2ludGVyID8gMSA6IDA7XG4gICAgdGhpcy50eC52ZXJzaW9uID0gdmVyc2lvbjtcbiAgfVxuXG4gIHNldERlZmF1bHRzRm9yVmVyc2lvbihuZXR3b3JrOiBOZXR3b3JrLCB2ZXJzaW9uOiBudW1iZXIpOiB2b2lkIHtcbiAgICBzd2l0Y2ggKHZlcnNpb24pIHtcbiAgICAgIGNhc2UgNDpcbiAgICAgIGNhc2UgWmNhc2hUcmFuc2FjdGlvbi5WRVJTSU9ONF9CUkFOQ0hfQ0FOT1BZOlxuICAgICAgY2FzZSBaY2FzaFRyYW5zYWN0aW9uLlZFUlNJT040X0JSQU5DSF9OVTU6XG4gICAgICAgIHRoaXMuc2V0VmVyc2lvbig0KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDU6XG4gICAgICBjYXNlIFpjYXNoVHJhbnNhY3Rpb24uVkVSU0lPTjVfQlJBTkNIX05VNTpcbiAgICAgICAgdGhpcy5zZXRWZXJzaW9uKDUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgaW52YWxpZCB2ZXJzaW9uICR7dmVyc2lvbn1gKTtcbiAgICB9XG5cbiAgICB0aGlzLnR4LnZlcnNpb25Hcm91cElkID0gZ2V0RGVmYXVsdFZlcnNpb25Hcm91cElkRm9yVmVyc2lvbih2ZXJzaW9uKTtcbiAgICB0aGlzLnR4LmNvbnNlbnN1c0JyYW5jaElkID0gZ2V0RGVmYXVsdENvbnNlbnN1c0JyYW5jaElkRm9yVmVyc2lvbihuZXR3b3JrLCB2ZXJzaW9uKTtcbiAgfVxuXG4gIHByaXZhdGUgaGFzU2lnbmF0dXJlcygpOiBib29sZWFuIHtcbiAgICByZXR1cm4gKHRoaXMgYXMgYW55KS5fX0lOUFVUUy5zb21lKGZ1bmN0aW9uIChpbnB1dDogeyBzaWduYXR1cmVzOiB1bmtub3duIH0pIHtcbiAgICAgIHJldHVybiBpbnB1dC5zaWduYXR1cmVzICE9PSB1bmRlZmluZWQ7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIHNldFByb3BlcnR5Q2hlY2tTaWduYXR1cmVzKHByb3BOYW1lOiBrZXlvZiBaY2FzaFRyYW5zYWN0aW9uPFROdW1iZXI+LCB2YWx1ZTogdW5rbm93bikge1xuICAgIGlmICh0aGlzLnR4W3Byb3BOYW1lXSA9PT0gdmFsdWUpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKHRoaXMuaGFzU2lnbmF0dXJlcygpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENoYW5naW5nIHByb3BlcnR5ICR7cHJvcE5hbWV9IGZvciBhIHBhcnRpYWxseSBzaWduZWQgdHJhbnNhY3Rpb24gd291bGQgaW52YWxpZGF0ZSBzaWduYXR1cmVzYCk7XG4gICAgfVxuICAgIHRoaXMudHhbcHJvcE5hbWVdID0gdmFsdWUgYXMgYW55O1xuICB9XG5cbiAgc2V0Q29uc2Vuc3VzQnJhbmNoSWQoY29uc2Vuc3VzQnJhbmNoSWQ6IG51bWJlcik6IHZvaWQge1xuICAgIHR5cGVmb3JjZSh0eXBlcy5VSW50MzIsIGNvbnNlbnN1c0JyYW5jaElkKTtcbiAgICB0aGlzLnNldFByb3BlcnR5Q2hlY2tTaWduYXR1cmVzKCdjb25zZW5zdXNCcmFuY2hJZCcsIGNvbnNlbnN1c0JyYW5jaElkKTtcbiAgfVxuXG4gIHNldFZlcnNpb25Hcm91cElkKHZlcnNpb25Hcm91cElkOiBudW1iZXIpOiB2b2lkIHtcbiAgICB0eXBlZm9yY2UodHlwZXMuVUludDMyLCB2ZXJzaW9uR3JvdXBJZCk7XG4gICAgdGhpcy5zZXRQcm9wZXJ0eUNoZWNrU2lnbmF0dXJlcygndmVyc2lvbkdyb3VwSWQnLCB2ZXJzaW9uR3JvdXBJZCk7XG4gIH1cblxuICBzZXRFeHBpcnlIZWlnaHQoZXhwaXJ5SGVpZ2h0OiBudW1iZXIpOiB2b2lkIHtcbiAgICB0eXBlZm9yY2UodHlwZXMuVUludDMyLCBleHBpcnlIZWlnaHQpO1xuICAgIHRoaXMuc2V0UHJvcGVydHlDaGVja1NpZ25hdHVyZXMoJ2V4cGlyeUhlaWdodCcsIGV4cGlyeUhlaWdodCk7XG4gIH1cblxuICBidWlsZCgpOiBaY2FzaFRyYW5zYWN0aW9uPFROdW1iZXI+IHtcbiAgICByZXR1cm4gc3VwZXIuYnVpbGQoKSBhcyBaY2FzaFRyYW5zYWN0aW9uPFROdW1iZXI+O1xuICB9XG5cbiAgYnVpbGRJbmNvbXBsZXRlKCk6IFpjYXNoVHJhbnNhY3Rpb248VE51bWJlcj4ge1xuICAgIHJldHVybiBzdXBlci5idWlsZEluY29tcGxldGUoKSBhcyBaY2FzaFRyYW5zYWN0aW9uPFROdW1iZXI+O1xuICB9XG5cbiAgYWRkT3V0cHV0KHNjcmlwdFB1YktleTogc3RyaW5nIHwgQnVmZmVyLCB2YWx1ZTogVE51bWJlcik6IG51bWJlciB7XG4gICAgLy8gQXR0ZW1wdCB0byBnZXQgYSBzY3JpcHQgaWYgaXQncyBhIGJhc2U1OCBvciBiZWNoMzIgYWRkcmVzcyBzdHJpbmdcbiAgICBpZiAodHlwZW9mIHNjcmlwdFB1YktleSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHNjcmlwdFB1YktleSA9IHRvT3V0cHV0U2NyaXB0KHNjcmlwdFB1YktleSwgdGhpcy5uZXR3b3JrIGFzIE5ldHdvcmspO1xuICAgIH1cblxuICAgIHJldHVybiBzdXBlci5hZGRPdXRwdXQoc2NyaXB0UHViS2V5LCB2YWx1ZSk7XG4gIH1cbn1cbiJdfQ==