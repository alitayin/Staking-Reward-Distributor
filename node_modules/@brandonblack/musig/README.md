# MuSig in TypeScript

Zero dependency implementation of the [MuSig Spec](https://github.com/ElementsProject/secp256k1-zkp/blob/master/doc/musig-spec.mediawiki).

Similar to [bitcoinjs/BIP32](https://github.com/bitcoinjs/bip32), requires a
user injected secp256k1 implementation. Two examples provided in
`test/utils.ts`.

Works with ECMAScript 2019 if you provide a complete implementation of the
Crypto interface. If you want to use `base_crypto` as `test/utils.ts` does,
then requires ECMAScript 2020 BigInt.

# Usage

```shell
npm i
npm run test # runs build
npm run bench
```

This example uses `Buffer` for convenience, but it is not required, any
`Uint8Array` will do.

```typescript
import { MuSigFactory, Nonce } from '.';
import { tinyCrypto } from './test/utils';
import * as tiny from 'tiny-secp256k1';

const musig = MuSigFactory(tinyCrypto);

const fromHex = (hex: string): Uint8Array => Buffer.from(hex, 'hex');
const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');
const secretKey1 = fromHex('be01d8dcf3879a0fec05130ca95d35bf7823833e3cdf91e310408606717055d9');
const pubKey1 = fromHex('648c0c80c8520875c22a1cf31cd718b72a50e381731bc7f8efec9944074cb21b');
const secretKey2 = fromHex('644b07a5cb70f68316cd9a51cabdc61c4d0b1f38b189d0c92370a3844fd0241f');
const pubKey2 = fromHex('8c9444613a1bb8b442b81cc7fbf81a186a34d7c4e596362543e17dde3efdc4b3');
const tweak = fromHex('8df63a82e5e71884bb16e2896e12ba2b7fe0e670d466be03b578fc435d5c9876');

const { publicKey, keyAggSession } = musig.keyAgg(
  [pubKey1, pubKey2],
  { tweaks: [tweak], tweaksXOnly: [true] }
);

const msg = fromHex('f1d1d6ef2d97319149aaed92c69ebb21d6c54c0fc4e908f4f4ee42a1e5b8b854');

// Signing round 1 - generate nonces, share public nonces

const nonce1: { secretNonce?: Uint8Array, publicNonce: Uint8Array } = musig.nonceGen({
  sessionId: fromHex('0000000000000000000000000000000000000000000000000000000000000001'),
  secretKey: secretKey1,
  msg,
  publicKey,
});

const nonce2: { secretNonce?: Uint8Array, publicNonce: Uint8Array } = musig.nonceGen({
  sessionId: fromHex('0000000000000000000000000000000000000000000000000000000000000001'),
  secretKey: secretKey2,
  msg,
  publicKey,
});

const sharedPublicNonces = [nonce1.publicNonce, nonce2.publicNonce];

const aggNonce = musig.nonceAgg(sharedPublicNonces);

// Signing round 2 - generate and share partial sigs, verify and aggregate

const { sig: sig1, signingSession: signingSession1 } = musig.partialSign({
  msg,
  secretKey: secretKey1,
  nonce: nonce1 as Nonce,
  aggNonce,
  keyAggSession
});
delete nonce1.secretNonce;

const { sig: sig2, signingSession: signingSession2 } = musig.partialSign({
  msg,
  secretKey: secretKey2,
  nonce: nonce2 as Nonce,
  aggNonce,
  keyAggSession
});
delete nonce2.secretNonce;

const sharedSigs = [sig1, sig2];

const check2By1 = musig.partialVerify({
  sig: sharedSigs[1],
  msg,
  publicKey: pubKey2,
  publicNonce: sharedPublicNonces[1],
  aggNonce,
  keyAggSession,
  signingSession: signingSession1 // Optional
});

const check1By2 = musig.partialVerify({
  sig: sharedSigs[0],
  msg,
  publicKey: pubKey1,
  publicNonce: sharedPublicNonces[0],
  aggNonce,
  keyAggSession,
  signingSession: signingSession2 // Optional
});

console.log(`check2By1: ${!!check2By1}, check1By2: ${!!check1By2}`);

const signingSession = musig.createSigningSession(aggNonce, msg, keyAggSession);
// All of the signing sessions are interchangeable, and derived from public information
const sig = musig.signAgg(sharedSigs, signingSession);

console.log(toHex(sig));
// 13a8d88bb5727fe945293f81f0f1000eecb8ded5ca950bcfb74d6536d456372b9ae00ccb9cbacc00a3bca07129920b88d4df4f5c24ece1f7159ff94c1dde1bba

const valid = tiny.verifySchnorr(msg, publicKey, sig);
console.log(`final sig valid: ${valid}`);
```
