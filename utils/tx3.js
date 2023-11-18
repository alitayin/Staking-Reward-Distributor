const utxolib = require('@bitgo/utxo-lib');
const ecashaddrjs = require('ecashaddrjs');
const { ChronikClient } = require('chronik-client');
const chronik = new ChronikClient('https://chronik.fabien.cash');
const fs = require('fs');
const path = require('path');
const configFilePath = path.resolve(__dirname, '../config.json');
const config = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
console.log(path.resolve('../config.json'));
require('dotenv').config();


async function getBlockchainInfo() {
  let blockchainInfo;
  try {
    blockchainInfo = await chronik.blockchainInfo();
    console.log(blockchainInfo);
  } catch (error) {
    console.error("Failed to get blockchain info:", error);
  }
  return blockchainInfo;
}

async function getUtxos(address) {
  console.log('getUtxos called with address:', address);
  let hash160;
  try {
    hash160 = addressToHash160(address);
    console.log('Converted address to hash160:', hash160);
  } catch (error) {
    console.error('Error in getUtxos:', error);
    return [];
  }

  try {
    const blockchainInfo = await getBlockchainInfo();
    const currentHeight = blockchainInfo.tipHeight;

    const utxosResponse = await chronik.script('p2pkh', hash160).utxos();

//    console.log('utxosResponse:', utxosResponse);

    const utxos = utxosResponse[0].utxos
      .map(utxo => ({
        txId: utxo.outpoint.txid,
        vout: utxo.outpoint.outIdx,
        value: parseInt(utxo.value),
        blockHeight: utxo.blockHeight,
        isCoinbase: utxo.isCoinbase,
        address: address,
        slpToken: utxo.slpMeta,
      }))
      .filter(utxo => {
        // 如果 UTXO 是 coinbase 交易，并且确认数小于100，则过滤掉它
        if (utxo.isCoinbase && (currentHeight - utxo.blockHeight < 100)) {
          return false;
        }
        return true;
      });

  //  console.log('UTXOs:', utxos);

    return utxos;
  } catch (err) {
    console.log(`Error in chronik.utxos(${hash160})`);
    console.log(err);
    return [];
  }
}

async function createRawXecTransaction() {
  try {
    const addresses = config.addresses;

    const outputs = addresses.map(addr => {
      const rewardAddress = addr.rewardDistribution.address;
      console.log('Reward address:', rewardAddress);
      const amount = 62500000 * addr.rewardDistribution.percentage;

      return {
        address: rewardAddress,
        amount: amount
      };
    });

    const privateKeyWIF = process.env.PRIVATE_KEY_WIF;
    const keyPair = utxolib.ECPair.fromWIF(privateKeyWIF, utxolib.networks.ecash);
    const utxoAddress = process.env.UTXO_ADDRESS;

    const utxos = await getUtxos(utxoAddress);
    if (utxos.length === 0) {
      console.log('No UTXOs found for the given address');
      return;
    }

    const nonSlpUtxos = utxos.filter(utxo => !utxo.slpToken);
    if (nonSlpUtxos.length === 0) {
      console.log('No non-SLP UTXOs found for the given address');
      return;
    }

    nonSlpUtxos.sort((a, b) => b.value - a.value);

    const txb = utxolib.bitgo.createTransactionBuilderForNetwork(utxolib.networks.ecash);
    let totalInputValue = 0;
    let totalOutputValue = outputs.reduce((total, output) => total + output.amount, 0);
    const fee = outputs.length * 300;
    let inputIndex = 0;

    while (totalInputValue < totalOutputValue + fee) {
      if (inputIndex >= nonSlpUtxos.length) {
        throw new Error('Insufficient funds');
      }
      const utxo = nonSlpUtxos[inputIndex];
      txb.addInput(utxo.txId, utxo.vout);

      totalInputValue += utxo.value;
      inputIndex++;
    }

    let legacyUtxoAddress;
    try {
      legacyUtxoAddress = ecashaddrjs.toLegacy(utxoAddress);
    } catch (error) {
      console.error('Error converting utxoAddress:', error);
      return;
    }

    outputs.forEach(({ address, amount }) => {
      const legacyAddress = ecashaddrjs.toLegacy(address);
      txb.addOutput(legacyAddress, amount);
    });

    const changeAmount = totalInputValue - totalOutputValue - fee;
    txb.addOutput(legacyUtxoAddress, changeAmount);

    const hashType = utxolib.Transaction.SIGHASH_ALL | 0x40;
    for (let i = 0; i < inputIndex; i++) {
      const utxo = nonSlpUtxos[i];
      txb.sign(i, keyPair, null, hashType, utxo.value);
    }

    const rawTxHex = txb.build().toHex();
    console.log('Raw transaction hex:', rawTxHex);

    let broadcastResponse;
    try {
      broadcastResponse = await chronik.broadcastTx(rawTxHex);
      if (!broadcastResponse) {
        throw new Error('Empty chronik broadcast response');
      }
    } catch (err) {
      console.log('Error broadcasting tx to chronik client');
      throw err;
    }

    const explorerLink = `https://explorer.e.cash/tx/${broadcastResponse.txid}`;
    const broadcastResult = broadcastResponse.txid;
    console.log('Explorer link:', explorerLink);
    console.log('broadcastResult:', broadcastResult);

    const result = {
      explorerLink,
      broadcastResult,
    };

    return result;

  } catch (error) {
    console.error('Error:', error);
  }
}
 

function addressToHash160(address) {
  const legacyAddress = ecashaddrjs.toLegacy(address);
  const { hash } = utxolib.address.fromBase58Check(legacyAddress);
  return hash.toString('hex');
}

module.exports = {
    createRawXecTransaction,
  };

