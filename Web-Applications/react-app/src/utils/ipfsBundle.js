import {getEncryptedFileBuffer, getDecryptedFileBuffer} from './CryptoUtils'
import { KEY_ERROR, IPFS_ERROR } from '../utils/ErrorHandler'
import sha256 from 'sha256'

/*Simple bundle to upload, encrypt and get files to IPFS*/
class Bundle {
  constructor() {
    this.node = window.IpfsApi(process.env.REACT_APP_IPFS, 5001, {protocol: 'https'});
    this.encryptedFile = null;
    this.encryptedAlbum = [];
    this.albumName = '';
  }

  reset() {
    this.encryptedFile = null;
    this.encryptedAlbum = [];
    this.albumName = ''
  }

  /*Function that encrypts the file and stores it*/
  encryptFile(file, key) {
    return getEncryptedFileBuffer(file, window, key).then(res => {
      this.encryptedAlbum.push(res);
      this.encryptedFile = res;
      return this.getHash() //new Promise((resolve, reject) => resolve("file encrypted"))
    })
  }

  /*Function that encrypts a full album and stores it*/
  /* encryptAlbum(name, files, masterKey) {
    this.albumName = name;
    // modify this using Promise.All()
    const hashes = files.map((file, i) => {
      // derive file key from master key by sha256(masterKey + file hash)
      const fileKey = sha256(masterKey + file.hash);
      return getEncryptedFileBuffer(file.data, window, fileKey).then(res => {
        const completeFileName = file.name + '.' + file.ext;
        this.encryptedAlbum[completeFileName] = res;
        return (i === files.length - 1) ? this.getHashes() : null;
      });
    });
    return hashes[hashes.length - 1];
  } */

  /*Gets the IPFS hash of the stored encrypted file*/
  getHash = () => this.addFile(true);

  addFile(onlyHash = false) {
    if (this.encryptedFile !== null) {
      return this.node.add(this.encryptedFile, { onlyHash })
    }
  }

  /*Gets the IPFS hash of the stored encrypted file*/
  getHashes = () => this.addAlbum(true);

  addFiles(onlyHash = false) {
    if(this.encryptedAlbum.length > 1 ){
      return this.encryptedAlbum.map(encryptedFile => this.node.add(encryptedFile, { onlyHash }));
    }
  }

  addAlbum(onlyHash = false) {
    const albumName = this.albumName;
    const fileNames = Object.keys(this.encryptedAlbum);
    if (fileNames.length > 0 && albumName !== '') {
      const toAdd = fileNames.map(fileName => {
        return {
          path: '/' + albumName + '/' + fileName,
          content: this.encryptedAlbum[fileName],
        };
      });
      return this.node.add(toAdd, { onlyHash });
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
            if (sha256(decrypted) === fileHash) {
              resolve(decrypted)
            } else {
              reject(KEY_ERROR)
            }
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
