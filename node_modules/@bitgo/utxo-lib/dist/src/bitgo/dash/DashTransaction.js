"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashTransaction = void 0;
const bufferutils_1 = require("bitcoinjs-lib/src/bufferutils");
const bitcoinjs_lib_1 = require("bitcoinjs-lib");
const UtxoTransaction_1 = require("../UtxoTransaction");
const networks_1 = require("../../networks");
class DashTransaction extends UtxoTransaction_1.UtxoTransaction {
    constructor(network, tx, amountType) {
        super(network, tx, amountType);
        this.type = 0;
        if (!networks_1.isDash(network)) {
            throw new Error(`invalid network`);
        }
        if (tx) {
            this.version = tx.version;
            if (tx instanceof DashTransaction) {
                this.type = tx.type;
                this.extraPayload = tx.extraPayload;
            }
        }
        // since `__toBuffer` is private we have to do a little hack here
        this.__toBuffer = this.toBufferWithExtraPayload;
    }
    static newTransaction(network, transaction, amountType) {
        return new DashTransaction(network, transaction, amountType);
    }
    static fromBuffer(buffer, noStrict, amountType = 'number', network) {
        const tx = new DashTransaction(network, super.fromBuffer(buffer, true, amountType, network));
        tx.type = tx.version >> 16;
        tx.version = tx.version & 0xffff;
        if (tx.byteLength() !== buffer.length) {
            const bufferReader = new bufferutils_1.BufferReader(buffer, tx.byteLength());
            tx.extraPayload = bufferReader.readVarSlice();
        }
        return tx;
    }
    clone(amountType) {
        return new DashTransaction(this.network, this, amountType);
    }
    byteLength(_ALLOW_WITNESS) {
        return super.byteLength(_ALLOW_WITNESS) + (this.extraPayload ? UtxoTransaction_1.varSliceSize(this.extraPayload) : 0);
    }
    /**
     * Helper to override `__toBuffer()` of bitcoinjs.Transaction.
     * Since the method is private, we use a hack in the constructor to make it work.
     *
     * TODO: remove `private` modifier in bitcoinjs `__toBuffer()` or find some other solution
     *
     * @param buffer - optional target buffer
     * @param initialOffset - can only be undefined or 0. Other values are only used for serialization in blocks.
     * @param _ALLOW_WITNESS - ignored
     */
    toBufferWithExtraPayload(buffer, initialOffset, _ALLOW_WITNESS = false) {
        // We can ignore the `_ALLOW_WITNESS` parameter here since it has no effect.
        if (!buffer) {
            buffer = Buffer.allocUnsafe(this.byteLength(false));
        }
        if (initialOffset !== undefined && initialOffset !== 0) {
            throw new Error(`not supported`);
        }
        // Start out with regular bitcoin byte sequence.
        // This buffer will have excess size because it uses `byteLength()` to allocate.
        const baseBuffer = bitcoinjs_lib_1.Transaction.prototype.__toBuffer.call(this);
        baseBuffer.copy(buffer);
        // overwrite leading version bytes (uint16 version, uint16 type)
        const bufferWriter = new bufferutils_1.BufferWriter(buffer, 0);
        bufferWriter.writeUInt32((this.version & 0xffff) | (this.type << 16));
        // Seek to end of original byte sequence and add extraPayload.
        // We must use the byteLength as calculated by the bitcoinjs implementation since
        // `baseBuffer` has an excess size.
        if (this.extraPayload) {
            bufferWriter.offset = bitcoinjs_lib_1.Transaction.prototype.byteLength.call(this);
            bufferWriter.writeVarSlice(this.extraPayload);
        }
        return buffer;
    }
    getHash(forWitness) {
        if (forWitness) {
            throw new Error(`invalid argument`);
        }
        return bitcoinjs_lib_1.crypto.hash256(this.toBuffer());
    }
    /**
     * Build a hash for all or none of the transaction inputs depending on the hashtype
     * @param hashType
     * @returns Buffer
     */
    getPrevoutHash(hashType) {
        if (!(hashType & UtxoTransaction_1.UtxoTransaction.SIGHASH_ANYONECANPAY)) {
            const bufferWriter = new bufferutils_1.BufferWriter(Buffer.allocUnsafe(36 * this.ins.length));
            this.ins.forEach(function (txIn) {
                bufferWriter.writeSlice(txIn.hash);
                bufferWriter.writeUInt32(txIn.index);
            });
            return bitcoinjs_lib_1.crypto.hash256(bufferWriter.buffer);
        }
        return Buffer.alloc(32, 0);
    }
}
exports.DashTransaction = DashTransaction;
DashTransaction.DASH_NORMAL = 0;
DashTransaction.DASH_PROVIDER_REGISTER = 1;
DashTransaction.DASH_PROVIDER_UPDATE_SERVICE = 2;
DashTransaction.DASH_PROVIDER_UPDATE_REGISTRAR = 3;
DashTransaction.DASH_PROVIDER_UPDATE_REVOKE = 4;
DashTransaction.DASH_COINBASE = 5;
DashTransaction.DASH_QUORUM_COMMITMENT = 6;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRGFzaFRyYW5zYWN0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2JpdGdvL2Rhc2gvRGFzaFRyYW5zYWN0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLCtEQUEyRTtBQUMzRSxpREFBK0Q7QUFFL0Qsd0RBQW1FO0FBQ25FLDZDQUFpRDtBQUVqRCxNQUFhLGVBQTBELFNBQVEsaUNBQXdCO0lBWXJHLFlBQVksT0FBZ0IsRUFBRSxFQUFpQyxFQUFFLFVBQWdDO1FBQy9GLEtBQUssQ0FBQyxPQUFPLEVBQUUsRUFBRSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBSjFCLFNBQUksR0FBRyxDQUFDLENBQUM7UUFNZCxJQUFJLENBQUMsaUJBQU0sQ0FBQyxPQUFPLENBQUMsRUFBRTtZQUNwQixNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7U0FDcEM7UUFFRCxJQUFJLEVBQUUsRUFBRTtZQUNOLElBQUksQ0FBQyxPQUFPLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQztZQUUxQixJQUFJLEVBQUUsWUFBWSxlQUFlLEVBQUU7Z0JBQ2pDLElBQUksQ0FBQyxJQUFJLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQztnQkFDcEIsSUFBSSxDQUFDLFlBQVksR0FBRyxFQUFFLENBQUMsWUFBWSxDQUFDO2FBQ3JDO1NBQ0Y7UUFFRCxpRUFBaUU7UUFDaEUsSUFBWSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsd0JBQXdCLENBQUM7SUFDM0QsQ0FBQztJQUVTLE1BQU0sQ0FBQyxjQUFjLENBQzdCLE9BQWdCLEVBQ2hCLFdBQThDLEVBQzlDLFVBQWdDO1FBRWhDLE9BQU8sSUFBSSxlQUFlLENBQVUsT0FBTyxFQUFFLFdBQVcsRUFBRSxVQUFVLENBQUMsQ0FBQztJQUN4RSxDQUFDO0lBRUQsTUFBTSxDQUFDLFVBQVUsQ0FDZixNQUFjLEVBQ2QsUUFBaUIsRUFDakIsYUFBa0MsUUFBUSxFQUMxQyxPQUFnQjtR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UUFBUSxHQUFHLGlDQUFlLENBQUMsb0JBQW9CLENBQUMsRUFBRTtZQUN0RCxNQUFNLFlBQVksR0FBRyxJQUFJLDBCQUFZLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxFQUFFLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1lBRWhGLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLFVBQVUsSUFBSTtnQkFDN0IsWUFBWSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ25DLFlBQVksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ3ZDLENBQUMsQ0FBQyxDQUFDO1lBRUgsT0FBTyxzQkFBTyxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLENBQUM7U0FDN0M7UUFFRCxPQUFPLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQzdCLENBQUM7O0FBaklILDBDQWtJQztBQWpJUSwyQkFBVyxHQUFHLENBQUMsQ0FBQztBQUNoQixzQ0FBc0IsR0FBRyxDQUFDLENBQUM7QUFDM0IsNENBQTRCLEdBQUcsQ0FBQyxDQUFDO0FBQ2pDLDhDQUE4QixHQUFHLENBQUMsQ0FBQztBQUNuQywyQ0FBMkIsR0FBRyxDQUFDLENBQUM7QUFDaEMsNkJBQWEsR0FBRyxDQUFDLENBQUM7QUFDbEIsc0NBQXNCLEdBQUcsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQnVmZmVyUmVhZGVyLCBCdWZmZXJXcml0ZXIgfSBmcm9tICdiaXRjb2luanMtbGliL3NyYy9idWZmZXJ1dGlscyc7XG5pbXBvcnQgeyBjcnlwdG8gYXMgYmNyeXB0bywgVHJhbnNhY3Rpb24gfSBmcm9tICdiaXRjb2luanMtbGliJztcblxuaW1wb3J0IHsgVXR4b1RyYW5zYWN0aW9uLCB2YXJTbGljZVNpemUgfSBmcm9tICcuLi9VdHhvVHJhbnNhY3Rpb24nO1xuaW1wb3J0IHsgaXNEYXNoLCBOZXR3b3JrIH0gZnJvbSAnLi4vLi4vbmV0d29ya3MnO1xuXG5leHBvcnQgY2xhc3MgRGFzaFRyYW5zYWN0aW9uPFROdW1iZXIgZXh0ZW5kcyBudW1iZXIgfCBiaWdpbnQgPSBudW1iZXI+IGV4dGVuZHMgVXR4b1RyYW5zYWN0aW9uPFROdW1iZXI+IHtcbiAgc3RhdGljIERBU0hfTk9STUFMID0gMDtcbiAgc3RhdGljIERBU0hfUFJPVklERVJfUkVHSVNURVIgPSAxO1xuICBzdGF0aWMgREFTSF9QUk9WSURFUl9VUERBVEVfU0VSVklDRSA9IDI7XG4gIHN0YXRpYyBEQVNIX1BST1ZJREVSX1VQREFURV9SRUdJU1RSQVIgPSAzO1xuICBzdGF0aWMgREFTSF9QUk9WSURFUl9VUERBVEVfUkVWT0tFID0gNDtcbiAgc3RhdGljIERBU0hfQ09JTkJBU0UgPSA1O1xuICBzdGF0aWMgREFTSF9RVU9SVU1fQ09NTUlUTUVOVCA9IDY7XG5cbiAgcHVibGljIHR5cGUgPSAwO1xuICBwdWJsaWMgZXh0cmFQYXlsb2FkPzogQnVmZmVyO1xuXG4gIGNvbnN0cnVjdG9yKG5ldHdvcms6IE5ldHdvcmssIHR4PzogVHJhbnNhY3Rpb248YmlnaW50IHwgbnVtYmVyPiwgYW1vdW50VHlwZT86ICdiaWdpbnQnIHwgJ251bWJlcicpIHtcbiAgICBzdXBlcihuZXR3b3JrLCB0eCwgYW1vdW50VHlwZSk7XG5cbiAgICBpZiAoIWlzRGFzaChuZXR3b3JrKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbnZhbGlkIG5ldHdvcmtgKTtcbiAgICB9XG5cbiAgICBpZiAodHgpIHtcbiAgICAgIHRoaXMudmVyc2lvbiA9IHR4LnZlcnNpb247XG5cbiAgICAgIGlmICh0eCBpbnN0YW5jZW9mIERhc2hUcmFuc2FjdGlvbikge1xuICAgICAgICB0aGlzLnR5cGUgPSB0eC50eXBlO1xuICAgICAgICB0aGlzLmV4dHJhUGF5bG9hZCA9IHR4LmV4dHJhUGF5bG9hZDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBzaW5jZSBgX190b0J1ZmZlcmAgaXMgcHJpdmF0ZSB3ZSBoYXZlIHRvIGRvIGEgbGl0dGxlIGhhY2sgaGVyZVxuICAgICh0aGlzIGFzIGFueSkuX190b0J1ZmZlciA9IHRoaXMudG9CdWZmZXJXaXRoRXh0cmFQYXlsb2FkO1xuICB9XG5cbiAgcHJvdGVjdGVkIHN0YXRpYyBuZXdUcmFuc2FjdGlvbjxUTnVtYmVyIGV4dGVuZHMgbnVtYmVyIHwgYmlnaW50ID0gbnVtYmVyPihcbiAgICBuZXR3b3JrOiBOZXR3b3JrLFxuICAgIHRyYW5zYWN0aW9uPzogRGFzaFRyYW5zYWN0aW9uPG51bWJlciB8IGJpZ2ludD4sXG4gICAgYW1vdW50VHlwZT86ICdudW1iZXInIHwgJ2JpZ2ludCdcbiAgKTogRGFzaFRyYW5zYWN0aW9uPFROdW1iZXI+IHtcbiAgICByZXR1cm4gbmV3IERhc2hUcmFuc2FjdGlvbjxUTnVtYmVyPihuZXR3b3JrLCB0cmFuc2FjdGlvbiwgYW1vdW50VHlwZSk7XG4gIH1cblxuICBzdGF0aWMgZnJvbUJ1ZmZlcjxUTnVtYmVyIGV4dGVuZHMgbnVtYmVyIHwgYmlnaW50ID0gbnVtYmVyPihcbiAgICBidWZmZXI6IEJ1ZmZlcixcbiAgICBub1N0cmljdDogYm9vbGVhbixcbiAgICBhbW91bnRUeXBlOiAnbnVtYmVyJyB8ICdiaWdpbnQnID0gJ251bWJlcicsXG4gICAgbmV0d29yazogTmV0d29ya1xuICApOiBEYXNoVHJhbnNhY3Rpb248VE51bWJlcj4ge1xuICAgIGNvbnN0IHR4ID0gbmV3IERhc2hUcmFuc2FjdGlvbjxUTnVtYmVyPihuZXR3b3JrLCBzdXBlci5mcm9tQnVmZmVyPFROdW1iZXI+KGJ1ZmZlciwgdHJ1ZSwgYW1vdW50VHlwZSwgbmV0d29yaykpO1xuICAgIHR4LnR5cGUgPSB0eC52ZXJzaW9uID4+IDE2O1xuICAgIHR4LnZlcnNpb24gPSB0eC52ZXJzaW9uICYgMHhmZmZmO1xuICAgIGlmICh0eC5ieXRlTGVuZ3RoKCkgIT09IGJ1ZmZlci5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IGJ1ZmZlclJlYWRlciA9IG5ldyBCdWZmZXJSZWFkZXIoYnVmZmVyLCB0eC5ieXRlTGVuZ3RoKCkpO1xuICAgICAgdHguZXh0cmFQYXlsb2FkID0gYnVmZmVyUmVhZGVyLnJlYWRWYXJTbGljZSgpO1xuICAgIH1cbiAgICByZXR1cm4gdHg7XG4gIH1cblxuICBjbG9uZTxUTjIgZXh0ZW5kcyBiaWdpbnQgfCBudW1iZXIgPSBUTnVtYmVyPihhbW91bnRUeXBlPzogJ251bWJlcicgfCAnYmlnaW50Jyk6IERhc2hUcmFuc2FjdGlvbjxUTjI+IHtcbiAgICByZXR1cm4gbmV3IERhc2hUcmFuc2FjdGlvbjxUTjI+KHRoaXMubmV0d29yaywgdGhpcywgYW1vdW50VHlwZSk7XG4gIH1cblxuICBieXRlTGVuZ3RoKF9BTExPV19XSVRORVNTPzogYm9vbGVhbik6IG51bWJlciB7XG4gICAgcmV0dXJuIHN1cGVyLmJ5dGVMZW5ndGgoX0FMTE9XX1dJVE5FU1MpICsgKHRoaXMuZXh0cmFQYXlsb2FkID8gdmFyU2xpY2VTaXplKHRoaXMuZXh0cmFQYXlsb2FkKSA6IDApO1xuICB9XG5cbiAgLyoqXG4gICAqIEhlbHBlciB0byBvdmVycmlkZSBgX190b0J1ZmZlcigpYCBvZiBiaXRjb2luanMuVHJhbnNhY3Rpb24uXG4gICAqIFNpbmNlIHRoZSBtZXRob2QgaXMgcHJpdmF0ZSwgd2UgdXNlIGEgaGFjayBpbiB0aGUgY29uc3RydWN0b3IgdG8gbWFrZSBpdCB3b3JrLlxuICAgKlxuICAgKiBUT0RPOiByZW1vdmUgYHByaXZhdGVgIG1vZGlmaWVyIGluIGJpdGNvaW5qcyBgX190b0J1ZmZlcigpYCBvciBmaW5kIHNvbWUgb3RoZXIgc29sdXRpb25cbiAgICpcbiAgICogQHBhcmFtIGJ1ZmZlciAtIG9wdGlvbmFsIHRhcmdldCBidWZmZXJcbiAgICogQHBhcmFtIGluaXRpYWxPZmZzZXQgLSBjYW4gb25seSBiZSB1bmRlZmluZWQgb3IgMC4gT3RoZXIgdmFsdWVzIGFyZSBvbmx5IHVzZWQgZm9yIHNlcmlhbGl6YXRpb24gaW4gYmxvY2tzLlxuICAgKiBAcGFyYW0gX0FMTE9XX1dJVE5FU1MgLSBpZ25vcmVkXG4gICAqL1xuICBwcml2YXRlIHRvQnVmZmVyV2l0aEV4dHJhUGF5bG9hZChidWZmZXI/OiBCdWZmZXIsIGluaXRpYWxPZmZzZXQ/OiBudW1iZXIsIF9BTExPV19XSVRORVNTID0gZmFsc2UpOiBCdWZmZXIge1xuICAgIC8vIFdlIGNhbiBpZ25vcmUgdGhlIGBfQUxMT1dfV0lUTkVTU2AgcGFyYW1ldGVyIGhlcmUgc2luY2UgaXQgaGFzIG5vIGVmZmVjdC5cbiAgICBpZiAoIWJ1ZmZlcikge1xuICAgICAgYnVmZmVyID0gQnVmZmVyLmFsbG9jVW5zYWZlKHRoaXMuYnl0ZUxlbmd0aChmYWxzZSkpO1xuICAgIH1cblxuICAgIGlmIChpbml0aWFsT2Zmc2V0ICE9PSB1bmRlZmluZWQgJiYgaW5pdGlhbE9mZnNldCAhPT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBub3Qgc3VwcG9ydGVkYCk7XG4gICAgfVxuXG4gICAgLy8gU3RhcnQgb3V0IHdpdGggcmVndWxhciBiaXRjb2luIGJ5dGUgc2VxdWVuY2UuXG4gICAgLy8gVGhpcyBidWZmZXIgd2lsbCBoYXZlIGV4Y2VzcyBzaXplIGJlY2F1c2UgaXQgdXNlcyBgYnl0ZUxlbmd0aCgpYCB0byBhbGxvY2F0ZS5cbiAgICBjb25zdCBiYXNlQnVmZmVyID0gKFRyYW5zYWN0aW9uLnByb3RvdHlwZSBhcyBhbnkpLl9fdG9CdWZmZXIuY2FsbCh0aGlzKTtcbiAgICBiYXNlQnVmZmVyLmNvcHkoYnVmZmVyKTtcblxuICAgIC8vIG92ZXJ3cml0ZSBsZWFkaW5nIHZlcnNpb24gYnl0ZXMgKHVpbnQxNiB2ZXJzaW9uLCB1aW50MTYgdHlwZSlcbiAgICBjb25zdCBidWZmZXJXcml0ZXIgPSBuZXcgQnVmZmVyV3JpdGVyKGJ1ZmZlciwgMCk7XG4gICAgYnVmZmVyV3JpdGVyLndyaXRlVUludDMyKCh0aGlzLnZlcnNpb24gJiAweGZmZmYpIHwgKHRoaXMudHlwZSA8PCAxNikpO1xuXG4gICAgLy8gU2VlayB0byBlbmQgb2Ygb3JpZ2luYWwgYnl0ZSBzZXF1ZW5jZSBhbmQgYWRkIGV4dHJhUGF5bG9hZC5cbiAgICAvLyBXZSBtdXN0IHVzZSB0aGUgYnl0ZUxlbmd0aCBhcyBjYWxjdWxhdGVkIGJ5IHRoZSBiaXRjb2luanMgaW1wbGVtZW50YXRpb24gc2luY2VcbiAgICAvLyBgYmFzZUJ1ZmZlcmAgaGFzIGFuIGV4Y2VzcyBzaXplLlxuICAgIGlmICh0aGlzLmV4dHJhUGF5bG9hZCkge1xuICAgICAgYnVmZmVyV3JpdGVyLm9mZnNldCA9IFRyYW5zYWN0aW9uLnByb3RvdHlwZS5ieXRlTGVuZ3RoLmNhbGwodGhpcyk7XG4gICAgICBidWZmZXJXcml0ZXIud3JpdGVWYXJTbGljZSh0aGlzLmV4dHJhUGF5bG9hZCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGJ1ZmZlcjtcbiAgfVxuXG4gIGdldEhhc2goZm9yV2l0bmVzcz86IGJvb2xlYW4pOiBCdWZmZXIge1xuICAgIGlmIChmb3JXaXRuZXNzKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGludmFsaWQgYXJndW1lbnRgKTtcbiAgICB9XG4gICAgcmV0dXJuIGJjcnlwdG8uaGFzaDI1Nih0aGlzLnRvQnVmZmVyKCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIEJ1aWxkIGEgaGFzaCBmb3IgYWxsIG9yIG5vbmUgb2YgdGhlIHRyYW5zYWN0aW9uIGlucHV0cyBkZXBlbmRpbmcgb24gdGhlIGhhc2h0eXBlXG4gICAqIEBwYXJhbSBoYXNoVHlwZVxuICAgKiBAcmV0dXJucyBCdWZmZXJcbiAgICovXG4gIGdldFByZXZvdXRIYXNoKGhhc2hUeXBlOiBudW1iZXIpOiBCdWZmZXIge1xuICAgIGlmICghKGhhc2hUeXBlICYgVXR4b1RyYW5zYWN0aW9uLlNJR0hBU0hfQU5ZT05FQ0FOUEFZKSkge1xuICAgICAgY29uc3QgYnVmZmVyV3JpdGVyID0gbmV3IEJ1ZmZlcldyaXRlcihCdWZmZXIuYWxsb2NVbnNhZmUoMzYgKiB0aGlzLmlucy5sZW5ndGgpKTtcblxuICAgICAgdGhpcy5pbnMuZm9yRWFjaChmdW5jdGlvbiAodHhJbikge1xuICAgICAgICBidWZmZXJXcml0ZXIud3JpdGVTbGljZSh0eEluLmhhc2gpO1xuICAgICAgICBidWZmZXJXcml0ZXIud3JpdGVVSW50MzIodHhJbi5pbmRleCk7XG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIGJjcnlwdG8uaGFzaDI1NihidWZmZXJXcml0ZXIuYnVmZmVyKTtcbiAgICB9XG5cbiAgICByZXR1cm4gQnVmZmVyLmFsbG9jKDMyLCAwKTtcbiAgfVxufVxuIl19