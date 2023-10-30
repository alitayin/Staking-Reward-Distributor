"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionBuilder = void 0;
const types = require("bitcoinjs-lib/src/types");
const _1 = require("./");
const bufferutils = require("bitcoinjs-lib/src/bufferutils");
const classify = require("./classify");
const _2 = require("./");
const _3 = require("./");
const _4 = require("./");
const _5 = require("./");
const _6 = require("./");
const _7 = require("./");
const _8 = require("./");
const noble_ecc_1 = require("./noble_ecc");
const typeforce = require('typeforce');
const tfFullSigner = (obj) => {
    return typeforce.Buffer(obj.publicKey) && typeof obj.sign === 'function' && typeof obj.signSchnorr === 'function';
};
const SCRIPT_TYPES = classify.types;
const PREVOUT_TYPES = new Set([
    // Raw
    'p2pkh',
    'p2pk',
    'p2wpkh',
    'p2ms',
    // P2SH wrapped
    'p2sh-p2pkh',
    'p2sh-p2pk',
    'p2sh-p2wpkh',
    'p2sh-p2ms',
    // P2WSH wrapped
    'p2wsh-p2pkh',
    'p2wsh-p2pk',
    'p2wsh-p2ms',
    // P2SH-P2WSH wrapper
    'p2sh-p2wsh-p2pkh',
    'p2sh-p2wsh-p2pk',
    'p2sh-p2wsh-p2ms',
    // P2TR KeyPath
    'p2tr',
    // P2TR ScriptPath
    'p2tr-p2ns',
]);
function tfMessage(type, value, message) {
    try {
        typeforce(type, value);
    }
    catch (err) {
        throw new Error(message);
    }
}
function txIsString(tx) {
    return typeof tx === 'string' || tx instanceof String;
}
function txIsTransaction(tx) {
    return tx instanceof _8.Transaction;
}
class TransactionBuilder {
    // WARNING: maximumFeeRate is __NOT__ to be relied on,
    //          it's just another potential safety mechanism (safety in-depth)
    constructor(network = _3.networks.bitcoin, maximumFeeRate = 2500) {
        this.network = network;
        this.maximumFeeRate = maximumFeeRate;
        this.__PREV_TX_SET = {};
        this.__INPUTS = [];
        this.__TX = new _8.Transaction();
        this.__TX.version = 2;
        this.__USE_LOW_R = false;
        console.warn('Deprecation Warning: TransactionBuilder will be removed in the future. ' +
            '(v6.x.x or later) Please use the Psbt class instead. Examples of usage ' +
            'are available in the transactions-psbt.js integration test file on our ' +
            'Github. A high level explanation is available in the psbt.ts and psbt.js ' +
            'files as well.');
    }
    static fromTransaction(transaction, network, prevOutputs) {
        const txb = new TransactionBuilder(network);
        // Copy transaction fields
        txb.setVersion(transaction.version);
        txb.setLockTime(transaction.locktime);
        // Copy outputs (done first to avoid signature invalidation)
        transaction.outs.forEach((txOut) => {
            txb.addOutput(txOut.script, txOut.value);
        });
        // Copy inputs
        transaction.ins.forEach((txIn) => {
            txb.__addInputUnsafe(txIn.hash, txIn.index, {
                sequence: txIn.sequence,
                script: txIn.script,
                witness: txIn.witness,
            });
        });
        // fix some things not possible through the public API
        txb.__INPUTS.forEach((input, i) => {
            fixMultisigOrder(input, transaction, i, prevOutputs);
        });
        return txb;
    }
    setLowR(setting) {
        typeforce(typeforce.maybe(typeforce.Boolean), setting);
        if (setting === undefined) {
            setting = true;
        }
        this.__USE_LOW_R = setting;
        return setting;
    }
    setLockTime(locktime) {
        typeforce(types.UInt32, locktime);
        // if any signatures exist, throw
        if (this.__INPUTS.some((input) => {
            if (!input.signatures)
                return false;
            return input.signatures.some((s) => s !== undefined);
        })) {
            throw new Error('No, this would invalidate signatures');
        }
        this.__TX.locktime = locktime;
    }
    setVersion(version) {
        typeforce(types.UInt32, version);
        // XXX: this might eventually become more complex depending on what the versions represent
        this.__TX.version = version;
    }
    addInput(txHash, vout, sequence, prevOutScript, value) {
        if (!this.__canModifyInputs()) {
            throw new Error('No, this would invalidate signatures');
        }
        // is it a hex string?
        if (txIsString(txHash)) {
            // transaction hashs's are displayed in reverse order, un-reverse it
            txHash = bufferutils.reverseBuffer(Buffer.from(txHash, 'hex'));
            // is it a Transaction object?
        }
        else if (txIsTransaction(txHash)) {
            const txOut = txHash.outs[vout];
            prevOutScript = txOut.script;
            value = txOut.value;
            txHash = txHash.getHash(false);
        }
        return this.__addInputUnsafe(txHash, vout, {
            sequence,
            prevOutScript,
            value,
        });
    }
    addOutput(scriptPubKey, value) {
        if (!this.__canModifyOutputs()) {
            throw new Error('No, this would invalidate signatures');
        }
        // Attempt to get a script if it's a base58 or bech32 address string
        if (typeof scriptPubKey === 'string') {
            scriptPubKey = _1.address.toOutputScript(scriptPubKey, this.network);
        }
        return this.__TX.addOutput(scriptPubKey, value);
    }
    build() {
        return this.__build(false);
    }
    buildIncomplete() {
        return this.__build(true);
    }
    sign(signParams, keyPair, redeemScript, hashType, witnessValue, witnessScript, controlBlock, annex) {
        trySign(getSigningData(this.network, this.__INPUTS, this.__needsOutputs.bind(this), this.__TX, signParams, keyPair, redeemScript, hashType, witnessValue, witnessScript, controlBlock, annex, this.__USE_LOW_R));
    }
    __addInputUnsafe(txHash, vout, options) {
        if (_8.Transaction.isCoinbaseHash(txHash)) {
            throw new Error('coinbase inputs not supported');
        }
        const prevTxOut = txHash.toString('hex') + ':' + vout;
        if (this.__PREV_TX_SET[prevTxOut] !== undefined)
            throw new Error('Duplicate TxOut: ' + prevTxOut);
        let input = {};
        // derive what we can from the scriptSig
        if (options.script !== undefined || options.witness !== undefined) {
            input = expandInput(options.script, options.witness);
        }
        // if an input value was given, retain it
        if (options.value !== undefined) {
            input.value = options.value;
        }
        // derive what we can from the previous transactions output script
        if (!input.prevOutScript && options.prevOutScript) {
            let prevOutType;
            if (!input.pubkeys && !input.signatures) {
                const expanded = expandOutput(options.prevOutScript);
                if (expanded.pubkeys) {
                    input.pubkeys = expanded.pubkeys;
                    input.signatures = expanded.signatures;
                }
                prevOutType = expanded.type;
            }
            input.prevOutScript = options.prevOutScript;
            input.prevOutType = prevOutType || classify.output(options.prevOutScript);
        }
        const vin = this.__TX.addInput(txHash, vout, options.sequence, options.scriptSig);
        this.__INPUTS[vin] = input;
        this.__PREV_TX_SET[prevTxOut] = true;
        return vin;
    }
    __build(allowIncomplete) {
        if (!allowIncomplete) {
            if (!this.__TX.ins.length)
                throw new Error('Transaction has no inputs');
            if (!this.__TX.outs.length)
                throw new Error('Transaction has no outputs');
        }
        const tx = this.__TX.clone();
        // create script signatures from inputs
        this.__INPUTS.forEach((input, i) => {
            if (!input.prevOutType && !allowIncomplete)
                throw new Error('Transaction is not complete');
            const result = build(input.prevOutType, input, allowIncomplete);
            if (!result) {
                if (!allowIncomplete && input.prevOutType === SCRIPT_TYPES.NONSTANDARD)
                    throw new Error('Unknown input type');
                if (!allowIncomplete)
                    throw new Error('Not enough information');
                return;
            }
            if (result.input) {
                tx.setInputScript(i, result.input);
            }
            tx.setWitness(i, result.witness);
        });
        if (!allowIncomplete) {
            // do not rely on this, its merely a last resort
            if (this.__overMaximumFees(tx.virtualSize())) {
                throw new Error('Transaction has absurd fees');
            }
        }
        return tx;
    }
    __canModifyInputs() {
        return this.__INPUTS.every((input) => {
            if (!input.signatures)
                return true;
            return input.signatures.every((signature) => {
                if (!signature)
                    return true;
                const hashType = signatureHashType(signature);
                // if SIGHASH_ANYONECANPAY is set, signatures would not
                // be invalidated by more inputs
                return (hashType & _8.Transaction.SIGHASH_ANYONECANPAY) !== 0;
            });
        });
    }
    __needsOutputs(signingHashType) {
        if (signingHashType === _8.Transaction.SIGHASH_ALL || signingHashType === _8.Transaction.SIGHASH_DEFAULT) {
            return this.__TX.outs.length === 0;
        }
        // if inputs are being signed with SIGHASH_NONE, we don't strictly need outputs
        // .build() will fail, but .buildIncomplete() is OK
        return (this.__TX.outs.length === 0 &&
            this.__INPUTS.some((input) => {
                if (!input.signatures)
                    return false;
                return input.signatures.some((signature) => {
                    if (!signature)
                        return false; // no signature, no issue
                    const hashType = signatureHashType(signature);
                    if (hashType & _8.Transaction.SIGHASH_NONE)
                        return false; // SIGHASH_NONE doesn't care about outputs
                    return true; // SIGHASH_* does care
                });
            }));
    }
    __canModifyOutputs() {
        const nInputs = this.__TX.ins.length;
        const nOutputs = this.__TX.outs.length;
        return this.__INPUTS.every((input) => {
            if (input.signatures === undefined)
                return true;
            return input.signatures.every((signature) => {
                if (!signature)
                    return true;
                const hashType = signatureHashType(signature);
                const hashTypeMod = hashType & 0x1f;
                if (hashTypeMod === _8.Transaction.SIGHASH_NONE)
                    return true;
                if (hashTypeMod === _8.Transaction.SIGHASH_SINGLE) {
                    // if SIGHASH_SINGLE is set, and nInputs > nOutputs
                    // some signatures would be invalidated by the addition
                    // of more outputs
                    return nInputs <= nOutputs;
                }
                return false;
            });
        });
    }
    __overMaximumFees(bytes) {
        // not all inputs will have .value defined
        const incoming = this.__INPUTS.reduce((a, x) => a + (typeof x.value !== 'undefined' ? BigInt(x.value) : BigInt(0)), BigInt(0));
        // but all outputs do, and if we have any input value
        // we can immediately determine if the outputs are too small
        const outgoing = this.__TX.outs.reduce((a, x) => a + BigInt(x.value), BigInt(0));
        const fee = incoming - outgoing;
        const feeRate = Number(fee) / bytes; // assume fee fits within number
        return feeRate > this.maximumFeeRate;
    }
}
exports.TransactionBuilder = TransactionBuilder;
function expandInput(scriptSig, witnessStack = [], type, scriptPubKey) {
    if (scriptSig && scriptSig.length === 0 && witnessStack.length === 0)
        return {};
    if (!type) {
        let ssType = scriptSig ? classify.input(scriptSig, true) : undefined;
        let wsType = classify.witness(witnessStack, true);
        if (ssType === SCRIPT_TYPES.NONSTANDARD)
            ssType = undefined;
        if (wsType === SCRIPT_TYPES.NONSTANDARD)
            wsType = undefined;
        type = ssType || wsType;
    }
    switch (type) {
        case SCRIPT_TYPES.P2WPKH: {
            const { output, pubkey, signature } = _4.payments.p2wpkh({
                witness: witnessStack,
            });
            return {
                prevOutScript: output,
                prevOutType: SCRIPT_TYPES.P2WPKH,
                pubkeys: [pubkey],
                signatures: [signature],
            };
        }
        case SCRIPT_TYPES.P2PKH: {
            const { output, pubkey, signature } = _4.payments.p2pkh({
                input: scriptSig,
            });
            return {
                prevOutScript: output,
                prevOutType: SCRIPT_TYPES.P2PKH,
                pubkeys: [pubkey],
                signatures: [signature],
            };
        }
        case SCRIPT_TYPES.P2PK: {
            const { signature } = _4.payments.p2pk({ input: scriptSig });
            return {
                prevOutType: SCRIPT_TYPES.P2PK,
                pubkeys: [undefined],
                signatures: [signature],
            };
        }
        case SCRIPT_TYPES.P2MS: {
            const { m, pubkeys, signatures } = _4.payments.p2ms({
                input: scriptSig,
                output: scriptPubKey,
            }, { allowIncomplete: true });
            return {
                prevOutType: SCRIPT_TYPES.P2MS,
                pubkeys,
                signatures,
                maxSignatures: m,
            };
        }
        case SCRIPT_TYPES.P2TR_NS: {
            const { n, pubkeys, signatures } = _1.p2trPayments.p2tr_ns({
                // Witness signatures are reverse of pubkeys, because it's a stack
                signatures: witnessStack.length ? witnessStack.reverse() : undefined,
                output: scriptPubKey,
            }, { allowIncomplete: true, eccLib: noble_ecc_1.ecc });
            return {
                prevOutType: SCRIPT_TYPES.P2TR_NS,
                pubkeys,
                signatures,
                maxSignatures: n,
            };
        }
    }
    if (type === SCRIPT_TYPES.P2SH) {
        const { output, redeem } = _4.payments.p2sh({
            input: scriptSig,
            witness: witnessStack,
        });
        const outputType = classify.output(redeem.output);
        const expanded = expandInput(redeem.input, redeem.witness, outputType, redeem.output);
        if (!expanded.prevOutType)
            return {};
        return {
            prevOutScript: output,
            prevOutType: SCRIPT_TYPES.P2SH,
            redeemScript: redeem.output,
            redeemScriptType: expanded.prevOutType,
            witnessScript: expanded.witnessScript,
            witnessScriptType: expanded.witnessScriptType,
            pubkeys: expanded.pubkeys,
            signatures: expanded.signatures,
        };
    }
    if (type === SCRIPT_TYPES.P2WSH) {
        const { output, redeem } = _4.payments.p2wsh({
            input: scriptSig,
            witness: witnessStack,
        });
        const outputType = classify.output(redeem.output);
        let expanded;
        if (outputType === SCRIPT_TYPES.P2WPKH) {
            expanded = expandInput(redeem.input, redeem.witness, outputType);
        }
        else {
            expanded = expandInput(_5.script.compile(redeem.witness), [], outputType, redeem.output);
        }
        if (!expanded.prevOutType)
            return {};
        return {
            prevOutScript: output,
            prevOutType: SCRIPT_TYPES.P2WSH,
            witnessScript: redeem.output,
            witnessScriptType: expanded.prevOutType,
            pubkeys: expanded.pubkeys,
            signatures: expanded.signatures,
        };
    }
    if (type === SCRIPT_TYPES.P2TR) {
        const parsedWitness = _7.taproot.parseTaprootWitness(witnessStack);
        if (parsedWitness.spendType === 'Key') {
            // key path spend, nothing to expand
            const { signature, annex } = parsedWitness;
            return {
                prevOutType: SCRIPT_TYPES.P2TR,
                signatures: [signature],
                annex,
            };
        }
        else {
            // script path spend
            const { tapscript, controlBlock, annex } = parsedWitness;
            const prevOutScript = _1.p2trPayments.p2tr({
                redeems: [{ output: tapscript }],
                redeemIndex: 0,
                controlBlock,
                annex,
            }, { eccLib: noble_ecc_1.ecc }).output;
            const witnessScriptType = classify.output(tapscript);
            const { pubkeys, signatures } = expandInput(undefined, parsedWitness.scriptSig, witnessScriptType, tapscript);
            return {
                prevOutScript,
                prevOutType: SCRIPT_TYPES.P2TR,
                witnessScript: tapscript,
                witnessScriptType,
                controlBlock,
                annex,
                pubkeys,
                signatures,
            };
        }
    }
    return {
        prevOutType: SCRIPT_TYPES.NONSTANDARD,
        prevOutScript: scriptSig,
    };
}
// could be done in expandInput, but requires the original Transaction for hashForSignature
function fixMultisigOrder(input, transaction, vin, prevOutputs) {
    if (input.redeemScriptType !== SCRIPT_TYPES.P2MS || !input.redeemScript)
        return;
    if (input.pubkeys.length === input.signatures.length)
        return;
    const prevOutput = prevOutputs && prevOutputs[vin];
    const unmatched = input.signatures.concat();
    input.signatures = input.pubkeys.map((pubKey) => {
        const keyPair = noble_ecc_1.ECPair.fromPublicKey(pubKey);
        let match;
        // check for a signature
        unmatched.some((signature, i) => {
            // skip if undefined || OP_0
            if (!signature)
                return false;
            // TODO: avoid O(n) hashForSignature
            const parsed = _5.script.signature.decode(signature);
            const hash = transaction.hashForSignature(vin, input.redeemScript, parsed.hashType, prevOutput === null || prevOutput === void 0 ? void 0 : prevOutput.value);
            // skip if signature does not match pubKey
            if (!keyPair.verify(hash, parsed.signature))
                return false;
            // remove matched signature from unmatched
            unmatched[i] = undefined;
            match = signature;
            return true;
        });
        return match;
    });
}
function expandOutput(script, ourPubKey, controlBlock) {
    typeforce(types.Buffer, script);
    const type = classify.output(script);
    switch (type) {
        case SCRIPT_TYPES.P2PKH: {
            if (!ourPubKey)
                return { type };
            // does our hash160(pubKey) match the output scripts?
            const pkh1 = _4.payments.p2pkh({ output: script }).hash;
            const pkh2 = _2.crypto.hash160(ourPubKey);
            if (!pkh1.equals(pkh2))
                return { type };
            return {
                type,
                pubkeys: [ourPubKey],
                signatures: [undefined],
            };
        }
        case SCRIPT_TYPES.P2WPKH: {
            if (!ourPubKey)
                return { type };
            // does our hash160(pubKey) match the output scripts?
            const wpkh1 = _4.payments.p2wpkh({ output: script }).hash;
            const wpkh2 = _2.crypto.hash160(ourPubKey);
            if (!wpkh1.equals(wpkh2))
                return { type };
            return {
                type,
                pubkeys: [ourPubKey],
                signatures: [undefined],
            };
        }
        case SCRIPT_TYPES.P2TR: {
            if (!ourPubKey)
                return { type };
            // HACK ourPubKey to BIP340-style
            if (ourPubKey.length === 33)
                ourPubKey = ourPubKey.slice(1);
            // TODO: support multiple pubkeys
            const p2tr = _1.p2trPayments.p2tr({ pubkey: ourPubKey, controlBlock }, { eccLib: noble_ecc_1.ecc });
            // Does tweaked output for a single pubkey match?
            if (!script.equals(p2tr.output))
                return { type };
            // P2TR KeyPath, single key
            return {
                type,
                pubkeys: [ourPubKey],
                signatures: [undefined],
            };
        }
        case SCRIPT_TYPES.P2TR_NS: {
            const p2trNs = _1.p2trPayments.p2tr_ns({ output: script }, { eccLib: noble_ecc_1.ecc });
            // P2TR ScriptPath
            return {
                type,
                pubkeys: p2trNs.pubkeys,
                signatures: p2trNs.pubkeys.map(() => undefined),
                maxSignatures: p2trNs.pubkeys.length,
            };
        }
        case SCRIPT_TYPES.P2PK: {
            const p2pk = _4.payments.p2pk({ output: script });
            return {
                type,
                pubkeys: [p2pk.pubkey],
                signatures: [undefined],
            };
        }
        case SCRIPT_TYPES.P2MS: {
            const p2ms = _4.payments.p2ms({ output: script });
            return {
                type,
                pubkeys: p2ms.pubkeys,
                signatures: p2ms.pubkeys.map(() => undefined),
                maxSignatures: p2ms.m,
            };
        }
    }
    return { type };
}
function prepareInput(input, ourPubKey, redeemScript, witnessScript, controlBlock, annex) {
    if (redeemScript && witnessScript) {
        const p2wsh = _4.payments.p2wsh({
            redeem: { output: witnessScript },
        });
        const p2wshAlt = _4.payments.p2wsh({ output: redeemScript });
        const p2sh = _4.payments.p2sh({ redeem: { output: redeemScript } });
        const p2shAlt = _4.payments.p2sh({ redeem: p2wsh });
        // enforces P2SH(P2WSH(...))
        if (!p2wsh.hash.equals(p2wshAlt.hash))
            throw new Error('Witness script inconsistent with prevOutScript');
        if (!p2sh.hash.equals(p2shAlt.hash))
            throw new Error('Redeem script inconsistent with prevOutScript');
        const expanded = expandOutput(p2wsh.redeem.output, ourPubKey);
        if (!expanded.pubkeys) {
            throw new Error(expanded.type + ' not supported as witnessScript (' + _5.script.toASM(witnessScript) + ')');
        }
        if (input.signatures && input.signatures.some((x) => x !== undefined)) {
            expanded.signatures = input.signatures;
        }
        const signScript = witnessScript;
        if (expanded.type === SCRIPT_TYPES.P2WPKH)
            throw new Error('P2SH(P2WSH(P2WPKH)) is a consensus failure');
        return {
            redeemScript,
            redeemScriptType: SCRIPT_TYPES.P2WSH,
            witnessScript,
            witnessScriptType: expanded.type,
            prevOutType: SCRIPT_TYPES.P2SH,
            prevOutScript: p2sh.output,
            witnessVersion: 0,
            signScript,
            signType: expanded.type,
            pubkeys: expanded.pubkeys,
            signatures: expanded.signatures,
            maxSignatures: expanded.maxSignatures,
        };
    }
    if (redeemScript) {
        const p2sh = _4.payments.p2sh({ redeem: { output: redeemScript } });
        if (input.prevOutScript) {
            let p2shAlt;
            try {
                p2shAlt = _4.payments.p2sh({ output: input.prevOutScript });
            }
            catch (e) {
                throw new Error('PrevOutScript must be P2SH');
            }
            if (!p2sh.hash.equals(p2shAlt.hash))
                throw new Error('Redeem script inconsistent with prevOutScript');
        }
        const expanded = expandOutput(p2sh.redeem.output, ourPubKey);
        if (!expanded.pubkeys) {
            throw new Error(expanded.type + ' not supported as redeemScript (' + _5.script.toASM(redeemScript) + ')');
        }
        if (input.signatures && input.signatures.some((x) => x !== undefined)) {
            expanded.signatures = input.signatures;
        }
        let signScript = redeemScript;
        if (expanded.type === SCRIPT_TYPES.P2WPKH) {
            signScript = _4.payments.p2pkh({ pubkey: expanded.pubkeys[0] }).output;
        }
        return {
            redeemScript,
            redeemScriptType: expanded.type,
            prevOutType: SCRIPT_TYPES.P2SH,
            prevOutScript: p2sh.output,
            witnessVersion: expanded.type === SCRIPT_TYPES.P2WPKH ? 0 : undefined,
            signScript,
            signType: expanded.type,
            pubkeys: expanded.pubkeys,
            signatures: expanded.signatures,
            maxSignatures: expanded.maxSignatures,
        };
    }
    if (witnessScript && controlBlock) {
        // P2TR ScriptPath
        /* tslint:disable-next-line:no-shadowed-variable */
        let prevOutScript = input.prevOutScript;
        if (!prevOutScript) {
            prevOutScript = _1.p2trPayments.p2tr({
                redeems: [{ output: witnessScript }],
                redeemIndex: 0,
                controlBlock,
                annex,
            }, { eccLib: noble_ecc_1.ecc }).output;
        }
        const expanded = expandOutput(witnessScript, ourPubKey);
        if (!expanded.pubkeys) {
            throw new Error(expanded.type + ' not supported as witnessScript (' + _5.script.toASM(witnessScript) + ')');
        }
        if (input.signatures && input.signatures.some((x) => x !== undefined)) {
            expanded.signatures = input.signatures;
        }
        return {
            witnessScript,
            witnessScriptType: expanded.type,
            prevOutType: SCRIPT_TYPES.P2TR,
            prevOutScript,
            witnessVersion: 1,
            signScript: witnessScript,
            signType: expanded.type,
            pubkeys: expanded.pubkeys,
            signatures: expanded.signatures,
            maxSignatures: expanded.maxSignatures,
            controlBlock,
            annex,
        };
    }
    if (witnessScript) {
        const p2wsh = _4.payments.p2wsh({ redeem: { output: witnessScript } });
        if (input.prevOutScript) {
            const p2wshAlt = _4.payments.p2wsh({ output: input.prevOutScript });
            if (!p2wsh.hash.equals(p2wshAlt.hash))
                throw new Error('Witness script inconsistent with prevOutScript');
        }
        const expanded = expandOutput(p2wsh.redeem.output, ourPubKey);
        if (!expanded.pubkeys) {
            throw new Error(expanded.type + ' not supported as witnessScript (' + _5.script.toASM(witnessScript) + ')');
        }
        if (input.signatures && input.signatures.some((x) => x !== undefined)) {
            expanded.signatures = input.signatures;
        }
        const signScript = witnessScript;
        if (expanded.type === SCRIPT_TYPES.P2WPKH)
            throw new Error('P2WSH(P2WPKH) is a consensus failure');
        return {
            witnessScript,
            witnessScriptType: expanded.type,
            prevOutType: SCRIPT_TYPES.P2WSH,
            prevOutScript: p2wsh.output,
            witnessVersion: 0,
            signScript,
            signType: expanded.type,
            pubkeys: expanded.pubkeys,
            signatures: expanded.signatures,
            maxSignatures: expanded.maxSignatures,
        };
    }
    if (input.prevOutType && input.prevOutScript) {
        // embedded scripts are not possible without extra information
        if (input.prevOutType === SCRIPT_TYPES.P2SH) {
            throw new Error('PrevOutScript is ' + input.prevOutType + ', requires redeemScript');
        }
        if (input.prevOutType === SCRIPT_TYPES.P2WSH) {
            throw new Error('PrevOutScript is ' + input.prevOutType + ', requires witnessScript');
        }
        const expanded = expandOutput(input.prevOutScript, ourPubKey);
        if (!expanded.pubkeys) {
            throw new Error(expanded.type + ' not supported (' + _5.script.toASM(input.prevOutScript) + ')');
        }
        if (input.signatures && input.signatures.some((x) => x !== undefined)) {
            expanded.signatures = input.signatures;
        }
        let signScript = input.prevOutScript;
        if (expanded.type === SCRIPT_TYPES.P2WPKH) {
            signScript = _4.payments.p2pkh({ pubkey: expanded.pubkeys[0] }).output;
        }
        let witnessVersion;
        if (expanded.type === SCRIPT_TYPES.P2WPKH) {
            witnessVersion = 0;
        }
        else if (expanded.type === SCRIPT_TYPES.P2TR) {
            witnessVersion = 1;
        }
        return {
            prevOutType: expanded.type,
            prevOutScript: input.prevOutScript,
            witnessVersion,
            signScript,
            signType: expanded.type,
            pubkeys: expanded.pubkeys,
            signatures: expanded.signatures,
            maxSignatures: expanded.maxSignatures,
        };
    }
    const prevOutScript = _4.payments.p2pkh({ pubkey: ourPubKey }).output;
    return {
        prevOutType: SCRIPT_TYPES.P2PKH,
        prevOutScript,
        signScript: prevOutScript,
        signType: SCRIPT_TYPES.P2PKH,
        pubkeys: [ourPubKey],
        signatures: [undefined],
    };
}
function build(type, input, allowIncomplete) {
    const pubkeys = (input.pubkeys || []);
    let signatures = (input.signatures || []);
    switch (type) {
        case SCRIPT_TYPES.P2PKH: {
            if (pubkeys.length === 0)
                break;
            if (signatures.length === 0)
                break;
            return _4.payments.p2pkh({ pubkey: pubkeys[0], signature: signatures[0] });
        }
        case SCRIPT_TYPES.P2WPKH: {
            if (pubkeys.length === 0)
                break;
            if (signatures.length === 0)
                break;
            return _4.payments.p2wpkh({ pubkey: pubkeys[0], signature: signatures[0] });
        }
        case SCRIPT_TYPES.P2PK: {
            if (pubkeys.length === 0)
                break;
            if (signatures.length === 0)
                break;
            return _4.payments.p2pk({ signature: signatures[0] });
        }
        case SCRIPT_TYPES.P2MS: {
            const m = input.maxSignatures;
            if (allowIncomplete) {
                signatures = signatures.map((x) => x || _6.opcodes.OP_0);
            }
            else {
                signatures = signatures.filter((x) => x);
            }
            // if the transaction is not not complete (complete), or if signatures.length === m, validate
            // otherwise, the number of OP_0's may be >= m, so don't validate (boo)
            const validate = !allowIncomplete || m === signatures.length;
            return _4.payments.p2ms({ m, pubkeys, signatures }, { allowIncomplete, validate });
        }
        case SCRIPT_TYPES.P2SH: {
            const redeem = build(input.redeemScriptType, input, allowIncomplete);
            if (!redeem)
                return;
            return _4.payments.p2sh({
                redeem: {
                    output: redeem.output || input.redeemScript,
                    input: redeem.input,
                    witness: redeem.witness,
                },
            });
        }
        case SCRIPT_TYPES.P2WSH: {
            const redeem = build(input.witnessScriptType, input, allowIncomplete);
            if (!redeem)
                return;
            return _4.payments.p2wsh({
                redeem: {
                    output: input.witnessScript,
                    input: redeem.input,
                    witness: redeem.witness,
                },
            });
        }
        case SCRIPT_TYPES.P2TR: {
            if (input.witnessScriptType === SCRIPT_TYPES.P2TR_NS) {
                // ScriptPath
                const redeem = build(input.witnessScriptType, input, allowIncomplete);
                return _1.p2trPayments.p2tr({
                    output: input.prevOutScript,
                    controlBlock: input.controlBlock,
                    annex: input.annex,
                    redeems: [redeem],
                    redeemIndex: 0,
                }, { eccLib: noble_ecc_1.ecc });
            }
            // KeyPath
            if (signatures.length === 0)
                break;
            return _1.p2trPayments.p2tr({ pubkeys, signature: signatures[0] }, { eccLib: noble_ecc_1.ecc });
        }
        case SCRIPT_TYPES.P2TR_NS: {
            const m = input.maxSignatures;
            if (allowIncomplete) {
                signatures = signatures.map((x) => x || _6.opcodes.OP_0);
            }
            else {
                signatures = signatures.filter((x) => x);
            }
            // if the transaction is not not complete (complete), or if signatures.length === m, validate
            // otherwise, the number of OP_0's may be >= m, so don't validate (boo)
            const validate = !allowIncomplete || m === signatures.length;
            return _1.p2trPayments.p2tr_ns({ pubkeys, signatures }, { allowIncomplete, validate, eccLib: noble_ecc_1.ecc });
        }
    }
}
function canSign(input) {
    return (input.signScript !== undefined &&
        input.signType !== undefined &&
        input.pubkeys !== undefined &&
        input.signatures !== undefined &&
        input.signatures.length === input.pubkeys.length &&
        input.pubkeys.length > 0 &&
        (input.witnessVersion === undefined || input.value !== undefined));
}
function signatureHashType(buffer) {
    if (_5.script.isCanonicalSchnorrSignature(buffer) && buffer.length === 64) {
        return _8.Transaction.SIGHASH_DEFAULT;
    }
    return buffer.readUInt8(buffer.length - 1);
}
function checkSignArgs(inputs, signParams) {
    if (!PREVOUT_TYPES.has(signParams.prevOutScriptType)) {
        throw new TypeError(`Unknown prevOutScriptType "${signParams.prevOutScriptType}"`);
    }
    tfMessage(typeforce.Number, signParams.vin, `sign must include vin parameter as Number (input index)`);
    tfMessage(tfFullSigner, signParams.keyPair, `sign must include keyPair parameter as Signer interface`);
    tfMessage(typeforce.maybe(typeforce.Number), signParams.hashType, `sign hashType parameter must be a number`);
    const prevOutType = (inputs[signParams.vin] || []).prevOutType;
    const posType = signParams.prevOutScriptType;
    switch (posType) {
        case 'p2pkh':
            if (prevOutType && prevOutType !== 'pubkeyhash') {
                throw new TypeError(`input #${signParams.vin} is not of type p2pkh: ${prevOutType}`);
            }
            tfMessage(typeforce.value(undefined), signParams.witnessScript, `${posType} requires NO witnessScript`);
            tfMessage(typeforce.value(undefined), signParams.redeemScript, `${posType} requires NO redeemScript`);
            tfMessage(typeforce.value(undefined), signParams.witnessValue, `${posType} requires NO witnessValue`);
            break;
        case 'p2pk':
            if (prevOutType && prevOutType !== 'pubkey') {
                throw new TypeError(`input #${signParams.vin} is not of type p2pk: ${prevOutType}`);
            }
            tfMessage(typeforce.value(undefined), signParams.witnessScript, `${posType} requires NO witnessScript`);
            tfMessage(typeforce.value(undefined), signParams.redeemScript, `${posType} requires NO redeemScript`);
            tfMessage(typeforce.value(undefined), signParams.witnessValue, `${posType} requires NO witnessValue`);
            break;
        case 'p2wpkh':
            if (prevOutType && prevOutType !== 'witnesspubkeyhash') {
                throw new TypeError(`input #${signParams.vin} is not of type p2wpkh: ${prevOutType}`);
            }
            tfMessage(typeforce.value(undefined), signParams.witnessScript, `${posType} requires NO witnessScript`);
            tfMessage(typeforce.value(undefined), signParams.redeemScript, `${posType} requires NO redeemScript`);
            tfMessage(types.Satoshi, signParams.witnessValue, `${posType} requires witnessValue`);
            break;
        case 'p2ms':
            if (prevOutType && prevOutType !== 'multisig') {
                throw new TypeError(`input #${signParams.vin} is not of type p2ms: ${prevOutType}`);
            }
            tfMessage(typeforce.value(undefined), signParams.witnessScript, `${posType} requires NO witnessScript`);
            tfMessage(typeforce.value(undefined), signParams.redeemScript, `${posType} requires NO redeemScript`);
            tfMessage(typeforce.value(undefined), signParams.witnessValue, `${posType} requires NO witnessValue`);
            break;
        case 'p2sh-p2wpkh':
            if (prevOutType && prevOutType !== 'scripthash') {
                throw new TypeError(`input #${signParams.vin} is not of type p2sh-p2wpkh: ${prevOutType}`);
            }
            tfMessage(typeforce.value(undefined), signParams.witnessScript, `${posType} requires NO witnessScript`);
            tfMessage(typeforce.Buffer, signParams.redeemScript, `${posType} requires redeemScript`);
            tfMessage(types.Satoshi, signParams.witnessValue, `${posType} requires witnessValue`);
            break;
        case 'p2sh-p2ms':
        case 'p2sh-p2pk':
        case 'p2sh-p2pkh':
            if (prevOutType && prevOutType !== 'scripthash') {
                throw new TypeError(`input #${signParams.vin} is not of type ${posType}: ${prevOutType}`);
            }
            tfMessage(typeforce.value(undefined), signParams.witnessScript, `${posType} requires NO witnessScript`);
            tfMessage(typeforce.Buffer, signParams.redeemScript, `${posType} requires redeemScript`);
            tfMessage(typeforce.value(undefined), signParams.witnessValue, `${posType} requires NO witnessValue`);
            break;
        case 'p2wsh-p2ms':
        case 'p2wsh-p2pk':
        case 'p2wsh-p2pkh':
            if (prevOutType && prevOutType !== 'witnessscripthash') {
                throw new TypeError(`input #${signParams.vin} is not of type ${posType}: ${prevOutType}`);
            }
            tfMessage(typeforce.Buffer, signParams.witnessScript, `${posType} requires witnessScript`);
            tfMessage(typeforce.value(undefined), signParams.redeemScript, `${posType} requires NO redeemScript`);
            tfMessage(types.Satoshi, signParams.witnessValue, `${posType} requires witnessValue`);
            break;
        case 'p2sh-p2wsh-p2ms':
        case 'p2sh-p2wsh-p2pk':
        case 'p2sh-p2wsh-p2pkh':
            if (prevOutType && prevOutType !== 'scripthash') {
                throw new TypeError(`input #${signParams.vin} is not of type ${posType}: ${prevOutType}`);
            }
            tfMessage(typeforce.Buffer, signParams.witnessScript, `${posType} requires witnessScript`);
            tfMessage(typeforce.Buffer, signParams.redeemScript, `${posType} requires witnessScript`);
            tfMessage(types.Satoshi, signParams.witnessValue, `${posType} requires witnessScript`);
            break;
        case 'p2tr':
            if (prevOutType && prevOutType !== 'taproot') {
                throw new TypeError(`input #${signParams.vin} is not of type ${posType}: ${prevOutType}`);
            }
            tfMessage(typeforce.value(undefined), signParams.witnessScript, `${posType} requires NO witnessScript`);
            tfMessage(typeforce.value(undefined), signParams.redeemScript, `${posType} requires NO redeemScript`);
            tfMessage(typeforce.value(undefined), signParams.witnessValue, `${posType} requires NO witnessValue`);
            break;
        case 'p2tr-p2ns':
            if (prevOutType && prevOutType !== 'taproot') {
                throw new TypeError(`input #${signParams.vin} is not of type ${posType}: ${prevOutType}`);
            }
            inputs[signParams.vin].prevOutType = inputs[signParams.vin].prevOutType || 'taproot';
            tfMessage(typeforce.Buffer, signParams.witnessScript, `${posType} requires witnessScript`);
            tfMessage(typeforce.Buffer, signParams.controlBlock, `${posType} requires controlBlock`);
            tfMessage(typeforce.value(undefined), signParams.redeemScript, `${posType} requires NO redeemScript`);
            break;
    }
}
function trySign({ input, ourPubKey, keyPair, signatureHash, hashType, useLowR, taptreeRoot, }) {
    if (input.witnessVersion === 1 && ourPubKey.length === 33)
        ourPubKey = ourPubKey.slice(1);
    // enforce in order signing of public keys
    let signed = false;
    for (const [i, pubKey] of input.pubkeys.entries()) {
        if (!ourPubKey.equals(pubKey))
            continue;
        if (input.signatures[i] && input.signatures[i].length > 0)
            throw new Error('Signature already exists');
        // TODO: add tests
        if (ourPubKey.length !== 33 && input.witnessVersion === 0) {
            throw new Error('BIP143 (Witness v0) inputs require compressed pubkeys');
        }
        else if (ourPubKey.length !== 32 && input.witnessVersion === 1) {
            throw new Error('BIP341 (Witness v1) inputs require x-only pubkeys');
        }
        if (input.witnessVersion === 1) {
            if (!input.witnessScript) {
                // FIXME: Workaround for not having proper tweaking support for key path
                if (!keyPair.privateKey) {
                    throw new Error(`unexpected keypair`);
                }
                const privateKey = _7.taproot.tapTweakPrivkey(noble_ecc_1.ecc, ourPubKey, keyPair.privateKey, taptreeRoot);
                keyPair = noble_ecc_1.ECPair.fromPrivateKey(Buffer.from(privateKey));
            }
            // https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki#common-signature-message
            const signature = keyPair.signSchnorr(signatureHash);
            // SIGHASH_DEFAULT is omitted from the signature
            if (hashType === _8.Transaction.SIGHASH_DEFAULT) {
                input.signatures[i] = Buffer.from(signature);
            }
            else {
                input.signatures[i] = Buffer.concat([signature, Buffer.of(hashType)]);
            }
        }
        else {
            const signature = keyPair.sign(signatureHash, useLowR);
            input.signatures[i] = _5.script.signature.encode(signature, hashType);
        }
        signed = true;
    }
    if (!signed)
        throw new Error('Key pair cannot sign for this input');
}
function getSigningData(network, inputs, needsOutputs, tx, signParams, keyPair, redeemScript, hashType, witnessValue, witnessScript, controlBlock, annex, useLowR) {
    let vin;
    if (typeof signParams === 'number') {
        console.warn('DEPRECATED: TransactionBuilder sign method arguments ' + 'will change in v6, please use the TxbSignArg interface');
        vin = signParams;
    }
    else if (typeof signParams === 'object') {
        checkSignArgs(inputs, signParams);
        ({ vin, keyPair, redeemScript, hashType, witnessValue, witnessScript, controlBlock, annex } = signParams);
    }
    else {
        throw new TypeError('TransactionBuilder sign first arg must be TxbSignArg or number');
    }
    if (keyPair === undefined) {
        throw new Error('sign requires keypair');
    }
    if (!inputs[vin])
        throw new Error('No input at index: ' + vin);
    const input = inputs[vin];
    // if redeemScript was previously provided, enforce consistency
    if (input.redeemScript !== undefined && redeemScript && !input.redeemScript.equals(redeemScript)) {
        throw new Error('Inconsistent redeemScript');
    }
    const ourPubKey = keyPair.publicKey || (keyPair.getPublicKey && keyPair.getPublicKey());
    if (!canSign(input)) {
        if (witnessValue !== undefined) {
            if (input.value !== undefined && input.value !== witnessValue) {
                throw new Error('Input did not match witnessValue');
            }
            typeforce(types.Satoshi, witnessValue);
            input.value = witnessValue;
        }
        if (!canSign(input)) {
            const prepared = prepareInput(input, ourPubKey, redeemScript, witnessScript, controlBlock, annex);
            // updates inline
            Object.assign(input, prepared);
        }
        if (!canSign(input))
            throw Error(input.prevOutType + ' not supported');
    }
    // hashType can be 0 in Taproot, so can't use hashType || SIGHASH_ALL
    if (input.witnessVersion === 1) {
        hashType = hashType === undefined ? _8.Transaction.SIGHASH_DEFAULT : hashType;
    }
    else {
        hashType = hashType || _8.Transaction.SIGHASH_ALL;
    }
    if (needsOutputs(hashType))
        throw new Error('Transaction needs outputs');
    // TODO: This is not the best place to do this, but might stick with it until PSBT
    let leafHash;
    let taptreeRoot;
    if (controlBlock && witnessScript) {
        leafHash = _7.taproot.getTapleafHash(noble_ecc_1.ecc, controlBlock, witnessScript);
        taptreeRoot = _7.taproot.getTaptreeRoot(noble_ecc_1.ecc, controlBlock, witnessScript, leafHash);
    }
    // ready to sign
    let signatureHash;
    switch (input.witnessVersion) {
        case undefined:
            signatureHash = tx.hashForSignature(vin, input.signScript, hashType, input.value);
            break;
        case 0:
            signatureHash = tx.hashForWitnessV0(vin, input.signScript, input.value, hashType);
            break;
        case 1:
            signatureHash = tx.hashForWitnessV1(vin, inputs.map(({ prevOutScript }) => prevOutScript), inputs.map(({ value }) => value), hashType, leafHash);
            break;
        default:
            throw new TypeError('Unsupported witness version');
    }
    return {
        input,
        ourPubKey,
        keyPair,
        signatureHash,
        hashType,
        useLowR: !!useLowR,
        taptreeRoot,
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhbnNhY3Rpb25fYnVpbGRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy90cmFuc2FjdGlvbl9idWlsZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLGlEQUFpRDtBQUNqRCx5QkFBdUQ7QUFDdkQsNkRBQTZEO0FBQzdELHVDQUF1QztBQUN2Qyx5QkFBdUM7QUFDdkMseUJBQThCO0FBRTlCLHlCQUE4QjtBQUU5Qix5QkFBdUM7QUFDdkMseUJBQW9DO0FBQ3BDLHlCQUE2QjtBQUM3Qix5QkFBMkM7QUFDM0MsMkNBQW9EO0FBVXBELE1BQU0sU0FBUyxHQUFHLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUV2QyxNQUFNLFlBQVksR0FBRyxDQUFDLEdBQVEsRUFBVyxFQUFFO0lBQ3pDLE9BQU8sU0FBUyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxHQUFHLENBQUMsSUFBSSxLQUFLLFVBQVUsSUFBSSxPQUFPLEdBQUcsQ0FBQyxXQUFXLEtBQUssVUFBVSxDQUFDO0FBQ3BILENBQUMsQ0FBQztBQUVGLE1BQU0sWUFBWSxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUM7QUFFcEMsTUFBTSxhQUFhLEdBQWdCLElBQUksR0FBRyxDQUFDO0lBQ3pDLE1BQU07SUFDTixPQUFPO0lBQ1AsTUFBTTtJQUNOLFFBQVE7SUFDUixNQUFNO0lBQ04sZUFBZTtJQUNmLFlBQVk7SUFDWixXQUFXO0lBQ1gsYUFBYTtJQUNiLFdBQVc7SUFDWCxnQkFBZ0I7SUFDaEIsYUFBYTtJQUNiLFlBQVk7SUFDWixZQUFZO0lBQ1oscUJBQXFCO0lBQ3JCLGtCQUFrQjtJQUNsQixpQkFBaUI7SUFDakIsaUJBQWlCO0lBQ2pCLGVBQWU7SUFDZixNQUFNO0lBQ04sa0JBQWtCO0lBQ2xCLFdBQVc7Q0FDWixDQUFDLENBQUM7QUFrREgsU0FBUyxTQUFTLENBQUMsSUFBUyxFQUFFLEtBQVUsRUFBRSxPQUFlO0lBQ3ZE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cnQgKiBhcyB0eXBlcyBmcm9tICdiaXRjb2luanMtbGliL3NyYy90eXBlcyc7XG5pbXBvcnQgeyBhZGRyZXNzIGFzIGJhZGRyZXNzLCBwMnRyUGF5bWVudHMgfSBmcm9tICcuLyc7XG5pbXBvcnQgKiBhcyBidWZmZXJ1dGlscyBmcm9tICdiaXRjb2luanMtbGliL3NyYy9idWZmZXJ1dGlscyc7XG5pbXBvcnQgKiBhcyBjbGFzc2lmeSBmcm9tICcuL2NsYXNzaWZ5JztcbmltcG9ydCB7IGNyeXB0byBhcyBiY3J5cHRvIH0gZnJvbSAnLi8nO1xuaW1wb3J0IHsgbmV0d29ya3MgfSBmcm9tICcuLyc7XG5pbXBvcnQgeyBOZXR3b3JrIH0gZnJvbSAnLi8nO1xuaW1wb3J0IHsgcGF5bWVudHMgfSBmcm9tICcuLyc7XG5pbXBvcnQgeyBQYXltZW50IH0gZnJvbSAnLi8nO1xuaW1wb3J0IHsgc2NyaXB0IGFzIGJzY3JpcHQgfSBmcm9tICcuLyc7XG5pbXBvcnQgeyBvcGNvZGVzIGFzIG9wcyB9IGZyb20gJy4vJztcbmltcG9ydCB7IHRhcHJvb3QgfSBmcm9tICcuLyc7XG5pbXBvcnQgeyBUeE91dHB1dCwgVHJhbnNhY3Rpb24gfSBmcm9tICcuLyc7XG5pbXBvcnQgeyBFQ1BhaXIsIGVjYyBhcyBlY2NMaWIgfSBmcm9tICcuL25vYmxlX2VjYyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2lnbmVyIHtcbiAgcHJpdmF0ZUtleT86IEJ1ZmZlcjtcbiAgcHVibGljS2V5OiBCdWZmZXI7XG4gIGdldFB1YmxpY0tleT8oKTogQnVmZmVyO1xuICBzaWduKGhhc2g6IEJ1ZmZlciwgbG93Uj86IGJvb2xlYW4pOiBCdWZmZXI7XG4gIHNpZ25TY2hub3JyKGhhc2g6IEJ1ZmZlcik6IEJ1ZmZlcjtcbn1cblxuY29uc3QgdHlwZWZvcmNlID0gcmVxdWlyZSgndHlwZWZvcmNlJyk7XG5cbmNvbnN0IHRmRnVsbFNpZ25lciA9IChvYmo6IGFueSk6IGJvb2xlYW4gPT4ge1xuICByZXR1cm4gdHlwZWZvcmNlLkJ1ZmZlcihvYmoucHVibGljS2V5KSAmJiB0eXBlb2Ygb2JqLnNpZ24gPT09ICdmdW5jdGlvbicgJiYgdHlwZW9mIG9iai5zaWduU2Nobm9yciA9PT0gJ2Z1bmN0aW9uJztcbn07XG5cbmNvbnN0IFNDUklQVF9UWVBFUyA9IGNsYXNzaWZ5LnR5cGVzO1xuXG5jb25zdCBQUkVWT1VUX1RZUEVTOiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoW1xuICAvLyBSYXdcbiAgJ3AycGtoJyxcbiAgJ3AycGsnLFxuICAncDJ3cGtoJyxcbiAgJ3AybXMnLFxuICAvLyBQMlNIIHdyYXBwZWRcbiAgJ3Ayc2gtcDJwa2gnLFxuICAncDJzaC1wMnBrJyxcbiAgJ3Ayc2gtcDJ3cGtoJyxcbiAgJ3Ayc2gtcDJtcycsXG4gIC8vIFAyV1NIIHdyYXBwZWRcbiAgJ3Ayd3NoLXAycGtoJyxcbiAgJ3Ayd3NoLXAycGsnLFxuICAncDJ3c2gtcDJtcycsXG4gIC8vIFAyU0gtUDJXU0ggd3JhcHBlclxuICAncDJzaC1wMndzaC1wMnBraCcsXG4gICdwMnNoLXAyd3NoLXAycGsnLFxuICAncDJzaC1wMndzaC1wMm1zJyxcbiAgLy8gUDJUUiBLZXlQYXRoXG4gICdwMnRyJyxcbiAgLy8gUDJUUiBTY3JpcHRQYXRoXG4gICdwMnRyLXAybnMnLFxuXSk7XG5cbnR5cGUgTWF5YmVCdWZmZXIgPSBCdWZmZXIgfCB1bmRlZmluZWQ7XG50eXBlIFR4YlNpZ25hdHVyZXMgPSBCdWZmZXJbXSB8IE1heWJlQnVmZmVyW107XG50eXBlIFR4YlB1YmtleXMgPSBNYXliZUJ1ZmZlcltdO1xudHlwZSBUeGJXaXRuZXNzID0gQnVmZmVyW107XG50eXBlIFR4YlNjcmlwdFR5cGUgPSBzdHJpbmc7XG50eXBlIFR4YlNjcmlwdCA9IEJ1ZmZlcjtcblxuaW50ZXJmYWNlIFR4YklucHV0PFROdW1iZXIgZXh0ZW5kcyBudW1iZXIgfCBiaWdpbnQgPSBudW1iZXI+IHtcbiAgdmFsdWU/OiBUTnVtYmVyO1xuICB3aXRuZXNzVmVyc2lvbj86IG51bWJlcjtcbiAgc2lnblNjcmlwdD86IFR4YlNjcmlwdDtcbiAgc2lnblR5cGU/OiBUeGJTY3JpcHRUeXBlO1xuICBwcmV2T3V0U2NyaXB0PzogVHhiU2NyaXB0O1xuICByZWRlZW1TY3JpcHQ/OiBUeGJTY3JpcHQ7XG4gIHJlZGVlbVNjcmlwdFR5cGU/OiBUeGJTY3JpcHRUeXBlO1xuICBwcmV2T3V0VHlwZT86IFR4YlNjcmlwdFR5cGU7XG4gIHB1YmtleXM/OiBUeGJQdWJrZXlzO1xuICBzaWduYXR1cmVzPzogVHhiU2lnbmF0dXJlcztcbiAgd2l0bmVzcz86IFR4YldpdG5lc3M7XG4gIHdpdG5lc3NTY3JpcHQ/OiBUeGJTY3JpcHQ7XG4gIHdpdG5lc3NTY3JpcHRUeXBlPzogVHhiU2NyaXB0VHlwZTtcbiAgY29udHJvbEJsb2NrPzogQnVmZmVyO1xuICBhbm5leD86IEJ1ZmZlcjtcbiAgc2NyaXB0PzogVHhiU2NyaXB0O1xuICBzZXF1ZW5jZT86IG51bWJlcjtcbiAgc2NyaXB0U2lnPzogVHhiU2NyaXB0O1xuICBtYXhTaWduYXR1cmVzPzogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgVHhiT3V0cHV0IHtcbiAgdHlwZTogc3RyaW5nO1xuICBwdWJrZXlzPzogVHhiUHVia2V5cztcbiAgc2lnbmF0dXJlcz86IFR4YlNpZ25hdHVyZXM7XG4gIG1heFNpZ25hdHVyZXM/OiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBUeGJTaWduQXJnPFROdW1iZXIgZXh0ZW5kcyBudW1iZXIgfCBiaWdpbnQgPSBudW1iZXI+IHtcbiAgcHJldk91dFNjcmlwdFR5cGU6IHN0cmluZztcbiAgdmluOiBudW1iZXI7XG4gIGtleVBhaXI6IFNpZ25lcjtcbiAgcmVkZWVtU2NyaXB0PzogQnVmZmVyO1xuICBoYXNoVHlwZT86IG51bWJlcjtcbiAgd2l0bmVzc1ZhbHVlPzogVE51bWJlcjtcbiAgd2l0bmVzc1NjcmlwdD86IEJ1ZmZlcjtcbiAgY29udHJvbEJsb2NrPzogQnVmZmVyO1xuICBhbm5leD86IEJ1ZmZlcjtcbn1cblxuZnVuY3Rpb24gdGZNZXNzYWdlKHR5cGU6IGFueSwgdmFsdWU6IGFueSwgbWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG4gIHRyeSB7XG4gICAgdHlwZWZvcmNlKHR5cGUsIHZhbHVlKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKG1lc3NhZ2UpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHR4SXNTdHJpbmc8VE51bWJlciBleHRlbmRzIG51bWJlciB8IGJpZ2ludCA9IG51bWJlcj4oXG4gIHR4OiBCdWZmZXIgfCBzdHJpbmcgfCBUcmFuc2FjdGlvbjxUTnVtYmVyPlxuKTogdHggaXMgc3RyaW5nIHtcbiAgcmV0dXJuIHR5cGVvZiB0eCA9PT0gJ3N0cmluZycgfHwgdHggaW5zdGFuY2VvZiBTdHJpbmc7XG59XG5cbmZ1bmN0aW9uIHR4SXNUcmFuc2FjdGlvbjxUTnVtYmVyIGV4dGVuZHMgbnVtYmVyIHwgYmlnaW50ID0gbnVtYmVyPihcbiAgdHg6IEJ1ZmZlciB8IHN0cmluZyB8IFRyYW5zYWN0aW9uPFROdW1iZXI+XG4pOiB0eCBpcyBUcmFuc2FjdGlvbjxUTnVtYmVyPiB7XG4gIHJldHVybiB0eCBpbnN0YW5jZW9mIFRyYW5zYWN0aW9uO1xufVxuXG5leHBvcnQgY2xhc3MgVHJhbnNhY3Rpb25CdWlsZGVyPFROdW1iZXIgZXh0ZW5kcyBudW1iZXIgfCBiaWdpbnQgPSBudW1iZXI+IHtcbiAgc3RhdGljIGZyb21UcmFuc2FjdGlvbjxUTnVtYmVyIGV4dGVuZHMgbnVtYmVyIHwgYmlnaW50ID0gbnVtYmVyPihcbiAgICB0cmFuc2FjdGlvbjogVHJhbnNhY3Rpb248VE51bWJlcj4sXG4gICAgbmV0d29yaz86IE5ldHdvcmssXG4gICAgcHJldk91dHB1dHM/OiBUeE91dHB1dDxUTnVtYmVyPltdXG4gICk6IFRyYW5zYWN0aW9uQnVpbGRlcjxUTnVtYmVyPiB7XG4gICAgY29uc3QgdHhiID0gbmV3IFRyYW5zYWN0aW9uQnVpbGRlcjxUTnVtYmVyPihuZXR3b3JrKTtcblxuICAgIC8vIENvcHkgdHJhbnNhY3Rpb24gZmllbGRzXG4gICAgdHhiLnNldFZlcnNpb24odHJhbnNhY3Rpb24udmVyc2lvbik7XG4gICAgdHhiLnNldExvY2tUaW1lKHRyYW5zYWN0aW9uLmxvY2t0aW1lKTtcblxuICAgIC8vIENvcHkgb3V0cHV0cyAoZG9uZSBmaXJzdCB0byBhdm9pZCBzaWduYXR1cmUgaW52YWxpZGF0aW9uKVxuICAgIHRyYW5zYWN0aW9uLm91dHMuZm9yRWFjaCgodHhPdXQpID0+IHtcbiAgICAgIHR4Yi5hZGRPdXRwdXQodHhPdXQuc2NyaXB0LCAodHhPdXQgYXMgVHhPdXRwdXQ8VE51bWJlcj4pLnZhbHVlKTtcbiAgICB9KTtcblxuICAgIC8vIENvcHkgaW5wdXRzXG4gICAgdHJhbnNhY3Rpb24uaW5zLmZvckVhY2goKHR4SW4pID0+IHtcbiAgICAgIHR4Yi5fX2FkZElucHV0VW5zYWZlKHR4SW4uaGFzaCwgdHhJbi5pbmRleCwge1xuICAgICAgICBzZXF1ZW5jZTogdHhJbi5zZXF1ZW5jZSxcbiAgICAgICAgc2NyaXB0OiB0eEluLnNjcmlwdCxcbiAgICAgICAgd2l0bmVzczogdHhJbi53aXRuZXNzLFxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICAvLyBmaXggc29tZSB0aGluZ3Mgbm90IHBvc3NpYmxlIHRocm91Z2ggdGhlIHB1YmxpYyBBUElcbiAgICB0eGIuX19JTlBVVFMuZm9yRWFjaCgoaW5wdXQsIGkpID0+IHtcbiAgICAgIGZpeE11bHRpc2lnT3JkZXI8VE51bWJlcj4oaW5wdXQsIHRyYW5zYWN0aW9uLCBpLCBwcmV2T3V0cHV0cyk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdHhiO1xuICB9XG5cbiAgcHJpdmF0ZSBfX1BSRVZfVFhfU0VUOiB7IFtpbmRleDogc3RyaW5nXTogYm9vbGVhbiB9O1xuICBwcml2YXRlIF9fSU5QVVRTOiBBcnJheTxUeGJJbnB1dDxUTnVtYmVyPj47XG4gIHByaXZhdGUgX19UWDogVHJhbnNhY3Rpb248VE51bWJlcj47XG4gIHByaXZhdGUgX19VU0VfTE9XX1I6IGJvb2xlYW47XG5cbiAgLy8gV0FSTklORzogbWF4aW11bUZlZVJhdGUgaXMgX19OT1RfXyB0byBiZSByZWxpZWQgb24sXG4gIC8vICAgICAgICAgIGl0J3MganVzdCBhbm90aGVyIHBvdGVudGlhbCBzYWZldHkgbWVjaGFuaXNtIChzYWZldHkgaW4tZGVwdGgpXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBuZXR3b3JrOiBOZXR3b3JrID0gbmV0d29ya3MuYml0Y29pbiwgcHVibGljIG1heGltdW1GZWVSYXRlOiBudW1iZXIgPSAyNTAwKSB7XG4gICAgdGhpcy5fX1BSRVZfVFhfU0VUID0ge307XG4gICAgdGhpcy5fX0lOUFVUUyA9IFtdO1xuICAgIHRoaXMuX19UWCA9IG5ldyBUcmFuc2FjdGlvbjxUTnVtYmVyPigpO1xuICAgIHRoaXMuX19UWC52ZXJzaW9uID0gMjtcbiAgICB0aGlzLl9fVVNFX0xPV19SID0gZmFsc2U7XG4gICAgY29uc29sZS53YXJuKFxuICAgICAgJ0RlcHJlY2F0aW9uIFdhcm5pbmc6IFRyYW5zYWN0aW9uQnVpbGRlciB3aWxsIGJlIHJlbW92ZWQgaW4gdGhlIGZ1dHVyZS4gJyArXG4gICAgICAgICcodjYueC54IG9yIGxhdGVyKSBQbGVhc2UgdXNlIHRoZSBQc2J0IGNsYXNzIGluc3RlYWQuIEV4YW1wbGVzIG9mIHVzYWdlICcgK1xuICAgICAgICAnYXJlIGF2YWlsYWJsZSBpbiB0aGUgdHJhbnNhY3Rpb25zLXBzYnQuanMgaW50ZWdyYXRpb24gdGVzdCBmaWxlIG9uIG91ciAnICtcbiAgICAgICAgJ0dpdGh1Yi4gQSBoaWdoIGxldmVsIGV4cGxhbmF0aW9uIGlzIGF2YWlsYWJsZSBpbiB0aGUgcHNidC50cyBhbmQgcHNidC5qcyAnICtcbiAgICAgICAgJ2ZpbGVzIGFzIHdlbGwuJ1xuICAgICk7XG4gIH1cblxuICBzZXRMb3dSKHNldHRpbmc/OiBib29sZWFuKTogYm9vbGVhbiB7XG4gICAgdHlwZWZvcmNlKHR5cGVmb3JjZS5tYXliZSh0eXBlZm9yY2UuQm9vbGVhbiksIHNldHRpbmcpO1xuICAgIGlmIChzZXR0aW5nID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHNldHRpbmcgPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLl9fVVNFX0xPV19SID0gc2V0dGluZztcbiAgICByZXR1cm4gc2V0dGluZztcbiAgfVxuXG4gIHNldExvY2tUaW1lKGxvY2t0aW1lOiBudW1iZXIpOiB2b2lkIHtcbiAgICB0eXBlZm9yY2UodHlwZXMuVUludDMyLCBsb2NrdGltZSk7XG5cbiAgICAvLyBpZiBhbnkgc2lnbmF0dXJlcyBleGlzdCwgdGhyb3dcbiAgICBpZiAoXG4gICAgICB0aGlzLl9fSU5QVVRTLnNvbWUoKGlucHV0KSA9PiB7XG4gICAgICAgIGlmICghaW5wdXQuc2lnbmF0dXJlcykgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIHJldHVybiBpbnB1dC5zaWduYXR1cmVzLnNvbWUoKHMpID0+IHMgIT09IHVuZGVmaW5lZCk7XG4gICAgICB9KVxuICAgICkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdObywgdGhpcyB3b3VsZCBpbnZhbGlkYXRlIHNpZ25hdHVyZXMnKTtcbiAgICB9XG5cbiAgICB0aGlzLl9fVFgubG9ja3RpbWUgPSBsb2NrdGltZTtcbiAgfVxuXG4gIHNldFZlcnNpb24odmVyc2lvbjogbnVtYmVyKTogdm9pZCB7XG4gICAgdHlwZWZvcmNlKHR5cGVzLlVJbnQzMiwgdmVyc2lvbik7XG5cbiAgICAvLyBYWFg6IHRoaXMgbWlnaHQgZXZlbnR1YWxseSBiZWNvbWUgbW9yZSBjb21wbGV4IGRlcGVuZGluZyBvbiB3aGF0IHRoZSB2ZXJzaW9ucyByZXByZXNlbnRcbiAgICB0aGlzLl9fVFgudmVyc2lvbiA9IHZlcnNpb247XG4gIH1cblxuICBhZGRJbnB1dChcbiAgICB0eEhhc2g6IEJ1ZmZlciB8IHN0cmluZyB8IFRyYW5zYWN0aW9uPFROdW1iZXI+LFxuICAgIHZvdXQ6IG51bWJlcixcbiAgICBzZXF1ZW5jZT86IG51bWJlcixcbiAgICBwcmV2T3V0U2NyaXB0PzogQnVmZmVyLFxuICAgIHZhbHVlPzogVE51bWJlclxuICApOiBudW1iZXIge1xuICAgIGlmICghdGhpcy5fX2Nhbk1vZGlmeUlucHV0cygpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vLCB0aGlzIHdvdWxkIGludmFsaWRhdGUgc2lnbmF0dXJlcycpO1xuICAgIH1cblxuICAgIC8vIGlzIGl0IGEgaGV4IHN0cmluZz9cbiAgICBpZiAodHhJc1N0cmluZyh0eEhhc2gpKSB7XG4gICAgICAvLyB0cmFuc2FjdGlvbiBoYXNocydzIGFyZSBkaXNwbGF5ZWQgaW4gcmV2ZXJzZSBvcmRlciwgdW4tcmV2ZXJzZSBpdFxuICAgICAgdHhIYXNoID0gYnVmZmVydXRpbHMucmV2ZXJzZUJ1ZmZlcihCdWZmZXIuZnJvbSh0eEhhc2gsICdoZXgnKSk7XG5cbiAgICAgIC8vIGlzIGl0IGEgVHJhbnNhY3Rpb24gb2JqZWN0P1xuICAgIH0gZWxzZSBpZiAodHhJc1RyYW5zYWN0aW9uKHR4SGFzaCkpIHtcbiAgICAgIGNvbnN0IHR4T3V0ID0gdHhIYXNoLm91dHNbdm91dF07XG4gICAgICBwcmV2T3V0U2NyaXB0ID0gdHhPdXQuc2NyaXB0O1xuICAgICAgdmFsdWUgPSAodHhPdXQgYXMgVHhPdXRwdXQ8VE51bWJlcj4pLnZhbHVlO1xuXG4gICAgICB0eEhhc2ggPSB0eEhhc2guZ2V0SGFzaChmYWxzZSkgYXMgQnVmZmVyO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLl9fYWRkSW5wdXRVbnNhZmUodHhIYXNoLCB2b3V0LCB7XG4gICAgICBzZXF1ZW5jZSxcbiAgICAgIHByZXZPdXRTY3JpcHQsXG4gICAgICB2YWx1ZSxcbiAgICB9KTtcbiAgfVxuXG4gIGFkZE91dHB1dChzY3JpcHRQdWJLZXk6IHN0cmluZyB8IEJ1ZmZlciwgdmFsdWU6IFROdW1iZXIpOiBudW1iZXIge1xuICAgIGlmICghdGhpcy5fX2Nhbk1vZGlmeU91dHB1dHMoKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdObywgdGhpcyB3b3VsZCBpbnZhbGlkYXRlIHNpZ25hdHVyZXMnKTtcbiAgICB9XG5cbiAgICAvLyBBdHRlbXB0IHRvIGdldCBhIHNjcmlwdCBpZiBpdCdzIGEgYmFzZTU4IG9yIGJlY2gzMiBhZGRyZXNzIHN0cmluZ1xuICAgIGlmICh0eXBlb2Ygc2NyaXB0UHViS2V5ID09PSAnc3RyaW5nJykge1xuICAgICAgc2NyaXB0UHViS2V5ID0gYmFkZHJlc3MudG9PdXRwdXRTY3JpcHQoc2NyaXB0UHViS2V5LCB0aGlzLm5ldHdvcmspO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLl9fVFguYWRkT3V0cHV0KHNjcmlwdFB1YktleSwgdmFsdWUpO1xuICB9XG5cbiAgYnVpbGQoKTogVHJhbnNhY3Rpb248VE51bWJlcj4ge1xuICAgIHJldHVybiB0aGlzLl9fYnVpbGQoZmFsc2UpO1xuICB9XG5cbiAgYnVpbGRJbmNvbXBsZXRlKCk6IFRyYW5zYWN0aW9uPFROdW1iZXI+IHtcbiAgICByZXR1cm4gdGhpcy5fX2J1aWxkKHRydWUpO1xuICB9XG5cbiAgc2lnbihcbiAgICBzaWduUGFyYW1zOiBudW1iZXIgfCBUeGJTaWduQXJnPFROdW1iZXI+LFxuICAgIGtleVBhaXI/OiBTaWduZXIsXG4gICAgcmVkZWVtU2NyaXB0PzogQnVmZmVyLFxuICAgIGhhc2hUeXBlPzogbnVtYmVyLFxuICAgIHdpdG5lc3NWYWx1ZT86IFROdW1iZXIsXG4gICAgd2l0bmVzc1NjcmlwdD86IEJ1ZmZlcixcbiAgICBjb250cm9sQmxvY2s/OiBCdWZmZXIsXG4gICAgYW5uZXg/OiBCdWZmZXJcbiAgKTogdm9pZCB7XG4gICAgdHJ5U2lnbjxUTnVtYmVyPihcbiAgICAgIGdldFNpZ25pbmdEYXRhPFROdW1iZXI+KFxuICAgICAgICB0aGlzLm5ldHdvcmssXG4gICAgICAgIHRoaXMuX19JTlBVVFMsXG4gICAgICAgIHRoaXMuX19uZWVkc091dHB1dHMuYmluZCh0aGlzKSxcbiAgICAgICAgdGhpcy5fX1RYLFxuICAgICAgICBzaWduUGFyYW1zLFxuICAgICAgICBrZXlQYWlyLFxuICAgICAgICByZWRlZW1TY3JpcHQsXG4gICAgICAgIGhhc2hUeXBlLFxuICAgICAgICB3aXRuZXNzVmFsdWUsXG4gICAgICAgIHdpdG5lc3NTY3JpcHQsXG4gICAgICAgIGNvbnRyb2xCbG9jayxcbiAgICAgICAgYW5uZXgsXG4gICAgICAgIHRoaXMuX19VU0VfTE9XX1JcbiAgICAgIClcbiAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSBfX2FkZElucHV0VW5zYWZlKHR4SGFzaDogQnVmZmVyLCB2b3V0OiBudW1iZXIsIG9wdGlvbnM6IFR4YklucHV0PFROdW1iZXI+KTogbnVtYmVyIHtcbiAgICBpZiAoVHJhbnNhY3Rpb24uaXNDb2luYmFzZUhhc2godHhIYXNoKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdjb2luYmFzZSBpbnB1dHMgbm90IHN1cHBvcnRlZCcpO1xuICAgIH1cblxuICAgIGNvbnN0IHByZXZUeE91dCA9IHR4SGFzaC50b1N0cmluZygnaGV4JykgKyAnOicgKyB2b3V0O1xuICAgIGlmICh0aGlzLl9fUFJFVl9UWF9TRVRbcHJldlR4T3V0XSAhPT0gdW5kZWZpbmVkKSB0aHJvdyBuZXcgRXJyb3IoJ0R1cGxpY2F0ZSBUeE91dDogJyArIHByZXZUeE91dCk7XG5cbiAgICBsZXQgaW5wdXQ6IFR4YklucHV0PFROdW1iZXI+ID0ge307XG5cbiAgICAvLyBkZXJpdmUgd2hhdCB3ZSBjYW4gZnJvbSB0aGUgc2NyaXB0U2lnXG4gICAgaWYgKG9wdGlvbnMuc2NyaXB0ICE9PSB1bmRlZmluZWQgfHwgb3B0aW9ucy53aXRuZXNzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGlucHV0ID0gZXhwYW5kSW5wdXQ8VE51bWJlcj4ob3B0aW9ucy5zY3JpcHQsIG9wdGlvbnMud2l0bmVzcyk7XG4gICAgfVxuXG4gICAgLy8gaWYgYW4gaW5wdXQgdmFsdWUgd2FzIGdpdmVuLCByZXRhaW4gaXRcbiAgICBpZiAob3B0aW9ucy52YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBpbnB1dC52YWx1ZSA9IG9wdGlvbnMudmFsdWU7XG4gICAgfVxuXG4gICAgLy8gZGVyaXZlIHdoYXQgd2UgY2FuIGZyb20gdGhlIHByZXZpb3VzIHRyYW5zYWN0aW9ucyBvdXRwdXQgc2NyaXB0XG4gICAgaWYgKCFpbnB1dC5wcmV2T3V0U2NyaXB0ICYmIG9wdGlvbnMucHJldk91dFNjcmlwdCkge1xuICAgICAgbGV0IHByZXZPdXRUeXBlO1xuXG4gICAgICBpZiAoIWlucHV0LnB1YmtleXMgJiYgIWlucHV0LnNpZ25hdHVyZXMpIHtcbiAgICAgICAgY29uc3QgZXhwYW5kZWQgPSBleHBhbmRPdXRwdXQob3B0aW9ucy5wcmV2T3V0U2NyaXB0KTtcbiAgICAgICAgaWYgKGV4cGFuZGVkLnB1YmtleXMpIHtcbiAgICAgICAgICBpbnB1dC5wdWJrZXlzID0gZXhwYW5kZWQucHVia2V5cztcbiAgICAgICAgICBpbnB1dC5zaWduYXR1cmVzID0gZXhwYW5kZWQuc2lnbmF0dXJlcztcbiAgICAgICAgfVxuXG4gICAgICAgIHByZXZPdXRUeXBlID0gZXhwYW5kZWQudHlwZTtcbiAgICAgIH1cblxuICAgICAgaW5wdXQucHJldk91dFNjcmlwdCA9IG9wdGlvbnMucHJldk91dFNjcmlwdDtcbiAgICAgIGlucHV0LnByZXZPdXRUeXBlID0gcHJldk91dFR5cGUgfHwgY2xhc3NpZnkub3V0cHV0KG9wdGlvbnMucHJldk91dFNjcmlwdCk7XG4gICAgfVxuXG4gICAgY29uc3QgdmluID0gdGhpcy5fX1RYLmFkZElucHV0KHR4SGFzaCwgdm91dCwgb3B0aW9ucy5zZXF1ZW5jZSwgb3B0aW9ucy5zY3JpcHRTaWcpO1xuICAgIHRoaXMuX19JTlBVVFNbdmluXSA9IGlucHV0O1xuICAgIHRoaXMuX19QUkVWX1RYX1NFVFtwcmV2VHhPdXRdID0gdHJ1ZTtcbiAgICByZXR1cm4gdmluO1xuICB9XG5cbiAgcHJpdmF0ZSBfX2J1aWxkKGFsbG93SW5jb21wbGV0ZT86IGJvb2xlYW4pOiBUcmFuc2FjdGlvbjxUTnVtYmVyPiB7XG4gICAgaWYgKCFhbGxvd0luY29tcGxldGUpIHtcbiAgICAgIGlmICghdGhpcy5fX1RYLmlucy5sZW5ndGgpIHRocm93IG5ldyBFcnJvcignVHJhbnNhY3Rpb24gaGFzIG5vIGlucHV0cycpO1xuICAgICAgaWYgKCF0aGlzLl9fVFgub3V0cy5sZW5ndGgpIHRocm93IG5ldyBFcnJvcignVHJhbnNhY3Rpb24gaGFzIG5vIG91dHB1dHMnKTtcbiAgICB9XG5cbiAgICBjb25zdCB0eCA9IHRoaXMuX19UWC5jbG9uZSgpO1xuXG4gICAgLy8gY3JlYXRlIHNjcmlwdCBzaWduYXR1cmVzIGZyb20gaW5wdXRzXG4gICAgdGhpcy5fX0lOUFVUUy5mb3JFYWNoKChpbnB1dCwgaSkgPT4ge1xuICAgICAgaWYgKCFpbnB1dC5wcmV2T3V0VHlwZSAmJiAhYWxsb3dJbmNvbXBsZXRlKSB0aHJvdyBuZXcgRXJyb3IoJ1RyYW5zYWN0aW9uIGlzIG5vdCBjb21wbGV0ZScpO1xuXG4gICAgICBjb25zdCByZXN1bHQgPSBidWlsZDxUTnVtYmVyPihpbnB1dC5wcmV2T3V0VHlwZSEsIGlucHV0LCBhbGxvd0luY29tcGxldGUpO1xuICAgICAgaWYgKCFyZXN1bHQpIHtcbiAgICAgICAgaWYgKCFhbGxvd0luY29tcGxldGUgJiYgaW5wdXQucHJldk91dFR5cGUgPT09IFNDUklQVF9UWVBFUy5OT05TVEFOREFSRCkgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGlucHV0IHR5cGUnKTtcbiAgICAgICAgaWYgKCFhbGxvd0luY29tcGxldGUpIHRocm93IG5ldyBFcnJvcignTm90IGVub3VnaCBpbmZvcm1hdGlvbicpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmIChyZXN1bHQuaW5wdXQpIHtcbiAgICAgICAgdHguc2V0SW5wdXRTY3JpcHQoaSwgcmVzdWx0LmlucHV0KTtcbiAgICAgIH1cbiAgICAgIHR4LnNldFdpdG5lc3MoaSwgcmVzdWx0LndpdG5lc3MhKTtcbiAgICB9KTtcblxuICAgIGlmICghYWxsb3dJbmNvbXBsZXRlKSB7XG4gICAgICAvLyBkbyBub3QgcmVseSBvbiB0aGlzLCBpdHMgbWVyZWx5IGEgbGFzdCByZXNvcnRcbiAgICAgIGlmICh0aGlzLl9fb3Zlck1heGltdW1GZWVzKHR4LnZpcnR1YWxTaXplKCkpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVHJhbnNhY3Rpb24gaGFzIGFic3VyZCBmZWVzJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHR4O1xuICB9XG5cbiAgcHJpdmF0ZSBfX2Nhbk1vZGlmeUlucHV0cygpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5fX0lOUFVUUy5ldmVyeSgoaW5wdXQpID0+IHtcbiAgICAgIGlmICghaW5wdXQuc2lnbmF0dXJlcykgcmV0dXJuIHRydWU7XG5cbiAgICAgIHJldHVybiBpbnB1dC5zaWduYXR1cmVzLmV2ZXJ5KChzaWduYXR1cmUpID0+IHtcbiAgICAgICAgaWYgKCFzaWduYXR1cmUpIHJldHVybiB0cnVlO1xuICAgICAgICBjb25zdCBoYXNoVHlwZSA9IHNpZ25hdHVyZUhhc2hUeXBlKHNpZ25hdHVyZSk7XG5cbiAgICAgICAgLy8gaWYgU0lHSEFTSF9BTllPTkVDQU5QQVkgaXMgc2V0LCBzaWduYXR1cmVzIHdvdWxkIG5vdFxuICAgICAgICAvLyBiZSBpbnZhbGlkYXRlZCBieSBtb3JlIGlucHV0c1xuICAgICAgICByZXR1cm4gKGhhc2hUeXBlICYgVHJhbnNhY3Rpb24uU0lHSEFTSF9BTllPTkVDQU5QQVkpICE9PSAwO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIF9fbmVlZHNPdXRwdXRzKHNpZ25pbmdIYXNoVHlwZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgaWYgKHNpZ25pbmdIYXNoVHlwZSA9PT0gVHJhbnNhY3Rpb24uU0lHSEFTSF9BTEwgfHwgc2lnbmluZ0hhc2hUeXBlID09PSBUcmFuc2FjdGlvbi5TSUdIQVNIX0RFRkFVTFQpIHtcbiAgICAgIHJldHVybiB0aGlzLl9fVFgub3V0cy5sZW5ndGggPT09IDA7XG4gICAgfVxuXG4gICAgLy8gaWYgaW5wdXRzIGFyZSBiZWluZyBzaWduZWQgd2l0aCBTSUdIQVNIX05PTkUsIHdlIGRvbid0IHN0cmljdGx5IG5lZWQgb3V0cHV0c1xuICAgIC8vIC5idWlsZCgpIHdpbGwgZmFpbCwgYnV0IC5idWlsZEluY29tcGxldGUoKSBpcyBPS1xuICAgIHJldHVybiAoXG4gICAgICB0aGlzLl9fVFgub3V0cy5sZW5ndGggPT09IDAgJiZcbiAgICAgIHRoaXMuX19JTlBVVFMuc29tZSgoaW5wdXQpID0+IHtcbiAgICAgICAgaWYgKCFpbnB1dC5zaWduYXR1cmVzKSByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgcmV0dXJuIGlucHV0LnNpZ25hdHVyZXMuc29tZSgoc2lnbmF0dXJlKSA9PiB7XG4gICAgICAgICAgaWYgKCFzaWduYXR1cmUpIHJldHVybiBmYWxzZTsgLy8gbm8gc2lnbmF0dXJlLCBubyBpc3N1ZVxuICAgICAgICAgIGNvbnN0IGhhc2hUeXBlID0gc2lnbmF0dXJlSGFzaFR5cGUoc2lnbmF0dXJlKTtcbiAgICAgICAgICBpZiAoaGFzaFR5cGUgJiBUcmFuc2FjdGlvbi5TSUdIQVNIX05PTkUpIHJldHVybiBmYWxzZTsgLy8gU0lHSEFTSF9OT05FIGRvZXNuJ3QgY2FyZSBhYm91dCBvdXRwdXRzXG4gICAgICAgICAgcmV0dXJuIHRydWU7IC8vIFNJR0hBU0hfKiBkb2VzIGNhcmVcbiAgICAgICAgfSk7XG4gICAgICB9KVxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIF9fY2FuTW9kaWZ5T3V0cHV0cygpOiBib29sZWFuIHtcbiAgICBjb25zdCBuSW5wdXRzID0gdGhpcy5fX1RYLmlucy5sZW5ndGg7XG4gICAgY29uc3Qgbk91dHB1dHMgPSB0aGlzLl9fVFgub3V0cy5sZW5ndGg7XG5cbiAgICByZXR1cm4gdGhpcy5fX0lOUFVUUy5ldmVyeSgoaW5wdXQpID0+IHtcbiAgICAgIGlmIChpbnB1dC5zaWduYXR1cmVzID09PSB1bmRlZmluZWQpIHJldHVybiB0cnVlO1xuXG4gICAgICByZXR1cm4gaW5wdXQuc2lnbmF0dXJlcy5ldmVyeSgoc2lnbmF0dXJlKSA9PiB7XG4gICAgICAgIGlmICghc2lnbmF0dXJlKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgY29uc3QgaGFzaFR5cGUgPSBzaWduYXR1cmVIYXNoVHlwZShzaWduYXR1cmUpO1xuXG4gICAgICAgIGNvbnN0IGhhc2hUeXBlTW9kID0gaGFzaFR5cGUgJiAweDFmO1xuICAgICAgICBpZiAoaGFzaFR5cGVNb2QgPT09IFRyYW5zYWN0aW9uLlNJR0hBU0hfTk9ORSkgcmV0dXJuIHRydWU7XG4gICAgICAgIGlmIChoYXNoVHlwZU1vZCA9PT0gVHJhbnNhY3Rpb24uU0lHSEFTSF9TSU5HTEUpIHtcbiAgICAgICAgICAvLyBpZiBTSUdIQVNIX1NJTkdMRSBpcyBzZXQsIGFuZCBuSW5wdXRzID4gbk91dHB1dHNcbiAgICAgICAgICAvLyBzb21lIHNpZ25hdHVyZXMgd291bGQgYmUgaW52YWxpZGF0ZWQgYnkgdGhlIGFkZGl0aW9uXG4gICAgICAgICAgLy8gb2YgbW9yZSBvdXRwdXRzXG4gICAgICAgICAgcmV0dXJuIG5JbnB1dHMgPD0gbk91dHB1dHM7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIF9fb3Zlck1heGltdW1GZWVzKGJ5dGVzOiBudW1iZXIpOiBib29sZWFuIHtcbiAgICAvLyBub3QgYWxsIGlucHV0cyB3aWxsIGhhdmUgLnZhbHVlIGRlZmluZWRcbiAgICBjb25zdCBpbmNvbWluZyA9IHRoaXMuX19JTlBVVFMucmVkdWNlKFxuICAgICAgKGEsIHgpID0+IGEgKyAodHlwZW9mIHgudmFsdWUgIT09ICd1bmRlZmluZWQnID8gQmlnSW50KHgudmFsdWUpIDogQmlnSW50KDApKSxcbiAgICAgIEJpZ0ludCgwKVxuICAgICk7XG5cbiAgICAvLyBidXQgYWxsIG91dHB1dHMgZG8sIGFuZCBpZiB3ZSBoYXZlIGFueSBpbnB1dCB2YWx1ZVxuICAgIC8vIHdlIGNhbiBpbW1lZGlhdGVseSBkZXRlcm1pbmUgaWYgdGhlIG91dHB1dHMgYXJlIHRvbyBzbWFsbFxuICAgIGNvbnN0IG91dGdvaW5nID0gdGhpcy5fX1RYLm91dHMucmVkdWNlKChhLCB4KSA9PiBhICsgQmlnSW50KCh4IGFzIFR4T3V0cHV0PFROdW1iZXI+KS52YWx1ZSksIEJpZ0ludCgwKSk7XG4gICAgY29uc3QgZmVlID0gaW5jb21pbmcgLSBvdXRnb2luZztcbiAgICBjb25zdCBmZWVSYXRlID0gTnVtYmVyKGZlZSkgLyBieXRlczsgLy8gYXNzdW1lIGZlZSBmaXRzIHdpdGhpbiBudW1iZXJcblxuICAgIHJldHVybiBmZWVSYXRlID4gdGhpcy5tYXhpbXVtRmVlUmF0ZTtcbiAgfVxufVxuXG5mdW5jdGlvbiBleHBhbmRJbnB1dDxUTnVtYmVyIGV4dGVuZHMgbnVtYmVyIHwgYmlnaW50ID0gbnVtYmVyPihcbiAgc2NyaXB0U2lnPzogQnVmZmVyLFxuICB3aXRuZXNzU3RhY2s6IEJ1ZmZlcltdID0gW10sXG4gIHR5cGU/OiBzdHJpbmcsXG4gIHNjcmlwdFB1YktleT86IEJ1ZmZlclxuKTogVHhiSW5wdXQ8VE51bWJlcj4ge1xuICBpZiAoc2NyaXB0U2lnICYmIHNjcmlwdFNpZy5sZW5ndGggPT09IDAgJiYgd2l0bmVzc1N0YWNrLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHt9O1xuICBpZiAoIXR5cGUpIHtcbiAgICBsZXQgc3NUeXBlOiBzdHJpbmcgfCB1bmRlZmluZWQgPSBzY3JpcHRTaWcgPyBjbGFzc2lmeS5pbnB1dChzY3JpcHRTaWcsIHRydWUpIDogdW5kZWZpbmVkO1xuICAgIGxldCB3c1R5cGU6IHN0cmluZyB8IHVuZGVmaW5lZCA9IGNsYXNzaWZ5LndpdG5lc3Mod2l0bmVzc1N0YWNrLCB0cnVlKTtcbiAgICBpZiAoc3NUeXBlID09PSBTQ1JJUFRfVFlQRVMuTk9OU1RBTkRBUkQpIHNzVHlwZSA9IHVuZGVmaW5lZDtcbiAgICBpZiAod3NUeXBlID09PSBTQ1JJUFRfVFlQRVMuTk9OU1RBTkRBUkQpIHdzVHlwZSA9IHVuZGVmaW5lZDtcbiAgICB0eXBlID0gc3NUeXBlIHx8IHdzVHlwZTtcbiAgfVxuXG4gIHN3aXRjaCAodHlwZSkge1xuICAgIGNhc2UgU0NSSVBUX1RZUEVTLlAyV1BLSDoge1xuICAgICAgY29uc3QgeyBvdXRwdXQsIHB1YmtleSwgc2lnbmF0dXJlIH0gPSBwYXltZW50cy5wMndwa2goe1xuICAgICAgICB3aXRuZXNzOiB3aXRuZXNzU3RhY2ssXG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgcHJldk91dFNjcmlwdDogb3V0cHV0LFxuICAgICAgICBwcmV2T3V0VHlwZTogU0NSSVBUX1RZUEVTLlAyV1BLSCxcbiAgICAgICAgcHVia2V5czogW3B1YmtleV0sXG4gICAgICAgIHNpZ25hdHVyZXM6IFtzaWduYXR1cmVdLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBjYXNlIFNDUklQVF9UWVBFUy5QMlBLSDoge1xuICAgICAgY29uc3QgeyBvdXRwdXQsIHB1YmtleSwgc2lnbmF0dXJlIH0gPSBwYXltZW50cy5wMnBraCh7XG4gICAgICAgIGlucHV0OiBzY3JpcHRTaWcsXG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgcHJldk91dFNjcmlwdDogb3V0cHV0LFxuICAgICAgICBwcmV2T3V0VHlwZTogU0NSSVBUX1RZUEVTLlAyUEtILFxuICAgICAgICBwdWJrZXlzOiBbcHVia2V5XSxcbiAgICAgICAgc2lnbmF0dXJlczogW3NpZ25hdHVyZV0sXG4gICAgICB9O1xuICAgIH1cblxuICAgIGNhc2UgU0NSSVBUX1RZUEVTLlAyUEs6IHtcbiAgICAgIGNvbnN0IHsgc2lnbmF0dXJlIH0gPSBwYXltZW50cy5wMnBrKHsgaW5wdXQ6IHNjcmlwdFNpZyB9KTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgcHJldk91dFR5cGU6IFNDUklQVF9UWVBFUy5QMlBLLFxuICAgICAgICBwdWJrZXlzOiBbdW5kZWZpbmVkXSxcbiAgICAgICAgc2lnbmF0dXJlczogW3NpZ25hdHVyZV0sXG4gICAgICB9O1xuICAgIH1cblxuICAgIGNhc2UgU0NSSVBUX1RZUEVTLlAyTVM6IHtcbiAgICAgIGNvbnN0IHsgbSwgcHVia2V5cywgc2lnbmF0dXJlcyB9ID0gcGF5bWVudHMucDJtcyhcbiAgICAgICAge1xuICAgICAgICAgIGlucHV0OiBzY3JpcHRTaWcsXG4gICAgICAgICAgb3V0cHV0OiBzY3JpcHRQdWJLZXksXG4gICAgICAgIH0sXG4gICAgICAgIHsgYWxsb3dJbmNvbXBsZXRlOiB0cnVlIH1cbiAgICAgICk7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHByZXZPdXRUeXBlOiBTQ1JJUFRfVFlQRVMuUDJNUyxcbiAgICAgICAgcHVia2V5cyxcbiAgICAgICAgc2lnbmF0dXJlcyxcbiAgICAgICAgbWF4U2lnbmF0dXJlczogbSxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgY2FzZSBTQ1JJUFRfVFlQRVMuUDJUUl9OUzoge1xuICAgICAgY29uc3QgeyBuLCBwdWJrZXlzLCBzaWduYXR1cmVzIH0gPSBwMnRyUGF5bWVudHMucDJ0cl9ucyhcbiAgICAgICAge1xuICAgICAgICAgIC8vIFdpdG5lc3Mgc2lnbmF0dXJlcyBhcmUgcmV2ZXJzZSBvZiBwdWJrZXlzLCBiZWNhdXNlIGl0J3MgYSBzdGFja1xuICAgICAgICAgIHNpZ25hdHVyZXM6IHdpdG5lc3NTdGFjay5sZW5ndGggPyB3aXRuZXNzU3RhY2sucmV2ZXJzZSgpIDogdW5kZWZpbmVkLFxuICAgICAgICAgIG91dHB1dDogc2NyaXB0UHViS2V5LFxuICAgICAgICB9LFxuICAgICAgICB7IGFsbG93SW5jb21wbGV0ZTogdHJ1ZSwgZWNjTGliIH1cbiAgICAgICk7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHByZXZPdXRUeXBlOiBTQ1JJUFRfVFlQRVMuUDJUUl9OUyxcbiAgICAgICAgcHVia2V5cyxcbiAgICAgICAgc2lnbmF0dXJlcyxcbiAgICAgICAgbWF4U2lnbmF0dXJlczogbixcbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgaWYgKHR5cGUgPT09IFNDUklQVF9UWVBFUy5QMlNIKSB7XG4gICAgY29uc3QgeyBvdXRwdXQsIHJlZGVlbSB9ID0gcGF5bWVudHMucDJzaCh7XG4gICAgICBpbnB1dDogc2NyaXB0U2lnLFxuICAgICAgd2l0bmVzczogd2l0bmVzc1N0YWNrLFxuICAgIH0pO1xuXG4gICAgY29uc3Qgb3V0cHV0VHlwZSA9IGNsYXNzaWZ5Lm91dHB1dChyZWRlZW0hLm91dHB1dCEpO1xuICAgIGNvbnN0IGV4cGFuZGVkID0gZXhwYW5kSW5wdXQ8VE51bWJlcj4ocmVkZWVtIS5pbnB1dCEsIHJlZGVlbSEud2l0bmVzcyEsIG91dHB1dFR5cGUsIHJlZGVlbSEub3V0cHV0KTtcbiAgICBpZiAoIWV4cGFuZGVkLnByZXZPdXRUeXBlKSByZXR1cm4ge307XG5cbiAgICByZXR1cm4ge1xuICAgICAgcHJldk91dFNjcmlwdDogb3V0cHV0LFxuICAgICAgcHJldk91dFR5cGU6IFNDUklQVF9UWVBFUy5QMlNILFxuICAgICAgcmVkZWVtU2NyaXB0OiByZWRlZW0hLm91dHB1dCxcbiAgICAgIHJlZGVlbVNjcmlwdFR5cGU6IGV4cGFuZGVkLnByZXZPdXRUeXBlLFxuICAgICAgd2l0bmVzc1NjcmlwdDogZXhwYW5kZWQud2l0bmVzc1NjcmlwdCxcbiAgICAgIHdpdG5lc3NTY3JpcHRUeXBlOiBleHBhbmRlZC53aXRuZXNzU2NyaXB0VHlwZSxcblxuICAgICAgcHVia2V5czogZXhwYW5kZWQucHVia2V5cyxcbiAgICAgIHNpZ25hdHVyZXM6IGV4cGFuZGVkLnNpZ25hdHVyZXMsXG4gICAgfTtcbiAgfVxuXG4gIGlmICh0eXBlID09PSBTQ1JJUFRfVFlQRVMuUDJXU0gpIHtcbiAgICBjb25zdCB7IG91dHB1dCwgcmVkZWVtIH0gPSBwYXltZW50cy5wMndzaCh7XG4gICAgICBpbnB1dDogc2NyaXB0U2lnLFxuICAgICAgd2l0bmVzczogd2l0bmVzc1N0YWNrLFxuICAgIH0pO1xuICAgIGNvbnN0IG91dHB1dFR5cGUgPSBjbGFzc2lmeS5vdXRwdXQocmVkZWVtIS5vdXRwdXQhKTtcbiAgICBsZXQgZXhwYW5kZWQ7XG4gICAgaWYgKG91dHB1dFR5cGUgPT09IFNDUklQVF9UWVBFUy5QMldQS0gpIHtcbiAgICAgIGV4cGFuZGVkID0gZXhwYW5kSW5wdXQ8VE51bWJlcj4ocmVkZWVtIS5pbnB1dCEsIHJlZGVlbSEud2l0bmVzcyEsIG91dHB1dFR5cGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBleHBhbmRlZCA9IGV4cGFuZElucHV0PFROdW1iZXI+KGJzY3JpcHQuY29tcGlsZShyZWRlZW0hLndpdG5lc3MhKSwgW10sIG91dHB1dFR5cGUsIHJlZGVlbSEub3V0cHV0KTtcbiAgICB9XG4gICAgaWYgKCFleHBhbmRlZC5wcmV2T3V0VHlwZSkgcmV0dXJuIHt9O1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHByZXZPdXRTY3JpcHQ6IG91dHB1dCxcbiAgICAgIHByZXZPdXRUeXBlOiBTQ1JJUFRfVFlQRVMuUDJXU0gsXG4gICAgICB3aXRuZXNzU2NyaXB0OiByZWRlZW0hLm91dHB1dCxcbiAgICAgIHdpdG5lc3NTY3JpcHRUeXBlOiBleHBhbmRlZC5wcmV2T3V0VHlwZSxcblxuICAgICAgcHVia2V5czogZXhwYW5kZWQucHVia2V5cyxcbiAgICAgIHNpZ25hdHVyZXM6IGV4cGFuZGVkLnNpZ25hdHVyZXMsXG4gICAgfTtcbiAgfVxuXG4gIGlmICh0eXBlID09PSBTQ1JJUFRfVFlQRVMuUDJUUikge1xuICAgIGNvbnN0IHBhcnNlZFdpdG5lc3MgPSB0YXByb290LnBhcnNlVGFwcm9vdFdpdG5lc3Mod2l0bmVzc1N0YWNrKTtcbiAgICBpZiAocGFyc2VkV2l0bmVzcy5zcGVuZFR5cGUgPT09ICdLZXknKSB7XG4gICAgICAvLyBrZXkgcGF0aCBzcGVuZCwgbm90aGluZyB0byBleHBhbmRcbiAgICAgIGNvbnN0IHsgc2lnbmF0dXJlLCBhbm5leCB9ID0gcGFyc2VkV2l0bmVzcztcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHByZXZPdXRUeXBlOiBTQ1JJUFRfVFlQRVMuUDJUUixcbiAgICAgICAgc2lnbmF0dXJlczogW3NpZ25hdHVyZV0sXG4gICAgICAgIGFubmV4LFxuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gc2NyaXB0IHBhdGggc3BlbmRcbiAgICAgIGNvbnN0IHsgdGFwc2NyaXB0LCBjb250cm9sQmxvY2ssIGFubmV4IH0gPSBwYXJzZWRXaXRuZXNzO1xuICAgICAgY29uc3QgcHJldk91dFNjcmlwdCA9IHAydHJQYXltZW50cy5wMnRyKFxuICAgICAgICB7XG4gICAgICAgICAgcmVkZWVtczogW3sgb3V0cHV0OiB0YXBzY3JpcHQgfV0sXG4gICAgICAgICAgcmVkZWVtSW5kZXg6IDAsXG4gICAgICAgICAgY29udHJvbEJsb2NrLFxuICAgICAgICAgIGFubmV4LFxuICAgICAgICB9LFxuICAgICAgICB7IGVjY0xpYiB9XG4gICAgICApLm91dHB1dDtcbiAgICAgIGNvbnN0IHdpdG5lc3NTY3JpcHRUeXBlID0gY2xhc3NpZnkub3V0cHV0KHRhcHNjcmlwdCk7XG4gICAgICBjb25zdCB7IHB1YmtleXMsIHNpZ25hdHVyZXMgfSA9IGV4cGFuZElucHV0PFROdW1iZXI+KFxuICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgIHBhcnNlZFdpdG5lc3Muc2NyaXB0U2lnLFxuICAgICAgICB3aXRuZXNzU2NyaXB0VHlwZSxcbiAgICAgICAgdGFwc2NyaXB0XG4gICAgICApO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBwcmV2T3V0U2NyaXB0LFxuICAgICAgICBwcmV2T3V0VHlwZTogU0NSSVBUX1RZUEVTLlAyVFIsXG4gICAgICAgIHdpdG5lc3NTY3JpcHQ6IHRhcHNjcmlwdCxcbiAgICAgICAgd2l0bmVzc1NjcmlwdFR5cGUsXG5cbiAgICAgICAgY29udHJvbEJsb2NrLFxuICAgICAgICBhbm5leCxcblxuICAgICAgICBwdWJrZXlzLFxuICAgICAgICBzaWduYXR1cmVzLFxuICAgICAgfTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge1xuICAgIHByZXZPdXRUeXBlOiBTQ1JJUFRfVFlQRVMuTk9OU1RBTkRBUkQsXG4gICAgcHJldk91dFNjcmlwdDogc2NyaXB0U2lnLFxuICB9O1xufVxuXG4vLyBjb3VsZCBiZSBkb25lIGluIGV4cGFuZElucHV0LCBidXQgcmVxdWlyZXMgdGhlIG9yaWdpbmFsIFRyYW5zYWN0aW9uIGZvciBoYXNoRm9yU2lnbmF0dXJlXG5mdW5jdGlvbiBmaXhNdWx0aXNpZ09yZGVyPFROdW1iZXIgZXh0ZW5kcyBudW1iZXIgfCBiaWdpbnQgPSBudW1iZXI+KFxuICBpbnB1dDogVHhiSW5wdXQ8VE51bWJlcj4sXG4gIHRyYW5zYWN0aW9uOiBUcmFuc2FjdGlvbjxUTnVtYmVyPixcbiAgdmluOiBudW1iZXIsXG4gIHByZXZPdXRwdXRzPzogVHhPdXRwdXQ8VE51bWJlcj5bXVxuKTogdm9pZCB7XG4gIGlmIChpbnB1dC5yZWRlZW1TY3JpcHRUeXBlICE9PSBTQ1JJUFRfVFlQRVMuUDJNUyB8fCAhaW5wdXQucmVkZWVtU2NyaXB0KSByZXR1cm47XG4gIGlmIChpbnB1dC5wdWJrZXlzIS5sZW5ndGggPT09IGlucHV0LnNpZ25hdHVyZXMhLmxlbmd0aCkgcmV0dXJuO1xuICBjb25zdCBwcmV2T3V0cHV0ID0gcHJldk91dHB1dHMgJiYgcHJldk91dHB1dHNbdmluXTtcblxuICBjb25zdCB1bm1hdGNoZWQgPSBpbnB1dC5zaWduYXR1cmVzIS5jb25jYXQoKTtcblxuICBpbnB1dC5zaWduYXR1cmVzID0gaW5wdXQucHVia2V5cyEubWFwKChwdWJLZXkpID0+IHtcbiAgICBjb25zdCBrZXlQYWlyID0gRUNQYWlyLmZyb21QdWJsaWNLZXkocHViS2V5ISk7XG4gICAgbGV0IG1hdGNoOiBCdWZmZXIgfCB1bmRlZmluZWQ7XG5cbiAgICAvLyBjaGVjayBmb3IgYSBzaWduYXR1cmVcbiAgICB1bm1hdGNoZWQuc29tZSgoc2lnbmF0dXJlLCBpKSA9PiB7XG4gICAgICAvLyBza2lwIGlmIHVuZGVmaW5lZCB8fCBPUF8wXG4gICAgICBpZiAoIXNpZ25hdHVyZSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAvLyBUT0RPOiBhdm9pZCBPKG4pIGhhc2hGb3JTaWduYXR1cmVcbiAgICAgIGNvbnN0IHBhcnNlZCA9IGJzY3JpcHQuc2lnbmF0dXJlLmRlY29kZShzaWduYXR1cmUpO1xuICAgICAgY29uc3QgaGFzaCA9IHRyYW5zYWN0aW9uLmhhc2hGb3JTaWduYXR1cmUodmluLCBpbnB1dC5yZWRlZW1TY3JpcHQhLCBwYXJzZWQuaGFzaFR5cGUsIHByZXZPdXRwdXQ/LnZhbHVlKTtcblxuICAgICAgLy8gc2tpcCBpZiBzaWduYXR1cmUgZG9lcyBub3QgbWF0Y2ggcHViS2V5XG4gICAgICBpZiAoIWtleVBhaXIudmVyaWZ5KGhhc2gsIHBhcnNlZC5zaWduYXR1cmUpKSByZXR1cm4gZmFsc2U7XG5cbiAgICAgIC8vIHJlbW92ZSBtYXRjaGVkIHNpZ25hdHVyZSBmcm9tIHVubWF0Y2hlZFxuICAgICAgdW5tYXRjaGVkW2ldID0gdW5kZWZpbmVkO1xuICAgICAgbWF0Y2ggPSBzaWduYXR1cmU7XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIG1hdGNoO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gZXhwYW5kT3V0cHV0KHNjcmlwdDogQnVmZmVyLCBvdXJQdWJLZXk/OiBCdWZmZXIsIGNvbnRyb2xCbG9jaz86IEJ1ZmZlcik6IFR4Yk91dHB1dCB7XG4gIHR5cGVmb3JjZSh0eXBlcy5CdWZmZXIsIHNjcmlwdCk7XG4gIGNvbnN0IHR5cGUgPSBjbGFzc2lmeS5vdXRwdXQoc2NyaXB0KTtcblxuICBzd2l0Y2ggKHR5cGUpIHtcbiAgICBjYXNlIFNDUklQVF9UWVBFUy5QMlBLSDoge1xuICAgICAgaWYgKCFvdXJQdWJLZXkpIHJldHVybiB7IHR5cGUgfTtcblxuICAgICAgLy8gZG9lcyBvdXIgaGFzaDE2MChwdWJLZXkpIG1hdGNoIHRoZSBvdXRwdXQgc2NyaXB0cz9cbiAgICAgIGNvbnN0IHBraDEgPSBwYXltZW50cy5wMnBraCh7IG91dHB1dDogc2NyaXB0IH0pLmhhc2g7XG4gICAgICBjb25zdCBwa2gyID0gYmNyeXB0by5oYXNoMTYwKG91clB1YktleSk7XG4gICAgICBpZiAoIXBraDEhLmVxdWFscyhwa2gyKSkgcmV0dXJuIHsgdHlwZSB9O1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0eXBlLFxuICAgICAgICBwdWJrZXlzOiBbb3VyUHViS2V5XSxcbiAgICAgICAgc2lnbmF0dXJlczogW3VuZGVmaW5lZF0sXG4gICAgICB9O1xuICAgIH1cblxuICAgIGNhc2UgU0NSSVBUX1RZUEVTLlAyV1BLSDoge1xuICAgICAgaWYgKCFvdXJQdWJLZXkpIHJldHVybiB7IHR5cGUgfTtcblxuICAgICAgLy8gZG9lcyBvdXIgaGFzaDE2MChwdWJLZXkpIG1hdGNoIHRoZSBvdXRwdXQgc2NyaXB0cz9cbiAgICAgIGNvbnN0IHdwa2gxID0gcGF5bWVudHMucDJ3cGtoKHsgb3V0cHV0OiBzY3JpcHQgfSkuaGFzaDtcbiAgICAgIGNvbnN0IHdwa2gyID0gYmNyeXB0by5oYXNoMTYwKG91clB1YktleSk7XG4gICAgICBpZiAoIXdwa2gxIS5lcXVhbHMod3BraDIpKSByZXR1cm4geyB0eXBlIH07XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHR5cGUsXG4gICAgICAgIHB1YmtleXM6IFtvdXJQdWJLZXldLFxuICAgICAgICBzaWduYXR1cmVzOiBbdW5kZWZpbmVkXSxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgY2FzZSBTQ1JJUFRfVFlQRVMuUDJUUjoge1xuICAgICAgaWYgKCFvdXJQdWJLZXkpIHJldHVybiB7IHR5cGUgfTtcbiAgICAgIC8vIEhBQ0sgb3VyUHViS2V5IHRvIEJJUDM0MC1zdHlsZVxuICAgICAgaWYgKG91clB1YktleS5sZW5ndGggPT09IDMzKSBvdXJQdWJLZXkgPSBvdXJQdWJLZXkuc2xpY2UoMSk7XG4gICAgICAvLyBUT0RPOiBzdXBwb3J0IG11bHRpcGxlIHB1YmtleXNcbiAgICAgIGNvbnN0IHAydHIgPSBwMnRyUGF5bWVudHMucDJ0cih7IHB1YmtleTogb3VyUHViS2V5LCBjb250cm9sQmxvY2sgfSwgeyBlY2NMaWIgfSk7XG5cbiAgICAgIC8vIERvZXMgdHdlYWtlZCBvdXRwdXQgZm9yIGEgc2luZ2xlIHB1YmtleSBtYXRjaD9cbiAgICAgIGlmICghc2NyaXB0LmVxdWFscyhwMnRyLm91dHB1dCEpKSByZXR1cm4geyB0eXBlIH07XG5cbiAgICAgIC8vIFAyVFIgS2V5UGF0aCwgc2luZ2xlIGtleVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdHlwZSxcbiAgICAgICAgcHVia2V5czogW291clB1YktleV0sXG4gICAgICAgIHNpZ25hdHVyZXM6IFt1bmRlZmluZWRdLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBjYXNlIFNDUklQVF9UWVBFUy5QMlRSX05TOiB7XG4gICAgICBjb25zdCBwMnRyTnMgPSBwMnRyUGF5bWVudHMucDJ0cl9ucyh7IG91dHB1dDogc2NyaXB0IH0sIHsgZWNjTGliIH0pO1xuICAgICAgLy8gUDJUUiBTY3JpcHRQYXRoXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0eXBlLFxuICAgICAgICBwdWJrZXlzOiBwMnRyTnMucHVia2V5cyxcbiAgICAgICAgc2lnbmF0dXJlczogcDJ0ck5zLnB1YmtleXMhLm1hcCgoKTogdW5kZWZpbmVkID0+IHVuZGVmaW5lZCksXG4gICAgICAgIG1heFNpZ25hdHVyZXM6IHAydHJOcy5wdWJrZXlzIS5sZW5ndGgsXG4gICAgICB9O1xuICAgIH1cblxuICAgIGNhc2UgU0NSSVBUX1RZUEVTLlAyUEs6IHtcbiAgICAgIGNvbnN0IHAycGsgPSBwYXltZW50cy5wMnBrKHsgb3V0cHV0OiBzY3JpcHQgfSk7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB0eXBlLFxuICAgICAgICBwdWJrZXlzOiBbcDJway5wdWJrZXldLFxuICAgICAgICBzaWduYXR1cmVzOiBbdW5kZWZpbmVkXSxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgY2FzZSBTQ1JJUFRfVFlQRVMuUDJNUzoge1xuICAgICAgY29uc3QgcDJtcyA9IHBheW1lbnRzLnAybXMoeyBvdXRwdXQ6IHNjcmlwdCB9KTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHR5cGUsXG4gICAgICAgIHB1YmtleXM6IHAybXMucHVia2V5cyxcbiAgICAgICAgc2lnbmF0dXJlczogcDJtcy5wdWJrZXlzIS5tYXAoKCk6IHVuZGVmaW5lZCA9PiB1bmRlZmluZWQpLFxuICAgICAgICBtYXhTaWduYXR1cmVzOiBwMm1zLm0sXG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7IHR5cGUgfTtcbn1cblxuZnVuY3Rpb24gcHJlcGFyZUlucHV0PFROdW1iZXIgZXh0ZW5kcyBudW1iZXIgfCBiaWdpbnQgPSBudW1iZXI+KFxuICBpbnB1dDogVHhiSW5wdXQ8VE51bWJlcj4sXG4gIG91clB1YktleTogQnVmZmVyLFxuICByZWRlZW1TY3JpcHQ/OiBCdWZmZXIsXG4gIHdpdG5lc3NTY3JpcHQ/OiBCdWZmZXIsXG4gIGNvbnRyb2xCbG9jaz86IEJ1ZmZlcixcbiAgYW5uZXg/OiBCdWZmZXJcbik6IFR4YklucHV0PFROdW1iZXI+IHtcbiAgaWYgKHJlZGVlbVNjcmlwdCAmJiB3aXRuZXNzU2NyaXB0KSB7XG4gICAgY29uc3QgcDJ3c2ggPSBwYXltZW50cy5wMndzaCh7XG4gICAgICByZWRlZW06IHsgb3V0cHV0OiB3aXRuZXNzU2NyaXB0IH0sXG4gICAgfSkgYXMgUGF5bWVudDtcbiAgICBjb25zdCBwMndzaEFsdCA9IHBheW1lbnRzLnAyd3NoKHsgb3V0cHV0OiByZWRlZW1TY3JpcHQgfSkgYXMgUGF5bWVudDtcbiAgICBjb25zdCBwMnNoID0gcGF5bWVudHMucDJzaCh7IHJlZGVlbTogeyBvdXRwdXQ6IHJlZGVlbVNjcmlwdCB9IH0pIGFzIFBheW1lbnQ7XG4gICAgY29uc3QgcDJzaEFsdCA9IHBheW1lbnRzLnAyc2goeyByZWRlZW06IHAyd3NoIH0pIGFzIFBheW1lbnQ7XG5cbiAgICAvLyBlbmZvcmNlcyBQMlNIKFAyV1NIKC4uLikpXG4gICAgaWYgKCFwMndzaC5oYXNoIS5lcXVhbHMocDJ3c2hBbHQuaGFzaCEpKSB0aHJvdyBuZXcgRXJyb3IoJ1dpdG5lc3Mgc2NyaXB0IGluY29uc2lzdGVudCB3aXRoIHByZXZPdXRTY3JpcHQnKTtcbiAgICBpZiAoIXAyc2guaGFzaCEuZXF1YWxzKHAyc2hBbHQuaGFzaCEpKSB0aHJvdyBuZXcgRXJyb3IoJ1JlZGVlbSBzY3JpcHQgaW5jb25zaXN0ZW50IHdpdGggcHJldk91dFNjcmlwdCcpO1xuXG4gICAgY29uc3QgZXhwYW5kZWQgPSBleHBhbmRPdXRwdXQocDJ3c2gucmVkZWVtIS5vdXRwdXQhLCBvdXJQdWJLZXkpO1xuICAgIGlmICghZXhwYW5kZWQucHVia2V5cykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGV4cGFuZGVkLnR5cGUgKyAnIG5vdCBzdXBwb3J0ZWQgYXMgd2l0bmVzc1NjcmlwdCAoJyArIGJzY3JpcHQudG9BU00od2l0bmVzc1NjcmlwdCkgKyAnKScpO1xuICAgIH1cbiAgICBpZiAoaW5wdXQuc2lnbmF0dXJlcyAmJiBpbnB1dC5zaWduYXR1cmVzLnNvbWUoKHgpID0+IHggIT09IHVuZGVmaW5lZCkpIHtcbiAgICAgIGV4cGFuZGVkLnNpZ25hdHVyZXMgPSBpbnB1dC5zaWduYXR1cmVzO1xuICAgIH1cblxuICAgIGNvbnN0IHNpZ25TY3JpcHQgPSB3aXRuZXNzU2NyaXB0O1xuICAgIGlmIChleHBhbmRlZC50eXBlID09PSBTQ1JJUFRfVFlQRVMuUDJXUEtIKSB0aHJvdyBuZXcgRXJyb3IoJ1AyU0goUDJXU0goUDJXUEtIKSkgaXMgYSBjb25zZW5zdXMgZmFpbHVyZScpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHJlZGVlbVNjcmlwdCxcbiAgICAgIHJlZGVlbVNjcmlwdFR5cGU6IFNDUklQVF9UWVBFUy5QMldTSCxcblxuICAgICAgd2l0bmVzc1NjcmlwdCxcbiAgICAgIHdpdG5lc3NTY3JpcHRUeXBlOiBleHBhbmRlZC50eXBlLFxuXG4gICAgICBwcmV2T3V0VHlwZTogU0NSSVBUX1RZUEVTLlAyU0gsXG4gICAgICBwcmV2T3V0U2NyaXB0OiBwMnNoLm91dHB1dCxcblxuICAgICAgd2l0bmVzc1ZlcnNpb246IDAsXG4gICAgICBzaWduU2NyaXB0LFxuICAgICAgc2lnblR5cGU6IGV4cGFuZGVkLnR5cGUsXG5cbiAgICAgIHB1YmtleXM6IGV4cGFuZGVkLnB1YmtleXMsXG4gICAgICBzaWduYXR1cmVzOiBleHBhbmRlZC5zaWduYXR1cmVzLFxuICAgICAgbWF4U2lnbmF0dXJlczogZXhwYW5kZWQubWF4U2lnbmF0dXJlcyxcbiAgICB9O1xuICB9XG5cbiAgaWYgKHJlZGVlbVNjcmlwdCkge1xuICAgIGNvbnN0IHAyc2ggPSBwYXltZW50cy5wMnNoKHsgcmVkZWVtOiB7IG91dHB1dDogcmVkZWVtU2NyaXB0IH0gfSkgYXMgUGF5bWVudDtcblxuICAgIGlmIChpbnB1dC5wcmV2T3V0U2NyaXB0KSB7XG4gICAgICBsZXQgcDJzaEFsdDtcbiAgICAgIHRyeSB7XG4gICAgICAgIHAyc2hBbHQgPSBwYXltZW50cy5wMnNoKHsgb3V0cHV0OiBpbnB1dC5wcmV2T3V0U2NyaXB0IH0pIGFzIFBheW1lbnQ7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignUHJldk91dFNjcmlwdCBtdXN0IGJlIFAyU0gnKTtcbiAgICAgIH1cbiAgICAgIGlmICghcDJzaC5oYXNoIS5lcXVhbHMocDJzaEFsdC5oYXNoISkpIHRocm93IG5ldyBFcnJvcignUmVkZWVtIHNjcmlwdCBpbmNvbnNpc3RlbnQgd2l0aCBwcmV2T3V0U2NyaXB0Jyk7XG4gICAgfVxuXG4gICAgY29uc3QgZXhwYW5kZWQgPSBleHBhbmRPdXRwdXQocDJzaC5yZWRlZW0hLm91dHB1dCEsIG91clB1YktleSk7XG4gICAgaWYgKCFleHBhbmRlZC5wdWJrZXlzKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoZXhwYW5kZWQudHlwZSArICcgbm90IHN1cHBvcnRlZCBhcyByZWRlZW1TY3JpcHQgKCcgKyBic2NyaXB0LnRvQVNNKHJlZGVlbVNjcmlwdCkgKyAnKScpO1xuICAgIH1cbiAgICBpZiAoaW5wdXQuc2lnbmF0dXJlcyAmJiBpbnB1dC5zaWduYXR1cmVzLnNvbWUoKHgpID0+IHggIT09IHVuZGVmaW5lZCkpIHtcbiAgICAgIGV4cGFuZGVkLnNpZ25hdHVyZXMgPSBpbnB1dC5zaWduYXR1cmVzO1xuICAgIH1cblxuICAgIGxldCBzaWduU2NyaXB0ID0gcmVkZWVtU2NyaXB0O1xuICAgIGlmIChleHBhbmRlZC50eXBlID09PSBTQ1JJUFRfVFlQRVMuUDJXUEtIKSB7XG4gICAgICBzaWduU2NyaXB0ID0gcGF5bWVudHMucDJwa2goeyBwdWJrZXk6IGV4cGFuZGVkLnB1YmtleXNbMF0gfSkub3V0cHV0ITtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgcmVkZWVtU2NyaXB0LFxuICAgICAgcmVkZWVtU2NyaXB0VHlwZTogZXhwYW5kZWQudHlwZSxcblxuICAgICAgcHJldk91dFR5cGU6IFNDUklQVF9UWVBFUy5QMlNILFxuICAgICAgcHJldk91dFNjcmlwdDogcDJzaC5vdXRwdXQsXG5cbiAgICAgIHdpdG5lc3NWZXJzaW9uOiBleHBhbmRlZC50eXBlID09PSBTQ1JJUFRfVFlQRVMuUDJXUEtIID8gMCA6IHVuZGVmaW5lZCxcbiAgICAgIHNpZ25TY3JpcHQsXG4gICAgICBzaWduVHlwZTogZXhwYW5kZWQudHlwZSxcblxuICAgICAgcHVia2V5czogZXhwYW5kZWQucHVia2V5cyxcbiAgICAgIHNpZ25hdHVyZXM6IGV4cGFuZGVkLnNpZ25hdHVyZXMsXG4gICAgICBtYXhTaWduYXR1cmVzOiBleHBhbmRlZC5tYXhTaWduYXR1cmVzLFxuICAgIH07XG4gIH1cblxuICBpZiAod2l0bmVzc1NjcmlwdCAmJiBjb250cm9sQmxvY2spIHtcbiAgICAvLyBQMlRSIFNjcmlwdFBhdGhcbiAgICAvKiB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6bm8tc2hhZG93ZWQtdmFyaWFibGUgKi9cbiAgICBsZXQgcHJldk91dFNjcmlwdCA9IGlucHV0LnByZXZPdXRTY3JpcHQ7XG4gICAgaWYgKCFwcmV2T3V0U2NyaXB0KSB7XG4gICAgICBwcmV2T3V0U2NyaXB0ID0gcDJ0clBheW1lbnRzLnAydHIoXG4gICAgICAgIHtcbiAgICAgICAgICByZWRlZW1zOiBbeyBvdXRwdXQ6IHdpdG5lc3NTY3JpcHQgfV0sXG4gICAgICAgICAgcmVkZWVtSW5kZXg6IDAsXG4gICAgICAgICAgY29udHJvbEJsb2NrLFxuICAgICAgICAgIGFubmV4LFxuICAgICAgICB9LFxuICAgICAgICB7IGVjY0xpYiB9XG4gICAgICApLm91dHB1dDtcbiAgICB9XG5cbiAgICBjb25zdCBleHBhbmRlZCA9IGV4cGFuZE91dHB1dCh3aXRuZXNzU2NyaXB0LCBvdXJQdWJLZXkpO1xuICAgIGlmICghZXhwYW5kZWQucHVia2V5cykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGV4cGFuZGVkLnR5cGUgKyAnIG5vdCBzdXBwb3J0ZWQgYXMgd2l0bmVzc1NjcmlwdCAoJyArIGJzY3JpcHQudG9BU00od2l0bmVzc1NjcmlwdCkgKyAnKScpO1xuICAgIH1cbiAgICBpZiAoaW5wdXQuc2lnbmF0dXJlcyAmJiBpbnB1dC5zaWduYXR1cmVzLnNvbWUoKHgpID0+IHggIT09IHVuZGVmaW5lZCkpIHtcbiAgICAgIGV4cGFuZGVkLnNpZ25hdHVyZXMgPSBpbnB1dC5zaWduYXR1cmVzO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICB3aXRuZXNzU2NyaXB0LFxuICAgICAgd2l0bmVzc1NjcmlwdFR5cGU6IGV4cGFuZGVkLnR5cGUsXG5cbiAgICAgIHByZXZPdXRUeXBlOiBTQ1JJUFRfVFlQRVMuUDJUUixcbiAgICAgIHByZXZPdXRTY3JpcHQsXG5cbiAgICAgIHdpdG5lc3NWZXJzaW9uOiAxLFxuICAgICAgc2lnblNjcmlwdDogd2l0bmVzc1NjcmlwdCxcbiAgICAgIHNpZ25UeXBlOiBleHBhbmRlZC50eXBlLFxuXG4gICAgICBwdWJrZXlzOiBleHBhbmRlZC5wdWJrZXlzLFxuICAgICAgc2lnbmF0dXJlczogZXhwYW5kZWQuc2lnbmF0dXJlcyxcbiAgICAgIG1heFNpZ25hdHVyZXM6IGV4cGFuZGVkLm1heFNpZ25hdHVyZXMsXG5cbiAgICAgIGNvbnRyb2xCbG9jayxcbiAgICAgIGFubmV4LFxuICAgIH07XG4gIH1cblxuICBpZiAod2l0bmVzc1NjcmlwdCkge1xuICAgIGNvbnN0IHAyd3NoID0gcGF5bWVudHMucDJ3c2goeyByZWRlZW06IHsgb3V0cHV0OiB3aXRuZXNzU2NyaXB0IH0gfSk7XG5cbiAgICBpZiAoaW5wdXQucHJldk91dFNjcmlwdCkge1xuICAgICAgY29uc3QgcDJ3c2hBbHQgPSBwYXltZW50cy5wMndzaCh7IG91dHB1dDogaW5wdXQucHJldk91dFNjcmlwdCB9KTtcbiAgICAgIGlmICghcDJ3c2guaGFzaCEuZXF1YWxzKHAyd3NoQWx0Lmhhc2ghKSkgdGhyb3cgbmV3IEVycm9yKCdXaXRuZXNzIHNjcmlwdCBpbmNvbnNpc3RlbnQgd2l0aCBwcmV2T3V0U2NyaXB0Jyk7XG4gICAgfVxuXG4gICAgY29uc3QgZXhwYW5kZWQgPSBleHBhbmRPdXRwdXQocDJ3c2gucmVkZWVtIS5vdXRwdXQhLCBvdXJQdWJLZXkpO1xuICAgIGlmICghZXhwYW5kZWQucHVia2V5cykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGV4cGFuZGVkLnR5cGUgKyAnIG5vdCBzdXBwb3J0ZWQgYXMgd2l0bmVzc1NjcmlwdCAoJyArIGJzY3JpcHQudG9BU00od2l0bmVzc1NjcmlwdCkgKyAnKScpO1xuICAgIH1cbiAgICBpZiAoaW5wdXQuc2lnbmF0dXJlcyAmJiBpbnB1dC5zaWduYXR1cmVzLnNvbWUoKHgpID0+IHggIT09IHVuZGVmaW5lZCkpIHtcbiAgICAgIGV4cGFuZGVkLnNpZ25hdHVyZXMgPSBpbnB1dC5zaWduYXR1cmVzO1xuICAgIH1cblxuICAgIGNvbnN0IHNpZ25TY3JpcHQgPSB3aXRuZXNzU2NyaXB0O1xuICAgIGlmIChleHBhbmRlZC50eXBlID09PSBTQ1JJUFRfVFlQRVMuUDJXUEtIKSB0aHJvdyBuZXcgRXJyb3IoJ1AyV1NIKFAyV1BLSCkgaXMgYSBjb25zZW5zdXMgZmFpbHVyZScpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHdpdG5lc3NTY3JpcHQsXG4gICAgICB3aXRuZXNzU2NyaXB0VHlwZTogZXhwYW5kZWQudHlwZSxcblxuICAgICAgcHJldk91dFR5cGU6IFNDUklQVF9UWVBFUy5QMldTSCxcbiAgICAgIHByZXZPdXRTY3JpcHQ6IHAyd3NoLm91dHB1dCxcblxuICAgICAgd2l0bmVzc1ZlcnNpb246IDAsXG4gICAgICBzaWduU2NyaXB0LFxuICAgICAgc2lnblR5cGU6IGV4cGFuZGVkLnR5cGUsXG5cbiAgICAgIHB1YmtleXM6IGV4cGFuZGVkLnB1YmtleXMsXG4gICAgICBzaWduYXR1cmVzOiBleHBhbmRlZC5zaWduYXR1cmVzLFxuICAgICAgbWF4U2lnbmF0dXJlczogZXhwYW5kZWQubWF4U2lnbmF0dXJlcyxcbiAgICB9O1xuICB9XG5cbiAgaWYgKGlucHV0LnByZXZPdXRUeXBlICYmIGlucHV0LnByZXZPdXRTY3JpcHQpIHtcbiAgICAvLyBlbWJlZGRlZCBzY3JpcHRzIGFyZSBub3QgcG9zc2libGUgd2l0aG91dCBleHRyYSBpbmZvcm1hdGlvblxuICAgIGlmIChpbnB1dC5wcmV2T3V0VHlwZSA9PT0gU0NSSVBUX1RZUEVTLlAyU0gpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignUHJldk91dFNjcmlwdCBpcyAnICsgaW5wdXQucHJldk91dFR5cGUgKyAnLCByZXF1aXJlcyByZWRlZW1TY3JpcHQnKTtcbiAgICB9XG4gICAgaWYgKGlucHV0LnByZXZPdXRUeXBlID09PSBTQ1JJUFRfVFlQRVMuUDJXU0gpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignUHJldk91dFNjcmlwdCBpcyAnICsgaW5wdXQucHJldk91dFR5cGUgKyAnLCByZXF1aXJlcyB3aXRuZXNzU2NyaXB0Jyk7XG4gICAgfVxuXG4gICAgY29uc3QgZXhwYW5kZWQgPSBleHBhbmRPdXRwdXQoaW5wdXQucHJldk91dFNjcmlwdCwgb3VyUHViS2V5KTtcbiAgICBpZiAoIWV4cGFuZGVkLnB1YmtleXMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihleHBhbmRlZC50eXBlICsgJyBub3Qgc3VwcG9ydGVkICgnICsgYnNjcmlwdC50b0FTTShpbnB1dC5wcmV2T3V0U2NyaXB0KSArICcpJyk7XG4gICAgfVxuICAgIGlmIChpbnB1dC5zaWduYXR1cmVzICYmIGlucHV0LnNpZ25hdHVyZXMuc29tZSgoeCkgPT4geCAhPT0gdW5kZWZpbmVkKSkge1xuICAgICAgZXhwYW5kZWQuc2lnbmF0dXJlcyA9IGlucHV0LnNpZ25hdHVyZXM7XG4gICAgfVxuXG4gICAgbGV0IHNpZ25TY3JpcHQgPSBpbnB1dC5wcmV2T3V0U2NyaXB0O1xuICAgIGlmIChleHBhbmRlZC50eXBlID09PSBTQ1JJUFRfVFlQRVMuUDJXUEtIKSB7XG4gICAgICBzaWduU2NyaXB0ID0gcGF5bWVudHMucDJwa2goeyBwdWJrZXk6IGV4cGFuZGVkLnB1YmtleXNbMF0gfSkub3V0cHV0IGFzIEJ1ZmZlcjtcbiAgICB9XG5cbiAgICBsZXQgd2l0bmVzc1ZlcnNpb247XG4gICAgaWYgKGV4cGFuZGVkLnR5cGUgPT09IFNDUklQVF9UWVBFUy5QMldQS0gpIHtcbiAgICAgIHdpdG5lc3NWZXJzaW9uID0gMDtcbiAgICB9IGVsc2UgaWYgKGV4cGFuZGVkLnR5cGUgPT09IFNDUklQVF9UWVBFUy5QMlRSKSB7XG4gICAgICB3aXRuZXNzVmVyc2lvbiA9IDE7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIHByZXZPdXRUeXBlOiBleHBhbmRlZC50eXBlLFxuICAgICAgcHJldk91dFNjcmlwdDogaW5wdXQucHJldk91dFNjcmlwdCxcblxuICAgICAgd2l0bmVzc1ZlcnNpb24sXG4gICAgICBzaWduU2NyaXB0LFxuICAgICAgc2lnblR5cGU6IGV4cGFuZGVkLnR5cGUsXG5cbiAgICAgIHB1YmtleXM6IGV4cGFuZGVkLnB1YmtleXMsXG4gICAgICBzaWduYXR1cmVzOiBleHBhbmRlZC5zaWduYXR1cmVzLFxuICAgICAgbWF4U2lnbmF0dXJlczogZXhwYW5kZWQubWF4U2lnbmF0dXJlcyxcbiAgICB9O1xuICB9XG5cbiAgY29uc3QgcHJldk91dFNjcmlwdCA9IHBheW1lbnRzLnAycGtoKHsgcHVia2V5OiBvdXJQdWJLZXkgfSkub3V0cHV0O1xuICByZXR1cm4ge1xuICAgIHByZXZPdXRUeXBlOiBTQ1JJUFRfVFlQRVMuUDJQS0gsXG4gICAgcHJldk91dFNjcmlwdCxcblxuICAgIHNpZ25TY3JpcHQ6IHByZXZPdXRTY3JpcHQsXG4gICAgc2lnblR5cGU6IFNDUklQVF9UWVBFUy5QMlBLSCxcblxuICAgIHB1YmtleXM6IFtvdXJQdWJLZXldLFxuICAgIHNpZ25hdHVyZXM6IFt1bmRlZmluZWRdLFxuICB9O1xufVxuXG5mdW5jdGlvbiBidWlsZDxUTnVtYmVyIGV4dGVuZHMgbnVtYmVyIHwgYmlnaW50ID0gbnVtYmVyPihcbiAgdHlwZTogc3RyaW5nLFxuICBpbnB1dDogVHhiSW5wdXQ8VE51bWJlcj4sXG4gIGFsbG93SW5jb21wbGV0ZT86IGJvb2xlYW5cbik6IFBheW1lbnQgfCB1bmRlZmluZWQge1xuICBjb25zdCBwdWJrZXlzID0gKGlucHV0LnB1YmtleXMgfHwgW10pIGFzIEJ1ZmZlcltdO1xuICBsZXQgc2lnbmF0dXJlcyA9IChpbnB1dC5zaWduYXR1cmVzIHx8IFtdKSBhcyBCdWZmZXJbXTtcblxuICBzd2l0Y2ggKHR5cGUpIHtcbiAgICBjYXNlIFNDUklQVF9UWVBFUy5QMlBLSDoge1xuICAgICAgaWYgKHB1YmtleXMubGVuZ3RoID09PSAwKSBicmVhaztcbiAgICAgIGlmIChzaWduYXR1cmVzLmxlbmd0aCA9PT0gMCkgYnJlYWs7XG5cbiAgICAgIHJldHVybiBwYXltZW50cy5wMnBraCh7IHB1YmtleTogcHVia2V5c1swXSwgc2lnbmF0dXJlOiBzaWduYXR1cmVzWzBdIH0pO1xuICAgIH1cbiAgICBjYXNlIFNDUklQVF9UWVBFUy5QMldQS0g6IHtcbiAgICAgIGlmIChwdWJrZXlzLmxlbmd0aCA9PT0gMCkgYnJlYWs7XG4gICAgICBpZiAoc2lnbmF0dXJlcy5sZW5ndGggPT09IDApIGJyZWFrO1xuXG4gICAgICByZXR1cm4gcGF5bWVudHMucDJ3cGtoKHsgcHVia2V5OiBwdWJrZXlzWzBdLCBzaWduYXR1cmU6IHNpZ25hdHVyZXNbMF0gfSk7XG4gICAgfVxuICAgIGNhc2UgU0NSSVBUX1RZUEVTLlAyUEs6IHtcbiAgICAgIGlmIChwdWJrZXlzLmxlbmd0aCA9PT0gMCkgYnJlYWs7XG4gICAgICBpZiAoc2lnbmF0dXJlcy5sZW5ndGggPT09IDApIGJyZWFrO1xuXG4gICAgICByZXR1cm4gcGF5bWVudHMucDJwayh7IHNpZ25hdHVyZTogc2lnbmF0dXJlc1swXSB9KTtcbiAgICB9XG4gICAgY2FzZSBTQ1JJUFRfVFlQRVMuUDJNUzoge1xuICAgICAgY29uc3QgbSA9IGlucHV0Lm1heFNpZ25hdHVyZXM7XG4gICAgICBpZiAoYWxsb3dJbmNvbXBsZXRlKSB7XG4gICAgICAgIHNpZ25hdHVyZXMgPSBzaWduYXR1cmVzLm1hcCgoeCkgPT4geCB8fCBvcHMuT1BfMCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzaWduYXR1cmVzID0gc2lnbmF0dXJlcy5maWx0ZXIoKHgpID0+IHgpO1xuICAgICAgfVxuXG4gICAgICAvLyBpZiB0aGUgdHJhbnNhY3Rpb24gaXMgbm90IG5vdCBjb21wbGV0ZSAoY29tcGxldGUpLCBvciBpZiBzaWduYXR1cmVzLmxlbmd0aCA9PT0gbSwgdmFsaWRhdGVcbiAgICAgIC8vIG90aGVyd2lzZSwgdGhlIG51bWJlciBvZiBPUF8wJ3MgbWF5IGJlID49IG0sIHNvIGRvbid0IHZhbGlkYXRlIChib28pXG4gICAgICBjb25zdCB2YWxpZGF0ZSA9ICFhbGxvd0luY29tcGxldGUgfHwgbSA9PT0gc2lnbmF0dXJlcy5sZW5ndGg7XG4gICAgICByZXR1cm4gcGF5bWVudHMucDJtcyh7IG0sIHB1YmtleXMsIHNpZ25hdHVyZXMgfSwgeyBhbGxvd0luY29tcGxldGUsIHZhbGlkYXRlIH0pO1xuICAgIH1cbiAgICBjYXNlIFNDUklQVF9UWVBFUy5QMlNIOiB7XG4gICAgICBjb25zdCByZWRlZW0gPSBidWlsZDxUTnVtYmVyPihpbnB1dC5yZWRlZW1TY3JpcHRUeXBlISwgaW5wdXQsIGFsbG93SW5jb21wbGV0ZSk7XG4gICAgICBpZiAoIXJlZGVlbSkgcmV0dXJuO1xuXG4gICAgICByZXR1cm4gcGF5bWVudHMucDJzaCh7XG4gICAgICAgIHJlZGVlbToge1xuICAgICAgICAgIG91dHB1dDogcmVkZWVtLm91dHB1dCB8fCBpbnB1dC5yZWRlZW1TY3JpcHQsXG4gICAgICAgICAgaW5wdXQ6IHJlZGVlbS5pbnB1dCxcbiAgICAgICAgICB3aXRuZXNzOiByZWRlZW0ud2l0bmVzcyxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgIH1cbiAgICBjYXNlIFNDUklQVF9UWVBFUy5QMldTSDoge1xuICAgICAgY29uc3QgcmVkZWVtID0gYnVpbGQ8VE51bWJlcj4oaW5wdXQud2l0bmVzc1NjcmlwdFR5cGUhLCBpbnB1dCwgYWxsb3dJbmNvbXBsZXRlKTtcbiAgICAgIGlmICghcmVkZWVtKSByZXR1cm47XG5cbiAgICAgIHJldHVybiBwYXltZW50cy5wMndzaCh7XG4gICAgICAgIHJlZGVlbToge1xuICAgICAgICAgIG91dHB1dDogaW5wdXQud2l0bmVzc1NjcmlwdCxcbiAgICAgICAgICBpbnB1dDogcmVkZWVtLmlucHV0LFxuICAgICAgICAgIHdpdG5lc3M6IHJlZGVlbS53aXRuZXNzLFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgfVxuICAgIGNhc2UgU0NSSVBUX1RZUEVTLlAyVFI6IHtcbiAgICAgIGlmIChpbnB1dC53aXRuZXNzU2NyaXB0VHlwZSA9PT0gU0NSSVBUX1RZUEVTLlAyVFJfTlMpIHtcbiAgICAgICAgLy8gU2NyaXB0UGF0aFxuICAgICAgICBjb25zdCByZWRlZW0gPSBidWlsZDxUTnVtYmVyPihpbnB1dC53aXRuZXNzU2NyaXB0VHlwZSEsIGlucHV0LCBhbGxvd0luY29tcGxldGUpO1xuICAgICAgICByZXR1cm4gcDJ0clBheW1lbnRzLnAydHIoXG4gICAgICAgICAge1xuICAgICAgICAgICAgb3V0cHV0OiBpbnB1dC5wcmV2T3V0U2NyaXB0LFxuICAgICAgICAgICAgY29udHJvbEJsb2NrOiBpbnB1dC5jb250cm9sQmxvY2ssXG4gICAgICAgICAgICBhbm5leDogaW5wdXQuYW5uZXgsXG4gICAgICAgICAgICByZWRlZW1zOiBbcmVkZWVtIV0sXG4gICAgICAgICAgICByZWRlZW1JbmRleDogMCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHsgZWNjTGliIH1cbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgLy8gS2V5UGF0aFxuICAgICAgaWYgKHNpZ25hdHVyZXMubGVuZ3RoID09PSAwKSBicmVhaztcblxuICAgICAgcmV0dXJuIHAydHJQYXltZW50cy5wMnRyKHsgcHVia2V5cywgc2lnbmF0dXJlOiBzaWduYXR1cmVzWzBdIH0sIHsgZWNjTGliIH0pO1xuICAgIH1cbiAgICBjYXNlIFNDUklQVF9UWVBFUy5QMlRSX05TOiB7XG4gICAgICBjb25zdCBtID0gaW5wdXQubWF4U2lnbmF0dXJlcztcbiAgICAgIGlmIChhbGxvd0luY29tcGxldGUpIHtcbiAgICAgICAgc2lnbmF0dXJlcyA9IHNpZ25hdHVyZXMubWFwKCh4KSA9PiB4IHx8IG9wcy5PUF8wKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNpZ25hdHVyZXMgPSBzaWduYXR1cmVzLmZpbHRlcigoeCkgPT4geCk7XG4gICAgICB9XG5cbiAgICAgIC8vIGlmIHRoZSB0cmFuc2FjdGlvbiBpcyBub3Qgbm90IGNvbXBsZXRlIChjb21wbGV0ZSksIG9yIGlmIHNpZ25hdHVyZXMubGVuZ3RoID09PSBtLCB2YWxpZGF0ZVxuICAgICAgLy8gb3RoZXJ3aXNlLCB0aGUgbnVtYmVyIG9mIE9QXzAncyBtYXkgYmUgPj0gbSwgc28gZG9uJ3QgdmFsaWRhdGUgKGJvbylcbiAgICAgIGNvbnN0IHZhbGlkYXRlID0gIWFsbG93SW5jb21wbGV0ZSB8fCBtID09PSBzaWduYXR1cmVzLmxlbmd0aDtcbiAgICAgIHJldHVybiBwMnRyUGF5bWVudHMucDJ0cl9ucyh7IHB1YmtleXMsIHNpZ25hdHVyZXMgfSwgeyBhbGxvd0luY29tcGxldGUsIHZhbGlkYXRlLCBlY2NMaWIgfSk7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGNhblNpZ248VE51bWJlciBleHRlbmRzIG51bWJlciB8IGJpZ2ludCA9IG51bWJlcj4oaW5wdXQ6IFR4YklucHV0PFROdW1iZXI+KTogYm9vbGVhbiB7XG4gIHJldHVybiAoXG4gICAgaW5wdXQuc2lnblNjcmlwdCAhPT0gdW5kZWZpbmVkICYmXG4gICAgaW5wdXQuc2lnblR5cGUgIT09IHVuZGVmaW5lZCAmJlxuICAgIGlucHV0LnB1YmtleXMgIT09IHVuZGVmaW5lZCAmJlxuICAgIGlucHV0LnNpZ25hdHVyZXMgIT09IHVuZGVmaW5lZCAmJlxuICAgIGlucHV0LnNpZ25hdHVyZXMubGVuZ3RoID09PSBpbnB1dC5wdWJrZXlzLmxlbmd0aCAmJlxuICAgIGlucHV0LnB1YmtleXMubGVuZ3RoID4gMCAmJlxuICAgIChpbnB1dC53aXRuZXNzVmVyc2lvbiA9PT0gdW5kZWZpbmVkIHx8IGlucHV0LnZhbHVlICE9PSB1bmRlZmluZWQpXG4gICk7XG59XG5cbmZ1bmN0aW9uIHNpZ25hdHVyZUhhc2hUeXBlKGJ1ZmZlcjogQnVmZmVyKTogbnVtYmVyIHtcbiAgaWYgKGJzY3JpcHQuaXNDYW5vbmljYWxTY2hub3JyU2lnbmF0dXJlKGJ1ZmZlcikgJiYgYnVmZmVyLmxlbmd0aCA9PT0gNjQpIHtcbiAgICByZXR1cm4gVHJhbnNhY3Rpb24uU0lHSEFTSF9ERUZBVUxUO1xuICB9XG4gIHJldHVybiBidWZmZXIucmVhZFVJbnQ4KGJ1ZmZlci5sZW5ndGggLSAxKTtcbn1cblxuZnVuY3Rpb24gY2hlY2tTaWduQXJnczxUTnVtYmVyIGV4dGVuZHMgbnVtYmVyIHwgYmlnaW50ID0gbnVtYmVyPihcbiAgaW5wdXRzOiBBcnJheTxUeGJJbnB1dDxUTnVtYmVyPj4sXG4gIHNpZ25QYXJhbXM6IFR4YlNpZ25Bcmc8VE51bWJlcj5cbik6IHZvaWQge1xuICBpZiAoIVBSRVZPVVRfVFlQRVMuaGFzKHNpZ25QYXJhbXMucHJldk91dFNjcmlwdFR5cGUpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgVW5rbm93biBwcmV2T3V0U2NyaXB0VHlwZSBcIiR7c2lnblBhcmFtcy5wcmV2T3V0U2NyaXB0VHlwZX1cImApO1xuICB9XG4gIHRmTWVzc2FnZSh0eXBlZm9yY2UuTnVtYmVyLCBzaWduUGFyYW1zLnZpbiwgYHNpZ24gbXVzdCBpbmNsdWRlIHZpbiBwYXJhbWV0ZXIgYXMgTnVtYmVyIChpbnB1dCBpbmRleClgKTtcbiAgdGZNZXNzYWdlKHRmRnVsbFNpZ25lciwgc2lnblBhcmFtcy5rZXlQYWlyLCBgc2lnbiBtdXN0IGluY2x1ZGUga2V5UGFpciBwYXJhbWV0ZXIgYXMgU2lnbmVyIGludGVyZmFjZWApO1xuICB0Zk1lc3NhZ2UodHlwZWZvcmNlLm1heWJlKHR5cGVmb3JjZS5OdW1iZXIpLCBzaWduUGFyYW1zLmhhc2hUeXBlLCBgc2lnbiBoYXNoVHlwZSBwYXJhbWV0ZXIgbXVzdCBiZSBhIG51bWJlcmApO1xuICBjb25zdCBwcmV2T3V0VHlwZSA9IChpbnB1dHNbc2lnblBhcmFtcy52aW5dIHx8IFtdKS5wcmV2T3V0VHlwZTtcbiAgY29uc3QgcG9zVHlwZSA9IHNpZ25QYXJhbXMucHJldk91dFNjcmlwdFR5cGU7XG4gIHN3aXRjaCAocG9zVHlwZSkge1xuICAgIGNhc2UgJ3AycGtoJzpcbiAgICAgIGlmIChwcmV2T3V0VHlwZSAmJiBwcmV2T3V0VHlwZSAhPT0gJ3B1YmtleWhhc2gnKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYGlucHV0ICMke3NpZ25QYXJhbXMudmlufSBpcyBub3Qgb2YgdHlwZSBwMnBraDogJHtwcmV2T3V0VHlwZX1gKTtcbiAgICAgIH1cbiAgICAgIHRmTWVzc2FnZSh0eXBlZm9yY2UudmFsdWUodW5kZWZpbmVkKSwgc2lnblBhcmFtcy53aXRuZXNzU2NyaXB0LCBgJHtwb3NUeXBlfSByZXF1aXJlcyBOTyB3aXRuZXNzU2NyaXB0YCk7XG4gICAgICB0Zk1lc3NhZ2UodHlwZWZvcmNlLnZhbHVlKHVuZGVmaW5lZCksIHNpZ25QYXJhbXMucmVkZWVtU2NyaXB0LCBgJHtwb3NUeXBlfSByZXF1aXJlcyBOTyByZWRlZW1TY3JpcHRgKTtcbiAgICAgIHRmTWVzc2FnZSh0eXBlZm9yY2UudmFsdWUodW5kZWZpbmVkKSwgc2lnblBhcmFtcy53aXRuZXNzVmFsdWUsIGAke3Bvc1R5cGV9IHJlcXVpcmVzIE5PIHdpdG5lc3NWYWx1ZWApO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAncDJwayc6XG4gICAgICBpZiAocHJldk91dFR5cGUgJiYgcHJldk91dFR5cGUgIT09ICdwdWJrZXknKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYGlucHV0ICMke3NpZ25QYXJhbXMudmlufSBpcyBub3Qgb2YgdHlwZSBwMnBrOiAke3ByZXZPdXRUeXBlfWApO1xuICAgICAgfVxuICAgICAgdGZNZXNzYWdlKHR5cGVmb3JjZS52YWx1ZSh1bmRlZmluZWQpLCBzaWduUGFyYW1zLndpdG5lc3NTY3JpcHQsIGAke3Bvc1R5cGV9IHJlcXVpcmVzIE5PIHdpdG5lc3NTY3JpcHRgKTtcbiAgICAgIHRmTWVzc2FnZSh0eXBlZm9yY2UudmFsdWUodW5kZWZpbmVkKSwgc2lnblBhcmFtcy5yZWRlZW1TY3JpcHQsIGAke3Bvc1R5cGV9IHJlcXVpcmVzIE5PIHJlZGVlbVNjcmlwdGApO1xuICAgICAgdGZNZXNzYWdlKHR5cGVmb3JjZS52YWx1ZSh1bmRlZmluZWQpLCBzaWduUGFyYW1zLndpdG5lc3NWYWx1ZSwgYCR7cG9zVHlwZX0gcmVxdWlyZXMgTk8gd2l0bmVzc1ZhbHVlYCk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdwMndwa2gnOlxuICAgICAgaWYgKHByZXZPdXRUeXBlICYmIHByZXZPdXRUeXBlICE9PSAnd2l0bmVzc3B1YmtleWhhc2gnKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYGlucHV0ICMke3NpZ25QYXJhbXMudmlufSBpcyBub3Qgb2YgdHlwZSBwMndwa2g6ICR7cHJldk91dFR5cGV9YCk7XG4gICAgICB9XG4gICAgICB0Zk1lc3NhZ2UodHlwZWZvcmNlLnZhbHVlKHVuZGVmaW5lZCksIHNpZ25QYXJhbXMud2l0bmVzc1NjcmlwdCwgYCR7cG9zVHlwZX0gcmVxdWlyZXMgTk8gd2l0bmVzc1NjcmlwdGApO1xuICAgICAgdGZNZXNzYWdlKHR5cGVmb3JjZS52YWx1ZSh1bmRlZmluZWQpLCBzaWduUGFyYW1zLnJlZGVlbVNjcmlwdCwgYCR7cG9zVHlwZX0gcmVxdWlyZXMgTk8gcmVkZWVtU2NyaXB0YCk7XG4gICAgICB0Zk1lc3NhZ2UodHlwZXMuU2F0b3NoaSwgc2lnblBhcmFtcy53aXRuZXNzVmFsdWUsIGAke3Bvc1R5cGV9IHJlcXVpcmVzIHdpdG5lc3NWYWx1ZWApO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAncDJtcyc6XG4gICAgICBpZiAocHJldk91dFR5cGUgJiYgcHJldk91dFR5cGUgIT09ICdtdWx0aXNpZycpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgaW5wdXQgIyR7c2lnblBhcmFtcy52aW59IGlzIG5vdCBvZiB0eXBlIHAybXM6ICR7cHJldk91dFR5cGV9YCk7XG4gICAgICB9XG4gICAgICB0Zk1lc3NhZ2UodHlwZWZvcmNlLnZhbHVlKHVuZGVmaW5lZCksIHNpZ25QYXJhbXMud2l0bmVzc1NjcmlwdCwgYCR7cG9zVHlwZX0gcmVxdWlyZXMgTk8gd2l0bmVzc1NjcmlwdGApO1xuICAgICAgdGZNZXNzYWdlKHR5cGVmb3JjZS52YWx1ZSh1bmRlZmluZWQpLCBzaWduUGFyYW1zLnJlZGVlbVNjcmlwdCwgYCR7cG9zVHlwZX0gcmVxdWlyZXMgTk8gcmVkZWVtU2NyaXB0YCk7XG4gICAgICB0Zk1lc3NhZ2UodHlwZWZvcmNlLnZhbHVlKHVuZGVmaW5lZCksIHNpZ25QYXJhbXMud2l0bmVzc1ZhbHVlLCBgJHtwb3NUeXBlfSByZXF1aXJlcyBOTyB3aXRuZXNzVmFsdWVgKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ3Ayc2gtcDJ3cGtoJzpcbiAgICAgIGlmIChwcmV2T3V0VHlwZSAmJiBwcmV2T3V0VHlwZSAhPT0gJ3NjcmlwdGhhc2gnKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYGlucHV0ICMke3NpZ25QYXJhbXMudmlufSBpcyBub3Qgb2YgdHlwZSBwMnNoLXAyd3BraDogJHtwcmV2T3V0VHlwZX1gKTtcbiAgICAgIH1cbiAgICAgIHRmTWVzc2FnZSh0eXBlZm9yY2UudmFsdWUodW5kZWZpbmVkKSwgc2lnblBhcmFtcy53aXRuZXNzU2NyaXB0LCBgJHtwb3NUeXBlfSByZXF1aXJlcyBOTyB3aXRuZXNzU2NyaXB0YCk7XG4gICAgICB0Zk1lc3NhZ2UodHlwZWZvcmNlLkJ1ZmZlciwgc2lnblBhcmFtcy5yZWRlZW1TY3JpcHQsIGAke3Bvc1R5cGV9IHJlcXVpcmVzIHJlZGVlbVNjcmlwdGApO1xuICAgICAgdGZNZXNzYWdlKHR5cGVzLlNhdG9zaGksIHNpZ25QYXJhbXMud2l0bmVzc1ZhbHVlLCBgJHtwb3NUeXBlfSByZXF1aXJlcyB3aXRuZXNzVmFsdWVgKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ3Ayc2gtcDJtcyc6XG4gICAgY2FzZSAncDJzaC1wMnBrJzpcbiAgICBjYXNlICdwMnNoLXAycGtoJzpcbiAgICAgIGlmIChwcmV2T3V0VHlwZSAmJiBwcmV2T3V0VHlwZSAhPT0gJ3NjcmlwdGhhc2gnKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYGlucHV0ICMke3NpZ25QYXJhbXMudmlufSBpcyBub3Qgb2YgdHlwZSAke3Bvc1R5cGV9OiAke3ByZXZPdXRUeXBlfWApO1xuICAgICAgfVxuICAgICAgdGZNZXNzYWdlKHR5cGVmb3JjZS52YWx1ZSh1bmRlZmluZWQpLCBzaWduUGFyYW1zLndpdG5lc3NTY3JpcHQsIGAke3Bvc1R5cGV9IHJlcXVpcmVzIE5PIHdpdG5lc3NTY3JpcHRgKTtcbiAgICAgIHRmTWVzc2FnZSh0eXBlZm9yY2UuQnVmZmVyLCBzaWduUGFyYW1zLnJlZGVlbVNjcmlwdCwgYCR7cG9zVHlwZX0gcmVxdWlyZXMgcmVkZWVtU2NyaXB0YCk7XG4gICAgICB0Zk1lc3NhZ2UodHlwZWZvcmNlLnZhbHVlKHVuZGVmaW5lZCksIHNpZ25QYXJhbXMud2l0bmVzc1ZhbHVlLCBgJHtwb3NUeXBlfSByZXF1aXJlcyBOTyB3aXRuZXNzVmFsdWVgKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ3Ayd3NoLXAybXMnOlxuICAgIGNhc2UgJ3Ayd3NoLXAycGsnOlxuICAgIGNhc2UgJ3Ayd3NoLXAycGtoJzpcbiAgICAgIGlmIChwcmV2T3V0VHlwZSAmJiBwcmV2T3V0VHlwZSAhPT0gJ3dpdG5lc3NzY3JpcHRoYXNoJykge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBpbnB1dCAjJHtzaWduUGFyYW1zLnZpbn0gaXMgbm90IG9mIHR5cGUgJHtwb3NUeXBlfTogJHtwcmV2T3V0VHlwZX1gKTtcbiAgICAgIH1cbiAgICAgIHRmTWVzc2FnZSh0eXBlZm9yY2UuQnVmZmVyLCBzaWduUGFyYW1zLndpdG5lc3NTY3JpcHQsIGAke3Bvc1R5cGV9IHJlcXVpcmVzIHdpdG5lc3NTY3JpcHRgKTtcbiAgICAgIHRmTWVzc2FnZSh0eXBlZm9yY2UudmFsdWUodW5kZWZpbmVkKSwgc2lnblBhcmFtcy5yZWRlZW1TY3JpcHQsIGAke3Bvc1R5cGV9IHJlcXVpcmVzIE5PIHJlZGVlbVNjcmlwdGApO1xuICAgICAgdGZNZXNzYWdlKHR5cGVzLlNhdG9zaGksIHNpZ25QYXJhbXMud2l0bmVzc1ZhbHVlLCBgJHtwb3NUeXBlfSByZXF1aXJlcyB3aXRuZXNzVmFsdWVgKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ3Ayc2gtcDJ3c2gtcDJtcyc6XG4gICAgY2FzZSAncDJzaC1wMndzaC1wMnBrJzpcbiAgICBjYXNlICdwMnNoLXAyd3NoLXAycGtoJzpcbiAgICAgIGlmIChwcmV2T3V0VHlwZSAmJiBwcmV2T3V0VHlwZSAhPT0gJ3NjcmlwdGhhc2gnKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYGlucHV0ICMke3NpZ25QYXJhbXMudmlufSBpcyBub3Qgb2YgdHlwZSAke3Bvc1R5cGV9OiAke3ByZXZPdXRUeXBlfWApO1xuICAgICAgfVxuICAgICAgdGZNZXNzYWdlKHR5cGVmb3JjZS5CdWZmZXIsIHNpZ25QYXJhbXMud2l0bmVzc1NjcmlwdCwgYCR7cG9zVHlwZX0gcmVxdWlyZXMgd2l0bmVzc1NjcmlwdGApO1xuICAgICAgdGZNZXNzYWdlKHR5cGVmb3JjZS5CdWZmZXIsIHNpZ25QYXJhbXMucmVkZWVtU2NyaXB0LCBgJHtwb3NUeXBlfSByZXF1aXJlcyB3aXRuZXNzU2NyaXB0YCk7XG4gICAgICB0Zk1lc3NhZ2UodHlwZXMuU2F0b3NoaSwgc2lnblBhcmFtcy53aXRuZXNzVmFsdWUsIGAke3Bvc1R5cGV9IHJlcXVpcmVzIHdpdG5lc3NTY3JpcHRgKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ3AydHInOlxuICAgICAgaWYgKHByZXZPdXRUeXBlICYmIHByZXZPdXRUeXBlICE9PSAndGFwcm9vdCcpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgaW5wdXQgIyR7c2lnblBhcmFtcy52aW59IGlzIG5vdCBvZiB0eXBlICR7cG9zVHlwZX06ICR7cHJldk91dFR5cGV9YCk7XG4gICAgICB9XG4gICAgICB0Zk1lc3NhZ2UodHlwZWZvcmNlLnZhbHVlKHVuZGVmaW5lZCksIHNpZ25QYXJhbXMud2l0bmVzc1NjcmlwdCwgYCR7cG9zVHlwZX0gcmVxdWlyZXMgTk8gd2l0bmVzc1NjcmlwdGApO1xuICAgICAgdGZNZXNzYWdlKHR5cGVmb3JjZS52YWx1ZSh1bmRlZmluZWQpLCBzaWduUGFyYW1zLnJlZGVlbVNjcmlwdCwgYCR7cG9zVHlwZX0gcmVxdWlyZXMgTk8gcmVkZWVtU2NyaXB0YCk7XG4gICAgICB0Zk1lc3NhZ2UodHlwZWZvcmNlLnZhbHVlKHVuZGVmaW5lZCksIHNpZ25QYXJhbXMud2l0bmVzc1ZhbHVlLCBgJHtwb3NUeXBlfSByZXF1aXJlcyBOTyB3aXRuZXNzVmFsdWVgKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ3AydHItcDJucyc6XG4gICAgICBpZiAocHJldk91dFR5cGUgJiYgcHJldk91dFR5cGUgIT09ICd0YXByb290Jykge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBpbnB1dCAjJHtzaWduUGFyYW1zLnZpbn0gaXMgbm90IG9mIHR5cGUgJHtwb3NUeXBlfTogJHtwcmV2T3V0VHlwZX1gKTtcbiAgICAgIH1cbiAgICAgIGlucHV0c1tzaWduUGFyYW1zLnZpbl0ucHJldk91dFR5cGUgPSBpbnB1dHNbc2lnblBhcmFtcy52aW5dLnByZXZPdXRUeXBlIHx8ICd0YXByb290JztcbiAgICAgIHRmTWVzc2FnZSh0eXBlZm9yY2UuQnVmZmVyLCBzaWduUGFyYW1zLndpdG5lc3NTY3JpcHQsIGAke3Bvc1R5cGV9IHJlcXVpcmVzIHdpdG5lc3NTY3JpcHRgKTtcbiAgICAgIHRmTWVzc2FnZSh0eXBlZm9yY2UuQnVmZmVyLCBzaWduUGFyYW1zLmNvbnRyb2xCbG9jaywgYCR7cG9zVHlwZX0gcmVxdWlyZXMgY29udHJvbEJsb2NrYCk7XG4gICAgICB0Zk1lc3NhZ2UodHlwZWZvcmNlLnZhbHVlKHVuZGVmaW5lZCksIHNpZ25QYXJhbXMucmVkZWVtU2NyaXB0LCBgJHtwb3NUeXBlfSByZXF1aXJlcyBOTyByZWRlZW1TY3JpcHRgKTtcbiAgICAgIGJyZWFrO1xuICB9XG59XG5cbmZ1bmN0aW9uIHRyeVNpZ248VE51bWJlciBleHRlbmRzIG51bWJlciB8IGJpZ2ludCA9IG51bWJlcj4oe1xuICBpbnB1dCxcbiAgb3VyUHViS2V5LFxuICBrZXlQYWlyLFxuICBzaWduYXR1cmVIYXNoLFxuICBoYXNoVHlwZSxcbiAgdXNlTG93UixcbiAgdGFwdHJlZVJvb3QsXG59OiBTaWduaW5nRGF0YTxUTnVtYmVyPik6IHZvaWQge1xuICBpZiAoaW5wdXQud2l0bmVzc1ZlcnNpb24gPT09IDEgJiYgb3VyUHViS2V5Lmxlbmd0aCA9PT0gMzMpIG91clB1YktleSA9IG91clB1YktleS5zbGljZSgxKTtcbiAgLy8gZW5mb3JjZSBpbiBvcmRlciBzaWduaW5nIG9mIHB1YmxpYyBrZXlzXG4gIGxldCBzaWduZWQgPSBmYWxzZTtcbiAgZm9yIChjb25zdCBbaSwgcHViS2V5XSBvZiBpbnB1dC5wdWJrZXlzIS5lbnRyaWVzKCkpIHtcbiAgICBpZiAoIW91clB1YktleS5lcXVhbHMocHViS2V5ISkpIGNvbnRpbnVlO1xuICAgIGlmIChpbnB1dC5zaWduYXR1cmVzIVtpXSAmJiBpbnB1dC5zaWduYXR1cmVzIVtpXSEubGVuZ3RoID4gMCkgdGhyb3cgbmV3IEVycm9yKCdTaWduYXR1cmUgYWxyZWFkeSBleGlzdHMnKTtcblxuICAgIC8vIFRPRE86IGFkZCB0ZXN0c1xuICAgIGlmIChvdXJQdWJLZXkubGVuZ3RoICE9PSAzMyAmJiBpbnB1dC53aXRuZXNzVmVyc2lvbiA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdCSVAxNDMgKFdpdG5lc3MgdjApIGlucHV0cyByZXF1aXJlIGNvbXByZXNzZWQgcHVia2V5cycpO1xuICAgIH0gZWxzZSBpZiAob3VyUHViS2V5Lmxlbmd0aCAhPT0gMzIgJiYgaW5wdXQud2l0bmVzc1ZlcnNpb24gPT09IDEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQklQMzQxIChXaXRuZXNzIHYxKSBpbnB1dHMgcmVxdWlyZSB4LW9ubHkgcHVia2V5cycpO1xuICAgIH1cblxuICAgIGlmIChpbnB1dC53aXRuZXNzVmVyc2lvbiA9PT0gMSkge1xuICAgICAgaWYgKCFpbnB1dC53aXRuZXNzU2NyaXB0KSB7XG4gICAgICAgIC8vIEZJWE1FOiBXb3JrYXJvdW5kIGZvciBub3QgaGF2aW5nIHByb3BlciB0d2Vha2luZyBzdXBwb3J0IGZvciBrZXkgcGF0aFxuICAgICAgICBpZiAoIWtleVBhaXIucHJpdmF0ZUtleSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgdW5leHBlY3RlZCBrZXlwYWlyYCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcHJpdmF0ZUtleSA9IHRhcHJvb3QudGFwVHdlYWtQcml2a2V5KGVjY0xpYiwgb3VyUHViS2V5LCBrZXlQYWlyLnByaXZhdGVLZXksIHRhcHRyZWVSb290KTtcbiAgICAgICAga2V5UGFpciA9IEVDUGFpci5mcm9tUHJpdmF0ZUtleShCdWZmZXIuZnJvbShwcml2YXRlS2V5KSk7XG4gICAgICB9XG4gICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vYml0Y29pbi9iaXBzL2Jsb2IvbWFzdGVyL2JpcC0wMzQxLm1lZGlhd2lraSNjb21tb24tc2lnbmF0dXJlLW1lc3NhZ2VcbiAgICAgIGNvbnN0IHNpZ25hdHVyZSA9IGtleVBhaXIuc2lnblNjaG5vcnIoc2lnbmF0dXJlSGFzaCk7XG4gICAgICAvLyBTSUdIQVNIX0RFRkFVTFQgaXMgb21pdHRlZCBmcm9tIHRoZSBzaWduYXR1cmVcbiAgICAgIGlmIChoYXNoVHlwZSA9PT0gVHJhbnNhY3Rpb24uU0lHSEFTSF9ERUZBVUxUKSB7XG4gICAgICAgIGlucHV0LnNpZ25hdHVyZXMhW2ldID0gQnVmZmVyLmZyb20oc2lnbmF0dXJlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlucHV0LnNpZ25hdHVyZXMhW2ldID0gQnVmZmVyLmNvbmNhdChbc2lnbmF0dXJlLCBCdWZmZXIub2YoaGFzaFR5cGUpXSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHNpZ25hdHVyZSA9IGtleVBhaXIuc2lnbihzaWduYXR1cmVIYXNoLCB1c2VMb3dSKTtcbiAgICAgIGlucHV0LnNpZ25hdHVyZXMhW2ldID0gYnNjcmlwdC5zaWduYXR1cmUuZW5jb2RlKHNpZ25hdHVyZSwgaGFzaFR5cGUpO1xuICAgIH1cbiAgICBzaWduZWQgPSB0cnVlO1xuICB9XG5cbiAgaWYgKCFzaWduZWQpIHRocm93IG5ldyBFcnJvcignS2V5IHBhaXIgY2Fubm90IHNpZ24gZm9yIHRoaXMgaW5wdXQnKTtcbn1cblxuaW50ZXJmYWNlIFNpZ25pbmdEYXRhPFROdW1iZXIgZXh0ZW5kcyBudW1iZXIgfCBiaWdpbnQgPSBudW1iZXI+IHtcbiAgaW5wdXQ6IFR4YklucHV0PFROdW1iZXI+O1xuICBvdXJQdWJLZXk6IEJ1ZmZlcjtcbiAga2V5UGFpcjogU2lnbmVyO1xuICBzaWduYXR1cmVIYXNoOiBCdWZmZXI7XG4gIGhhc2hUeXBlOiBudW1iZXI7XG4gIHVzZUxvd1I6IGJvb2xlYW47XG4gIHRhcHRyZWVSb290PzogQnVmZmVyO1xufVxuXG50eXBlIEhhc2hUeXBlQ2hlY2sgPSAoaGFzaFR5cGU6IG51bWJlcikgPT4gYm9vbGVhbjtcblxuZnVuY3Rpb24gZ2V0U2lnbmluZ0RhdGE8VE51bWJlciBleHRlbmRzIG51bWJlciB8IGJpZ2ludCA9IG51bWJlcj4oXG4gIG5ldHdvcms6IE5ldHdvcmssXG4gIGlucHV0czogQXJyYXk8VHhiSW5wdXQ8VE51bWJlcj4+LFxuICBuZWVkc091dHB1dHM6IEhhc2hUeXBlQ2hlY2ssXG4gIHR4OiBUcmFuc2FjdGlvbjxUTnVtYmVyPixcbiAgc2lnblBhcmFtczogbnVtYmVyIHwgVHhiU2lnbkFyZzxUTnVtYmVyPixcbiAga2V5UGFpcj86IFNpZ25lcixcbiAgcmVkZWVtU2NyaXB0PzogQnVmZmVyLFxuICBoYXNoVHlwZT86IG51bWJlcixcbiAgd2l0bmVzc1ZhbHVlPzogVE51bWJlcixcbiAgd2l0bmVzc1NjcmlwdD86IEJ1ZmZlcixcbiAgY29udHJvbEJsb2NrPzogQnVmZmVyLFxuICBhbm5leD86IEJ1ZmZlcixcbiAgdXNlTG93Uj86IGJvb2xlYW5cbik6IFNpZ25pbmdEYXRhPFROdW1iZXI+IHtcbiAgbGV0IHZpbjogbnVtYmVyO1xuICBpZiAodHlwZW9mIHNpZ25QYXJhbXMgPT09ICdudW1iZXInKSB7XG4gICAgY29uc29sZS53YXJuKFxuICAgICAgJ0RFUFJFQ0FURUQ6IFRyYW5zYWN0aW9uQnVpbGRlciBzaWduIG1ldGhvZCBhcmd1bWVudHMgJyArICd3aWxsIGNoYW5nZSBpbiB2NiwgcGxlYXNlIHVzZSB0aGUgVHhiU2lnbkFyZyBpbnRlcmZhY2UnXG4gICAgKTtcbiAgICB2aW4gPSBzaWduUGFyYW1zO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBzaWduUGFyYW1zID09PSAnb2JqZWN0Jykge1xuICAgIGNoZWNrU2lnbkFyZ3M8VE51bWJlcj4oaW5wdXRzLCBzaWduUGFyYW1zKTtcbiAgICAoeyB2aW4sIGtleVBhaXIsIHJlZGVlbVNjcmlwdCwgaGFzaFR5cGUsIHdpdG5lc3NWYWx1ZSwgd2l0bmVzc1NjcmlwdCwgY29udHJvbEJsb2NrLCBhbm5leCB9ID0gc2lnblBhcmFtcyk7XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVHJhbnNhY3Rpb25CdWlsZGVyIHNpZ24gZmlyc3QgYXJnIG11c3QgYmUgVHhiU2lnbkFyZyBvciBudW1iZXInKTtcbiAgfVxuICBpZiAoa2V5UGFpciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdzaWduIHJlcXVpcmVzIGtleXBhaXInKTtcbiAgfVxuICBpZiAoIWlucHV0c1t2aW5dKSB0aHJvdyBuZXcgRXJyb3IoJ05vIGlucHV0IGF0IGluZGV4OiAnICsgdmluKTtcblxuICBjb25zdCBpbnB1dCA9IGlucHV0c1t2aW5dO1xuXG4gIC8vIGlmIHJlZGVlbVNjcmlwdCB3YXMgcHJldmlvdXNseSBwcm92aWRlZCwgZW5mb3JjZSBjb25zaXN0ZW5jeVxuICBpZiAoaW5wdXQucmVkZWVtU2NyaXB0ICE9PSB1bmRlZmluZWQgJiYgcmVkZWVtU2NyaXB0ICYmICFpbnB1dC5yZWRlZW1TY3JpcHQuZXF1YWxzKHJlZGVlbVNjcmlwdCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0luY29uc2lzdGVudCByZWRlZW1TY3JpcHQnKTtcbiAgfVxuXG4gIGNvbnN0IG91clB1YktleSA9IGtleVBhaXIucHVibGljS2V5IHx8IChrZXlQYWlyLmdldFB1YmxpY0tleSAmJiBrZXlQYWlyLmdldFB1YmxpY0tleSgpKTtcbiAgaWYgKCFjYW5TaWduPFROdW1iZXI+KGlucHV0KSkge1xuICAgIGlmICh3aXRuZXNzVmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgaWYgKGlucHV0LnZhbHVlICE9PSB1bmRlZmluZWQgJiYgaW5wdXQudmFsdWUgIT09IHdpdG5lc3NWYWx1ZSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0lucHV0IGRpZCBub3QgbWF0Y2ggd2l0bmVzc1ZhbHVlJyk7XG4gICAgICB9XG4gICAgICB0eXBlZm9yY2UodHlwZXMuU2F0b3NoaSwgd2l0bmVzc1ZhbHVlKTtcbiAgICAgIGlucHV0LnZhbHVlID0gd2l0bmVzc1ZhbHVlO1xuICAgIH1cblxuICAgIGlmICghY2FuU2lnbjxUTnVtYmVyPihpbnB1dCkpIHtcbiAgICAgIGNvbnN0IHByZXBhcmVkID0gcHJlcGFyZUlucHV0PFROdW1iZXI+KGlucHV0LCBvdXJQdWJLZXksIHJlZGVlbVNjcmlwdCwgd2l0bmVzc1NjcmlwdCwgY29udHJvbEJsb2NrLCBhbm5leCk7XG5cbiAgICAgIC8vIHVwZGF0ZXMgaW5saW5lXG4gICAgICBPYmplY3QuYXNzaWduKGlucHV0LCBwcmVwYXJlZCk7XG4gICAgfVxuXG4gICAgaWYgKCFjYW5TaWduPFROdW1iZXI+KGlucHV0KSkgdGhyb3cgRXJyb3IoaW5wdXQucHJldk91dFR5cGUgKyAnIG5vdCBzdXBwb3J0ZWQnKTtcbiAgfVxuXG4gIC8vIGhhc2hUeXBlIGNhbiBiZSAwIGluIFRhcHJvb3QsIHNvIGNhbid0IHVzZSBoYXNoVHlwZSB8fCBTSUdIQVNIX0FMTFxuICBpZiAoaW5wdXQud2l0bmVzc1ZlcnNpb24gPT09IDEpIHtcbiAgICBoYXNoVHlwZSA9IGhhc2hUeXBlID09PSB1bmRlZmluZWQgPyBUcmFuc2FjdGlvbi5TSUdIQVNIX0RFRkFVTFQgOiBoYXNoVHlwZTtcbiAgfSBlbHNlIHtcbiAgICBoYXNoVHlwZSA9IGhhc2hUeXBlIHx8IFRyYW5zYWN0aW9uLlNJR0hBU0hfQUxMO1xuICB9XG4gIGlmIChuZWVkc091dHB1dHMoaGFzaFR5cGUpKSB0aHJvdyBuZXcgRXJyb3IoJ1RyYW5zYWN0aW9uIG5lZWRzIG91dHB1dHMnKTtcblxuICAvLyBUT0RPOiBUaGlzIGlzIG5vdCB0aGUgYmVzdCBwbGFjZSB0byBkbyB0aGlzLCBidXQgbWlnaHQgc3RpY2sgd2l0aCBpdCB1bnRpbCBQU0JUXG4gIGxldCBsZWFmSGFzaDtcbiAgbGV0IHRhcHRyZWVSb290O1xuICBpZiAoY29udHJvbEJsb2NrICYmIHdpdG5lc3NTY3JpcHQpIHtcbiAgICBsZWFmSGFzaCA9IHRhcHJvb3QuZ2V0VGFwbGVhZkhhc2goZWNjTGliLCBjb250cm9sQmxvY2ssIHdpdG5lc3NTY3JpcHQpO1xuICAgIHRhcHRyZWVSb290ID0gdGFwcm9vdC5nZXRUYXB0cmVlUm9vdChlY2NMaWIsIGNvbnRyb2xCbG9jaywgd2l0bmVzc1NjcmlwdCwgbGVhZkhhc2gpO1xuICB9XG5cbiAgLy8gcmVhZHkgdG8gc2lnblxuICBsZXQgc2lnbmF0dXJlSGFzaDogQnVmZmVyO1xuICBzd2l0Y2ggKGlucHV0LndpdG5lc3NWZXJzaW9uKSB7XG4gICAgY2FzZSB1bmRlZmluZWQ6XG4gICAgICBzaWduYXR1cmVIYXNoID0gdHguaGFzaEZvclNpZ25hdHVyZSh2aW4sIGlucHV0LnNpZ25TY3JpcHQgYXMgQnVmZmVyLCBoYXNoVHlwZSwgaW5wdXQudmFsdWUpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAwOlxuICAgICAgc2lnbmF0dXJlSGFzaCA9IHR4Lmhhc2hGb3JXaXRuZXNzVjAodmluLCBpbnB1dC5zaWduU2NyaXB0IGFzIEJ1ZmZlciwgaW5wdXQudmFsdWUgYXMgVE51bWJlciwgaGFzaFR5cGUpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAxOlxuICAgICAgc2lnbmF0dXJlSGFzaCA9IHR4Lmhhc2hGb3JXaXRuZXNzVjEoXG4gICAgICAgIHZpbixcbiAgICAgICAgaW5wdXRzLm1hcCgoeyBwcmV2T3V0U2NyaXB0IH0pID0+IHByZXZPdXRTY3JpcHQgYXMgQnVmZmVyKSxcbiAgICAgICAgaW5wdXRzLm1hcCgoeyB2YWx1ZSB9KSA9PiB2YWx1ZSBhcyBUTnVtYmVyKSxcbiAgICAgICAgaGFzaFR5cGUsXG4gICAgICAgIGxlYWZIYXNoXG4gICAgICApO1xuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vuc3VwcG9ydGVkIHdpdG5lc3MgdmVyc2lvbicpO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBpbnB1dCxcbiAgICBvdXJQdWJLZXksXG4gICAga2V5UGFpcixcbiAgICBzaWduYXR1cmVIYXNoLFxuICAgIGhhc2hUeXBlLFxuICAgIHVzZUxvd1I6ICEhdXNlTG93UixcbiAgICB0YXB0cmVlUm9vdCxcbiAgfTtcbn1cbiJdfQ==