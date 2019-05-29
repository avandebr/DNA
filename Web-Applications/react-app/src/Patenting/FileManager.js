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
import {saveByteArray, successfullTx, validateName, validatePrice} from '../utils/UtilityFunctions'
import {publicKeyEncrypt} from '../utils/CryptoUtils'
import Bundle from '../utils/ipfsBundle'
import Paper from "@material-ui/core/Paper";
import {FieldGroup, LicencesMenu, SubmitButton} from "../utils/FunctionalComponents";
import licences from "../utils/Licences";
import Divider from "@material-ui/core/Divider";


/* Component to manage an owned given patent, i.e. its requests and information */
// TODO: fetch all requests with their status and filter pending requests when displaying
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
      updatingPatent: false,
      waitingTransaction: false,
      newMaxLicence: props.patent.maxLicence,
      newName: props.patent.name.split('.')[0],
      newLicencePrices: Array(Object.keys(licences).length).fill(''),
    };
    this.handleNameChange = this.handleNameChange.bind(this);
    this.handleLicenceChange = this.handleLicenceChange.bind(this);
    this.handlePricesChange = this.handlePricesChange.bind(this);
  }

  /*Called just after the component is mounted*/
  componentDidMount() {
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

  updateLicences() {
    this.setState({ updatingPatent: true })
  }

  closeForm() {
    this.setState({ updatingPatent: false });
    this.resetForm();
  }

  validateName = () => validateName(this.state.patent.name);

  /*Returns true if prices are valid and have changed*/
  validateForm() {
    const newLicencePrices = this.state.newLicencePrices.slice(1, this.state.newMaxLicence+1);
    return this.validateName() === 'success'
      && newLicencePrices.every(price => (validatePrice(price) === 'success'));
  }

  /*Fetches the pending requests for the given patent*/
  fetchRequests(patent) {
    let requests = [];
    this.setState({pendingRequests: []});
    for (let i = 0; i < patent.numRequests; i++) {
      let request = {};
      this.state.contractInstance.getBuyers.call(patent.id, i).then(user => {
        request['account'] = user;
        return this.state.contractInstance.isPending.call(patent.id, request.account)
      }).then(isPending => {
        if (isPending) {
          this.state.contractInstance.getRequestedLicence.call(patent.id, request.account).then(licence => {
            request['requestedLicence'] = licence.toNumber();
            return this.state.contractInstance.getAcceptedLicence.call(patent.id, request.account)
          }).then(licence => {
            request['acceptedLicence'] = licence.toNumber();
            return this.state.contractInstance.getPrice.call(patent.id, request.requestedLicence)
          }).then(price => {
            request['price'] = price.toNumber();
            return this.state.contractInstance.getEncryptionKey(patent.id, request.account, {
              from: this.state.web3.eth.accounts[0]
            })
          }).then(key => {
            request['key'] = key;
            requests.push(request);
            this.setState({pendingRequests: requests});
          });
        }
      }).catch(contractError);
    }
  }

  /*--------------------------------- EVENT HANDLERS ---------------------------------*/

  /*Handler for accepting a given request : takes care of encrypting the key and communicating with the smart contract*/
  acceptRequest(request) {
    if (request.acceptedLicence === 0) {
      generatePrivateKey(this.state.web3, this.state.patent.id).then(key => {
        return publicKeyEncrypt(key, request.key);
      }).then(encrypted => {
        return this.state.contractInstance.grantAccess(this.state.patent.id, request.account, encrypted, {
          from: this.state.web3.eth.accounts[0],
          gas: process.env.REACT_APP_GAS_LIMIT,
          gasPrice: this.state.gasPrice
        });
      }).then(tx => {
        successfullTx(tx);
        this.fetchRequests(this.state.patent);
      }).catch(e => {
        if (e === KEY_GENERATION_ERROR || e === ENCRYPTION_ERROR) {
          window.dialog.showAlert(e)
        } else {
          contractError(e)
        }
      })
    } else {
      this.state.contractInstance.acceptRequest(this.state.patent.id, request.account, {
        from: this.state.web3.eth.accounts[0],
        gas: process.env.REACT_APP_GAS_LIMIT,
        gasPrice: this.state.gasPrice
      }).then(tx => {
        successfullTx(tx);
        this.fetchRequests(this.state.patent);
      }).catch(e => {
        contractError(e)
      })
    }
  }

  /*Handler for rejecting a given request */
  rejectRequest(request) {
    this.state.contractInstance.rejectRequest(this.state.patent.id, request.account, {
      from: this.state.web3.eth.accounts[0],
      gas: process.env.REACT_APP_GAS_LIMIT,
      gasPrice: this.state.gasPrice
    }).then(tx => {
      successfullTx(tx);
      this.fetchRequests(this.state.patent);
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
  downloadCopy() {
    const hash = this.state.patent.id;
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
            this.state.contractInstance.setVisibility(this.state.patent.id, {
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
  undeletePatent() {
    this.state.contractInstance.setVisibility(this.state.patent.id, {
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
  submitForm(e) {
    e.preventDefault();
    const { patent, newName, newMaxLicence } = this.state;
    const newLicencePrices = this.state.newLicencePrices.slice(1, newMaxLicence + 1);
    const hasNotChanged = (newName === patent.name && newMaxLicence === patent.maxLicence
      && newLicencePrices.every((p, i) => patent.licencePrices[i] === p));
    if (hasNotChanged) {
      this.closeForm();
      window.dialog.showAlert("Please modify at least one information before submitting");
    }
    else if (this.validateForm()) {
      this.setState({ waitingTransaction: true });
      const split = patent.name.split('.');
      const newCompleteName = newName + '.' + split[split.length - 1];
      this.state.contractInstance.modifyPatent(patent.id, newCompleteName, newMaxLicence, newLicencePrices, {
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

  /*--------------------------------- USER INTERFACE COMPONENTS ---------------------------------*/

  /*Renders the form to update a patent*/
  renderForm() {
    return (
      <Paper style={{ padding: 20 }}>
        <form onSubmit={e => this.submitForm(e)}>
          <FieldGroup name="patentName" id="formsControlsName" label="Patent Name"
                      type="text" value={this.state.newName} placeholder="New name"
                      validation={this.validateName()} onChange={this.handleNameChange} />
          <Divider/><br/>
          <LicencesMenu licence={this.state.newMaxLicence} onLicenceChange={this.handleLicenceChange}
                        validatePrice={validatePrice} prices={this.state.newLicencePrices}
                        onPricesChange={this.handlePricesChange}/>
          <br/><Divider/><br/>
          <SubmitButton running={this.state.waitingTransaction} disabled={!this.validateForm()}/>
        </form>
      </Paper>
    );
  }

  /*Render pending requests as ListGroup*/
  renderRequests() {
    return this.state.pendingRequests.map(req => (
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
    ));
  }

  renderPanel() {
    const hasRequests = this.state.pendingRequests.length > 0;
    const isDeleted = this.state.patent.deleted;
    return (
      <Panel className="request-list">
        <Panel.Heading>
          <Panel.Title className="request-title">{this.state.patent.name}</Panel.Title>
        </Panel.Heading>
        <ButtonGroup justified>
          <ButtonGroup>
            <Button style={{ borderRadius: 0 }} onClick={() => this.downloadCopy()}>Download copy</Button>
          </ButtonGroup>
          <ButtonGroup>
            <Button style={{ borderRadius: 0 }} onClick={() => this.updateLicences()}>Update info</Button>
          </ButtonGroup>
          <ButtonGroup>
            <Button style={{ borderRadius: 0 }} onClick={() => isDeleted ? this.undeletePatent() : this.deletePatent()}>
              {(isDeleted ? "Undelete" : "Delete") + " patent"}
            </Button>
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
    return (
      <div>
        {this.renderPanel()}
        <MuiDialog disableEnforceFocus open={this.state.updatingPatent} onClose={() => this.closeForm()}>
          {this.renderForm()}
        </MuiDialog>
      </div>
    )
  }
}

export default FileManager