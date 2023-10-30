const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const check = require('./utils/checkproof.js');
const checkProofPayout = require('./utils/checkproofpayout.js');
const { getBalance } = require('./utils/balance.js');
const { createRawXecTransaction } = require('./utils/tx3.js');
const getStatus = require('./utils/status.js');

setInterval(async () => {
  try {
    // 从config.json文件中获取payoutAddress
    const configData = await fs.readFile('config.json', 'utf8');
    const config = JSON.parse(configData);
    const payoutAddress = config.payoutAddress;

    console.log('Payout address:', payoutAddress);  // 打印出地址

    // 获取余额
    const balance = await getBalance(payoutAddress);

    console.log('Balance:', balance);  // 打印出余额

    // 如果余额大于625000，发送交易
    if (balance > 625000) {
      console.log('Balance is greater than 6250, sending transaction...');
      
      // 获取状态
      const status = await getStatus();

      // 只有在 isValid 为 true 时才执行交易
      if (status.isValid) {
        const result = await createRawXecTransaction();
        console.log('Transaction result:', result);
      } else {
        console.log('Transaction cannot be processed because the status is invalid.');
      }
    }
  } catch (error) {
    console.error('Error in balance check interval:', error);
  }
}, 10 * 1000);  // 每分钟检查一次

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', async (req, res) => {
  let config;
  try {
    const configData = await fs.readFile('config.json', 'utf8');
    config = JSON.parse(configData);
  } catch (err) {
    console.error(err);
    config = { addresses: [] };
  }

 let totalPercentage = config.addresses.reduce((total, address) => total + parseFloat(address.rewardDistribution.percentage), 0);

  // 生成表格内容
  let tableRows = config.addresses.map((address) =>
    `<tr>
      <td>${address.address}</td>
      <td>${address.totalAmount}</td>
      <td>${address.isValid}</td>
      <td>${address.rewardDistribution.address}</td>
      <td>${address.rewardDistribution.percentage}</td>
    </tr>`).join('\n');

let editInputs = config.addresses.map((address, index) =>
  `<div>
    Address: <input type="hidden" name="addresses[${index}][address]" value="${address.address}">
    Total Amount: <input type="hidden" name="addresses[${index}][totalAmount]" value="${address.totalAmount}">
    Is Valid: <input type="hidden" name="addresses[${index}][isValid]" value="${address.isValid}">
    Reward Distribution Address: <input type="text" name="addresses[${index}][rewardDistribution][address]" value="${address.rewardDistribution.address}">
    Reward Distribution Percentage: <input class="percentage-input" type="text" name="addresses[${index}][rewardDistribution][percentage]" value="${address.rewardDistribution.percentage}">
  </div>`).join('\n');

// 调用 getStatus 函数
  const status = await getStatus();

  let statusMessage;
  if (status.isValid) {
    statusMessage = 'Everything goes well now, the script is working.';
  } else {
    statusMessage = 'There are some issues:';
    for (let condition in status.conditions) {
      if (!status.conditions[condition]) {
        statusMessage += `\n${condition} is not satisfied.`;
      }
    }
  }

  res.send(`
    <form action="/submit" method="POST">
      <input type="text" name="proof" placeholder="Enter proof">
      <input type="submit" value="Submit">
    </form>
    <button id="editButton">Edit</button>
    <form id="editForm" action="/edit" method="POST" style="display: none;">
      ${editInputs}
      <p>Total Distribution Percentage: <span id="totalPercentage">${totalPercentage}</span></p>
      <input type="submit" value="Save">
    </form>
    <table>
      <tr>
        <th>Address</th>
        <th>Staked Amount</th>
        <th>Is Valid</th>
        <th>Reward Distribution Address</th>
        <th>Reward Distribution Percentage</th>
      </tr>
      ${tableRows}
    </table>
    <p>Total Distribution Percentage: <span id="totalPercentageTable">${totalPercentage}</span></p>
    <div>${statusMessage}</div>
    <script>
      document.getElementById('editButton').addEventListener('click', function() {
        document.getElementById('editForm').style.display = 'block';
        this.style.display = 'none';
      });

      let percentageInputs = Array.from(document.querySelectorAll('.percentage-input'));
      let totalPercentageDisplay = document.querySelector('#totalPercentage');
      let totalPercentageDisplayTable = document.querySelector('#totalPercentageTable');
    
      percentageInputs.forEach(input => {
        input.addEventListener('input', updateTotalPercentage);
      });
    
      function updateTotalPercentage() {
        let totalPercentage = percentageInputs.reduce((total, input) => total + parseFloat(input.value || 0), 0);
        totalPercentageDisplay.textContent = totalPercentage;
        totalPercentageDisplayTable.textContent = totalPercentage;
        if (totalPercentage > 1) {
          totalPercentageDisplay.style.color = 'red';
          totalPercentageDisplayTable.style.color = 'red';
        } else {
          totalPercentageDisplay.style.color = 'black';
          totalPercentageDisplayTable.style.color = 'black';
        }
      }
    
      updateTotalPercentage();
    </script>
  `);
});

app.post('/submit', async (req, res) => {
  const proof = req.body.proof;

  let config;
  try {
    const configData = await fs.readFile('config.json', 'utf8');
    config = JSON.parse(configData);
  } catch (err) {
    console.error(err);
    config = { addresses: [] };
  }
  config.proof = proof; 

  await fs.writeFile('config.json', JSON.stringify(config, null, 2), 'utf8');

  // 运行 check.js 和 checkProofPayout.js
  await check();
  await checkProofPayout();

  res.redirect('/');
});

app.post('/edit', async (req, res) => {
  let newAddresses = req.body.addresses;

  let totalPercentage = 0;
  for (let address of newAddresses) {
    totalPercentage += parseFloat(address.rewardDistribution.percentage);
  }

  if (totalPercentage > 1) {
    res.status(400).send('The total of Reward Distribution Percentage must be less than or equal to 1.');
    return;
  }

  let config;
  try {
    const configData = await fs.readFile('config.json', 'utf8');
    config = JSON.parse(configData);
  } catch (err) {
    console.error(err);
    config = { addresses: [] };
  }

  // 只更新 addresses 字段
  config.addresses = newAddresses;

  await fs.writeFile('config.json', JSON.stringify(config, null, 2), 'utf8');

  res.redirect('/');
});

app.listen(3333, () => {
  console.log('Server is running on port 3333');
});
