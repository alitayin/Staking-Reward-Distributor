"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.padInputScript = void 0;
const assert = require("assert");
const opcodes = require("bitcoin-ops");
const __1 = require("../");
/**
 * @param input - Input of non-standard half-signed transaction created with `tx.build()` instead of `tx.buildIncomplete()`.
 * @param signatureIndex - Position to map the existing signatures to. Other signatures will be padded with OP_0.
 */
function padInputScript(input, signatureIndex) {
    if (![0, 1, 2].includes(signatureIndex)) {
        /* istanbul ignore next */
        throw new Error(`invalid signature index: must be one of [0, 1, 2]`);
    }
    let decompiledSigScript;
    if (input.witness && input.witness.length > 0) {
        decompiledSigScript = input.witness;
    }
    else {
        decompiledSigScript = __1.script.decompile(input.script);
    }
    // The shape of a non-standard half-signed input is
    //   OP_0 <signature> <p2ms>
    if (!decompiledSigScript || decompiledSigScript.length !== 3) {
        /* istanbul ignore next */
        return;
    }
    const [op0, signatureBuffer, sigScript] = decompiledSigScript;
    if (op0 !== opcodes.OP_0 && !(Buffer.isBuffer(op0) && op0.length === 0)) {
        /* istanbul ignore next */
        return;
    }
    if (!Buffer.isBuffer(sigScript)) {
        /* istanbul ignore next */
        return;
    }
    if (__1.classify.output(sigScript) !== __1.classify.types.P2MS) {
        /* istanbul ignore next */
        return;
    }
    const paddedSigScript = [
        op0,
        ...[0, 1, 2].map((i) => (i === signatureIndex ? signatureBuffer : Buffer.from([]))),
        sigScript,
    ];
    if (input.witness.length) {
        paddedSigScript.forEach((b) => assert(Buffer.isBuffer(b)));
        input.witness = paddedSigScript;
    }
    else {
        input.script = __1.script.compile(paddedSigScript);
    }
}
exports.padInputScript = padInputScript;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm9uU3RhbmRhcmRIYWxmU2lnbmVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2JpdGdvL25vblN0YW5kYXJkSGFsZlNpZ25lZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxpQ0FBaUM7QUFDakMsdUNBQXVDO0FBQ3ZDLDJCQUEyRDtBQUUzRDs7O0dBR0c7QUFDSCxTQUFnQixjQUFjLENBQUMsS0FBYyxFQUFFLGNBQXNCO0lBQ25FLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxFQUFFO1FBQ3ZDLDBCQUEwQjtRQUMxQixNQUFNLElBQUksS0FBSyxDQUFDLG1EQUFtRCxDQUFDLENBQUM7S0FDdEU7SUFFRCxJQUFJLG1CQUFtQixDQUFDO0lBQ3hCLElBQUksS0FBSyxDQUFDLE9BQU8sSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7UUFDN0MsbUJBQW1CLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQztLQUNyQztTQUFNO1FBQ0wsbUJBQW1CLEdBQUcsVUFBTyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7S0FDdkQ7SUFFRCxtREFBbUQ7SUFDbkQsNEJBQTRCO0lBQzVCLElBQUksQ0FBQyxtQkFBbUIsSUFBSSxtQkFBbUIsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1FBQzVELDBCQUEwQjtRQUMxQixPQUFPO0tBQ1I7SUFFRCxNQUFNLENBQUMsR0FBRyxFQUFFLGVBQWUsRUFBRSxTQUFTLENBQUMsR0FBRyxtQkFBbUIsQ0FBQztJQUM5RCxJQUFJLEdBQUcsS0FBSyxPQUFPLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLEVBQUU7UUFDdkUsMEJBQTBCO1FBQzFCLE9BQU87S0FDUjtJQUVELElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxFQUFFO1FBQy9CLDBCQUEwQjtRQUMxQixPQUFPO0tBQ1I7SUFFRCxJQUFJLFlBQVEsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLEtBQUssWUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUU7UUFDdEQsMEJBQTBCO1FBQzFCLE9BQU87S0FDUjtJQUVELE1BQU0sZUFBZSxHQUFHO1FBQ3RCLEdBQUc7UUFDSCxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLGNBQWMsQ0FBQyxDQUFDLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDbkYsU0FBUztLQUNWLENBQUM7SUFFRixJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFO1FBQ3hCLGVBQWUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMzRCxLQUFLLENBQUMsT0FBTyxHQUFHLGVBQTJCLENBQUM7S0FDN0M7U0FBTTtRQUNMLEtBQUssQ0FBQyxNQUFNLEdBQUcsVUFBTyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztLQUNqRDtBQUNILENBQUM7QUFoREQsd0NBZ0RDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgKiBhcyBvcGNvZGVzIGZyb20gJ2JpdGNvaW4tb3BzJztcbmltcG9ydCB7IGNsYXNzaWZ5LCBzY3JpcHQgYXMgYnNjcmlwdCwgVHhJbnB1dCB9IGZyb20gJy4uLyc7XG5cbi8qKlxuICogQHBhcmFtIGlucHV0IC0gSW5wdXQgb2Ygbm9uLXN0YW5kYXJkIGhhbGYtc2lnbmVkIHRyYW5zYWN0aW9uIGNyZWF0ZWQgd2l0aCBgdHguYnVpbGQoKWAgaW5zdGVhZCBvZiBgdHguYnVpbGRJbmNvbXBsZXRlKClgLlxuICogQHBhcmFtIHNpZ25hdHVyZUluZGV4IC0gUG9zaXRpb24gdG8gbWFwIHRoZSBleGlzdGluZyBzaWduYXR1cmVzIHRvLiBPdGhlciBzaWduYXR1cmVzIHdpbGwgYmUgcGFkZGVkIHdpdGggT1BfMC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhZElucHV0U2NyaXB0KGlucHV0OiBUeElucHV0LCBzaWduYXR1cmVJbmRleDogbnVtYmVyKTogdm9pZCB7XG4gIGlmICghWzAsIDEsIDJdLmluY2x1ZGVzKHNpZ25hdHVyZUluZGV4KSkge1xuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gICAgdGhyb3cgbmV3IEVycm9yKGBpbnZhbGlkIHNpZ25hdHVyZSBpbmRleDogbXVzdCBiZSBvbmUgb2YgWzAsIDEsIDJdYCk7XG4gIH1cblxuICBsZXQgZGVjb21waWxlZFNpZ1NjcmlwdDtcbiAgaWYgKGlucHV0LndpdG5lc3MgJiYgaW5wdXQud2l0bmVzcy5sZW5ndGggPiAwKSB7XG4gICAgZGVjb21waWxlZFNpZ1NjcmlwdCA9IGlucHV0LndpdG5lc3M7XG4gIH0gZWxzZSB7XG4gICAgZGVjb21waWxlZFNpZ1NjcmlwdCA9IGJzY3JpcHQuZGVjb21waWxlKGlucHV0LnNjcmlwdCk7XG4gIH1cblxuICAvLyBUaGUgc2hhcGUgb2YgYSBub24tc3RhbmRhcmQgaGFsZi1zaWduZWQgaW5wdXQgaXNcbiAgLy8gICBPUF8wIDxzaWduYXR1cmU+IDxwMm1zPlxuICBpZiAoIWRlY29tcGlsZWRTaWdTY3JpcHQgfHwgZGVjb21waWxlZFNpZ1NjcmlwdC5sZW5ndGggIT09IDMpIHtcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IFtvcDAsIHNpZ25hdHVyZUJ1ZmZlciwgc2lnU2NyaXB0XSA9IGRlY29tcGlsZWRTaWdTY3JpcHQ7XG4gIGlmIChvcDAgIT09IG9wY29kZXMuT1BfMCAmJiAhKEJ1ZmZlci5pc0J1ZmZlcihvcDApICYmIG9wMC5sZW5ndGggPT09IDApKSB7XG4gICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICByZXR1cm47XG4gIH1cblxuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihzaWdTY3JpcHQpKSB7XG4gICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICByZXR1cm47XG4gIH1cblxuICBpZiAoY2xhc3NpZnkub3V0cHV0KHNpZ1NjcmlwdCkgIT09IGNsYXNzaWZ5LnR5cGVzLlAyTVMpIHtcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IHBhZGRlZFNpZ1NjcmlwdCA9IFtcbiAgICBvcDAsXG4gICAgLi4uWzAsIDEsIDJdLm1hcCgoaSkgPT4gKGkgPT09IHNpZ25hdHVyZUluZGV4ID8gc2lnbmF0dXJlQnVmZmVyIDogQnVmZmVyLmZyb20oW10pKSksXG4gICAgc2lnU2NyaXB0LFxuICBdO1xuXG4gIGlmIChpbnB1dC53aXRuZXNzLmxlbmd0aCkge1xuICAgIHBhZGRlZFNpZ1NjcmlwdC5mb3JFYWNoKChiKSA9PiBhc3NlcnQoQnVmZmVyLmlzQnVmZmVyKGIpKSk7XG4gICAgaW5wdXQud2l0bmVzcyA9IHBhZGRlZFNpZ1NjcmlwdCBhcyBCdWZmZXJbXTtcbiAgfSBlbHNlIHtcbiAgICBpbnB1dC5zY3JpcHQgPSBic2NyaXB0LmNvbXBpbGUocGFkZGVkU2lnU2NyaXB0KTtcbiAgfVxufVxuIl19