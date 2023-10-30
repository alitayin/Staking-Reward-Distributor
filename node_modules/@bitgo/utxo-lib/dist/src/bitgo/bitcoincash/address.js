"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toOutputScriptWithFormat = exports.fromOutputScriptWithFormat = exports.toOutputScriptFromCashAddress = exports.fromOutputScriptToCashAddress = exports.getPrefix = void 0;
/**
 * Wrapper around `cashaddress` library.
 *
 * Performs some address sanitation:
 * - add prefix if missing
 * - normalize to lower-case
 * - reject mixed-case
 *
 * Based on these documents
 *
 * - https://github.com/bitcoincashorg/bitcoincash.org/blob/master/spec/cashaddr.md
 * - https://www.bitcoinabc.org/cashaddr/
 */
const cashaddress = require("cashaddress");
const bitcoinjs = require("bitcoinjs-lib");
const networks_1 = require("../../networks");
/**
 * @param name
 * @param output
 * @return the encoded pubkeyhash or scripthash
 */
function getHashFromOutputScript(name, output) {
    const func = bitcoinjs.payments[name];
    if (!func) {
        throw new Error(`no payment with name ${name}`);
    }
    try {
        return func({ output }).hash;
    }
    catch (e) {
        return undefined;
    }
}
/**
 * @param network
 * @return network-specific cashaddr prefix
 */
function getPrefix(network) {
    switch (network) {
        case networks_1.networks.bitcoincash:
            return 'bitcoincash';
        case networks_1.networks.bitcoincashTestnet:
            return 'bchtest';
        case networks_1.networks.ecash:
            return 'ecash';
        case networks_1.networks.ecashTest:
            return 'ectest';
        default:
            throw new Error(`unsupported prefix for ${networks_1.getNetworkName(network)}`);
    }
}
exports.getPrefix = getPrefix;
/**
 * @param outputScript
 * @param network
 * @return outputScript encoded as cashaddr (prefixed, lowercase)
 */
function fromOutputScriptToCashAddress(outputScript, network) {
    if (!networks_1.isBitcoinCash(network) && !networks_1.isECash(network)) {
        throw new Error(`invalid network`);
    }
    for (const [paymentName, scriptType] of [
        ['p2pkh', 'pubkeyhash'],
        ['p2sh', 'scripthash'],
    ]) {
        const hash = getHashFromOutputScript(paymentName, outputScript);
        if (hash) {
            return cashaddress.encode(getPrefix(network), scriptType, hash);
        }
    }
    throw new Error(`could not determine hash for outputScript`);
}
exports.fromOutputScriptToCashAddress = fromOutputScriptToCashAddress;
/**
 * @param address - Accepts addresses with and without prefix. Accepts all-lowercase and all-uppercase addresses. Rejects mixed-case addresses.
 * @param network
 * @return decoded output script
 */
function toOutputScriptFromCashAddress(address, network) {
    if (!networks_1.isBitcoinCash(network) && !networks_1.isECash(network)) {
        throw new Error(`invalid network`);
    }
    if (address === address.toUpperCase()) {
        address = address.toLowerCase();
    }
    if (address !== address.toLowerCase()) {
        throw new Error(`mixed-case addresses not allowed`);
    }
    if (!address.startsWith(getPrefix(network) + ':')) {
        address = `${getPrefix(network)}:${address}`;
    }
    const decoded = cashaddress.decode(address);
    let outputScript;
    switch (decoded.version) {
        case 'scripthash':
            outputScript = bitcoinjs.payments.p2sh({ hash: decoded.hash }).output;
            break;
        case 'pubkeyhash':
            outputScript = bitcoinjs.payments.p2pkh({ hash: decoded.hash }).output;
            break;
        default:
            throw new Error(`unknown version ${decoded.version}`);
    }
    if (!outputScript) {
        throw new Error(`could not determine output script`);
    }
    return outputScript;
}
exports.toOutputScriptFromCashAddress = toOutputScriptFromCashAddress;
/**
 * @param outputScript
 * @param format
 * @param network
 * @return address in specified format
 */
function fromOutputScriptWithFormat(outputScript, format, network) {
    if (!networks_1.isBitcoinCash(network) && !networks_1.isECash(network)) {
        throw new Error(`invalid network`);
    }
    if (format === 'cashaddr') {
        return fromOutputScriptToCashAddress(outputScript, network);
    }
    if (format === 'default') {
        return bitcoinjs.address.fromOutputScript(outputScript, network);
    }
    throw new Error(`invalid format`);
}
exports.fromOutputScriptWithFormat = fromOutputScriptWithFormat;
/**
 * @param address
 * @param format
 * @param network
 * @return output script from address in specified format
 */
