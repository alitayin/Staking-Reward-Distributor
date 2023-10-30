'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const varuint = require('./converter/varint');
/**
 * Encodes PSBT Proprietary key
 * 0xFC = proprietary key type.
 * @param keyParams.identifier can be any string that will be converted to byte array with identifierEncoding.
 * @param keyParams.identifierEncoding identifierEncoding for identifier string to byte array. Default is utf8.
 * @param keyParams.subtype user defined type number
 * @param keyParams.keydata keydata
 * @return 0xFC<compact size uint identifier length><bytes identifier><compact size uint subtype><bytes subkeydata>
 */
function encodeProprietaryKey(keyParams) {
  const identifier = Buffer.from(
    keyParams.identifier,
    keyParams.identifierEncoding,
  );
  const identifierBytesLen = identifier.length;
  const identifierBytesVarIntLen = varuint.encodingLength(identifierBytesLen);
  const subtypeVarIntLen = varuint.encodingLength(keyParams.subtype);
  const keydataLen = keyParams.keydata.length;
  const buffer = Buffer.allocUnsafe(
    1 +
      identifierBytesVarIntLen +
      identifierBytesLen +
      subtypeVarIntLen +
      keydataLen,
  );
  let offset = 0;
  buffer.writeUInt8(0xfc, offset);
  offset += 1;
  varuint.encode(identifierBytesLen, buffer, offset);
  offset += identifierBytesVarIntLen;
  identifier.copy(buffer, offset);
  offset += identifierBytesLen;
  varuint.encode(keyParams.subtype, buffer, offset);
  offset += subtypeVarIntLen;
  keyParams.keydata.copy(buffer, offset);
  return buffer;
}
exports.encodeProprietaryKey = encodeProprietaryKey;
/**
 * Decodes PSBT Proprietary key
 * 0xFC = proprietary key type.
 * @param 0xFC<compact size uint identifier length><bytes identifier><compact size uint subtype><bytes subkeydata>
 * @param identifierEncoding encoding for identifier byte array to string conversion. Default is utf8.
 * @return identifier, subtype, keydata, identifierEncoding
 */
function decodeProprietaryKey(key, identifierEncoding) {
  if (key.length === 0 || key[0] !== 0xfc) {
    throw new Error(`Invalid proprietary key format found while decoding`);
  }
  let offset = 1;
  const identifierBytesLen = varuint.decode(key, offset);
  offset += varuint.encodingLength(identifierBytesLen);
  const identifier = key
    .slice(offset, offset + identifierBytesLen)
    .toString(identifierEncoding);
  offset += identifierBytesLen;
  const subtype = varuint.decode(key, offset);
  offset += varuint.encodingLength(subtype);
  const keydata = key.slice(offset);
  return { identifier, subtype, keydata, identifierEncoding };
}
exports.decodeProprietaryKey = decodeProprietaryKey;
