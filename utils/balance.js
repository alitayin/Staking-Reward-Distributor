const { ChronikClient } = require('chronik-client');
const chronik = new ChronikClient('https://chronik.be.cash/xec');
const ecashaddr = require('ecashaddrjs');
const utxolib = require('@bitgo/utxo-lib');

function addressToHash160(address) {
  const legacyAddress = ecashaddr.toLegacy(address);
  const { hash } = utxolib.address.fromBase58Check(legacyAddress);
  return hash.toString('hex');
}

async function getBalance(address) {
  /* Decode address to determine type */
  let { prefix, type, hash } = ecashaddr.decode(address);

  /* Convert address to hash160 */
  const hash160 = addressToHash160(address);
  let utxos;
  try {
      /* Query UTXOs based on address type */
      utxos = await chronik.script(type.toLowerCase(), hash160).utxos();
/* If there are no UTXOs for this address, return balance of 0 */
if (!utxos || !utxos[0] || !utxos[0].utxos || utxos[0].utxos.length === 0) {
  return 0;
}

      /* Calculate balance */
      let balance = 0;
      for (let utxo of utxos[0].utxos) {
        balance += parseInt(utxo.value);
      }
      /* Convert balance from satoshis to bitcoin */
      balance = balance / 100;
      return balance;
  } catch (err) {
      throw err; //将错误抛出，以使调用者知道出了错误
  }
}

module.exports = { getBalance }; // 将getBalance函数导出以便在其他文件中使用