function toOutputScriptWithFormat(address, format, network) {
    if (!networks_1.isBitcoinCash(network) && !networks_1.isECash(network)) {
        throw new Error(`invalid network`);
    }
    if (format === 'cashaddr') {
        return toOutputScriptFromCashAddress(address, network);
    }
    if (format === 'default') {
        return bitcoinjs.address.toOutputScript(address, network);
    }
    throw new Error(`invalid format`);
}
exports.toOutputScriptWithFormat = toOutputScriptWithFormat;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWRkcmVzcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9iaXRnby9iaXRjb2luY2FzaC9hZGRyZXNzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBOzs7Ozs7Ozs7Ozs7R0FZRztBQUNILDJDQUEyQztBQUMzQywyQ0FBMkM7QUFDM0MsNkNBQTJGO0FBRzNGOzs7O0dBSUc7QUFDSCxTQUFTLHVCQUF1QixDQUFDLElBQVksRUFBRSxNQUFjO0lBRTNELE1BQU0sSUFBSSxHQUFJLFNBQVMsQ0FBQyxRQUFtRCxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2xGLElBQUksQ0FBQyxJQUFJLEVBQUU7UUFDVCxNQUFNLElBQUksS0FBSyxDQUFDLHdCQUF3QixJQUFJLEVBQUUsQ0FBQyxDQUFDO0tBQ2pEO0lBQ0QsSUFBSTtRQUNGLE9BQU8sSUFBSSxDQUFDLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUM7S0FDOUI7SUFBQyxPQUFPLENBQUMsRUFBRTtRQUNWLE9BQU8sU0FBUyxDQUFDO0tBQ2xCO0FBQ0gsQ0FBQztBQUVEOzs7R0FHRztBQUNILFNBQWdCLFNBQVMsQ0FBQyxPQUFnQjtJQUN4QyxRQUFRLE9BQU8sRUFBRTtRQUNmLEtBQUssbUJBQVEsQ0FBQyxXQUFXO1lBQ3ZCLE9BQU8sYUFBYSxDQUFDO1FBQ3ZCLEtBQUssbUJBQVEsQ0FBQyxrQkFBa0I7WUFDOUIsT0FBTyxTQUFTLENBQUM7UUFDbkIsS0FBSyxtQkFBUSxDQUFDLEtBQUs7WUFDakIsT0FBTyxPQUFPLENBQUM7UUFDakIsS0FBSyxtQkFBUSxDQUFDLFNBQVM7WUFDckIsT0FBTyxRQUFRLENBQUM7UUFDbEI7WUFDRSxNQUFNLElBQUksS0FBSyxDQUFDLDBCQUEwQix5QkFBYyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQztLQUN4RTtBQUNILENBQUM7QUFiRCw4QkFhQztBQUVEOzs7O0dBSUc7QUFDSCxTQUFnQiw2QkFBNkIsQ0FB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TyxDQUFDLENBQUM7S0FDN0Q7SUFFRCxJQUFJLE1BQU0sS0FBSyxTQUFTLEVBQUU7UUFDeEIsT0FBTyxTQUFTLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLFlBQVksRUFBRSxPQUE0QixDQUFDLENBQUM7S0FDdkY7SUFFRCxNQUFNLElBQUksS0FBSyxDQUFDLGdCQUFnQixDQUFDLENBQUM7QUFDcEMsQ0FBQztBQWRELGdFQWNDO0FBRUQ7Ozs7O0dBS0c7QUFDSCxTQUFnQix3QkFBd0IsQ0FBQyxPQUFlLEVBQUUsTUFBcUIsRUFBRSxPQUFnQjtJQUMvRixJQUFJLENBQUMsd0JBQWEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLGtCQUFPLENBQUMsT0FBTyxDQUFDLEVBQUU7UUFDaEQsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0tBQ3BDO0lBRUQsSUFBSSxNQUFNLEtBQUssVUFBVSxFQUFFO1FBQ3pCLE9BQU8sNkJBQTZCLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0tBQ3hEO0lBRUQsSUFBSSxNQUFNLEtBQUssU0FBUyxFQUFFO1FBQ3hCLE9BQU8sU0FBUyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsT0FBTyxFQUFFLE9BQTRCLENBQUMsQ0FBQztLQUNoRjtJQUVELE1BQU0sSUFBSSxLQUFLLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztBQUNwQyxDQUFDO0FBZEQsNERBY0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFdyYXBwZXIgYXJvdW5kIGBjYXNoYWRkcmVzc2AgbGlicmFyeS5cbiAqXG4gKiBQZXJmb3JtcyBzb21lIGFkZHJlc3Mgc2FuaXRhdGlvbjpcbiAqIC0gYWRkIHByZWZpeCBpZiBtaXNzaW5nXG4gKiAtIG5vcm1hbGl6ZSB0byBsb3dlci1jYXNlXG4gKiAtIHJlamVjdCBtaXhlZC1jYXNlXG4gKlxuICogQmFzZWQgb24gdGhlc2UgZG9jdW1lbnRzXG4gKlxuICogLSBodHRwczovL2dpdGh1Yi5jb20vYml0Y29pbmNhc2hvcmcvYml0Y29pbmNhc2gub3JnL2Jsb2IvbWFzdGVyL3NwZWMvY2FzaGFkZHIubWRcbiAqIC0gaHR0cHM6Ly93d3cuYml0Y29pbmFiYy5vcmcvY2FzaGFkZHIvXG4gKi9cbmltcG9ydCAqIGFzIGNhc2hhZGRyZXNzIGZyb20gJ2Nhc2hhZGRyZXNzJztcbmltcG9ydCAqIGFzIGJpdGNvaW5qcyBmcm9tICdiaXRjb2luanMtbGliJztcbmltcG9ydCB7IGdldE5ldHdvcmtOYW1lLCBpc0JpdGNvaW5DYXNoLCBpc0VDYXNoLCBOZXR3b3JrLCBuZXR3b3JrcyB9IGZyb20gJy4uLy4uL25ldHdvcmtzJztcbmltcG9ydCB7IEFkZHJlc3NGb3JtYXQgfSBmcm9tICcuLi8uLi9hZGRyZXNzRm9ybWF0JztcblxuLyoqXG4gKiBAcGFyYW0gbmFtZVxuICogQHBhcmFtIG91dHB1dFxuICogQHJldHVybiB0aGUgZW5jb2RlZCBwdWJrZXloYXNoIG9yIHNjcmlwdGhhc2hcbiAqL1xuZnVuY3Rpb24gZ2V0SGFzaEZyb21PdXRwdXRTY3JpcHQobmFtZTogc3RyaW5nLCBvdXRwdXQ6IEJ1ZmZlcik6IEJ1ZmZlciB8IHVuZGVmaW5lZCB7XG4gIHR5cGUgUGF5bWVudEZ1bmMgPSAoeyBvdXRwdXQgfTogeyBvdXRwdXQ6IEJ1ZmZlciB9KSA9PiBiaXRjb2luanMuUGF5bWVudDtcbiAgY29uc3QgZnVuYyA9IChiaXRjb2luanMucGF5bWVudHMgYXMgdW5rbm93biBhcyBSZWNvcmQ8c3RyaW5nLCBQYXltZW50RnVuYz4pW25hbWVdO1xuICBpZiAoIWZ1bmMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYG5vIHBheW1lbnQgd2l0aCBuYW1lICR7bmFtZX1gKTtcbiAgfVxuICB0cnkge1xuICAgIHJldHVybiBmdW5jKHsgb3V0cHV0IH0pLmhhc2g7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG59XG5cbi8qKlxuICogQHBhcmFtIG5ldHdvcmtcbiAqIEByZXR1cm4gbmV0d29yay1zcGVjaWZpYyBjYXNoYWRkciBwcmVmaXhcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFByZWZpeChuZXR3b3JrOiBOZXR3b3JrKTogc3RyaW5nIHtcbiAgc3dpdGNoIChuZXR3b3JrKSB7XG4gICAgY2FzZSBuZXR3b3Jrcy5iaXRjb2luY2FzaDpcbiAgICAgIHJldHVybiAnYml0Y29pbmNhc2gnO1xuICAgIGNhc2UgbmV0d29ya3MuYml0Y29pbmNhc2hUZXN0bmV0OlxuICAgICAgcmV0dXJuICdiY2h0ZXN0JztcbiAgICBjYXNlIG5ldHdvcmtzLmVjYXNoOlxuICAgICAgcmV0dXJuICdlY2FzaCc7XG4gICAgY2FzZSBuZXR3b3Jrcy5lY2FzaFRlc3Q6XG4gICAgICByZXR1cm4gJ2VjdGVzdCc7XG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcihgdW5zdXBwb3J0ZWQgcHJlZml4IGZvciAke2dldE5ldHdvcmtOYW1lKG5ldHdvcmspfWApO1xuICB9XG59XG5cbi8qKlxuICogQHBhcmFtIG91dHB1dFNjcmlwdFxuICogQHBhcmFtIG5ldHdvcmtcbiAqIEByZXR1cm4gb3V0cHV0U2NyaXB0IGVuY29kZWQgYXMgY2FzaGFkZHIgKHByZWZpeGVkLCBsb3dlcmNhc2UpXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmcm9tT3V0cHV0U2NyaXB0VG9DYXNoQWRkcmVzcyhvdXRwdXRTY3JpcHQ6IEJ1ZmZlciwgbmV0d29yazogTmV0d29yayk6IHN0cmluZyB7XG4gIGlmICghaXNCaXRjb2luQ2FzaChuZXR3b3JrKSAmJiAhaXNFQ2FzaChuZXR3b3JrKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgaW52YWxpZCBuZXR3b3JrYCk7XG4gIH1cbiAgZm9yIChjb25zdCBbcGF5bWVudE5hbWUsIHNjcmlwdFR5cGVdIG9mIFtcbiAgICBbJ3AycGtoJywgJ3B1YmtleWhhc2gnXSxcbiAgICBbJ3Ayc2gnLCAnc2NyaXB0aGFzaCddLFxuICBdKSB7XG4gICAgY29uc3QgaGFzaCA9IGdldEhhc2hGcm9tT3V0cHV0U2NyaXB0KHBheW1lbnROYW1lLCBvdXRwdXRTY3JpcHQpO1xuICAgIGlmIChoYXNoKSB7XG4gICAgICByZXR1cm4gY2FzaGFkZHJlc3MuZW5jb2RlKGdldFByZWZpeChuZXR3b3JrKSwgc2NyaXB0VHlwZSBhcyBjYXNoYWRkcmVzcy5TY3JpcHRUeXBlLCBoYXNoKTtcbiAgICB9XG4gIH1cbiAgdGhyb3cgbmV3IEVycm9yKGBjb3VsZCBub3QgZGV0ZXJtaW5lIGhhc2ggZm9yIG91dHB1dFNjcmlwdGApO1xufVxuXG4vKipcbiAqIEBwYXJhbSBhZGRyZXNzIC0gQWNjZXB0cyBhZGRyZXNzZXMgd2l0aCBhbmQgd2l0aG91dCBwcmVmaXguIEFjY2VwdHMgYWxsLWxvd2VyY2FzZSBhbmQgYWxsLXVwcGVyY2FzZSBhZGRyZXNzZXMuIFJlamVjdHMgbWl4ZWQtY2FzZSBhZGRyZXNzZXMuXG4gKiBAcGFyYW0gbmV0d29ya1xuICogQHJldHVybiBkZWNvZGVkIG91dHB1dCBzY3JpcHRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRvT3V0cHV0U2NyaXB0RnJvbUNhc2hBZGRyZXNzKGFkZHJlc3M6IHN0cmluZywgbmV0d29yazogTmV0d29yayk6IEJ1ZmZlciB7XG4gIGlmICghaXNCaXRjb2luQ2FzaChuZXR3b3JrKSAmJiAhaXNFQ2FzaChuZXR3b3JrKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgaW52YWxpZCBuZXR3b3JrYCk7XG4gIH1cbiAgaWYgKGFkZHJlc3MgPT09IGFkZHJlc3MudG9VcHBlckNhc2UoKSkge1xuICAgIGFkZHJlc3MgPSBhZGRyZXNzLnRvTG93ZXJDYXNlKCk7XG4gIH1cbiAgaWYgKGFkZHJlc3MgIT09IGFkZHJlc3MudG9Mb3dlckNhc2UoKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgbWl4ZWQtY2FzZSBhZGRyZXNzZXMgbm90IGFsbG93ZWRgKTtcbiAgfVxuICBpZiAoIWFkZHJlc3Muc3RhcnRzV2l0aChnZXRQcmVmaXgobmV0d29yaykgKyAnOicpKSB7XG4gICAgYWRkcmVzcyA9IGAke2dldFByZWZpeChuZXR3b3JrKX06JHthZGRyZXNzfWA7XG4gIH1cbiAgY29uc3QgZGVjb2RlZCA9IGNhc2hhZGRyZXNzLmRlY29kZShhZGRyZXNzKTtcbiAgbGV0IG91dHB1dFNjcmlwdDogQnVmZmVyIHwgdW5kZWZpbmVkO1xuICBzd2l0Y2ggKGRlY29kZWQudmVyc2lvbikge1xuICAgIGNhc2UgJ3NjcmlwdGhhc2gnOlxuICAgICAgb3V0cHV0U2NyaXB0ID0gYml0Y29pbmpzLnBheW1lbnRzLnAyc2goeyBoYXNoOiBkZWNvZGVkLmhhc2ggfSkub3V0cHV0O1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAncHVia2V5aGFzaCc6XG4gICAgICBvdXRwdXRTY3JpcHQgPSBiaXRjb2luanMucGF5bWVudHMucDJwa2goeyBoYXNoOiBkZWNvZGVkLmhhc2ggfSkub3V0cHV0O1xuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcihgdW5rbm93biB2ZXJzaW9uICR7ZGVjb2RlZC52ZXJzaW9ufWApO1xuICB9XG4gIGlmICghb3V0cHV0U2NyaXB0KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBjb3VsZCBub3QgZGV0ZXJtaW5lIG91dHB1dCBzY3JpcHRgKTtcbiAgfVxuICByZXR1cm4gb3V0cHV0U2NyaXB0O1xufVxuXG4vKipcbiAqIEBwYXJhbSBvdXRwdXRTY3JpcHRcbiAqIEBwYXJhbSBmb3JtYXRcbiAqIEBwYXJhbSBuZXR3b3JrXG4gKiBAcmV0dXJuIGFkZHJlc3MgaW4gc3BlY2lmaWVkIGZvcm1hdFxuICovXG5leHBvcnQgZnVuY3Rpb24gZnJvbU91dHB1dFNjcmlwdFdpdGhGb3JtYXQob3V0cHV0U2NyaXB0OiBCdWZmZXIsIGZvcm1hdDogQWRkcmVzc0Zvcm1hdCwgbmV0d29yazogTmV0d29yayk6IHN0cmluZyB7XG4gIGlmICghaXNCaXRjb2luQ2FzaChuZXR3b3JrKSAmJiAhaXNFQ2FzaChuZXR3b3JrKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihgaW52YWxpZCBuZXR3b3JrYCk7XG4gIH1cblxuICBpZiAoZm9ybWF0ID09PSAnY2FzaGFkZHInKSB7XG4gICAgcmV0dXJuIGZyb21PdXRwdXRTY3JpcHRUb0Nhc2hBZGRyZXNzKG91dHB1dFNjcmlwdCwgbmV0d29yayk7XG4gIH1cblxuICBpZiAoZm9ybWF0ID09PSAnZGVmYXVsdCcpIHtcbiAgICByZXR1cm4gYml0Y29pbmpzLmFkZHJlc3MuZnJvbU91dHB1dFNjcmlwdChvdXRwdXRTY3JpcHQsIG5ldHdvcmsgYXMgYml0Y29pbmpzLk5ldHdvcmspO1xuICB9XG5cbiAgdGhyb3cgbmV3IEVycm9yKGBpbnZhbGlkIGZvcm1hdGApO1xufVxuXG4vKipcbiAqIEBwYXJhbSBhZGRyZXNzXG4gKiBAcGFyYW0gZm9ybWF0XG4gKiBAcGFyYW0gbmV0d29ya1xuICogQHJldHVybiBvdXRwdXQgc2NyaXB0IGZyb20gYWRkcmVzcyBpbiBzcGVjaWZpZWQgZm9ybWF0XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0b091dHB1dFNjcmlwdFdpdGhGb3JtYXQoYWRkcmVzczogc3RyaW5nLCBmb3JtYXQ6IEFkZHJlc3NGb3JtYXQsIG5ldHdvcms6IE5ldHdvcmspOiBCdWZmZXIge1xuICBpZiAoIWlzQml0Y29pbkNhc2gobmV0d29yaykgJiYgIWlzRUNhc2gobmV0d29yaykpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYGludmFsaWQgbmV0d29ya2ApO1xuICB9XG5cbiAgaWYgKGZvcm1hdCA9PT0gJ2Nhc2hhZGRyJykge1xuICAgIHJldHVybiB0b091dHB1dFNjcmlwdEZyb21DYXNoQWRkcmVzcyhhZGRyZXNzLCBuZXR3b3JrKTtcbiAgfVxuXG4gIGlmIChmb3JtYXQgPT09ICdkZWZhdWx0Jykge1xuICAgIHJldHVybiBiaXRjb2luanMuYWRkcmVzcy50b091dHB1dFNjcmlwdChhZGRyZXNzLCBuZXR3b3JrIGFzIGJpdGNvaW5qcy5OZXR3b3JrKTtcbiAgfVxuXG4gIHRocm93IG5ldyBFcnJvcihgaW52YWxpZCBmb3JtYXRgKTtcbn1cbiJdfQ==