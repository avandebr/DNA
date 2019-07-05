import '../css/Pages.css'

import React, {Component} from 'react';
import {Grid, Row, Col} from 'react-bootstrap';
import merkle from 'merkle';

import {
  EncryptFileButton,
  FieldGroup,
  SubmitButton,
  ContractNotFound,
  LicencesMenu
} from '../utils/FunctionalComponents';
import {
  validateFiles,
  validateName,
  validatePrice
} from '../utils/UtilityFunctions';
import {getFileHash} from '../utils/CryptoUtils'
import wrapWithMetamask from '../MetaMaskWrapper'
import Patents from '../../build/contracts/Patents';
import Bundle from '../utils/ipfsBundle';
import {Constants, FileStates} from '../utils/Constants';
import {generatePrivateKey} from '../utils/KeyGenerator'
import { /* INVALID_FORM, */ contractError} from '../utils/ErrorHandler'
import Paper from "@material-ui/core/Paper";
import Divider from "@material-ui/core/Divider";
import licences from "../utils/Licences";

import Dialog from 'react-bootstrap-dialog';


/*Component for Patent Deposit*/
class DepositFolder_class extends Component {

  /*Component Constructor*/
  constructor(props) {
    super(props);
    this.bundle = new Bundle();
    this.state = {
      files: [], // list of objects each containing the file name, data, hash, and ipfs location
      folderName: '',
      licence: Object.keys(licences).length - 1,
      filePrices: Array(Object.keys(licences).length).fill(''),
      folderPrices: Array(Object.keys(licences).length).fill(''),
      folderHash: '',
      filesState: FileStates.NOT_ENCRYPTED,
      web3: props.web3,
      contractInstance: null,
      waitingTransaction: false,
      patentPrice: 0,
      etherPrice : 0,
      gasPrice : 0
    };
    this.handleChange = this.handleChange.bind(this);
    this.submitFolder = this.submitFolder.bind(this);
    this.encryptFolder = this.encryptFolder.bind(this);
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
      this.setState({ contractInstance: instance });
      return instance.hasAccount.call(this.state.web3.eth.accounts[0]);
    }).then(registered => {
      this.setState({ currentAccountRegistered: registered });
      return this.state.contractInstance.depositPrice.call();
    }).then(price => {
      this.setState({ depositPrice: price.toNumber() });
      return this.state.contractInstance.getEthPrice.call(price.toNumber());
    }).then(ethPrice => {
      this.setState({ etherPrice: ethPrice })
    }).catch(console.log);

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
      files: [],
      folderName: '',
      licence: Object.keys(licences).length - 1,
      filePrices: Array(Object.keys(licences).length).fill(''),
      folderPrices: Array(Object.keys(licences).length).fill(''),
      filesState: FileStates.NOT_ENCRYPTED,
      waitingTransaction: false
    })
  }

  // Component validation functions
  validateName = () => validateName(this.state.folderName);
  validateFilePrices = () => this.state.filePrices.slice(1, this.state.licence+1).every(price => (validatePrice(price) === 'success'));
  validateFolderPrices =  () => this.state.folderPrices.slice(1, this.state.licence+1).every(price => (validatePrice(price) === 'success'));

  /*Returns True if all form validation pass*/
  validateForm() {
    return (this.validateFolderPrices()
      && this.validateFilePrices()
      && this.validateName() === 'success'
      && this.state.files.length > 1
      && this.state.filesState === FileStates.ENCRYPTED);
  }

  /* builds a merkle tree from the file hashes and get the root*/
  getFolderID(){
    const hashes = this.state.files.map(file => file.hash);
    return merkle('sha256', false).sync(hashes).root();
  }

  /*--------------------------------- EVENT HANDLERS ---------------------------------*/

  /* Handles the files upload
  * */
  handleFilesUpload(uploadedFiles) {
    if (validateFiles(uploadedFiles)) {
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
      this.setState({ fileState: FileStates.NOT_ENCRYPTED })
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

  handleLicenceChange(newLicence) {
    this.setState({ licence: parseInt(newLicence, 10) });
  }

  handleFilePricesChange(licence, newPrice) {
    let newPrices = this.state.filePrices;
    newPrices[licence] = newPrice;
    this.setState({ filePrices: newPrices });
  }

  handleFolderPricesChange(licence, newPrice) {
    let newPrices = this.state.folderPrices;
    newPrices[licence] = newPrice;
    this.setState({ folderPrices: newPrices });
  }

  /*Encrypts the file using AES and the key produced by the owner*/
  encryptFolder(e) {
    e.preventDefault();
    const { files } = this.state;
    if (files.length > 0 && this.state.filesState === FileStates.NOT_ENCRYPTED) {
      this.setState({ filesState: FileStates.ENCRYPTING });
      // create master key for whole album from all files hash and then derive from it one key for each file
      const folderHash = this.getFolderID();
      generatePrivateKey(this.state.web3, folderHash).then(masterKey => { // Ask user to generate key
        return this.bundle.encryptFolder(files, masterKey); // Encrypt files and returns the IPFS locations of the result
      }).then(encryptedFiles => {
        const newFiles = files.map((file, i) => {
          return { ...file, ipfsLocation: encryptedFiles[i][0].hash };
        });
        this.setState({ filesState: FileStates.ENCRYPTED, files: newFiles, folderHash });
      });
    } else {
      window.dialog.showAlert("Please select a file.");
    }
  }

  /*Function that triggers the contract call to Deposit a patent*/
  submitFolder(e) {
    e.preventDefault();
    if (this.validateForm()) {
      this.setState({ waitingTransaction: true });
      const { folderName, folderHash, files, licence, etherPrice, gasPrice } = this.state;
      const filePrices = this.state.filePrices.slice(1, licence+1).map(parseFloat);
      const folderPrices = this.state.folderPrices.slice(1, licence+1).map(parseFloat);
      const nFiles = files.length;
      // register folder
      // TODO: use this function to also deppsit all the patents when solidity allows it
      this.state.contractInstance.depositFolder(folderName, folderHash, folderPrices, {
        from: this.state.web3.eth.accounts[0],
        gas: process.env.REACT_APP_GAS_LIMIT,
        gasPrice: gasPrice
      }).then(() => {
        // register patents
        [...Array(nFiles).keys()].forEach(i => {
          const completeName = files[i].name + '.' + files[i].ext;
          this.state.contractInstance.depositPatent(completeName, files[i].hash, folderHash, files[i].ipfsLocation, filePrices, {
            from: this.state.web3.eth.accounts[0],
            value: etherPrice,
            gas: 2*process.env.REACT_APP_GAS_LIMIT,
            gasPrice: gasPrice
          }).then(() => {
            return i===nFiles-1 ? this.bundle.addFiles() : []; // Add the encrypted file to IPFS
          }).then(filesAdded => {
            if (filesAdded.length > 1) {
              this.resetForm();
              window.dialog.show({
                title: "Folder successfully registered",
                body: "Encrypted files have been added to IPFS",
                actions: [Dialog.OKAction()],
                // bsSize: "large"
              });
            };
          }).catch(error => {
            this.setState({waitingTransaction: false});
            contractError(error); // Handles the error
          });
        });
      });
    };
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
        <form onSubmit={e => this.submitFolder(e)}>
          <FieldGroup name={Constants.FILE} id="formsControlsFile" label="Files" type="file" placeholder=""
                      multiple onChange={this.handleChange}/>
          <FieldGroup name="folderName" id="formsControlsName" label="Folder Name"
                      type="text" value={this.state.folderName} placeholder="Enter the folder name"
                      help="Max 100 chars" validation={this.validateName()}
                      onChange={this.handleChange} />
          <EncryptFileButton fileState={this.state.filesState} onClick={e => this.encryptFolder(e)} multiple
                             disabled={this.state.files.length < 2 || this.state.folderName === ''
                             || this.state.filesState !== FileStates.NOT_ENCRYPTED} />
          <br/><Divider/><br/>

          <LicencesMenu licence={this.state.licence} onLicenceChange={i => this.handleLicenceChange(i)}
                        validatePrice={validatePrice} prices={this.state.filePrices}
                        onPricesChange={(l, p) => this.handleFilePricesChange(l, p)}
                        label="Licence Selection and Individual Files Prices"/>
          <br/><Divider/><br/>
          <LicencesMenu licence={this.state.licence} onLicenceChange={i => this.handleLicenceChange(i)}
                        validatePrice={validatePrice} prices={this.state.folderPrices}
                        onPricesChange={(l, p) => this.handleFolderPricesChange(l, p)}
                        label="Licence Selection and Folder Prices"/>
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

const DepositFolder = wrapWithMetamask(DepositFolder_class, DepositFolder_class.header());
export default DepositFolder;

