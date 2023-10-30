"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RootWalletKeys = exports.DerivedWalletKeys = exports.WalletKeys = exports.eqPublicKey = void 0;
function eqPublicKey(a, b) {
    return a.publicKey.equals(b.publicKey);
}
exports.eqPublicKey = eqPublicKey;
/**
 * Base class for RootWalletKeys and DerivedWalletKeys.
 * Keys can be either public keys or private keys.
 */
class WalletKeys {
    /**
     * @param triple - bip32 key triple
     */
    constructor(triple) {
        this.triple = triple;
        triple.forEach((a, i) => {
            triple.forEach((b, j) => {
                if (eqPublicKey(a, b) && i !== j) {
                    throw new Error(`wallet keys must be distinct`);
                }
            });
        });
        this.publicKeys = this.triple.map((k) => k.publicKey);
    }
    get user() {
        return this.triple[0];
    }
    get backup() {
        return this.triple[1];
    }
    get bitgo() {
        return this.triple[2];
    }
}
exports.WalletKeys = WalletKeys;
/**
 * Set of WalletKeys derived from RootWalletKeys. Suitable for signing transaction inputs.
 * Contains reference to the RootWalletKeys this was derived from as well as the paths used
 * for derivation.
 */
class DerivedWalletKeys extends WalletKeys {
    /**
     * @param parent - wallet keys to derive from
     * @param paths - paths to derive with
     */
    constructor(parent, paths) {
        super(parent.triple.map((k, i) => k.derivePath(paths[i])));
        this.parent = parent;
        this.paths = paths;
    }
}
exports.DerivedWalletKeys = DerivedWalletKeys;
/**
 * Set of root wallet keys, typically instantiated using the wallet xpub triple.
 */
