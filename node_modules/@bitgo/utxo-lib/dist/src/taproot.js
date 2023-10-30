"use strict";
// Taproot-specific key aggregation and taptree logic as defined in:
// https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki
// https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTaprootOutputKey = exports.createTaprootOutputScript = exports.getTweakedOutputKey = exports.getTaptreeRoot = exports.getTapleafHash = exports.parseControlBlock = exports.parseTaprootWitness = exports.getControlBlock = exports.getHuffmanTaptree = exports.getDepthFirstTaptree = exports.tapTweakPubkey = exports.tapTweakPrivkey = exports.calculateTapTweak = exports.hashTapBranch = exports.hashTapLeaf = exports.serializeScriptSize = exports.aggregateMuSigPubkeys = exports.INITIAL_TAPSCRIPT_VERSION = exports.EVEN_Y_COORD_PREFIX = void 0;
const assert = require("assert");
const FastPriorityQueue = require("fastpriorityqueue");
const bitcoinjs_lib_1 = require("bitcoinjs-lib");
const noble_ecc_1 = require("./noble_ecc");
const varuint = require('varuint-bitcoin');
/**
 * The 0x02 prefix indicating an even Y coordinate which is implicitly assumed
 * on all 32 byte x-only pub keys as defined in BIP340.
 */
exports.EVEN_Y_COORD_PREFIX = Buffer.of(0x02);
exports.INITIAL_TAPSCRIPT_VERSION = 0xc0;
/**
 * Aggregates a list of public keys into a single MuSig2* public key
 * according to the MuSig2 paper.
 * @param ecc Elliptic curve implementation
 * @param pubkeys The list of pub keys to aggregate
 * @returns a 32 byte Buffer representing the aggregate key
 */
function aggregateMuSigPubkeys(ecc, pubkeys) {
    // TODO: Consider enforcing key uniqueness.
    assert(pubkeys.length > 1, 'at least two pubkeys are required for musig key aggregation');
    // Sort the keys in ascending order
    pubkeys.sort(Buffer.compare);
    // In MuSig all signers contribute key material to a single signing key,
    // using the equation
    //
    //     P = sum_i µ_i * P_i
    //
    // where `P_i` is the public key of the `i`th signer and `µ_i` is a so-called
    // _MuSig coefficient_ computed according to the following equation
    //
    // L = H(P_1 || P_2 || ... || P_n)
    // µ_i = H(L || P_i)
    const L = bitcoinjs_lib_1.crypto.taggedHash('KeyAgg list', Buffer.concat(pubkeys));
    const secondUniquePubkey = pubkeys.find((pubkey) => !pubkeys[0].equals(pubkey));
    const tweakedPubkeys = pubkeys.map((pubkey) => {
        const xyPubkey = Buffer.concat([exports.EVEN_Y_COORD_PREFIX, pubkey]);
        if (secondUniquePubkey !== undefined && secondUniquePubkey.equals(pubkey)) {
            // The second unique key in the pubkey list given to ''KeyAgg'' (as well
            // as any keys identical to this key) gets the constant KeyAgg
            // coefficient 1 which saves an exponentiation (see the MuSig2* appendix
            // in the MuSig2 paper).
            return xyPubkey;
        }
        const c = bitcoinjs_lib_1.crypto.taggedHash('KeyAgg coefficient', Buffer.concat([L, pubkey]));
        const tweakedPubkey = ecc.pointMultiply(xyPubkey, c);
        if (!tweakedPubkey) {
            throw new Error('Failed to multiply pubkey by coefficient');
        }
        return tweakedPubkey;
    });
    const aggregatePubkey = tweakedPubkeys.reduce((prev, curr) => {
        const next = ecc.pointAdd(prev, curr);
        if (!next)
            throw new Error('Failed to sum pubkeys');
        return next;
    });
    return aggregatePubkey.slice(1);
}
exports.aggregateMuSigPubkeys = aggregateMuSigPubkeys;
/**
 * Encodes the length of a script as a bitcoin variable length integer.
 * @param script
 * @returns
 */
function serializeScriptSize(script) {
    return varuint.encode(script.length);
}
exports.serializeScriptSize = serializeScriptSize;
/**
 * Gets a tapleaf tagged hash from a script.
 * @param script
 * @returns
 */
function hashTapLeaf(script, leafVersion = exports.INITIAL_TAPSCRIPT_VERSION) {
    const size = serializeScriptSize(script);
    return bitcoinjs_lib_1.crypto.taggedHash('TapLeaf', Buffer.concat([Buffer.of(leafVersion), size, script]));
}
exports.hashTapLeaf = hashTapLeaf;
/**
 * Creates a lexicographically sorted tapbranch from two child taptree nodes
 * and returns its tagged hash.
 * @param child1
 * @param child2
 * @returns the tagged tapbranch hash
 */
function hashTapBranch(child1, child2) {
    // sort the children lexicographically
    const sortedChildren = [child1, child2].sort(Buffer.compare);
    return bitcoinjs_lib_1.crypto.taggedHash('TapBranch', Buffer.concat(sortedChildren));
}
exports.hashTapBranch = hashTapBranch;
function calculateTapTweak(pubkey, taptreeRoot) {
    if (pubkey.length !== 32) {
        throw new Error(`Invalid pubkey size ${pubkey.length}.`);
    }
    if (taptreeRoot) {
        if (taptreeRoot.length !== 32) {
            throw new Error(`Invalid taptreeRoot size ${taptreeRoot.length}.`);
        }
        return bitcoinjs_lib_1.crypto.taggedHash('TapTweak', Buffer.concat([pubkey, taptreeRoot]));
    }
    // If the spending conditions do not require a script path, the output key should commit to an
    // unspendable script path instead of having no script path.
    // https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki#cite_note-22
    return bitcoinjs_lib_1.crypto.taggedHash('TapTweak', Buffer.from(pubkey));
}
exports.calculateTapTweak = calculateTapTweak;
/**
 * Tweaks a privkey, using the tagged hash of its pubkey, and (optionally) a taptree root
 * @param ecc Elliptic curve implementation
 * @param pubkey public key, used to calculate the tweak
 * @param privkey the privkey to tweak
 * @param taptreeRoot the taptree root tagged hash
 * @returns {Buffer} the tweaked privkey
 */
function tapTweakPrivkey(ecc, pubkey, privkey, taptreeRoot) {
    const tapTweak = calculateTapTweak(pubkey, taptreeRoot);
    const point = ecc.pointFromScalar(privkey);
    if (!point)
        throw new Error('Invalid private key');
    if (point[0] % 2 === 1)
        privkey = ecc.privateNegate(privkey);
    const result = ecc.privateAdd(privkey, tapTweak);
    if (!result)
        throw new Error('Invalid private key');
    return result;
}
exports.tapTweakPrivkey = tapTweakPrivkey;
/**
 * Tweaks an internal pubkey, using the tagged hash of itself, and (optionally) a taptree root
 * @param ecc Elliptic curve implementation
 * @param pubkey the internal pubkey to tweak
 * @param taptreeRoot the taptree root tagged hash
 * @returns {TweakedPubkey} the tweaked pubkey
 */
function tapTweakPubkey(ecc, pubkey, taptreeRoot) {
    const tapTweak = calculateTapTweak(pubkey, taptreeRoot);
    const result = ecc.xOnlyPointAddTweak(pubkey, tapTweak);
    if (!result)
        throw new Error('Invalid pubkey');
    return result;
}
exports.tapTweakPubkey = tapTweakPubkey;
function recurseTaptree(leaves, targetDepth = 0) {
    const { value, done } = leaves.next();
    assert(!done, 'insufficient leaves to reconstruct tap tree');
    const [index, leaf] = value;
    const tree = {
        root: hashTapLeaf(leaf.script, leaf.leafVersion),
        paths: [],
    };
    tree.paths[index] = [];
    for (let depth = leaf.depth; depth > targetDepth; depth--) {
        const sibling = recurseTaptree(leaves, depth);
        tree.paths.forEach((path) => path.push(sibling.root));
        sibling.paths.forEach((path) => path.push(tree.root));
        tree.root = hashTapBranch(tree.root, sibling.root);
        // Merge disjoint sparse arrays of paths into tree.paths
        Object.assign(tree.paths, sibling.paths);
    }
    return tree;
}
/**
 * Gets the root hash and hash-paths of a taptree from the depth-first
 * construction used in BIP-0371 PSBTs
 * @param tree
 * @returns {Taptree} the tree, represented by its root hash, and the paths to
 * that root from each of the input scripts
 */
function getDepthFirstTaptree(tree) {
    const iter = tree.leaves.entries();
    const ret = recurseTaptree(iter);
    assert(iter.next().done, 'invalid tap tree, no path to some leaves');
    return ret;
}
exports.getDepthFirstTaptree = getDepthFirstTaptree;
/**
 * Gets the root hash of a taptree using a weighted Huffman construction from a
 * list of scripts and corresponding weights.
 * @param scripts
 * @param weights
 * @returns {Taptree} the tree, represented by its root hash, and the paths to that root from each of the input scripts
 */
