const fs = require('fs').promises;
const check = require('./utils/checkproof.js');
const checkProofPayout = require('./utils/checkproofpayout.js');

exports.postSubmit = async function(req, res) {
  const configData = await fs.readFile('config.json', 'utf8');
  const config = JSON.parse(configData);
  const proof = req.body.proof;

  config.proof = proof;

  await fs.writeFile('config.json', JSON.stringify(config, null, 2), 'utf8');

  // 运行 check.js 和 checkProofPayout.js
  await check();
  await checkProofPayout();

  res.redirect('/');
};

exports.postEdit = async function(req, res) {
  const configData = await fs.readFile('config.json', 'utf8');
  const config = JSON.parse(configData);
  const newAddresses = req.body.addresses;

  let totalPercentage = 0;
  for (let address of newAddresses) {
    totalPercentage += parseFloat(address.rewardDistribution.percentage);
  }

  if (totalPercentage > 1) {
    res.status(400).send('The total of Reward Distribution Percentage must be less than or equal to 1.');
    return;
  }

  // 只更新 addresses 字段
  config.addresses = newAddresses;

  await fs.writeFile('config.json', JSON.stringify(config, null, 2), 'utf8');

  res.redirect('/');
};
