import '../css/Pages.css'

import React, {Component} from 'react';
import {Grid, Row, Col} from 'react-bootstrap';
import {EncryptFileButton, FieldGroup, SubmitButton, ContractNotFound} from '../utils/FunctionalComponents';
import {validateEmail, validateFile} from '../utils/UtilityFunctions';
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

/*---------------------------------------------------------------------------------- DONE ----------------------------------------------------------------------------------*/


/*Component for Patent Deposit*/
class DepositFile_class extends Component {

  /*Component Constructor*/
  constructor(props) {
    super(props);
    this.bundle = new Bundle();
    this.state = {
      hash: "",
      ipfsLocation: "",
      patentName: "",
      price: "",
      email_address: "",
      repeat_email: "",
      file: "",
      fileState: FileStates.NOT_ENCRYPTED,
      web3: props.web3,
      contractInstance: null,
      waitingTransaction: false,
      patentPrice: 0,
      etherPrice : 0,
      gasPrice : 0
    };
    this.handleChange = this.handleChange.bind(this);
    this.submitFile = this.submitFile.bind(this);
    this.encryptFile = this.encryptFile.bind(this);
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
      hash: "",
      ipfsLocation: "",
      patentName: "",
      price: "",
      file: "",
      fileExt: '',
      fileState: FileStates.NOT_ENCRYPTED,
      email_address: "",
      repeat_email: "",
      waitingTransaction: false
    })
  }

  /*Checks if Patent Name length is less than 100 */
  validateName() {
    let length = this.state.patentName.length;
    if (length === 0) {
      return null;
    } else if (length <= 100) {
      return "success"
    } else {
      return "error";
    }
  }

  /*Checks that price >= 0*/
  validatePrice() {
    if (!this.state.price) {
      return null
    } else {
      const price = parseInt(this.state.price, 10);
      return (price >= 0 ? 'success' : 'error');
    }
  }


  /*Returns True if all form validation pass*/
  validateForm() {
    return (this.validatePrice() === 'success'
      && this.validateName() === 'success'
      && this.state.hash !== ""
      && this.state.ipfsLocation !== ""
      && this.state.fileState === FileStates.ENCRYPTED)
  }


  /*--------------------------------- EVENT HANDLERS ---------------------------------*/


  /*Encrypts the file using AES and the key produced by the owner*/
  encryptFile(e) {
    e.preventDefault();
    if (this.state.file !== "" && this.state.hash !== "" && this.state.fileState === FileStates.NOT_ENCRYPTED) {
      this.setState({fileState: FileStates.ENCRYPTING});
      generatePrivateKey(this.state.web3, this.state.hash).then(key => { // Ask user to generate key
        return this.bundle.encryptFile(this.state.file, key); // Encrypt file using the key and return the IPFS hash of the result
      }).then(files => {
        this.setState({ipfsLocation: files[0].hash, fileState: FileStates.ENCRYPTED})
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

  handleFileUpload(file) {
    if (validateFile(file)) {
      const nameSplit = file.name.split('.');
      // default patent name is the file name
      if (!this.state.patentName) {
        this.setState({ patentName: nameSplit[0] });
      }
      this.setState({ fileExt: nameSplit[1], waitingTransaction: true });
      getFileHash(file, window).then(res => {
        this.setState({ waitingTransaction: false, file: file, hash: res, fileState: FileStates.NOT_ENCRYPTED })
      }).catch(err => window.dialog.showAlert(err));
    }
  }


  /* Handles the change in a form component
  * Computes : sha256 of the plain text document
  * */
  handleChange(e) {
    e.preventDefault();
    if (e.target.name === Constants.FILE) {
      // When a file is uploaded
      this.handleFileUpload(e.target.files[0]);
    }
    else {
      // Other text fields
      this.setState({ [e.target.name]: e.target.value });
    }
  }


  /*Function that triggers the contract call to Deposit a patent*/
  submitFile(e) {
    e.preventDefault();
    if (this.validateForm()) {
      this.setState({waitingTransaction: true});
      const { patentName, fileExt, hash, price, ipfsLocation, email_address } = this.state;
      const completeName = patentName + '.' + fileExt;
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
        this.setState({waitingTransaction: false});
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
        <Row bsClass='title'>Music Registration</Row>
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
        <form onSubmit={e => this.submitFile(e)}>
          <FieldGroup name={Constants.FILE} id="formsControlsFile" label="File to register" type="file" placeholder=""
                      onChange={this.handleChange}/>
          <FieldGroup name="patentName" id="formsControlsName" label="Patent Name"
                      type="text" value={this.state.patentName} placeholder=""
                      validation={this.validateName()} disabled
                      onChange={this.handleChange} />
          <EncryptFileButton fileState={this.state.fileState} onClick={e => this.encryptFile(e)}
                             disabled={this.state.file === '' || this.state.fileState !== FileStates.NOT_ENCRYPTED} />
          <br/><Divider/><br/>

          <FieldGroup name="price" id="formsControlsName" label="Price (in USD)" type="text"
                      value={this.state.price} help=""
                      onChange={this.handleChange} validation={this.validatePrice()}/>
          <FieldGroup name="email_address" id="formsControlsEmail" label="Email address" type="email"
                      value={this.state.email_address} placeholder="john@doe.com" help=""
                      onChange={this.handleChange}/>
          <FieldGroup name="repeat_email" id="formsControlsEmail" label="Repeat Email address" type="email"
                      value={this.state.repeat_email} placeholder="john@doe.com" help=""
                      onChange={this.handleChange}
                      validation={validateEmail(this.state.email_address, this.state.repeat_email)}/>

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

const DepositFile = wrapWithMetamask(DepositFile_class, DepositFile_class.header());
export default DepositFile;

