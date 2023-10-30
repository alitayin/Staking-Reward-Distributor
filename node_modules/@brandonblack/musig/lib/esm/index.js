/*! musig-js - MIT License (c) 2022 Brandon Black */
const TAGS = {
  challenge: 'BIP0340/challenge',
  keyagg_list: 'KeyAgg list',
  keyagg_coef: 'KeyAgg coefficient',
  musig_aux: 'MuSig/aux',
  musig_nonce: 'MuSig/nonce',
  musig_deterministic_nonce: 'MuSig/deterministic/nonce',
  musig_noncecoef: 'MuSig/noncecoef',
};
function compare32b(a, b) {
  if (a.length !== 32 || b.length !== 32) throw new Error('Invalid array');
  const aD = new DataView(a.buffer, a.byteOffset, a.length);
  const bD = new DataView(b.buffer, b.byteOffset, b.length);
  for (let i = 0; i < 8; i++) {
    const cmp = aD.getUint32(i * 4) - bD.getUint32(i * 4);
    if (cmp !== 0) return cmp;
  }
  return 0;
}
function compare33b(a, b) {
  if (a.length !== 33 || b.length !== 33) throw new Error('Invalid array');
  const cmp = a[0] - b[0];
  if (cmp !== 0) return cmp;
  return compare32b(a.subarray(1), b.subarray(1));
}
const makeSessionId =
  typeof self === 'object' && (self.crypto || self.msCrypto)
    ? () => (self.crypto || self.msCrypto).getRandomValues(new Uint8Array(32))
    : () => require('crypto').randomBytes(32);
