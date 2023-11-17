const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const check = require('./utils/checkproof.js');
const checkProofPayout = require('./utils/checkproofpayout.js');
const { getBalance } = require('./utils/balance.js');
const { createRawXecTransaction } = require('./utils/tx3.js');
const getStatus = require('./utils/status.js');

const { postSubmit, postEdit } = require('./controllers.js');


setInterval(async () => {

    // 从config.json文件中获取payoutAddress
    const configData = await fs.readFile('config.json', 'utf8');
    const config = JSON.parse(configData);
    const payoutAddress = config.payoutAddress;

    console.log('Payout address:', payoutAddress);  // 打印出地址

    const status = await getStatus();

    // 只有在 isValid 为 true 时才执行交易
    if (status.isValid) {
        const result = await createRawXecTransaction();
        console.log('Transaction result:', result);
    } else {
        console.log('Transaction cannot be processed because the status is invalid.');
    };

}, 30 * 1000);  // 每分钟检查一次

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

let tableRows = config.addresses.map((address) =>
    `<tr class="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
      <th scope="row" class="px-6 py-4 font-medium text-gray-900 whitespace-normal dark:text-white" style="word-break: break-word;">${address.address}</th>
      <td class="px-6 py-4 whitespace-normal" style="word-break: break-word;">${address.totalAmount}</td>
      <td class="px-6 py-4 whitespace-normal" style="word-break: break-word;">${address.isValid}</td>
      <td class="px-6 py-4 whitespace-normal" style="word-break: break-word;">${address.rewardDistribution.address}</td>
      <td class="px-6 py-4 whitespace-normal" style="word-break: break-word;">${address.rewardDistribution.percentage}</td>
    </tr>`).join('\n');

let editInputs = config.addresses.map((address, index) =>
`<div class="flex items-center w-full space-x-2 text-sm mb-1">
<input type="text" name="addresses[${index}][address]" value="${address.address}" class="flex-1 whitespace-normal rounded border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500" readonly>
<input type="hidden" name="addresses[${index}][totalAmount]" value="${address.totalAmount}">
<input type="hidden" name="addresses[${index}][isValid]" value="${address.isValid}">
<input type="text" name="addresses[${index}][rewardDistribution][address]" value="${address.rewardDistribution.address}" class="flex-1 rounded border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500">
<input class="flex-1 whitespace-normal rounded border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500  percentage-input" type="text" name="addresses[${index}][rewardDistribution][percentage]" value="${address.rewardDistribution.percentage}">
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
<!doctype html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Staking Page</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.1.2/dist/tailwind.min.css" rel="stylesheet">
<style>
  .main-container {
    width: 100%;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: left;
    min-height: 100vh;
    padding: 0 10%;
    gap:10px;
  }
  #editForm {
    width: 100%;
  }
  input[type="submit"], button {
    font-size: 16px;
    padding: 10px 20px;
  }
</style>
  </head>
  <body class="bg-white dark:bg-gray-800">
    <div class="main-container">
      <form action="/submit" method="POST" class="mt-5 mb-0">
          <input type="text" name="proof" placeholder="Enter proof" class="p-2 rounded-lg  border border-gray-300">
          <input type="submit" value="Submit" class="py-2.5 px-5 text-sm font-medium text-gray-900 focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:ring-gray-200 dark:focus:ring-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700">
      </form>
  
      <button id="editButton" type="button" class="py-2.5 px-5 w-24 text-sm font-medium text-gray-900 focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:ring-gray-200 dark:focus:ring-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700">Edit</button>
  
      <form id="editForm" action="/edit" method="POST" style="display: none;">
          ${editInputs}
<p class="text-sm font-medium text-gray-700 dark:text-gray-400 mt-2 mb-2">
  Total Distribution Percentage:
  <span id="totalPercentage" class="text-black dark:text-white">${totalPercentage}</span>
          <input type="submit" value="Save" class="py-2.5 px-5 text-sm font-medium text-gray-900 focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:ring-gray-200 dark:focus:ring-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700">
      </form>
  
<div class="relative overflow-x-auto mb-10">
<table class="w-full text-sm text-left text-gray-700 dark:text-gray-400">
    <thead class="text-xs text-black uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
        <tr>
            <th class="px-6 py-3 text-black">Address</th>
            <th class="px-6 py-3 text-black">Staked Amount</th>
            <th class="px-6 py-3 text-black">Is Valid</th>
            <th class="px-6 py-3 text-black">Reward Distribution Address</th>
            <th class="px-6 py-3 text-black">Reward Distribution Percentage</th>
        </tr>
    </thead>
    <tbody>
        ${tableRows}
    </tbody>
</table>
<p class="text-sm font-medium text-gray-700 dark:text-gray-400 mt-2 mb-2">
  Total Distribution Percentage: 
  <span id="totalPercentageTable" class="text-black dark:text-white">${totalPercentage}</span>
</p>
<div class="text-sm font-medium text-gray-700 dark:text-gray-400 mt-2 mb-2">
  ${statusMessage}
</div>
</div>
</div>
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
  </body>
  </html>
  `);
});

app.post('/submit', postSubmit);
app.post('/edit', postEdit);

app.listen(3333, () => {
  console.log('Server is running on port 3333');
});
