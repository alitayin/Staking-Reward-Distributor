const axios = require('axios');
const ecashaddr = require('ecashaddrjs');
const fs = require('fs').promises;
const path = require('path');
const configFile = path.resolve(__dirname, '../config.json');

function extractHash160FromAsm(asm) {
  const parts = asm.split(' ');
  return parts[2];
}

async function getHash160FromProof(proof) {
  return await axios.get(`http://ecashrpc.alitayin.com:3080/decodeavalancheproof?proof=${proof}`)
    .then(response => {
      const data = response.data;
      const asm = data.payoutscript.asm;
      return extractHash160FromAsm(asm);
    })
    .catch(error => {
      console.error(`Invalid proof: ${proof}. Request failed with error:`, error);
      throw error;
    });
}

function hash160ToEcashAddress(hash160) {
  const bytes = new Uint8Array(Buffer.from(hash160, 'hex'));
  return ecashaddr.encode('ecash', 'P2PKH', bytes);
}

async function checkProofPayout() {
  try {
const configData = await fs.readFile(configFile, 'utf8');
    let config = JSON.parse(configData);
    const proof = config.proof;
    const hash160 = await getHash160FromProof(proof);
    const ecashAddress = hash160ToEcashAddress(hash160);
    config.payoutAddress = ecashAddress;
    console.log(`Ecash address for proof ${proof} is ${ecashAddress}`);
 await fs.writeFile(configFile, JSON.stringify(config, null, 2), 'utf8');
    console.log("Updated config.json with payout address");
  } catch (error) {
    console.error('Error getting Ecash address:', error);
  }
}

module.exports = checkProofPayout;
