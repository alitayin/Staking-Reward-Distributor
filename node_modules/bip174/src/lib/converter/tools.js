'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const varuint = require('./varint');
exports.range = n => [...Array(n).keys()];
function reverseBuffer(buffer) {
  if (buffer.length < 1) return buffer;
  let j = buffer.length - 1;
  let tmp = 0;
  for (let i = 0; i < buffer.length / 2; i++) {
    tmp = buffer[i];
    buffer[i] = buffer[j];
    buffer[j] = tmp;
    j--;
  }
  return buffer;
}
exports.reverseBuffer = reverseBuffer;
function keyValsToBuffer(keyVals) {
  const buffers = keyVals.map(keyValToBuffer);
  buffers.push(Buffer.from([0]));
  return Buffer.concat(buffers);
}
exports.keyValsToBuffer = keyValsToBuffer;
function keyValToBuffer(keyVal) {
  const keyLen = keyVal.key.length;
  const valLen = keyVal.value.length;
  const keyVarIntLen = varuint.encodingLength(keyLen);
  const valVarIntLen = varuint.encodingLength(valLen);
  const buffer = Buffer.allocUnsafe(
    keyVarIntLen + keyLen + valVarIntLen + valLen,
  );
  varuint.encode(keyLen, buffer, 0);
  keyVal.key.copy(buffer, keyVarIntLen);
  varuint.encode(valLen, buffer, keyVarIntLen + keyLen);
  keyVal.value.copy(buffer, keyVarIntLen + keyLen + valVarIntLen);
  return buffer;
}
exports.keyValToBuffer = keyValToBuffer;
function verifuint64(value) {
  if (typeof value !== 'bigint')
    throw new Error('cannot write a non-bigint as a number');
  if (value < 0)
    throw new Error('specified a negative value for writing an unsigned value');
  if (value > 0xffffffffffffffff)
    throw new Error('RangeError: value out of range');
}
function readUInt64LE(buffer, offset) {
  const a = BigInt(buffer.readUInt32LE(offset));
  let b = BigInt(buffer.readUInt32LE(offset + 4));
  b *= BigInt(0x100000000);
  verifuint64(b + a);
  return b + a;
}
exports.readUInt64LE = readUInt64LE;
function writeUInt64LE(buffer, value, offset) {
  verifuint64(value);
  buffer.writeUInt32LE(Number(value & BigInt(0xffffffff)), offset);
  buffer.writeUInt32LE(Number(value / BigInt(0x100000000)), offset + 4);
  return offset + 8;
}
exports.writeUInt64LE = writeUInt64LE;
