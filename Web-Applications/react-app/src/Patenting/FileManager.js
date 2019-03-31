import '../css/Pages.css'
import React, {Component} from 'react';
import {ListGroupItem, Button, ButtonGroup, Panel, Row, Col} from 'react-bootstrap';
import {Constants, FileStates} from '../utils/Constants'
import Dialog from '@material-ui/core/Dialog';

import {generatePrivateKey} from '../utils/KeyGenerator'
import {
  NOT_PENDING,
  KEY_GENERATION_ERROR,
  KEY_ERROR,
  IPFS_ERROR,
  ENCRYPTION_ERROR,
  contractError,
  INVALID_FORM
} from '../utils/ErrorHandler'
import {saveByteArray, successfullTx, validateFile} from '../utils/UtilityFunctions'
import {publicKeyEncrypt} from '../utils/CryptoUtils'
import Bundle from '../utils/ipfsBundle'
import Paper from "@material-ui/core/Paper";
import {EncryptFileButton, FieldGroup, SubmitButton} from "../utils/FunctionalComponents";
import Divider from "@material-ui/core/Divider";


/*---------------------------------------------------------------------------------- DONE ----------------------------------------------------------------------------------*/


/*Component to manage the pendingRequests of a given patent*/
class FileManager extends Component {

  /*Constructor with IPFS bundle*/
  constructor(props) {
    super(props);
    this.bundle = new Bundle();
    this.state = {
      contractInstance: props.contractInstance,
      web3: props.web3,
      patent: props.patent,
      pendingRequests: [],
      gasPrice : props.gasPrice,
      updatingFile: false,
      newFile: {
        file: "",
        fileState: FileStates.NOT_ENCRYPTED,
        ipfsLocation: "",
        waitingTransaction: false,
      }
    };
  }

  /*Called whenever new props are passed or props are updated*/
  static getDerivedStateFromProps(nextProps, prevState) {
    if (nextProps.patent.name !== prevState.patent.name) {
      return ({
        contractInstance: prevState.contractInstance,
        web3: prevState.web3,
        patent: nextProps.patent,
        pendingRequests: []
      });

    }
    return null
  }

  /*Called before the component is mounted*/
  componentDidMount() {
    this.fetchRequests(this.state.patent);
  }

  /*Called after the state is changed to update the pendingRequests when a new props is passed*/
  componentDidUpdate(prevProps, prevState) {
    if (this.state.pendingRequests.length === 0) {
      this.fetchRequests(this.state.patent);
    }
  }

  /* Resets the form */
  resetForm() {
    this.setState({
      newFile: {
        file: "",
        fileState: FileStates.NOT_ENCRYPTED,
        ipfsLocation: "",
        waitingTransaction: false,
      }
    })
  }

  /*Fetches the pending pendingRequests for the given patent*/
  fetchRequests(patent) {
    let numReq = patent.numRequests;
    for (let i = 0; i < numReq; i++) {
      let user;
      this.state.contractInstance.getBuyers.call(patent.name, i).then(_user => {
        user = _user;
        return this.state.contractInstance.isPending.call(patent.name, user)
      }).then(isPending => {
        if (isPending) {
          return this.state.contractInstance.getEncryptionKey(patent.name, user, {from: this.state.web3.eth.coinbase})
        } else {
          throw Error(NOT_PENDING);
        }
      }).then(key => {
        let requests = this.state.pendingRequests;
        requests.push({'account': user, 'key': key});
        this.setState({pendingRequests: requests});
      }).catch(e => {
        if (e.message !== NOT_PENDING) {
          contractError(e);
        }
      })
    }
  }

  /*--------------------------------- EVENT HANDLERS ---------------------------------*/

  /*Handler for accepting a given request : takes care of encrypting the key and communicating with the smart contract*/
  acceptRequest(request) {
    generatePrivateKey(this.state.web3, this.state.patent.hash).then(key => {
      return publicKeyEncrypt(key, request.key);
    }).then(encrypted => {
      return this.state.contractInstance.grantAccess(this.state.patent.name, request.account, encrypted, {
        from: this.state.web3.eth.coinbase,
        gas: process.env.REACT_APP_GAS_LIMIT,
        gasPrice : this.state.gasPrice
      });
    }).then(tx => {
      setTimeout(() => this.setState({pendingRequests: []}), 4000);
      successfullTx(tx);
    }).catch(e => {
      if (e === KEY_GENERATION_ERROR || e === ENCRYPTION_ERROR) {
        window.dialog.showAlert(e)
      } else {
        contractError(e)
      }
    })
  }

