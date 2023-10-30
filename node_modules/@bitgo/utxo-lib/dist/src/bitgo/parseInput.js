"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePubScript = exports.parsePubScript2Of3 = exports.parseSignatureScript2Of3 = exports.parseSignatureScript = exports.getLeafVersion = exports.calculateScriptPathLevel = exports.isValidControlBock = exports.isPlaceholderSignature = void 0;
/* eslint no-redeclare: 0 */
const opcodes = require("bitcoin-ops");
const bitcoinjs_lib_1 = require("bitcoinjs-lib");
const types_1 = require("./types");
const outputScripts_1 = require("./outputScripts");
function isPlaceholderSignature(v) {
    if (Buffer.isBuffer(v)) {
        return v.length === 0;
    }
    return v === 0;
}
exports.isPlaceholderSignature = isPlaceholderSignature;
/**
 * @return true iff P2TR script path's control block matches BitGo's need
 */
function isValidControlBock(controlBlock) {
    // The last stack element is called the control block c, and must have length 33 + 32m
    return Buffer.isBuffer(controlBlock) && 33 <= controlBlock.length && controlBlock.length % 32 === 1;
}
exports.isValidControlBock = isValidControlBock;
/**
 * @return script path level for P2TR control block
 */
function calculateScriptPathLevel(controlBlock) {
    if (!Buffer.isBuffer(controlBlock)) {
        throw new Error('Invalid control block type.');
    }
    if (controlBlock.length === 65) {
        return 1;
    }
    if (controlBlock.length === 97) {
        return 2;
    }
    throw new Error('unexpected control block length.');
}
exports.calculateScriptPathLevel = calculateScriptPathLevel;
/**
 * @return leaf version for P2TR control block.
 */
function getLeafVersion(controlBlock) {
    if (Buffer.isBuffer(controlBlock) && controlBlock.length > 0) {
        return controlBlock[0] & 0xfe;
    }
    throw new Error('unexpected leafVersion.');
}
exports.getLeafVersion = getLeafVersion;
function emptyMatchResult() {
    return {
        ':pubkey': [],
        ':pubkey-xonly': [],
        ':control-block': [],
        ':signature': [],
        ':script': [],
    };
}
class MatchError extends Error {
    constructor(message) {
        super(message);
        // this property is required to prohibit `return new Error()` when the return type demands `MatchError`
        this.__type = 'MatchError';
    }
    static forPatternElement(p) {
        if (typeof p === 'object' && ':script' in p) {
            return new MatchError(`error matching nested script`);
        }
        return new MatchError(`error matching ${p}`);
    }
}
/**
 * @param script
 * @param pattern
 * @return MatchResult if script matches pattern. The result will contain the matched values.
 */
function matchScript(script, pattern) {
    /**
     * Match a single script element with a ScriptPatternElement
     */
    function matchElement(e, p) {
        switch (p) {
            case 'OP_0':
                return e === opcodes.OP_0 || (Buffer.isBuffer(e) && e.length === 0);
            case 'OP_1':
            case 'OP_2':
            case 'OP_3':
            case 'OP_CHECKMULTISIG':
            case 'OP_CHECKSIG':
            case 'OP_CHECKSIGVERIFY':
                return e === opcodes[p];
            case ':pubkey':
                return Buffer.isBuffer(e) && (e.length === 33 || e.length === 65);
            case ':pubkey-xonly':
                return Buffer.isBuffer(e) && e.length === 32;
            case ':signature':
                return Buffer.isBuffer(e) || isPlaceholderSignature(e);
            case ':control-block':
                return Buffer.isBuffer(e) && isValidControlBock(e);
            default:
                throw new Error(`unknown pattern element ${p}`);
        }
    }
    if (script.length !== pattern.length) {
        return new MatchError(`length mismatch`);
    }
    // Go over each pattern element.
    // Collect captures into a result object.
    return pattern.reduce((obj, p, i) => {
        // if we had a previous mismatch, short-circuit
        if (obj instanceof MatchError) {
            return obj;
        }
        const e = script[i];
        // for ':script' pattern elements, decompile script element and recurse
        if (typeof p === 'object' && ':script' in p) {
            if (!Buffer.isBuffer(e)) {
                return new MatchError(`expected buffer for :script`);
            }
            const dec = bitcoinjs_lib_1.script.decompile(e);
            if (!dec) {
                return new MatchError(`error decompiling nested script`);
            }
            const match = matchScript(dec, p[':script']);
            if (match instanceof MatchError) {
                return match;
            }
            obj[':script'].push({
                buffer: e,
                match,
            });
            return obj;
        }
        const match = matchElement(e, p);
        if (!match) {
            return MatchError.forPatternElement(p);
        }
        // if pattern element is a capture, add it to the result obj
        if (p === ':signature' && e === 0) {
            obj[p].push(e);
        }
        else if (p in obj) {
            if (!Buffer.isBuffer(e)) {
                throw new Error(`invalid capture value`);
            }
            obj[p].push(e);
        }
        return obj;
    }, emptyMatchResult());
}
/**
 * @param script
 * @param patterns
 * @return first match
 */
function matchScriptSome(script, patterns) {
    for (const p of patterns) {
        const m = matchScript(script, p);
        if (m instanceof MatchError) {
            continue;
        }
        return m;
    }
    return new MatchError(`no match for script`);
}
function isLegacy(p) {
    return Boolean(p.script && !p.witness);
}
function isWrappedSegwit(p) {
    return Boolean(p.script && p.witness);
}
function isNativeSegwit(p) {
    return Boolean(!p.script && p.witness);
}
const parseP2shP2pk = (p) => {
    if (!isLegacy(p)) {
        return new MatchError(`expected legacy input`);
    }
    const match = matchScript(p.script, [':signature', { ':script': [':pubkey', 'OP_CHECKSIG'] }]);
    if (match instanceof MatchError) {
        return match;
    }
    return {
        scriptType: 'p2shP2pk',
        publicKeys: match[':script'][0].match[':pubkey'],
        signatures: match[':signature'],
    };
};
function parseP2ms(decScript, scriptType) {
    const pattern2Of3 = ['OP_2', ':pubkey', ':pubkey', ':pubkey', 'OP_3', 'OP_CHECKMULTISIG'];
    const match = matchScriptSome(decScript, [
        /* full-signed, no placeholder signature */
        ['OP_0', ':signature', ':signature', { ':script': pattern2Of3 }],
        /* half-signed, placeholder signatures */
        ['OP_0', ':signature', ':signature', ':signature', { ':script': pattern2Of3 }],
    ]);
    if (match instanceof MatchError) {
        return match;
    }
    const [redeemScript] = match[':script'];
    if (!types_1.isTriple(redeemScript.match[':pubkey'])) {
        throw new Error(`invalid pubkey count`);
    }
    return {
        scriptType,
        publicKeys: redeemScript.match[':pubkey'],
        pubScript: redeemScript.buffer,
        signatures: match[':signature'],
        redeemScript: scriptType === 'p2sh' ? redeemScript.buffer : undefined,
        witnessScript: scriptType === 'p2shP2wsh' || scriptType === 'p2wsh' ? redeemScript.buffer : undefined,
    };
}
const parseP2sh2Of3 = (p) => {
    if (!isLegacy(p)) {
        return new MatchError(`expected legacy input`);
    }
    return parseP2ms(p.script, 'p2sh');
};
const parseP2shP2wsh2Of3 = (p) => {
    if (!isWrappedSegwit(p)) {
        return new MatchError(`expected wrapped segwit input`);
    }
    return { ...parseP2ms(p.witness, 'p2shP2wsh'), redeemScript: p.script[0] };
};
const parseP2wsh2Of3 = (p) => {
    if (!isNativeSegwit(p)) {
        return new MatchError(`expected native segwit`);
    }
    return parseP2ms(p.witness, 'p2wsh');
};
const parseTaprootKeyPath2Of3 = (p) => {
    if (!isNativeSegwit(p)) {
        return new MatchError(`expected native segwit`);
    }
    const match = matchScript(p.witness, [':signature']);
    if (match instanceof MatchError) {
        return match;
    }
    const signatures = match[':signature'];
    if (isPlaceholderSignature(signatures[0])) {
        throw new Error(`invalid taproot key path signature`);
    }
    return {
        scriptType: 'taprootKeyPathSpend',
        signatures,
    };
};
const parseTaprootScriptPath2Of3 = (p) => {
    if (!isNativeSegwit(p)) {
        return new MatchError(`expected native segwit`);
    }
    // assumes no annex
    const match = matchScript(p.witness, [
        ':signature',
        ':signature',
        { ':script': [':pubkey-xonly', 'OP_CHECKSIGVERIFY', ':pubkey-xonly', 'OP_CHECKSIG'] },
        ':control-block',
    ]);
    if (match instanceof MatchError) {
        return match;
    }
    const [controlBlock] = match[':control-block'];
    const scriptPathLevel = calculateScriptPathLevel(controlBlock);
    const leafVersion = getLeafVersion(controlBlock);
    return {
        scriptType: 'taprootScriptPathSpend',
        pubScript: match[':script'][0].buffer,
        publicKeys: match[':script'][0].match[':pubkey-xonly'],
        signatures: match[':signature'],
        controlBlock,
        scriptPathLevel,
        leafVersion,
    };
};
/**
 * Parse a transaction's signature script to obtain public keys, signatures, the sig script,
 * and other properties.
 *
 * Only supports script types used in BitGo transactions.
 *
 * @param input
 * @returns ParsedSignatureScript
 */
