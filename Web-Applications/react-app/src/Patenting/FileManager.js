import '../css/Pages.css'
import React, {Component} from 'react';
import {ListGroupItem, Button, ButtonGroup, Panel, Row, Col} from 'react-bootstrap';
import MuiDialog from '@material-ui/core/Dialog';
import Dialog from 'react-bootstrap-dialog';

import {generatePrivateKey} from '../utils/KeyGenerator'
import {
  KEY_GENERATION_ERROR,
  KEY_ERROR,
  IPFS_ERROR,
  ENCRYPTION_ERROR,
  contractError,
} from '../utils/ErrorHandler'
import {
  saveByteArray,
  successfullTx,
  validateName,
  validatePrice,
  validateFile,
  stampToDate
} from '../utils/UtilityFunctions'
import { BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import {FileStates} from '../utils/Constants'
import {getFileHash, publicKeyEncrypt} from '../utils/CryptoUtils'
import Bundle from '../utils/ipfsBundle'
import Paper from "@material-ui/core/Paper";
import {FieldGroup, LicencesMenu, SubmitButton, EncryptFileButton} from "../utils/FunctionalComponents";
import licences from "../utils/Licences";
import Divider from "@material-ui/core/Divider";
import sha256 from "sha256";


/* Component to manage an owned given patent, i.e. its requests and information */
// TODO: fetch all requests with their status and filter pending requests when displaying
class FileManager extends Component {

  /*Constructor with IPFS bundle*/
  constructor(props) {
    super(props);
    this.bundle = new Bundle();
    this.state = {
      patentsInstance: props.patentsInstance,
      requestsInstance: props.requestsInstance,
      web3: props.web3,
      patent: props.patent,
      pendingRequests: [],
      gasPrice : props.gasPrice,
      updatingPatent: false,
      addingVersion: false,
      waitingTransaction: false,
      newVersionPrice: 0,
      etherPrice : 0,
      newMaxLicence: props.patent.maxLicence,
      newName: props.patent.name.split('.')[0],
      newFile: "",
      newIpfsLocation: "",
      newVersionHash: "",
      newFileState: FileStates.NOT_ENCRYPTED,
      newLicencePrices: Array(Object.keys(licences).length).fill(''),
    };
    this.handleNameChange = this.handleNameChange.bind(this);
    this.handleLicenceChange = this.handleLicenceChange.bind(this);
    this.handlePricesChange = this.handlePricesChange.bind(this);
  }

  /*Called just after the component is mounted*/
  componentDidMount() {
    this.state.patentsInstance.newVersionPrice.call().then(price => {
      this.setState({ newVersionPrice: price.toNumber() });
      return this.state.patentsInstance.getEthPrice(price.toNumber());
    }).then(etherPrice => {
      this.setState({ etherPrice: etherPrice.toNumber() });
    });
    this.initPrices();
    this.fetchRequests(this.state.patent);
  }

  /*Called just after the component is updated when received new props*/
  componentDidUpdate(prevProps, prevState) {
    if (prevState.patent.id !== this.props.patent.id) {
      this.setState({ patent: this.props.patent });
      this.fetchRequests(this.props.patent);
      this.resetForm();
    }
  }

  /* reinitialise new prices by current patent prices */
  initPrices() {
    const newLicencePrices = Array(Object.keys(licences).length).fill('');
    this.state.patent.licencePrices.forEach((p, i) => newLicencePrices[i+1] = p);
    this.setState({ newLicencePrices });
  }

  /* Resets the form */
  resetForm() {
    this.initPrices();
    this.setState({
      waitingTransaction: false,
      newMaxLicence: this.state.patent.maxLicence,
      newName: this.state.patent.name.split('.')[0],
      newFile: "",
      newIpfsLocation: "",
      newFileState: FileStates.NOT_ENCRYPTED,
    })
  }

  handleLicenceChange(newLicence) {
    this.setState({ newMaxLicence: parseInt(newLicence, 10) });
  }

  handleNameChange(e) {
    e.preventDefault();
    this.setState({ newName: e.target.value });
  }

  handlePricesChange(licence, newPrice) {
    let newLicencePrices = this.state.newLicencePrices;
    newLicencePrices[licence] = newPrice;
    this.setState({ newLicencePrices });
  }

  handleFileChange(e) {
    e.preventDefault();
    let file = e.target.files[0];
    const nameSplit = file.name.split('.');
    const ext = nameSplit[nameSplit.length-1];
    if (ext !== this.state.patent.fileExt) {
      window.dialog.showAlert('The file must have the same extension than the first deposited document')
    }
    else if (validateFile(file)) {
      getFileHash(file, window).then(res => {
        this.setState({ newFile: file, newVersionHash: res, newFileState: FileStates.NOT_ENCRYPTED })
      }).catch(err => window.dialog.showAlert(err));
    }
  }

  updateLicences() {
    this.setState({ updatingPatent: true })
  }

  addVersion() {
    this.setState({ addingVersion: true })
  }

  closeForm() {
    this.setState({ updatingPatent: false });
    this.setState({ addingVersion: false });
    this.resetForm();
  }

  validateName = () => validateName(this.state.patent.name);

  /*Returns true if prices are valid and have changed*/
  validateUpdateForm() {
    const newLicencePrices = this.state.newLicencePrices.slice(1, this.state.newMaxLicence+1);
    return this.validateName() === 'success'
      && newLicencePrices.every(price => (validatePrice(price) === 'success'));
  }

  /*Returns true if prices are valid and have changed*/
  validateNewVersionForm() {
    return (this.state.newFile !== ""
      && this.state.newIpfsLocation !== ""
      && this.state.newFileState === FileStates.ENCRYPTED
    );
  }

  /*Fetches the pending requests for the given patent*/
  fetchRequests(patent) {
    let requests = [];
    this.setState({pendingRequests: []});
    for (let i = 0; i < patent.pendingRequesters.length; i++) {
      let request = {};
      request['account'] = patent.pendingRequesters[i];
      this.state.requestsInstance.getRequestedLicence.call(patent.id, request.account).then(licence => {
        request['requestedLicence'] = licence.toNumber();
        return this.state.requestsInstance.getAcceptedLicence.call(patent.id, request.account)
      }).then(licence => {
        request['acceptedLicence'] = licence.toNumber();
        return this.state.patentsInstance.getPrice.call(patent.id, request.requestedLicence)
      }).then(price => {
        request['price'] = price.toNumber();
        return this.state.requestsInstance.getEncryptionKey(patent.id, request.account)
      }).then(key => {
        request['key'] = key;
        requests.push(request);
        this.setState({ pendingRequests: requests });
      }).catch(contractError);
    }
  }

  /*--------------------------------- REQUEST ANSWER HANDLERS ---------------------------------*/

  /*Handler for accepting a given request : takes care of encrypting the key and communicating with the smart contract*/
  acceptRequest(request) {
    const patent = this.state.patent;
    if (request.acceptedLicence === 0) {
      generatePrivateKey(this.state.web3, patent.id, patent.folderID).then(key => {
        return publicKeyEncrypt(key, request.key);
      }).then(encrypted => {
        return this.state.requestsInstance.grantAccess(patent.id, request.account, encrypted, {
          from: this.state.web3.eth.accounts[0],
          gas: process.env.REACT_APP_GAS_LIMIT,
          gasPrice: this.state.gasPrice
        });
      }).then(tx => {
        successfullTx(tx);
        this.fetchRequests(patent);
      }).catch(e => {
        if (e === KEY_GENERATION_ERROR || e === ENCRYPTION_ERROR) {
          window.dialog.showAlert(e)
        } else {
          contractError(e)
        }
      })
    } else {
      this.state.requestsInstance.acceptRequest(patent.id, request.account, {
        from: this.state.web3.eth.accounts[0],
        gas: process.env.REACT_APP_GAS_LIMIT,
        gasPrice: this.state.gasPrice
      }).then(tx => {
        successfullTx(tx);
        this.fetchRequests(patent);
      }).catch(e => {
        contractError(e)
      })
    }
  }

  /*Handler for rejecting a given request */
  rejectRequest(request) {
    const patent = this.state.patent;
    this.state.requestsInstance.rejectRequest(patent.id, request.account, {
      from: this.state.web3.eth.accounts[0],
      gas: process.env.REACT_APP_GAS_LIMIT,
      gasPrice: this.state.gasPrice
    }).then(tx => {
      successfullTx(tx);
      this.fetchRequests(patent);
    }).catch(e => {
      contractError(e)
    })
  }

  /* Allows to accept all the pending requests */
  // TODO: modify so that owner only signs once to generate all needed keys
  acceptAllRequests() {
    this.state.pendingRequests.forEach(req => this.acceptRequest(req))
  }

  /* Allows to reject all the pending requests */
  rejectAllRequests() {
    this.state.pendingRequests.forEach(req => this.rejectRequest(req))
  }

  /*--------------------------------- DOWNLOAD HANDLER ---------------------------------*/

  /*Decrypts and downloads the file from IPFS the document*/
  downloadCopy(version) {
    const patent = this.state.patent;
    generatePrivateKey(this.state.web3, patent.id, patent.folderID).then(key => {
      if (patent.isFolder) {
        this.downloadFolder(key);
      }
      else {
        const ipfsLoc = patent.ipfsLocations[version];
        window.dialog.showAlert("Download will start shortly");
        this.bundle.getDecryptedFile(patent.id, ipfsLoc, key).then(buffer => {
          saveByteArray(patent.name, buffer, window, document);
        });
      }
    }).catch(e => {
      if (e === KEY_GENERATION_ERROR || e === KEY_ERROR || e === IPFS_ERROR) {
        window.dialog.showAlert(e)
      } else {
        contractError(e)
      }
    })
  }

  downloadFolder(aesKey) {
    const patents = this.state.patentsInstance;
    const folderID = this.state.patent.id;
    patents.getFolderSize.call(folderID).then(numPatents => {
      for (let i = 0; i < numPatents.toNumber(); i++) {
        let patent = {};
        patents.getPatentID.call(folderID, i).then(id => {
          patent['id'] = id;
          return patents.getPatentName.call(patent.id);
        }).then(name => {
          patent['name'] = name;
          return patents.getNumVersions.call(patent.id);
        }).then(numVersions => {
          const lastVersion = numVersions.toNumber()-1;
          return patents.getPatentLocation.call(patent.id, lastVersion);
        }).then(patentLocation => {
          const fileKey = sha256(aesKey + patent.id);
          return this.bundle.getDecryptedFile(patent.id, patentLocation, fileKey);
        }).then(buffer => saveByteArray(patent.name, buffer, window, document));
      }
    }).catch(e => {
      if (e === KEY_GENERATION_ERROR || e === KEY_ERROR || e === IPFS_ERROR || e === ENCRYPTION_ERROR) {
        window.dialog.showAlert(e)
      } else {
        contractError(e)
      }
    })
  }

  /*--------------------------------- UPDATE AND DELETE HANDLERS ---------------------------------*/

  /* Allows to delete a patent, i.e. hide it in the store
   * but by letting the ability for people having already bought it to download it */
  deletePatent() {
    window.dialog.show({
      body: "Please enter the patent name (with its extension) to confirm this action",
      bsSize: 'medium',
      prompt: Dialog.TextPrompt({placeholder: "Patent name"}),
      actions: [
        Dialog.CancelAction(),
        Dialog.OKAction(diag => {
          if (diag.value === this.state.patent.name) {
            this.state.patentsInstance.setVisibility(this.state.patent.id, {
              from: this.state.web3.eth.accounts[0],
              gas: process.env.REACT_APP_GAS_LIMIT,
              gasPrice: this.state.gasPrice
            }).then(tx => {
              successfullTx(tx);
              let patent = this.state.patent;
              patent.deleted = true;
              this.setState({ patent });
            }).catch(e => {
              contractError(e)
            });
          } else {
            window.dialog.showAlert('Invalid name. Please try again');
          }
        })
      ]
    });
  }

  /* Allows to undelete a patent
   * but by letting the ability for people having already bought it to download it */
  recoverPatent() {
    this.state.patentsInstance.setVisibility(this.state.patent.id, {
      from: this.state.web3.eth.accounts[0],
      gas: process.env.REACT_APP_GAS_LIMIT,
      gasPrice: this.state.gasPrice
    }).then(tx => {
      successfullTx(tx);
      let patent = this.state.patent;
      patent.deleted = false;
      this.setState({ patent });
    }).catch(e => {
      contractError(e)
    });
  }

  /* Function that triggers the contract call to update some patent information */
  submitUpdateForm(e) {
    e.preventDefault();
    const { patent, newName, newMaxLicence } = this.state;
    const newLicencePrices = this.state.newLicencePrices.slice(1, newMaxLicence + 1);
    const hasNotChanged = (newName === patent.name && newMaxLicence === patent.maxLicence
      && newLicencePrices.every((p, i) => patent.licencePrices[i] === p));
    if (hasNotChanged) {
      this.closeForm();
      window.dialog.showAlert("Please modify at least one information before submitting");
    }
    else if (this.validateUpdateForm()) {
      this.setState({ waitingTransaction: true });
      const split = patent.name.split('.');
      const newCompleteName = newName + '.' + split[split.length - 1];
      this.state.patentsInstance.modifyPatent(patent.id, newCompleteName, newLicencePrices, {
        from: this.state.web3.eth.accounts[0],
        gas: process.env.REACT_APP_GAS_LIMIT,
        gasPrice : this.state.gasPrice
      }).then(tx => {
        let patent = this.state.patent;
        patent.name = newCompleteName;
        patent.maxLicence = this.state.newMaxLicence;
        patent.licencePrices = newLicencePrices;
        this.setState({ patent });
        this.closeForm();
        successfullTx(tx);
      }).catch(error => {
        this.resetForm();
        contractError(error);
      });
    }
  }

  /*Encrypts the file using AES and the key produced by the owner*/
  encryptFile(e) {
    e.preventDefault();
    if (this.state.newFile !== "" && this.state.newFileState === FileStates.NOT_ENCRYPTED) {
      this.setState({ newFileState: FileStates.ENCRYPTING });
      generatePrivateKey(this.state.web3, this.state.patent.id).then(key => { // Ask user to generate key
        return this.bundle.encryptFile(this.state.newFile, key); // Encrypt file using the key and return the IPFS location
      }).then(files => {
        this.setState({ newIpfsLocation: files[0].path, newFileState: FileStates.ENCRYPTED })
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
  submitNewVersion(e) {
    e.preventDefault();
    // TODO: also store sha256 hashes to compare new version with all older ones ?
    if(this.state.newVersionHash === this.state.patent.id) {
      window.dialog.showAlert('Your version is identical to a previously uploaded one')
    }
    else if (this.validateNewVersionForm()) {
      this.setState({ waitingTransaction: true });
      this.state.patentsInstance.addVersion(this.state.patent.id, this.state.newIpfsLocation, {
        from: this.state.web3.eth.coinbase,
        value: this.state.etherPrice,
        gas: process.env.REACT_APP_GAS_LIMIT,
        gasPrice : this.state.gasPrice
      }).then(() => {
        return this.bundle.addFile() // Add the new encrypted file to IPFS
      }).then(filesAdded => {
        this.closeForm(); // reset and close the form
        window.dialog.show({
          title: "Encrypted file has been successfully added to IPFS",
          body: "New version IPFS location : ipfs.io/ipfs/" + filesAdded[0].path,
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
        this.closeForm();
        contractError(error); // Handles the error
      });
    }
  }

  /*--------------------------------- USER INTERFACE COMPONENTS ---------------------------------*/

  /*Renders the form to update a patent*/
  renderUpdateForm() {
    return (
      <Paper style={{ padding: 20 }}>
        <form onSubmit={e => this.submitUpdateForm(e)}>
          <FieldGroup name="patentName" id="formsControlsName" label="Patent Name"
                      type="text" value={this.state.newName} placeholder="New name"
                      validation={this.validateName()} onChange={this.handleNameChange} />
          <Divider/><br/>
          <LicencesMenu licence={this.state.newMaxLicence} onLicenceChange={this.handleLicenceChange}
                        validatePrice={validatePrice} prices={this.state.newLicencePrices}
                        onPricesChange={this.handlePricesChange} label="Licence Selection and Prices"/>
          <br/><Divider/><br/>
          <SubmitButton running={this.state.waitingTransaction} disabled={!this.validateUpdateForm()}/>
        </form>
      </Paper>
    );
  }

  /*Renders the form to update a patent*/
  renderNewVersionForm() {
    return (
      <Paper style={{ padding: 20 }}>
        <form onSubmit={e => this.submitNewVersion(e)}>
          <FieldGroup name="newFile" id="formsControlsFile" label="Please select a file" type="file" placeholder=""
                      onChange={e => this.handleFileChange(e)}/>
          <Divider/><br/>
          <EncryptFileButton fileState={this.state.newFileState} onClick={e => this.encryptFile(e)}
                             disabled={this.state.newFile === '' || this.state.newFileState !== FileStates.NOT_ENCRYPTED} />
          <br/>
          <SubmitButton running={this.state.waitingTransaction} disabled={!this.validateNewVersionForm()}/>
        </form>
      </Paper>
    );
  }

  renderButtons() {
    const isDeleted = this.state.patent.deleted;
    const lastVersion = this.state.patent.numVersions-1;
    const isFolder = this.state.patent.isFolder
    return (
      <ButtonGroup justified>
        <ButtonGroup>
          <Button style={{ borderRadius: 0 }} onClick={() => this.downloadCopy(lastVersion)}>Download Copy</Button>
        </ButtonGroup>
        <ButtonGroup>
          <Button style={{ borderRadius: 0 }} onClick={() => this.updateLicences()}>Update Info</Button>
        </ButtonGroup>
        {!isFolder && (
          <ButtonGroup>
            <Button style={{ borderRadius: 0 }} onClick={() => this.addVersion()}>Add Version</Button>
          </ButtonGroup>
        )}
        <ButtonGroup>
          <Button style={{ borderRadius: 0 }} onClick={() => isDeleted ? this.recoverPatent() : this.deletePatent()}>
            {(isDeleted ? "Recover" : "Delete") + (isFolder ? ' Folder ' : ' Patent')}
          </Button>
        </ButtonGroup>
      </ButtonGroup>
    );
  }

  // put a barchart instead
  renderRates() {
    const rates = this.state.patent.rates;
    const data = [...Array(5).keys()].map(i => (
      { rate: i+1, count: rates.filter(r => r === i+1).length }
    ));
    return (
      <div>
        <h4>{(this.state.patent.isFolder ? 'Folder' : 'Patent') + ' Rates'}</h4>
        {rates.length === 0 ? 'No ratings available for this patent' :
          <BarChart
            width={500}
            height={250}
            data={data}
            margin={{ top: 20 }}
          >
          <XAxis dataKey="rate" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="count" fill="#8884d8" />
          </BarChart>
        }
        {rates.length > 0 && "Average: " + rates.reduce((a, b) => a+b, 0) / rates.length + ' / 5'}
      </div>
    );
  }

  renderVersions() {
    const patent = this.state.patent;
    return (
      <div>
        <h4>Patent Versions</h4>
        <ButtonGroup vertical>
          {[...Array(patent.numVersions).keys()].map(i => {
            const v = i+1;
            return (
              <Button key={i} onClick={() => this.downloadCopy(i)}>
                {'Version ' + v + ': registered on ' + stampToDate(patent.timestamps[i])}
              </Button>
            )})}
        </ButtonGroup>
        <br/><br/><Divider/><br/>
      </div>
    );
  }

  /*Render pending requests as ListGroup*/
  renderRequests() {
    const numRequests = this.state.pendingRequests.length;
    const hasRequests = numRequests > 0;
    return (
      <div>
        <h4>{(this.state.patent.isFolder ? 'Folder' : 'Patent') + ' Requests'}</h4>
        <Row>
          <Col md={6}>
            {
              numRequests === 0
                ? 'No pending requests for this patent'
                : "You have " + numRequests + " pending request" + (numRequests > 1 ? 's' : '') + " for this patent"
            }
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
        {this.state.pendingRequests.map(req => (
          <ListGroupItem key={req.account}>
            <Row>
              <Col md={6}>New request for licence {req.requestedLicence} (price at {req.price} USD) from: {req.account}</Col>
              <Col md={6}>
                <ButtonGroup className="pull-right">
                  <Button onClick={() => this.acceptRequest(req)} bsStyle="success">Accept</Button>
                  <Button onClick={() => this.rejectRequest(req)} bsStyle="danger">Reject</Button>
                </ButtonGroup>
              </Col>
            </Row>
          </ListGroupItem>
        ))}
      </div>
    );
  }

  renderPanel() {
    return (
      <Panel className="request-list">
        <Panel.Heading>
          <Panel.Title className="request-title">{this.state.patent.name}</Panel.Title>
        </Panel.Heading>
        {this.renderButtons()}
        <Panel.Body>
          {this.renderRates()}
          <br/><Divider/><br/>
          {this.state.patent.numVersions > 1 && this.renderVersions()}
          {this.renderRequests()}
        </Panel.Body>
      </Panel>
    )
  }

  render() {
    return (
      <div>
        {this.renderPanel()}
        <MuiDialog disableEnforceFocus open={this.state.updatingPatent} onClose={() => this.closeForm()}>
          {this.renderUpdateForm()}
        </MuiDialog>
        <MuiDialog disableEnforceFocus open={this.state.addingVersion} onClose={() => this.closeForm()}>
          {this.renderNewVersionForm()}
        </MuiDialog>
      </div>
    )
  }
}

export default FileManager