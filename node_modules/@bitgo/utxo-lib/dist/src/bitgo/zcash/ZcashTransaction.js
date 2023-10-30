"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZcashTransaction = exports.getDefaultConsensusBranchIdForVersion = exports.getDefaultVersionGroupIdForVersion = exports.UnsupportedTransactionError = void 0;
const bitcoinjs_lib_1 = require("bitcoinjs-lib");
const types = require("bitcoinjs-lib/src/types");
const bufferutils_1 = require("bitcoinjs-lib/src/bufferutils");
const varuint = require('varuint-bitcoin');
const typeforce = require('typeforce');
const UtxoTransaction_1 = require("../UtxoTransaction");
const ZcashBufferutils_1 = require("./ZcashBufferutils");
const hashZip0244_1 = require("./hashZip0244");
const ZERO = Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex');
// https://github.com/zcash/zcash/blob/v4.7.0/src/primitives/transaction.h#L40
const SAPLING_VERSION_GROUP_ID = 0x892f2085;
// https://github.com/zcash/zcash/blob/v4.7.0/src/primitives/transaction.h#L52
const ZIP225_VERSION_GROUP_ID = 0x26a7270a;
// https://github.com/zcash/zcash/blob/v4.7.0/src/consensus/upgrades.cpp#L11
const OVERWINTER_BRANCH_ID = 0x5ba81b19;
const CANOPY_BRANCH_ID = 0xe9ff75a6;
const NU5_BRANCH_ID = 0xc2d6d0b4;
class UnsupportedTransactionError extends Error {
    constructor(message) {
        super(message);
    }
}
exports.UnsupportedTransactionError = UnsupportedTransactionError;
function getDefaultVersionGroupIdForVersion(version) {
    switch (version) {
        case 400:
        case 450:
            return SAPLING_VERSION_GROUP_ID;
        case 500:
            return ZIP225_VERSION_GROUP_ID;
    }
    throw new Error(`no value for version ${version}`);
}
exports.getDefaultVersionGroupIdForVersion = getDefaultVersionGroupIdForVersion;
function getDefaultConsensusBranchIdForVersion(network, version) {
    switch (version) {
        case 1:
        case 2:
            return 0;
        case 3:
            return OVERWINTER_BRANCH_ID;
        case ZcashTransaction.VERSION4_BRANCH_CANOPY:
            // https://zips.z.cash/zip-0251
            return CANOPY_BRANCH_ID;
        case 4:
        case 5:
        case ZcashTransaction.VERSION4_BRANCH_NU5:
        case ZcashTransaction.VERSION5_BRANCH_NU5:
            // https://zips.z.cash/zip-0252
            return NU5_BRANCH_ID;
    }
    throw new Error(`no value for version ${version}`);
}
exports.getDefaultConsensusBranchIdForVersion = getDefaultConsensusBranchIdForVersion;
class ZcashTransaction extends UtxoTransaction_1.UtxoTransaction {
    constructor(network, tx, amountType) {
        super(network, tx, amountType);
        this.network = network;
        // 1 if the transaction is post overwinter upgrade, 0 otherwise
        this.overwintered = 0;
        // 0x03C48270 (63210096) for overwinter and 0x892F2085 (2301567109) for sapling
        this.versionGroupId = 0;
        // Block height after which this transactions will expire, or 0 to disable expiry
        this.expiryHeight = 0;
        let consensusBranchId;
        if (tx) {
            this.overwintered = tx.overwintered;
            this.versionGroupId = tx.versionGroupId;
            this.expiryHeight = tx.expiryHeight;
            if (tx.consensusBranchId !== undefined) {
                consensusBranchId = tx.consensusBranchId;
            }
        }
        this.consensusBranchId = consensusBranchId !== null && consensusBranchId !== void 0 ? consensusBranchId : getDefaultConsensusBranchIdForVersion(network, this.version);
    }
    static fromBuffer(buffer, __noStrict, amountType = 'number', network) {
        /* istanbul ignore next */
        if (!network) {
            throw new Error(`must provide network`);
        }
        const bufferReader = new bufferutils_1.BufferReader(buffer);
        const tx = new ZcashTransaction(network);
        tx.version = bufferReader.readInt32();
        // Split the header into fOverwintered and nVersion
        // https://github.com/zcash/zcash/blob/v4.5.1/src/primitives/transaction.h#L772
        tx.overwintered = tx.version >>> 31; // Must be 1 for version 3 and up
        tx.version = tx.version & 0x07fffffff; // 3 for overwinter
        tx.consensusBranchId = getDefaultConsensusBranchIdForVersion(network, tx.version);
        if (tx.isOverwinterCompatible()) {
            tx.versionGroupId = bufferReader.readUInt32();
        }
        if (tx.version === 5) {
            ZcashBufferutils_1.fromBufferV5(bufferReader, tx, amountType);
        }
        else {
            ZcashBufferutils_1.fromBufferV4(bufferReader, tx, amountType);
        }
        if (__noStrict)
            return tx;
        if (bufferReader.offset !== buffer.length) {
            const trailing = buffer.slice(bufferReader.offset);
            throw new Error(`Unexpected trailing bytes: ${trailing.toString('hex')}`);
        }
        return tx;
    }
    static fromBufferWithVersion(buf, network, version, amountType = 'number') {
        const tx = ZcashTransaction.fromBuffer(buf, false, amountType, network);
        if (version) {
            tx.consensusBranchId = getDefaultConsensusBranchIdForVersion(network, version);
        }
        return tx;
    }
    byteLength() {
        let byteLength = super.byteLength();
        if (this.isOverwinterCompatible()) {
            byteLength += 4; // nVersionGroupId
        }
        if (this.isOverwinterCompatible()) {
            byteLength += 4; // nExpiryHeight
        }
        const emptyVectorLength = varuint.encodingLength(0);
        if (this.version === 5) {
            // https://github.com/zcash/zcash/blob/v4.5.1/src/primitives/transaction.h#L822
            byteLength += 4; // consensusBranchId
            byteLength += emptyVectorLength; // saplingBundle inputs
            byteLength += emptyVectorLength; // saplingBundle outputs
            byteLength += 1; // orchardBundle (empty)
        }
        else {
            if (this.isSaplingCompatible()) {
                // https://github.com/zcash/zcash/blob/v4.5.1/src/primitives/transaction.h#L862
                byteLength += 8; // valueBalance (uint64)
                byteLength += emptyVectorLength; // inputs
                byteLength += emptyVectorLength; // outputs
            }
            if (this.supportsJoinSplits()) {
                //
                byteLength += emptyVectorLength; // joinsplits
            }
        }
        return byteLength;
    }
    isSaplingCompatible() {
        return !!this.overwintered && this.version >= ZcashTransaction.VERSION_SAPLING;
    }
    isOverwinterCompatible() {
        return !!this.overwintered && this.version >= ZcashTransaction.VERSION_OVERWINTER;
    }
    supportsJoinSplits() {
        return !!this.overwintered && this.version >= ZcashTransaction.VERSION_JOINSPLITS_SUPPORT;
    }
    /**
     * Build a hash for all or none of the transaction inputs depending on the hashtype
     * @param hashType
     * @returns Buffer - BLAKE2b hash or 256-bit zero if doesn't apply
     */
    getPrevoutHash(hashType) {
        if (!(hashType & bitcoinjs_lib_1.Transaction.SIGHASH_ANYONECANPAY)) {
            const bufferWriter = new bufferutils_1.BufferWriter(Buffer.allocUnsafe(36 * this.ins.length));
            this.ins.forEach(function (txIn) {
                bufferWriter.writeSlice(txIn.hash);
                bufferWriter.writeUInt32(txIn.index);
            });
            return hashZip0244_1.getBlake2bHash(bufferWriter.buffer, 'ZcashPrevoutHash');
        }
        return ZERO;
    }
    /**
     * Build a hash for all or none of the transactions inputs sequence numbers depending on the hashtype
     * @param hashType
     * @returns Buffer BLAKE2b hash or 256-bit zero if doesn't apply
     */
    getSequenceHash(hashType) {
        if (!(hashType & bitcoinjs_lib_1.Transaction.SIGHASH_ANYONECANPAY) &&
            (hashType & 0x1f) !== bitcoinjs_lib_1.Transaction.SIGHASH_SINGLE &&
            (hashType & 0x1f) !== bitcoinjs_lib_1.Transaction.SIGHASH_NONE) {
            const bufferWriter = new bufferutils_1.BufferWriter(Buffer.allocUnsafe(4 * this.ins.length));
            this.ins.forEach(function (txIn) {
                bufferWriter.writeUInt32(txIn.sequence);
            });
            return hashZip0244_1.getBlake2bHash(bufferWriter.buffer, 'ZcashSequencHash');
        }
        return ZERO;
    }
    /**
     * Build a hash for one, all or none of the transaction outputs depending on the hashtype
     * @param hashType
     * @param inIndex
     * @returns Buffer BLAKE2b hash or 256-bit zero if doesn't apply
     */
    getOutputsHash(hashType, inIndex) {
        if ((hashType & 0x1f) !== bitcoinjs_lib_1.Transaction.SIGHASH_SINGLE && (hashType & 0x1f) !== bitcoinjs_lib_1.Transaction.SIGHASH_NONE) {
            // Find out the size of the outputs and write them
            const txOutsSize = this.outs.reduce(function (sum, output) {
                return sum + 8 + UtxoTransaction_1.varSliceSize(output.script);
            }, 0);
            const bufferWriter = new bufferutils_1.BufferWriter(Buffer.allocUnsafe(txOutsSize));
            this.outs.forEach(function (out) {
                bufferWriter.writeUInt64(out.value);
                bufferWriter.writeVarSlice(out.script);
            });
            return hashZip0244_1.getBlake2bHash(bufferWriter.buffer, 'ZcashOutputsHash');
        }
        else if ((hashType & 0x1f) === bitcoinjs_lib_1.Transaction.SIGHASH_SINGLE && inIndex < this.outs.length) {
            // Write only the output specified in inIndex
            const output = this.outs[inIndex];
            const bufferWriter = new bufferutils_1.BufferWriter(Buffer.allocUnsafe(8 + UtxoTransaction_1.varSliceSize(output.script)));
            bufferWriter.writeUInt64(output.value);
            bufferWriter.writeVarSlice(output.script);
            return hashZip0244_1.getBlake2bHash(bufferWriter.buffer, 'ZcashOutputsHash');
        }
        return ZERO;
    }
    /**
     * Hash transaction for signing a transparent transaction in Zcash. Protected transactions are not supported.
     * @param inIndex
     * @param prevOutScript
     * @param value
     * @param hashType
     * @returns Buffer BLAKE2b hash
     */
    hashForSignatureByNetwork(inIndex, prevOutScript, value, hashType) {
        if (value === undefined) {
            throw new Error(`must provide value`);
        }
        // https://github.com/zcash/zcash/blob/v4.5.1/src/script/interpreter.cpp#L1175
        if (this.version === 5) {
            return hashZip0244_1.getSignatureDigest(this, inIndex, prevOutScript, value, hashType);
        }
        // ZCash amounts are always within Number.MAX_SAFE_INTEGER
        value = typeof value === 'bigint' ? Number(value) : value;
        typeforce(types.tuple(types.UInt32, types.Buffer, types.Number), [inIndex, prevOutScript, value]);
        if (inIndex === undefined) {
            throw new Error(`invalid inIndex`);
        }
        /* istanbul ignore next */
        if (inIndex >= this.ins.length) {
            throw new Error('Input index is out of range');
        }
        /* istanbul ignore next */
        if (!this.isOverwinterCompatible()) {
            throw new Error(`unsupported version ${this.version}`);
        }
        const hashPrevouts = this.getPrevoutHash(hashType);
        const hashSequence = this.getSequenceHash(hashType);
        const hashOutputs = this.getOutputsHash(hashType, inIndex);
        const hashJoinSplits = ZERO;
        const hashShieldedSpends = ZERO;
        const hashShieldedOutputs = ZERO;
        let baseBufferSize = 0;
        baseBufferSize += 4 * 5; // header, nVersionGroupId, lock_time, nExpiryHeight, hashType
        baseBufferSize += 32 * 4; // 256 hashes: hashPrevouts, hashSequence, hashOutputs, hashJoinSplits
        baseBufferSize += 4 * 2; // input.index, input.sequence
        baseBufferSize += 8; // value
        baseBufferSize += 32; // input.hash
        baseBufferSize += UtxoTransaction_1.varSliceSize(prevOutScript); // prevOutScript
        if (this.isSaplingCompatible()) {
            baseBufferSize += 32 * 2; // hashShieldedSpends and hashShieldedOutputs
            baseBufferSize += 8; // valueBalance
        }
        const mask = this.overwintered ? 1 : 0;
        const header = this.version | (mask << 31);
        const bufferWriter = new bufferutils_1.BufferWriter(Buffer.alloc(baseBufferSize));
        bufferWriter.writeInt32(header);
        bufferWriter.writeUInt32(this.versionGroupId);
        bufferWriter.writeSlice(hashPrevouts);
        bufferWriter.writeSlice(hashSequence);
        bufferWriter.writeSlice(hashOutputs);
        bufferWriter.writeSlice(hashJoinSplits);
        if (this.isSaplingCompatible()) {
            bufferWriter.writeSlice(hashShieldedSpends);
            bufferWriter.writeSlice(hashShieldedOutputs);
        }
        bufferWriter.writeUInt32(this.locktime);
        bufferWriter.writeUInt32(this.expiryHeight);
        if (this.isSaplingCompatible()) {
            bufferWriter.writeSlice(ZcashBufferutils_1.VALUE_INT64_ZERO);
        }
        bufferWriter.writeInt32(hashType);
        // The input being signed (replacing the scriptSig with scriptCode + amount)
        // The prevout may already be contained in hashPrevout, and the nSequence
        // may already be contained in hashSequence.
        const input = this.ins[inIndex];
        bufferWriter.writeSlice(input.hash);
        bufferWriter.writeUInt32(input.index);
        bufferWriter.writeVarSlice(prevOutScript);
        bufferWriter.writeUInt64(value);
        bufferWriter.writeUInt32(input.sequence);
        const personalization = Buffer.alloc(16);
        const prefix = 'ZcashSigHash';
        personalization.write(prefix);
        personalization.writeUInt32LE(this.consensusBranchId, prefix.length);
        return hashZip0244_1.getBlake2bHash(bufferWriter.buffer, personalization);
    }
    toBuffer(buffer, initialOffset = 0) {
        if (!buffer)
            buffer = Buffer.allocUnsafe(this.byteLength());
        const bufferWriter = new bufferutils_1.BufferWriter(buffer, initialOffset);
        if (this.isOverwinterCompatible()) {
            const mask = this.overwintered ? 1 : 0;
            bufferWriter.writeInt32(this.version | (mask << 31)); // Set overwinter bit
            bufferWriter.writeUInt32(this.versionGroupId);
        }
        else {
            bufferWriter.writeInt32(this.version);
        }
        if (this.version === 5) {
            ZcashBufferutils_1.toBufferV5(bufferWriter, this);
        }
        else {
            ZcashBufferutils_1.toBufferV4(bufferWriter, this);
        }
        if (initialOffset !== undefined) {
            return buffer.slice(initialOffset, bufferWriter.offset);
        }
        return buffer;
    }
    getHash(forWitness) {
        if (forWitness) {
            throw new Error(`invalid argument`);
        }
        if (this.version === 5) {
            return hashZip0244_1.getTxidDigest(this);
        }
        return bitcoinjs_lib_1.crypto.hash256(this.toBuffer());
    }
    clone(amountType) {
        return new ZcashTransaction(this.network, this, amountType);
    }
}
exports.ZcashTransaction = ZcashTransaction;
ZcashTransaction.VERSION_JOINSPLITS_SUPPORT = 2;
ZcashTransaction.VERSION_OVERWINTER = 3;
ZcashTransaction.VERSION_SAPLING = 4;
ZcashTransaction.VERSION4_BRANCH_CANOPY = 400;
ZcashTransaction.VERSION4_BRANCH_NU5 = 450;
ZcashTransaction.VERSION5_BRANCH_NU5 = 500;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiWmNhc2hUcmFuc2FjdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9iaXRnby96Y2FzaC9aY2FzaFRyYW5zYWN0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLGlEQUFvRDtBQUNwRCxpREFBaUQ7QUFDakQsK0RBQTJFO0FBRTNFLE1BQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0FBQzNDLE1BQU0sU0FBUyxHQUFHLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUd2Qyx3REFBbUU7QUFDbkUseURBQTBHO0FBQzFHLCtDQUFrRjtBQUVsRixNQUFNLElBQUksR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLGtFQUFrRSxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBSXBHLDhFQUE4RTtBQUM5RSxNQUFNLHdCQUF3QixHQUFHLFVBQVUsQ0FBQztBQUM1Qyw4RUFBOEU7QUFDOUUsTUFBTSx1QkFBdUIsR0FBRyxVQUFVLENBQUM7QUFFM0MsNEVBQTRFO0FBQzVFLE1BQU0sb0JBQW9CLEdBQUcsVUFBVSxDQUFDO0FBQ3hDLE1BQU0sZ0JBQWdCLEdBQUcsVUFBVSxDQUFDO0FBQ3BDLE1BQU0sYUFBYSxHQUFHLFVBQVUsQ0FBQztBQUVqQyxNQUFhLDJCQUE0QixTQUFRLEtBQUs7SUFDcEQsWUFBWSxPQUFlO1FBQ3pCLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNqQixDQUFDO0NBQ0Y7QUFKRCxrRUFJQztBQUVELFNBQWdCLGtDQUFrQyxDQUFDLE9BQWU7SUFDaEUsUUFBUSxPQUFPLEVBQUU7UUFDZixLQUFLLEdBQUcsQ0FBQztRQUNULEtBQUssR0FBRztZQUNOLE9BQU8sd0JBQXdCLENBQUM7UUFDbEMsS0FBSyxHQUFHO1lBQ04sT0FBTyx1QkFBdUIsQ0FBQztLQUNsQztJQUNELE1BQU0sSUFBSSxLQUFLLENBQUMsd0JBQXdCLE9BQU8sRUFBRSxDQUFDLENBQUM7QUFDckQsQ0FBQztBQVRELGdGQVNDO0FBRUQsU0FBZ0IscUNBQXFDLENBQUMsT0FBcUIsRUFBRSxPQUFlO0lBQzFGLFFBQVEsT0FBTyxFQUFFO1FBQ2YsS0FBSyxDQUFDLENBQUM7UUFDUCxLQUFLLENBQUM7WUFDSixPQUFPLENBQUMsQ0FBQztRQUNYLEtBQUssQ0FBQztZQUNKLE9BQU8sb0JBQW9CLENBQUM7UUFDOUIsS0FBSyxnQkFBZ0IsQ0FBQyxzQkFBc0I7WUFDMUMsK0JBQStCO1lBQy9CLE9BQU8sZ0JBQWdCLENBQUM7UUFDMUIsS0FBSyxDQUFDLENBQUM7UUFDUCxLQUFLLENBQUMsQ0FBQztRQUNQLEtBQUssZ0JBQWdCLENBQUMsbUJBQW1CLENBQUM7UUFDMUMsS0FBSyxnQkFBZ0IsQ0FBQyxtQkFBbUI7WUFDdkMsK0JBQStCO1lBQy9CLE9BQU8sYUFBYSxDQUFDO0tBQ3hCO0lBQ0QsTUFBTSxJQUFJLEtBQUssQ0FBQyx3QkFBd0IsT0FBTyxFQUFFLENBQUMsQ0FBQztBQUNyRCxDQUFDO0FBbEJELHNGQWtCQztBQUVELE1BQWEsZ0JBQTJELFNBQVEsaUNBQXdCO0lBaUJ0RyxZQUFtQixPQUFxQixFQUFFLEVBQXNDLEVBQUUsVUFBZ0M7UUFDaEgsS0FBSyxDQUFDLE9BQU8sRUFBRSxFQUFFLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFEZCxZQUFPLEdBQVAsT0FBTyxDQUFjO1FBUnhDLCtEQUErRDtRQUMvRCxpQkFBWSxHQUFHLENBQUMsQ0FBQztRQUNqQiwrRUFBK0U7UUFDL0UsbUJBQWMsR0FBRyxDQUFDLENBQUM7UUFDbkIsaUZBQWlGO1FBQ2pGLGlCQUFZLEdBQUcsQ0FBQyxDQUFDO1FBTWYsSUFBSSxpQkFBaUIsQ0FBQztRQUN0QixJQUFJLEVBQUUsRUFBRTtZQUNOLElBQUksQ0FBQyxZQUFZLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQztZQUNwQyxJQUFJLENBQUMsY0FBYyxHQUFHLEVBQUUsQ0FBQyxjQUFjLENBQUM7WUFDeEMsSUFBSSxDQUFDLFlBQVksR0FBRyxFQUFFLENBQUMsWUFBWSxDQUFDO1lBRXBDLElBQUksRUFBRSxDQUFDLGlCQUFpQixLQUFLLFNBQVMsRUFBRTtnQkFDdEMsaUJBQWlCLEdBQUcsRUFBRSxDQUFDLGlCQUFpQixDQUFDO2FBQzFDO1NBQ0Y7UUFDRCxJQUFJLENBQUMsaUJBQWlCLEdBQUcsaUJBQWlCLGFBQWpCLGlCQUFpQixjQUFqQixpQkFBaUIsR0FBSSxxQ0FBcUMsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQzdHLENBQUM7SUFFRCxNQUFNLENBQUMsVUFBVSxDQUNmLE1BQWMsRUFDZCxVQUFtQixFQUNuQixhQUFrQyxRQUFRLEVBQzFDLE9BQXNCO1FBRXRCLDBCQUEwQjtRQUMxQixJQUFJLENBQUMsT0FBTyxFQUFFO1lBQ1osTUFBTSxJQUFJLEtBQUssQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1NBQ3pDO1FBRUQsTUFBTSxZQUFZLEdBQUcsSUFBSSwwQkFBWSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzlDLE1BQU0sRUFBRSxHQUFHLElBQUksZ0JBQWdCLENBQVUsT0FBTyxDQUFDLENBQUM7UUFDbEQsRUFBRSxDQUFDLE9BQU8sR0FBRyxZQUFZLENBQUMsU0FBUyxFQUFFLENBQUM7UUFFdEMsbURBQW1EO1FBQ25ELCtFQUErRTtRQUMvRSxFQUFFLENBQUMsWUFBWSxHQUFHLEVBQUUsQ0FBQyxPQUFPLEtBQUssRUFBRSxDQUFDLENBQUMsaUNBQWlDO1FBQ3RFLEVBQUUsQ0FBQyxPQUFPLEdBQUcsRUFBRSxDQUFDLE9BQU8sR0FBRyxXQUFXLENBQUMsQ0FBQyxtQkFBbUI7UUFDMUQsRUFBRSxDQUFDLGlCQUFpQixHQUFHLHFDQUFxQyxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFbEYsSUFBSSxFQUFFLENBQUMsc0JBQXNCLEVBQUUsRUFBRTtZQUMvQixFQUFFLENBQUMsY0FBYyxHQUFHLFlBQVksQ0FBQyxVQUFVLEVBQUUsQ0FBQztTQUMvQztRQUVELElBQUksRUFBRSxDQUFDLE9BQU8sS0FBSyxDQUFDLEVBQUU7WUFDcEIsK0JBQVksQ0FBQyxZQUFZLEVBQUUsRUFBRSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1NBQzVDO2FBQU07WUFDTCwrQkFBWSxDQUFDLFlBQVksRUFBRSxFQUFFLEVBQUUsVUFBVSxDQUFDLENBQUM7U0FDNUM7UUFFRCxJQUFJLFVBQVU7WUFBRSxPQUFPLEVBQUUsQ0FBQztRQUMxQixJQUFJLFlBQVksQ0FBQyxNQUFNLEtBQUssTUFBTSxDQUFDLE1BQU0sRUFBRTtZQUN6QyxNQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNuRCxNQUFNLElBQUksS0FBSyxDQUFDLDhCQUE4QixRQUFRLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztTQUMzRTtRQUVELE9BQU8sRUFBRSxDQUFDO0lBQ1osQ0FBQztJQUVELE1BQU0sQ0FBQyxxQkFBcUIsQ0FDMUIsR0FBVyxFQUNYLE9BQXFCLEVBQ3JCLE9BQWdCLEVBQ2hCLGFBQWtDLFFBQVE7UUFFMUMsTUFBTSxFQUFFLEdBQUcsZ0JBQWdCLENBQUMsVUFBVSxDQUFVLEdBQUcsRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ2pGLElBQUksT0FBTyxFQUFFO1lBQ1gsRUFBRSxDQUFDLGlCQUFpQixHQUFHLHFDQUFxQyxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztTQUNoRjtRQUNELE9BQU8sRUFBRSxDQUFDO0lBQ1osQ0FBQztJQUVELFVBQVU7UUFDUixJQUFJLFVBQVUsR0FBRyxLQUFLLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDcEMsSUFBSSxJQUFJLENBQUMsc0JBQXNCLEVBQUUsRUFBRTtZQUNqQyxVQUFVLElBQUksQ0FBQyxDQUFDLENBQUMsa0JBQWtCO1NBQ3BDO1FBQ0QsSUFBSSxJQUFJLENBQUMsc0JBQXNCLEVBQUUsRUFBRTtZQUNqQyxVQUFVLElBQUksQ0FBQyxDQUFDLENBQUMsZ0JBQWdCO1NBQ2xDO1FBQ0QsTUFBTSxpQkFBaUIsR0FBRyxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3BELElBQUksSUFBSSxDQUFDLE9BQU8sS0FBSyxDQUFDLEVBQUU7WUFDdEIsK0VBQStFO1lBQy9FLFVBQVUsSUFBSSxDQUFDLENBQUMsQ0FBQyxvQkFBb0I7WUFDckMsVUFBVSxJQUFJLGlCQUFpQixDQUFDLENBQUMsdUJBQXVCO1lBQ3hELFVBQVUsSUFBSSxpQkFBaUIsQ0FBQyxDQUFDLHdCQUF3QjtZQUN6RCxVQUFVLElBQUksQ0FBQyxDQUFDLENBQUMsd0JBQXdCO1NBQzFDO2FBQU07WUFDTCxJQUFJLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxFQUFFO2dCQUM5QiwrRUFBK0U7Z0JBQy9FLFVBQVUsSUFBSSxDQUFDLENBQUMsQ0FBQyx3QkFBd0I7Z0JBQ3pDLFVBQVUsSUFBSSxpQkFBaUIsQ0FBQyxDQUFDLFNBQVM7Z0JBQzFDLFVBQVUsSUFBSSxpQkFBaUIsQ0FBQyxDQUFDLFVBQVU7YUFDNUM7WUFDRCxJQUFJLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxFQUFFO2dCQUM3QixFQUFFO2dCQUNGLFVBQVUsSUFBSSxpQkFBaUIsQ0FBQyxDQUFDLGFBQWE7YUFDL0M7U0FDRjtRQUNELE9BQU8sVUFBVSxDQUFDO0lBQ3BCLENBQUM7SUFFRCxtQkFBbUI7UUFDakIsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLFlBQVksSUFBSSxJQUFJLENBQUMsT0FBTyxJQUFJLGdCQUFnQixDQUFDLGVBQWUsQ0FBQztJQUNqRixDQUFDO0lBRUQsc0JBQXNCO1FBQ3BCLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZLElBQUksSUFBSSxDQUFDLE9BQU8sSUFBSSxnQkFBZ0IsQ0FBQyxrQkFBa0IsQ0FBQztJQUNwRixDQUFDO0lBRUQsa0JBQWtCO1FBQ2hCLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZLElBQUksSUFBSSxDQUFDLE9BQU8sSUFBSSxnQkFBZ0IsQ0FBQywwQkFBMEIsQ0FBQztJQUM1RixDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILGNBQWMsQ0FBQyxRQUFnQjtRQUM3QixJQUFJLENBQUMsQ0FBQyxRQUFRLEdBQUcsMkJBQVcsQ0FBQyxvQkFBb0IsQ0FBQyxFQUFFO1lBQ2xELE1BQU0sWUFBWSxHQUFHLElBQUksMEJBQVksQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLEVBQUUsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7WUFFaEYsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsVUFBVSxJQUFJO2dCQUM3QixZQUFZLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDbkMsWUFBWSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDdkMsQ0FBQyxDQUFDLENBQUM7WUFFSCxPQUFPLDRCQUFjLENBQUMsWUFBWSxDQUFDLE1BQU0sRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1NBQ2hFO1FBQ0QsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILGVBQWUsQ0FBQyxRQUFnQjtRQUM5QixJQUNFLENBQUMsQ0FBQyxRQUFRLEdBQUcsMkJBQVcsQ0FBQyxvQkFBb0IsQ0FBQztZQUM5QyxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsS0FBSywyQkFBVyxDQUFDLGNBQWM7WUFDaEQsQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLEtBQUssMkJBQVcsQ0FBQyxZQUFZLEVBQzlDO1lBQ0EsTUFBTSxZQUFZLEdBQUcsSUFBSSwwQkFBWSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztZQUUvRSxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxVQUFVLElBQUk7Z0JBQzdCLFlBQVksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQzFDLENBQUMsQ0FBQyxDQUFDO1lBRUgsT0FBTyw0QkFBYyxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztTQUNoRTtRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0gsY0FBYyxDQUFDLFFBQWdCLEVBQUUsT0FBZTtRQUM5QyxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxLQUFLLDJCQUFXLENBQUMsY0FBYyxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxLQUFLLDJCQUFXLENBQUMsWUFBWSxFQUFFO1lBQ3RHLGtEQUFrRDtZQUNsRCxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLEdBQUcsRUFBRSxNQUFNO2dCQUN2RCxPQUFPLEdBQUcsR0FBRyxDQUFDLEdBQUcsOEJBQVksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDL0MsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBRU4sTUFBTSxZQUFZLEdBQUcsSUFBSSwwQkFBWSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztZQUV0RSxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxVQUFVLEdBQUc7Z0JBQzdCLFlBQVksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUNwQyxZQUFZLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUN6QyxDQUFDLENBQUMsQ0FBQztZQUVILE9BQU8sNEJBQWMsQ0FBQyxZQUFZLENBQUMsTUFBTSxFQUFFLGtCQUFrQixDQUFDLENBQUM7U0FDaEU7YUFBTSxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxLQUFLLDJCQUFXLENBQUMsY0FBYyxJQUFJLE9BQU8sR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUN6Riw2Q0FBNkM7WUFDN0MsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUVsQyxNQUFNLFlBQVksR0FBRyxJQUFJLDBCQUFZLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDLEdBQUcsOEJBQVksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzNGLFlBQVksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ3ZDLFlBQVksQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBRTFDLE9BQU8sNEJBQWMsQ0FBQyxZQUFZLENBQUMsTUFBTSxFQUFFLGtCQUFrQixDQUFDLENBQUM7U0FDaEU7UUFDRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRDs7Ozs7OztPQU9HO0lBQ0gseUJBQXlCLENBQ3ZCLE9BQTJCLEVBQzNCLGFBQXFCLEVBQ3JCLEtBQWtDLEVBQ2xDLFFBQWdCO1FBRWhCLElBQUksS0FBSyxLQUFLLFNBQVMsRUFBRTtZQUN2QixNQUFNLElBQUksS0FBSyxDQUFDLG9CQUFvQixDQUFDLENBQUM7U0FDdkM7UUFFRCw4RUFBOEU7UUFDOUUsSUFBSSxJQUFJLENBQUMsT0FBTyxLQUFLLENBQUMsRUFBRTtZQUN0QixPQUFPLGdDQUFrQixDQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsYUFBYSxFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQztTQUMxRTtRQUVELDBEQUEwRDtRQUMxRCxLQUFLLEdBQUcsT0FBTyxLQUFLLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztRQUMxRCxTQUFTLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLGFBQWEsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBRWxHLElBQUksT0FBTyxLQUFLLFNBQVMsRUFBRTtZQUN6QixNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7U0FDcEM7UUFFRCwwQkFBMEI7UUFDMUIsSUFBSSxPQUFPLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUU7WUFDOUIsTUFBTSxJQUFJLEtBQUssQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDO1NBQ2hEO1FBRUQsMEJBQTBCO1FBQzFCLElBQUksQ0FBQyxJQUFJLENBQUMsc0JBQXNCLEVBQUUsRUFBRTtZQUNsQyxNQUFNLElBQUksS0FBSyxDQUFDLHVCQUF1QixJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztTQUN4RDtRQUVELE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDbkQsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNwRCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUMzRCxNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUM7UUFDNUIsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLENBQUM7UUFDaEMsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLENBQUM7UUFFakMsSUFBSSxjQUFjLEdBQUcsQ0FBQyxDQUFDO1FBQ3ZCLGNBQWMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsOERBQThEO1FBQ3ZGLGNBQWMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsc0VBQXNFO1FBQ2hHLGNBQWMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsOEJBQThCO1FBQ3ZELGNBQWMsSUFBSSxDQUFDLENBQUMsQ0FBQyxRQUFRO1FBQzdCLGNBQWMsSUFBSSxFQUFFLENBQUMsQ0FBQyxhQUFhO1FBQ25DLGNBQWMsSUFBSSw4QkFBWSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsZ0JBQWdCO1FBQy9ELElBQUksSUFBSSxDQUFDLG1CQUFtQixFQUFFLEVBQUU7WUFDOUIsY0FBYyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyw2Q0FBNkM7WUFDdkUsY0FBYyxJQUFJLENBQUMsQ0FBQyxDQUFDLGVBQWU7U0FDckM7UUFFRCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN2QyxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsT0FBTyxHQUFHLENBQUMsSUFBSSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBRTNDLE1BQU0sWUFBWSxHQUFHLElBQUksMEJBQVksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUM7UUFDcEUsWUFBWSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNoQyxZQUFZLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUM5QyxZQUFZLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQ3RDLFlBQVksQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDdEMsWUFBWSxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUNyQyxZQUFZLENBQUMsVUFBVSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQ3hDLElBQUksSUFBSSxDQUFDLG1CQUFtQixFQUFFLEVBQUU7WUFDOUIsWUFBWSxDQUFDLFVBQVUsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1lBQzVDLFlBQVksQ0FBQyxVQUFVLENBQUMsbUJBQW1CLENBQUMsQ0FBQztTQUM5QztRQUNELFlBQVksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3hDLFlBQVksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQzVDLElBQUksSUFBSSxDQUFDLG1CQUFtQixFQUFFLEVBQUU7WUFDOUIsWUFBWSxDQUFDLFVBQVUsQ0FBQyxtQ0FBZ0IsQ0FBQyxDQUFDO1NBQzNDO1FBQ0QsWUFBWSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUVsQyw0RUFBNEU7UUFDNUUseUVBQXlFO1FBQ3pFLDRDQUE0QztRQUM1QyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2hDLFlBQVksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3BDLFlBQVksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3RDLFlBQVksQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDMUMsWUFBWSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNoQyxZQUFZLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUV6QyxNQUFNLGVBQWUsR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3pDLE1BQU0sTUFBTSxHQUFHLGNBQWMsQ0FBQztRQUM5QixlQUFlLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzlCLGVBQWUsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLGlCQUFpQixFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUVyRSxPQUFPLDRCQUFjLENBQUMsWUFBWSxDQUFDLE1BQU0sRUFBRSxlQUFlLENBQUMsQ0FBQztJQUM5RCxDQUFDO0lBRUQsUUFBUSxDQUFDLE1BQWUsRUFBRSxhQUFhLEdBQUcsQ0FBQztRQUN6QyxJQUFJLENBQUMsTUFBTTtZQUFFLE1BQU0sR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO1FBRTVELE1BQU0sWUFBWSxHQUFHLElBQUksMEJBQVksQ0FBQyxNQUFNLEVBQUUsYUFBYSxDQUFDLENBQUM7UUFFN0QsSUFBSSxJQUFJLENBQUMsc0JBQXNCLEVBQUUsRUFBRTtZQUNqQyxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN2QyxZQUFZLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxPQUFPLEdBQUcsQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLHFCQUFxQjtZQUMzRSxZQUFZLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztTQUMvQzthQUFNO1lBQ0wsWUFBWSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7U0FDdkM7UUFFRCxJQUFJLElBQUksQ0FBQyxPQUFPLEtBQUssQ0FBQyxFQUFFO1lBQ3RCLDZCQUFVLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQyxDQUFDO1NBQ2hDO2FBQU07WUFDTCw2QkFBVSxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsQ0FBQztTQUNoQztRQUVELElBQUksYUFBYSxLQUFLLFNBQVMsRUFBRTtZQUMvQixPQUFPLE1BQU0sQ0FBQyxLQUFLLENBQUMsYUFBYSxFQUFFLFlBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQztTQUN6RDtRQUNELE9BQU8sTUFBTSxDQUFDO0lBQ2hCLENBQUM7SUFFRCxPQUFPLENBQUMsVUFBb0I7UUFDMUIsSUFBSSxVQUFVLEVBQUU7WUFDZCxNQUFNLElBQUksS0FBSyxDQUFDLGtCQUFrQixDQUFDLENBQUM7U0FDckM7UUFDRCxJQUFJLElBQUksQ0FBQyxPQUFPLEtBQUssQ0FBQyxFQUFFO1lBQ3RCLE9BQU8sMkJBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUM1QjtRQUNELE9BQU8sc0JBQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7SUFDekMsQ0FBQztJQUVELEtBQUssQ0FBd0MsVUFBZ0M7UUFDM0UsT0FBTyxJQUFJLGdCQUFnQixDQUFNLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ25FLENBQUM7O0FBblZILDRDQW9WQztBQW5WUSwyQ0FBMEIsR0FBRyxDQUFDLENBQUM7QUFDL0IsbUNBQWtCLEdBQUcsQ0FBQyxDQUFDO0FBQ3ZCLGdDQUFlLEdBQUcsQ0FBQyxDQUFDO0FBRXBCLHVDQUFzQixHQUFHLEdBQUcsQ0FBQztBQUM3QixvQ0FBbUIsR0FBRyxHQUFHLENBQUM7QUFDMUIsb0NBQW1CLEdBQUcsR0FBRyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgVHJhbnNhY3Rpb24sIGNyeXB0byB9IGZyb20gJ2JpdGNvaW5qcy1saWInO1xuaW1wb3J0ICogYXMgdHlwZXMgZnJvbSAnYml0Y29pbmpzLWxpYi9zcmMvdHlwZXMnO1xuaW1wb3J0IHsgQnVmZmVyUmVhZGVyLCBCdWZmZXJXcml0ZXIgfSBmcm9tICdiaXRjb2luanMtbGliL3NyYy9idWZmZXJ1dGlscyc7XG5cbmNvbnN0IHZhcnVpbnQgPSByZXF1aXJlKCd2YXJ1aW50LWJpdGNvaW4nKTtcbmNvbnN0IHR5cGVmb3JjZSA9IHJlcXVpcmUoJ3R5cGVmb3JjZScpO1xuXG5pbXBvcnQgeyBuZXR3b3JrcyB9IGZyb20gJy4uLy4uL25ldHdvcmtzJztcbmltcG9ydCB7IFV0eG9UcmFuc2FjdGlvbiwgdmFyU2xpY2VTaXplIH0gZnJvbSAnLi4vVXR4b1RyYW5zYWN0aW9uJztcbmltcG9ydCB7IGZyb21CdWZmZXJWNCwgZnJvbUJ1ZmZlclY1LCB0b0J1ZmZlclY0LCB0b0J1ZmZlclY1LCBWQUxVRV9JTlQ2NF9aRVJPIH0gZnJvbSAnLi9aY2FzaEJ1ZmZlcnV0aWxzJztcbmltcG9ydCB7IGdldEJsYWtlMmJIYXNoLCBnZXRTaWduYXR1cmVEaWdlc3QsIGdldFR4aWREaWdlc3QgfSBmcm9tICcuL2hhc2haaXAwMjQ0JztcblxuY29uc3QgWkVSTyA9IEJ1ZmZlci5mcm9tKCcwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwJywgJ2hleCcpO1xuXG5leHBvcnQgdHlwZSBaY2FzaE5ldHdvcmsgPSB0eXBlb2YgbmV0d29ya3MuemNhc2ggfCB0eXBlb2YgbmV0d29ya3MuemNhc2hUZXN0O1xuXG4vLyBodHRwczovL2dpdGh1Yi5jb20vemNhc2gvemNhc2gvYmxvYi92NC43LjAvc3JjL3ByaW1pdGl2ZXMvdHJhbnNhY3Rpb24uaCNMNDBcbmNvbnN0IFNBUExJTkdfVkVSU0lPTl9HUk9VUF9JRCA9IDB4ODkyZjIwODU7XG4vLyBodHRwczovL2dpdGh1Yi5jb20vemNhc2gvemNhc2gvYmxvYi92NC43LjAvc3JjL3ByaW1pdGl2ZXMvdHJhbnNhY3Rpb24uaCNMNTJcbmNvbnN0IFpJUDIyNV9WRVJTSU9OX0dST1VQX0lEID0gMHgyNmE3MjcwYTtcblxuLy8gaHR0cHM6Ly9naXRodWIuY29tL3pjYXNoL3pjYXNoL2Jsb2IvdjQuNy4wL3NyYy9jb25zZW5zdXMvdXBncmFkZXMuY3BwI0wxMVxuY29uc3QgT1ZFUldJTlRFUl9CUkFOQ0hfSUQgPSAweDViYTgxYjE5O1xuY29uc3QgQ0FOT1BZX0JSQU5DSF9JRCA9IDB4ZTlmZjc1YTY7XG5jb25zdCBOVTVfQlJBTkNIX0lEID0gMHhjMmQ2ZDBiNDtcblxuZXhwb3J0IGNsYXNzIFVuc3VwcG9ydGVkVHJhbnNhY3Rpb25FcnJvciBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IobWVzc2FnZTogc3RyaW5nKSB7XG4gICAgc3VwZXIobWVzc2FnZSk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldERlZmF1bHRWZXJzaW9uR3JvdXBJZEZvclZlcnNpb24odmVyc2lvbjogbnVtYmVyKTogbnVtYmVyIHtcbiAgc3dpdGNoICh2ZXJzaW9uKSB7XG4gICAgY2FzZSA0MDA6XG4gICAgY2FzZSA0NTA6XG4gICAgICByZXR1cm4gU0FQTElOR19WRVJTSU9OX0dST1VQX0lEO1xuICAgIGNhc2UgNTAwOlxuICAgICAgcmV0dXJuIFpJUDIyNV9WRVJTSU9OX0dST1VQX0lEO1xuICB9XG4gIHRocm93IG5ldyBFcnJvcihgbm8gdmFsdWUgZm9yIHZlcnNpb24gJHt2ZXJzaW9ufWApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0RGVmYXVsdENvbnNlbnN1c0JyYW5jaElkRm9yVmVyc2lvbihuZXR3b3JrOiBaY2FzaE5ldHdvcmssIHZlcnNpb246IG51bWJlcik6IG51bWJlciB7XG4gIHN3aXRjaCAodmVyc2lvbikge1xuICAgIGNhc2UgMTpcbiAgICBjYXNlIDI6XG4gICAgICByZXR1cm4gMDtcbiAgICBjYXNlIDM6XG4gICAgICByZXR1cm4gT1ZFUldJTlRFUl9CUkFOQ0hfSUQ7XG4gICAgY2FzZSBaY2FzaFRyYW5zYWN0aW9uLlZFUlNJT040X0JSQU5DSF9DQU5PUFk6XG4gICAgICAvLyBodHRwczovL3ppcHMuei5jYXNoL3ppcC0wMjUxXG4gICAgICByZXR1cm4gQ0FOT1BZX0JSQU5DSF9JRDtcbiAgICBjYXNlIDQ6XG4gICAgY2FzZSA1OlxuICAgIGNhc2UgWmNhc2hUcmFuc2FjdGlvbi5WRVJTSU9ONF9CUkFOQ0hfTlU1OlxuICAgIGNhc2UgWmNhc2hUcmFuc2FjdGlvbi5WRVJTSU9ONV9CUkFOQ0hfTlU1OlxuICAgICAgLy8gaHR0cHM6Ly96aXBzLnouY2FzaC96aXAtMDI1MlxuICAgICAgcmV0dXJuIE5VNV9CUkFOQ0hfSUQ7XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKGBubyB2YWx1ZSBmb3IgdmVyc2lvbiAke3ZlcnNpb259YCk7XG59XG5cbmV4cG9ydCBjbGFzcyBaY2FzaFRyYW5zYWN0aW9uPFROdW1iZXIgZXh0ZW5kcyBudW1iZXIgfCBiaWdpbnQgPSBudW1iZXI+IGV4dGVuZHMgVXR4b1RyYW5zYWN0aW9uPFROdW1iZXI+IHtcbiAgc3RhdGljIFZFUlNJT05fSk9JTlNQTElUU19TVVBQT1JUID0gMjtcbiAgc3RhdGljIFZFUlNJT05fT1ZFUldJTlRFUiA9IDM7XG4gIHN0YXRpYyBWRVJTSU9OX1NBUExJTkcgPSA0O1xuXG4gIHN0YXRpYyBWRVJTSU9ONF9CUkFOQ0hfQ0FOT1BZID0gNDAwO1xuICBzdGF0aWMgVkVSU0lPTjRfQlJBTkNIX05VNSA9IDQ1MDtcbiAgc3RhdGljIFZFUlNJT041X0JSQU5DSF9OVTUgPSA1MDA7XG5cbiAgLy8gMSBpZiB0aGUgdHJhbnNhY3Rpb24gaXMgcG9zdCBvdmVyd2ludGVyIHVwZ3JhZGUsIDAgb3RoZXJ3aXNlXG4gIG92ZXJ3aW50ZXJlZCA9IDA7XG4gIC8vIDB4MDNDNDgyNzAgKDYzMjEwMDk2KSBmb3Igb3ZlcndpbnRlciBhbmQgMHg4OTJGMjA4NSAoMjMwMTU2NzEwOSkgZm9yIHNhcGxpbmdcbiAgdmVyc2lvbkdyb3VwSWQgPSAwO1xuICAvLyBCbG9jayBoZWlnaHQgYWZ0ZXIgd2hpY2ggdGhpcyB0cmFuc2FjdGlvbnMgd2lsbCBleHBpcmUsIG9yIDAgdG8gZGlzYWJsZSBleHBpcnlcbiAgZXhwaXJ5SGVpZ2h0ID0gMDtcbiAgY29uc2Vuc3VzQnJhbmNoSWQ6IG51bWJlcjtcblxuICBjb25zdHJ1Y3RvcihwdWJsaWMgbmV0d29yazogWmNhc2hOZXR3b3JrLCB0eD86IFpjYXNoVHJhbnNhY3Rpb248YmlnaW50IHwgbnVtYmVyPiwgYW1vdW50VHlwZT86ICdiaWdpbnQnIHwgJ251bWJlcicpIHtcbiAgICBzdXBlcihuZXR3b3JrLCB0eCwgYW1vdW50VHlwZSk7XG5cbiAgICBsZXQgY29uc2Vuc3VzQnJhbmNoSWQ7XG4gICAgaWYgKHR4KSB7XG4gICAgICB0aGlzLm92ZXJ3aW50ZXJlZCA9IHR4Lm92ZXJ3aW50ZXJlZDtcbiAgICAgIHRoaXMudmVyc2lvbkdyb3VwSWQgPSB0eC52ZXJzaW9uR3JvdXBJZDtcbiAgICAgIHRoaXMuZXhwaXJ5SGVpZ2h0ID0gdHguZXhwaXJ5SGVpZ2h0O1xuXG4gICAgICBpZiAodHguY29uc2Vuc3VzQnJhbmNoSWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb25zZW5zdXNCcmFuY2hJZCA9IHR4LmNvbnNlbnN1c0JyYW5jaElkO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmNvbnNlbnN1c0JyYW5jaElkID0gY29uc2Vuc3VzQnJhbmNoSWQgPz8gZ2V0RGVmYXVsdENvbnNlbnN1c0JyYW5jaElkRm9yVmVyc2lvbihuZXR3b3JrLCB0aGlzLnZlcnNpb24pO1xuICB9XG5cbiAgc3RhdGljIGZyb21CdWZmZXI8VE51bWJlciBleHRlbmRzIG51bWJlciB8IGJpZ2ludCA9IG51bWJlcj4oXG4gICAgYnVmZmVyOiBCdWZmZXIsXG4gICAgX19ub1N0cmljdDogYm9vbGVhbixcbiAgICBhbW91bnRUeXBlOiAnbnVtYmVyJyB8ICdiaWdpbnQnID0gJ251bWJlcicsXG4gICAgbmV0d29yaz86IFpjYXNoTmV0d29ya1xuICApOiBaY2FzaFRyYW5zYWN0aW9uPFROdW1iZXI+IHtcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgIGlmICghbmV0d29yaykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBtdXN0IHByb3ZpZGUgbmV0d29ya2ApO1xuICAgIH1cblxuICAgIGNvbnN0IGJ1ZmZlclJlYWRlciA9IG5ldyBCdWZmZXJSZWFkZXIoYnVmZmVyKTtcbiAgICBjb25zdCB0eCA9IG5ldyBaY2FzaFRyYW5zYWN0aW9uPFROdW1iZXI+KG5ldHdvcmspO1xuICAgIHR4LnZlcnNpb24gPSBidWZmZXJSZWFkZXIucmVhZEludDMyKCk7XG5cbiAgICAvLyBTcGxpdCB0aGUgaGVhZGVyIGludG8gZk92ZXJ3aW50ZXJlZCBhbmQgblZlcnNpb25cbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vemNhc2gvemNhc2gvYmxvYi92NC41LjEvc3JjL3ByaW1pdGl2ZXMvdHJhbnNhY3Rpb24uaCNMNzcyXG4gICAgdHgub3ZlcndpbnRlcmVkID0gdHgudmVyc2lvbiA+Pj4gMzE7IC8vIE11c3QgYmUgMSBmb3IgdmVyc2lvbiAzIGFuZCB1cFxuICAgIHR4LnZlcnNpb24gPSB0eC52ZXJzaW9uICYgMHgwN2ZmZmZmZmY7IC8vIDMgZm9yIG92ZXJ3aW50ZXJcbiAgICB0eC5jb25zZW5zdXNCcmFuY2hJZCA9IGdldERlZmF1bHRDb25zZW5zdXNCcmFuY2hJZEZvclZlcnNpb24obmV0d29yaywgdHgudmVyc2lvbik7XG5cbiAgICBpZiAodHguaXNPdmVyd2ludGVyQ29tcGF0aWJsZSgpKSB7XG4gICAgICB0eC52ZXJzaW9uR3JvdXBJZCA9IGJ1ZmZlclJlYWRlci5yZWFkVUludDMyKCk7XG4gICAgfVxuXG4gICAgaWYgKHR4LnZlcnNpb24gPT09IDUpIHtcbiAgICAgIGZyb21CdWZmZXJWNShidWZmZXJSZWFkZXIsIHR4LCBhbW91bnRUeXBlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZnJvbUJ1ZmZlclY0KGJ1ZmZlclJlYWRlciwgdHgsIGFtb3VudFR5cGUpO1xuICAgIH1cblxuICAgIGlmIChfX25vU3RyaWN0KSByZXR1cm4gdHg7XG4gICAgaWYgKGJ1ZmZlclJlYWRlci5vZmZzZXQgIT09IGJ1ZmZlci5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IHRyYWlsaW5nID0gYnVmZmVyLnNsaWNlKGJ1ZmZlclJlYWRlci5vZmZzZXQpO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmV4cGVjdGVkIHRyYWlsaW5nIGJ5dGVzOiAke3RyYWlsaW5nLnRvU3RyaW5nKCdoZXgnKX1gKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHg7XG4gIH1cblxuICBzdGF0aWMgZnJvbUJ1ZmZlcldpdGhWZXJzaW9uPFROdW1iZXIgZXh0ZW5kcyBudW1iZXIgfCBiaWdpbnQ+KFxuICAgIGJ1ZjogQnVmZmVyLFxuICAgIG5ldHdvcms6IFpjYXNoTmV0d29yayxcbiAgICB2ZXJzaW9uPzogbnVtYmVyLFxuICAgIGFtb3VudFR5cGU6ICdudW1iZXInIHwgJ2JpZ2ludCcgPSAnbnVtYmVyJ1xuICApOiBaY2FzaFRyYW5zYWN0aW9uPFROdW1iZXI+IHtcbiAgICBjb25zdCB0eCA9IFpjYXNoVHJhbnNhY3Rpb24uZnJvbUJ1ZmZlcjxUTnVtYmVyPihidWYsIGZhbHNlLCBhbW91bnRUeXBlLCBuZXR3b3JrKTtcbiAgICBpZiAodmVyc2lvbikge1xuICAgICAgdHguY29uc2Vuc3VzQnJhbmNoSWQgPSBnZXREZWZhdWx0Q29uc2Vuc3VzQnJhbmNoSWRGb3JWZXJzaW9uKG5ldHdvcmssIHZlcnNpb24pO1xuICAgIH1cbiAgICByZXR1cm4gdHg7XG4gIH1cblxuICBieXRlTGVuZ3RoKCk6IG51bWJlciB7XG4gICAgbGV0IGJ5dGVMZW5ndGggPSBzdXBlci5ieXRlTGVuZ3RoKCk7XG4gICAgaWYgKHRoaXMuaXNPdmVyd2ludGVyQ29tcGF0aWJsZSgpKSB7XG4gICAgICBieXRlTGVuZ3RoICs9IDQ7IC8vIG5WZXJzaW9uR3JvdXBJZFxuICAgIH1cbiAgICBpZiAodGhpcy5pc092ZXJ3aW50ZXJDb21wYXRpYmxlKCkpIHtcbiAgICAgIGJ5dGVMZW5ndGggKz0gNDsgLy8gbkV4cGlyeUhlaWdodFxuICAgIH1cbiAgICBjb25zdCBlbXB0eVZlY3Rvckxlbmd0aCA9IHZhcnVpbnQuZW5jb2RpbmdMZW5ndGgoMCk7XG4gICAgaWYgKHRoaXMudmVyc2lvbiA9PT0gNSkge1xuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3pjYXNoL3pjYXNoL2Jsb2IvdjQuNS4xL3NyYy9wcmltaXRpdmVzL3RyYW5zYWN0aW9uLmgjTDgyMlxuICAgICAgYnl0ZUxlbmd0aCArPSA0OyAvLyBjb25zZW5zdXNCcmFuY2hJZFxuICAgICAgYnl0ZUxlbmd0aCArPSBlbXB0eVZlY3Rvckxlbmd0aDsgLy8gc2FwbGluZ0J1bmRsZSBpbnB1dHNcbiAgICAgIGJ5dGVMZW5ndGggKz0gZW1wdHlWZWN0b3JMZW5ndGg7IC8vIHNhcGxpbmdCdW5kbGUgb3V0cHV0c1xuICAgICAgYnl0ZUxlbmd0aCArPSAxOyAvLyBvcmNoYXJkQnVuZGxlIChlbXB0eSlcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHRoaXMuaXNTYXBsaW5nQ29tcGF0aWJsZSgpKSB7XG4gICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS96Y2FzaC96Y2FzaC9ibG9iL3Y0LjUuMS9zcmMvcHJpbWl0aXZlcy90cmFuc2FjdGlvbi5oI0w4NjJcbiAgICAgICAgYnl0ZUxlbmd0aCArPSA4OyAvLyB2YWx1ZUJhbGFuY2UgKHVpbnQ2NClcbiAgICAgICAgYnl0ZUxlbmd0aCArPSBlbXB0eVZlY3Rvckxlbmd0aDsgLy8gaW5wdXRzXG4gICAgICAgIGJ5dGVMZW5ndGggKz0gZW1wdHlWZWN0b3JMZW5ndGg7IC8vIG91dHB1dHNcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLnN1cHBvcnRzSm9pblNwbGl0cygpKSB7XG4gICAgICAgIC8vXG4gICAgICAgIGJ5dGVMZW5ndGggKz0gZW1wdHlWZWN0b3JMZW5ndGg7IC8vIGpvaW5zcGxpdHNcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGJ5dGVMZW5ndGg7XG4gIH1cblxuICBpc1NhcGxpbmdDb21wYXRpYmxlKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiAhIXRoaXMub3ZlcndpbnRlcmVkICYmIHRoaXMudmVyc2lvbiA+PSBaY2FzaFRyYW5zYWN0aW9uLlZFUlNJT05fU0FQTElORztcbiAgfVxuXG4gIGlzT3ZlcndpbnRlckNvbXBhdGlibGUoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuICEhdGhpcy5vdmVyd2ludGVyZWQgJiYgdGhpcy52ZXJzaW9uID49IFpjYXNoVHJhbnNhY3Rpb24uVkVSU0lPTl9PVkVSV0lOVEVSO1xuICB9XG5cbiAgc3VwcG9ydHNKb2luU3BsaXRzKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiAhIXRoaXMub3ZlcndpbnRlcmVkICYmIHRoaXMudmVyc2lvbiA+PSBaY2FzaFRyYW5zYWN0aW9uLlZFUlNJT05fSk9JTlNQTElUU19TVVBQT1JUO1xuICB9XG5cbiAgLyoqXG4gICAqIEJ1aWxkIGEgaGFzaCBmb3IgYWxsIG9yIG5vbmUgb2YgdGhlIHRyYW5zYWN0aW9uIGlucHV0cyBkZXBlbmRpbmcgb24gdGhlIGhhc2h0eXBlXG4gICAqIEBwYXJhbSBoYXNoVHlwZVxuICAgKiBAcmV0dXJucyBCdWZmZXIgLSBCTEFLRTJiIGhhc2ggb3IgMjU2LWJpdCB6ZXJvIGlmIGRvZXNuJ3QgYXBwbHlcbiAgICovXG4gIGdldFByZXZvdXRIYXNoKGhhc2hUeXBlOiBudW1iZXIpOiBCdWZmZXIge1xuICAgIGlmICghKGhhc2hUeXBlICYgVHJhbnNhY3Rpb24uU0lHSEFTSF9BTllPTkVDQU5QQVkpKSB7XG4gICAgICBjb25zdCBidWZmZXJXcml0ZXIgPSBuZXcgQnVmZmVyV3JpdGVyKEJ1ZmZlci5hbGxvY1Vuc2FmZSgzNiAqIHRoaXMuaW5zLmxlbmd0aCkpO1xuXG4gICAgICB0aGlzLmlucy5mb3JFYWNoKGZ1bmN0aW9uICh0eEluKSB7XG4gICAgICAgIGJ1ZmZlcldyaXRlci53cml0ZVNsaWNlKHR4SW4uaGFzaCk7XG4gICAgICAgIGJ1ZmZlcldyaXRlci53cml0ZVVJbnQzMih0eEluLmluZGV4KTtcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gZ2V0Qmxha2UyYkhhc2goYnVmZmVyV3JpdGVyLmJ1ZmZlciwgJ1pjYXNoUHJldm91dEhhc2gnKTtcbiAgICB9XG4gICAgcmV0dXJuIFpFUk87XG4gIH1cblxuICAvKipcbiAgICogQnVpbGQgYSBoYXNoIGZvciBhbGwgb3Igbm9uZSBvZiB0aGUgdHJhbnNhY3Rpb25zIGlucHV0cyBzZXF1ZW5jZSBudW1iZXJzIGRlcGVuZGluZyBvbiB0aGUgaGFzaHR5cGVcbiAgICogQHBhcmFtIGhhc2hUeXBlXG4gICAqIEByZXR1cm5zIEJ1ZmZlciBCTEFLRTJiIGhhc2ggb3IgMjU2LWJpdCB6ZXJvIGlmIGRvZXNuJ3QgYXBwbHlcbiAgICovXG4gIGdldFNlcXVlbmNlSGFzaChoYXNoVHlwZTogbnVtYmVyKTogQnVmZmVyIHtcbiAgICBpZiAoXG4gICAgICAhKGhhc2hUeXBlICYgVHJhbnNhY3Rpb24uU0lHSEFTSF9BTllPTkVDQU5QQVkpICYmXG4gICAgICAoaGFzaFR5cGUgJiAweDFmKSAhPT0gVHJhbnNhY3Rpb24uU0lHSEFTSF9TSU5HTEUgJiZcbiAgICAgIChoYXNoVHlwZSAmIDB4MWYpICE9PSBUcmFuc2FjdGlvbi5TSUdIQVNIX05PTkVcbiAgICApIHtcbiAgICAgIGNvbnN0IGJ1ZmZlcldyaXRlciA9IG5ldyBCdWZmZXJXcml0ZXIoQnVmZmVyLmFsbG9jVW5zYWZlKDQgKiB0aGlzLmlucy5sZW5ndGgpKTtcblxuICAgICAgdGhpcy5pbnMuZm9yRWFjaChmdW5jdGlvbiAodHhJbikge1xuICAgICAgICBidWZmZXJXcml0ZXIud3JpdGVVSW50MzIodHhJbi5zZXF1ZW5jZSk7XG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIGdldEJsYWtlMmJIYXNoKGJ1ZmZlcldyaXRlci5idWZmZXIsICdaY2FzaFNlcXVlbmNIYXNoJyk7XG4gICAgfVxuICAgIHJldHVybiBaRVJPO1xuICB9XG5cbiAgLyoqXG4gICAqIEJ1aWxkIGEgaGFzaCBmb3Igb25lLCBhbGwgb3Igbm9uZSBvZiB0aGUgdHJhbnNhY3Rpb24gb3V0cHV0cyBkZXBlbmRpbmcgb24gdGhlIGhhc2h0eXBlXG4gICAqIEBwYXJhbSBoYXNoVHlwZVxuICAgKiBAcGFyYW0gaW5JbmRleFxuICAgKiBAcmV0dXJucyBCdWZmZXIgQkxBS0UyYiBoYXNoIG9yIDI1Ni1iaXQgemVybyBpZiBkb2Vzbid0IGFwcGx5XG4gICAqL1xuICBnZXRPdXRwdXRzSGFzaChoYXNoVHlwZTogbnVtYmVyLCBpbkluZGV4OiBudW1iZXIpOiBCdWZmZXIge1xuICAgIGlmICgoaGFzaFR5cGUgJiAweDFmKSAhPT0gVHJhbnNhY3Rpb24uU0lHSEFTSF9TSU5HTEUgJiYgKGhhc2hUeXBlICYgMHgxZikgIT09IFRyYW5zYWN0aW9uLlNJR0hBU0hfTk9ORSkge1xuICAgICAgLy8gRmluZCBvdXQgdGhlIHNpemUgb2YgdGhlIG91dHB1dHMgYW5kIHdyaXRlIHRoZW1cbiAgICAgIGNvbnN0IHR4T3V0c1NpemUgPSB0aGlzLm91dHMucmVkdWNlKGZ1bmN0aW9uIChzdW0sIG91dHB1dCkge1xuICAgICAgICByZXR1cm4gc3VtICsgOCArIHZhclNsaWNlU2l6ZShvdXRwdXQuc2NyaXB0KTtcbiAgICAgIH0sIDApO1xuXG4gICAgICBjb25zdCBidWZmZXJXcml0ZXIgPSBuZXcgQnVmZmVyV3JpdGVyKEJ1ZmZlci5hbGxvY1Vuc2FmZSh0eE91dHNTaXplKSk7XG5cbiAgICAgIHRoaXMub3V0cy5mb3JFYWNoKGZ1bmN0aW9uIChvdXQpIHtcbiAgICAgICAgYnVmZmVyV3JpdGVyLndyaXRlVUludDY0KG91dC52YWx1ZSk7XG4gICAgICAgIGJ1ZmZlcldyaXRlci53cml0ZVZhclNsaWNlKG91dC5zY3JpcHQpO1xuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiBnZXRCbGFrZTJiSGFzaChidWZmZXJXcml0ZXIuYnVmZmVyLCAnWmNhc2hPdXRwdXRzSGFzaCcpO1xuICAgIH0gZWxzZSBpZiAoKGhhc2hUeXBlICYgMHgxZikgPT09IFRyYW5zYWN0aW9uLlNJR0hBU0hfU0lOR0xFICYmIGluSW5kZXggPCB0aGlzLm91dHMubGVuZ3RoKSB7XG4gICAgICAvLyBXcml0ZSBvbmx5IHRoZSBvdXRwdXQgc3BlY2lmaWVkIGluIGluSW5kZXhcbiAgICAgIGNvbnN0IG91dHB1dCA9IHRoaXMub3V0c1tpbkluZGV4XTtcblxuICAgICAgY29uc3QgYnVmZmVyV3JpdGVyID0gbmV3IEJ1ZmZlcldyaXRlcihCdWZmZXIuYWxsb2NVbnNhZmUoOCArIHZhclNsaWNlU2l6ZShvdXRwdXQuc2NyaXB0KSkpO1xuICAgICAgYnVmZmVyV3JpdGVyLndyaXRlVUludDY0KG91dHB1dC52YWx1ZSk7XG4gICAgICBidWZmZXJXcml0ZXIud3JpdGVWYXJTbGljZShvdXRwdXQuc2NyaXB0KTtcblxuICAgICAgcmV0dXJuIGdldEJsYWtlMmJIYXNoKGJ1ZmZlcldyaXRlci5idWZmZXIsICdaY2FzaE91dHB1dHNIYXNoJyk7XG4gICAgfVxuICAgIHJldHVybiBaRVJPO1xuICB9XG5cbiAgLyoqXG4gICAqIEhhc2ggdHJhbnNhY3Rpb24gZm9yIHNpZ25pbmcgYSB0cmFuc3BhcmVudCB0cmFuc2FjdGlvbiBpbiBaY2FzaC4gUHJvdGVjdGVkIHRyYW5zYWN0aW9ucyBhcmUgbm90IHN1cHBvcnRlZC5cbiAgICogQHBhcmFtIGluSW5kZXhcbiAgICogQHBhcmFtIHByZXZPdXRTY3JpcHRcbiAgICogQHBhcmFtIHZhbHVlXG4gICAqIEBwYXJhbSBoYXNoVHlwZVxuICAgKiBAcmV0dXJucyBCdWZmZXIgQkxBS0UyYiBoYXNoXG4gICAqL1xuICBoYXNoRm9yU2lnbmF0dXJlQnlOZXR3b3JrKFxuICAgIGluSW5kZXg6IG51bWJlciB8IHVuZGVmaW5lZCxcbiAgICBwcmV2T3V0U2NyaXB0OiBCdWZmZXIsXG4gICAgdmFsdWU6IGJpZ2ludCB8IG51bWJlciB8IHVuZGVmaW5lZCxcbiAgICBoYXNoVHlwZTogbnVtYmVyXG4gICk6IEJ1ZmZlciB7XG4gICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgbXVzdCBwcm92aWRlIHZhbHVlYCk7XG4gICAgfVxuXG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3pjYXNoL3pjYXNoL2Jsb2IvdjQuNS4xL3NyYy9zY3JpcHQvaW50ZXJwcmV0ZXIuY3BwI0wxMTc1XG4gICAgaWYgKHRoaXMudmVyc2lvbiA9PT0gNSkge1xuICAgICAgcmV0dXJuIGdldFNpZ25hdHVyZURpZ2VzdCh0aGlzLCBpbkluZGV4LCBwcmV2T3V0U2NyaXB0LCB2YWx1ZSwgaGFzaFR5cGUpO1xuICAgIH1cblxuICAgIC8vIFpDYXNoIGFtb3VudHMgYXJlIGFsd2F5cyB3aXRoaW4gTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVJcbiAgICB2YWx1ZSA9IHR5cGVvZiB2YWx1ZSA9PT0gJ2JpZ2ludCcgPyBOdW1iZXIodmFsdWUpIDogdmFsdWU7XG4gICAgdHlwZWZvcmNlKHR5cGVzLnR1cGxlKHR5cGVzLlVJbnQzMiwgdHlwZXMuQnVmZmVyLCB0eXBlcy5OdW1iZXIpLCBbaW5JbmRleCwgcHJldk91dFNjcmlwdCwgdmFsdWVdKTtcblxuICAgIGlmIChpbkluZGV4ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgaW52YWxpZCBpbkluZGV4YCk7XG4gICAgfVxuXG4gICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICBpZiAoaW5JbmRleCA+PSB0aGlzLmlucy5sZW5ndGgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW5wdXQgaW5kZXggaXMgb3V0IG9mIHJhbmdlJyk7XG4gICAgfVxuXG4gICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICBpZiAoIXRoaXMuaXNPdmVyd2ludGVyQ29tcGF0aWJsZSgpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYHVuc3VwcG9ydGVkIHZlcnNpb24gJHt0aGlzLnZlcnNpb259YCk7XG4gICAgfVxuXG4gICAgY29uc3QgaGFzaFByZXZvdXRzID0gdGhpcy5nZXRQcmV2b3V0SGFzaChoYXNoVHlwZSk7XG4gICAgY29uc3QgaGFzaFNlcXVlbmNlID0gdGhpcy5nZXRTZXF1ZW5jZUhhc2goaGFzaFR5cGUpO1xuICAgIGNvbnN0IGhhc2hPdXRwdXRzID0gdGhpcy5nZXRPdXRwdXRzSGFzaChoYXNoVHlwZSwgaW5JbmRleCk7XG4gICAgY29uc3QgaGFzaEpvaW5TcGxpdHMgPSBaRVJPO1xuICAgIGNvbnN0IGhhc2hTaGllbGRlZFNwZW5kcyA9IFpFUk87XG4gICAgY29uc3QgaGFzaFNoaWVsZGVkT3V0cHV0cyA9IFpFUk87XG5cbiAgICBsZXQgYmFzZUJ1ZmZlclNpemUgPSAwO1xuICAgIGJhc2VCdWZmZXJTaXplICs9IDQgKiA1OyAvLyBoZWFkZXIsIG5WZXJzaW9uR3JvdXBJZCwgbG9ja190aW1lLCBuRXhwaXJ5SGVpZ2h0LCBoYXNoVHlwZVxuICAgIGJhc2VCdWZmZXJTaXplICs9IDMyICogNDsgLy8gMjU2IGhhc2hlczogaGFzaFByZXZvdXRzLCBoYXNoU2VxdWVuY2UsIGhhc2hPdXRwdXRzLCBoYXNoSm9pblNwbGl0c1xuICAgIGJhc2VCdWZmZXJTaXplICs9IDQgKiAyOyAvLyBpbnB1dC5pbmRleCwgaW5wdXQuc2VxdWVuY2VcbiAgICBiYXNlQnVmZmVyU2l6ZSArPSA4OyAvLyB2YWx1ZVxuICAgIGJhc2VCdWZmZXJTaXplICs9IDMyOyAvLyBpbnB1dC5oYXNoXG4gICAgYmFzZUJ1ZmZlclNpemUgKz0gdmFyU2xpY2VTaXplKHByZXZPdXRTY3JpcHQpOyAvLyBwcmV2T3V0U2NyaXB0XG4gICAgaWYgKHRoaXMuaXNTYXBsaW5nQ29tcGF0aWJsZSgpKSB7XG4gICAgICBiYXNlQnVmZmVyU2l6ZSArPSAzMiAqIDI7IC8vIGhhc2hTaGllbGRlZFNwZW5kcyBhbmQgaGFzaFNoaWVsZGVkT3V0cHV0c1xuICAgICAgYmFzZUJ1ZmZlclNpemUgKz0gODsgLy8gdmFsdWVCYWxhbmNlXG4gICAgfVxuXG4gICAgY29uc3QgbWFzayA9IHRoaXMub3ZlcndpbnRlcmVkID8gMSA6IDA7XG4gICAgY29uc3QgaGVhZGVyID0gdGhpcy52ZXJzaW9uIHwgKG1hc2sgPDwgMzEpO1xuXG4gICAgY29uc3QgYnVmZmVyV3JpdGVyID0gbmV3IEJ1ZmZlcldyaXRlcihCdWZmZXIuYWxsb2MoYmFzZUJ1ZmZlclNpemUpKTtcbiAgICBidWZmZXJXcml0ZXIud3JpdGVJbnQzMihoZWFkZXIpO1xuICAgIGJ1ZmZlcldyaXRlci53cml0ZVVJbnQzMih0aGlzLnZlcnNpb25Hcm91cElkKTtcbiAgICBidWZmZXJXcml0ZXIud3JpdGVTbGljZShoYXNoUHJldm91dHMpO1xuICAgIGJ1ZmZlcldyaXRlci53cml0ZVNsaWNlKGhhc2hTZXF1ZW5jZSk7XG4gICAgYnVmZmVyV3JpdGVyLndyaXRlU2xpY2UoaGFzaE91dHB1dHMpO1xuICAgIGJ1ZmZlcldyaXRlci53cml0ZVNsaWNlKGhhc2hKb2luU3BsaXRzKTtcbiAgICBpZiAodGhpcy5pc1NhcGxpbmdDb21wYXRpYmxlKCkpIHtcbiAgICAgIGJ1ZmZlcldyaXRlci53cml0ZVNsaWNlKGhhc2hTaGllbGRlZFNwZW5kcyk7XG4gICAgICBidWZmZXJXcml0ZXIud3JpdGVTbGljZShoYXNoU2hpZWxkZWRPdXRwdXRzKTtcbiAgICB9XG4gICAgYnVmZmVyV3JpdGVyLndyaXRlVUludDMyKHRoaXMubG9ja3RpbWUpO1xuICAgIGJ1ZmZlcldyaXRlci53cml0ZVVJbnQzMih0aGlzLmV4cGlyeUhlaWdodCk7XG4gICAgaWYgKHRoaXMuaXNTYXBsaW5nQ29tcGF0aWJsZSgpKSB7XG4gICAgICBidWZmZXJXcml0ZXIud3JpdGVTbGljZShWQUxVRV9JTlQ2NF9aRVJPKTtcbiAgICB9XG4gICAgYnVmZmVyV3JpdGVyLndyaXRlSW50MzIoaGFzaFR5cGUpO1xuXG4gICAgLy8gVGhlIGlucHV0IGJlaW5nIHNpZ25lZCAocmVwbGFjaW5nIHRoZSBzY3JpcHRTaWcgd2l0aCBzY3JpcHRDb2RlICsgYW1vdW50KVxuICAgIC8vIFRoZSBwcmV2b3V0IG1heSBhbHJlYWR5IGJlIGNvbnRhaW5lZCBpbiBoYXNoUHJldm91dCwgYW5kIHRoZSBuU2VxdWVuY2VcbiAgICAvLyBtYXkgYWxyZWFkeSBiZSBjb250YWluZWQgaW4gaGFzaFNlcXVlbmNlLlxuICAgIGNvbnN0IGlucHV0ID0gdGhpcy5pbnNbaW5JbmRleF07XG4gICAgYnVmZmVyV3JpdGVyLndyaXRlU2xpY2UoaW5wdXQuaGFzaCk7XG4gICAgYnVmZmVyV3JpdGVyLndyaXRlVUludDMyKGlucHV0LmluZGV4KTtcbiAgICBidWZmZXJXcml0ZXIud3JpdGVWYXJTbGljZShwcmV2T3V0U2NyaXB0KTtcbiAgICBidWZmZXJXcml0ZXIud3JpdGVVSW50NjQodmFsdWUpO1xuICAgIGJ1ZmZlcldyaXRlci53cml0ZVVJbnQzMihpbnB1dC5zZXF1ZW5jZSk7XG5cbiAgICBjb25zdCBwZXJzb25hbGl6YXRpb24gPSBCdWZmZXIuYWxsb2MoMTYpO1xuICAgIGNvbnN0IHByZWZpeCA9ICdaY2FzaFNpZ0hhc2gnO1xuICAgIHBlcnNvbmFsaXphdGlvbi53cml0ZShwcmVmaXgpO1xuICAgIHBlcnNvbmFsaXphdGlvbi53cml0ZVVJbnQzMkxFKHRoaXMuY29uc2Vuc3VzQnJhbmNoSWQsIHByZWZpeC5sZW5ndGgpO1xuXG4gICAgcmV0dXJuIGdldEJsYWtlMmJIYXNoKGJ1ZmZlcldyaXRlci5idWZmZXIsIHBlcnNvbmFsaXphdGlvbik7XG4gIH1cblxuICB0b0J1ZmZlcihidWZmZXI/OiBCdWZmZXIsIGluaXRpYWxPZmZzZXQgPSAwKTogQnVmZmVyIHtcbiAgICBpZiAoIWJ1ZmZlcikgYnVmZmVyID0gQnVmZmVyLmFsbG9jVW5zYWZlKHRoaXMuYnl0ZUxlbmd0aCgpKTtcblxuICAgIGNvbnN0IGJ1ZmZlcldyaXRlciA9IG5ldyBCdWZmZXJXcml0ZXIoYnVmZmVyLCBpbml0aWFsT2Zmc2V0KTtcblxuICAgIGlmICh0aGlzLmlzT3ZlcndpbnRlckNvbXBhdGlibGUoKSkge1xuICAgICAgY29uc3QgbWFzayA9IHRoaXMub3ZlcndpbnRlcmVkID8gMSA6IDA7XG4gICAgICBidWZmZXJXcml0ZXIud3JpdGVJbnQzMih0aGlzLnZlcnNpb24gfCAobWFzayA8PCAzMSkpOyAvLyBTZXQgb3ZlcndpbnRlciBiaXRcbiAgICAgIGJ1ZmZlcldyaXRlci53cml0ZVVJbnQzMih0aGlzLnZlcnNpb25Hcm91cElkKTtcbiAgICB9IGVsc2Uge1xuICAgICAgYnVmZmVyV3JpdGVyLndyaXRlSW50MzIodGhpcy52ZXJzaW9uKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy52ZXJzaW9uID09PSA1KSB7XG4gICAgICB0b0J1ZmZlclY1KGJ1ZmZlcldyaXRlciwgdGhpcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRvQnVmZmVyVjQoYnVmZmVyV3JpdGVyLCB0aGlzKTtcbiAgICB9XG5cbiAgICBpZiAoaW5pdGlhbE9mZnNldCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gYnVmZmVyLnNsaWNlKGluaXRpYWxPZmZzZXQsIGJ1ZmZlcldyaXRlci5vZmZzZXQpO1xuICAgIH1cbiAgICByZXR1cm4gYnVmZmVyO1xuICB9XG5cbiAgZ2V0SGFzaChmb3JXaXRuZXNzPzogYm9vbGVhbik6IEJ1ZmZlciB7XG4gICAgaWYgKGZvcldpdG5lc3MpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgaW52YWxpZCBhcmd1bWVudGApO1xuICAgIH1cbiAgICBpZiAodGhpcy52ZXJzaW9uID09PSA1KSB7XG4gICAgICByZXR1cm4gZ2V0VHhpZERpZ2VzdCh0aGlzKTtcbiAgICB9XG4gICAgcmV0dXJuIGNyeXB0by5oYXNoMjU2KHRoaXMudG9CdWZmZXIoKSk7XG4gIH1cblxuICBjbG9uZTxUTjIgZXh0ZW5kcyBudW1iZXIgfCBiaWdpbnQgPSBUTnVtYmVyPihhbW91bnRUeXBlPzogJ2JpZ2ludCcgfCAnbnVtYmVyJyk6IFpjYXNoVHJhbnNhY3Rpb248VE4yPiB7XG4gICAgcmV0dXJuIG5ldyBaY2FzaFRyYW5zYWN0aW9uPFROMj4odGhpcy5uZXR3b3JrLCB0aGlzLCBhbW91bnRUeXBlKTtcbiAgfVxufVxuIl19