/**
 * Convert input to bigint or number.
 * Throws error if input cannot be converted to a safe integer number.
 * @param value - input value
 * @param amountType - desired output type
 * @return value converted to amountType
 */
export declare function toTNumber<TNumber extends number | bigint>(value: number | bigint | string, amountType: 'number' | 'bigint'): TNumber;
//# sourceMappingURL=tnumber.d.ts.map