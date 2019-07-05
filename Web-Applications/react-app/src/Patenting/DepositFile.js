import '../css/Pages.css'

import React, {Component} from 'react';
import {Grid, Row, Col} from 'react-bootstrap';
import { EncryptFileButton, FieldGroup, SubmitButton, ContractNotFound, LicencesMenu } from '../utils/FunctionalComponents';
import { validateName, validatePrice, validateFile } from '../utils/UtilityFunctions';
import {getFileHash} from '../utils/CryptoUtils'
import wrapWithMetamask from '../MetaMaskWrapper'
import Patents from '../../build/contracts/Patents';
import Bundle from '../utils/ipfsBundle';

import {Constants, FileStates} from '../utils/Constants';
import {generatePrivateKey} from '../utils/KeyGenerator'
import {INVALID_FORM, KEY_GENERATION_ERROR, IPFS_ERROR, contractError} from '../utils/ErrorHandler'
import Dialog from 'react-bootstrap-dialog';
import Paper from "@material-ui/core/Paper";
import Divider from "@material-ui/core/Divider";
import licences from '../utils/Licences'

/*----------------------------------------------------- DONE -----------------------------------------------------*/


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
      licencePrices: Array(Object.keys(licences).length).fill(''),
      licence: Object.keys(licences).length - 1,
      file: "",
      fileExt: '',
      fileState: FileStates.NOT_ENCRYPTED,
      web3: props.web3,
      contractInstance: null,
      waitingTransaction: false,
      depositPrice: 0,
      etherPrice : 0,
      gasPrice : 0,
      currentAccountRegistered: false,
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
    const patents = contract(Patents);
    patents.setProvider(this.state.web3.currentProvider);
    // patents.at(Constants.CONTRACT_ADDRESS).then(instance => { // for ROPSTEN
    patents.deployed().then(instance => { // for LOCAL RPC
      this.setState({contractInstance: instance});
      return instance.hasAccount.call(this.state.web3.eth.accounts[0]);
    }).then(registered => {
      this.setState({ currentAccountRegistered: registered });
      return this.state.contractInstance.depositPrice.call();
    }).then(price => {
      this.setState({depositPrice: price.toNumber()});
      return this.state.contractInstance.getEthPrice.call(price.toNumber());
    }).then(ethPrice => {
      this.setState({ etherPrice: ethPrice })
    }).catch(() => this.setState({ contractInstance: null }));
    this.state.web3.currentProvider.on('accountsChanged', accounts => {
      this.state.contractInstance.hasAccount.call(accounts[0]).then(registered => {
        this.setState({currentAccountRegistered: registered});
      })
    });
  }


  /*--------------------------------- HELPER METHODS AND VALIDATION ---------------------------------*/

  /*Resets the form*/
  resetForm() {
    this.bundle.reset();
    this.setState({
      hash: "",
      ipfsLocation: "",
      patentName: "",
      licencePrices: Array(Object.keys(licences).length).fill(''),
      licence: Object.keys(licences).length - 1,
      file: "",
      fileExt: '',
      fileState: FileStates.NOT_ENCRYPTED,
      waitingTransaction: false
    })
  }

  // Component validation functions
  validatePrices = () => this.state.licencePrices.slice(1, this.state.licence+1).every(price => (validatePrice(price) === 'success'));
  validateName = () => validateName(this.state.patentName);

  /*Returns True if all form validation pass*/
  validateForm() {
    return (this.validatePrices()
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
      // patent name is the file name
      this.setState({ patentName: nameSplit[0], fileExt: nameSplit[1], waitingTransaction: true });
      getFileHash(file, window).then(res => {
        this.setState({ waitingTransaction: false, file: file, hash: res, fileState: FileStates.NOT_ENCRYPTED })
      }).catch(err => window.dialog.showAlert(err));
    }
  }

  handleLicenceChange(newLicence) {
    this.setState({ licence: parseInt(newLicence, 10) });
  }

  handlePricesChange(licence, newPrice) {
    let newPrices = this.state.licencePrices;
    newPrices[licence] = newPrice;
    this.setState({ licencePrices: newPrices });
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
  // TODO: tell the user if the file he wants to submit has already been (by him or by someone else)
  // TODO: push d'abord le file sur IPFS puis deposit le patent comme ca recuperer le hash IPFS a ce moment
  submitFile(e) {
    e.preventDefault();
    if (this.validateForm()) {
      this.setState({waitingTransaction: true});
      const { patentName, fileExt, hash, licence, licencePrices, ipfsLocation } = this.state;
      const prices = licencePrices.slice(1, licence+1).map(parseFloat);
      const completeName = patentName + '.' + fileExt;
      this.state.contractInstance.depositPatent(completeName, hash, '', ipfsLocation, prices, {
        from: this.state.web3.eth.accounts[0],
        value: this.state.etherPrice,
        gas: 2*process.env.REACT_APP_GAS_LIMIT,
        gasPrice : this.state.gasPrice
      }).then(() => {
        return this.bundle.addFile() // Add the encrypted file to IPFS
      }).then(filesAdded => {
        this.resetForm();
        const url = "https://ipfs.io/ipfs/" + filesAdded[0].hash;
        window.dialog.show({
          title: "Encrypted file has been successfully added to IPFS",
          body: "IPFS location : " + url,
          actions: [
            Dialog.OKAction(),
            Dialog.Action(
              'View encrypted File',
              () => {
                let win = window.open(url);
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
            to you and you will need to <a href="/MyFiles" className="link">accept the requests</a>,
            then the funds will be transferred to your account and the user will be able to download a copy of the document.
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

          <LicencesMenu licence={this.state.licence} onLicenceChange={i => this.handleLicenceChange(i)}
                        validatePrice={validatePrice} prices={this.state.licencePrices}
                        onPricesChange={(l, p) => this.handlePricesChange(l, p)}
                        label="Licence Selection and Prices"/>
          <br/><Divider/><br/>

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
            <Col xsHidden>Patents contract at {this.state.contractInstance.address}</Col>
            <Row>Deposit price at {this.state.depositPrice} USD </Row> {/* price to pay to deposit a patent */}
            <br/>
            <Col xsHidden>
              Current account {this.state.web3.eth.accounts[0]} (From Metamask)
              <br/>
              {!this.state.currentAccountRegistered && "Your current Metamask account is not registered. Please "}
              <a href="/RegisterAccount">{!this.state.currentAccountRegistered && "register it here"}</a>
              {!this.state.currentAccountRegistered && " to deposit a patent"}
            </Col>
          </Row>
          {this.state.currentAccountRegistered && <Col sm={3} md={5} mdOffset={3} className="form">
            {this.renderForm()}
          </Col>}
        </Grid>
      )
    }
  }
}

const DepositFile = wrapWithMetamask(DepositFile_class, DepositFile_class.header());
export default DepositFile;