function parseSignatureScript(input) {
    const decScript = bitcoinjs_lib_1.script.decompile(input.script);
    const parsers = [
        parseP2sh2Of3,
        parseP2shP2wsh2Of3,
        parseP2wsh2Of3,
        parseTaprootKeyPath2Of3,
        parseTaprootScriptPath2Of3,
        parseP2shP2pk,
    ];
    for (const f of parsers) {
        const parsed = f({
            script: (decScript === null || decScript === void 0 ? void 0 : decScript.length) === 0 ? null : decScript,
            witness: input.witness.length === 0 ? null : input.witness,
        });
        if (parsed instanceof MatchError) {
            continue;
        }
        return parsed;
    }
    throw new Error(`could not parse input`);
}
exports.parseSignatureScript = parseSignatureScript;
function parseSignatureScript2Of3(input) {
    const result = parseSignatureScript(input);
    if (!outputScripts_1.isScriptType2Of3(result.scriptType) &&
        result.scriptType !== 'taprootKeyPathSpend' &&
        result.scriptType !== 'taprootScriptPathSpend') {
        throw new Error(`invalid script type`);
    }
    if (!result.signatures) {
        throw new Error(`missing signatures`);
    }
    if (result.scriptType !== 'taprootKeyPathSpend' &&
        result.publicKeys.length !== 3 &&
        (result.publicKeys.length !== 2 || result.scriptType !== 'taprootScriptPathSpend')) {
        throw new Error(`unexpected pubkey count`);
    }
    return result;
}
exports.parseSignatureScript2Of3 = parseSignatureScript2Of3;
const parseP2shP2pkPubScript = (pubScript, scriptType) => {
    if (scriptType !== 'p2shP2pk') {
        throw new Error('invalid script type');
    }
    const match = matchScript([pubScript], [{ ':script': [':pubkey', 'OP_CHECKSIG'] }]);
    if (match instanceof MatchError) {
        return match;
    }
    const [script] = match[':script'];
    return {
        scriptType,
        publicKeys: script.match[':pubkey'],
        pubScript: pubScript,
        redeemScript: pubScript,
    };
};
const parseP2msPubScript = (pubScript, scriptType) => {
    if (scriptType === 'taprootScriptPathSpend' || scriptType === 'taprootKeyPathSpend' || scriptType === 'p2shP2pk') {
        throw new Error('invalid script type');
    }
    const match = matchScript([pubScript], [{ ':script': ['OP_2', ':pubkey', ':pubkey', ':pubkey', 'OP_3', 'OP_CHECKMULTISIG'] }]);
    if (match instanceof MatchError) {
        return match;
    }
    const [redeemScript] = match[':script'];
    if (!types_1.isTriple(redeemScript.match[':pubkey'])) {
        throw new Error('invalid pubkey count');
    }
    return {
        scriptType,
        publicKeys: redeemScript.match[':pubkey'],
        pubScript: redeemScript.buffer,
        redeemScript: scriptType === 'p2sh' ? redeemScript.buffer : undefined,
        witnessScript: scriptType === 'p2shP2wsh' || scriptType === 'p2wsh' ? redeemScript.buffer : undefined,
    };
};
const parseTaprootKeyPathPubScript = (pubScript, scriptType) => {
    if (scriptType === 'p2sh' ||
        scriptType === 'p2wsh' ||
        scriptType === 'p2shP2wsh' ||
        scriptType === 'taprootScriptPathSpend' ||
        scriptType === 'p2shP2pk') {
        throw new Error('invalid script type');
    }
    const match = matchScript([pubScript], [{ ':script': ['OP_1', ':pubkey-xonly'] }]);
    if (match instanceof MatchError) {
        return match;
    }
    const [script] = match[':script'];
    return {
        scriptType: 'taprootKeyPathSpend',
        publicKeys: script.match[':pubkey-xonly'],
        pubScript: pubScript,
    };
};
const parseTaprootScriptPathPubScript = (pubScript, scriptType) => {
    if (scriptType === 'p2sh' ||
        scriptType === 'p2wsh' ||
        scriptType === 'p2shP2wsh' ||
        scriptType === 'taprootKeyPathSpend' ||
        scriptType === 'p2shP2pk') {
        throw new Error('invalid script type');
    }
    const match = matchScript([pubScript], [{ ':script': [':pubkey-xonly', 'OP_CHECKSIGVERIFY', ':pubkey-xonly', 'OP_CHECKSIG'] }]);
    if (match instanceof MatchError) {
        return match;
    }
    return {
        scriptType,
        pubScript: match[':script'][0].buffer,
        publicKeys: match[':script'][0].match[':pubkey-xonly'],
    };
};
function parsePubScript2Of3(inputPubScript, scriptType) {
    const result = scriptType === 'taprootKeyPathSpend'
        ? parseTaprootKeyPathPubScript(inputPubScript, scriptType)
        : scriptType === 'taprootScriptPathSpend'
            ? parseTaprootScriptPathPubScript(inputPubScript, scriptType)
            : parseP2msPubScript(inputPubScript, scriptType);
    if (result instanceof MatchError) {
        throw new Error(result.message);
    }
    if ((result.scriptType === 'taprootKeyPathSpend' && result.publicKeys.length !== 1) ||
        (result.scriptType === 'taprootScriptPathSpend' && result.publicKeys.length !== 2) ||
        (outputScripts_1.isScriptType2Of3(result.scriptType) && result.publicKeys.length !== 3)) {
        throw new Error('unexpected pubkey count');
    }
    return result;
}
exports.parsePubScript2Of3 = parsePubScript2Of3;
function parsePubScript(inputPubScript, scriptType) {
    const result = scriptType === 'p2shP2pk'
        ? parseP2shP2pkPubScript(inputPubScript, scriptType)
        : parsePubScript2Of3(inputPubScript, scriptType);
    if (result instanceof MatchError) {
        throw new Error(result.message);
    }
    if (result.scriptType === 'p2shP2pk' && result.publicKeys.length !== 1) {
        throw new Error('unexpected pubkey count');
    }
    return result;
}
exports.parsePubScript = parsePubScript;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFyc2VJbnB1dC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9iaXRnby9wYXJzZUlucHV0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDRCQUE0QjtBQUM1Qix1Q0FBdUM7QUFDdkMsaURBQTJEO0FBRTNELG1DQUFtQztBQUNuQyxtREFBbUQ7QUFFbkQsU0FBZ0Isc0JBQXNCLENBQUMsQ0FBa0I7SUFDdkQsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFO1FBQ3RCLE9BQU8sQ0FBQyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUM7S0FDdkI7SUFDRCxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDakIsQ0FBQztBQUxELHdEQUtDO0FBRUQ7O0dBRUc7QUFDSCxTQUFnQixrQkFBa0IsQ0FBQyxZQUFvQjtJQUNyRCxzRkFBc0Y7SUFDdEYsT0FBTyxNQUFNLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsSUFBSSxZQUFZLENBQUMsTUFBTSxJQUFJLFlBQVksQ0FBQyxNQUFNLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQztBQUN0RyxDQUFDO0FBSEQsZ0RBR0M7QUFFRDs7R0FFRztBQUNILFNBQWdCLHdCQUF3QixDQUFDLFlBQW9CO0lBQzNELElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxFQUFFO1FBQ2xDLE1BQU0sSUFBSSxLQUFLLENBQUMsNkJBQTZCLENBQUMsQ0FBQztLQUNoRDtJQUNELElBQUksWUFBWSxDQUFDLE1BQU0sS0FBSyxFQUFFLEVBQUU7UUFDOUIsT0FBTyxDQUFDLENBQUM7S0FDVjtJQUNELElBQUksWUFBWSxDQUFDLE1BQU0sS0FBSyxFQUFFLEVBQUU7UUFDOUIsT0FBTyxDQUFDLENBQUM7S0FDVjtJQUNELE1BQU0sSUFBSSxLQUFLLENBQUMsa0NBQWtDLENBQUMsQ0FBQztBQUN0RCxDQUFDO0FBWEQsNERBV0M7QUFFRDs7R0FF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QyxNQUFNLEtBQUssQ0FBQyxFQUFFO1FBQ3RFLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztLQUM1QztJQUVELE9BQU8sTUFBTSxDQUFDO0FBQ2hCLENBQUM7QUFsQkQsd0NBa0JDIiwic291cmNlc0NvbnRlbnQiOlsiLyogZXNsaW50IG5vLXJlZGVjbGFyZTogMCAqL1xuaW1wb3J0ICogYXMgb3Bjb2RlcyBmcm9tICdiaXRjb2luLW9wcyc7XG5pbXBvcnQgeyBUeElucHV0LCBzY3JpcHQgYXMgYnNjcmlwdCB9IGZyb20gJ2JpdGNvaW5qcy1saWInO1xuXG5pbXBvcnQgeyBpc1RyaXBsZSB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgaXNTY3JpcHRUeXBlMk9mMyB9IGZyb20gJy4vb3V0cHV0U2NyaXB0cyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1BsYWNlaG9sZGVyU2lnbmF0dXJlKHY6IG51bWJlciB8IEJ1ZmZlcik6IGJvb2xlYW4ge1xuICBpZiAoQnVmZmVyLmlzQnVmZmVyKHYpKSB7XG4gICAgcmV0dXJuIHYubGVuZ3RoID09PSAwO1xuICB9XG4gIHJldHVybiB2ID09PSAwO1xufVxuXG4vKipcbiAqIEByZXR1cm4gdHJ1ZSBpZmYgUDJUUiBzY3JpcHQgcGF0aCdzIGNvbnRyb2wgYmxvY2sgbWF0Y2hlcyBCaXRHbydzIG5lZWRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzVmFsaWRDb250cm9sQm9jayhjb250cm9sQmxvY2s6IEJ1ZmZlcik6IGJvb2xlYW4ge1xuICAvLyBUaGUgbGFzdCBzdGFjayBlbGVtZW50IGlzIGNhbGxlZCB0aGUgY29udHJvbCBibG9jayBjLCBhbmQgbXVzdCBoYXZlIGxlbmd0aCAzMyArIDMybVxuICByZXR1cm4gQnVmZmVyLmlzQnVmZmVyKGNvbnRyb2xCbG9jaykgJiYgMzMgPD0gY29udHJvbEJsb2NrLmxlbmd0aCAmJiBjb250cm9sQmxvY2subGVuZ3RoICUgMzIgPT09IDE7XG59XG5cbi8qKlxuICogQHJldHVybiBzY3JpcHQgcGF0aCBsZXZlbCBmb3IgUDJUUiBjb250cm9sIGJsb2NrXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjYWxjdWxhdGVTY3JpcHRQYXRoTGV2ZWwoY29udHJvbEJsb2NrOiBCdWZmZXIpOiBudW1iZXIge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihjb250cm9sQmxvY2spKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNvbnRyb2wgYmxvY2sgdHlwZS4nKTtcbiAgfVxuICBpZiAoY29udHJvbEJsb2NrLmxlbmd0aCA9PT0gNjUpIHtcbiAgICByZXR1cm4gMTtcbiAgfVxuICBpZiAoY29udHJvbEJsb2NrLmxlbmd0aCA9PT0gOTcpIHtcbiAgICByZXR1cm4gMjtcbiAgfVxuICB0aHJvdyBuZXcgRXJyb3IoJ3VuZXhwZWN0ZWQgY29udHJvbCBibG9jayBsZW5ndGguJyk7XG59XG5cbi8qKlxuICogQHJldHVybiBsZWFmIHZlcnNpb24gZm9yIFAyVFIgY29udHJvbCBibG9jay5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldExlYWZWZXJzaW9uKGNvbnRyb2xCbG9jazogQnVmZmVyKTogbnVtYmVyIHtcbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihjb250cm9sQmxvY2spICYmIGNvbnRyb2xCbG9jay5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIGNvbnRyb2xCbG9ja1swXSAmIDB4ZmU7XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKCd1bmV4cGVjdGVkIGxlYWZWZXJzaW9uLicpO1xufVxuXG5leHBvcnQgdHlwZSBQYXJzZWRTY3JpcHRUeXBlMk9mMyA9XG4gIHwgJ3Ayc2gnXG4gIHwgJ3Ayc2hQMndzaCdcbiAgfCAncDJ3c2gnXG4gIHwgJ3RhcHJvb3RLZXlQYXRoU3BlbmQnIC8vIG9ubHkgaW1wbGVtZW50ZWQgZm9yIHAydHJNdXNpZzJcbiAgfCAndGFwcm9vdFNjcmlwdFBhdGhTcGVuZCc7IC8vIGNhbiBiZSBmb3IgZWl0aGVyIHAydHIgb3IgcDJ0ck11c2lnMiBvdXRwdXQgc2NyaXB0XG5cbmV4cG9ydCB0eXBlIFBhcnNlZFNjcmlwdFR5cGUgPSBQYXJzZWRTY3JpcHRUeXBlMk9mMyB8ICdwMnNoUDJwayc7XG5cbmV4cG9ydCB0eXBlIFBhcnNlZFB1YlNjcmlwdCA9IHtcbiAgc2NyaXB0VHlwZTogUGFyc2VkU2NyaXB0VHlwZTtcbn07XG5cbmV4cG9ydCB0eXBlIFBhcnNlZFNpZ25hdHVyZVNjcmlwdCA9IHtcbiAgc2NyaXB0VHlwZTogUGFyc2VkU2NyaXB0VHlwZTtcbn07XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGFyc2VkU2lnbmF0dXJlU2NyaXB0UDJzaFAycGsgZXh0ZW5kcyBQYXJzZWRTaWduYXR1cmVTY3JpcHQge1xuICBzY3JpcHRUeXBlOiAncDJzaFAycGsnO1xuICBwdWJsaWNLZXlzOiBbQnVmZmVyXTtcbiAgc2lnbmF0dXJlczogW0J1ZmZlcl07XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGFyc2VkUHViU2NyaXB0VGFwcm9vdEtleVBhdGggZXh0ZW5kcyBQYXJzZWRQdWJTY3JpcHQge1xuICBzY3JpcHRUeXBlOiAndGFwcm9vdEtleVBhdGhTcGVuZCc7XG4gIC8vIHgtb25seSB0YXBPdXRwdXRLZXlcbiAgcHVibGljS2V5czogW0J1ZmZlcl07XG4gIHB1YlNjcmlwdDogQnVmZmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFBhcnNlZFB1YlNjcmlwdFRhcHJvb3RTY3JpcHRQYXRoIGV4dGVuZHMgUGFyc2VkUHViU2NyaXB0IHtcbiAgc2NyaXB0VHlwZTogJ3RhcHJvb3RTY3JpcHRQYXRoU3BlbmQnO1xuICBwdWJsaWNLZXlzOiBbQnVmZmVyLCBCdWZmZXJdO1xuICBwdWJTY3JpcHQ6IEJ1ZmZlcjtcbn1cblxuZXhwb3J0IHR5cGUgUGFyc2VkUHViU2NyaXB0VGFwcm9vdCA9IFBhcnNlZFB1YlNjcmlwdFRhcHJvb3RLZXlQYXRoIHwgUGFyc2VkUHViU2NyaXB0VGFwcm9vdFNjcmlwdFBhdGg7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGFyc2VkUHViU2NyaXB0UDJtcyBleHRlbmRzIFBhcnNlZFB1YlNjcmlwdCB7XG4gIHNjcmlwdFR5cGU6ICdwMnNoJyB8ICdwMnNoUDJ3c2gnIHwgJ3Ayd3NoJztcbiAgcHVibGljS2V5czogW0J1ZmZlciwgQnVmZmVyLCBCdWZmZXJdO1xuICBwdWJTY3JpcHQ6IEJ1ZmZlcjtcbiAgcmVkZWVtU2NyaXB0OiBCdWZmZXIgfCB1bmRlZmluZWQ7XG4gIHdpdG5lc3NTY3JpcHQ6IEJ1ZmZlciB8IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBQYXJzZWRQdWJTY3JpcHRQMnNoUDJwayBleHRlbmRzIFBhcnNlZFB1YlNjcmlwdCB7XG4gIHNjcmlwdFR5cGU6ICdwMnNoUDJwayc7XG4gIHB1YmxpY0tleXM6IFtCdWZmZXJdO1xuICBwdWJTY3JpcHQ6IEJ1ZmZlcjtcbiAgcmVkZWVtU2NyaXB0OiBCdWZmZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGFyc2VkU2lnbmF0dXJlU2NyaXB0UDJtcyBleHRlbmRzIFBhcnNlZFNpZ25hdHVyZVNjcmlwdCB7XG4gIHNjcmlwdFR5cGU6ICdwMnNoJyB8ICdwMnNoUDJ3c2gnIHwgJ3Ayd3NoJztcbiAgcHVibGljS2V5czogW0J1ZmZlciwgQnVmZmVyLCBCdWZmZXJdO1xuICBzaWduYXR1cmVzOlxuICAgIHwgW0J1ZmZlciwgQnVmZmVyXSAvLyBmdWxseS1zaWduZWQgdHJhbnNhY3Rpb25zIHdpdGggc2lnbmF0dXJlc1xuICAgIC8qIFBhcnRpYWxseSBzaWduZWQgdHJhbnNhY3Rpb25zIHdpdGggcGxhY2Vob2xkZXIgc2lnbmF0dXJlcy5cbiAgICAgICBGb3IgcDJzaCwgdGhlIHBsYWNlaG9sZGVyIGlzIE9QXzAgKG51bWJlciAwKSAqL1xuICAgIHwgW0J1ZmZlciB8IDAsIEJ1ZmZlciB8IDAsIEJ1ZmZlciB8IDBdO1xuICBwdWJTY3JpcHQ6IEJ1ZmZlcjtcbiAgcmVkZWVtU2NyaXB0OiBCdWZmZXIgfCB1bmRlZmluZWQ7XG4gIHdpdG5lc3NTY3JpcHQ6IEJ1ZmZlciB8IHVuZGVmaW5lZDtcbn1cblxuLyoqXG4gKiBLZXlwYXRoIHNwZW5kcyBvbmx5IGhhdmUgYSBzaW5nbGUgc2lnbmF0dXJlXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUGFyc2VkU2lnbmF0dXJlU2NyaXB0VGFwcm9vdEtleVBhdGggZXh0ZW5kcyBQYXJzZWRTaWduYXR1cmVTY3JpcHQge1xuICBzY3JpcHRUeXBlOiAndGFwcm9vdEtleVBhdGhTcGVuZCc7XG4gIHNpZ25hdHVyZXM6IFtCdWZmZXJdO1xufVxuXG4vKipcbiAqIFRhcHJvb3QgU2NyaXB0cGF0aCBzcGVuZHMgYXJlIG1vcmUgc2ltaWxhciB0byByZWd1bGFyIHAybXMgc3BlbmRzIGFuZCBoYXZlIHR3byBwdWJsaWMga2V5cyBhbmRcbiAqIHR3byBzaWduYXR1cmVzXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUGFyc2VkU2lnbmF0dXJlU2NyaXB0VGFwcm9vdFNjcmlwdFBhdGggZXh0ZW5kcyBQYXJzZWRTaWduYXR1cmVTY3JpcHQge1xuICBzY3JpcHRUeXBlOiAndGFwcm9vdFNjcmlwdFBhdGhTcGVuZCc7XG4gIHB1YmxpY0tleXM6IFtCdWZmZXIsIEJ1ZmZlcl07XG4gIHNpZ25hdHVyZXM6IFtCdWZmZXIsIEJ1ZmZlcl07XG4gIGNvbnRyb2xCbG9jazogQnVmZmVyO1xuICBsZWFmVmVyc2lvbjogbnVtYmVyO1xuICAvKiogSW5kaWNhdGVzIHRoZSBsZXZlbCBpbnNpZGUgdGhlIHRhcHRyZWUuICovXG4gIHNjcmlwdFBhdGhMZXZlbDogbnVtYmVyO1xuICBwdWJTY3JpcHQ6IEJ1ZmZlcjtcbn1cblxuZXhwb3J0IHR5cGUgUGFyc2VkU2lnbmF0dXJlU2NyaXB0VGFwcm9vdCA9IFBhcnNlZFNpZ25hdHVyZVNjcmlwdFRhcHJvb3RLZXlQYXRoIHwgUGFyc2VkU2lnbmF0dXJlU2NyaXB0VGFwcm9vdFNjcmlwdFBhdGg7XG5cbnR5cGUgRGVjb21waWxlZFNjcmlwdCA9IEFycmF5PEJ1ZmZlciB8IG51bWJlcj47XG5cbi8qKlxuICogU3RhdGljIHNjcmlwdCBlbGVtZW50c1xuICovXG50eXBlIFNjcmlwdFBhdHRlcm5Db25zdGFudCA9XG4gIHwgJ09QXzAnXG4gIHwgJ09QXzEnXG4gIHwgJ09QXzInXG4gIHwgJ09QXzMnXG4gIHwgJ09QX0NIRUNLTVVMVElTSUcnXG4gIHwgJ09QX0NIRUNLU0lHJ1xuICB8ICdPUF9DSEVDS1NJR1ZFUklGWSc7XG5cbi8qKlxuICogU2NyaXB0IGVsZW1lbnRzIHRoYXQgY2FuIGJlIGNhcHR1cmVkXG4gKi9cbnR5cGUgU2NyaXB0UGF0dGVybkNhcHR1cmUgPVxuICB8ICc6cHVia2V5J1xuICB8ICc6cHVia2V5LXhvbmx5J1xuICB8ICc6c2lnbmF0dXJlJ1xuICB8ICc6Y29udHJvbC1ibG9jaydcbiAgfCB7ICc6c2NyaXB0JzogU2NyaXB0UGF0dGVybkVsZW1lbnRbXSB9O1xuXG50eXBlIFNjcmlwdFBhdHRlcm5FbGVtZW50ID0gU2NyaXB0UGF0dGVybkNvbnN0YW50IHwgU2NyaXB0UGF0dGVybkNhcHR1cmU7XG5cbi8qKlxuICogUmVzdWx0IGZvciBhIHN1Y2Nlc3NmdWwgc2NyaXB0IG1hdGNoXG4gKi9cbnR5cGUgTWF0Y2hSZXN1bHQgPSB7XG4gICc6cHVia2V5JzogQnVmZmVyW107XG4gICc6cHVia2V5LXhvbmx5JzogQnVmZmVyW107XG4gICc6Y29udHJvbC1ibG9jayc6IEJ1ZmZlcltdO1xuICAnOnNpZ25hdHVyZSc6IChCdWZmZXIgfCAwKVtdO1xuICAnOnNjcmlwdCc6IHsgYnVmZmVyOiBCdWZmZXI7IG1hdGNoOiBNYXRjaFJlc3VsdCB9W107XG59O1xuXG5mdW5jdGlvbiBlbXB0eU1hdGNoUmVzdWx0KCk6IE1hdGNoUmVzdWx0IHtcbiAgcmV0dXJuIHtcbiAgICAnOnB1YmtleSc6IFtdLFxuICAgICc6cHVia2V5LXhvbmx5JzogW10sXG4gICAgJzpjb250cm9sLWJsb2NrJzogW10sXG4gICAgJzpzaWduYXR1cmUnOiBbXSxcbiAgICAnOnNjcmlwdCc6IFtdLFxuICB9O1xufVxuXG5jbGFzcyBNYXRjaEVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICAvLyB0aGlzIHByb3BlcnR5IGlzIHJlcXVpcmVkIHRvIHByb2hpYml0IGByZXR1cm4gbmV3IEVycm9yKClgIHdoZW4gdGhlIHJldHVybiB0eXBlIGRlbWFuZHMgYE1hdGNoRXJyb3JgXG4gIF9fdHlwZSA9ICdNYXRjaEVycm9yJztcbiAgY29uc3RydWN0b3IobWVzc2FnZTogc3RyaW5nKSB7XG4gICAgc3VwZXIobWVzc2FnZSk7XG4gIH1cblxuICBzdGF0aWMgZm9yUGF0dGVybkVsZW1lbnQocDogU2NyaXB0UGF0dGVybkVsZW1lbnQpOiBNYXRjaEVycm9yIHtcbiAgICBpZiAodHlwZW9mIHAgPT09ICdvYmplY3QnICYmICc6c2NyaXB0JyBpbiBwKSB7XG4gICAgICByZXR1cm4gbmV3IE1hdGNoRXJyb3IoYGVycm9yIG1hdGNoaW5nIG5lc3RlZCBzY3JpcHRgKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBNYXRjaEVycm9yKGBlcnJvciBtYXRjaGluZyAke3B9YCk7XG4gIH1cbn1cblxuLyoqXG4gKiBAcGFyYW0gc2NyaXB0XG4gKiBAcGFyYW0gcGF0dGVyblxuICogQHJldHVybiBNYXRjaFJlc3VsdCBpZiBzY3JpcHQgbWF0Y2hlcyBwYXR0ZXJuLiBUaGUgcmVzdWx0IHdpbGwgY29udGFpbiB0aGUgbWF0Y2hlZCB2YWx1ZXMuXG4gKi9cbmZ1bmN0aW9uIG1hdGNoU2NyaXB0KHNjcmlwdDogRGVjb21waWxlZFNjcmlwdCwgcGF0dGVybjogU2NyaXB0UGF0dGVybkVsZW1lbnRbXSk6IE1hdGNoUmVzdWx0IHwgTWF0Y2hFcnJvciB7XG4gIC8qKlxuICAgKiBNYXRjaCBhIHNpbmdsZSBzY3JpcHQgZWxlbWVudCB3aXRoIGEgU2NyaXB0UGF0dGVybkVsZW1lbnRcbiAgICovXG4gIGZ1bmN0aW9uIG1hdGNoRWxlbWVudChlOiBCdWZmZXIgfCBudW1iZXIsIHA6IFNjcmlwdFBhdHRlcm5FbGVtZW50KTogTWF0Y2hSZXN1bHQgfCBib29sZWFuIHtcbiAgICBzd2l0Y2ggKHApIHtcbiAgICAgIGNhc2UgJ09QXzAnOlxuICAgICAgICByZXR1cm4gZSA9PT0gb3Bjb2Rlcy5PUF8wIHx8IChCdWZmZXIuaXNCdWZmZXIoZSkgJiYgZS5sZW5ndGggPT09IDApO1xuICAgICAgY2FzZSAnT1BfMSc6XG4gICAgICBjYXNlICdPUF8yJzpcbiAgICAgIGNhc2UgJ09QXzMnOlxuICAgICAgY2FzZSAnT1BfQ0hFQ0tNVUxUSVNJRyc6XG4gICAgICBjYXNlICdPUF9DSEVDS1NJRyc6XG4gICAgICBjYXNlICdPUF9DSEVDS1NJR1ZFUklGWSc6XG4gICAgICAgIHJldHVybiBlID09PSBvcGNvZGVzW3BdO1xuICAgICAgY2FzZSAnOnB1YmtleSc6XG4gICAgICAgIHJldHVybiBCdWZmZXIuaXNCdWZmZXIoZSkgJiYgKGUubGVuZ3RoID09PSAzMyB8fCBlLmxlbmd0aCA9PT0gNjUpO1xuICAgICAgY2FzZSAnOnB1YmtleS14b25seSc6XG4gICAgICAgIHJldHVybiBCdWZmZXIuaXNCdWZmZXIoZSkgJiYgZS5sZW5ndGggPT09IDMyO1xuICAgICAgY2FzZSAnOnNpZ25hdHVyZSc6XG4gICAgICAgIHJldHVybiBCdWZmZXIuaXNCdWZmZXIoZSkgfHwgaXNQbGFjZWhvbGRlclNpZ25hdHVyZShlKTtcbiAgICAgIGNhc2UgJzpjb250cm9sLWJsb2NrJzpcbiAgICAgICAgcmV0dXJuIEJ1ZmZlci5pc0J1ZmZlcihlKSAmJiBpc1ZhbGlkQ29udHJvbEJvY2soZSk7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHVua25vd24gcGF0dGVybiBlbGVtZW50ICR7cH1gKTtcbiAgICB9XG4gIH1cblxuICBpZiAoc2NyaXB0Lmxlbmd0aCAhPT0gcGF0dGVybi5sZW5ndGgpIHtcbiAgICByZXR1cm4gbmV3IE1hdGNoRXJyb3IoYGxlbmd0aCBtaXNtYXRjaGApO1xuICB9XG5cbiAgLy8gR28gb3ZlciBlYWNoIHBhdHRlcm4gZWxlbWVudC5cbiAgLy8gQ29sbGVjdCBjYXB0dXJlcyBpbnRvIGEgcmVzdWx0IG9iamVjdC5cbiAgcmV0dXJuIHBhdHRlcm4ucmVkdWNlKChvYmo6IE1hdGNoUmVzdWx0IHwgTWF0Y2hFcnJvciwgcCwgaSk6IE1hdGNoUmVzdWx0IHwgTWF0Y2hFcnJvciA9PiB7XG4gICAgLy8gaWYgd2UgaGFkIGEgcHJldmlvdXMgbWlzbWF0Y2gsIHNob3J0LWNpcmN1aXRcbiAgICBpZiAob2JqIGluc3RhbmNlb2YgTWF0Y2hFcnJvcikge1xuICAgICAgcmV0dXJuIG9iajtcbiAgICB9XG5cbiAgICBjb25zdCBlID0gc2NyaXB0W2ldO1xuXG4gICAgLy8gZm9yICc6c2NyaXB0JyBwYXR0ZXJuIGVsZW1lbnRzLCBkZWNvbXBpbGUgc2NyaXB0IGVsZW1lbnQgYW5kIHJlY3Vyc2VcbiAgICBpZiAodHlwZW9mIHAgPT09ICdvYmplY3QnICYmICc6c2NyaXB0JyBpbiBwKSB7XG4gICAgICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihlKSkge1xuICAgICAgICByZXR1cm4gbmV3IE1hdGNoRXJyb3IoYGV4cGVjdGVkIGJ1ZmZlciBmb3IgOnNjcmlwdGApO1xuICAgICAgfVxuICAgICAgY29uc3QgZGVjID0gYnNjcmlwdC5kZWNvbXBpbGUoZSk7XG4gICAgICBpZiAoIWRlYykge1xuICAgICAgICByZXR1cm4gbmV3IE1hdGNoRXJyb3IoYGVycm9yIGRlY29tcGlsaW5nIG5lc3RlZCBzY3JpcHRgKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IG1hdGNoID0gbWF0Y2hTY3JpcHQoZGVjLCBwWyc6c2NyaXB0J10pO1xuICAgICAgaWYgKG1hdGNoIGluc3RhbmNlb2YgTWF0Y2hFcnJvcikge1xuICAgICAgICByZXR1cm4gbWF0Y2g7XG4gICAgICB9XG4gICAgICBvYmpbJzpzY3JpcHQnXS5wdXNoKHtcbiAgICAgICAgYnVmZmVyOiBlLFxuICAgICAgICBtYXRjaCxcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIG9iajtcbiAgICB9XG5cbiAgICBjb25zdCBtYXRjaCA9IG1hdGNoRWxlbWVudChlLCBwKTtcbiAgICBpZiAoIW1hdGNoKSB7XG4gICAgICByZXR1cm4gTWF0Y2hFcnJvci5mb3JQYXR0ZXJuRWxlbWVudChwKTtcbiAgICB9XG5cbiAgICAvLyBpZiBwYXR0ZXJuIGVsZW1lbnQgaXMgYSBjYXB0dXJlLCBhZGQgaXQgdG8gdGhlIHJlc3VsdCBvYmpcbiAgICBpZiAocCA9PT0gJzpzaWduYXR1cmUnICYmIGUgPT09IDApIHtcbiAgICAgIG9ialtwXS5wdXNoKGUpO1xuICAgIH0gZWxzZSBpZiAocCBpbiBvYmopIHtcbiAgICAgIGlmICghQnVmZmVyLmlzQnVmZmVyKGUpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgaW52YWxpZCBjYXB0dXJlIHZhbHVlYCk7XG4gICAgICB9XG4gICAgICBvYmpbcF0ucHVzaChlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gb2JqO1xuICB9LCBlbXB0eU1hdGNoUmVzdWx0KCkpO1xufVxuXG4vKipcbiAqIEBwYXJhbSBzY3JpcHRcbiAqIEBwYXJhbSBwYXR0ZXJuc1xuICogQHJldHVybiBmaXJzdCBtYXRjaFxuICovXG5mdW5jdGlvbiBtYXRjaFNjcmlwdFNvbWUoc2NyaXB0OiBEZWNvbXBpbGVkU2NyaXB0LCBwYXR0ZXJuczogU2NyaXB0UGF0dGVybkVsZW1lbnRbXVtdKTogTWF0Y2hSZXN1bHQgfCBNYXRjaEVycm9yIHtcbiAgZm9yIChjb25zdCBwIG9mIHBhdHRlcm5zKSB7XG4gICAgY29uc3QgbSA9IG1hdGNoU2NyaXB0KHNjcmlwdCwgcCk7XG4gICAgaWYgKG0gaW5zdGFuY2VvZiBNYXRjaEVycm9yKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgcmV0dXJuIG07XG4gIH1cbiAgcmV0dXJuIG5ldyBNYXRjaEVycm9yKGBubyBtYXRjaCBmb3Igc2NyaXB0YCk7XG59XG5cbnR5cGUgSW5wdXRTY3JpcHRzPFRTY3JpcHQsIFRXaXRuZXNzPiA9IHtcbiAgc2NyaXB0OiBUU2NyaXB0O1xuICB3aXRuZXNzOiBUV2l0bmVzcztcbn07XG5cbnR5cGUgSW5wdXRTY3JpcHRzTGVnYWN5ID0gSW5wdXRTY3JpcHRzPERlY29tcGlsZWRTY3JpcHQsIG51bGw+O1xudHlwZSBJbnB1dFNjcmlwdHNXcmFwcGVkU2Vnd2l0ID0gSW5wdXRTY3JpcHRzPERlY29tcGlsZWRTY3JpcHQsIEJ1ZmZlcltdPjtcbnR5cGUgSW5wdXRTY3JpcHRzTmF0aXZlU2Vnd2l0ID0gSW5wdXRTY3JpcHRzPG51bGwsIEJ1ZmZlcltdPjtcblxudHlwZSBJbnB1dFNjcmlwdHNVbmtub3duID0gSW5wdXRTY3JpcHRzPERlY29tcGlsZWRTY3JpcHQgfCBudWxsLCBCdWZmZXJbXSB8IG51bGw+O1xuXG50eXBlIElucHV0UGFyc2VyPFQgZXh0ZW5kcyBQYXJzZWRTaWduYXR1cmVTY3JpcHRQMnNoUDJwayB8IFBhcnNlZFNpZ25hdHVyZVNjcmlwdFAybXMgfCBQYXJzZWRTaWduYXR1cmVTY3JpcHRUYXByb290PiA9IChcbiAgcDogSW5wdXRTY3JpcHRzVW5rbm93blxuKSA9PiBUIHwgTWF0Y2hFcnJvcjtcblxuZXhwb3J0IHR5cGUgSW5wdXRQdWJTY3JpcHQgPSBCdWZmZXI7XG5cbnR5cGUgUHViU2NyaXB0UGFyc2VyPFQgZXh0ZW5kcyBQYXJzZWRQdWJTY3JpcHRUYXByb290IHwgUGFyc2VkUHViU2NyaXB0UDJtcyB8IFBhcnNlZFB1YlNjcmlwdFAyc2hQMnBrPiA9IChcbiAgcDogSW5wdXRQdWJTY3JpcHQsXG4gIHQ6IFBhcnNlZFNjcmlwdFR5cGVcbikgPT4gVCB8IE1hdGNoRXJyb3I7XG5cbmZ1bmN0aW9uIGlzTGVnYWN5KHA6IElucHV0U2NyaXB0c1Vua25vd24pOiBwIGlzIElucHV0U2NyaXB0c0xlZ2FjeSB7XG4gIHJldHVybiBCb29sZWFuKHAuc2NyaXB0ICYmICFwLndpdG5lc3MpO1xufVxuXG5mdW5jdGlvbiBpc1dyYXBwZWRTZWd3aXQocDogSW5wdXRTY3JpcHRzVW5rbm93bik6IHAgaXMgSW5wdXRTY3JpcHRzV3JhcHBlZFNlZ3dpdCB7XG4gIHJldHVybiBCb29sZWFuKHAuc2NyaXB0ICYmIHAud2l0bmVzcyk7XG59XG5cbmZ1bmN0aW9uIGlzTmF0aXZlU2Vnd2l0KHA6IElucHV0U2NyaXB0c1Vua25vd24pOiBwIGlzIElucHV0U2NyaXB0c05hdGl2ZVNlZ3dpdCB7XG4gIHJldHVybiBCb29sZWFuKCFwLnNjcmlwdCAmJiBwLndpdG5lc3MpO1xufVxuXG5jb25zdCBwYXJzZVAyc2hQMnBrOiBJbnB1dFBhcnNlcjxQYXJzZWRTaWduYXR1cmVTY3JpcHRQMnNoUDJwaz4gPSAocCkgPT4ge1xuICBpZiAoIWlzTGVnYWN5KHApKSB7XG4gICAgcmV0dXJuIG5ldyBNYXRjaEVycm9yKGBleHBlY3RlZCBsZWdhY3kgaW5wdXRgKTtcbiAgfVxuICBjb25zdCBtYXRjaCA9IG1hdGNoU2NyaXB0KHAuc2NyaXB0LCBbJzpzaWduYXR1cmUnLCB7ICc6c2NyaXB0JzogWyc6cHVia2V5JywgJ09QX0NIRUNLU0lHJ10gfV0pO1xuICBpZiAobWF0Y2ggaW5zdGFuY2VvZiBNYXRjaEVycm9yKSB7XG4gICAgcmV0dXJuIG1hdGNoO1xuICB9XG4gIHJldHVybiB7XG4gICAgc2NyaXB0VHlwZTogJ3Ayc2hQMnBrJyxcbiAgICBwdWJsaWNLZXlzOiBtYXRjaFsnOnNjcmlwdCddWzBdLm1hdGNoWyc6cHVia2V5J10gYXMgW0J1ZmZlcl0sXG4gICAgc2lnbmF0dXJlczogbWF0Y2hbJzpzaWduYXR1cmUnXSBhcyBbQnVmZmVyXSxcbiAgfTtcbn07XG5cbmZ1bmN0aW9uIHBhcnNlUDJtcyhcbiAgZGVjU2NyaXB0OiBEZWNvbXBpbGVkU2NyaXB0LFxuICBzY3JpcHRUeXBlOiAncDJzaCcgfCAncDJzaFAyd3NoJyB8ICdwMndzaCdcbik6IFBhcnNlZFNpZ25hdHVyZVNjcmlwdFAybXMgfCBNYXRjaEVycm9yIHtcbiAgY29uc3QgcGF0dGVybjJPZjM6IFNjcmlwdFBhdHRlcm5FbGVtZW50W10gPSBbJ09QXzInLCAnOnB1YmtleScsICc6cHVia2V5JywgJzpwdWJrZXknLCAnT1BfMycsICdPUF9DSEVDS01VTFRJU0lHJ107XG5cbiAgY29uc3QgbWF0Y2ggPSBtYXRjaFNjcmlwdFNvbWUoZGVjU2NyaXB0LCBbXG4gICAgLyogZnVsbC1zaWduZWQsIG5vIHBsYWNlaG9sZGVyIHNpZ25hdHVyZSAqL1xuICAgIFsnT1BfMCcsICc6c2lnbmF0dXJlJywgJzpzaWduYXR1cmUnLCB7ICc6c2NyaXB0JzogcGF0dGVybjJPZjMgfV0sXG4gICAgLyogaGFsZi1zaWduZWQsIHBsYWNlaG9sZGVyIHNpZ25hdHVyZXMgKi9cbiAgICBbJ09QXzAnLCAnOnNpZ25hdHVyZScsICc6c2lnbmF0dXJlJywgJzpzaWduYXR1cmUnLCB7ICc6c2NyaXB0JzogcGF0dGVybjJPZjMgfV0sXG4gIF0pO1xuICBpZiAobWF0Y2ggaW5zdGFuY2VvZiBNYXRjaEVycm9yKSB7XG4gICAgcmV0dXJuIG1hdGNoO1xuICB9XG5cbiAgY29uc3QgW3JlZGVlbVNjcmlwdF0gPSBtYXRjaFsnOnNjcmlwdCddO1xuXG4gIGlmICghaXNUcmlwbGUocmVkZWVtU2NyaXB0Lm1hdGNoWyc6cHVia2V5J10pKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBpbnZhbGlkIHB1YmtleSBjb3VudGApO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBzY3JpcHRUeXBlLFxuICAgIHB1YmxpY0tleXM6IHJlZGVlbVNjcmlwdC5tYXRjaFsnOnB1YmtleSddLFxuICAgIHB1YlNjcmlwdDogcmVkZWVtU2NyaXB0LmJ1ZmZlcixcbiAgICBzaWduYXR1cmVzOiBtYXRjaFsnOnNpZ25hdHVyZSddIGFzIFBhcnNlZFNpZ25hdHVyZVNjcmlwdFAybXNbJ3NpZ25hdHVyZXMnXSxcbiAgICByZWRlZW1TY3JpcHQ6IHNjcmlwdFR5cGUgPT09ICdwMnNoJyA/IHJlZGVlbVNjcmlwdC5idWZmZXIgOiB1bmRlZmluZWQsXG4gICAgd2l0bmVzc1NjcmlwdDogc2NyaXB0VHlwZSA9PT0gJ3Ayc2hQMndzaCcgfHwgc2NyaXB0VHlwZSA9PT0gJ3Ayd3NoJyA/IHJlZGVlbVNjcmlwdC5idWZmZXIgOiB1bmRlZmluZWQsXG4gIH07XG59XG5cbmNvbnN0IHBhcnNlUDJzaDJPZjM6IElucHV0UGFyc2VyPFBhcnNlZFNpZ25hdHVyZVNjcmlwdFAybXM+ID0gKHApID0+IHtcbiAgaWYgKCFpc0xlZ2FjeShwKSkge1xuICAgIHJldHVybiBuZXcgTWF0Y2hFcnJvcihgZXhwZWN0ZWQgbGVnYWN5IGlucHV0YCk7XG4gIH1cbiAgcmV0dXJuIHBhcnNlUDJtcyhwLnNjcmlwdCwgJ3Ayc2gnKTtcbn07XG5cbmNvbnN0IHBhcnNlUDJzaFAyd3NoMk9mMzogSW5wdXRQYXJzZXI8UGFyc2VkU2lnbmF0dXJlU2NyaXB0UDJtcz4gPSAocCkgPT4ge1xuICBpZiAoIWlzV3JhcHBlZFNlZ3dpdChwKSkge1xuICAgIHJldHVybiBuZXcgTWF0Y2hFcnJvcihgZXhwZWN0ZWQgd3JhcHBlZCBzZWd3aXQgaW5wdXRgKTtcbiAgfVxuICByZXR1cm4geyAuLi5wYXJzZVAybXMocC53aXRuZXNzLCAncDJzaFAyd3NoJyksIHJlZGVlbVNjcmlwdDogcC5zY3JpcHRbMF0gYXMgQnVmZmVyIH07XG59O1xuXG5jb25zdCBwYXJzZVAyd3NoMk9mMzogSW5wdXRQYXJzZXI8UGFyc2VkU2lnbmF0dXJlU2NyaXB0UDJtcz4gPSAocCkgPT4ge1xuICBpZiAoIWlzTmF0aXZlU2Vnd2l0KHApKSB7XG4gICAgcmV0dXJuIG5ldyBNYXRjaEVycm9yKGBleHBlY3RlZCBuYXRpdmUgc2Vnd2l0YCk7XG4gIH1cbiAgcmV0dXJuIHBhcnNlUDJtcyhwLndpdG5lc3MsICdwMndzaCcpO1xufTtcblxuY29uc3QgcGFyc2VUYXByb290S2V5UGF0aDJPZjM6IElucHV0UGFyc2VyPFBhcnNlZFNpZ25hdHVyZVNjcmlwdFRhcHJvb3RLZXlQYXRoPiA9IChwKSA9PiB7XG4gIGlmICghaXNOYXRpdmVTZWd3aXQocCkpIHtcbiAgICByZXR1cm4gbmV3IE1hdGNoRXJyb3IoYGV4cGVjdGVkIG5hdGl2ZSBzZWd3aXRgKTtcbiAgfVxuICBjb25zdCBtYXRjaCA9IG1hdGNoU2NyaXB0KHAud2l0bmVzcywgWyc6c2lnbmF0dXJlJ10pO1xuICBpZiAobWF0Y2ggaW5zdGFuY2VvZiBNYXRjaEVycm9yKSB7XG4gICAgcmV0dXJuIG1hdGNoO1xuICB9XG4gIGNvbnN0IHNpZ25hdHVyZXMgPSBtYXRjaFsnOnNpZ25hdHVyZSddIGFzIFtCdWZmZXJdO1xuICBpZiAoaXNQbGFjZWhvbGRlclNpZ25hdHVyZShzaWduYXR1cmVzWzBdKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgaW52YWxpZCB0YXByb290IGtleSBwYXRoIHNpZ25hdHVyZWApO1xuICB9XG4gIHJldHVybiB7XG4gICAgc2NyaXB0VHlwZTogJ3RhcHJvb3RLZXlQYXRoU3BlbmQnLFxuICAgIHNpZ25hdHVyZXMsXG4gIH07XG59O1xuXG5jb25zdCBwYXJzZVRhcHJvb3RTY3JpcHRQYXRoMk9mMzogSW5wdXRQYXJzZXI8UGFyc2VkU2lnbmF0dXJlU2NyaXB0VGFwcm9vdD4gPSAocCkgPT4ge1xuICBpZiAoIWlzTmF0aXZlU2Vnd2l0KHApKSB7XG4gICAgcmV0dXJuIG5ldyBNYXRjaEVycm9yKGBleHBlY3RlZCBuYXRpdmUgc2Vnd2l0YCk7XG4gIH1cbiAgLy8gYXNzdW1lcyBubyBhbm5leFxuICBjb25zdCBtYXRjaCA9IG1hdGNoU2NyaXB0KHAud2l0bmVzcywgW1xuICAgICc6c2lnbmF0dXJlJyxcbiAgICAnOnNpZ25hdHVyZScsXG4gICAgeyAnOnNjcmlwdCc6IFsnOnB1YmtleS14b25seScsICdPUF9DSEVDS1NJR1ZFUklGWScsICc6cHVia2V5LXhvbmx5JywgJ09QX0NIRUNLU0lHJ10gfSxcbiAgICAnOmNvbnRyb2wtYmxvY2snLFxuICBdKTtcbiAgaWYgKG1hdGNoIGluc3RhbmNlb2YgTWF0Y2hFcnJvcikge1xuICAgIHJldHVybiBtYXRjaDtcbiAgfVxuICBjb25zdCBbY29udHJvbEJsb2NrXSA9IG1hdGNoWyc6Y29udHJvbC1ibG9jayddO1xuICBjb25zdCBzY3JpcHRQYXRoTGV2ZWwgPSBjYWxjdWxhdGVTY3JpcHRQYXRoTGV2ZWwoY29udHJvbEJsb2NrKTtcblxuICBjb25zdCBsZWFmVmVyc2lvbiA9IGdldExlYWZWZXJzaW9uKGNvbnRyb2xCbG9jayk7XG5cbiAgcmV0dXJuIHtcbiAgICBzY3JpcHRUeXBlOiAndGFwcm9vdFNjcmlwdFBhdGhTcGVuZCcsXG4gICAgcHViU2NyaXB0OiBtYXRjaFsnOnNjcmlwdCddWzBdLmJ1ZmZlcixcbiAgICBwdWJsaWNLZXlzOiBtYXRjaFsnOnNjcmlwdCddWzBdLm1hdGNoWyc6cHVia2V5LXhvbmx5J10gYXMgW0J1ZmZlciwgQnVmZmVyXSxcbiAgICBzaWduYXR1cmVzOiBtYXRjaFsnOnNpZ25hdHVyZSddIGFzIFtCdWZmZXIsIEJ1ZmZlcl0sXG4gICAgY29udHJvbEJsb2NrLFxuICAgIHNjcmlwdFBhdGhMZXZlbCxcbiAgICBsZWFmVmVyc2lvbixcbiAgfTtcbn07XG5cbi8qKlxuICogUGFyc2UgYSB0cmFuc2FjdGlvbidzIHNpZ25hdHVyZSBzY3JpcHQgdG8gb2J0YWluIHB1YmxpYyBrZXlzLCBzaWduYXR1cmVzLCB0aGUgc2lnIHNjcmlwdCxcbiAqIGFuZCBvdGhlciBwcm9wZXJ0aWVzLlxuICpcbiAqIE9ubHkgc3VwcG9ydHMgc2NyaXB0IHR5cGVzIHVzZWQgaW4gQml0R28gdHJhbnNhY3Rpb25zLlxuICpcbiAqIEBwYXJhbSBpbnB1dFxuICogQHJldHVybnMgUGFyc2VkU2lnbmF0dXJlU2NyaXB0XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVNpZ25hdHVyZVNjcmlwdChcbiAgaW5wdXQ6IFR4SW5wdXRcbik6IFBhcnNlZFNpZ25hdHVyZVNjcmlwdFAyc2hQMnBrIHwgUGFyc2VkU2lnbmF0dXJlU2NyaXB0UDJtcyB8IFBhcnNlZFNpZ25hdHVyZVNjcmlwdFRhcHJvb3Qge1xuICBjb25zdCBkZWNTY3JpcHQgPSBic2NyaXB0LmRlY29tcGlsZShpbnB1dC5zY3JpcHQpO1xuICBjb25zdCBwYXJzZXJzID0gW1xuICAgIHBhcnNlUDJzaDJPZjMsXG4gICAgcGFyc2VQMnNoUDJ3c2gyT2YzLFxuICAgIHBhcnNlUDJ3c2gyT2YzLFxuICAgIHBhcnNlVGFwcm9vdEtleVBhdGgyT2YzLFxuICAgIHBhcnNlVGFwcm9vdFNjcmlwdFBhdGgyT2YzLFxuICAgIHBhcnNlUDJzaFAycGssXG4gIF0gYXMgY29uc3Q7XG4gIGZvciAoY29uc3QgZiBvZiBwYXJzZXJzKSB7XG4gICAgY29uc3QgcGFyc2VkID0gZih7XG4gICAgICBzY3JpcHQ6IGRlY1NjcmlwdD8ubGVuZ3RoID09PSAwID8gbnVsbCA6IGRlY1NjcmlwdCxcbiAgICAgIHdpdG5lc3M6IGlucHV0LndpdG5lc3MubGVuZ3RoID09PSAwID8gbnVsbCA6IGlucHV0LndpdG5lc3MsXG4gICAgfSk7XG4gICAgaWYgKHBhcnNlZCBpbnN0YW5jZW9mIE1hdGNoRXJyb3IpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICByZXR1cm4gcGFyc2VkO1xuICB9XG4gIHRocm93IG5ldyBFcnJvcihgY291bGQgbm90IHBhcnNlIGlucHV0YCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVNpZ25hdHVyZVNjcmlwdDJPZjMoaW5wdXQ6IFR4SW5wdXQpOiBQYXJzZWRTaWduYXR1cmVTY3JpcHRQMm1zIHwgUGFyc2VkU2lnbmF0dXJlU2NyaXB0VGFwcm9vdCB7XG4gIGNvbnN0IHJlc3VsdCA9IHBhcnNlU2lnbmF0dXJlU2NyaXB0KGlucHV0KTtcblxuICBpZiAoXG4gICAgIWlzU2NyaXB0VHlwZTJPZjMocmVzdWx0LnNjcmlwdFR5cGUpICYmXG4gICAgcmVzdWx0LnNjcmlwdFR5cGUgIT09ICd0YXByb290S2V5UGF0aFNwZW5kJyAmJlxuICAgIHJlc3VsdC5zY3JpcHRUeXBlICE9PSAndGFwcm9vdFNjcmlwdFBhdGhTcGVuZCdcbiAgKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBpbnZhbGlkIHNjcmlwdCB0eXBlYCk7XG4gIH1cblxuICBpZiAoIXJlc3VsdC5zaWduYXR1cmVzKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBtaXNzaW5nIHNpZ25hdHVyZXNgKTtcbiAgfVxuICBpZiAoXG4gICAgcmVzdWx0LnNjcmlwdFR5cGUgIT09ICd0YXByb290S2V5UGF0aFNwZW5kJyAmJlxuICAgIHJlc3VsdC5wdWJsaWNLZXlzLmxlbmd0aCAhPT0gMyAmJlxuICAgIChyZXN1bHQucHVibGljS2V5cy5sZW5ndGggIT09IDIgfHwgcmVzdWx0LnNjcmlwdFR5cGUgIT09ICd0YXByb290U2NyaXB0UGF0aFNwZW5kJylcbiAgKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmV4cGVjdGVkIHB1YmtleSBjb3VudGApO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdCBhcyBQYXJzZWRTaWduYXR1cmVTY3JpcHRQMm1zIHwgUGFyc2VkU2lnbmF0dXJlU2NyaXB0VGFwcm9vdDtcbn1cblxuY29uc3QgcGFyc2VQMnNoUDJwa1B1YlNjcmlwdDogUHViU2NyaXB0UGFyc2VyPFBhcnNlZFB1YlNjcmlwdFAyc2hQMnBrPiA9IChwdWJTY3JpcHQsIHNjcmlwdFR5cGUpID0+IHtcbiAgaWYgKHNjcmlwdFR5cGUgIT09ICdwMnNoUDJwaycpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2ludmFsaWQgc2NyaXB0IHR5cGUnKTtcbiAgfVxuICBjb25zdCBtYXRjaCA9IG1hdGNoU2NyaXB0KFtwdWJTY3JpcHRdLCBbeyAnOnNjcmlwdCc6IFsnOnB1YmtleScsICdPUF9DSEVDS1NJRyddIH1dKTtcbiAgaWYgKG1hdGNoIGluc3RhbmNlb2YgTWF0Y2hFcnJvcikge1xuICAgIHJldHVybiBtYXRjaDtcbiAgfVxuICBjb25zdCBbc2NyaXB0XSA9IG1hdGNoWyc6c2NyaXB0J107XG4gIHJldHVybiB7XG4gICAgc2NyaXB0VHlwZSxcbiAgICBwdWJsaWNLZXlzOiBzY3JpcHQubWF0Y2hbJzpwdWJrZXknXSBhcyBbQnVmZmVyXSxcbiAgICBwdWJTY3JpcHQ6IHB1YlNjcmlwdCxcbiAgICByZWRlZW1TY3JpcHQ6IHB1YlNjcmlwdCxcbiAgfTtcbn07XG5cbmNvbnN0IHBhcnNlUDJtc1B1YlNjcmlwdDogUHViU2NyaXB0UGFyc2VyPFBhcnNlZFB1YlNjcmlwdFAybXM+ID0gKHB1YlNjcmlwdCwgc2NyaXB0VHlwZSkgPT4ge1xuICBpZiAoc2NyaXB0VHlwZSA9PT0gJ3RhcHJvb3RTY3JpcHRQYXRoU3BlbmQnIHx8IHNjcmlwdFR5cGUgPT09ICd0YXByb290S2V5UGF0aFNwZW5kJyB8fCBzY3JpcHRUeXBlID09PSAncDJzaFAycGsnKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdpbnZhbGlkIHNjcmlwdCB0eXBlJyk7XG4gIH1cbiAgY29uc3QgbWF0Y2ggPSBtYXRjaFNjcmlwdChcbiAgICBbcHViU2NyaXB0XSxcbiAgICBbeyAnOnNjcmlwdCc6IFsnT1BfMicsICc6cHVia2V5JywgJzpwdWJrZXknLCAnOnB1YmtleScsICdPUF8zJywgJ09QX0NIRUNLTVVMVElTSUcnXSB9XVxuICApO1xuICBpZiAobWF0Y2ggaW5zdGFuY2VvZiBNYXRjaEVycm9yKSB7XG4gICAgcmV0dXJuIG1hdGNoO1xuICB9XG5cbiAgY29uc3QgW3JlZGVlbVNjcmlwdF0gPSBtYXRjaFsnOnNjcmlwdCddO1xuXG4gIGlmICghaXNUcmlwbGUocmVkZWVtU2NyaXB0Lm1hdGNoWyc6cHVia2V5J10pKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdpbnZhbGlkIHB1YmtleSBjb3VudCcpO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBzY3JpcHRUeXBlLFxuICAgIHB1YmxpY0tleXM6IHJlZGVlbVNjcmlwdC5tYXRjaFsnOnB1YmtleSddLFxuICAgIHB1YlNjcmlwdDogcmVkZWVtU2NyaXB0LmJ1ZmZlcixcbiAgICByZWRlZW1TY3JpcHQ6IHNjcmlwdFR5cGUgPT09ICdwMnNoJyA/IHJlZGVlbVNjcmlwdC5idWZmZXIgOiB1bmRlZmluZWQsXG4gICAgd2l0bmVzc1NjcmlwdDogc2NyaXB0VHlwZSA9PT0gJ3Ayc2hQMndzaCcgfHwgc2NyaXB0VHlwZSA9PT0gJ3Ayd3NoJyA/IHJlZGVlbVNjcmlwdC5idWZmZXIgOiB1bmRlZmluZWQsXG4gIH07XG59O1xuXG5jb25zdCBwYXJzZVRhcHJvb3RLZXlQYXRoUHViU2NyaXB0OiBQdWJTY3JpcHRQYXJzZXI8UGFyc2VkUHViU2NyaXB0VGFwcm9vdEtleVBhdGg+ID0gKHB1YlNjcmlwdCwgc2NyaXB0VHlwZSkgPT4ge1xuICBpZiAoXG4gICAgc2NyaXB0VHlwZSA9PT0gJ3Ayc2gnIHx8XG4gICAgc2NyaXB0VHlwZSA9PT0gJ3Ayd3NoJyB8fFxuICAgIHNjcmlwdFR5cGUgPT09ICdwMnNoUDJ3c2gnIHx8XG4gICAgc2NyaXB0VHlwZSA9PT0gJ3RhcHJvb3RTY3JpcHRQYXRoU3BlbmQnIHx8XG4gICAgc2NyaXB0VHlwZSA9PT0gJ3Ayc2hQMnBrJ1xuICApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2ludmFsaWQgc2NyaXB0IHR5cGUnKTtcbiAgfVxuICBjb25zdCBtYXRjaCA9IG1hdGNoU2NyaXB0KFtwdWJTY3JpcHRdLCBbeyAnOnNjcmlwdCc6IFsnT1BfMScsICc6cHVia2V5LXhvbmx5J10gfV0pO1xuICBpZiAobWF0Y2ggaW5zdGFuY2VvZiBNYXRjaEVycm9yKSB7XG4gICAgcmV0dXJuIG1hdGNoO1xuICB9XG5cbiAgY29uc3QgW3NjcmlwdF0gPSBtYXRjaFsnOnNjcmlwdCddO1xuXG4gIHJldHVybiB7XG4gICAgc2NyaXB0VHlwZTogJ3RhcHJvb3RLZXlQYXRoU3BlbmQnLFxuICAgIHB1YmxpY0tleXM6IHNjcmlwdC5tYXRjaFsnOnB1YmtleS14b25seSddIGFzIFtCdWZmZXJdLFxuICAgIHB1YlNjcmlwdDogcHViU2NyaXB0LFxuICB9O1xufTtcblxuY29uc3QgcGFyc2VUYXByb290U2NyaXB0UGF0aFB1YlNjcmlwdDogUHViU2NyaXB0UGFyc2VyPFBhcnNlZFB1YlNjcmlwdFRhcHJvb3RTY3JpcHRQYXRoPiA9IChwdWJTY3JpcHQsIHNjcmlwdFR5cGUpID0+IHtcbiAgaWYgKFxuICAgIHNjcmlwdFR5cGUgPT09ICdwMnNoJyB8fFxuICAgIHNjcmlwdFR5cGUgPT09ICdwMndzaCcgfHxcbiAgICBzY3JpcHRUeXBlID09PSAncDJzaFAyd3NoJyB8fFxuICAgIHNjcmlwdFR5cGUgPT09ICd0YXByb290S2V5UGF0aFNwZW5kJyB8fFxuICAgIHNjcmlwdFR5cGUgPT09ICdwMnNoUDJwaydcbiAgKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdpbnZhbGlkIHNjcmlwdCB0eXBlJyk7XG4gIH1cbiAgY29uc3QgbWF0Y2ggPSBtYXRjaFNjcmlwdChcbiAgICBbcHViU2NyaXB0XSxcbiAgICBbeyAnOnNjcmlwdCc6IFsnOnB1YmtleS14b25seScsICdPUF9DSEVDS1NJR1ZFUklGWScsICc6cHVia2V5LXhvbmx5JywgJ09QX0NIRUNLU0lHJ10gfV1cbiAgKTtcbiAgaWYgKG1hdGNoIGluc3RhbmNlb2YgTWF0Y2hFcnJvcikge1xuICAgIHJldHVybiBtYXRjaDtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgc2NyaXB0VHlwZSxcbiAgICBwdWJTY3JpcHQ6IG1hdGNoWyc6c2NyaXB0J11bMF0uYnVmZmVyLFxuICAgIHB1YmxpY0tleXM6IG1hdGNoWyc6c2NyaXB0J11bMF0ubWF0Y2hbJzpwdWJrZXkteG9ubHknXSBhcyBbQnVmZmVyLCBCdWZmZXJdLFxuICB9O1xufTtcblxuLyoqXG4gKiBAcmV0dXJuIHB1YlNjcmlwdCAoc2NyaXB0UHViS2V5L3JlZGVlbVNjcmlwdC93aXRuZXNzU2NyaXB0KSBpcyBwYXJzZWQuXG4gKiBQMlNIID0+IHNjcmlwdFR5cGUsIHB1YlNjcmlwdCAocmVkZWVtU2NyaXB0KSwgcmVkZWVtU2NyaXB0LCBwdWJsaWMga2V5c1xuICogUFcyU0ggPT4gc2NyaXB0VHlwZSwgcHViU2NyaXB0ICh3aXRuZXNzU2NyaXB0KSwgd2l0bmVzc1NjcmlwdCwgcHVibGljIGtleXMuXG4gKiBQMlNILVBXMlNIID0+IHNjcmlwdFR5cGUsIHB1YlNjcmlwdCAod2l0bmVzc1NjcmlwdCksIHdpdG5lc3NTY3JpcHQsIHB1YmxpYyBrZXlzLlxuICogdGFwcm9vdFNjcmlwdFBhdGhTcGVuZCAoUDJUUiBhbmQgUDJUUk1VSVNHMiBzY3JpcHQgcGF0aCkgPT4gc2NyaXB0VHlwZSwgcHViU2NyaXB0LCBwdWIga2V5cy5cbiAqIHRhcHJvb3RLZXlQYXRoU3BlbmQgKFAyVFJNVUlTRzIga2V5IHBhdGgpID0+IHNjcmlwdFR5cGUsIHB1YlNjcmlwdCAoMzQtYnl0ZSBvdXRwdXQgc2NyaXB0KSwgcHViIGtleSAodGFwT3V0cHV0S2V5KS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlUHViU2NyaXB0Mk9mMyhcbiAgaW5wdXRQdWJTY3JpcHQ6IElucHV0UHViU2NyaXB0LFxuICBzY3JpcHRUeXBlOiAndGFwcm9vdEtleVBhdGhTcGVuZCdcbik6IFBhcnNlZFB1YlNjcmlwdFRhcHJvb3RLZXlQYXRoO1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlUHViU2NyaXB0Mk9mMyhcbiAgaW5wdXRQdWJTY3JpcHQ6IElucHV0UHViU2NyaXB0LFxuICBzY3JpcHRUeXBlOiAndGFwcm9vdFNjcmlwdFBhdGhTcGVuZCdcbik6IFBhcnNlZFB1YlNjcmlwdFRhcHJvb3RTY3JpcHRQYXRoO1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlUHViU2NyaXB0Mk9mMyhcbiAgaW5wdXRQdWJTY3JpcHQ6IElucHV0UHViU2NyaXB0LFxuICBzY3JpcHRUeXBlOiAncDJzaCcgfCAncDJzaFAyd3NoJyB8ICdwMndzaCdcbik6IFBhcnNlZFB1YlNjcmlwdFAybXM7XG5leHBvcnQgZnVuY3Rpb24gcGFyc2VQdWJTY3JpcHQyT2YzKFxuICBpbnB1dFB1YlNjcmlwdDogSW5wdXRQdWJTY3JpcHQsXG4gIHNjcmlwdFR5cGU6IFBhcnNlZFNjcmlwdFR5cGUyT2YzXG4pOiBQYXJzZWRQdWJTY3JpcHRQMm1zIHwgUGFyc2VkUHViU2NyaXB0VGFwcm9vdDtcbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVB1YlNjcmlwdDJPZjMoXG4gIGlucHV0UHViU2NyaXB0OiBJbnB1dFB1YlNjcmlwdCxcbiAgc2NyaXB0VHlwZTogUGFyc2VkU2NyaXB0VHlwZTJPZjNcbik6IFBhcnNlZFB1YlNjcmlwdFAybXMgfCBQYXJzZWRQdWJTY3JpcHRUYXByb290IHtcbiAgY29uc3QgcmVzdWx0ID1cbiAgICBzY3JpcHRUeXBlID09PSAndGFwcm9vdEtleVBhdGhTcGVuZCdcbiAgICAgID8gcGFyc2VUYXByb290S2V5UGF0aFB1YlNjcmlwdChpbnB1dFB1YlNjcmlwdCwgc2NyaXB0VHlwZSlcbiAgICAgIDogc2NyaXB0VHlwZSA9PT0gJ3RhcHJvb3RTY3JpcHRQYXRoU3BlbmQnXG4gICAgICA/IHBhcnNlVGFwcm9vdFNjcmlwdFBhdGhQdWJTY3JpcHQoaW5wdXRQdWJTY3JpcHQsIHNjcmlwdFR5cGUpXG4gICAgICA6IHBhcnNlUDJtc1B1YlNjcmlwdChpbnB1dFB1YlNjcmlwdCwgc2NyaXB0VHlwZSk7XG5cbiAgaWYgKHJlc3VsdCBpbnN0YW5jZW9mIE1hdGNoRXJyb3IpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IocmVzdWx0Lm1lc3NhZ2UpO1xuICB9XG5cbiAgaWYgKFxuICAgIChyZXN1bHQuc2NyaXB0VHlwZSA9PT0gJ3RhcHJvb3RLZXlQYXRoU3BlbmQnICYmIHJlc3VsdC5wdWJsaWNLZXlzLmxlbmd0aCAhPT0gMSkgfHxcbiAgICAocmVzdWx0LnNjcmlwdFR5cGUgPT09ICd0YXByb290U2NyaXB0UGF0aFNwZW5kJyAmJiByZXN1bHQucHVibGljS2V5cy5sZW5ndGggIT09IDIpIHx8XG4gICAgKGlzU2NyaXB0VHlwZTJPZjMocmVzdWx0LnNjcmlwdFR5cGUpICYmIHJlc3VsdC5wdWJsaWNLZXlzLmxlbmd0aCAhPT0gMylcbiAgKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCd1bmV4cGVjdGVkIHB1YmtleSBjb3VudCcpO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqXG4gKiBAcmV0dXJuIHB1YlNjcmlwdCAoc2NyaXB0UHViS2V5L3JlZGVlbVNjcmlwdC93aXRuZXNzU2NyaXB0KSBpcyBwYXJzZWQuXG4gKiBQMlNIID0+IHNjcmlwdFR5cGUsIHB1YlNjcmlwdCAocmVkZWVtU2NyaXB0KSwgcmVkZWVtU2NyaXB0LCBwdWJsaWMga2V5c1xuICogUFcyU0ggPT4gc2NyaXB0VHlwZSwgcHViU2NyaXB0ICh3aXRuZXNzU2NyaXB0KSwgd2l0bmVzc1NjcmlwdCwgcHVibGljIGtleXMuXG4gKiBQMlNILVBXMlNIID0+IHNjcmlwdFR5cGUsIHB1YlNjcmlwdCAod2l0bmVzc1NjcmlwdCksIHdpdG5lc3NTY3JpcHQsIHB1YmxpYyBrZXlzLlxuICogdGFwcm9vdFNjcmlwdFBhdGhTcGVuZCAoUDJUUiBhbmQgUDJUUk1VSVNHMiBzY3JpcHQgcGF0aCkgPT4gc2NyaXB0VHlwZSwgcHViU2NyaXB0LCBwdWIga2V5cy5cbiAqIHRhcHJvb3RLZXlQYXRoU3BlbmQgKFAyVFJNVUlTRzIga2V5IHBhdGgpID0+IHNjcmlwdFR5cGUsIHB1YlNjcmlwdCAoMzQtYnl0ZSBvdXRwdXQgc2NyaXB0KSwgcHViIGtleSAodGFwT3V0cHV0S2V5KS5cbiAqIFAyU0gtUDJQSyA9PiBzY3JpcHRUeXBlLCBwdWJTY3JpcHQsIHB1YiBrZXksIHJlZGVlbVNjcmlwdC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlUHViU2NyaXB0KFxuICBpbnB1dFB1YlNjcmlwdDogSW5wdXRQdWJTY3JpcHQsXG4gIHNjcmlwdFR5cGU6ICd0YXByb290S2V5UGF0aFNwZW5kJ1xuKTogUGFyc2VkUHViU2NyaXB0VGFwcm9vdEtleVBhdGg7XG5leHBvcnQgZnVuY3Rpb24gcGFyc2VQdWJTY3JpcHQoXG4gIGlucHV0UHViU2NyaXB0OiBJbnB1dFB1YlNjcmlwdCxcbiAgc2NyaXB0VHlwZTogJ3RhcHJvb3RTY3JpcHRQYXRoU3BlbmQnXG4pOiBQYXJzZWRQdWJTY3JpcHRUYXByb290U2NyaXB0UGF0aDtcbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVB1YlNjcmlwdChpbnB1dFB1YlNjcmlwdDogSW5wdXRQdWJTY3JpcHQsIHNjcmlwdFR5cGU6ICdwMnNoUDJwaycpOiBQYXJzZWRQdWJTY3JpcHRQMnNoUDJwaztcbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVB1YlNjcmlwdChcbiAgaW5wdXRQdWJTY3JpcHQ6IElucHV0UHViU2NyaXB0LFxuICBzY3JpcHRUeXBlOiAncDJzaCcgfCAncDJzaFAyd3NoJyB8ICdwMndzaCdcbik6IFBhcnNlZFB1YlNjcmlwdFAybXM7XG5leHBvcnQgZnVuY3Rpb24gcGFyc2VQdWJTY3JpcHQoXG4gIGlucHV0UHViU2NyaXB0OiBJbnB1dFB1YlNjcmlwdCxcbiAgc2NyaXB0VHlwZTogUGFyc2VkU2NyaXB0VHlwZVxuKTogUGFyc2VkUHViU2NyaXB0UDJtcyB8IFBhcnNlZFB1YlNjcmlwdFRhcHJvb3QgfCBQYXJzZWRQdWJTY3JpcHRQMnNoUDJwaztcbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVB1YlNjcmlwdChcbiAgaW5wdXRQdWJTY3JpcHQ6IElucHV0UHViU2NyaXB0LFxuICBzY3JpcHRUeXBlOiBQYXJzZWRTY3JpcHRUeXBlXG4pOiBQYXJzZWRQdWJTY3JpcHRQMm1zIHwgUGFyc2VkUHViU2NyaXB0VGFwcm9vdCB8IFBhcnNlZFB1YlNjcmlwdFAyc2hQMnBrIHtcbiAgY29uc3QgcmVzdWx0ID1cbiAgICBzY3JpcHRUeXBlID09PSAncDJzaFAycGsnXG4gICAgICA/IHBhcnNlUDJzaFAycGtQdWJTY3JpcHQoaW5wdXRQdWJTY3JpcHQsIHNjcmlwdFR5cGUpXG4gICAgICA6IHBhcnNlUHViU2NyaXB0Mk9mMyhpbnB1dFB1YlNjcmlwdCwgc2NyaXB0VHlwZSk7XG5cbiAgaWYgKHJlc3VsdCBpbnN0YW5jZW9mIE1hdGNoRXJyb3IpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IocmVzdWx0Lm1lc3NhZ2UpO1xuICB9XG5cbiAgaWYgKHJlc3VsdC5zY3JpcHRUeXBlID09PSAncDJzaFAycGsnICYmIHJlc3VsdC5wdWJsaWNLZXlzLmxlbmd0aCAhPT0gMSkge1xuICAgIHRocm93IG5ldyBFcnJvcigndW5leHBlY3RlZCBwdWJrZXkgY291bnQnKTtcbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG4iXX0=