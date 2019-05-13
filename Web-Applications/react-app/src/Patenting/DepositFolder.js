import '../css/Pages.css'

import React, {Component} from 'react';
import {Grid, Row, Col} from 'react-bootstrap';
import merkle from 'merkle';

import {EncryptFileButton, FieldGroup, SubmitButton, ContractNotFound} from '../utils/FunctionalComponents';
import {validateEmail, validateEmails, validateFiles, validateName} from '../utils/UtilityFunctions';
import {getFileHash} from '../utils/CryptoUtils'
import wrapWithMetamask from '../MetaMaskWrapper'
import Patenting from '../../build/contracts/Patenting';
import Bundle from '../utils/ipfsBundle';
import {Constants, FileStates} from '../utils/Constants';
import {generatePrivateKey} from '../utils/KeyGenerator'
import { /* INVALID_FORM, */ KEY_GENERATION_ERROR, IPFS_ERROR, contractError} from '../utils/ErrorHandler'
// import Dialog from 'react-bootstrap-dialog';
import Paper from "@material-ui/core/Paper";
import Divider from "@material-ui/core/Divider";

/*Component for Patent Deposit*/
class DepositFolder_class extends Component {

  /*Component Constructor*/
  constructor(props) {
    super(props);
    this.bundle = new Bundle();
    this.state = {
      files: [], // list of objects each containing the file name, data, hash, and ipfs location
      albumName: '',
      songPrice: '',
      albumPrice: '',
      albumIpfs: '',
      albumHash: '', // root of the Merkle tree constructed with the songs hash
      filesState: FileStates.NOT_ENCRYPTED,
      email: '',
      repeat_email: '',
      web3: props.web3,
      contractInstance: null,
      waitingTransaction: false,
      patentPrice: 0,
      etherPrice : 0,
      gasPrice : 0
    };
    this.handleChange = this.handleChange.bind(this);
    this.submitAlbum = this.submitAlbum.bind(this);
    this.encryptAlbum = this.encryptAlbum.bind(this);
  }

  /* Called before the component is mounted
  * Instantiates the contract and stores the price of a patent */
  componentDidMount() {
    this.state.web3.eth.getGasPrice((err, res) => this.setState({ gasPrice : res.toNumber() }));
    const contract = require('truffle-contract');
    const patenting = contract(Patenting);
    patenting.setProvider(this.state.web3.currentProvider);
    // patenting.at('0x90Aa08D8542925bc95b1D7347bF21068A0659c70').then(instance => { // for ROPSTEN
    // patenting.at('0x4D6559470539B0B82c5ada2D0DC5db644367D74B').then(instance => { // for LOCAL RPC
    patenting.deployed().then(instance => { // for LOCAL RPC
      this.setState({contractInstance: instance});
      return instance.patentPrice.call()
    }).then(price => {
      this.setState({patentPrice: price.toNumber()});
      return this.state.contractInstance.getEthPrice.call(price.toNumber())
    }).then(ethPrice => this.setState({ etherPrice: ethPrice }))
      .catch(error => this.setState({ contractInstance: null }));
  }

  /*--------------------------------- HELPER METHODS AND VALIDATION ---------------------------------*/

  /*Resets the form*/
  resetForm() {
    this.bundle.reset();
    this.setState({
      files: [],
      albumName: '',
      albumPrice: '',
      songPrice: '',
      email: '',
      repeat_email: '',
      filesState: FileStates.NOT_ENCRYPTED,
      waitingTransaction: false
    })
  }

  // Component validation functions
  validateName = () => validateName(this.state.albumName);
  validateEmail = () => validateEmail(this.state.email);
  validateEmails = () => validateEmails(this.state.email, this.state.repeat_email);

  /*Checks that price > 0*/
  validateSongPrice() {
    if (!this.state.songPrice || !this.state.albumPrice) {
      return null
    } else {
      const songPrice = parseFloat(this.state.songPrice);
      const albumPrice = parseFloat(this.state.albumPrice);
      const nSongs = this.state.files.length;
      if (songPrice < albumPrice / nSongs || (albumPrice > 0 && songPrice >= albumPrice)) {
        return 'warning';
      }
      return (songPrice >= 0 ? 'success' : 'error');
    }
  }

  /*Checks that price > 0*/
  validateAlbumPrice() {
    if (!this.state.albumPrice) {
      return null
    } else {
      const songPrice = parseFloat(this.state.songPrice);
      const albumPrice = parseFloat(this.state.albumPrice);
      const nSongs = this.state.files.length;
      if (albumPrice > songPrice * nSongs || (songPrice > 0 && albumPrice <= songPrice)) {
        return 'warning';
      }
      return (albumPrice >= 0 ? 'success' : 'error');
    }
  }

