import '../css/Pages.css'
import React, {Component} from 'react';
import {ListGroupItem, Button, ButtonGroup, Panel, Row, Col} from 'react-bootstrap';

import MuiDialog from '@material-ui/core/Dialog';
import Dialog from 'react-bootstrap-dialog';

import {generatePrivateKey} from '../utils/KeyGenerator'
import {
  NOT_PENDING,
  KEY_GENERATION_ERROR,
  KEY_ERROR,
  IPFS_ERROR,
  ENCRYPTION_ERROR,
  contractError,
} from '../utils/ErrorHandler'
import {saveByteArray, successfullTx, validatePrice} from '../utils/UtilityFunctions'
import {publicKeyEncrypt} from '../utils/CryptoUtils'
import Bundle from '../utils/ipfsBundle'
import Paper from "@material-ui/core/Paper";
import {LicencesMenu, SubmitButton} from "../utils/FunctionalComponents";
import licences from "../utils/Licences";
import Divider from "@material-ui/core/Divider";


/* Component to manage an owned given patent, i.e. its requests and information */
class FileManager extends Component {

  /*Constructor with IPFS bundle*/
  constructor(props) {
    super(props);
    this.hideDetails = props.hideDetails;
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
      newLicencePrices: Array(Object.keys(licences).length).fill(''),
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

  /*Called just after the component is mounted*/
  componentDidMount() {
    this.fetchRequests(this.state.patent);
    this.initPrices();
  }

  /*Called after the state is changed to update the pendingRequests when a new props is passed*/
  componentDidUpdate(prevProps, prevState) {
    if (this.state.pendingRequests.length === 0) {
      this.fetchRequests(this.state.patent);
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
    })
  }

  handleLicenceChange(newLicence) {
    this.setState({ newMaxLicence: parseInt(newLicence, 10) });
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

  /*Returns true if prices are valid and have changed*/
  validateForm() {
    const newLicencePrices = this.state.newLicencePrices.slice(1, this.state.newMaxLicence+1);
    return newLicencePrices.every(price => (validatePrice(price) === 'success'));
  }

  /*Fetches the pending pendingRequests for the given patent*/
  fetchRequests(patent) {
    let numReq = patent.numRequests;
    for (let i = 0; i < numReq; i++) {
      let request = {};
      this.state.contractInstance.getBuyers.call(patent.name, i).then(user => {
        request['account'] = user;
        return this.state.contractInstance.getRequestedLicence.call(patent.name, request['account'])
      }).then(licence => {
        request['requestedLicence'] = licence.toNumber();
        return this.state.contractInstance.getAcceptedLicence.call(patent.name, request['account'])
      }).then(licence => {
        request['acceptedLicence'] = licence.toNumber();
        return this.state.contractInstance.getPrice.call(patent.name, request['requestedLicence'])
      }).then(price => {
        request['price'] = price.toNumber();
        return this.state.contractInstance.isPending.call(patent.name, request['account'])
      }).then(isPending => {
        if (isPending) {
          return this.state.contractInstance.getEncryptionKey(patent.name, request['account'], {
            from: this.state.web3.eth.accounts[0]
          });
        } else {
          throw Error(NOT_PENDING);
        }
      }).then(key => {
        request['key'] = key;
        let requests = this.state.pendingRequests;
        requests.push(request);
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
    if (request.acceptedLicence === 0) {
      generatePrivateKey(this.state.web3, this.state.patent.hash).then(key => {
        return publicKeyEncrypt(key, request.key);
      }).then(encrypted => {
        return this.state.contractInstance.grantAccess(this.state.patent.name, request.account, encrypted, {
          from: this.state.web3.eth.accounts[0],
          gas: process.env.REACT_APP_GAS_LIMIT,
          gasPrice: this.state.gasPrice
        });
      }).then(tx => {
        setTimeout(() => this.setState({pendingRequests: []}), 3000); // this.fetchRequests(this.state.patent)
        successfullTx(tx);
      }).catch(e => {
        if (e === KEY_GENERATION_ERROR || e === ENCRYPTION_ERROR) {
          window.dialog.showAlert(e)
        } else {
          contractError(e)
        }
      })
    } else {
      this.state.contractInstance.acceptUpgrade(this.state.patent.name, request.account, {
        from: this.state.web3.eth.accounts[0],
        gas: process.env.REACT_APP_GAS_LIMIT,
        gasPrice: this.state.gasPrice
      }).then(tx => {
        setTimeout(() => this.setState({pendingRequests: []}), 3000);
        successfullTx(tx);
      }).catch(e => {
        contractError(e)
      })
    }
  }

  /*Handler for rejecting a given request */
  rejectRequest(request) {
    const reject = request.acceptedLicence === 0
      ? this.state.contractInstance.rejectAccess
      : this.state.contractInstance.rejectUpgrade;
    reject(this.state.patent.name, request.account, {
      from: this.state.web3.eth.accounts[0],
      gas: process.env.REACT_APP_GAS_LIMIT,
      gasPrice: this.state.gasPrice
    }).then(tx => {
      setTimeout(() => this.setState({pendingRequests: []}), 3000);
      successfullTx(tx)
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

  /*--------------------------------- UPDATE AND DELETE HANDLERS ---------------------------------*/

  /* Allows to delete a patent, i.e. hide it in the store
   * but by letting the ability for people having already bought it to download it */
  deletePatent() {
    window.dialog.show({
      body: "Please enter the patent name to confirm this action",
      bsSize: 'medium',
      prompt: Dialog.TextPrompt({placeholder: "Patent name"}),
      actions: [
        Dialog.CancelAction(),
        Dialog.OKAction(diag => {
          if (diag.value === this.state.patent.name) {
            this.state.contractInstance.deletePatent(this.state.patent.name, {
              from: this.state.web3.eth.accounts[0],
              gas: process.env.REACT_APP_GAS_LIMIT,
              gasPrice: this.state.gasPrice
            }).then(tx => {
              successfullTx(tx);
              let patent = this.state.patent;
              patent.deleted = true;
              this.setState({ patent });
              // this.hideDetails();
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
    this.state.contractInstance.undeletePatent(this.state.patent.name, {
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

  // TODO: allow modify patent name when patents will be indexed by their hash
  /* Function that triggers the contract call to update some patent information */
  submitForm(e) {
    e.preventDefault();
    const newLicencePrices = this.state.newLicencePrices.slice(1, this.state.newMaxLicence+1);
    const hasNotChanged = (this.state.newMaxLicence === this.state.patent.maxLicence
      && newLicencePrices.every((p, i) => this.state.patent.licencePrices[i] === p));
    if (hasNotChanged) {
      this.closeForm();
      window.dialog.showAlert("Please modify at least one licence or price before submitting");
    }
    else if (this.validateForm()) {
      this.setState({ waitingTransaction: true });
      this.state.contractInstance.modifyPatent(this.state.patent.name, this.state.newMaxLicence, newLicencePrices, {
        from: this.state.web3.eth.accounts[0],
        gas: process.env.REACT_APP_GAS_LIMIT,
        gasPrice : this.state.gasPrice
      }).then(tx => {
        let patent = this.state.patent;
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
          <LicencesMenu licence={this.state.newMaxLicence} onLicenceChange={i => this.handleLicenceChange(i)}
                        validatePrice={validatePrice} prices={this.state.newLicencePrices}
                        onPricesChange={(l, p) => this.handlePricesChange(l, p)}/>
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
    ))
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