  /*Handler for rejecting a given request */
  rejectRequest(request) {
    this.state.contractInstance.rejectAccess(this.state.patent.name, request.account, {
      from: this.state.web3.eth.coinbase,
      gas: process.env.REACT_APP_GAS_LIMIT,
      gasPrice : this.state.gasPrice
    }).then(tx => {
      setTimeout(() => this.setState({pendingRequests: []}), 4000);
      successfullTx(tx)
    }).catch(e => {
      contractError(e)
    })
  }

  /* Allows to accept all the pending requests */
  acceptAllRequests() {
    this.state.pendingRequests.forEach(req => this.acceptRequest(req))
  }

  /* Allows to reject all the pending requests */
  rejectAllRequests() {
    this.state.pendingRequests.forEach(req => this.rejectRequest(req))
  }

  /*--------------------------------- DOWNLOAD HANDLER ---------------------------------*/

  /*Decrypts and downloads the file from IPFS the document*/
  downloadCopy() {
    console.log('download at', this.state.patent);
    const hash = this.state.patent.hash;
    generatePrivateKey(this.state.web3, hash).then(key => {
      const ipfsLoc = this.state.patent.ipfsLocation;
      window.dialog.showAlert("Download will start shortly");
      return this.bundle.getDecryptedFile(hash, ipfsLoc, key)
    }).then(bytes => {
      saveByteArray(this.state.patent.name, bytes, window, document)
    }).catch(e => {
      if (e === KEY_GENERATION_ERROR || e === KEY_ERROR || e === IPFS_ERROR) {
        window.dialog.showAlert(e)
      } else {
        contractError(e)
      }
    })
  }

  /*--------------------------------- UPDATE HANDLERS ---------------------------------*/

  /* Allows to open a dialog to update a patent file, re encrypt it unsing the key, update the IPFS location of the patent,
   * and notify other users that have already bought the patent than the file has been updated */
  updateFile() {
    this.setState({ updatingFile: true })
  }

  closeForm() {
    this.setState({ updatingFile: false })
    this.resetForm();
  }

  /* Handles uploading of the new file
  * */
  handleFileChange(e) {
    e.preventDefault();
    let file = e.target.files[0];
    if (validateFile(file)) {
      this.setState({ newFile: { ...this.state.newFile, file, fileState: FileStates.NOT_ENCRYPTED } });
    }
  }

  /*Returns True if all form validation pass*/
  validateForm() {
    return (this.state.newFile.ipfsLocation !== "" && this.state.newFile.fileState === FileStates.ENCRYPTED)
  }