function getHuffmanTaptree(scripts, weights) {
    assert(scripts.length > 0, 'at least one script is required to construct a tap tree');
    // Create a queue/heap of the provided scripts prioritized according to their
    // corresponding weights.
    const queue = new FastPriorityQueue((a, b) => {
        return a.weight < b.weight;
    });
    scripts.forEach((script, index) => {
        const weight = weights[index] || 1;
        assert(weight > 0, 'script weight must be a positive value');
        queue.add({
            weight,
            taggedHash: hashTapLeaf(script),
            paths: { [index]: [] },
        });
    });
    // Now that we have a queue of weighted scripts, we begin a loop whereby we
    // remove the two lowest weighted items from the queue. We create a tap branch
    // node from the two items, and add the branch back to the queue with the
    // combined weight of both its children. Each loop reduces the number of items
    // in the queue by one, and we repeat until we are left with only one item -
    // this becomes the tap tree root.
    //
    // For example, if we begin with scripts A, B, C, D with weights 6, 3, 1, 1
    // After first loop: A(6), B(3), CD(1 + 1)
    // After second loop: A(6), B[CD](3 + 2)
    // Final loop: A[B[CD]](6+5)
    // The final tree will look like:
    //
    //        A[B[CD]]
    //       /        \
    //      A         B[CD]
    //               /     \
    //              B      [CD]
    //                    /    \
    //                   C      D
    //
    // This ensures that the spending conditions we believe to have the highest
    // probability of being used are further up the tree than less likely scripts,
    // thereby reducing the size of the merkle proofs for the more likely scripts.
    while (queue.size > 1) {
        // We can safely expect two polls to return non-null elements since we've
        // checked that the queue has at least two elements before looping.
        const child1 = queue.poll();
        const child2 = queue.poll();
        Object.values(child1.paths).forEach((path) => path.push(child2.taggedHash));
        Object.values(child2.paths).forEach((path) => path.push(child1.taggedHash));
        queue.add({
            taggedHash: hashTapBranch(child1.taggedHash, child2.taggedHash),
            weight: child1.weight + child2.weight,
            paths: { ...child1.paths, ...child2.paths },
        });
    }
    // After the while loop above completes we should have exactly one element
    // remaining in the queue, which we can safely extract below.
    const rootNode = queue.poll();
    const paths = Object.entries(rootNode.paths).reduce((acc, [index, path]) => {
        acc[Number(index)] = path; // TODO: Why doesn't TS know it's a number?
        return acc;
    }, Array(scripts.length));
    return { root: rootNode.taggedHash, paths };
}
exports.getHuffmanTaptree = getHuffmanTaptree;
function getControlBlock(parity, pubkey, path, leafVersion = exports.INITIAL_TAPSCRIPT_VERSION) {
    const parityVersion = leafVersion + parity;
    return Buffer.concat([Buffer.of(parityVersion), pubkey, ...path]);
}
exports.getControlBlock = getControlBlock;
/**
 * Parses a taproot witness stack and extracts key data elements.
 * @param witnessStack
 * @returns {ScriptPathWitness|KeyPathWitness} an object representing the
 * parsed witness for a script path or key path spend.
 * @throws {Error} if the witness stack does not conform to the BIP 341 script validation rules
 */
function parseTaprootWitness(witnessStack) {
    let annex;
    if (witnessStack.length >= 2 && witnessStack[witnessStack.length - 1][0] === 0x50) {
        // If there are at least two witness elements, and the first byte of the last element is
        // 0x50, this last element is called annex a and is removed from the witness stack
        annex = witnessStack[witnessStack.length - 1];
        witnessStack = witnessStack.slice(0, -1);
    }
    if (witnessStack.length < 1) {
        throw new Error('witness stack must have at least one element');
    }
    else if (witnessStack.length === 1) {
        // key path spend
        const signature = witnessStack[0];
        if (!bitcoinjs_lib_1.script.isCanonicalSchnorrSignature(signature)) {
            throw new Error('invalid signature');
        }
        return { spendType: 'Key', signature, annex };
    }
    // script path spend
    // second to last element is the tapscript
    const tapscript = witnessStack[witnessStack.length - 2];
    const tapscriptChunks = bitcoinjs_lib_1.script.decompile(tapscript);
    if (!tapscriptChunks || tapscriptChunks.length === 0) {
        throw new Error('tapscript is not a valid script');
    }
    // The last stack element is called the control block c, and must have length 33 + 32m,
    // for a value of m that is an integer between 0 and 128, inclusive
    const controlBlock = witnessStack[witnessStack.length - 1];
    if (controlBlock.length < 33 || controlBlock.length > 33 + 32 * 128 || controlBlock.length % 32 !== 1) {
        throw new Error('invalid control block length');
    }
    return {
        spendType: 'Script',
        scriptSig: witnessStack.slice(0, -2),
        tapscript,
        controlBlock,
        annex,
    };
}
exports.parseTaprootWitness = parseTaprootWitness;
/**
 * Parses a taproot control block.
 * @param ecc Elliptic curve implementation
 * @param controlBlock the control block to parse
 * @returns {ControlBlock} the parsed control block
 * @throws {Error} if the witness stack does not conform to the BIP 341 script validation rules
 */
function parseControlBlock(ecc, controlBlock) {
    if ((controlBlock.length - 1) % 32 !== 0) {
        throw new TypeError('Invalid control block length');
    }
    const parity = controlBlock[0] & 0x01;
    // Let p = c[1:33] and let P = lift_x(int(p)) where lift_x and [:] are defined as in BIP340.
    // Fail if this point is not on the curve
    const internalPubkey = controlBlock.slice(1, 33);
    if (!ecc.isXOnlyPoint(internalPubkey)) {
        throw new Error('internal pubkey is not an EC point');
    }
    // The leaf version cannot be 0x50 as that would result in ambiguity with the annex.
    const leafVersion = controlBlock[0] & 0xfe;
    if (leafVersion === 0x50) {
        throw new Error('invalid leaf version');
    }
    const path = [];
    for (let j = 33; j < controlBlock.length; j += 32) {
        path.push(controlBlock.slice(j, j + 32));
    }
    return {
        parity,
        internalPubkey,
        leafVersion,
        path,
    };
}
exports.parseControlBlock = parseControlBlock;
/**
 * Calculates the tapleaf hash from a control block and script.
 * @param ecc Elliptic curve implementation
 * @param controlBlock the control block, either raw or parsed
 * @param tapscript the leaf script corresdponding to the control block
 * @returns {Buffer} the tapleaf hash
 */
function getTapleafHash(ecc, controlBlock, tapscript) {
    if (Buffer.isBuffer(controlBlock)) {
        controlBlock = parseControlBlock(ecc, controlBlock);
    }
    const { leafVersion } = controlBlock;
    return bitcoinjs_lib_1.crypto.taggedHash('TapLeaf', Buffer.concat([Buffer.of(leafVersion), serializeScriptSize(tapscript), tapscript]));
}
exports.getTapleafHash = getTapleafHash;
/**
 * Calculates the taptree root hash from a control block and script.
 * @param ecc Elliptic curve implementation
 * @param controlBlock the control block, either raw or parsed
 * @param tapscript the leaf script corresdponding to the control block
 * @param tapleafHash the leaf hash if already calculated
 * @returns {Buffer} the taptree root hash
 */
function getTaptreeRoot(ecc, controlBlock, tapscript, tapleafHash) {
    if (Buffer.isBuffer(controlBlock)) {
        controlBlock = parseControlBlock(ecc, controlBlock);
    }
    const { path } = controlBlock;
    tapleafHash = tapleafHash || getTapleafHash(ecc, controlBlock, tapscript);
    // `taptreeMerkleHash` begins as our tapscript tapleaf hash and its value iterates
    // through its parent tapbranch hashes until it ends up as the taptree root hash
    let taptreeMerkleHash = tapleafHash;
    for (const taptreeSiblingHash of path) {
        taptreeMerkleHash =
            Buffer.compare(taptreeMerkleHash, taptreeSiblingHash) === -1
                ? bitcoinjs_lib_1.crypto.taggedHash('TapBranch', Buffer.concat([taptreeMerkleHash, taptreeSiblingHash]))
                : bitcoinjs_lib_1.crypto.taggedHash('TapBranch', Buffer.concat([taptreeSiblingHash, taptreeMerkleHash]));
    }
    return taptreeMerkleHash;
}
exports.getTaptreeRoot = getTaptreeRoot;
function getTweakedOutputKey(payment) {
    var _a;
    assert(payment.output);
    if (payment.output.length === 34) {
        return (_a = payment.output) === null || _a === void 0 ? void 0 : _a.subarray(2);
    }
    throw new Error(`invalid p2tr tweaked output key size ${payment.output.length}`);
}
exports.getTweakedOutputKey = getTweakedOutputKey;
/**
 * @returns output script for either script path input controlBlock
 * & leafScript OR key path input internalPubKey & taptreeRoot
 */
function createTaprootOutputScript(p2trArgs) {
    let internalPubKey;
    let taptreeRoot;
    if ('internalPubKey' in p2trArgs) {
        internalPubKey = p2trArgs.internalPubKey;
        taptreeRoot = p2trArgs.taptreeRoot;
    }
    else {
        internalPubKey = parseControlBlock(noble_ecc_1.ecc, p2trArgs.controlBlock).internalPubkey;
        taptreeRoot = getTaptreeRoot(noble_ecc_1.ecc, p2trArgs.controlBlock, p2trArgs.leafScript);
    }
    const outputKey = tapTweakPubkey(noble_ecc_1.ecc, internalPubKey, taptreeRoot).xOnlyPubkey;
    return bitcoinjs_lib_1.script.compile([bitcoinjs_lib_1.script.OPS.OP_1, Buffer.from(outputKey)]);
}
exports.createTaprootOutputScript = createTaprootOutputScript;
/**
 * @returns x-only taproot output key (tapOutputKey)
 */
