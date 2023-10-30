/// <reference types="node" />
/**
 * Key (as in Key-Value pair)
 * https://github.com/bitcoin/bips/blob/master/bip-0174.mediawiki#proprietary-use-type
 * Note: bip174 doesn't mention encoding of identifier. So js supported encodings are used here.
 */
export interface ProprietaryKey {
    identifier: string;
    subtype: number;
    keydata: Buffer;
    identifierEncoding?: BufferEncoding;
}
/**
 * Encodes PSBT Proprietary key
 * 0xFC = proprietary key type.
 * @param keyParams.identifier can be any string that will be converted to byte array with identifierEncoding.
 * @param keyParams.identifierEncoding identifierEncoding for identifier string to byte array. Default is utf8.
 * @param keyParams.subtype user defined type number
 * @param keyParams.keydata keydata
 * @return 0xFC<compact size uint identifier length><bytes identifier><compact size uint subtype><bytes subkeydata>
 */
export declare function encodeProprietaryKey(keyParams: ProprietaryKey): Buffer;
/**
 * Decodes PSBT Proprietary key
 * 0xFC = proprietary key type.
 * @param 0xFC<compact size uint identifier length><bytes identifier><compact size uint subtype><bytes subkeydata>
 * @param identifierEncoding encoding for identifier byte array to string conversion. Default is utf8.
 * @return identifier, subtype, keydata, identifierEncoding
 */
export declare function decodeProprietaryKey(key: Buffer, identifierEncoding?: BufferEncoding): ProprietaryKey;