const _keyAggCache = new WeakMap();
const _coefCache = new WeakMap();
const _nonceCache = new WeakMap();
const _sessionCache = new WeakMap();
export function MuSigFactory(ecc) {
  const CPOINT_INF = new Uint8Array(33);
  const SCALAR_0 = new Uint8Array(32);
  const SCALAR_1 = new Uint8Array(32);
  SCALAR_1[31] = 1;
  const SCALAR_MINUS_1 = ecc.scalarNegate(SCALAR_1);
  function keyAggCoeff(publicKeys, publicKey) {
    let coefCache = _coefCache.get(publicKeys);
    if (coefCache === undefined) {
      coefCache = new Map();
      _coefCache.set(publicKeys, coefCache);
    }
    let coefficient = coefCache.get(publicKey);
    if (coefficient) return coefficient;
    coefficient = SCALAR_1;
    let secondPublicKey;
    let publicKeyHash;
    let keyAggCache = _keyAggCache.get(publicKeys);
    if (keyAggCache === undefined) {
      const pkIdx2 = publicKeys.findIndex((pk) => compare33b(pk, publicKeys[0]) !== 0);
      secondPublicKey = publicKeys[pkIdx2];
      publicKeyHash = ecc.taggedHash(TAGS.keyagg_list, ...publicKeys);
      keyAggCache = { publicKeyHash, secondPublicKey };
      _keyAggCache.set(publicKeys, keyAggCache);
    } else {
      ({ publicKeyHash, secondPublicKey } = keyAggCache);
    }
    if (secondPublicKey === undefined || compare33b(publicKey, secondPublicKey) !== 0)
      coefficient = ecc.taggedHash(TAGS.keyagg_coef, publicKeyHash, publicKey);
    coefCache.set(publicKey, coefficient);
    return coefficient;
  }
  function addTweak(ctx, t) {
    const tweak = 'tweak' in t ? t : { tweak: t };
    if (!ecc.isScalar(tweak.tweak))
      throw new TypeError('Expected tweak to be a valid scalar with curve order');
    let { gacc, tacc } = ctx;
    let aggPublicKey = ctx.aggPublicKey;
    if (!ecc.hasEvenY(aggPublicKey) && tweak.xOnly) {
      gacc = ecc.scalarNegate(gacc);
      tacc = ecc.scalarNegate(tacc);
      aggPublicKey = ecc.pointNegate(aggPublicKey);
    }
    aggPublicKey = ecc.pointAddTweak(aggPublicKey, tweak.tweak, false);
    if (aggPublicKey === null) throw new Error('Unexpected point at infinity during tweaking');
    tacc = ecc.scalarAdd(tweak.tweak, tacc);
    return { aggPublicKey, gacc, tacc };
  }
  function keyAgg(publicKeys, ...tweaks) {
    checkArgs({ publicKeys });
    const multipliedPublicKeys = publicKeys.map((publicKey) => {
      const coefficient = keyAggCoeff(publicKeys, publicKey);
      let multipliedPublicKey;
      if (compare32b(coefficient, SCALAR_1) === 0) {
        multipliedPublicKey = publicKey;
      } else {
        multipliedPublicKey = ecc.pointMultiplyUnsafe(publicKey, coefficient, false);
      }
      if (multipliedPublicKey === null) throw new Error('Point at infinity during aggregation');
      return multipliedPublicKey;
    });
    const aggPublicKey = multipliedPublicKeys.reduce((a, b) => {
      const next = ecc.pointAdd(a, b, false);
      if (next === null) throw new Error('Point at infinity during aggregation');
      return next;
    });
    return tweaks.reduce((ctx, tweak) => addTweak(ctx, tweak), {
      aggPublicKey,
      gacc: SCALAR_1,
      tacc: SCALAR_0,
    });
  }
  function getSessionValues(sessionKey) {
    const sessionValues = _sessionCache.get(sessionKey);
    if (!sessionValues) throw new Error('Invalid session key, please call `startSigningSession`');
    return sessionValues;
  }
  function nonceAgg(publicNonces) {
    checkArgs({ publicNonces });
    const aggNonces = [publicNonces[0].subarray(0, 33), publicNonces[0].subarray(33)];
    for (let i = 1; i < publicNonces.length; i++) {
      if (aggNonces[0] !== null)
        aggNonces[0] = ecc.pointAdd(aggNonces[0], publicNonces[i].subarray(0, 33), false);
      if (aggNonces[1] !== null)
        aggNonces[1] = ecc.pointAdd(aggNonces[1], publicNonces[i].subarray(33), false);
    }
    const aggNonce = new Uint8Array(66);
    if (aggNonces[0] !== null) aggNonce.set(ecc.pointCompress(aggNonces[0]), 0);
    if (aggNonces[1] !== null) aggNonce.set(ecc.pointCompress(aggNonces[1]), 33);
    return aggNonce;
  }
  function startSigningSessionInner(aggNonce, msg, publicKeys, ctx) {
    const pubKeyX = ecc.pointX(ctx.aggPublicKey);
    const coefficient = ecc.taggedHash(TAGS.musig_noncecoef, aggNonce, pubKeyX, msg);
    const aggNonces = [aggNonce.subarray(0, 33), aggNonce.subarray(33)];
    let r = null;
    if (compare33b(aggNonces[1], CPOINT_INF) !== 0 && compare33b(aggNonces[0], CPOINT_INF) !== 0) {
      r = ecc.pointMultiplyAndAddUnsafe(aggNonces[1], coefficient, aggNonces[0], false);
    } else if (compare33b(aggNonces[0], CPOINT_INF) !== 0) {
      r = ecc.pointCompress(aggNonces[0], false);
    } else if (compare33b(aggNonces[1], CPOINT_INF) !== 0) {
      r = ecc.pointMultiplyUnsafe(aggNonces[1], coefficient, false);
    }
    if (r === null) r = ecc.getPublicKey(SCALAR_1, false);
    if (r === null) throw new Error('Failed to get G');
    const challenge = ecc.scalarMod(ecc.taggedHash(TAGS.challenge, ecc.pointX(r), pubKeyX, msg));
    const key = { publicKey: ctx.aggPublicKey, aggNonce, msg };
    _sessionCache.set(key, { ...ctx, coefficient, challenge, finalNonce: r, publicKeys });
    return key;
  }
  function partialVerifyInner({ sig, publicKey, publicNonces, sessionKey }) {
    const { msg } = sessionKey;
    const { aggPublicKey, gacc, challenge, coefficient, finalNonce, publicKeys } =
      getSessionValues(sessionKey);
    const rePrime = ecc.pointMultiplyAndAddUnsafe(
      publicNonces[1],
      coefficient,
      publicNonces[0],
      false
    );
    if (rePrime === null) throw new Error('Unexpected public nonce at infinity');
    const re = ecc.hasEvenY(finalNonce) ? rePrime : ecc.pointNegate(rePrime);
    const a = keyAggCoeff(publicKeys, publicKey);
    const g = ecc.hasEvenY(aggPublicKey) ? gacc : ecc.scalarNegate(gacc);
    const ea = ecc.scalarMultiply(challenge, a);
    const eag = ecc.scalarMultiply(ea, g);
    const ver = ecc.pointMultiplyAndAddUnsafe(publicKey, eag, re, true);
    if (ver === null) throw new Error('Unexpected verification point at infinity');
    const sG = ecc.getPublicKey(sig, true);
    if (sG === null) throw new Error('Unexpected signature point at infinity');
    return compare33b(ver, sG) === 0;
  }
  function partialSignInner({ secretKey, publicKey, secretNonces, sessionKey }) {
    const { msg } = sessionKey;
    const { aggPublicKey, gacc, challenge, coefficient, finalNonce, publicKeys } =
      getSessionValues(sessionKey);
    const [k1, k2] = secretNonces.map((k) => (ecc.hasEvenY(finalNonce) ? k : ecc.scalarNegate(k)));
    const a = keyAggCoeff(publicKeys, publicKey);
    const g = ecc.hasEvenY(aggPublicKey) ? gacc : ecc.scalarNegate(gacc);
    const d = ecc.scalarMultiply(g, secretKey);
    const bk2 = ecc.scalarMultiply(coefficient, k2);
    const k1bk2 = ecc.scalarAdd(k1, bk2);
    const ea = ecc.scalarMultiply(challenge, a);
    const ead = ecc.scalarMultiply(ea, d);
    const sig = ecc.scalarAdd(k1bk2, ead);
    return sig;
  }
  function partialSign({ secretKey, publicNonce, sessionKey, verify = true }) {
    checkArgs({ publicNonce, secretKey });
    const secretNonce = _nonceCache.get(publicNonce);
    if (secretNonce === undefined)
      throw new Error('No secret nonce found for specified public nonce');
    _nonceCache.delete(publicNonce);
    const publicKey = ecc.getPublicKey(secretKey, true);
    if (publicKey === null) throw new Error('Invalid secret key, no corresponding public key');
    if (compare33b(publicKey, secretNonce.subarray(64)) !== 0)
      throw new Error('Secret nonce pubkey mismatch');
    const secretNonces = [secretNonce.subarray(0, 32), secretNonce.subarray(32, 64)];
    const sig = partialSignInner({
      secretKey,
      publicKey,
      secretNonces,
      sessionKey,
    });
    if (verify) {
      const publicNonces = [publicNonce.subarray(0, 33), publicNonce.subarray(33)];
      const valid = partialVerifyInner({
        sig,
        publicKey,
        publicNonces,
        sessionKey,
      });
      if (!valid) throw new Error('Partial signature failed verification');
    }
    return sig;
  }
  function deterministicSign({
    secretKey,
    aggOtherNonce,
    publicKeys,
    tweaks = [],
    msg,
    rand,
    verify = true,
    nonceOnly = false,
  }) {
    checkArgs({ rand, secretKey, aggOtherNonce });
    const publicKey = ecc.getPublicKey(secretKey, true);
    if (publicKey === null) throw new Error('Secret key has no corresponding public key');
    let secretKeyPrime;
    if (rand !== undefined) {
      secretKeyPrime = ecc.taggedHash(TAGS.musig_aux, rand);
      for (let i = 0; i < 32; i++) {
        secretKeyPrime[i] = secretKeyPrime[i] ^ secretKey[i];
      }
    } else {
      secretKeyPrime = secretKey;
    }
    const ctx = keyAgg(publicKeys, ...tweaks);
    const aggPublicKey = ecc.pointX(ctx.aggPublicKey);
    const mLength = new Uint8Array(8);
    new DataView(mLength.buffer).setBigUint64(0, BigInt(msg.length));
    const secretNonce = new Uint8Array(97);
    const publicNonce = new Uint8Array(66);
    for (let i = 0; i < 2; i++) {
      const kH = ecc.taggedHash(
        TAGS.musig_deterministic_nonce,
        ...[secretKeyPrime, aggOtherNonce, aggPublicKey, mLength, msg, Uint8Array.of(i)]
      );
      const k = ecc.scalarMod(kH);
      if (compare32b(SCALAR_0, k) === 0) throw new Error('0 secret nonce');
      const pub = ecc.getPublicKey(k, true);
      if (pub === null) throw new Error('Secret nonce has no corresponding public nonce');
      secretNonce.set(k, i * 32);
      publicNonce.set(pub, i * 33);
    }
    secretNonce.set(publicKey, 64);
    if (nonceOnly) return { publicNonce };
    _nonceCache.set(publicNonce, secretNonce);
    const aggNonce = nonceAgg([aggOtherNonce, publicNonce]);
    const sessionKey = startSigningSessionInner(aggNonce, msg, publicKeys, ctx);
    const sig = partialSign({
      secretKey,
      publicNonce,
      sessionKey,
      verify,
    });
    return { sig, sessionKey, publicNonce };
  }
  const pubKeyArgs = ['publicKey', 'publicKeys'];
  const scalarArgs = ['tweak', 'sig', 'sigs', 'tacc', 'gacc'];
  const otherArgs32b = ['xOnlyPublicKey', 'rand', 'sessionId'];
  const args32b = ['secretKey', ...scalarArgs, ...otherArgs32b];
  const pubNonceArgs = ['publicNonce', 'publicNonces', 'aggNonce', 'aggOtherNonce', 'finalNonce'];
  const otherArgs = ['aggPublicKey', 'secretNonce'];
  const argLengths = new Map();
  args32b.forEach((a) => argLengths.set(a, 32));
  pubKeyArgs.forEach((a) => argLengths.set(a, 33));
  pubNonceArgs.forEach((a) => argLengths.set(a, 66));
  argLengths.set('secretNonce', 97);
  argLengths.set('aggPublicKey', 65);
  const scalarNames = new Set();
  scalarArgs.forEach((n) => scalarNames.add(n));
  function checkArgs(args) {
    for (let [name, values] of Object.entries(args)) {
      if (values === undefined) continue;
      values = Array.isArray(values) ? values : [values];
      if (values.length === 0) throw new TypeError(`0-length ${name}s not supported`);
      for (const value of values) {
        if (argLengths.get(name) !== value.length)
          throw new TypeError(`Invalid ${name} length (${value.length})`);
        if (name === 'secretKey') {
          if (!ecc.isSecret(value)) throw new TypeError(`Invalid secretKey`);
        } else if (name === 'secretNonce') {
          for (let i = 0; i < 64; i += 32)
            if (!ecc.isSecret(value.subarray(i, i + 32)))
              throw new TypeError(`Invalid secretNonce`);
        } else if (scalarNames.has(name)) {
          for (let i = 0; i < value.length; i += 32)
            if (!ecc.isScalar(value.subarray(i, i + 32))) throw new TypeError(`Invalid ${name}`);
        }
      }
    }
  }
  return {
    getXOnlyPubkey: (ctx) => {
      if ('aggPublicKey' in ctx) return ecc.pointX(ctx.aggPublicKey);
      return ecc.pointX(getSessionValues(ctx).aggPublicKey);
    },
    getPlainPubkey: (ctx) => {
      if ('aggPublicKey' in ctx) return ecc.pointCompress(ctx.aggPublicKey);
      return ecc.pointCompress(getSessionValues(ctx).aggPublicKey);
    },
    keySort: (publicKeys) => {
      checkArgs({ publicKeys });
      return [...publicKeys].sort((a, b) => compare33b(a, b));
    },
    keyAgg,
    addTweaks: (ctx, ...tweaks) => {
      checkArgs(ctx);
      return tweaks.reduce((c, tweak) => addTweak(c, tweak), ctx);
    },
    nonceGen: ({
      sessionId = makeSessionId(),
      secretKey,
      publicKey,
      xOnlyPublicKey,
      msg,
      extraInput,
    }) => {
      if (extraInput !== undefined && extraInput.length > Math.pow(2, 32) - 1)
        throw new TypeError('extraInput is limited to 2^32-1 bytes');
      checkArgs({ sessionId, secretKey, publicKey, xOnlyPublicKey });
      let rand;
      if (secretKey !== undefined) {
        rand = ecc.taggedHash(TAGS.musig_aux, sessionId);
        for (let i = 0; i < 32; i++) {
          rand[i] = rand[i] ^ secretKey[i];
        }
      } else {
        rand = sessionId;
      }
      if (xOnlyPublicKey === undefined) xOnlyPublicKey = new Uint8Array();
      const mPrefixed = [Uint8Array.of(0)];
      if (msg !== undefined) {
        mPrefixed[0][0] = 1;
        mPrefixed.push(new Uint8Array(8));
        new DataView(mPrefixed[1].buffer).setBigUint64(0, BigInt(msg.length));
        mPrefixed.push(msg);
      }
      if (extraInput === undefined) extraInput = new Uint8Array();
      const eLength = new Uint8Array(4);
      new DataView(eLength.buffer).setUint32(0, extraInput.length);
      const secretNonce = new Uint8Array(97);
      const publicNonce = new Uint8Array(66);
      for (let i = 0; i < 2; i++) {
        const kH = ecc.taggedHash(
          TAGS.musig_nonce,
          rand,
          Uint8Array.of(publicKey.length),
          publicKey,
          Uint8Array.of(xOnlyPublicKey.length),
          xOnlyPublicKey,
          ...mPrefixed,
          eLength,
          extraInput,
          Uint8Array.of(i)
        );
        const k = ecc.scalarMod(kH);
        if (compare32b(SCALAR_0, k) === 0) throw new Error('0 secret nonce');
        const pub = ecc.getPublicKey(k, true);
        if (pub === null) throw new Error('Secret nonce has no corresponding public nonce');
        secretNonce.set(k, i * 32);
        publicNonce.set(pub, i * 33);
      }
      secretNonce.set(publicKey, 64);
      _nonceCache.set(publicNonce, secretNonce);
      return publicNonce;
    },
    addExternalNonce: (publicNonce, secretNonce) => {
      checkArgs({ publicNonce, secretNonce });
      _nonceCache.set(publicNonce, secretNonce);
    },
    deterministicNonceGen: (args) => deterministicSign({ ...args, nonceOnly: true }),
    deterministicSign,
    nonceAgg,
    startSigningSession: (aggNonce, msg, publicKeys, ...tweaks) => {
      checkArgs({ aggNonce });
      const ctx = keyAgg(publicKeys, ...tweaks);
      return startSigningSessionInner(aggNonce, msg, publicKeys, ctx);
    },
    partialSign,
    partialVerify: ({ sig, publicKey, publicNonce, sessionKey }) => {
      checkArgs({ sig, publicKey, publicNonce });
      const publicNonces = [publicNonce.subarray(0, 33), publicNonce.subarray(33)];
      const valid = partialVerifyInner({
        sig,
        publicKey,
        publicNonces,
        sessionKey,
      });
      return valid;
    },
    signAgg: (sigs, sessionKey) => {
      checkArgs({ sigs });
      const { aggPublicKey, tacc, challenge, finalNonce } = getSessionValues(sessionKey);
      let sPart = ecc.scalarMultiply(challenge, tacc);
      if (!ecc.hasEvenY(aggPublicKey)) {
        sPart = ecc.scalarNegate(sPart);
      }
      const aggS = sigs.reduce((a, b) => ecc.scalarAdd(a, b), sPart);
      const sig = new Uint8Array(64);
      sig.set(ecc.pointX(finalNonce), 0);
      sig.set(aggS, 32);
      return sig;
    },
  };
}