  /*Returns True if all form validation pass*/
  validateForm() {
    return (this.validateAlbumPrice() === 'success'
      && this.validateSongPrice() === 'success'
      && this.validateName() === 'success'
      && this.validateEmail() === 'success'
      && this.validateEmails() === 'success'
      && this.state.files.length > 1
      // && this.state.albumIpfs !== ""
      && this.state.filesState === FileStates.ENCRYPTED);
  }

  /* builds a merkle tree from file hashes */
  constructMerkleTree(){
    const hashes = this.state.files.map(file => file.hash);
    return merkle('sha256', false).sync(hashes);
  }

  /*--------------------------------- EVENT HANDLERS ---------------------------------*/

  /* Handles the files upload
  * */
  handleFilesUpload(uploadedFiles) {
    if (validateFiles(uploadedFiles)) {
      this.setState({ waitingTransaction: true });
      uploadedFiles.forEach(file => {
        const fileName = file.name.split('.');
        getFileHash(file, window).then(res => {
          const newFile = {
            data: file,
            hash: res,
            name: fileName[0],
            ext: fileName[1],
            ipfsLocation: '',
          };
          const files = this.state.files;
          files.push(newFile);
          this.setState({ files });
        }).catch(err => window.dialog.alert(err));
      });
      this.setState({ waitingTransaction: false, fileState: FileStates.NOT_ENCRYPTED })
    }
  }

  /* Handles the change of the form
  * */
  handleChange(e) {
    e.preventDefault();
    if (e.target.name === Constants.FILE) {
      // When a file is uploaded
      const uploadedFiles = [...Array(e.target.files.length).keys()].map(i => e.target.files[i]);
      this.handleFilesUpload(uploadedFiles);
    }
    else {
      // Other text fields
      this.setState({ [e.target.name]: e.target.value });
    }
  }

  /*Encrypts the file using AES and the key produced by the owner*/
  encryptAlbum(e) {
    e.preventDefault();
    const { files /*, albumName */ } = this.state;
    if (files.length > 0 && this.state.filesState === FileStates.NOT_ENCRYPTED) {
      this.setState({ filesState: FileStates.ENCRYPTING });
      // create master key for whole album from all files hash and then derive from it one for each file
      /*
      const albumHash = this.constructMerkleTree().root();
      generatePrivateKey(this.state.web3, albumHash).then(masterKey => { // Ask user to generate key
        return this.bundle.encryptAlbum(albumName, files, masterKey); // Encrypt files and returns the IPFS locations of the result
      }).then(encryptedFiles => {
        // album ipfs location
        const albumLocation = encryptedFiles.find(encryptedFile => encryptedFile.path === albumName).hash;
        // files ipfs location
        const newFiles = files.map(file => {
          const filePath = albumName + '/' + file.name + '.' + file.ext;
          const fileLocation = encryptedFiles.find(encryptedFile => encryptedFile.path === filePath).hash;
          return { ...file, ipfsLocation: fileLocation };
        });
        this.setState({ filesState: FileStates.ENCRYPTED, files: newFiles, albumIpfs: albumLocation, albumHash });
      */
      let newFiles = [];
      files.forEach((file, i) => {
        generatePrivateKey(this.state.web3, file.hash).then(key => { // Ask user to generate key
          return this.bundle.encryptFile(file.data, key); // Encrypt file using the key and return the IPFS hash of the result
        }).then(encryptedFiles => {
          newFiles.push({ ...file, ipfsLocation: encryptedFiles[0].hash });
          if (i === files.length - 1) {
            this.setState({ files: newFiles, filesState: FileStates.ENCRYPTED });
          }
        }).catch(err => {
          if (err === KEY_GENERATION_ERROR) {
            window.dialog.showAlert(KEY_GENERATION_ERROR);
          } else {
            window.dialog.showAlert(IPFS_ERROR);
          }
          this.resetForm();
        });
      });
    } else {
      window.dialog.showAlert("Please select a file.");
    }
  }

  /*Function that triggers the contract call to Deposit a patent*/
  submitAlbum(e) {
    e.preventDefault();
    if (this.validateForm()) {
      this.setState({ waitingTransaction: true });
      /*
      const { albumName, albumHash, albumPrice, albumIpfs, files, songPrice, email, etherPrice, gasPrice } = this.state;
      const songsName = files.map(song => song.name);
      const songsIpfs = files.map(song => song.ipfsLocation);
      const songsHash = files.map(song => song.hash);
      const albumSize = songsName.length;
      this.state.contractInstance.depositAlbum(albumName, albumIpfs, albumHash, albumPrice, songsName, songsIpfs, songsHash, songPrice, email, {
        from: this.state.web3.eth.coinbase,
        value: albumSize * etherPrice,
        gas: albumSize * process.env.REACT_APP_GAS_LIMIT,
        gasPrice : gasPrice
      }).then(tx => {
        console.log(tx);
        return this.bundle.addAlbum() // Add the encrypted file to IPFS
      }).then(filesAdded => {
        console.log(filesAdded);
        this.resetForm();
      */

      // adding files 1 by 1 because of fucking solidity
      const { files, songPrice, email, etherPrice, gasPrice } = this.state;
      const albumSize = files.length;
      [...Array(albumSize).keys()].forEach(i => {
        this.state.contractInstance.depositPatent(files[i].name, files[i].hash, songPrice, files[i].ipfsLocation, email, {
          from: this.state.web3.eth.coinbase,
          value: etherPrice,
          gas: process.env.REACT_APP_GAS_LIMIT,
          gasPrice: gasPrice
        }).then(tx => {
          return i===albumSize-1 ? this.bundle.addFiles() : [];
        }).then(filesAdded => {
          if (filesAdded.length > 1) this.resetForm();
        }).catch(error => {
          this.setState({ waitingTransaction: false });
          contractError(error); // Handles the error
        });
      });
    }
  }

