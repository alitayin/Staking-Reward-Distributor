const fs = require('fs');
const http = require('http');

// 从 config.json 读取数据
const config = JSON.parse(fs.readFileSync('../config.json', 'utf8'));
const proof = config.proof;

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

getUTXOs(proof).then((utxos) => {
  console.log(utxos);  // 添加这行来查看 utxos

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

  // 计算所有地址的总余额
  const totalAmount = Object.values(addressInfo).reduce((total, info) => total + info.totalAmount, 0);
  // 清空 addresses 数组
  config.addresses = [];

  // 将新的地址信息添加到 addresses 数组中
  for (const address in addressInfo) {
    config.addresses.push({
      address: address,
      totalAmount: addressInfo[address].totalAmount,
      isValid: addressInfo[address].isValid,
      rewardDistribution: {
        address: "rewardAddress",  // 这里你可以根据你的需要替换为实际的值
        percentage: (addressInfo[address].totalAmount / totalAmount).toFixed(4)  // 计算 percentage and keep 4 decimal places
      }
    });
  }

  // 将更新后的 config 写回文件
  console.log('Writing to file...');
  fs.writeFileSync('config.json', JSON.stringify(config, null, 2), 'utf8');
  console.log('Write complete.');

}).catch((err) => {
  console.error(err);
});
