"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UtxoTransaction = exports.varSliceSize = void 0;
const assert = require("assert");
const bitcoinjs = require("bitcoinjs-lib");
const varuint = require("varuint-bitcoin");
const tnumber_1 = require("./tnumber");
const networks_1 = require("../networks");
function varSliceSize(slice) {
    const length = slice.length;
    return varuint.encodingLength(length) + length;
}
exports.varSliceSize = varSliceSize;
class UtxoTransaction extends bitcoinjs.Transaction {
    constructor(network, transaction, amountType) {
        super();
        this.network = network;
        if (transaction) {
            this.version = transaction.version;
            this.locktime = transaction.locktime;
            this.ins = transaction.ins.map((v) => ({ ...v, witness: [...v.witness] }));
            if (transaction.outs.length) {
                // amountType only matters if there are outs
                const inAmountType = typeof transaction.outs[0].value;
                assert(inAmountType === 'number' || inAmountType === 'bigint');
                const outAmountType = amountType || inAmountType;
                this.outs = transaction.outs.map((v) => ({ ...v, value: tnumber_1.toTNumber(v.value, outAmountType) }));
            }
        }
    }
    static newTransaction(network, transaction, amountType) {
        return new UtxoTransaction(network, transaction, amountType);
    }
    static fromBuffer(buf, noStrict, amountType = 'number', network, prevOutput) {
        if (!network) {
            throw new Error(`must provide network`);
        }
        return this.newTransaction(network, bitcoinjs.Transaction.fromBuffer(buf, noStrict, amountType), amountType);
    }
    addForkId(hashType) {
        if (hashType & UtxoTransaction.SIGHASH_FORKID) {
            const forkId = networks_1.isBitcoinGold(this.network) ? 79 : 0;
            return (hashType | (forkId << 8)) >>> 0;
        }
        return hashType;
    }
    hashForWitnessV0(inIndex, prevOutScript, value, hashType) {
        return super.hashForWitnessV0(inIndex, prevOutScript, value, this.addForkId(hashType));
    }
    /**
     * Calculate the hash to verify the signature against
     */
    hashForSignatureByNetwork(inIndex, prevoutScript, value, hashType) {
        switch (networks_1.getMainnet(this.network)) {
            case networks_1.networks.zcash:
                throw new Error(`illegal state`);
            case networks_1.networks.bitcoincash:
            case networks_1.networks.bitcoinsv:
            case networks_1.networks.bitcoingold:
            case networks_1.networks.ecash:
                /*
                  Bitcoin Cash supports a FORKID flag. When set, we hash using hashing algorithm
                   that is used for segregated witness transactions (defined in BIP143).
        
                  The flag is also used by BitcoinSV and BitcoinGold
        
                  https://github.com/bitcoincashorg/bitcoincash.org/blob/master/spec/replay-protected-sighash.md
                 */
                const addForkId = (hashType & UtxoTransaction.SIGHASH_FORKID) > 0;
                if (addForkId) {
                    /*
                      ``The sighash type is altered to include a 24-bit fork id in its most significant bits.''
                      We also use unsigned right shift operator `>>>` to cast to UInt32
                      https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Unsigned_right_shift
                     */
                    if (value === undefined) {
                        throw new Error(`must provide value`);
                    }
                    return super.hashForWitnessV0(inIndex, prevoutScript, value, this.addForkId(hashType));
                }
        }
        return super.hashForSignature(inIndex, prevoutScript, hashType);
    }
    hashForSignature(inIndex, prevOutScript, hashType, value) {
        value = value !== null && value !== void 0 ? value : this.ins[inIndex].value;
        return this.hashForSignatureByNetwork(inIndex, prevOutScript, value, hashType);
    }
    clone(amountType) {
        // No need to clone. Everything is copied in the constructor.
        return new UtxoTransaction(this.network, this, amountType);
    }
}
exports.UtxoTransaction = UtxoTransaction;
UtxoTransaction.SIGHASH_FORKID = 0x40;
/** @deprecated use SIGHASH_FORKID */
UtxoTransaction.SIGHASH_BITCOINCASHBIP143 = UtxoTransaction.SIGHASH_FORKID;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVXR4b1RyYW5zYWN0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2JpdGdvL1V0eG9UcmFuc2FjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxpQ0FBaUM7QUFDakMsMkNBQTJDO0FBQzNDLDJDQUEyQztBQUMzQyx1Q0FBc0M7QUFFdEMsMENBQTJFO0FBRTNFLFNBQWdCLFlBQVksQ0FBQyxLQUFhO0lBQ3hDLE1BQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUM7SUFDNUIsT0FBTyxPQUFPLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxHQUFHLE1BQU0sQ0FBQztBQUNqRCxDQUFDO0FBSEQsb0NBR0M7QUFFRCxNQUFhLGVBQTBELFNBQVEsU0FBUyxDQUFDLFdBQW9CO0lBSzNHLFlBQ1MsT0FBZ0IsRUFDdkIsV0FBb0QsRUFDcEQsVUFBZ0M7UUFFaEMsS0FBSyxFQUFFLENBQUM7UUFKRCxZQUFPLEdBQVAsT0FBTyxDQUFTO1FBS3ZCLElBQUksV0FBVyxFQUFFO1lBQ2YsSUFBSSxDQUFDLE9BQU8sR0FBRyxXQUFXLENBQUMsT0FBTyxDQUFDO1lBQ25DLElBQUksQ0FBQyxRQUFRLEdBQUcsV0FBVyxDQUFDLFFBQVEsQ0FBQztZQUNyQyxJQUFJLENBQUMsR0FBRyxHQUFHLFdBQVcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDM0UsSUFBSSxXQUFXLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRTtnQkFDM0IsNENBQTRDO2dCQUM1QyxNQUFNLFlBQVksR0FBRyxPQUFPLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO2dCQUN0RCxNQUFNLENBQUMsWUFBWSxLQUFL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QUUsYUFBYSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ2xFLENBQUM7SUFFRCxnQkFBZ0IsQ0FBQyxPQUFlLEVBQUUsYUFBcUIsRUFBRSxRQUFnQixFQUFFLEtBQWU7UUFDeEYsS0FBSyxHQUFHLEtBQUssYUFBTCxLQUFLLGNBQUwsS0FBSyxHQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFTLENBQUMsS0FBSyxDQUFDO1FBQ2xELE9BQU8sSUFBSSxDQUFDLHlCQUF5QixDQUFDLE9BQU8sRUFBRSxhQUFhLEVBQUUsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ2pGLENBQUM7SUFFRCxLQUFLLENBQXdDLFVBQWdDO1FBQzNFLDZEQUE2RDtRQUM3RCxPQUFPLElBQUksZUFBZSxDQUFNLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ2xFLENBQUM7O0FBakhILDBDQWtIQztBQWpIUSw4QkFBYyxHQUFHLElBQUksQ0FBQztBQUM3QixxQ0FBcUM7QUFDOUIseUNBQXlCLEdBQUcsZUFBZSxDQUFDLGNBQWMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0ICogYXMgYml0Y29pbmpzIGZyb20gJ2JpdGNvaW5qcy1saWInO1xuaW1wb3J0ICogYXMgdmFydWludCBmcm9tICd2YXJ1aW50LWJpdGNvaW4nO1xuaW1wb3J0IHsgdG9UTnVtYmVyIH0gZnJvbSAnLi90bnVtYmVyJztcblxuaW1wb3J0IHsgbmV0d29ya3MsIE5ldHdvcmssIGdldE1haW5uZXQsIGlzQml0Y29pbkdvbGQgfSBmcm9tICcuLi9uZXR3b3Jrcyc7XG5cbmV4cG9ydCBmdW5jdGlvbiB2YXJTbGljZVNpemUoc2xpY2U6IEJ1ZmZlcik6IG51bWJlciB7XG4gIGNvbnN0IGxlbmd0aCA9IHNsaWNlLmxlbmd0aDtcbiAgcmV0dXJuIHZhcnVpbnQuZW5jb2RpbmdMZW5ndGgobGVuZ3RoKSArIGxlbmd0aDtcbn1cblxuZXhwb3J0IGNsYXNzIFV0eG9UcmFuc2FjdGlvbjxUTnVtYmVyIGV4dGVuZHMgbnVtYmVyIHwgYmlnaW50ID0gbnVtYmVyPiBleHRlbmRzIGJpdGNvaW5qcy5UcmFuc2FjdGlvbjxUTnVtYmVyPiB7XG4gIHN0YXRpYyBTSUdIQVNIX0ZPUktJRCA9IDB4NDA7XG4gIC8qKiBAZGVwcmVjYXRlZCB1c2UgU0lHSEFTSF9GT1JLSUQgKi9cbiAgc3RhdGljIFNJR0hBU0hfQklUQ09JTkNBU0hCSVAxNDMgPSBVdHhvVHJhbnNhY3Rpb24uU0lHSEFTSF9GT1JLSUQ7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHVibGljIG5ldHdvcms6IE5ldHdvcmssXG4gICAgdHJhbnNhY3Rpb24/OiBiaXRjb2luanMuVHJhbnNhY3Rpb248YmlnaW50IHwgbnVtYmVyPixcbiAgICBhbW91bnRUeXBlPzogJ2JpZ2ludCcgfCAnbnVtYmVyJ1xuICApIHtcbiAgICBzdXBlcigpO1xuICAgIGlmICh0cmFuc2FjdGlvbikge1xuICAgICAgdGhpcy52ZXJzaW9uID0gdHJhbnNhY3Rpb24udmVyc2lvbjtcbiAgICAgIHRoaXMubG9ja3RpbWUgPSB0cmFuc2FjdGlvbi5sb2NrdGltZTtcbiAgICAgIHRoaXMuaW5zID0gdHJhbnNhY3Rpb24uaW5zLm1hcCgodikgPT4gKHsgLi4udiwgd2l0bmVzczogWy4uLnYud2l0bmVzc10gfSkpO1xuICAgICAgaWYgKHRyYW5zYWN0aW9uLm91dHMubGVuZ3RoKSB7XG4gICAgICAgIC8vIGFtb3VudFR5cGUgb25seSBtYXR0ZXJzIGlmIHRoZXJlIGFyZSBvdXRzXG4gICAgICAgIGNvbnN0IGluQW1vdW50VHlwZSA9IHR5cGVvZiB0cmFuc2FjdGlvbi5vdXRzWzBdLnZhbHVlO1xuICAgICAgICBhc3NlcnQoaW5BbW91bnRUeXBlID09PSAnbnVtYmVyJyB8fCBpbkFtb3VudFR5cGUgPT09ICdiaWdpbnQnKTtcbiAgICAgICAgY29uc3Qgb3V0QW1vdW50VHlwZTogJ251bWJlcicgfCAnYmlnaW50JyA9IGFtb3VudFR5cGUgfHwgaW5BbW91bnRUeXBlO1xuICAgICAgICB0aGlzLm91dHMgPSB0cmFuc2FjdGlvbi5vdXRzLm1hcCgodikgPT4gKHsgLi4udiwgdmFsdWU6IHRvVE51bWJlcih2LnZhbHVlLCBvdXRBbW91bnRUeXBlKSB9KSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJvdGVjdGVkIHN0YXRpYyBuZXdUcmFuc2FjdGlvbjxUTnVtYmVyIGV4dGVuZHMgbnVtYmVyIHwgYmlnaW50ID0gbnVtYmVyPihcbiAgICBuZXR3b3JrOiBOZXR3b3JrLFxuICAgIHRyYW5zYWN0aW9uPzogYml0Y29pbmpzLlRyYW5zYWN0aW9uPGJpZ2ludCB8IG51bWJlcj4sXG4gICAgYW1vdW50VHlwZT86ICdudW1iZXInIHwgJ2JpZ2ludCdcbiAgKTogVXR4b1RyYW5zYWN0aW9uPFROdW1iZXI+IHtcbiAgICByZXR1cm4gbmV3IFV0eG9UcmFuc2FjdGlvbjxUTnVtYmVyPihuZXR3b3JrLCB0cmFuc2FjdGlvbiwgYW1vdW50VHlwZSk7XG4gIH1cblxuICBzdGF0aWMgZnJvbUJ1ZmZlcjxUTnVtYmVyIGV4dGVuZHMgbnVtYmVyIHwgYmlnaW50ID0gbnVtYmVyPihcbiAgICBidWY6IEJ1ZmZlcixcbiAgICBub1N0cmljdDogYm9vbGVhbixcbiAgICBhbW91bnRUeXBlOiAnbnVtYmVyJyB8ICdiaWdpbnQnID0gJ251bWJlcicsXG4gICAgbmV0d29yaz86IE5ldHdvcmssXG4gICAgcHJldk91dHB1dD86IGJpdGNvaW5qcy5UeE91dHB1dDxUTnVtYmVyPltdXG4gICk6IFV0eG9UcmFuc2FjdGlvbjxUTnVtYmVyPiB7XG4gICAgaWYgKCFuZXR3b3JrKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG11c3QgcHJvdmlkZSBuZXR3b3JrYCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLm5ld1RyYW5zYWN0aW9uPFROdW1iZXI+KFxuICAgICAgbmV0d29yayxcbiAgICAgIGJpdGNvaW5qcy5UcmFuc2FjdGlvbi5mcm9tQnVmZmVyPFROdW1iZXI+KGJ1Ziwgbm9TdHJpY3QsIGFtb3VudFR5cGUpLFxuICAgICAgYW1vdW50VHlwZVxuICAgICk7XG4gIH1cblxuICBhZGRGb3JrSWQoaGFzaFR5cGU6IG51bWJlcik6IG51bWJlciB7XG4gICAgaWYgKGhhc2hUeXBlICYgVXR4b1RyYW5zYWN0aW9uLlNJR0hBU0hfRk9SS0lEKSB7XG4gICAgICBjb25zdCBmb3JrSWQgPSBpc0JpdGNvaW5Hb2xkKHRoaXMubmV0d29yaykgPyA3OSA6IDA7XG4gICAgICByZXR1cm4gKGhhc2hUeXBlIHwgKGZvcmtJZCA8PCA4KSkgPj4+IDA7XG4gICAgfVxuXG4gICAgcmV0dXJuIGhhc2hUeXBlO1xuICB9XG5cbiAgaGFzaEZvcldpdG5lc3NWMChpbkluZGV4OiBudW1iZXIsIHByZXZPdXRTY3JpcHQ6IEJ1ZmZlciwgdmFsdWU6IFROdW1iZXIsIGhhc2hUeXBlOiBudW1iZXIpOiBCdWZmZXIge1xuICAgIHJldHVybiBzdXBlci5oYXNoRm9yV2l0bmVzc1YwKGluSW5kZXgsIHByZXZPdXRTY3JpcHQsIHZhbHVlLCB0aGlzLmFkZEZvcmtJZChoYXNoVHlwZSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIENhbGN1bGF0ZSB0aGUgaGFzaCB0byB2ZXJpZnkgdGhlIHNpZ25hdHVyZSBhZ2FpbnN0XG4gICAqL1xuICBoYXNoRm9yU2lnbmF0dXJlQnlOZXR3b3JrKFxuICAgIGluSW5kZXg6IG51bWJlcixcbiAgICBwcmV2b3V0U2NyaXB0OiBCdWZmZXIsXG4gICAgdmFsdWU6IFROdW1iZXIgfCB1bmRlZmluZWQsXG4gICAgaGFzaFR5cGU6IG51bWJlclxuICApOiBCdWZmZXIge1xuICAgIHN3aXRjaCAoZ2V0TWFpbm5ldCh0aGlzLm5ldHdvcmspKSB7XG4gICAgICBjYXNlIG5ldHdvcmtzLnpjYXNoOlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGlsbGVnYWwgc3RhdGVgKTtcbiAgICAgIGNhc2UgbmV0d29ya3MuYml0Y29pbmNhc2g6XG4gICAgICBjYXNlIG5ldHdvcmtzLmJpdGNvaW5zdjpcbiAgICAgIGNhc2UgbmV0d29ya3MuYml0Y29pbmdvbGQ6XG4gICAgICBjYXNlIG5ldHdvcmtzLmVjYXNoOlxuICAgICAgICAvKlxuICAgICAgICAgIEJpdGNvaW4gQ2FzaCBzdXBwb3J0cyBhIEZPUktJRCBmbGFnLiBXaGVuIHNldCwgd2UgaGFzaCB1c2luZyBoYXNoaW5nIGFsZ29yaXRobVxuICAgICAgICAgICB0aGF0IGlzIHVzZWQgZm9yIHNlZ3JlZ2F0ZWQgd2l0bmVzcyB0cmFuc2FjdGlvbnMgKGRlZmluZWQgaW4gQklQMTQzKS5cblxuICAgICAgICAgIFRoZSBmbGFnIGlzIGFsc28gdXNlZCBieSBCaXRjb2luU1YgYW5kIEJpdGNvaW5Hb2xkXG5cbiAgICAgICAgICBodHRwczovL2dpdGh1Yi5jb20vYml0Y29pbmNhc2hvcmcvYml0Y29pbmNhc2gub3JnL2Jsb2IvbWFzdGVyL3NwZWMvcmVwbGF5LXByb3RlY3RlZC1zaWdoYXNoLm1kXG4gICAgICAgICAqL1xuICAgICAgICBjb25zdCBhZGRGb3JrSWQgPSAoaGFzaFR5cGUgJiBVdHhvVHJhbnNhY3Rpb24uU0lHSEFTSF9GT1JLSUQpID4gMDtcblxuICAgICAgICBpZiAoYWRkRm9ya0lkKSB7XG4gICAgICAgICAgLypcbiAgICAgICAgICAgIGBgVGhlIHNpZ2hhc2ggdHlwZSBpcyBhbHRlcmVkIHRvIGluY2x1ZGUgYSAyNC1iaXQgZm9yayBpZCBpbiBpdHMgbW9zdCBzaWduaWZpY2FudCBiaXRzLicnXG4gICAgICAgICAgICBXZSBhbHNvIHVzZSB1bnNpZ25lZCByaWdodCBzaGlmdCBvcGVyYXRvciBgPj4+YCB0byBjYXN0IHRvIFVJbnQzMlxuICAgICAgICAgICAgaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvT3BlcmF0b3JzL1Vuc2lnbmVkX3JpZ2h0X3NoaWZ0XG4gICAgICAgICAgICovXG4gICAgICAgICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgbXVzdCBwcm92aWRlIHZhbHVlYCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBzdXBlci5oYXNoRm9yV2l0bmVzc1YwKGluSW5kZXgsIHByZXZvdXRTY3JpcHQsIHZhbHVlLCB0aGlzLmFkZEZvcmtJZChoYXNoVHlwZSkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHN1cGVyLmhhc2hGb3JTaWduYXR1cmUoaW5JbmRleCwgcHJldm91dFNjcmlwdCwgaGFzaFR5cGUpO1xuICB9XG5cbiAgaGFzaEZvclNpZ25hdHVyZShpbkluZGV4OiBudW1iZXIsIHByZXZPdXRTY3JpcHQ6IEJ1ZmZlciwgaGFzaFR5cGU6IG51bWJlciwgdmFsdWU/OiBUTnVtYmVyKTogQnVmZmVyIHtcbiAgICB2YWx1ZSA9IHZhbHVlID8/ICh0aGlzLmluc1tpbkluZGV4XSBhcyBhbnkpLnZhbHVlO1xuICAgIHJldHVybiB0aGlzLmhhc2hGb3JTaWduYXR1cmVCeU5ldHdvcmsoaW5JbmRleCwgcHJldk91dFNjcmlwdCwgdmFsdWUsIGhhc2hUeXBlKTtcbiAgfVxuXG4gIGNsb25lPFROMiBleHRlbmRzIGJpZ2ludCB8IG51bWJlciA9IFROdW1iZXI+KGFtb3VudFR5cGU/OiAnbnVtYmVyJyB8ICdiaWdpbnQnKTogVXR4b1RyYW5zYWN0aW9uPFROMj4ge1xuICAgIC8vIE5vIG5lZWQgdG8gY2xvbmUuIEV2ZXJ5dGhpbmcgaXMgY29waWVkIGluIHRoZSBjb25zdHJ1Y3Rvci5cbiAgICByZXR1cm4gbmV3IFV0eG9UcmFuc2FjdGlvbjxUTjI+KHRoaXMubmV0d29yaywgdGhpcywgYW1vdW50VHlwZSk7XG4gIH1cbn1cbiJdfQ==