  /*--------------------------------- USER INTERFACE COMPONENTS ---------------------------------*/

  /*The header to be displayed*/
  static header() {
    return (
      <Grid>
        <br/>
        <Row bsClass='title'>Album Registration</Row>
        <hr/>
        <Row bsClass='paragraph'>
          <p>This page allows users that have an Ethereum account and are using it on the Metamask
            extension for browsers, to register files and allow other users to access them for a set
            fee. <br/> Whenever another user requests to buy access to the file you uploaded, an email will be sent
            to you and
            you will need to <a href="/MyFiles" className="link">
              accept the requests</a>, then the funds will be transferred to
            your account and the user will be able to download a copy of the document.
            <br/><br/>You only need to <b>unlock your Metamask extension</b> and choose the document.
            <br/>Note that we do not store any data regarding the documents you upload; Only the hashes are retrieved.
            The document will be stored in an encrypted format on the IPFS network, using AES 256-bit encryption
          </p>
        </Row>
      </Grid>
    );
  }

  /*Renders the form to deposit a patent*/
  renderForm() {
    return (
      <Paper style={{ padding: 20 }}>
        <form onSubmit={e => this.submitAlbum(e)}>
          <FieldGroup name={Constants.FILE} id="formsControlsFile" label="Files" type="file" placeholder=""
                      multiple onChange={this.handleChange}/>
          <FieldGroup name="albumName" id="formsControlsName" label="Album Name"
                      type="text" value={this.state.albumName} placeholder="Enter the album name"
                      help="Max 100 chars" validation={this.validateName()}
                      onChange={this.handleChange} />
          <EncryptFileButton fileState={this.state.filesState} onClick={e => this.encryptAlbum(e)} multiple
                             disabled={this.state.files.length < 2 || this.state.albumName === ''
                             || this.state.filesState !== FileStates.NOT_ENCRYPTED} />
          <br/><Divider/><br/>

          <FieldGroup name="albumPrice" id="formsControlsName" label="Album price (in USD)" type="text"
                      value={this.state.albumPrice} help=""
                      onChange={this.handleChange} validation={this.validateAlbumPrice()}/>
          <FieldGroup name="songPrice" id="formsControlsName" label="Individual songs price (in USD)" type="text"
                      value={this.state.songPrice} help=""
                      onChange={this.handleChange} validation={this.validateSongPrice()}/>
          <Divider/><br/>

          <FieldGroup name="email" id="formsControlsEmail" label="Email address" type="email"
                      value={this.state.email} placeholder="john@doe.com" help=""
                      validation={validateEmail(this.state.email)} onChange={this.handleChange} />
          <FieldGroup name="repeat_email" id="formsControlsEmail" label="Repeat Email address" type="email"
                      value={this.state.repeat_email} placeholder="john@doe.com" help=""
                      validation={validateEmails(this.state.email, this.state.repeat_email)}
                      onChange={this.handleChange}/>
          <Divider/><br/>

          <SubmitButton running={this.state.waitingTransaction} disabled={!this.validateForm()}/>
        </form>
      </Paper>
    );
  }

  render() {
    if (this.state.contractInstance === null) {
      return <ContractNotFound/>;
    } else {
      return (
        <Grid>
          <Row bsClass="contract-address">
            <Col xsHidden>Contract at {this.state.contractInstance.address}</Col>
            <Row>Deposit price at {this.state.patentPrice} USD </Row> {/* price to pay to deposit a patent */}
            <br/> <Row><Col xsHidden>Current account {this.state.web3.eth.accounts[0]} (From Metamask)</Col></Row>
          </Row>
          <Row><Col sm={3} md={5} mdOffset={3} className="form">{this.renderForm()}</Col></Row>
        </Grid>
      )
    }
  }
}

const DepositFolder = wrapWithMetamask(DepositFolder_class, DepositFolder_class.header());
export default DepositFolder;

