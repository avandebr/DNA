import '../css/Pages.css'

import React, {Component} from 'react';
import {Grid, Row, Col} from 'react-bootstrap';
import merkle from 'merkle';

import {EncryptFileButton, FieldGroup, SubmitButton, ContractNotFound} from '../utils/FunctionalComponents';
import {validateEmail, validateEmails, validateFiles} from '../utils/UtilityFunctions';
import {getFileHash} from '../utils/CryptoUtils'
import wrapWithMetamask from '../MetaMaskWrapper'
import Patenting from '../../build/contracts/Patenting';
import Bundle from '../utils/ipfsBundle';
import {Constants, FileStates} from '../utils/Constants';
import {generatePrivateKey} from '../utils/KeyGenerator'
import {INVALID_FORM, KEY_GENERATION_ERROR, IPFS_ERROR, contractError} from '../utils/ErrorHandler'
import Dialog from 'react-bootstrap-dialog';
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
      ipfsLocation: '',
      filesState: FileStates.NOT_ENCRYPTED,
      email_address: '',
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
    // patenting.at('0xddfc2E31EEcA6Ed9E39ed4B7BA30F7217B3032A3').then(instance => { // for LOCAL RPC
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
      email_address: '',
      repeat_email: '',
      waitingTransaction: false
    })
  }

  /*Checks if Patent Name length is less than 100 */
  validateName() {
    let length = this.state.albumName.length;
    if (length === 0) {
      return null;
    } else if (length <= 100) {
      return "success"
    } else {
      return "error";
    }
  }

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
      && this.state.files.length > 0
      && this.state.ipfsLocation !== ""
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
      uploadedFiles.forEach(file => {
        const fileName = file.name.split('.');
        this.setState({ waitingTransaction: true });
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
          this.setState({ waitingTransaction: false, files: files, fileState: FileStates.NOT_ENCRYPTED })
        }).catch(err => window.dialog.alert(err));
      });
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
    const { files, albumName } = this.state;
    if (files.length > 0 && this.state.filesState === FileStates.NOT_ENCRYPTED) {
      this.setState({ filesState: FileStates.ENCRYPTING });
      // create master key for whole album from all files hash and then derive from it one for each file
      generatePrivateKey(this.state.web3, this.constructMerkleTree().root()).then(masterKey => { // Ask user to generate key
        return this.bundle.encryptAlbum(albumName, files, masterKey); // Encrypt files and returns the IPFS locations of the result
      }).then(encryptedFiles => {
        this.setState({ filesState: FileStates.ENCRYPTED });
        // set album ipfs location
        const albumLocation = encryptedFiles.find(encryptedFile => encryptedFile.path === albumName).hash;
        this.setState({ ipfsLocation: albumLocation });
        // set files ipfs location
        const newFiles = files.map(file => {
          const filePath = albumName + '/' + file.name + '.' + file.ext;
          const fileLocation = encryptedFiles.find(encryptedFile => encryptedFile.path === filePath).hash;
          return { ...file, ipfsLocation: fileLocation };
        });
        this.setState({ files: newFiles });
      }).catch(err => {
        if (err === KEY_GENERATION_ERROR) {
          window.dialog.showAlert(KEY_GENERATION_ERROR);
        } else {
          window.dialog.showAlert(IPFS_ERROR);
        }
        this.resetForm();
      })
    } else {
      window.dialog.showAlert("Please select a file.");
    }
  }

  /*Function that triggers the contract call to Deposit a patent*/
  submitAlbum(e) {
    e.preventDefault();
    if (this.validateForm()) {
      this.setState({ waitingTransaction: true });
      const { albumName, fileExt, hash, price, ipfsLocation, email_address } = this.state;
      const completeName = albumName + '.' + fileExt;
      this.state.contractInstance.depositPatent(completeName, hash, price, ipfsLocation, email_address, {
        from: this.state.web3.eth.coinbase,
        value: this.state.etherPrice,
        gas: process.env.REACT_APP_GAS_LIMIT,
        gasPrice : this.state.gasPrice
      }).then(tx => {
        return this.bundle.addFile() // Add the encrypted file to IPFS
      }).then(filesAdded => {
        this.resetForm();
        window.dialog.show({
          title: "Encrypted file has been successfully added to IPFS",
          body: "IPFS location : ipfs.io/ipfs/" + filesAdded[0].hash,
          actions: [
            Dialog.OKAction(),
            Dialog.Action(
              'View encrypted File',
              () => {
                let win = window.open("https://ipfs.io/ipfs/" + filesAdded[0].hash);
                win.focus();
              })],
          bsSize: "large"
        });
      }).catch(error => {
        this.setState({ waitingTransaction: false });
        contractError(error); // Handles the error
      });
    } else {
      if (this.state.file !== "" && this.state.fileState === FileStates.NOT_ENCRYPTED) {
        window.dialog.showAlert("Please encrypt the file")
      } else {
        window.dialog.showAlert(INVALID_FORM);
      }
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

          <FieldGroup name="email_address" id="formsControlsEmail" label="Email address" type="email"
                      value={this.state.email_address} placeholder="john@doe.com" help=""
                      validation={validateEmail(this.state.email_address)} onChange={this.handleChange} />
          <FieldGroup name="repeat_email" id="formsControlsEmail" label="Repeat Email address" type="email"
                      value={this.state.repeat_email} placeholder="john@doe.com" help=""
                      validation={validateEmails(this.state.email_address, this.state.repeat_email)}
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