function getTaprootOutputKey(outputScript) {
    const outputDecompiled = bitcoinjs_lib_1.script.decompile(outputScript);
    if ((outputDecompiled === null || outputDecompiled === void 0 ? void 0 : outputDecompiled.length) !== 2) {
        throw new Error('invalid taproot output script');
    }
    const [op1, outputKey] = outputDecompiled;
    if (op1 !== bitcoinjs_lib_1.script.OPS.OP_1 || !Buffer.isBuffer(outputKey) || outputKey.length !== 32) {
        throw new Error('invalid taproot output script');
    }
    return outputKey;
}
exports.getTaprootOutputKey = getTaprootOutputKey;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFwcm9vdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy90YXByb290LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxvRUFBb0U7QUFDcEUsaUVBQWlFO0FBQ2pFLGlFQUFpRTs7O0FBR2pFLGlDQUFrQztBQUNsQyx1REFBd0Q7QUFDeEQsaURBQTRGO0FBQzVGLDJDQUE0QztBQUM1QyxNQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsaUJBQWlCLENBQUMsQ0FBQztBQUUzQzs7O0dBR0c7QUFDVSxRQUFBLG1CQUFtQixHQUFHLE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDdEMsUUFBQSx5QkFBeUIsR0FBRyxJQUFJLENBQUM7QUFZOUM7Ozs7OztHQU1HO0FBQ0gsU0FBZ0IscUJBQXFCLENBQUMsR0FBMkIsRUFBRSxPQUFpQjtJQUNsRiwyQ0FBMkM7SUFDM0MsTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLDZEQUE2RCxDQUFDLENBQUM7SUFFMUYsbUNBQW1DO0lBQ25DLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBRTdCLHdFQUF3RTtJQUN4RSxxQkFBcUI7SUFDckIsRUFBRTtJQUNGLDBCQUEwQjtJQUMxQixFQUFFO0lBQ0YsNkVBQTZFO0lBQzdFLG1FQUFtRTtJQUNuRSxFQUFFO0lBQ0Ysa0NBQWtDO0lBQ2xDLG9CQUFvQjtJQUVwQixNQUFNLENBQUMsR0FBRyxzQkFBTyxDQUFDLFVBQVUsQ0FBQyxhQUFhLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBRXBFLE1BQU0sa0JBQWtCLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7SUFFaEYsTUFBTSxj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QUFnQixDQUFDO0lBQzFDLElBQUksR0FBRyxLQUFLLHNCQUFPLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLElBQUksU0FBUyxDQUFDLE1BQU0sS0FBSyxFQUFFLEVBQUU7UUFDdEYsTUFBTSxJQUFJLEtBQUssQ0FBQywrQkFBK0IsQ0FBQyxDQUFDO0tBQ2xEO0lBQ0QsT0FBTyxTQUFTLENBQUM7QUFDbkIsQ0FBQztBQVZELGtEQVVDIiwic291cmNlc0NvbnRlbnQiOlsiLy8gVGFwcm9vdC1zcGVjaWZpYyBrZXkgYWdncmVnYXRpb24gYW5kIHRhcHRyZWUgbG9naWMgYXMgZGVmaW5lZCBpbjpcbi8vIGh0dHBzOi8vZ2l0aHViLmNvbS9iaXRjb2luL2JpcHMvYmxvYi9tYXN0ZXIvYmlwLTAzNDAubWVkaWF3aWtpXG4vLyBodHRwczovL2dpdGh1Yi5jb20vYml0Y29pbi9iaXBzL2Jsb2IvbWFzdGVyL2JpcC0wMzQxLm1lZGlhd2lraVxuXG5pbXBvcnQgeyBUYXBUcmVlIGFzIFBzYnRUYXBUcmVlLCBUYXBMZWFmIGFzIFBzYnRUYXBMZWFmIH0gZnJvbSAnYmlwMTc0L3NyYy9saWIvaW50ZXJmYWNlcyc7XG5pbXBvcnQgYXNzZXJ0ID0gcmVxdWlyZSgnYXNzZXJ0Jyk7XG5pbXBvcnQgRmFzdFByaW9yaXR5UXVldWUgPSByZXF1aXJlKCdmYXN0cHJpb3JpdHlxdWV1ZScpO1xuaW1wb3J0IHsgc2NyaXB0IGFzIGJzY3JpcHQsIGNyeXB0byBhcyBiY3J5cHRvLCBwYXltZW50cyBhcyBicGF5bWVudHMgfSBmcm9tICdiaXRjb2luanMtbGliJztcbmltcG9ydCB7IGVjYyBhcyBlY2NMaWIgfSBmcm9tICcuL25vYmxlX2VjYyc7XG5jb25zdCB2YXJ1aW50ID0gcmVxdWlyZSgndmFydWludC1iaXRjb2luJyk7XG5cbi8qKlxuICogVGhlIDB4MDIgcHJlZml4IGluZGljYXRpbmcgYW4gZXZlbiBZIGNvb3JkaW5hdGUgd2hpY2ggaXMgaW1wbGljaXRseSBhc3N1bWVkXG4gKiBvbiBhbGwgMzIgYnl0ZSB4LW9ubHkgcHViIGtleXMgYXMgZGVmaW5lZCBpbiBCSVAzNDAuXG4gKi9cbmV4cG9ydCBjb25zdCBFVkVOX1lfQ09PUkRfUFJFRklYID0gQnVmZmVyLm9mKDB4MDIpO1xuZXhwb3J0IGNvbnN0IElOSVRJQUxfVEFQU0NSSVBUX1ZFUlNJT04gPSAweGMwO1xuXG5leHBvcnQgaW50ZXJmYWNlIFRpbnlTZWNwMjU2azFJbnRlcmZhY2Uge1xuICBpc1hPbmx5UG9pbnQocDogVWludDhBcnJheSk6IGJvb2xlYW47XG4gIHhPbmx5UG9pbnRBZGRUd2VhayhwOiBVaW50OEFycmF5LCB0d2VhazogVWludDhBcnJheSk6IFhPbmx5UG9pbnRBZGRUd2Vha1Jlc3VsdCB8IG51bGw7XG4gIHBvaW50RnJvbVNjYWxhcihzazogVWludDhBcnJheSwgY29tcHJlc3NlZD86IGJvb2xlYW4pOiBVaW50OEFycmF5IHwgbnVsbDtcbiAgcG9pbnRNdWx0aXBseShhOiBVaW50OEFycmF5LCBiOiBVaW50OEFycmF5KTogVWludDhBcnJheSB8IG51bGw7XG4gIHBvaW50QWRkKGE6IFVpbnQ4QXJyYXksIGI6IFVpbnQ4QXJyYXkpOiBVaW50OEFycmF5IHwgbnVsbDtcbiAgcHJpdmF0ZUFkZChkOiBVaW50OEFycmF5LCB0d2VhazogVWludDhBcnJheSk6IFVpbnQ4QXJyYXkgfCBudWxsO1xuICBwcml2YXRlTmVnYXRlKGQ6IFVpbnQ4QXJyYXkpOiBVaW50OEFycmF5O1xufVxuXG4vKipcbiAqIEFnZ3JlZ2F0ZXMgYSBsaXN0IG9mIHB1YmxpYyBrZXlzIGludG8gYSBzaW5nbGUgTXVTaWcyKiBwdWJsaWMga2V5XG4gKiBhY2NvcmRpbmcgdG8gdGhlIE11U2lnMiBwYXBlci5cbiAqIEBwYXJhbSBlY2MgRWxsaXB0aWMgY3VydmUgaW1wbGVtZW50YXRpb25cbiAqIEBwYXJhbSBwdWJrZXlzIFRoZSBsaXN0IG9mIHB1YiBrZXlzIHRvIGFnZ3JlZ2F0ZVxuICogQHJldHVybnMgYSAzMiBieXRlIEJ1ZmZlciByZXByZXNlbnRpbmcgdGhlIGFnZ3JlZ2F0ZSBrZXlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFnZ3JlZ2F0ZU11U2lnUHVia2V5cyhlY2M6IFRpbnlTZWNwMjU2azFJbnRlcmZhY2UsIHB1YmtleXM6IEJ1ZmZlcltdKTogVWludDhBcnJheSB7XG4gIC8vIFRPRE86IENvbnNpZGVyIGVuZm9yY2luZyBrZXkgdW5pcXVlbmVzcy5cbiAgYXNzZXJ0KHB1YmtleXMubGVuZ3RoID4gMSwgJ2F0IGxlYXN0IHR3byBwdWJrZXlzIGFyZSByZXF1aXJlZCBmb3IgbXVzaWcga2V5IGFnZ3JlZ2F0aW9uJyk7XG5cbiAgLy8gU29ydCB0aGUga2V5cyBpbiBhc2NlbmRpbmcgb3JkZXJcbiAgcHVia2V5cy5zb3J0KEJ1ZmZlci5jb21wYXJlKTtcblxuICAvLyBJbiBNdVNpZyBhbGwgc2lnbmVycyBjb250cmlidXRlIGtleSBtYXRlcmlhbCB0byBhIHNpbmdsZSBzaWduaW5nIGtleSxcbiAgLy8gdXNpbmcgdGhlIGVxdWF0aW9uXG4gIC8vXG4gIC8vICAgICBQID0gc3VtX2kgwrVfaSAqIFBfaVxuICAvL1xuICAvLyB3aGVyZSBgUF9pYCBpcyB0aGUgcHVibGljIGtleSBvZiB0aGUgYGlgdGggc2lnbmVyIGFuZCBgwrVfaWAgaXMgYSBzby1jYWxsZWRcbiAgLy8gX011U2lnIGNvZWZmaWNpZW50XyBjb21wdXRlZCBhY2NvcmRpbmcgdG8gdGhlIGZvbGxvd2luZyBlcXVhdGlvblxuICAvL1xuICAvLyBMID0gSChQXzEgfHwgUF8yIHx8IC4uLiB8fCBQX24pXG4gIC8vIMK1X2kgPSBIKEwgfHwgUF9pKVxuXG4gIGNvbnN0IEwgPSBiY3J5cHRvLnRhZ2dlZEhhc2goJ0tleUFnZyBsaXN0JywgQnVmZmVyLmNvbmNhdChwdWJrZXlzKSk7XG5cbiAgY29uc3Qgc2Vjb25kVW5pcXVlUHVia2V5ID0gcHVia2V5cy5maW5kKChwdWJrZXkpID0+ICFwdWJrZXlzWzBdLmVxdWFscyhwdWJrZXkpKTtcblxuICBjb25zdCB0d2Vha2VkUHVia2V5czogVWludDhBcnJheVtdID0gcHVia2V5cy5tYXAoKHB1YmtleSkgPT4ge1xuICAgIGNvbnN0IHh5UHVia2V5ID0gQnVmZmVyLmNvbmNhdChbRVZFTl9ZX0NPT1JEX1BSRUZJWCwgcHVia2V5XSk7XG5cbiAgICBpZiAoc2Vjb25kVW5pcXVlUHVia2V5ICE9PSB1bmRlZmluZWQgJiYgc2Vjb25kVW5pcXVlUHVia2V5LmVxdWFscyhwdWJrZXkpKSB7XG4gICAgICAvLyBUaGUgc2Vjb25kIHVuaXF1ZSBrZXkgaW4gdGhlIHB1YmtleSBsaXN0IGdpdmVuIHRvICcnS2V5QWdnJycgKGFzIHdlbGxcbiAgICAgIC8vIGFzIGFueSBrZXlzIGlkZW50aWNhbCB0byB0aGlzIGtleSkgZ2V0cyB0aGUgY29uc3RhbnQgS2V5QWdnXG4gICAgICAvLyBjb2VmZmljaWVudCAxIHdoaWNoIHNhdmVzIGFuIGV4cG9uZW50aWF0aW9uIChzZWUgdGhlIE11U2lnMiogYXBwZW5kaXhcbiAgICAgIC8vIGluIHRoZSBNdVNpZzIgcGFwZXIpLlxuICAgICAgcmV0dXJuIHh5UHVia2V5O1xuICAgIH1cblxuICAgIGNvbnN0IGMgPSBiY3J5cHRvLnRhZ2dlZEhhc2goJ0tleUFnZyBjb2VmZmljaWVudCcsIEJ1ZmZlci5jb25jYXQoW0wsIHB1YmtleV0pKTtcblxuICAgIGNvbnN0IHR3ZWFrZWRQdWJrZXkgPSBlY2MucG9pbnRNdWx0aXBseSh4eVB1YmtleSwgYyk7XG4gICAgaWYgKCF0d2Vha2VkUHVia2V5KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byBtdWx0aXBseSBwdWJrZXkgYnkgY29lZmZpY2llbnQnKTtcbiAgICB9XG4gICAgcmV0dXJuIHR3ZWFrZWRQdWJrZXk7XG4gIH0pO1xuICBjb25zdCBhZ2dyZWdhdGVQdWJrZXkgPSB0d2Vha2VkUHVia2V5cy5yZWR1Y2UoKHByZXYsIGN1cnIpID0+IHtcbiAgICBjb25zdCBuZXh0ID0gZWNjLnBvaW50QWRkKHByZXYsIGN1cnIpO1xuICAgIGlmICghbmV4dCkgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gc3VtIHB1YmtleXMnKTtcbiAgICByZXR1cm4gbmV4dDtcbiAgfSk7XG5cbiAgcmV0dXJuIGFnZ3JlZ2F0ZVB1YmtleS5zbGljZSgxKTtcbn1cblxuLyoqXG4gKiBFbmNvZGVzIHRoZSBsZW5ndGggb2YgYSBzY3JpcHQgYXMgYSBiaXRjb2luIHZhcmlhYmxlIGxlbmd0aCBpbnRlZ2VyLlxuICogQHBhcmFtIHNjcmlwdFxuICogQHJldHVybnNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZVNjcmlwdFNpemUoc2NyaXB0OiBCdWZmZXIpOiBCdWZmZXIge1xuICByZXR1cm4gdmFydWludC5lbmNvZGUoc2NyaXB0Lmxlbmd0aCk7XG59XG5cbi8qKlxuICogR2V0cyBhIHRhcGxlYWYgdGFnZ2VkIGhhc2ggZnJvbSBhIHNjcmlwdC5cbiAqIEBwYXJhbSBzY3JpcHRcbiAqIEByZXR1cm5zXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBoYXNoVGFwTGVhZihzY3JpcHQ6IEJ1ZmZlciwgbGVhZlZlcnNpb24gPSBJTklUSUFMX1RBUFNDUklQVF9WRVJTSU9OKTogQnVmZmVyIHtcbiAgY29uc3Qgc2l6ZSA9IHNlcmlhbGl6ZVNjcmlwdFNpemUoc2NyaXB0KTtcbiAgcmV0dXJuIGJjcnlwdG8udGFnZ2VkSGFzaCgnVGFwTGVhZicsIEJ1ZmZlci5jb25jYXQoW0J1ZmZlci5vZihsZWFmVmVyc2lvbiksIHNpemUsIHNjcmlwdF0pKTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgbGV4aWNvZ3JhcGhpY2FsbHkgc29ydGVkIHRhcGJyYW5jaCBmcm9tIHR3byBjaGlsZCB0YXB0cmVlIG5vZGVzXG4gKiBhbmQgcmV0dXJucyBpdHMgdGFnZ2VkIGhhc2guXG4gKiBAcGFyYW0gY2hpbGQxXG4gKiBAcGFyYW0gY2hpbGQyXG4gKiBAcmV0dXJucyB0aGUgdGFnZ2VkIHRhcGJyYW5jaCBoYXNoXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBoYXNoVGFwQnJhbmNoKGNoaWxkMTogQnVmZmVyLCBjaGlsZDI6IEJ1ZmZlcik6IEJ1ZmZlciB7XG4gIC8vIHNvcnQgdGhlIGNoaWxkcmVuIGxleGljb2dyYXBoaWNhbGx5XG4gIGNvbnN0IHNvcnRlZENoaWxkcmVuID0gW2NoaWxkMSwgY2hpbGQyXS5zb3J0KEJ1ZmZlci5jb21wYXJlKTtcblxuICByZXR1cm4gYmNyeXB0by50YWdnZWRIYXNoKCdUYXBCcmFuY2gnLCBCdWZmZXIuY29uY2F0KHNvcnRlZENoaWxkcmVuKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjYWxjdWxhdGVUYXBUd2VhayhwdWJrZXk6IFVpbnQ4QXJyYXksIHRhcHRyZWVSb290PzogVWludDhBcnJheSk6IFVpbnQ4QXJyYXkge1xuICBpZiAocHVia2V5Lmxlbmd0aCAhPT0gMzIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgcHVia2V5IHNpemUgJHtwdWJrZXkubGVuZ3RofS5gKTtcbiAgfVxuICBpZiAodGFwdHJlZVJvb3QpIHtcbiAgICBpZiAodGFwdHJlZVJvb3QubGVuZ3RoICE9PSAzMikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHRhcHRyZWVSb290IHNpemUgJHt0YXB0cmVlUm9vdC5sZW5ndGh9LmApO1xuICAgIH1cbiAgICByZXR1cm4gYmNyeXB0by50YWdnZWRIYXNoKCdUYXBUd2VhaycsIEJ1ZmZlci5jb25jYXQoW3B1YmtleSwgdGFwdHJlZVJvb3RdKSk7XG4gIH1cbiAgLy8gSWYgdGhlIHNwZW5kaW5nIGNvbmRpdGlvbnMgZG8gbm90IHJlcXVpcmUgYSBzY3JpcHQgcGF0aCwgdGhlIG91dHB1dCBrZXkgc2hvdWxkIGNvbW1pdCB0byBhblxuICAvLyB1bnNwZW5kYWJsZSBzY3JpcHQgcGF0aCBpbnN0ZWFkIG9mIGhhdmluZyBubyBzY3JpcHQgcGF0aC5cbiAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2JpdGNvaW4vYmlwcy9ibG9iL21hc3Rlci9iaXAtMDM0MS5tZWRpYXdpa2kjY2l0ZV9ub3RlLTIyXG4gIHJldHVybiBiY3J5cHRvLnRhZ2dlZEhhc2goJ1RhcFR3ZWFrJywgQnVmZmVyLmZyb20ocHVia2V5KSk7XG59XG5cbi8qKlxuICogVHdlYWtzIGEgcHJpdmtleSwgdXNpbmcgdGhlIHRhZ2dlZCBoYXNoIG9mIGl0cyBwdWJrZXksIGFuZCAob3B0aW9uYWxseSkgYSB0YXB0cmVlIHJvb3RcbiAqIEBwYXJhbSBlY2MgRWxsaXB0aWMgY3VydmUgaW1wbGVtZW50YXRpb25cbiAqIEBwYXJhbSBwdWJrZXkgcHVibGljIGtleSwgdXNlZCB0byBjYWxjdWxhdGUgdGhlIHR3ZWFrXG4gKiBAcGFyYW0gcHJpdmtleSB0aGUgcHJpdmtleSB0byB0d2Vha1xuICogQHBhcmFtIHRhcHRyZWVSb290IHRoZSB0YXB0cmVlIHJvb3QgdGFnZ2VkIGhhc2hcbiAqIEByZXR1cm5zIHtCdWZmZXJ9IHRoZSB0d2Vha2VkIHByaXZrZXlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRhcFR3ZWFrUHJpdmtleShcbiAgZWNjOiBUaW55U2VjcDI1NmsxSW50ZXJmYWNlLFxuICBwdWJrZXk6IFVpbnQ4QXJyYXksXG4gIHByaXZrZXk6IFVpbnQ4QXJyYXksXG4gIHRhcHRyZWVSb290PzogVWludDhBcnJheVxuKTogVWludDhBcnJheSB7XG4gIGNvbnN0IHRhcFR3ZWFrID0gY2FsY3VsYXRlVGFwVHdlYWsocHVia2V5LCB0YXB0cmVlUm9vdCk7XG5cbiAgY29uc3QgcG9pbnQgPSBlY2MucG9pbnRGcm9tU2NhbGFyKHByaXZrZXkpO1xuICBpZiAoIXBvaW50KSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgcHJpdmF0ZSBrZXknKTtcbiAgaWYgKHBvaW50WzBdICUgMiA9PT0gMSkgcHJpdmtleSA9IGVjYy5wcml2YXRlTmVnYXRlKHByaXZrZXkpO1xuICBjb25zdCByZXN1bHQgPSBlY2MucHJpdmF0ZUFkZChwcml2a2V5LCB0YXBUd2Vhayk7XG4gIGlmICghcmVzdWx0KSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgcHJpdmF0ZSBrZXknKTtcbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBYT25seVBvaW50QWRkVHdlYWtSZXN1bHQge1xuICBwYXJpdHk6IDEgfCAwO1xuICB4T25seVB1YmtleTogVWludDhBcnJheTtcbn1cblxuLyoqXG4gKiBUd2Vha3MgYW4gaW50ZXJuYWwgcHVia2V5LCB1c2luZyB0aGUgdGFnZ2VkIGhhc2ggb2YgaXRzZWxmLCBhbmQgKG9wdGlvbmFsbHkpIGEgdGFwdHJlZSByb290XG4gKiBAcGFyYW0gZWNjIEVsbGlwdGljIGN1cnZlIGltcGxlbWVudGF0aW9uXG4gKiBAcGFyYW0gcHVia2V5IHRoZSBpbnRlcm5hbCBwdWJrZXkgdG8gdHdlYWtcbiAqIEBwYXJhbSB0YXB0cmVlUm9vdCB0aGUgdGFwdHJlZSByb290IHRhZ2dlZCBoYXNoXG4gKiBAcmV0dXJucyB7VHdlYWtlZFB1YmtleX0gdGhlIHR3ZWFrZWQgcHVia2V5XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0YXBUd2Vha1B1YmtleShcbiAgZWNjOiBUaW55U2VjcDI1NmsxSW50ZXJmYWNlLFxuICBwdWJrZXk6IFVpbnQ4QXJyYXksXG4gIHRhcHRyZWVSb290PzogQnVmZmVyXG4pOiBYT25seVBvaW50QWRkVHdlYWtSZXN1bHQge1xuICBjb25zdCB0YXBUd2VhayA9IGNhbGN1bGF0ZVRhcFR3ZWFrKHB1YmtleSwgdGFwdHJlZVJvb3QpO1xuICBjb25zdCByZXN1bHQgPSBlY2MueE9ubHlQb2ludEFkZFR3ZWFrKHB1YmtleSwgdGFwVHdlYWspO1xuICBpZiAoIXJlc3VsdCkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHB1YmtleScpO1xuICByZXR1cm4gcmVzdWx0O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRhcHRyZWUge1xuICByb290OiBCdWZmZXI7XG4gIHBhdGhzOiBCdWZmZXJbXVtdO1xufVxuXG5pbnRlcmZhY2UgV2VpZ2h0ZWRUYXBTY3JpcHQge1xuICAvKiogQSBUYXBMZWFmIG9yIFRhcEJyYW5jaCB0YWdnZWQgaGFzaCAqL1xuICB0YWdnZWRIYXNoOiBCdWZmZXI7XG4gIHdlaWdodDogbnVtYmVyO1xuICBwYXRoczoge1xuICAgIFtpbmRleDogbnVtYmVyXTogQnVmZmVyW107XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlY3Vyc2VUYXB0cmVlKGxlYXZlczogSXRlcmF0b3I8W251bWJlciwgUHNidFRhcExlYWZdPiwgdGFyZ2V0RGVwdGggPSAwKTogVGFwdHJlZSB7XG4gIGNvbnN0IHsgdmFsdWUsIGRvbmUgfSA9IGxlYXZlcy5uZXh0KCk7XG4gIGFzc2VydCghZG9uZSwgJ2luc3VmZmljaWVudCBsZWF2ZXMgdG8gcmVjb25zdHJ1Y3QgdGFwIHRyZWUnKTtcbiAgY29uc3QgW2luZGV4LCBsZWFmXSA9IHZhbHVlO1xuICBjb25zdCB0cmVlOiBUYXB0cmVlID0ge1xuICAgIHJvb3Q6IGhhc2hUYXBMZWFmKGxlYWYuc2NyaXB0LCBsZWFmLmxlYWZWZXJzaW9uKSxcbiAgICBwYXRoczogW10sXG4gIH07XG4gIHRyZWUucGF0aHNbaW5kZXhdID0gW107XG4gIGZvciAobGV0IGRlcHRoID0gbGVhZi5kZXB0aDsgZGVwdGggPiB0YXJnZXREZXB0aDsgZGVwdGgtLSkge1xuICAgIGNvbnN0IHNpYmxpbmcgPSByZWN1cnNlVGFwdHJlZShsZWF2ZXMsIGRlcHRoKTtcbiAgICB0cmVlLnBhdGhzLmZvckVhY2goKHBhdGgpID0+IHBhdGgucHVzaChzaWJsaW5nLnJvb3QpKTtcbiAgICBzaWJsaW5nLnBhdGhzLmZvckVhY2goKHBhdGgpID0+IHBhdGgucHVzaCh0cmVlLnJvb3QpKTtcbiAgICB0cmVlLnJvb3QgPSBoYXNoVGFwQnJhbmNoKHRyZWUucm9vdCwgc2libGluZy5yb290KTtcbiAgICAvLyBNZXJnZSBkaXNqb2ludCBzcGFyc2UgYXJyYXlzIG9mIHBhdGhzIGludG8gdHJlZS5wYXRoc1xuICAgIE9iamVjdC5hc3NpZ24odHJlZS5wYXRocywgc2libGluZy5wYXRocyk7XG4gIH1cbiAgcmV0dXJuIHRyZWU7XG59XG5cbi8qKlxuICogR2V0cyB0aGUgcm9vdCBoYXNoIGFuZCBoYXNoLXBhdGhzIG9mIGEgdGFwdHJlZSBmcm9tIHRoZSBkZXB0aC1maXJzdFxuICogY29uc3RydWN0aW9uIHVzZWQgaW4gQklQLTAzNzEgUFNCVHNcbiAqIEBwYXJhbSB0cmVlXG4gKiBAcmV0dXJucyB7VGFwdHJlZX0gdGhlIHRyZWUsIHJlcHJlc2VudGVkIGJ5IGl0cyByb290IGhhc2gsIGFuZCB0aGUgcGF0aHMgdG9cbiAqIHRoYXQgcm9vdCBmcm9tIGVhY2ggb2YgdGhlIGlucHV0IHNjcmlwdHNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldERlcHRoRmlyc3RUYXB0cmVlKHRyZWU6IFBzYnRUYXBUcmVlKTogVGFwdHJlZSB7XG4gIGNvbnN0IGl0ZXIgPSB0cmVlLmxlYXZlcy5lbnRyaWVzKCk7XG4gIGNvbnN0IHJldCA9IHJlY3Vyc2VUYXB0cmVlKGl0ZXIpO1xuICBhc3NlcnQoaXRlci5uZXh0KCkuZG9uZSwgJ2ludmFsaWQgdGFwIHRyZWUsIG5vIHBhdGggdG8gc29tZSBsZWF2ZXMnKTtcbiAgcmV0dXJuIHJldDtcbn1cblxuLyoqXG4gKiBHZXRzIHRoZSByb290IGhhc2ggb2YgYSB0YXB0cmVlIHVzaW5nIGEgd2VpZ2h0ZWQgSHVmZm1hbiBjb25zdHJ1Y3Rpb24gZnJvbSBhXG4gKiBsaXN0IG9mIHNjcmlwdHMgYW5kIGNvcnJlc3BvbmRpbmcgd2VpZ2h0cy5cbiAqIEBwYXJhbSBzY3JpcHRzXG4gKiBAcGFyYW0gd2VpZ2h0c1xuICogQHJldHVybnMge1RhcHRyZWV9IHRoZSB0cmVlLCByZXByZXNlbnRlZCBieSBpdHMgcm9vdCBoYXNoLCBhbmQgdGhlIHBhdGhzIHRvIHRoYXQgcm9vdCBmcm9tIGVhY2ggb2YgdGhlIGlucHV0IHNjcmlwdHNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEh1ZmZtYW5UYXB0cmVlKHNjcmlwdHM6IEJ1ZmZlcltdLCB3ZWlnaHRzOiBBcnJheTxudW1iZXIgfCB1bmRlZmluZWQ+KTogVGFwdHJlZSB7XG4gIGFzc2VydChzY3JpcHRzLmxlbmd0aCA+IDAsICdhdCBsZWFzdCBvbmUgc2NyaXB0IGlzIHJlcXVpcmVkIHRvIGNvbnN0cnVjdCBhIHRhcCB0cmVlJyk7XG5cbiAgLy8gQ3JlYXRlIGEgcXVldWUvaGVhcCBvZiB0aGUgcHJvdmlkZWQgc2NyaXB0cyBwcmlvcml0aXplZCBhY2NvcmRpbmcgdG8gdGhlaXJcbiAgLy8gY29ycmVzcG9uZGluZyB3ZWlnaHRzLlxuICBjb25zdCBxdWV1ZSA9IG5ldyBGYXN0UHJpb3JpdHlRdWV1ZTxXZWlnaHRlZFRhcFNjcmlwdD4oKGEsIGIpOiBib29sZWFuID0+IHtcbiAgICByZXR1cm4gYS53ZWlnaHQgPCBiLndlaWdodDtcbiAgfSk7XG4gIHNjcmlwdHMuZm9yRWFjaCgoc2NyaXB0LCBpbmRleCkgPT4ge1xuICAgIGNvbnN0IHdlaWdodCA9IHdlaWdodHNbaW5kZXhdIHx8IDE7XG4gICAgYXNzZXJ0KHdlaWdodCA+IDAsICdzY3JpcHQgd2VpZ2h0IG11c3QgYmUgYSBwb3NpdGl2ZSB2YWx1ZScpO1xuXG4gICAgcXVldWUuYWRkKHtcbiAgICAgIHdlaWdodCxcbiAgICAgIHRhZ2dlZEhhc2g6IGhhc2hUYXBMZWFmKHNjcmlwdCksXG4gICAgICBwYXRoczogeyBbaW5kZXhdOiBbXSB9LFxuICAgIH0pO1xuICB9KTtcblxuICAvLyBOb3cgdGhhdCB3ZSBoYXZlIGEgcXVldWUgb2Ygd2VpZ2h0ZWQgc2NyaXB0cywgd2UgYmVnaW4gYSBsb29wIHdoZXJlYnkgd2VcbiAgLy8gcmVtb3ZlIHRoZSB0d28gbG93ZXN0IHdlaWdodGVkIGl0ZW1zIGZyb20gdGhlIHF1ZXVlLiBXZSBjcmVhdGUgYSB0YXAgYnJhbmNoXG4gIC8vIG5vZGUgZnJvbSB0aGUgdHdvIGl0ZW1zLCBhbmQgYWRkIHRoZSBicmFuY2ggYmFjayB0byB0aGUgcXVldWUgd2l0aCB0aGVcbiAgLy8gY29tYmluZWQgd2VpZ2h0IG9mIGJvdGggaXRzIGNoaWxkcmVuLiBFYWNoIGxvb3AgcmVkdWNlcyB0aGUgbnVtYmVyIG9mIGl0ZW1zXG4gIC8vIGluIHRoZSBxdWV1ZSBieSBvbmUsIGFuZCB3ZSByZXBlYXQgdW50aWwgd2UgYXJlIGxlZnQgd2l0aCBvbmx5IG9uZSBpdGVtIC1cbiAgLy8gdGhpcyBiZWNvbWVzIHRoZSB0YXAgdHJlZSByb290LlxuICAvL1xuICAvLyBGb3IgZXhhbXBsZSwgaWYgd2UgYmVnaW4gd2l0aCBzY3JpcHRzIEEsIEIsIEMsIEQgd2l0aCB3ZWlnaHRzIDYsIDMsIDEsIDFcbiAgLy8gQWZ0ZXIgZmlyc3QgbG9vcDogQSg2KSwgQigzKSwgQ0QoMSArIDEpXG4gIC8vIEFmdGVyIHNlY29uZCBsb29wOiBBKDYpLCBCW0NEXSgzICsgMilcbiAgLy8gRmluYWwgbG9vcDogQVtCW0NEXV0oNis1KVxuICAvLyBUaGUgZmluYWwgdHJlZSB3aWxsIGxvb2sgbGlrZTpcbiAgLy9cbiAgLy8gICAgICAgIEFbQltDRF1dXG4gIC8vICAgICAgIC8gICAgICAgIFxcXG4gIC8vICAgICAgQSAgICAgICAgIEJbQ0RdXG4gIC8vICAgICAgICAgICAgICAgLyAgICAgXFxcbiAgLy8gICAgICAgICAgICAgIEIgICAgICBbQ0RdXG4gIC8vICAgICAgICAgICAgICAgICAgICAvICAgIFxcXG4gIC8vICAgICAgICAgICAgICAgICAgIEMgICAgICBEXG4gIC8vXG4gIC8vIFRoaXMgZW5zdXJlcyB0aGF0IHRoZSBzcGVuZGluZyBjb25kaXRpb25zIHdlIGJlbGlldmUgdG8gaGF2ZSB0aGUgaGlnaGVzdFxuICAvLyBwcm9iYWJpbGl0eSBvZiBiZWluZyB1c2VkIGFyZSBmdXJ0aGVyIHVwIHRoZSB0cmVlIHRoYW4gbGVzcyBsaWtlbHkgc2NyaXB0cyxcbiAgLy8gdGhlcmVieSByZWR1Y2luZyB0aGUgc2l6ZSBvZiB0aGUgbWVya2xlIHByb29mcyBmb3IgdGhlIG1vcmUgbGlrZWx5IHNjcmlwdHMuXG4gIHdoaWxlIChxdWV1ZS5zaXplID4gMSkge1xuICAgIC8vIFdlIGNhbiBzYWZlbHkgZXhwZWN0IHR3byBwb2xscyB0byByZXR1cm4gbm9uLW51bGwgZWxlbWVudHMgc2luY2Ugd2UndmVcbiAgICAvLyBjaGVja2VkIHRoYXQgdGhlIHF1ZXVlIGhhcyBhdCBsZWFzdCB0d28gZWxlbWVudHMgYmVmb3JlIGxvb3BpbmcuXG4gICAgY29uc3QgY2hpbGQxID0gcXVldWUucG9sbCgpIGFzIFdlaWdodGVkVGFwU2NyaXB0O1xuICAgIGNvbnN0IGNoaWxkMiA9IHF1ZXVlLnBvbGwoKSBhcyBXZWlnaHRlZFRhcFNjcmlwdDtcblxuICAgIE9iamVjdC52YWx1ZXMoY2hpbGQxLnBhdGhzKS5mb3JFYWNoKChwYXRoKSA9PiBwYXRoLnB1c2goY2hpbGQyLnRhZ2dlZEhhc2gpKTtcbiAgICBPYmplY3QudmFsdWVzKGNoaWxkMi5wYXRocykuZm9yRWFjaCgocGF0aCkgPT4gcGF0aC5wdXNoKGNoaWxkMS50YWdnZWRIYXNoKSk7XG5cbiAgICBxdWV1ZS5hZGQoe1xuICAgICAgdGFnZ2VkSGFzaDogaGFzaFRhcEJyYW5jaChjaGlsZDEudGFnZ2VkSGFzaCwgY2hpbGQyLnRhZ2dlZEhhc2gpLFxuICAgICAgd2VpZ2h0OiBjaGlsZDEud2VpZ2h0ICsgY2hpbGQyLndlaWdodCxcbiAgICAgIHBhdGhzOiB7IC4uLmNoaWxkMS5wYXRocywgLi4uY2hpbGQyLnBhdGhzIH0sXG4gICAgfSk7XG4gIH1cblxuICAvLyBBZnRlciB0aGUgd2hpbGUgbG9vcCBhYm92ZSBjb21wbGV0ZXMgd2Ugc2hvdWxkIGhhdmUgZXhhY3RseSBvbmUgZWxlbWVudFxuICAvLyByZW1haW5pbmcgaW4gdGhlIHF1ZXVlLCB3aGljaCB3ZSBjYW4gc2FmZWx5IGV4dHJhY3QgYmVsb3cuXG4gIGNvbnN0IHJvb3ROb2RlID0gcXVldWUucG9sbCgpIGFzIFdlaWdodGVkVGFwU2NyaXB0O1xuXG4gIGNvbnN0IHBhdGhzID0gT2JqZWN0LmVudHJpZXMocm9vdE5vZGUucGF0aHMpLnJlZHVjZSgoYWNjLCBbaW5kZXgsIHBhdGhdKSA9PiB7XG4gICAgYWNjW051bWJlcihpbmRleCldID0gcGF0aDsgLy8gVE9ETzogV2h5IGRvZXNuJ3QgVFMga25vdyBpdCdzIGEgbnVtYmVyP1xuICAgIHJldHVybiBhY2M7XG4gIH0sIEFycmF5KHNjcmlwdHMubGVuZ3RoKSk7XG4gIHJldHVybiB7IHJvb3Q6IHJvb3ROb2RlLnRhZ2dlZEhhc2gsIHBhdGhzIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRDb250cm9sQmxvY2soXG4gIHBhcml0eTogMCB8IDEsXG4gIHB1YmtleTogVWludDhBcnJheSxcbiAgcGF0aDogQnVmZmVyW10sXG4gIGxlYWZWZXJzaW9uID0gSU5JVElBTF9UQVBTQ1JJUFRfVkVSU0lPTlxuKTogQnVmZmVyIHtcbiAgY29uc3QgcGFyaXR5VmVyc2lvbiA9IGxlYWZWZXJzaW9uICsgcGFyaXR5O1xuXG4gIHJldHVybiBCdWZmZXIuY29uY2F0KFtCdWZmZXIub2YocGFyaXR5VmVyc2lvbiksIHB1YmtleSwgLi4ucGF0aF0pO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEtleVBhdGhXaXRuZXNzIHtcbiAgc3BlbmRUeXBlOiAnS2V5JztcbiAgc2lnbmF0dXJlOiBCdWZmZXI7XG4gIGFubmV4PzogQnVmZmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFNjcmlwdFBhdGhXaXRuZXNzIHtcbiAgc3BlbmRUeXBlOiAnU2NyaXB0JztcbiAgc2NyaXB0U2lnOiBCdWZmZXJbXTtcbiAgdGFwc2NyaXB0OiBCdWZmZXI7XG4gIGNvbnRyb2xCbG9jazogQnVmZmVyO1xuICBhbm5leD86IEJ1ZmZlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDb250cm9sQmxvY2sge1xuICBwYXJpdHk6IG51bWJlcjtcbiAgaW50ZXJuYWxQdWJrZXk6IEJ1ZmZlcjtcbiAgbGVhZlZlcnNpb246IG51bWJlcjtcbiAgcGF0aDogQnVmZmVyW107XG59XG5cbi8qKlxuICogUGFyc2VzIGEgdGFwcm9vdCB3aXRuZXNzIHN0YWNrIGFuZCBleHRyYWN0cyBrZXkgZGF0YSBlbGVtZW50cy5cbiAqIEBwYXJhbSB3aXRuZXNzU3RhY2tcbiAqIEByZXR1cm5zIHtTY3JpcHRQYXRoV2l0bmVzc3xLZXlQYXRoV2l0bmVzc30gYW4gb2JqZWN0IHJlcHJlc2VudGluZyB0aGVcbiAqIHBhcnNlZCB3aXRuZXNzIGZvciBhIHNjcmlwdCBwYXRoIG9yIGtleSBwYXRoIHNwZW5kLlxuICogQHRocm93cyB7RXJyb3J9IGlmIHRoZSB3aXRuZXNzIHN0YWNrIGRvZXMgbm90IGNvbmZvcm0gdG8gdGhlIEJJUCAzNDEgc2NyaXB0IHZhbGlkYXRpb24gcnVsZXNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlVGFwcm9vdFdpdG5lc3Mod2l0bmVzc1N0YWNrOiBCdWZmZXJbXSk6IFNjcmlwdFBhdGhXaXRuZXNzIHwgS2V5UGF0aFdpdG5lc3Mge1xuICBsZXQgYW5uZXg7XG4gIGlmICh3aXRuZXNzU3RhY2subGVuZ3RoID49IDIgJiYgd2l0bmVzc1N0YWNrW3dpdG5lc3NTdGFjay5sZW5ndGggLSAxXVswXSA9PT0gMHg1MCkge1xuICAgIC8vIElmIHRoZXJlIGFyZSBhdCBsZWFzdCB0d28gd2l0bmVzcyBlbGVtZW50cywgYW5kIHRoZSBmaXJzdCBieXRlIG9mIHRoZSBsYXN0IGVsZW1lbnQgaXNcbiAgICAvLyAweDUwLCB0aGlzIGxhc3QgZWxlbWVudCBpcyBjYWxsZWQgYW5uZXggYSBhbmQgaXMgcmVtb3ZlZCBmcm9tIHRoZSB3aXRuZXNzIHN0YWNrXG4gICAgYW5uZXggPSB3aXRuZXNzU3RhY2tbd2l0bmVzc1N0YWNrLmxlbmd0aCAtIDFdO1xuICAgIHdpdG5lc3NTdGFjayA9IHdpdG5lc3NTdGFjay5zbGljZSgwLCAtMSk7XG4gIH1cblxuICBpZiAod2l0bmVzc1N0YWNrLmxlbmd0aCA8IDEpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3dpdG5lc3Mgc3RhY2sgbXVzdCBoYXZlIGF0IGxlYXN0IG9uZSBlbGVtZW50Jyk7XG4gIH0gZWxzZSBpZiAod2l0bmVzc1N0YWNrLmxlbmd0aCA9PT0gMSkge1xuICAgIC8vIGtleSBwYXRoIHNwZW5kXG4gICAgY29uc3Qgc2lnbmF0dXJlID0gd2l0bmVzc1N0YWNrWzBdO1xuICAgIGlmICghYnNjcmlwdC5pc0Nhbm9uaWNhbFNjaG5vcnJTaWduYXR1cmUoc2lnbmF0dXJlKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdpbnZhbGlkIHNpZ25hdHVyZScpO1xuICAgIH1cbiAgICByZXR1cm4geyBzcGVuZFR5cGU6ICdLZXknLCBzaWduYXR1cmUsIGFubmV4IH07XG4gIH1cblxuICAvLyBzY3JpcHQgcGF0aCBzcGVuZFxuICAvLyBzZWNvbmQgdG8gbGFzdCBlbGVtZW50IGlzIHRoZSB0YXBzY3JpcHRcbiAgY29uc3QgdGFwc2NyaXB0ID0gd2l0bmVzc1N0YWNrW3dpdG5lc3NTdGFjay5sZW5ndGggLSAyXTtcbiAgY29uc3QgdGFwc2NyaXB0Q2h1bmtzID0gYnNjcmlwdC5kZWNvbXBpbGUodGFwc2NyaXB0KTtcblxuICBpZiAoIXRhcHNjcmlwdENodW5rcyB8fCB0YXBzY3JpcHRDaHVua3MubGVuZ3RoID09PSAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCd0YXBzY3JpcHQgaXMgbm90IGEgdmFsaWQgc2NyaXB0Jyk7XG4gIH1cblxuICAvLyBUaGUgbGFzdCBzdGFjayBlbGVtZW50IGlzIGNhbGxlZCB0aGUgY29udHJvbCBibG9jayBjLCBhbmQgbXVzdCBoYXZlIGxlbmd0aCAzMyArIDMybSxcbiAgLy8gZm9yIGEgdmFsdWUgb2YgbSB0aGF0IGlzIGFuIGludGVnZXIgYmV0d2VlbiAwIGFuZCAxMjgsIGluY2x1c2l2ZVxuICBjb25zdCBjb250cm9sQmxvY2sgPSB3aXRuZXNzU3RhY2tbd2l0bmVzc1N0YWNrLmxlbmd0aCAtIDFdO1xuICBpZiAoY29udHJvbEJsb2NrLmxlbmd0aCA8IDMzIHx8IGNvbnRyb2xCbG9jay5sZW5ndGggPiAzMyArIDMyICogMTI4IHx8IGNvbnRyb2xCbG9jay5sZW5ndGggJSAzMiAhPT0gMSkge1xuICAgIHRocm93IG5ldyBFcnJvcignaW52YWxpZCBjb250cm9sIGJsb2NrIGxlbmd0aCcpO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBzcGVuZFR5cGU6ICdTY3JpcHQnLFxuICAgIHNjcmlwdFNpZzogd2l0bmVzc1N0YWNrLnNsaWNlKDAsIC0yKSxcbiAgICB0YXBzY3JpcHQsXG4gICAgY29udHJvbEJsb2NrLFxuICAgIGFubmV4LFxuICB9O1xufVxuXG4vKipcbiAqIFBhcnNlcyBhIHRhcHJvb3QgY29udHJvbCBibG9jay5cbiAqIEBwYXJhbSBlY2MgRWxsaXB0aWMgY3VydmUgaW1wbGVtZW50YXRpb25cbiAqIEBwYXJhbSBjb250cm9sQmxvY2sgdGhlIGNvbnRyb2wgYmxvY2sgdG8gcGFyc2VcbiAqIEByZXR1cm5zIHtDb250cm9sQmxvY2t9IHRoZSBwYXJzZWQgY29udHJvbCBibG9ja1xuICogQHRocm93cyB7RXJyb3J9IGlmIHRoZSB3aXRuZXNzIHN0YWNrIGRvZXMgbm90IGNvbmZvcm0gdG8gdGhlIEJJUCAzNDEgc2NyaXB0IHZhbGlkYXRpb24gcnVsZXNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlQ29udHJvbEJsb2NrKGVjYzogVGlueVNlY3AyNTZrMUludGVyZmFjZSwgY29udHJvbEJsb2NrOiBCdWZmZXIpOiBDb250cm9sQmxvY2sge1xuICBpZiAoKGNvbnRyb2xCbG9jay5sZW5ndGggLSAxKSAlIDMyICE9PSAwKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignSW52YWxpZCBjb250cm9sIGJsb2NrIGxlbmd0aCcpO1xuICB9XG5cbiAgY29uc3QgcGFyaXR5ID0gY29udHJvbEJsb2NrWzBdICYgMHgwMTtcblxuICAvLyBMZXQgcCA9IGNbMTozM10gYW5kIGxldCBQID0gbGlmdF94KGludChwKSkgd2hlcmUgbGlmdF94IGFuZCBbOl0gYXJlIGRlZmluZWQgYXMgaW4gQklQMzQwLlxuICAvLyBGYWlsIGlmIHRoaXMgcG9pbnQgaXMgbm90IG9uIHRoZSBjdXJ2ZVxuICBjb25zdCBpbnRlcm5hbFB1YmtleSA9IGNvbnRyb2xCbG9jay5zbGljZSgxLCAzMyk7XG4gIGlmICghZWNjLmlzWE9ubHlQb2ludChpbnRlcm5hbFB1YmtleSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2ludGVybmFsIHB1YmtleSBpcyBub3QgYW4gRUMgcG9pbnQnKTtcbiAgfVxuXG4gIC8vIFRoZSBsZWFmIHZlcnNpb24gY2Fubm90IGJlIDB4NTAgYXMgdGhhdCB3b3VsZCByZXN1bHQgaW4gYW1iaWd1aXR5IHdpdGggdGhlIGFubmV4LlxuICBjb25zdCBsZWFmVmVyc2lvbiA9IGNvbnRyb2xCbG9ja1swXSAmIDB4ZmU7XG4gIGlmIChsZWFmVmVyc2lvbiA9PT0gMHg1MCkge1xuICAgIHRocm93IG5ldyBFcnJvcignaW52YWxpZCBsZWFmIHZlcnNpb24nKTtcbiAgfVxuXG4gIGNvbnN0IHBhdGg6IEJ1ZmZlcltdID0gW107XG4gIGZvciAobGV0IGogPSAzMzsgaiA8IGNvbnRyb2xCbG9jay5sZW5ndGg7IGogKz0gMzIpIHtcbiAgICBwYXRoLnB1c2goY29udHJvbEJsb2NrLnNsaWNlKGosIGogKyAzMikpO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBwYXJpdHksXG4gICAgaW50ZXJuYWxQdWJrZXksXG4gICAgbGVhZlZlcnNpb24sXG4gICAgcGF0aCxcbiAgfTtcbn1cblxuLyoqXG4gKiBDYWxjdWxhdGVzIHRoZSB0YXBsZWFmIGhhc2ggZnJvbSBhIGNvbnRyb2wgYmxvY2sgYW5kIHNjcmlwdC5cbiAqIEBwYXJhbSBlY2MgRWxsaXB0aWMgY3VydmUgaW1wbGVtZW50YXRpb25cbiAqIEBwYXJhbSBjb250cm9sQmxvY2sgdGhlIGNvbnRyb2wgYmxvY2ssIGVpdGhlciByYXcgb3IgcGFyc2VkXG4gKiBAcGFyYW0gdGFwc2NyaXB0IHRoZSBsZWFmIHNjcmlwdCBjb3JyZXNkcG9uZGluZyB0byB0aGUgY29udHJvbCBibG9ja1xuICogQHJldHVybnMge0J1ZmZlcn0gdGhlIHRhcGxlYWYgaGFzaFxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0VGFwbGVhZkhhc2goXG4gIGVjYzogVGlueVNlY3AyNTZrMUludGVyZmFjZSxcbiAgY29udHJvbEJsb2NrOiBCdWZmZXIgfCBDb250cm9sQmxvY2ssXG4gIHRhcHNjcmlwdDogQnVmZmVyXG4pOiBCdWZmZXIge1xuICBpZiAoQnVmZmVyLmlzQnVmZmVyKGNvbnRyb2xCbG9jaykpIHtcbiAgICBjb250cm9sQmxvY2sgPSBwYXJzZUNvbnRyb2xCbG9jayhlY2MsIGNvbnRyb2xCbG9jayk7XG4gIH1cbiAgY29uc3QgeyBsZWFmVmVyc2lvbiB9ID0gY29udHJvbEJsb2NrO1xuXG4gIHJldHVybiBiY3J5cHRvLnRhZ2dlZEhhc2goXG4gICAgJ1RhcExlYWYnLFxuICAgIEJ1ZmZlci5jb25jYXQoW0J1ZmZlci5vZihsZWFmVmVyc2lvbiksIHNlcmlhbGl6ZVNjcmlwdFNpemUodGFwc2NyaXB0KSwgdGFwc2NyaXB0XSlcbiAgKTtcbn1cblxuLyoqXG4gKiBDYWxjdWxhdGVzIHRoZSB0YXB0cmVlIHJvb3QgaGFzaCBmcm9tIGEgY29udHJvbCBibG9jayBhbmQgc2NyaXB0LlxuICogQHBhcmFtIGVjYyBFbGxpcHRpYyBjdXJ2ZSBpbXBsZW1lbnRhdGlvblxuICogQHBhcmFtIGNvbnRyb2xCbG9jayB0aGUgY29udHJvbCBibG9jaywgZWl0aGVyIHJhdyBvciBwYXJzZWRcbiAqIEBwYXJhbSB0YXBzY3JpcHQgdGhlIGxlYWYgc2NyaXB0IGNvcnJlc2Rwb25kaW5nIHRvIHRoZSBjb250cm9sIGJsb2NrXG4gKiBAcGFyYW0gdGFwbGVhZkhhc2ggdGhlIGxlYWYgaGFzaCBpZiBhbHJlYWR5IGNhbGN1bGF0ZWRcbiAqIEByZXR1cm5zIHtCdWZmZXJ9IHRoZSB0YXB0cmVlIHJvb3QgaGFzaFxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0VGFwdHJlZVJvb3QoXG4gIGVjYzogVGlueVNlY3AyNTZrMUludGVyZmFjZSxcbiAgY29udHJvbEJsb2NrOiBCdWZmZXIgfCBDb250cm9sQmxvY2ssXG4gIHRhcHNjcmlwdDogQnVmZmVyLFxuICB0YXBsZWFmSGFzaD86IEJ1ZmZlclxuKTogQnVmZmVyIHtcbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihjb250cm9sQmxvY2spKSB7XG4gICAgY29udHJvbEJsb2NrID0gcGFyc2VDb250cm9sQmxvY2soZWNjLCBjb250cm9sQmxvY2spO1xuICB9XG4gIGNvbnN0IHsgcGF0aCB9ID0gY29udHJvbEJsb2NrO1xuXG4gIHRhcGxlYWZIYXNoID0gdGFwbGVhZkhhc2ggfHwgZ2V0VGFwbGVhZkhhc2goZWNjLCBjb250cm9sQmxvY2ssIHRhcHNjcmlwdCk7XG5cbiAgLy8gYHRhcHRyZWVNZXJrbGVIYXNoYCBiZWdpbnMgYXMgb3VyIHRhcHNjcmlwdCB0YXBsZWFmIGhhc2ggYW5kIGl0cyB2YWx1ZSBpdGVyYXRlc1xuICAvLyB0aHJvdWdoIGl0cyBwYXJlbnQgdGFwYnJhbmNoIGhhc2hlcyB1bnRpbCBpdCBlbmRzIHVwIGFzIHRoZSB0YXB0cmVlIHJvb3QgaGFzaFxuICBsZXQgdGFwdHJlZU1lcmtsZUhhc2ggPSB0YXBsZWFmSGFzaDtcbiAgZm9yIChjb25zdCB0YXB0cmVlU2libGluZ0hhc2ggb2YgcGF0aCkge1xuICAgIHRhcHRyZWVNZXJrbGVIYXNoID1cbiAgICAgIEJ1ZmZlci5jb21wYXJlKHRhcHRyZWVNZXJrbGVIYXNoLCB0YXB0cmVlU2libGluZ0hhc2gpID09PSAtMVxuICAgICAgICA/IGJjcnlwdG8udGFnZ2VkSGFzaCgnVGFwQnJhbmNoJywgQnVmZmVyLmNvbmNhdChbdGFwdHJlZU1lcmtsZUhhc2gsIHRhcHRyZWVTaWJsaW5nSGFzaF0pKVxuICAgICAgICA6IGJjcnlwdG8udGFnZ2VkSGFzaCgnVGFwQnJhbmNoJywgQnVmZmVyLmNvbmNhdChbdGFwdHJlZVNpYmxpbmdIYXNoLCB0YXB0cmVlTWVya2xlSGFzaF0pKTtcbiAgfVxuXG4gIHJldHVybiB0YXB0cmVlTWVya2xlSGFzaDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFR3ZWFrZWRPdXRwdXRLZXkocGF5bWVudDogYnBheW1lbnRzLlBheW1lbnQpOiBCdWZmZXIge1xuICBhc3NlcnQocGF5bWVudC5vdXRwdXQpO1xuICBpZiAocGF5bWVudC5vdXRwdXQubGVuZ3RoID09PSAzNCkge1xuICAgIHJldHVybiBwYXltZW50Lm91dHB1dD8uc3ViYXJyYXkoMik7XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKGBpbnZhbGlkIHAydHIgdHdlYWtlZCBvdXRwdXQga2V5IHNpemUgJHtwYXltZW50Lm91dHB1dC5sZW5ndGh9YCk7XG59XG5cbi8qKlxuICogQHJldHVybnMgb3V0cHV0IHNjcmlwdCBmb3IgZWl0aGVyIHNjcmlwdCBwYXRoIGlucHV0IGNvbnRyb2xCbG9ja1xuICogJiBsZWFmU2NyaXB0IE9SIGtleSBwYXRoIGlucHV0IGludGVybmFsUHViS2V5ICYgdGFwdHJlZVJvb3RcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVRhcHJvb3RPdXRwdXRTY3JpcHQoXG4gIHAydHJBcmdzOiB7IGludGVybmFsUHViS2V5OiBCdWZmZXI7IHRhcHRyZWVSb290OiBCdWZmZXIgfSB8IHsgY29udHJvbEJsb2NrOiBCdWZmZXI7IGxlYWZTY3JpcHQ6IEJ1ZmZlciB9XG4pOiBCdWZmZXIge1xuICBsZXQgaW50ZXJuYWxQdWJLZXk6IEJ1ZmZlciB8IHVuZGVmaW5lZDtcbiAgbGV0IHRhcHRyZWVSb290OiBCdWZmZXIgfCB1bmRlZmluZWQ7XG4gIGlmICgnaW50ZXJuYWxQdWJLZXknIGluIHAydHJBcmdzKSB7XG4gICAgaW50ZXJuYWxQdWJLZXkgPSBwMnRyQXJncy5pbnRlcm5hbFB1YktleTtcbiAgICB0YXB0cmVlUm9vdCA9IHAydHJBcmdzLnRhcHRyZWVSb290O1xuICB9IGVsc2Uge1xuICAgIGludGVybmFsUHViS2V5ID0gcGFyc2VDb250cm9sQmxvY2soZWNjTGliLCBwMnRyQXJncy5jb250cm9sQmxvY2spLmludGVybmFsUHVia2V5O1xuICAgIHRhcHRyZWVSb290ID0gZ2V0VGFwdHJlZVJvb3QoZWNjTGliLCBwMnRyQXJncy5jb250cm9sQmxvY2ssIHAydHJBcmdzLmxlYWZTY3JpcHQpO1xuICB9XG4gIGNvbnN0IG91dHB1dEtleSA9IHRhcFR3ZWFrUHVia2V5KGVjY0xpYiwgaW50ZXJuYWxQdWJLZXksIHRhcHRyZWVSb290KS54T25seVB1YmtleTtcbiAgcmV0dXJuIGJzY3JpcHQuY29tcGlsZShbYnNjcmlwdC5PUFMuT1BfMSwgQnVmZmVyLmZyb20ob3V0cHV0S2V5KV0pO1xufVxuXG4vKipcbiAqIEByZXR1cm5zIHgtb25seSB0YXByb290IG91dHB1dCBrZXkgKHRhcE91dHB1dEtleSlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFRhcHJvb3RPdXRwdXRLZXkob3V0cHV0U2NyaXB0OiBCdWZmZXIgfCAobnVtYmVyIHwgQnVmZmVyKVtdKTogQnVmZmVyIHtcbiAgY29uc3Qgb3V0cHV0RGVjb21waWxlZCA9IGJzY3JpcHQuZGVjb21waWxlKG91dHB1dFNjcmlwdCk7XG4gIGlmIChvdXRwdXREZWNvbXBpbGVkPy5sZW5ndGggIT09IDIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2ludmFsaWQgdGFwcm9vdCBvdXRwdXQgc2NyaXB0Jyk7XG4gIH1cbiAgY29uc3QgW29wMSwgb3V0cHV0S2V5XSA9IG91dHB1dERlY29tcGlsZWQ7XG4gIGlmIChvcDEgIT09IGJzY3JpcHQuT1BTLk9QXzEgfHwgIUJ1ZmZlci5pc0J1ZmZlcihvdXRwdXRLZXkpIHx8IG91dHB1dEtleS5sZW5ndGggIT09IDMyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdpbnZhbGlkIHRhcHJvb3Qgb3V0cHV0IHNjcmlwdCcpO1xuICB9XG4gIHJldHVybiBvdXRwdXRLZXk7XG59XG4iXX0=