"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toTNumber = void 0;
/**
 * Convert input to bigint or number.
 * Throws error if input cannot be converted to a safe integer number.
 * @param value - input value
 * @param amountType - desired output type
 * @return value converted to amountType
 */
function toTNumber(value, amountType) {
    if (typeof value === amountType) {
        return value;
    }
    if (value === undefined) {
        throw new Error('input value cannot be undefined');
    }
    if (amountType === 'number') {
        const numberValue = Number(value);
        if (!Number.isSafeInteger(numberValue)) {
            throw new Error('input value cannot be converted to safe integer number');
        }
        return Number(value);
    }
    if (amountType === 'bigint') {
        return BigInt(value);
    }
    throw new Error('amountType must be either "number" or "bigint"');
}
exports.toTNumber = toTNumber;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG51bWJlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9iaXRnby90bnVtYmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBOzs7Ozs7R0FNRztBQUNILFNBQWdCLFNBQVMsQ0FDdkIsS0FBK0IsRUFDL0IsVUFBK0I7SUFFL0IsSUFBSSxPQUFPLEtBQUssS0FBSyxVQUFVLEVBQUU7UUFDL0IsT0FBTyxLQUFnQixDQUFDO0tBQ3pCO0lBQ0QsSUFBSSxLQUFLLEtBQUssU0FBUyxFQUFFO1FBQ3ZCLE1BQU0sSUFBSSxLQUFLLENBQUMsaUNBQWlDLENBQUMsQ0FBQztLQUNwRDtJQUNELElBQUksVUFBVSxLQUFLLFFBQVEsRUFBRTtRQUMzQixNQUFNLFdBQVcsR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDbEMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLEVBQUU7WUFDdEMsTUFBTSxJQUFJLEtBQUssQ0FBQyx3REFBd0QsQ0FBQyxDQUFDO1NBQzNFO1FBQ0QsT0FBTyxNQUFNLENBQUMsS0FBSyxDQUFZLENBQUM7S0FDakM7SUFDRCxJQUFJLFVBQVUsS0FBSyxRQUFRLEVBQUU7UUFDM0IsT0FBTyxNQUFNLENBQUMsS0FBSyxDQUFZLENBQUM7S0FDakM7SUFDRCxNQUFNLElBQUksS0FBSyxDQUFDLGdEQUFnRCxDQUFDLENBQUM7QUFDcEUsQ0FBQztBQXJCRCw4QkFxQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENvbnZlcnQgaW5wdXQgdG8gYmlnaW50IG9yIG51bWJlci5cbiAqIFRocm93cyBlcnJvciBpZiBpbnB1dCBjYW5ub3QgYmUgY29udmVydGVkIHRvIGEgc2FmZSBpbnRlZ2VyIG51bWJlci5cbiAqIEBwYXJhbSB2YWx1ZSAtIGlucHV0IHZhbHVlXG4gKiBAcGFyYW0gYW1vdW50VHlwZSAtIGRlc2lyZWQgb3V0cHV0IHR5cGVcbiAqIEByZXR1cm4gdmFsdWUgY29udmVydGVkIHRvIGFtb3VudFR5cGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRvVE51bWJlcjxUTnVtYmVyIGV4dGVuZHMgbnVtYmVyIHwgYmlnaW50PihcbiAgdmFsdWU6IG51bWJlciB8IGJpZ2ludCB8IHN0cmluZyxcbiAgYW1vdW50VHlwZTogJ251bWJlcicgfCAnYmlnaW50J1xuKTogVE51bWJlciB7XG4gIGlmICh0eXBlb2YgdmFsdWUgPT09IGFtb3VudFR5cGUpIHtcbiAgICByZXR1cm4gdmFsdWUgYXMgVE51bWJlcjtcbiAgfVxuICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IG5ldyBFcnJvcignaW5wdXQgdmFsdWUgY2Fubm90IGJlIHVuZGVmaW5lZCcpO1xuICB9XG4gIGlmIChhbW91bnRUeXBlID09PSAnbnVtYmVyJykge1xuICAgIGNvbnN0IG51bWJlclZhbHVlID0gTnVtYmVyKHZhbHVlKTtcbiAgICBpZiAoIU51bWJlci5pc1NhZmVJbnRlZ2VyKG51bWJlclZhbHVlKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdpbnB1dCB2YWx1ZSBjYW5ub3QgYmUgY29udmVydGVkIHRvIHNhZmUgaW50ZWdlciBudW1iZXInKTtcbiAgICB9XG4gICAgcmV0dXJuIE51bWJlcih2YWx1ZSkgYXMgVE51bWJlcjtcbiAgfVxuICBpZiAoYW1vdW50VHlwZSA9PT0gJ2JpZ2ludCcpIHtcbiAgICByZXR1cm4gQmlnSW50KHZhbHVlKSBhcyBUTnVtYmVyO1xuICB9XG4gIHRocm93IG5ldyBFcnJvcignYW1vdW50VHlwZSBtdXN0IGJlIGVpdGhlciBcIm51bWJlclwiIG9yIFwiYmlnaW50XCInKTtcbn1cbiJdfQ==