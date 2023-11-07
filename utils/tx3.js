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
    const utxosResponse = await chronik.script('p2pkh', hash160).utxos();

    // 打印 utxosResponse 以检查数据结构
    console.log('utxosResponse:', utxosResponse);

    const utxos = utxosResponse[0].utxos.map(utxo => ({
      txId: utxo.outpoint.txid,
      vout: utxo.outpoint.outIdx,
      value: parseInt(utxo.value),
      address: address,
      slpToken: utxo.slpMeta,
    }));
    return utxos;
  } catch (err) {
    console.log(`Error in chronik.utxos(${hash160})`);
    console.log(err);
    return [];
  }
}

async function createRawXecTransaction(outputs) {
 try {

  const privateKeyWIF = process.env.PRIVATE_KEY_WIF;
  const keyPair = utxolib.ECPair.fromWIF(privateKeyWIF, utxolib.networks.ecash);
  const utxoAddress = process.env.UTXO_ADDRESS;

  // 从 getUtxos 函数获取 UTXO
  const utxos = await getUtxos(utxoAddress);
  if (utxos.length === 0) {
    console.log('No UTXOs found for the given address');
    return;
  }

  // 筛选非 SLP 的 UTXO
  const nonSlpUtxos = utxos.filter(utxo => !utxo.slpToken);
    // 如果没有非 SLP 的 UTXO，返回
    if (nonSlpUtxos.length === 0) {
        console.log('No non-SLP UTXOs found for the given address');
        return;
      }

      // 选择最大的 UTXO
    const utxo = nonSlpUtxos.reduce((max, current) => (current.value > max.value ? current : max));

    const txb = utxolib.bitgo.createTransactionBuilderForNetwork(utxolib.networks.ecash);

    txb.addInput(utxo.txId, utxo.vout);
        // 尝试将 utxoAddress 转换为遗留格式，并捕获可能的错误


 const addresses = config.addresses;

const outputs = addresses.map(addr => {
  const rewardAddress = addr.rewardDistribution.address;
// 450 sats for fee
  const amount = Math.round((utxo.value - 450) * addr.rewardDistribution.percentage);
  
  console.log('Reward address:', rewardAddress, ' Amount:', amount);  // 打印 rewardAddress

 
  
  return {
    address: rewardAddress,
    amount: amount
  };
});

outputs.forEach(({ address, amount }) => {
  const legacyAddress = ecashaddrjs.toLegacy(address);
  txb.addOutput(legacyAddress, amount);
});




          // 签名输入
          const hashType = utxolib.Transaction.SIGHASH_ALL | 0x40;
          txb.sign(0, keyPair, null, hashType, utxo.value);
            // 构建交易并获取原始交易的十六进制表示形式
      const rawTxHex = txb.build().toHex();
      console.log('Raw transaction hex:', rawTxHex);

      // 广播交易
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

      // 返回广播交易的浏览器链接
      const explorerLink = `https://explorer.e.cash/tx/${broadcastResponse.txid}`;
      const broadcastResult = broadcastResponse.txid;
      console.log('Explorer link:', explorerLink);
      console.log('broadcastResult:', broadcastResult);

      // 构建返回结果对象
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

