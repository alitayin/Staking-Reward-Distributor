const fs = require('fs').promises;
const http = require('http');
const path = require('path');
const configFile = path.resolve(__dirname, '../config.json');

// 定义一个函数来获取 UTXO 数据
const getUTXOs = (proof) => {
  return new Promise((resolve, reject) => {
    http.get(`http://ecashrpc.alitayin.com:3080/getproofstatus?proof=${proof}`, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve(JSON.parse(data));
      });

    }).on('error', (err) => {
      reject(err);
    });
  });
};

async function check() {
  // 从 config.json 读取数据
const configData = await fs.readFile(configFile, 'utf8');
  const config = JSON.parse(configData);
  const proof = config.proof;

  try {
    const utxos = await getUTXOs(proof);
    console.log(utxos);

    const addressInfo = utxos.reduce((info, utxo) => {
      if (!info[utxo.address]) {
        info[utxo.address] = {
          totalAmount: 0,
          isValid: true,
        };
      }

      info[utxo.address].totalAmount += utxo.amount;
      if (utxo.status !== 'valid') {
        info[utxo.address].isValid = false;
      }

      return info;
    }, {});

    const totalAmount = Object.values(addressInfo).reduce((total, info) => total + info.totalAmount, 0);
    config.addresses = [];

    for (const address in addressInfo) {
      config.addresses.push({
        address: address,
        totalAmount: addressInfo[address].totalAmount,
        isValid: addressInfo[address].isValid,
        rewardDistribution: {
          address: "rewardAddress",
          percentage: (addressInfo[address].totalAmount / totalAmount).toFixed(4)
        }
      });
    }

    console.log('Writing to file...');
await fs.writeFile(configFile, JSON.stringify(config, null, 2), 'utf8');
    console.log('Write complete.');

  } catch (err) {
    console.error(err);
  }
}

module.exports = check;
