import {getPublic} from 'eccrypto'
import {KEY_GENERATION_ERROR} from './ErrorHandler'
import sha256 from 'sha256';

/*Generates a cryptographic key to encrypt the files on IPFS
*
* Key = Elliptic Curve Digital Signature Algo(sha3(sha256(file)) => depends on user + file and is not reproducible by anyone else
* */
const generatePrivateKey = function (web3, fileHash, folderHash='') {
  const fromFolder = folderHash.length > 0;
  let toSign = '0x' + (fromFolder ? folderHash : fileHash);
  return new Promise((resolve, reject) => {
    web3.eth.sign(web3.eth.accounts[0], toSign, (err, res) => {
      if (!err) {
        if (fromFolder) {
          resolve(sha256(res.substr(2, 64) + fileHash));
        }
        else {
          resolve(res.substr(2, 64)); // remove 0x and take 256 bits sized key
        }
      } else {
        reject(KEY_GENERATION_ERROR);
      }
    })
  })
};

/*Returns the public key associated to a given private key*/
const generatePublicKey = function (privateKey) {
  if (privateKey !== null) {
    return getPublic(Buffer.from(privateKey, 'hex')).toString('hex')//EthUtil.privateToPublic(Buffer.from(privateKey, 'hex')).toString('hex');
  } else {
    return null
  }
};


module.exports = {
  generatePrivateKey,
  generatePublicKey
};