class RootWalletKeys extends WalletKeys {
    /**
     * @param triple - bip32 key triple
     * @param derivationPrefixes - Certain v1 wallets or their migrated v2 counterparts
     *                             can have a nonstandard prefix.
     */
    constructor(triple, derivationPrefixes = [
        RootWalletKeys.defaultPrefix,
        RootWalletKeys.defaultPrefix,
        RootWalletKeys.defaultPrefix,
    ]) {
        super(triple);
        this.derivationPrefixes = derivationPrefixes;
        derivationPrefixes.forEach((p) => {
            if (p.startsWith('/') || p.endsWith('/')) {
                throw new Error(`derivation prefix must not start or end with a slash`);
            }
        });
    }
    /**
     * @param key
     * @param chain
     * @param index
     * @return full derivation path for key, including key-specific prefix
     */
    getDerivationPath(key, chain, index) {
        if (!this.derivationPrefixes) {
            throw new Error(`no derivation prefixes`);
        }
        const prefix = this.derivationPrefixes.find((prefix, i) => eqPublicKey(key, this.triple[i]));
        if (prefix === undefined) {
            throw new Error(`key not in walletKeys`);
        }
        return `${prefix}/${chain}/${index}`;
    }
    /**
     * @param chain
     * @param index
     * @return walletKeys for a particular address identified by (chain, index)
     */
    deriveForChainAndIndex(chain, index) {
        return new DerivedWalletKeys(this, this.triple.map((k) => this.getDerivationPath(k, chain, index)));
    }
}
exports.RootWalletKeys = RootWalletKeys;
RootWalletKeys.defaultPrefix = '0/0';
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiV2FsbGV0S2V5cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9iaXRnby93YWxsZXQvV2FsbGV0S2V5cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFpQkEsU0FBZ0IsV0FBVyxDQUFDLENBQWlCLEVBQUUsQ0FBaUI7SUFDOUQsT0FBTyxDQUFDLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDekMsQ0FBQztBQUZELGtDQUVDO0FBRUQ7OztHQUdHO0FBQ0gsTUFBYSxVQUFVO0lBR3JCOztPQUVHO0lBQ0gsWUFBNEIsTUFBOEI7UUFBOUIsV0FBTSxHQUFOLE1BQU0sQ0FBd0I7UUFDeEQsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtZQUN0QixNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO2dCQUN0QixJQUFJLFdBQVcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRTtvQkFDaEMsTUFBTSxJQUFJLEtBQUssQ0FBQyw4QkFBOEIsQ0FBQyxDQUFDO2lCQUNqRDtZQUNILENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFtQixDQUFDO0lBQzFFLENBQUM7SUFFRCxJQUFJLElBQUk7UUFDTixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDeEIsQ0FBQztJQUVELElBQUksTUFBTTtRQUNSLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN4QixDQUFDO0lBRUQsSUFBSSxLQUFLO1FBQ1AsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3hCLENBQUM7Q0FDRjtBQTdCRCxnQ0E2QkM7QUFFRDs7OztHQUlHO0FBQ0gsTUFBYSxpQkFBa0IsU0FBUSxVQUFVO0lBQy9DOzs7T0FHRztJQUNILFlBQW1CLE1BQXNCLEVBQVMsS0FBcUI7UUFDckUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBMkIsQ0FBQyxDQUFDO1FBRHBFLFdBQU0sR0FBTixNQUFNLENBQWdCO1FBQVMsVUFBSyxHQUFMLEtBQUssQ0FBZ0I7SUFFdkUsQ0FBQztDQUNGO0FBUkQsOENBUUM7QUFFRDs7R0FFRztBQUNILE1BQWEsY0FBZSxTQUFRLFVBQVU7SUFHNUM7Ozs7T0FJRztJQUNILFlBQ0UsTUFBOEIsRUFDZCxxQkFBcUM7UUFDbkQsY0FBYyxDQUFDLGFBQWE7UUFDNUIsY0FBYyxDQUFDLGFBQWE7UUFDNUIsY0FBYyxDQUFDLGFBQWE7S0FDN0I7UUFFRCxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7UUFORSx1QkFBa0IsR0FBbEIsa0JBQWtCLENBSWpDO1FBSUQsa0JBQWtCLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7WUFDL0IsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUU7Z0JBQ3hDLE1BQU0sSUFBSSxLQUFLLENBQUMsc0RBQXNELENBQUMsQ0FBQzthQUN6RTtRQUNILENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0gsaUJBQWlCLENBQUMsR0FBbUIsRUFBRSxLQUFhLEVBQUUsS0FBYTtRQUNqRSxJQUFJLENBQUMsSUFBSSxDQUFDLGtCQUFrQixFQUFFO1lBQzVCLE1BQU0sSUFBSSxLQUFLLENBQUMsd0JBQXdCLENBQUMsQ0FBQztTQUMzQztRQUNELE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzdGLElBQUksTUFBTSxLQUFLLFNBQVMsRUFBRTtZQUN4QixNQUFNLElBQUksS0FBSyxDQUFDLHVCQUF1QixDQUFDLENBQUM7U0FDMUM7UUFDRCxPQUFPLEdBQUcsTUFBTSxJQUFJLEtBQUssSUFBSSxLQUFLLEVBQUUsQ0FBQztJQUN2QyxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILHNCQUFzQixDQUFDLEtBQWEsRUFBRSxLQUFhO1FBQ2pELE9BQU8sSUFBSSxpQkFBaUIsQ0FDMUIsSUFBSSxFQUNKLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBbUIsQ0FDbEYsQ0FBQztJQUNKLENBQUM7O0FBcERILHdDQXFEQztBQXBEaUIsNEJBQWEsR0FBRyxLQUFLLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENsYXNzZXMgZm9yIGRlcml2aW5nIGtleSB0cmlwbGVzIGZvciB3YWxsZXQgYWRkcmVzc2VzLlxuICpcbiAqIEJ5IGRlZmF1bHQsIEJpdEdvIHdhbGxldHMgY29uc2lzdCBvZiBhIHRyaXBsZSBvZiBiaXAzMiBleHRlbmQga2V5cGFpcnMuXG4gKiBFdmVyeSB3YWxsZXQgYWRkcmVzcyBjYW4gYmUgaWRlbnRpZmllZCBieSBfKGNoYWluOiBudW1iZXIsIGluZGV4OiBudW1iZXIpXy5cbiAqIFRoZSBrZXkgc2V0IGZvciBhIHBhcnRpY3VsYXIgYWRkcmVzcyBjYW4gYmUgb2J0YWluZWQgYnkgZGVyaXZpbmcgd2l0aCB0aGUgcGF0aFxuICogYDAvMC8ke2NoYWlufS8ke2luZGV4fWAuIChJbiByYXJlIGNhc2VzIHRoZSBwcmVmaXggMC8wIGNhbiBiZSBkaWZmZXJlbnQpXG4gKlxuICogU2luY2Ugd2UgbmV2ZXIgdXNlIG90aGVyIGRlcml2YXRpb25zIGZvciB1dHhvIGFkZHJlc3Mgc2NyaXB0cywgdGhlIGNsYXNzZXMgZGVmaW5lZCBoZXJlIG9ubHlcbiAqIGFsbG93IGV4YWN0bHkgb25lIGxldmVsIG9mIGRlcml2YXRpb24uXG4gKi9cbmltcG9ydCB7IEJJUDMySW50ZXJmYWNlIH0gZnJvbSAnYmlwMzInO1xuXG5pbXBvcnQgeyBUcmlwbGUgfSBmcm9tICcuLi90eXBlcyc7XG5cbmV4cG9ydCB0eXBlIEtleU5hbWUgPSAndXNlcicgfCAnYmFja3VwJyB8ICdiaXRnbyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBlcVB1YmxpY0tleShhOiBCSVAzMkludGVyZmFjZSwgYjogQklQMzJJbnRlcmZhY2UpOiBib29sZWFuIHtcbiAgcmV0dXJuIGEucHVibGljS2V5LmVxdWFscyhiLnB1YmxpY0tleSk7XG59XG5cbi8qKlxuICogQmFzZSBjbGFzcyBmb3IgUm9vdFdhbGxldEtleXMgYW5kIERlcml2ZWRXYWxsZXRLZXlzLlxuICogS2V5cyBjYW4gYmUgZWl0aGVyIHB1YmxpYyBrZXlzIG9yIHByaXZhdGUga2V5cy5cbiAqL1xuZXhwb3J0IGNsYXNzIFdhbGxldEtleXMge1xuICBwdWJsaWMgcmVhZG9ubHkgcHVibGljS2V5czogVHJpcGxlPEJ1ZmZlcj47XG5cbiAgLyoqXG4gICAqIEBwYXJhbSB0cmlwbGUgLSBiaXAzMiBrZXkgdHJpcGxlXG4gICAqL1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgcmVhZG9ubHkgdHJpcGxlOiBUcmlwbGU8QklQMzJJbnRlcmZhY2U+KSB7XG4gICAgdHJpcGxlLmZvckVhY2goKGEsIGkpID0+IHtcbiAgICAgIHRyaXBsZS5mb3JFYWNoKChiLCBqKSA9PiB7XG4gICAgICAgIGlmIChlcVB1YmxpY0tleShhLCBiKSAmJiBpICE9PSBqKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGB3YWxsZXQga2V5cyBtdXN0IGJlIGRpc3RpbmN0YCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgdGhpcy5wdWJsaWNLZXlzID0gdGhpcy50cmlwbGUubWFwKChrKSA9PiBrLnB1YmxpY0tleSkgYXMgVHJpcGxlPEJ1ZmZlcj47XG4gIH1cblxuICBnZXQgdXNlcigpOiBCSVAzMkludGVyZmFjZSB7XG4gICAgcmV0dXJuIHRoaXMudHJpcGxlWzBdO1xuICB9XG5cbiAgZ2V0IGJhY2t1cCgpOiBCSVAzMkludGVyZmFjZSB7XG4gICAgcmV0dXJuIHRoaXMudHJpcGxlWzFdO1xuICB9XG5cbiAgZ2V0IGJpdGdvKCk6IEJJUDMySW50ZXJmYWNlIHtcbiAgICByZXR1cm4gdGhpcy50cmlwbGVbMl07XG4gIH1cbn1cblxuLyoqXG4gKiBTZXQgb2YgV2FsbGV0S2V5cyBkZXJpdmVkIGZyb20gUm9vdFdhbGxldEtleXMuIFN1aXRhYmxlIGZvciBzaWduaW5nIHRyYW5zYWN0aW9uIGlucHV0cy5cbiAqIENvbnRhaW5zIHJlZmVyZW5jZSB0byB0aGUgUm9vdFdhbGxldEtleXMgdGhpcyB3YXMgZGVyaXZlZCBmcm9tIGFzIHdlbGwgYXMgdGhlIHBhdGhzIHVzZWRcbiAqIGZvciBkZXJpdmF0aW9uLlxuICovXG5leHBvcnQgY2xhc3MgRGVyaXZlZFdhbGxldEtleXMgZXh0ZW5kcyBXYWxsZXRLZXlzIHtcbiAgLyoqXG4gICAqIEBwYXJhbSBwYXJlbnQgLSB3YWxsZXQga2V5cyB0byBkZXJpdmUgZnJvbVxuICAgKiBAcGFyYW0gcGF0aHMgLSBwYXRocyB0byBkZXJpdmUgd2l0aFxuICAgKi9cbiAgY29uc3RydWN0b3IocHVibGljIHBhcmVudDogUm9vdFdhbGxldEtleXMsIHB1YmxpYyBwYXRoczogVHJpcGxlPHN0cmluZz4pIHtcbiAgICBzdXBlcihwYXJlbnQudHJpcGxlLm1hcCgoaywgaSkgPT4gay5kZXJpdmVQYXRoKHBhdGhzW2ldKSkgYXMgVHJpcGxlPEJJUDMySW50ZXJmYWNlPik7XG4gIH1cbn1cblxuLyoqXG4gKiBTZXQgb2Ygcm9vdCB3YWxsZXQga2V5cywgdHlwaWNhbGx5IGluc3RhbnRpYXRlZCB1c2luZyB0aGUgd2FsbGV0IHhwdWIgdHJpcGxlLlxuICovXG5leHBvcnQgY2xhc3MgUm9vdFdhbGxldEtleXMgZXh0ZW5kcyBXYWxsZXRLZXlzIHtcbiAgc3RhdGljIHJlYWRvbmx5IGRlZmF1bHRQcmVmaXggPSAnMC8wJztcblxuICAvKipcbiAgICogQHBhcmFtIHRyaXBsZSAtIGJpcDMyIGtleSB0cmlwbGVcbiAgICogQHBhcmFtIGRlcml2YXRpb25QcmVmaXhlcyAtIENlcnRhaW4gdjEgd2FsbGV0cyBvciB0aGVpciBtaWdyYXRlZCB2MiBjb3VudGVycGFydHNcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbiBoYXZlIGEgbm9uc3RhbmRhcmQgcHJlZml4LlxuICAgKi9cbiAgY29uc3RydWN0b3IoXG4gICAgdHJpcGxlOiBUcmlwbGU8QklQMzJJbnRlcmZhY2U+LFxuICAgIHB1YmxpYyByZWFkb25seSBkZXJpdmF0aW9uUHJlZml4ZXM6IFRyaXBsZTxzdHJpbmc+ID0gW1xuICAgICAgUm9vdFdhbGxldEtleXMuZGVmYXVsdFByZWZpeCxcbiAgICAgIFJvb3RXYWxsZXRLZXlzLmRlZmF1bHRQcmVmaXgsXG4gICAgICBSb290V2FsbGV0S2V5cy5kZWZhdWx0UHJlZml4LFxuICAgIF1cbiAgKSB7XG4gICAgc3VwZXIodHJpcGxlKTtcblxuICAgIGRlcml2YXRpb25QcmVmaXhlcy5mb3JFYWNoKChwKSA9PiB7XG4gICAgICBpZiAocC5zdGFydHNXaXRoKCcvJykgfHwgcC5lbmRzV2l0aCgnLycpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgZGVyaXZhdGlvbiBwcmVmaXggbXVzdCBub3Qgc3RhcnQgb3IgZW5kIHdpdGggYSBzbGFzaGApO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwYXJhbSBrZXlcbiAgICogQHBhcmFtIGNoYWluXG4gICAqIEBwYXJhbSBpbmRleFxuICAgKiBAcmV0dXJuIGZ1bGwgZGVyaXZhdGlvbiBwYXRoIGZvciBrZXksIGluY2x1ZGluZyBrZXktc3BlY2lmaWMgcHJlZml4XG4gICAqL1xuICBnZXREZXJpdmF0aW9uUGF0aChrZXk6IEJJUDMySW50ZXJmYWNlLCBjaGFpbjogbnVtYmVyLCBpbmRleDogbnVtYmVyKTogc3RyaW5nIHtcbiAgICBpZiAoIXRoaXMuZGVyaXZhdGlvblByZWZpeGVzKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYG5vIGRlcml2YXRpb24gcHJlZml4ZXNgKTtcbiAgICB9XG4gICAgY29uc3QgcHJlZml4ID0gdGhpcy5kZXJpdmF0aW9uUHJlZml4ZXMuZmluZCgocHJlZml4LCBpKSA9PiBlcVB1YmxpY0tleShrZXksIHRoaXMudHJpcGxlW2ldKSk7XG4gICAgaWYgKHByZWZpeCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGtleSBub3QgaW4gd2FsbGV0S2V5c2ApO1xuICAgIH1cbiAgICByZXR1cm4gYCR7cHJlZml4fS8ke2NoYWlufS8ke2luZGV4fWA7XG4gIH1cblxuICAvKipcbiAgICogQHBhcmFtIGNoYWluXG4gICAqIEBwYXJhbSBpbmRleFxuICAgKiBAcmV0dXJuIHdhbGxldEtleXMgZm9yIGEgcGFydGljdWxhciBhZGRyZXNzIGlkZW50aWZpZWQgYnkgKGNoYWluLCBpbmRleClcbiAgICovXG4gIGRlcml2ZUZvckNoYWluQW5kSW5kZXgoY2hhaW46IG51bWJlciwgaW5kZXg6IG51bWJlcik6IERlcml2ZWRXYWxsZXRLZXlzIHtcbiAgICByZXR1cm4gbmV3IERlcml2ZWRXYWxsZXRLZXlzKFxuICAgICAgdGhpcyxcbiAgICAgIHRoaXMudHJpcGxlLm1hcCgoaykgPT4gdGhpcy5nZXREZXJpdmF0aW9uUGF0aChrLCBjaGFpbiwgaW5kZXgpKSBhcyBUcmlwbGU8c3RyaW5nPlxuICAgICk7XG4gIH1cbn1cbiJdfQ==