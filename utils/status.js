const fs = require('fs');
const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config(); // 读取.env文件

const configFile = path.resolve(__dirname, '../config.json');

async function verifyProof(proof) {
  const response = await fetch(`http://ecashrpc.alitayin.com:3080/verifyavalancheproof?proof=${proof}`);
  const data = await response.json();
  return data; // Assuming response is a boolean
}

function areDependenciesInstalled() {
  const dependencies = ['ecashaddrjs', '@bitgo/utxo-lib', 'dotenv', 'fs', 'chronik-client'];
  for (let i = 0; i < dependencies.length; i++) {
    try {
      require(dependencies[i]);
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        return false;
      }
    }
  }
  return true;
}

async function getStatus() {
  const allDependenciesInstalled = areDependenciesInstalled();
  if (!allDependenciesInstalled) {
    return { 
      isValid: false, 
      conditions: { 
        allDependenciesInstalled 
      } 
    };
  }

  const ecashaddr = require('ecashaddrjs');
  const configData = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  const { addresses, proof, payoutAddress } = configData;

  function isAddressValid(address) {
    return ecashaddr.isValidCashAddress(address);
  }

  // 从.env文件中读取PRIVATE_KEY_WIF和UTXO_ADDRESS
  const { PRIVATE_KEY_WIF, UTXO_ADDRESS } = process.env;

  // 检查PRIVATE_KEY_WIF和UTXO_ADDRESS是否都已填写
  const allEnvVariablesFilled = !!PRIVATE_KEY_WIF && !!UTXO_ADDRESS;

  // 检查UTXO_ADDRESS和config.json文件中的payoutAddress是否相同
  const payoutAddressMatches = UTXO_ADDRESS === payoutAddress;

  const isProofValid = await verifyProof(proof);

  let allAddressesFilled = true;
  let allAddressesValid = true;
  let allIsvalidTrue = true;

  for (let i = 0; i < addresses.length; i++) {
    const { address, isValid } = addresses[i];
    if (!address) {
      allAddressesFilled = false;
    } else if (!isAddressValid(address)) {
      allAddressesValid = false;
    }
    if(isValid !== "true") {
      allIsvalidTrue = false;
    }
  }

  return {
    isValid: isProofValid && allAddressesFilled && allAddressesValid && allIsvalidTrue && allEnvVariablesFilled && payoutAddressMatches,
    conditions: {
      isProofValid,
      allAddressesFilled, allAddressesValid,
      allIsvalidTrue,
      allEnvVariablesFilled,
      payoutAddressMatches,
      allDependenciesInstalled
    },
  };
}

module.exports = getStatus;
