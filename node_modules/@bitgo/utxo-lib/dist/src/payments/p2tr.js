"use strict";
// SegWit version 1 P2TR output type for Taproot defined in
// https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki
Object.defineProperty(exports, "__esModule", { value: true });
exports.p2tr = void 0;
const networks_1 = require("../networks");
const bitcoinjs_lib_1 = require("bitcoinjs-lib");
const taproot = require("../taproot");
const noble_ecc_1 = require("../noble_ecc");
const necc = require("@noble/secp256k1");
const typef = require('typeforce');
const OPS = bitcoinjs_lib_1.script.OPS;
const { bech32m } = require('bech32');
const BITCOIN_NETWORK = networks_1.networks.bitcoin;
/**
 * A secp256k1 x coordinate with unknown discrete logarithm used for eliminating
 * keypath spends, equal to SHA256(uncompressedDER(SECP256K1_GENERATOR_POINT)).
 */
const H = Buffer.from('50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0', 'hex');
const EMPTY_BUFFER = Buffer.alloc(0);
function isPlainPubkey(pubKey) {
    if (pubKey.length !== 33)
        return false;
    try {
        return !!necc.Point.fromHex(pubKey);
    }
    catch (e) {
        return false;
    }
}
function isPlainPubkeys(pubkeys) {
    return pubkeys.every(isPlainPubkey);
}
// output: OP_1 {witnessProgram}
function p2tr(a, opts) {
    var _a, _b, _c, _d;
    if (!a.address && !a.pubkey && !a.pubkeys && !(a.redeems && a.redeems.length) && !a.output && !a.witness) {
        throw new TypeError('Not enough data');
    }
    opts = Object.assign({ validate: true }, opts || {});
    if (!opts.eccLib)
        throw new Error('ECC Library is required for p2tr.');
    const ecc = opts.eccLib;
    typef({
        network: typef.maybe(typef.Object),
        address: typef.maybe(typef.String),
        // the output script should be a fixed 34 bytes.
        // 1 byte for OP_1 indicating segwit version 1, one byte for 0x20 to push
        // the next 32 bytes, followed by the 32 byte witness program
        output: typef.maybe(typef.BufferN(34)),
        // a single pubkey
        pubkey: typef.maybe(ecc.isXOnlyPoint),
        // the pub key(s) used for keypath signing.
        // aggregated with MuSig2* if > 1
        pubkeys: typef.maybe(typef.anyOf(typef.arrayOf(ecc.isXOnlyPoint), typef.arrayOf(isPlainPubkey))),
        redeems: typef.maybe(typef.arrayOf({
            network: typef.maybe(typef.Object),
            output: typef.maybe(typef.Buffer),
            weight: typef.maybe(typef.Number),
            depth: typef.maybe(typef.Number),
            witness: typef.maybe(typef.arrayOf(typef.Buffer)),
        })),
        redeemIndex: typef.maybe(typef.Number),
        signature: typef.maybe(bitcoinjs_lib_1.script.isCanonicalSchnorrSignature),
        controlBlock: typef.maybe(typef.Buffer),
        annex: typef.maybe(typef.Buffer),
    }, a);
    const _address = bitcoinjs_lib_1.lazy.value(() => {
        if (!a.address)
            return undefined;
        const result = bech32m.decode(a.address);
        const version = result.words.shift();
        const data = bech32m.fromWords(result.words);
        return {
            version,
            prefix: result.prefix,
            data: Buffer.from(data),
        };
    });
    const _outputPubkey = bitcoinjs_lib_1.lazy.value(() => {
        // we remove the first two bytes (OP_1 0x20) from the output script to
        // extract the 32 byte taproot pubkey (aka witness program)
        return a.output && a.output.slice(2);
    });
    const network = a.network || BITCOIN_NETWORK;
    const o = { network };
    const _taprootPaths = bitcoinjs_lib_1.lazy.value(() => {
        if (!a.redeems)
            return;
        if (o.tapTree) {
            return taproot.getDepthFirstTaptree(o.tapTree);
        }
        const outputs = a.redeems.map(({ output }) => output);
        if (!outputs.every((output) => output))
            return;
        return taproot.getHuffmanTaptree(outputs, a.redeems.map(({ weight }) => weight));
    });
    const _parsedWitness = bitcoinjs_lib_1.lazy.value(() => {
        if (!a.witness)
            return;
        return taproot.parseTaprootWitness(a.witness);
    });
    const _parsedControlBlock = bitcoinjs_lib_1.lazy.value(() => {
        // Can't use o.controlBlock, because it could be circular
        if (a.controlBlock)
            return taproot.parseControlBlock(ecc, a.controlBlock);
        const parsedWitness = _parsedWitness();
        if (parsedWitness && parsedWitness.spendType === 'Script') {
            return taproot.parseControlBlock(ecc, parsedWitness.controlBlock);
        }
    });
    bitcoinjs_lib_1.lazy.prop(o, 'internalPubkey', () => {
        var _a;
        if (a.pubkey) {
            // single pubkey
            return a.pubkey;
        }
        else if (a.pubkeys && a.pubkeys.length === 1) {
            return a.pubkeys[0];
        }
        else if (a.pubkeys && a.pubkeys.length > 1) {
            // multiple pubkeys
            if (isPlainPubkeys(a.pubkeys)) {
                return Buffer.from(noble_ecc_1.musig.getXOnlyPubkey(noble_ecc_1.musig.keyAgg(a.pubkeys)));
            }
            return Buffer.from(taproot.aggregateMuSigPubkeys(ecc, a.pubkeys));
        }
        else if (_parsedControlBlock()) {
            return (_a = _parsedControlBlock()) === null || _a === void 0 ? void 0 : _a.internalPubkey;
        }
        else {
            // If there is no key path spending condition, we use an internal key with unknown secret key.
            // TODO: In order to avoid leaking the information that key path spending is not possible it
            // is recommended to pick a fresh integer r in the range 0...n-1 uniformly at random and use
            // H + rG as internal key. It is possible to prove that this internal key does not have a
            // known discrete logarithm with respect to G by revealing r to a verifier who can then
            // reconstruct how the internal key was created.
            return H;
        }
    });
    bitcoinjs_lib_1.lazy.prop(o, 'taptreeRoot', () => {
        var _a;
        const parsedControlBlock = _parsedControlBlock();
        const parsedWitness = _parsedWitness();
        let taptreeRoot;
        // Prefer to get the root via the control block because not all redeems may
        // be available
        if (parsedControlBlock) {
            let tapscript;
            if (parsedWitness && parsedWitness.spendType === 'Script') {
                tapscript = parsedWitness.tapscript;
            }
            else if (o.redeem && o.redeem.output) {
                tapscript = o.redeem.output;
            }
            if (tapscript)
                taptreeRoot = taproot.getTaptreeRoot(ecc, parsedControlBlock, tapscript);
        }
        if (!taptreeRoot && _taprootPaths())
            taptreeRoot = (_a = _taprootPaths()) === null || _a === void 0 ? void 0 : _a.root;
        return taptreeRoot;
    });
    const _taprootPubkey = bitcoinjs_lib_1.lazy.value(() => {
        const taptreeRoot = o.taptreeRoot;
        // Refuse to create an unspendable key
        if (!a.pubkey && !(a.pubkeys && a.pubkeys.length) && !a.redeems && !taptreeRoot) {
            return;
        }
        return taproot.tapTweakPubkey(ecc, o === null || o === void 0 ? void 0 : o.internalPubkey, taptreeRoot);
    });
    bitcoinjs_lib_1.lazy.prop(o, 'tapTree', () => {
        if (!a.redeems)
            return;
        if (a.redeems.find(({ depth }) => depth === undefined)) {
            console.warn('Deprecation Warning: Weight-based tap tree construction will be removed in the future. ' +
                'Please use depth-first coding as specified in BIP-0371.');
            return;
        }
        if (!a.redeems.every(({ output }) => output))
            return;
        return {
            leaves: a.redeems.map(({ output, depth }) => {
                return {
                    script: output,
                    leafVersion: taproot.INITIAL_TAPSCRIPT_VERSION,
                    depth,
                };
            }),
        };
    });
    bitcoinjs_lib_1.lazy.prop(o, 'address', () => {
        var _a;
        const pubkey = _outputPubkey() || (_taprootPubkey() && ((_a = _taprootPubkey()) === null || _a === void 0 ? void 0 : _a.xOnlyPubkey));
        // only encode the 32 byte witness program as bech32m
        const words = bech32m.toWords(pubkey);
        words.unshift(0x01);
        return bech32m.encode(network.bech32, words);
    });
    bitcoinjs_lib_1.lazy.prop(o, 'controlBlock', () => {
        const parsedWitness = _parsedWitness();
        if (parsedWitness && parsedWitness.spendType === 'Script') {
            return parsedWitness.controlBlock;
        }
        const taprootPubkey = _taprootPubkey();
        const taprootPaths = _taprootPaths();
        if (!taprootPaths || !taprootPubkey || a.redeemIndex === undefined)
            return;
        return taproot.getControlBlock(taprootPubkey.parity, o.internalPubkey, taprootPaths.paths[a.redeemIndex]);
    });
    bitcoinjs_lib_1.lazy.prop(o, 'signature', () => {
        const parsedWitness = _parsedWitness();
        if (parsedWitness && parsedWitness.spendType === 'Key') {
            return parsedWitness.signature;
        }
    });
    bitcoinjs_lib_1.lazy.prop(o, 'annex', () => {
        if (!_parsedWitness())
            return;
        return _parsedWitness().annex;
    });
    bitcoinjs_lib_1.lazy.prop(o, 'output', () => {
        if (a.address) {
            const { data } = _address();
            return bitcoinjs_lib_1.script.compile([OPS.OP_1, data]);
        }
        const taprootPubkey = _taprootPubkey();
        if (!taprootPubkey)
            return;
        // OP_1 indicates segwit version 1
        return bitcoinjs_lib_1.script.compile([OPS.OP_1, Buffer.from(taprootPubkey.xOnlyPubkey)]);
    });
    bitcoinjs_lib_1.lazy.prop(o, 'witness', () => {
        if (!a.redeems) {
            if (a.signature)
                return [a.signature]; // Keypath spend
            return;
        }
        else if (!o.redeem) {
            return; // No chosen redeem script, can't make witness
        }
        else if (!o.controlBlock) {
            return;
        }
        let redeemWitness;
        // some callers may provide witness elements in the input script
        if (o.redeem.input && o.redeem.input.length > 0 && o.redeem.output && o.redeem.output.length > 0) {
            // transform redeem input to witness stack
            redeemWitness = bitcoinjs_lib_1.script.toStack(bitcoinjs_lib_1.script.decompile(o.redeem.input));
            // assigns a new object to o.redeem
            o.redeems[a.redeemIndex] = Object.assign({ witness: redeemWitness }, o.redeem);
            o.redeem.input = EMPTY_BUFFER;
        }
        else if (o.redeem.output && o.redeem.output.length > 0 && o.redeem.witness && o.redeem.witness.length > 0) {
            redeemWitness = o.redeem.witness;
        }
        else {
            return;
        }
        const witness = [...redeemWitness, o.redeem.output, o.controlBlock];
        if (a.annex) {
            witness.push(a.annex);
        }
        return witness;
    });
    bitcoinjs_lib_1.lazy.prop(o, 'name', () => {
        const nameParts = ['p2tr'];
        return nameParts.join('-');
    });
    bitcoinjs_lib_1.lazy.prop(o, 'redeem', () => {
        if (a.redeems) {
            if (a.redeemIndex === undefined)
                return;
            return a.redeems[a.redeemIndex];
        }
        const parsedWitness = _parsedWitness();
        if (parsedWitness && parsedWitness.spendType === 'Script') {
            return {
                witness: parsedWitness.scriptSig,
                output: parsedWitness.tapscript,
            };
        }
    });
    // extended validation
    if (opts.validate) {
        const taprootPubkey = _taprootPubkey();
        if (a.output) {
            if (a.output[0] !== OPS.OP_1 || a.output[1] !== 0x20) {
                throw new TypeError('Output is invalid');
            }
            // if we're passed both an output script and an address, ensure they match
            if (a.address && _outputPubkey && !((_a = _outputPubkey()) === null || _a === void 0 ? void 0 : _a.equals((_b = _address()) === null || _b === void 0 ? void 0 : _b.data))) {
                throw new TypeError('mismatch between address & output');
            }
            // Wrapping `taprootPubkey.xOnlyPubkey` in Buffer because of a peculiar issue in the frontend
            // where a polyfill for Buffer is used. Refer: https://bitgoinc.atlassian.net/browse/BG-61420
            if (taprootPubkey && _outputPubkey && !((_c = _outputPubkey()) === null || _c === void 0 ? void 0 : _c.equals(Buffer.from(taprootPubkey.xOnlyPubkey)))) {
                throw new TypeError('mismatch between output and taproot pubkey');
            }
        }
        if (a.address) {
            if (taprootPubkey && !((_d = _address()) === null || _d === void 0 ? void 0 : _d.data.equals(Buffer.from(taprootPubkey.xOnlyPubkey)))) {
                throw new TypeError('mismatch between address and taproot pubkey');
            }
        }
        const parsedControlBlock = _parsedControlBlock();
        if (parsedControlBlock) {
            if (!parsedControlBlock.internalPubkey.equals(o === null || o === void 0 ? void 0 : o.internalPubkey)) {
                throw new TypeError('Internal pubkey mismatch');
            }
            if (taprootPubkey && parsedControlBlock.parity !== taprootPubkey.parity) {
                throw new TypeError('Parity mismatch');
            }
        }
        if (a.redeems) {
            if (!a.redeems.length)
                throw new TypeError('Empty redeems');
            if (a.redeemIndex !== undefined && (a.redeemIndex < 0 || a.redeemIndex >= a.redeems.length)) {
                throw new TypeError('invalid redeem index');
            }
            a.redeems.forEach((redeem) => {
                if (redeem.network && redeem.network !== network) {
                    throw new TypeError('Network mismatch');
                }
            });
        }
        const chosenRedeem = a.redeems && a.redeemIndex !== undefined && a.redeems[a.redeemIndex];
        const parsedWitness = _parsedWitness();
        if (parsedWitness && parsedWitness.spendType === 'Key') {
            if (a.controlBlock) {
                throw new TypeError('unexpected control block for key path');
            }
            if (a.signature && !a.signature.equals(parsedWitness.signature)) {
                throw new TypeError('mismatch between witness & signature');
            }
        }
        if (parsedWitness && parsedWitness.spendType === 'Script') {
            if (a.signature) {
                throw new TypeError('unexpected signature with script path witness');
            }
            if (a.controlBlock && !a.controlBlock.equals(parsedWitness.controlBlock)) {
                throw new TypeError('control block mismatch');
            }
            if (a.annex && parsedWitness.annex && !a.annex.equals(parsedWitness.annex)) {
                throw new TypeError('annex mismatch');
            }
            if (chosenRedeem && chosenRedeem.output && !chosenRedeem.output.equals(parsedWitness.tapscript)) {
                throw new TypeError('tapscript mismatch');
            }
        }
    }
    return Object.assign(o, a);
}
exports.p2tr = p2tr;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicDJ0ci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9wYXltZW50cy9wMnRyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSwyREFBMkQ7QUFDM0QsaUVBQWlFOzs7QUFFakUsMENBQXVDO0FBQ3ZDLGlEQUE4RTtBQUM5RSxzQ0FBc0M7QUFDdEMsNENBQXFDO0FBQ3JDLHlDQUF5QztBQUV6QyxNQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUM7QUFDbkMsTUFBTSxHQUFHLEdBQUcsc0JBQU8sQ0FBQyxHQUFHLENBQUM7QUFFeEIsTUFBTSxFQUFFLE9BQU8sRUFBRSxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUV0QyxNQUFNLGVBQWUsR0FBRyxtQkFBUSxDQUFDLE9BQU8sQ0FBQztBQUV6Qzs7O0dBR0c7QUFDSCxNQUFNLENBQUMsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLGtFQUFrRSxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ2pHLE1BQU0sWUFBWSxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFFckMsU0FBUyxhQUFhLENBQUMsTUFBa0I7SUFDdkMsSUFBSSxNQUFNLENBQUMsTUFBTSxLQUFLLEVBQUU7UUFBRSxPQUFPLEtBQUssQ0FBQztJQUN2QyxJQUFJO1FBQ0YsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7S0FDckM7SUFBQyxPQUFPLENBQUMsRUFBRTtRQUNWLE9BQU8sS0FBSyxDQUFDO0tBQ2Q7QUFDSCxDQUFDO0FBRUQsU0FBUyxjQUFjLENBQUMsT0FBaUI7SUFDdkMsT0FBTyxPQUFPLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0FBQ3RDLENBQUM7QUFFRCxnQ0FBZ0M7QUFDaEMsU0FBZ0IsSUFBSSxDQUFDLENBQVUsRUFBRSxJQUFrQjs7SUFDakQsSUFBSSxDQUFDLENB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Q0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsRUFBRTtnQkFDL0YsTUFBTSxJQUFJLFNBQVMsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO2FBQzNDO1NBQ0Y7S0FDRjtJQUVELE9BQU8sTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDN0IsQ0FBQztBQS9VRCxvQkErVUMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBTZWdXaXQgdmVyc2lvbiAxIFAyVFIgb3V0cHV0IHR5cGUgZm9yIFRhcHJvb3QgZGVmaW5lZCBpblxuLy8gaHR0cHM6Ly9naXRodWIuY29tL2JpdGNvaW4vYmlwcy9ibG9iL21hc3Rlci9iaXAtMDM0MS5tZWRpYXdpa2lcblxuaW1wb3J0IHsgbmV0d29ya3MgfSBmcm9tICcuLi9uZXR3b3Jrcyc7XG5pbXBvcnQgeyBzY3JpcHQgYXMgYnNjcmlwdCwgUGF5bWVudCwgUGF5bWVudE9wdHMsIGxhenkgfSBmcm9tICdiaXRjb2luanMtbGliJztcbmltcG9ydCAqIGFzIHRhcHJvb3QgZnJvbSAnLi4vdGFwcm9vdCc7XG5pbXBvcnQgeyBtdXNpZyB9IGZyb20gJy4uL25vYmxlX2VjYyc7XG5pbXBvcnQgKiBhcyBuZWNjIGZyb20gJ0Bub2JsZS9zZWNwMjU2azEnO1xuXG5jb25zdCB0eXBlZiA9IHJlcXVpcmUoJ3R5cGVmb3JjZScpO1xuY29uc3QgT1BTID0gYnNjcmlwdC5PUFM7XG5cbmNvbnN0IHsgYmVjaDMybSB9ID0gcmVxdWlyZSgnYmVjaDMyJyk7XG5cbmNvbnN0IEJJVENPSU5fTkVUV09SSyA9IG5ldHdvcmtzLmJpdGNvaW47XG5cbi8qKlxuICogQSBzZWNwMjU2azEgeCBjb29yZGluYXRlIHdpdGggdW5rbm93biBkaXNjcmV0ZSBsb2dhcml0aG0gdXNlZCBmb3IgZWxpbWluYXRpbmdcbiAqIGtleXBhdGggc3BlbmRzLCBlcXVhbCB0byBTSEEyNTYodW5jb21wcmVzc2VkREVSKFNFQ1AyNTZLMV9HRU5FUkFUT1JfUE9JTlQpKS5cbiAqL1xuY29uc3QgSCA9IEJ1ZmZlci5mcm9tKCc1MDkyOWI3NGMxYTA0OTU0Yjc4YjRiNjAzNWU5N2E1ZTA3OGE1YTBmMjhlYzk2ZDU0N2JmZWU5YWNlODAzYWMwJywgJ2hleCcpO1xuY29uc3QgRU1QVFlfQlVGRkVSID0gQnVmZmVyLmFsbG9jKDApO1xuXG5mdW5jdGlvbiBpc1BsYWluUHVia2V5KHB1YktleTogVWludDhBcnJheSk6IGJvb2xlYW4ge1xuICBpZiAocHViS2V5Lmxlbmd0aCAhPT0gMzMpIHJldHVybiBmYWxzZTtcbiAgdHJ5IHtcbiAgICByZXR1cm4gISFuZWNjLlBvaW50LmZyb21IZXgocHViS2V5KTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc1BsYWluUHVia2V5cyhwdWJrZXlzOiBCdWZmZXJbXSkge1xuICByZXR1cm4gcHVia2V5cy5ldmVyeShpc1BsYWluUHVia2V5KTtcbn1cblxuLy8gb3V0cHV0OiBPUF8xIHt3aXRuZXNzUHJvZ3JhbX1cbmV4cG9ydCBmdW5jdGlvbiBwMnRyKGE6IFBheW1lbnQsIG9wdHM/OiBQYXltZW50T3B0cyk6IFBheW1lbnQge1xuICBpZiAoIWEuYWRkcmVzcyAmJiAhYS5wdWJrZXkgJiYgIWEucHVia2V5cyAmJiAhKGEucmVkZWVtcyAmJiBhLnJlZGVlbXMubGVuZ3RoKSAmJiAhYS5vdXRwdXQgJiYgIWEud2l0bmVzcykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ05vdCBlbm91Z2ggZGF0YScpO1xuICB9XG4gIG9wdHMgPSBPYmplY3QuYXNzaWduKHsgdmFsaWRhdGU6IHRydWUgfSwgb3B0cyB8fCB7fSk7XG5cbiAgaWYgKCFvcHRzLmVjY0xpYikgdGhyb3cgbmV3IEVycm9yKCdFQ0MgTGlicmFyeSBpcyByZXF1aXJlZCBmb3IgcDJ0ci4nKTtcbiAgY29uc3QgZWNjID0gb3B0cy5lY2NMaWI7XG5cbiAgdHlwZWYoXG4gICAge1xuICAgICAgbmV0d29yazogdHlwZWYubWF5YmUodHlwZWYuT2JqZWN0KSxcblxuICAgICAgYWRkcmVzczogdHlwZWYubWF5YmUodHlwZWYuU3RyaW5nKSxcbiAgICAgIC8vIHRoZSBvdXRwdXQgc2NyaXB0IHNob3VsZCBiZSBhIGZpeGVkIDM0IGJ5dGVzLlxuICAgICAgLy8gMSBieXRlIGZvciBPUF8xIGluZGljYXRpbmcgc2Vnd2l0IHZlcnNpb24gMSwgb25lIGJ5dGUgZm9yIDB4MjAgdG8gcHVzaFxuICAgICAgLy8gdGhlIG5leHQgMzIgYnl0ZXMsIGZvbGxvd2VkIGJ5IHRoZSAzMiBieXRlIHdpdG5lc3MgcHJvZ3JhbVxuICAgICAgb3V0cHV0OiB0eXBlZi5tYXliZSh0eXBlZi5CdWZmZXJOKDM0KSksXG4gICAgICAvLyBhIHNpbmdsZSBwdWJrZXlcbiAgICAgIHB1YmtleTogdHlwZWYubWF5YmUoZWNjLmlzWE9ubHlQb2ludCksXG4gICAgICAvLyB0aGUgcHViIGtleShzKSB1c2VkIGZvciBrZXlwYXRoIHNpZ25pbmcuXG4gICAgICAvLyBhZ2dyZWdhdGVkIHdpdGggTXVTaWcyKiBpZiA+IDFcbiAgICAgIHB1YmtleXM6IHR5cGVmLm1heWJlKHR5cGVmLmFueU9mKHR5cGVmLmFycmF5T2YoZWNjLmlzWE9ubHlQb2ludCksIHR5cGVmLmFycmF5T2YoaXNQbGFpblB1YmtleSkpKSxcblxuICAgICAgcmVkZWVtczogdHlwZWYubWF5YmUoXG4gICAgICAgIHR5cGVmLmFycmF5T2Yoe1xuICAgICAgICAgIG5ldHdvcms6IHR5cGVmLm1heWJlKHR5cGVmLk9iamVjdCksXG4gICAgICAgICAgb3V0cHV0OiB0eXBlZi5tYXliZSh0eXBlZi5CdWZmZXIpLFxuICAgICAgICAgIHdlaWdodDogdHlwZWYubWF5YmUodHlwZWYuTnVtYmVyKSxcbiAgICAgICAgICBkZXB0aDogdHlwZWYubWF5YmUodHlwZWYuTnVtYmVyKSxcbiAgICAgICAgICB3aXRuZXNzOiB0eXBlZi5tYXliZSh0eXBlZi5hcnJheU9mKHR5cGVmLkJ1ZmZlcikpLFxuICAgICAgICB9KVxuICAgICAgKSxcbiAgICAgIHJlZGVlbUluZGV4OiB0eXBlZi5tYXliZSh0eXBlZi5OdW1iZXIpLCAvLyBTZWxlY3RzIHRoZSByZWRlZW0gdG8gc3BlbmRcblxuICAgICAgc2lnbmF0dXJlOiB0eXBlZi5tYXliZShic2NyaXB0LmlzQ2Fub25pY2FsU2Nobm9yclNpZ25hdHVyZSksXG4gICAgICBjb250cm9sQmxvY2s6IHR5cGVmLm1heWJlKHR5cGVmLkJ1ZmZlciksXG4gICAgICBhbm5leDogdHlwZWYubWF5YmUodHlwZWYuQnVmZmVyKSxcbiAgICB9LFxuICAgIGFcbiAgKTtcblxuICBjb25zdCBfYWRkcmVzcyA9IGxhenkudmFsdWUoKCkgPT4ge1xuICAgIGlmICghYS5hZGRyZXNzKSByZXR1cm4gdW5kZWZpbmVkO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gYmVjaDMybS5kZWNvZGUoYS5hZGRyZXNzKTtcbiAgICBjb25zdCB2ZXJzaW9uID0gcmVzdWx0LndvcmRzLnNoaWZ0KCk7XG4gICAgY29uc3QgZGF0YSA9IGJlY2gzMm0uZnJvbVdvcmRzKHJlc3VsdC53b3Jkcyk7XG4gICAgcmV0dXJuIHtcbiAgICAgIHZlcnNpb24sXG4gICAgICBwcmVmaXg6IHJlc3VsdC5wcmVmaXgsXG4gICAgICBkYXRhOiBCdWZmZXIuZnJvbShkYXRhKSxcbiAgICB9O1xuICB9KTtcbiAgY29uc3QgX291dHB1dFB1YmtleSA9IGxhenkudmFsdWUoKCkgPT4ge1xuICAgIC8vIHdlIHJlbW92ZSB0aGUgZmlyc3QgdHdvIGJ5dGVzIChPUF8xIDB4MjApIGZyb20gdGhlIG91dHB1dCBzY3JpcHQgdG9cbiAgICAvLyBleHRyYWN0IHRoZSAzMiBieXRlIHRhcHJvb3QgcHVia2V5IChha2Egd2l0bmVzcyBwcm9ncmFtKVxuICAgIHJldHVybiBhLm91dHB1dCAmJiBhLm91dHB1dC5zbGljZSgyKTtcbiAgfSk7XG5cbiAgY29uc3QgbmV0d29yayA9IGEubmV0d29yayB8fCBCSVRDT0lOX05FVFdPUks7XG5cbiAgY29uc3QgbzogUGF5bWVudCA9IHsgbmV0d29yayB9O1xuXG4gIGNvbnN0IF90YXByb290UGF0aHMgPSBsYXp5LnZhbHVlKCgpID0+IHtcbiAgICBpZiAoIWEucmVkZWVtcykgcmV0dXJuO1xuICAgIGlmIChvLnRhcFRyZWUpIHtcbiAgICAgIHJldHVybiB0YXByb290LmdldERlcHRoRmlyc3RUYXB0cmVlKG8udGFwVHJlZSk7XG4gICAgfVxuICAgIGNvbnN0IG91dHB1dHM6IEFycmF5PEJ1ZmZlciB8IHVuZGVmaW5lZD4gPSBhLnJlZGVlbXMubWFwKCh7IG91dHB1dCB9KSA9PiBvdXRwdXQpO1xuICAgIGlmICghb3V0cHV0cy5ldmVyeSgob3V0cHV0KSA9PiBvdXRwdXQpKSByZXR1cm47XG4gICAgcmV0dXJuIHRhcHJvb3QuZ2V0SHVmZm1hblRhcHRyZWUoXG4gICAgICBvdXRwdXRzIGFzIEJ1ZmZlcltdLFxuICAgICAgYS5yZWRlZW1zLm1hcCgoeyB3ZWlnaHQgfSkgPT4gd2VpZ2h0KVxuICAgICk7XG4gIH0pO1xuICBjb25zdCBfcGFyc2VkV2l0bmVzcyA9IGxhenkudmFsdWUoKCkgPT4ge1xuICAgIGlmICghYS53aXRuZXNzKSByZXR1cm47XG4gICAgcmV0dXJuIHRhcHJvb3QucGFyc2VUYXByb290V2l0bmVzcyhhLndpdG5lc3MpO1xuICB9KTtcbiAgY29uc3QgX3BhcnNlZENvbnRyb2xCbG9jayA9IGxhenkudmFsdWUoKCkgPT4ge1xuICAgIC8vIENhbid0IHVzZSBvLmNvbnRyb2xCbG9jaywgYmVjYXVzZSBpdCBjb3VsZCBiZSBjaXJjdWxhclxuICAgIGlmIChhLmNvbnRyb2xCbG9jaykgcmV0dXJuIHRhcHJvb3QucGFyc2VDb250cm9sQmxvY2soZWNjLCBhLmNvbnRyb2xCbG9jayk7XG4gICAgY29uc3QgcGFyc2VkV2l0bmVzcyA9IF9wYXJzZWRXaXRuZXNzKCk7XG4gICAgaWYgKHBhcnNlZFdpdG5lc3MgJiYgcGFyc2VkV2l0bmVzcy5zcGVuZFR5cGUgPT09ICdTY3JpcHQnKSB7XG4gICAgICByZXR1cm4gdGFwcm9vdC5wYXJzZUNvbnRyb2xCbG9jayhlY2MsIHBhcnNlZFdpdG5lc3MuY29udHJvbEJsb2NrKTtcbiAgICB9XG4gIH0pO1xuXG4gIGxhenkucHJvcChvLCAnaW50ZXJuYWxQdWJrZXknLCAoKSA9PiB7XG4gICAgaWYgKGEucHVia2V5KSB7XG4gICAgICAvLyBzaW5nbGUgcHVia2V5XG4gICAgICByZXR1cm4gYS5wdWJrZXk7XG4gICAgfSBlbHNlIGlmIChhLnB1YmtleXMgJiYgYS5wdWJrZXlzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgcmV0dXJuIGEucHVia2V5c1swXTtcbiAgICB9IGVsc2UgaWYgKGEucHVia2V5cyAmJiBhLnB1YmtleXMubGVuZ3RoID4gMSkge1xuICAgICAgLy8gbXVsdGlwbGUgcHVia2V5c1xuICAgICAgaWYgKGlzUGxhaW5QdWJrZXlzKGEucHVia2V5cykpIHtcbiAgICAgICAgcmV0dXJuIEJ1ZmZlci5mcm9tKG11c2lnLmdldFhPbmx5UHVia2V5KG11c2lnLmtleUFnZyhhLnB1YmtleXMpKSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBCdWZmZXIuZnJvbSh0YXByb290LmFnZ3JlZ2F0ZU11U2lnUHVia2V5cyhlY2MsIGEucHVia2V5cykpO1xuICAgIH0gZWxzZSBpZiAoX3BhcnNlZENvbnRyb2xCbG9jaygpKSB7XG4gICAgICByZXR1cm4gX3BhcnNlZENvbnRyb2xCbG9jaygpPy5pbnRlcm5hbFB1YmtleTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gSWYgdGhlcmUgaXMgbm8ga2V5IHBhdGggc3BlbmRpbmcgY29uZGl0aW9uLCB3ZSB1c2UgYW4gaW50ZXJuYWwga2V5IHdpdGggdW5rbm93biBzZWNyZXQga2V5LlxuICAgICAgLy8gVE9ETzogSW4gb3JkZXIgdG8gYXZvaWQgbGVha2luZyB0aGUgaW5mb3JtYXRpb24gdGhhdCBrZXkgcGF0aCBzcGVuZGluZyBpcyBub3QgcG9zc2libGUgaXRcbiAgICAgIC8vIGlzIHJlY29tbWVuZGVkIHRvIHBpY2sgYSBmcmVzaCBpbnRlZ2VyIHIgaW4gdGhlIHJhbmdlIDAuLi5uLTEgdW5pZm9ybWx5IGF0IHJhbmRvbSBhbmQgdXNlXG4gICAgICAvLyBIICsgckcgYXMgaW50ZXJuYWwga2V5LiBJdCBpcyBwb3NzaWJsZSB0byBwcm92ZSB0aGF0IHRoaXMgaW50ZXJuYWwga2V5IGRvZXMgbm90IGhhdmUgYVxuICAgICAgLy8ga25vd24gZGlzY3JldGUgbG9nYXJpdGhtIHdpdGggcmVzcGVjdCB0byBHIGJ5IHJldmVhbGluZyByIHRvIGEgdmVyaWZpZXIgd2hvIGNhbiB0aGVuXG4gICAgICAvLyByZWNvbnN0cnVjdCBob3cgdGhlIGludGVybmFsIGtleSB3YXMgY3JlYXRlZC5cbiAgICAgIHJldHVybiBIO1xuICAgIH1cbiAgfSk7XG5cbiAgbGF6eS5wcm9wKG8sICd0YXB0cmVlUm9vdCcsICgpID0+IHtcbiAgICBjb25zdCBwYXJzZWRDb250cm9sQmxvY2sgPSBfcGFyc2VkQ29udHJvbEJsb2NrKCk7XG4gICAgY29uc3QgcGFyc2VkV2l0bmVzcyA9IF9wYXJzZWRXaXRuZXNzKCk7XG4gICAgbGV0IHRhcHRyZWVSb290O1xuICAgIC8vIFByZWZlciB0byBnZXQgdGhlIHJvb3QgdmlhIHRoZSBjb250cm9sIGJsb2NrIGJlY2F1c2Ugbm90IGFsbCByZWRlZW1zIG1heVxuICAgIC8vIGJlIGF2YWlsYWJsZVxuICAgIGlmIChwYXJzZWRDb250cm9sQmxvY2spIHtcbiAgICAgIGxldCB0YXBzY3JpcHQ7XG4gICAgICBpZiAocGFyc2VkV2l0bmVzcyAmJiBwYXJzZWRXaXRuZXNzLnNwZW5kVHlwZSA9PT0gJ1NjcmlwdCcpIHtcbiAgICAgICAgdGFwc2NyaXB0ID0gcGFyc2VkV2l0bmVzcy50YXBzY3JpcHQ7XG4gICAgICB9IGVsc2UgaWYgKG8ucmVkZWVtICYmIG8ucmVkZWVtLm91dHB1dCkge1xuICAgICAgICB0YXBzY3JpcHQgPSBvLnJlZGVlbS5vdXRwdXQ7XG4gICAgICB9XG4gICAgICBpZiAodGFwc2NyaXB0KSB0YXB0cmVlUm9vdCA9IHRhcHJvb3QuZ2V0VGFwdHJlZVJvb3QoZWNjLCBwYXJzZWRDb250cm9sQmxvY2ssIHRhcHNjcmlwdCk7XG4gICAgfVxuICAgIGlmICghdGFwdHJlZVJvb3QgJiYgX3RhcHJvb3RQYXRocygpKSB0YXB0cmVlUm9vdCA9IF90YXByb290UGF0aHMoKT8ucm9vdDtcblxuICAgIHJldHVybiB0YXB0cmVlUm9vdDtcbiAgfSk7XG5cbiAgY29uc3QgX3RhcHJvb3RQdWJrZXkgPSBsYXp5LnZhbHVlKCgpID0+IHtcbiAgICBjb25zdCB0YXB0cmVlUm9vdCA9IG8udGFwdHJlZVJvb3Q7XG4gICAgLy8gUmVmdXNlIHRvIGNyZWF0ZSBhbiB1bnNwZW5kYWJsZSBrZXlcbiAgICBpZiAoIWEucHVia2V5ICYmICEoYS5wdWJrZXlzICYmIGEucHVia2V5cy5sZW5ndGgpICYmICFhLnJlZGVlbXMgJiYgIXRhcHRyZWVSb290KSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHJldHVybiB0YXByb290LnRhcFR3ZWFrUHVia2V5KGVjYywgbz8uaW50ZXJuYWxQdWJrZXkgYXMgVWludDhBcnJheSwgdGFwdHJlZVJvb3QpO1xuICB9KTtcblxuICBsYXp5LnByb3AobywgJ3RhcFRyZWUnLCAoKSA9PiB7XG4gICAgaWYgKCFhLnJlZGVlbXMpIHJldHVybjtcbiAgICBpZiAoYS5yZWRlZW1zLmZpbmQoKHsgZGVwdGggfSkgPT4gZGVwdGggPT09IHVuZGVmaW5lZCkpIHtcbiAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgJ0RlcHJlY2F0aW9uIFdhcm5pbmc6IFdlaWdodC1iYXNlZCB0YXAgdHJlZSBjb25zdHJ1Y3Rpb24gd2lsbCBiZSByZW1vdmVkIGluIHRoZSBmdXR1cmUuICcgK1xuICAgICAgICAgICdQbGVhc2UgdXNlIGRlcHRoLWZpcnN0IGNvZGluZyBhcyBzcGVjaWZpZWQgaW4gQklQLTAzNzEuJ1xuICAgICAgKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKCFhLnJlZGVlbXMuZXZlcnkoKHsgb3V0cHV0IH0pID0+IG91dHB1dCkpIHJldHVybjtcbiAgICByZXR1cm4ge1xuICAgICAgbGVhdmVzOiBhLnJlZGVlbXMubWFwKCh7IG91dHB1dCwgZGVwdGggfSkgPT4ge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHNjcmlwdDogb3V0cHV0LFxuICAgICAgICAgIGxlYWZWZXJzaW9uOiB0YXByb290LklOSVRJQUxfVEFQU0NSSVBUX1ZFUlNJT04sXG4gICAgICAgICAgZGVwdGgsXG4gICAgICAgIH07XG4gICAgICB9KSxcbiAgICB9O1xuICB9KTtcbiAgbGF6eS5wcm9wKG8sICdhZGRyZXNzJywgKCkgPT4ge1xuICAgIGNvbnN0IHB1YmtleSA9IF9vdXRwdXRQdWJrZXkoKSB8fCAoX3RhcHJvb3RQdWJrZXkoKSAmJiBfdGFwcm9vdFB1YmtleSgpPy54T25seVB1YmtleSk7XG4gICAgLy8gb25seSBlbmNvZGUgdGhlIDMyIGJ5dGUgd2l0bmVzcyBwcm9ncmFtIGFzIGJlY2gzMm1cbiAgICBjb25zdCB3b3JkcyA9IGJlY2gzMm0udG9Xb3JkcyhwdWJrZXkpO1xuICAgIHdvcmRzLnVuc2hpZnQoMHgwMSk7XG4gICAgcmV0dXJuIGJlY2gzMm0uZW5jb2RlKG5ldHdvcmsuYmVjaDMyLCB3b3Jkcyk7XG4gIH0pO1xuICBsYXp5LnByb3AobywgJ2NvbnRyb2xCbG9jaycsICgpID0+IHtcbiAgICBjb25zdCBwYXJzZWRXaXRuZXNzID0gX3BhcnNlZFdpdG5lc3MoKTtcbiAgICBpZiAocGFyc2VkV2l0bmVzcyAmJiBwYXJzZWRXaXRuZXNzLnNwZW5kVHlwZSA9PT0gJ1NjcmlwdCcpIHtcbiAgICAgIHJldHVybiBwYXJzZWRXaXRuZXNzLmNvbnRyb2xCbG9jaztcbiAgICB9XG4gICAgY29uc3QgdGFwcm9vdFB1YmtleSA9IF90YXByb290UHVia2V5KCk7XG4gICAgY29uc3QgdGFwcm9vdFBhdGhzID0gX3RhcHJvb3RQYXRocygpO1xuICAgIGlmICghdGFwcm9vdFBhdGhzIHx8ICF0YXByb290UHVia2V5IHx8IGEucmVkZWVtSW5kZXggPT09IHVuZGVmaW5lZCkgcmV0dXJuO1xuICAgIHJldHVybiB0YXByb290LmdldENvbnRyb2xCbG9jayh0YXByb290UHVia2V5LnBhcml0eSwgby5pbnRlcm5hbFB1YmtleSEsIHRhcHJvb3RQYXRocy5wYXRoc1thLnJlZGVlbUluZGV4XSk7XG4gIH0pO1xuICBsYXp5LnByb3AobywgJ3NpZ25hdHVyZScsICgpID0+IHtcbiAgICBjb25zdCBwYXJzZWRXaXRuZXNzID0gX3BhcnNlZFdpdG5lc3MoKTtcbiAgICBpZiAocGFyc2VkV2l0bmVzcyAmJiBwYXJzZWRXaXRuZXNzLnNwZW5kVHlwZSA9PT0gJ0tleScpIHtcbiAgICAgIHJldHVybiBwYXJzZWRXaXRuZXNzLnNpZ25hdHVyZTtcbiAgICB9XG4gIH0pO1xuICBsYXp5LnByb3AobywgJ2FubmV4JywgKCkgPT4ge1xuICAgIGlmICghX3BhcnNlZFdpdG5lc3MoKSkgcmV0dXJuO1xuICAgIHJldHVybiBfcGFyc2VkV2l0bmVzcygpIS5hbm5leDtcbiAgfSk7XG4gIGxhenkucHJvcChvLCAnb3V0cHV0JywgKCkgPT4ge1xuICAgIGlmIChhLmFkZHJlc3MpIHtcbiAgICAgIGNvbnN0IHsgZGF0YSB9ID0gX2FkZHJlc3MoKSE7XG4gICAgICByZXR1cm4gYnNjcmlwdC5jb21waWxlKFtPUFMuT1BfMSwgZGF0YV0pO1xuICAgIH1cblxuICAgIGNvbnN0IHRhcHJvb3RQdWJrZXkgPSBfdGFwcm9vdFB1YmtleSgpO1xuICAgIGlmICghdGFwcm9vdFB1YmtleSkgcmV0dXJuO1xuXG4gICAgLy8gT1BfMSBpbmRpY2F0ZXMgc2Vnd2l0IHZlcnNpb24gMVxuICAgIHJldHVybiBic2NyaXB0LmNvbXBpbGUoW09QUy5PUF8xLCBCdWZmZXIuZnJvbSh0YXByb290UHVia2V5LnhPbmx5UHVia2V5KV0pO1xuICB9KTtcbiAgbGF6eS5wcm9wKG8sICd3aXRuZXNzJywgKCkgPT4ge1xuICAgIGlmICghYS5yZWRlZW1zKSB7XG4gICAgICBpZiAoYS5zaWduYXR1cmUpIHJldHVybiBbYS5zaWduYXR1cmVdOyAvLyBLZXlwYXRoIHNwZW5kXG4gICAgICByZXR1cm47XG4gICAgfSBlbHNlIGlmICghby5yZWRlZW0pIHtcbiAgICAgIHJldHVybjsgLy8gTm8gY2hvc2VuIHJlZGVlbSBzY3JpcHQsIGNhbid0IG1ha2Ugd2l0bmVzc1xuICAgIH0gZWxzZSBpZiAoIW8uY29udHJvbEJsb2NrKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbGV0IHJlZGVlbVdpdG5lc3M7XG4gICAgLy8gc29tZSBjYWxsZXJzIG1heSBwcm92aWRlIHdpdG5lc3MgZWxlbWVudHMgaW4gdGhlIGlucHV0IHNjcmlwdFxuICAgIGlmIChvLnJlZGVlbS5pbnB1dCAmJiBvLnJlZGVlbS5pbnB1dC5sZW5ndGggPiAwICYmIG8ucmVkZWVtLm91dHB1dCAmJiBvLnJlZGVlbS5vdXRwdXQubGVuZ3RoID4gMCkge1xuICAgICAgLy8gdHJhbnNmb3JtIHJlZGVlbSBpbnB1dCB0byB3aXRuZXNzIHN0YWNrXG4gICAgICByZWRlZW1XaXRuZXNzID0gYnNjcmlwdC50b1N0YWNrKGJzY3JpcHQuZGVjb21waWxlKG8ucmVkZWVtLmlucHV0KSEpO1xuXG4gICAgICAvLyBhc3NpZ25zIGEgbmV3IG9iamVjdCB0byBvLnJlZGVlbVxuICAgICAgby5yZWRlZW1zIVthLnJlZGVlbUluZGV4IV0gPSBPYmplY3QuYXNzaWduKHsgd2l0bmVzczogcmVkZWVtV2l0bmVzcyB9LCBvLnJlZGVlbSk7XG4gICAgICBvLnJlZGVlbS5pbnB1dCA9IEVNUFRZX0JVRkZFUjtcbiAgICB9IGVsc2UgaWYgKG8ucmVkZWVtLm91dHB1dCAmJiBvLnJlZGVlbS5vdXRwdXQubGVuZ3RoID4gMCAmJiBvLnJlZGVlbS53aXRuZXNzICYmIG8ucmVkZWVtLndpdG5lc3MubGVuZ3RoID4gMCkge1xuICAgICAgcmVkZWVtV2l0bmVzcyA9IG8ucmVkZWVtLndpdG5lc3M7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB3aXRuZXNzID0gWy4uLnJlZGVlbVdpdG5lc3MsIG8ucmVkZWVtLm91dHB1dCwgby5jb250cm9sQmxvY2tdO1xuXG4gICAgaWYgKGEuYW5uZXgpIHtcbiAgICAgIHdpdG5lc3MucHVzaChhLmFubmV4KTtcbiAgICB9XG5cbiAgICByZXR1cm4gd2l0bmVzcztcbiAgfSk7XG4gIGxhenkucHJvcChvLCAnbmFtZScsICgpID0+IHtcbiAgICBjb25zdCBuYW1lUGFydHMgPSBbJ3AydHInXTtcbiAgICByZXR1cm4gbmFtZVBhcnRzLmpvaW4oJy0nKTtcbiAgfSk7XG4gIGxhenkucHJvcChvLCAncmVkZWVtJywgKCkgPT4ge1xuICAgIGlmIChhLnJlZGVlbXMpIHtcbiAgICAgIGlmIChhLnJlZGVlbUluZGV4ID09PSB1bmRlZmluZWQpIHJldHVybjtcbiAgICAgIHJldHVybiBhLnJlZGVlbXNbYS5yZWRlZW1JbmRleF07XG4gICAgfVxuICAgIGNvbnN0IHBhcnNlZFdpdG5lc3MgPSBfcGFyc2VkV2l0bmVzcygpO1xuICAgIGlmIChwYXJzZWRXaXRuZXNzICYmIHBhcnNlZFdpdG5lc3Muc3BlbmRUeXBlID09PSAnU2NyaXB0Jykge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgd2l0bmVzczogcGFyc2VkV2l0bmVzcy5zY3JpcHRTaWcsXG4gICAgICAgIG91dHB1dDogcGFyc2VkV2l0bmVzcy50YXBzY3JpcHQsXG4gICAgICB9O1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gZXh0ZW5kZWQgdmFsaWRhdGlvblxuICBpZiAob3B0cy52YWxpZGF0ZSkge1xuICAgIGNvbnN0IHRhcHJvb3RQdWJrZXkgPSBfdGFwcm9vdFB1YmtleSgpO1xuXG4gICAgaWYgKGEub3V0cHV0KSB7XG4gICAgICBpZiAoYS5vdXRwdXRbMF0gIT09IE9QUy5PUF8xIHx8IGEub3V0cHV0WzFdICE9PSAweDIwKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ091dHB1dCBpcyBpbnZhbGlkJyk7XG4gICAgICB9XG5cbiAgICAgIC8vIGlmIHdlJ3JlIHBhc3NlZCBib3RoIGFuIG91dHB1dCBzY3JpcHQgYW5kIGFuIGFkZHJlc3MsIGVuc3VyZSB0aGV5IG1hdGNoXG4gICAgICBpZiAoYS5hZGRyZXNzICYmIF9vdXRwdXRQdWJrZXkgJiYgIV9vdXRwdXRQdWJrZXkoKT8uZXF1YWxzKF9hZGRyZXNzKCk/LmRhdGEgYXMgQnVmZmVyKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdtaXNtYXRjaCBiZXR3ZWVuIGFkZHJlc3MgJiBvdXRwdXQnKTtcbiAgICAgIH1cblxuICAgICAgLy8gV3JhcHBpbmcgYHRhcHJvb3RQdWJrZXkueE9ubHlQdWJrZXlgIGluIEJ1ZmZlciBiZWNhdXNlIG9mIGEgcGVjdWxpYXIgaXNzdWUgaW4gdGhlIGZyb250ZW5kXG4gICAgICAvLyB3aGVyZSBhIHBvbHlmaWxsIGZvciBCdWZmZXIgaXMgdXNlZC4gUmVmZXI6IGh0dHBzOi8vYml0Z29pbmMuYXRsYXNzaWFuLm5ldC9icm93c2UvQkctNjE0MjBcbiAgICAgIGlmICh0YXByb290UHVia2V5ICYmIF9vdXRwdXRQdWJrZXkgJiYgIV9vdXRwdXRQdWJrZXkoKT8uZXF1YWxzKEJ1ZmZlci5mcm9tKHRhcHJvb3RQdWJrZXkueE9ubHlQdWJrZXkpKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdtaXNtYXRjaCBiZXR3ZWVuIG91dHB1dCBhbmQgdGFwcm9vdCBwdWJrZXknKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoYS5hZGRyZXNzKSB7XG4gICAgICBpZiAodGFwcm9vdFB1YmtleSAmJiAhX2FkZHJlc3MoKT8uZGF0YS5lcXVhbHMoQnVmZmVyLmZyb20odGFwcm9vdFB1YmtleS54T25seVB1YmtleSkpKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ21pc21hdGNoIGJldHdlZW4gYWRkcmVzcyBhbmQgdGFwcm9vdCBwdWJrZXknKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBwYXJzZWRDb250cm9sQmxvY2sgPSBfcGFyc2VkQ29udHJvbEJsb2NrKCk7XG4gICAgaWYgKHBhcnNlZENvbnRyb2xCbG9jaykge1xuICAgICAgaWYgKCFwYXJzZWRDb250cm9sQmxvY2suaW50ZXJuYWxQdWJrZXkuZXF1YWxzKG8/LmludGVybmFsUHVia2V5IGFzIFVpbnQ4QXJyYXkpKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0ludGVybmFsIHB1YmtleSBtaXNtYXRjaCcpO1xuICAgICAgfVxuICAgICAgaWYgKHRhcHJvb3RQdWJrZXkgJiYgcGFyc2VkQ29udHJvbEJsb2NrLnBhcml0eSAhPT0gdGFwcm9vdFB1YmtleS5wYXJpdHkpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignUGFyaXR5IG1pc21hdGNoJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGEucmVkZWVtcykge1xuICAgICAgaWYgKCFhLnJlZGVlbXMubGVuZ3RoKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdFbXB0eSByZWRlZW1zJyk7XG4gICAgICBpZiAoYS5yZWRlZW1JbmRleCAhPT0gdW5kZWZpbmVkICYmIChhLnJlZGVlbUluZGV4IDwgMCB8fCBhLnJlZGVlbUluZGV4ID49IGEucmVkZWVtcy5sZW5ndGgpKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2ludmFsaWQgcmVkZWVtIGluZGV4Jyk7XG4gICAgICB9XG4gICAgICBhLnJlZGVlbXMuZm9yRWFjaCgocmVkZWVtKSA9PiB7XG4gICAgICAgIGlmIChyZWRlZW0ubmV0d29yayAmJiByZWRlZW0ubmV0d29yayAhPT0gbmV0d29yaykge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ05ldHdvcmsgbWlzbWF0Y2gnKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgY2hvc2VuUmVkZWVtID0gYS5yZWRlZW1zICYmIGEucmVkZWVtSW5kZXggIT09IHVuZGVmaW5lZCAmJiBhLnJlZGVlbXNbYS5yZWRlZW1JbmRleF07XG5cbiAgICBjb25zdCBwYXJzZWRXaXRuZXNzID0gX3BhcnNlZFdpdG5lc3MoKTtcbiAgICBpZiAocGFyc2VkV2l0bmVzcyAmJiBwYXJzZWRXaXRuZXNzLnNwZW5kVHlwZSA9PT0gJ0tleScpIHtcbiAgICAgIGlmIChhLmNvbnRyb2xCbG9jaykge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCd1bmV4cGVjdGVkIGNvbnRyb2wgYmxvY2sgZm9yIGtleSBwYXRoJyk7XG4gICAgICB9XG5cbiAgICAgIGlmIChhLnNpZ25hdHVyZSAmJiAhYS5zaWduYXR1cmUuZXF1YWxzKHBhcnNlZFdpdG5lc3Muc2lnbmF0dXJlKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdtaXNtYXRjaCBiZXR3ZWVuIHdpdG5lc3MgJiBzaWduYXR1cmUnKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHBhcnNlZFdpdG5lc3MgJiYgcGFyc2VkV2l0bmVzcy5zcGVuZFR5cGUgPT09ICdTY3JpcHQnKSB7XG4gICAgICBpZiAoYS5zaWduYXR1cmUpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcigndW5leHBlY3RlZCBzaWduYXR1cmUgd2l0aCBzY3JpcHQgcGF0aCB3aXRuZXNzJyk7XG4gICAgICB9XG5cbiAgICAgIGlmIChhLmNvbnRyb2xCbG9jayAmJiAhYS5jb250cm9sQmxvY2suZXF1YWxzKHBhcnNlZFdpdG5lc3MuY29udHJvbEJsb2NrKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdjb250cm9sIGJsb2NrIG1pc21hdGNoJyk7XG4gICAgICB9XG5cbiAgICAgIGlmIChhLmFubmV4ICYmIHBhcnNlZFdpdG5lc3MuYW5uZXggJiYgIWEuYW5uZXguZXF1YWxzKHBhcnNlZFdpdG5lc3MuYW5uZXgpKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2FubmV4IG1pc21hdGNoJyk7XG4gICAgICB9XG5cbiAgICAgIGlmIChjaG9zZW5SZWRlZW0gJiYgY2hvc2VuUmVkZWVtLm91dHB1dCAmJiAhY2hvc2VuUmVkZWVtLm91dHB1dC5lcXVhbHMocGFyc2VkV2l0bmVzcy50YXBzY3JpcHQpKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3RhcHNjcmlwdCBtaXNtYXRjaCcpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBPYmplY3QuYXNzaWduKG8sIGEpO1xufVxuIl19