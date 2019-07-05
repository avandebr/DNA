import {getEncryptedFileBuffer, getDecryptedFileBuffer} from './CryptoUtils'
import { /*KEY_ERROR,*/ IPFS_ERROR } from '../utils/ErrorHandler'
// import ipfsClient from 'ipfs-http-client';
import sha256 from 'sha256'

/*Simple bundle to upload, encrypt and get files to IPFS*/
class Bundle {
  constructor() {
    this.node = window.IpfsHttpClient(process.env.REACT_APP_IPFS, 5001, {protocol: 'https'});
    this.encryptedFile = null;
    this.encryptedFolder = [];
  }

  reset() {
    this.encryptedFile = null;
    this.encryptedFolder = [];
  }

  /*Function that encrypts the file and stores it*/
  encryptFile(file, key) {
    return getEncryptedFileBuffer(file, window, key).then(res => {
      this.encryptedFile = res;
      this.encryptedFolder.push(res);
      return this.getHash();
    })
  }

  /*Function that encrypts a full folder and stores it*/
  encryptFolder(files, masterKey) {
    return Promise.all(files.map(file => {
      const fileKey = sha256(masterKey + file.hash);
      return this.encryptFile(file.data, fileKey);
    }));
  }

  /*Gets the IPFS hash of the stored encrypted file*/
  getHash = () => this.addFile(true);

  addFile(onlyHash = false) {
    if (this.encryptedFile !== null) {
      return this.node.add(this.encryptedFile, { onlyHash })
    }
  }

  addFiles(onlyHash = false) {
    if (this.encryptedFolder.length > 0) {
      return Promise.all(this.encryptedFolder.map(encryptedFile => {
        return this.node.add(encryptedFile, { onlyHash })
      }));
    }
  }

  /*Gets the byte buffer from IPFS and decrypts it using the given key*/
  getDecryptedFile(fileHash, ipfsLoc, key) {
    return new Promise((resolve, reject) => {
      if (fileHash !== null && ipfsLoc !== null && key !== null) {
        this.node.get(ipfsLoc, (err, files) => {
          if (!err) {
            let byteContent = files[0].content;
            let decrypted = getDecryptedFileBuffer(byteContent, key);
            // TODO: reverify with good filehash
            // if (sha256(decrypted) === fileHash) {
            resolve(decrypted)
            // } else {
            //   reject(KEY_ERROR)
            // }
          } else {
            reject(IPFS_ERROR)
          }
        })
      } else {
        reject(IPFS_ERROR)
      }
    })
  }

}

export default Bundle;