  /*Encrypts the file using AES and the key produced by the owner*/
  encryptFile(e) {
    e.preventDefault();
    if (this.state.newFile.file !== "" && this.state.newFile.fileState === FileStates.NOT_ENCRYPTED) {
      this.setState({ newFile: { ...this.state.newFile, fileState: FileStates.ENCRYPTING } });
      generatePrivateKey(this.state.web3, this.state.patent.hash).then(key => { // Ask user to regenerate key
        return this.bundle.encryptFile(this.state.newFile.file, key); // Encrypt file using the key and return the IPFS hash of the result
      }).then(files => {
        this.setState({ newFile: { ...this.state.newFile, ipfsLocation: files[0].path, fileState: FileStates.ENCRYPTED } })
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

  /* Function that triggers the contract call to update the IPFS location of the new file */
  submitFile(e) {
    e.preventDefault();
    if (this.validateForm()) {
      this.setState({ newFile: { ...this.state.newFile, waitingTransaction: true } });
      console.log('Adding to:', this.state.newFile.ipfsLocation);
      this.state.contractInstance.setIpfsLocation.call(this.state.patent.name, this.state.newFile.ipfsLocation, {
        from: this.state.web3.eth.coinbase, //coinbase?
        gas: process.env.REACT_APP_GAS_LIMIT,
        gasPrice : this.state.gasPrice
      }).then(tx => {
        return this.bundle.addFile() // Add the new encrypted file to IPFS
      }).then(filesAdded => {
        // this.setState({ patent: { ...this.state.patent, ipfsLocation: filesAdded[0].path } })
        console.log('new IPFS loc: ', filesAdded[0].path);
        this.closeForm(); // reset and close the form
        /*window.dialog.show({
          title: "Encrypted file has been successfully added to IPFS",
          body: "New IPFS location : ipfs.io/ipfs/" + filesAdded[0].path,
          actions: [
            Dialog.OKAction(),
            Dialog.Action(
              'View encrypted File',
              () => {
                let win = window.open("https://ipfs.io/ipfs/" + filesAdded[0].path);
                win.focus();
              })],
          bsSize: "large"
        });*/
      }).catch(error => {
        this.setState({ newFile: { ...this.state.newFile, waitingTransaction: false } });
        contractError(error); // Handles the error
      });
    } else {
      if (this.state.newFile.file !== "" && this.state.newFile.fileState === FileStates.NOT_ENCRYPTED) {
        window.dialog.showAlert("Please encrypt the file")
      } else {
        window.dialog.showAlert(INVALID_FORM);
      }

    }
  }

  /*--------------------------------- DELETE HANDLERS ---------------------------------*/

  /* Allows to delete a patent by hiding it in the store
   * but by letting the ability for people having already bought it to download it */
  deletePatent() {

  }


  /*--------------------------------- USER INTERFACE COMPONENTS ---------------------------------*/

  /*Renders the form to update a patent*/
  renderForm() {
    return (
      <Paper style={{ padding: 20 }}>
        <form onSubmit={e => this.submitFile(e)}>
          <FieldGroup name={Constants.FILE} id="formsControlsFile" label="New file" type="file" placeholder=""
                      onChange={e => this.handleFileChange(e)}/>
          <Divider/><br/>
          <EncryptFileButton fileState={this.state.newFile.fileState} onClick={e => this.encryptFile(e)}
                             disabled={this.state.newFile.fileState !== FileStates.NOT_ENCRYPTED} />
          <br/>
          <SubmitButton running={this.state.newFile.waitingTransaction} disabled={!this.validateForm()}/>
        </form>
      </Paper>
    );
  }

  /*Render pending requests as ListGroup*/
  renderRequests() {
    return this.state.pendingRequests.map(req => (
      <ListGroupItem key={req.account}>
        <Row>
          <Col md={6}>From: {req.account}</Col>
          <Col md={6}>
            <ButtonGroup className="pull-right">
              <Button onClick={() => this.acceptRequest(req)} bsStyle="success">Accept</Button>
              <Button onClick={() => this.rejectRequest(req)} bsStyle="danger">Reject</Button>
            </ButtonGroup>
          </Col>
        </Row>
      </ListGroupItem>
    ))
  }

  renderPanel() {
    const hasRequests = this.state.pendingRequests.length > 0;
    return (
      <Panel className="request-list">
        <Panel.Heading>
          <Panel.Title className="request-title">{this.state.patent.name}</Panel.Title>
        </Panel.Heading>
        <ButtonGroup justified>
          <ButtonGroup>
            <Button style={{ borderRadius: 0 }} onClick={() => this.downloadCopy()}>Download a copy</Button>
          </ButtonGroup>
          <ButtonGroup>
            <Button style={{ borderRadius: 0 }} onClick={() => this.updateFile()}>Update file</Button>
          </ButtonGroup>
          <ButtonGroup>
            <Button style={{ borderRadius: 0 }} onClick={() => this.deletePatent()}>Delete patent</Button>
          </ButtonGroup>
        </ButtonGroup>
        <Panel.Body>
          <Row>
            <Col md={6}>
              You have {this.state.pendingRequests.length} pending
              request{this.state.pendingRequests.length > 1 ? 's' : ''} for this file
            </Col>
            <Col md={6}>
              <ButtonGroup className="pull-right">
                <Button onClick={() => this.acceptAllRequests()} bsStyle="success" disabled={!hasRequests}>
                  Accept all
                </Button>
                <Button onClick={() => this.rejectAllRequests()} bsStyle="danger" disabled={!hasRequests}>
                  Reject all
                </Button>
              </ButtonGroup>
            </Col>
          </Row>
          {hasRequests && <br/>}
          {this.renderRequests()}
        </Panel.Body>
      </Panel>
    )
  }

  render() {
    console.log(this.state.patent);
    return (
      <div>
        {this.renderPanel()}
        <Dialog open={this.state.updatingFile} onClose={() => this.closeForm()}>
          {this.renderForm()}
        </Dialog>
      </div>
    )
  }
}

export default FileManager