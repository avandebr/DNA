import '../css/Pages.css'
import React, {Component} from 'react';
import {Button, ButtonGroup, Panel, Label} from 'react-bootstrap';
import {getStatusString, RequestStatus} from '../utils/Constants';
import {saveByteArray, successfullTx} from '../utils/UtilityFunctions';
import {privateKeyDecrypt} from '../utils/CryptoUtils'
import {contractError, KEY_GENERATION_ERROR, IPFS_ERROR, KEY_ERROR, ENCRYPTION_ERROR} from "../utils/ErrorHandler";
import sha256 from 'sha256';
import {generatePrivateKey} from '../utils/KeyGenerator';
import MuiDialog from "@material-ui/core/Dialog";
import Paper from "@material-ui/core/Paper";
import {LicenceSelector, RateSelector, SubmitButton} from "../utils/FunctionalComponents";

/*Component that represents a single request and implements the actions based on the state*/

class RequestPanel extends Component {

  constructor(props) {
    super(props);
    this.bundle = props.bundle;
    this.state = {
      web3: props.web3,
      requestsInstance: props.requestsInstance,
      patentsInstance: props.patentsInstance,
      request: props.request,
      displayLicencesForm: false,
      displayRatesForm: false,
      requestedLicence: props.request.acceptedLicence + 1,
      rate: props.request.rate,
      gasPrice : props.gasPrice,
      waitingTransaction: false,
    };
    this.downloadCopy = this.downloadCopy.bind(this);
    this.cancelRequest = this.cancelRequest.bind(this);
    this.selectLicence = this.selectLicence.bind(this);
    this.selectRate = this.selectRate.bind(this);
  }

  handleChange(e) {
    e.preventDefault();
    this.setState({ [e.target.name]: e.target.value });
  }

  closeForm() {
    this.setState({
      waitingTransaction: false,
      displayLicencesForm: false,
      requestedLicence: this.state.request.acceptedLicence + 1,
      displayRatesForm: false,
      rate: this.state.request.rate,
    });
  }

  downloadFolder(aesKey) {
    const patents = this.state.patentsInstance;
    const folderID = this.state.request.patentID;
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
          const lastVersion = numVersions.toNumber() - 1;
          return patents.getPatentLocation.call(patent.id, lastVersion);
        }).then(patentLocation => {
          const fileKey = sha256(aesKey + patent.id);
          return this.bundle.getDecryptedFile(patent.id, patentLocation, fileKey);
        }).then(buffer => saveByteArray(patent.name, buffer, window, document));
      }
    });
  }

  /*To download a copy of the file if it is authorized*/
  downloadCopy(version) {
    const request = this.state.request;
    generatePrivateKey(this.state.web3, request.patentID).then(privateKey => {
      this.state.requestsInstance.getEncryptedIpfsKey.call(request.patentID, {
        from: this.state.web3.eth.accounts[0]
      }).then(encryptedKey => {
        return privateKeyDecrypt(encryptedKey, privateKey);
      }).then(aesKey => {
        window.dialog.showAlert("Download will start shortly");
        if (request.isFromFolder) {
          this.downloadFolder(aesKey);
        } else {
          const ipfsLoc = request.patentLocations[version];
          this.bundle.getDecryptedFile(request.patentID, ipfsLoc, aesKey).then(buffer => {
            saveByteArray(request.patentName, buffer, window, document)
          });
        }
      })
    }).catch(e => {
      if (e === KEY_GENERATION_ERROR || e === KEY_ERROR || e === IPFS_ERROR || e === ENCRYPTION_ERROR) {
        window.dialog.showAlert(e)
      } else {
        contractError(e)
      }
    })
  }

  /* Show the form to upgrade the licence for a previously accepted request */
  selectLicence() {
    const request = this.state.request;
    if (request.status === RequestStatus.ACCEPTED) {
      if (request.acceptedLicence === request.patentMaxLicence) {
        window.dialog.showAlert('You already have access to the best licence for this file');
      } else {
        this.setState({displayLicencesForm: true});
      }
    } else if (request.status === RequestStatus.REJECTED || request.status === RequestStatus.CANCELLED) {
      this.setState({displayLicencesForm: true});
    }
  }

  /* Show the form to upgrade the licence for a previously accepted request */
  selectRate() {
    const request = this.state.request;
    if (request.acceptedLicence > 0) {
      this.setState({ displayRatesForm: true });
    }
  }

  /*Cancels a request*/
  cancelRequest() {
    let request = this.state.request;
    this.setState({ waitingTransaction: true });
    this.state.requestsInstance.cancelRequest(request.patentID, {
      from: this.state.web3.eth.accounts[0],
      gas: process.env.REACT_APP_GAS_LIMIT,
      gasPrice : this.state.gasPrice
    }).then(tx => {
      successfullTx(tx);
      if (request.acceptedLicence > 0) {
        request.status = RequestStatus.ACCEPTED;
      } else {
        request.status = RequestStatus.CANCELLED;
      }
      this.setState({ request });
    }).catch(contractError)
  }

  /*Resend a request*/
  resendRequest(e) {
    e.preventDefault();
    let { request, requestedLicence } = this.state;
    let price = request.patentEthPrices[requestedLicence-1];
    if (request.acceptedLicence > 0) {
      price -= request.patentEthPrices[request.acceptedLicence-1];
    }
    if (requestedLicence > request.acceptedLicence) {
      this.setState({ waitingTransaction: true });
      this.state.requestsInstance.resendRequest(request.patentID, requestedLicence, {
        from: this.state.web3.eth.accounts[0],
        value: price,
        gas: process.env.REACT_APP_GAS_LIMIT,
        gasPrice : this.state.gasPrice
      }).then(tx => {
        this.closeForm();
        successfullTx(tx);
        request.status = RequestStatus.PENDING;
        request.requestedLicence = requestedLicence;
        this.setState({ request });
      }).catch(contractError);
    } else {
      window.dialog.showAlert('Invalid selected licence');
    }
  }

  ratePatent(e) {
    e.preventDefault();
    let { request, rate } = this.state;
    if (request.acceptedLicence > 0) {
      this.setState({ waitingTransaction: true });
      this.state.patentsInstance.ratePatent(request.patentID, rate, {
        from: this.state.web3.eth.accounts[0],
        gas: process.env.REACT_APP_GAS_LIMIT,
        gasPrice : this.state.gasPrice
      }).then(tx => {
        this.closeForm();
        successfullTx(tx);
      }).catch(contractError);
    }
  }

  /*--------------------------------- USER INTERFACE COMPONENTS ---------------------------------*/

  renderLicencesForm() {
    return (
      <Paper style={{ padding: 20 }}>
        <form onSubmit={e => this.resendRequest(e)}>
          <LicenceSelector prices={this.state.request.patentPrices} actualLicence={this.state.request.acceptedLicence}
                           onLicenceChange={e => this.handleChange(e)} />
          <SubmitButton running={this.state.waitingTransaction} />
        </form>
      </Paper>
    );
  }

  renderRatesForm() {
    return (
      <Paper style={{ padding: 20 }}>
        <form onSubmit={e => this.ratePatent(e)}>
          <RateSelector rate={this.state.rate} onRateChange={i => this.setState({ rate: i })} />
          <SubmitButton running={this.state.waitingTransaction} />
        </form>
      </Paper>
    );
  }

  /*Buttons depending on the state of the request*/
  getButtons() {
    const request = this.state.request;
    const hasBeenAccepted = (request.acceptedLicence > 0);
    const lastVersion = request.patentNumVersions-1;
    let requestButton = "";
    switch (request.status) {
      case RequestStatus.PENDING:
        requestButton = <Button onClick={this.cancelRequest}>Cancel and Refund</Button>;
        break;
      case RequestStatus.CANCELLED:
      case RequestStatus.REJECTED:
        requestButton = <Button onClick={this.selectLicence}>Resend a Request</Button>;
        break;
      case RequestStatus.ACCEPTED:
        requestButton = <Button onClick={this.selectLicence}>Upgrade Licence</Button>;
        break;
      default:
        break
    }
    const dlButton = <Button onClick={() => this.downloadCopy(lastVersion)}>Download Copy</Button>;
    const contactButton = <Button onClick={() => open('mailto:'+request.patentOwnerEmail)}>Contact Owner</Button>;
    const rateButton = <Button onClick={this.selectRate}>Rate Patent</Button>;
    return (
      <ButtonGroup justified>
        {hasBeenAccepted && <ButtonGroup>{dlButton}</ButtonGroup>}
        <ButtonGroup>{requestButton}</ButtonGroup>
        <ButtonGroup>{contactButton}</ButtonGroup>
        {hasBeenAccepted && <ButtonGroup>{rateButton}</ButtonGroup>}
      </ButtonGroup>
    );
  }

  /*Label that represents state of the request*/
  getLabel() {
    let labelStyle = "default";
    switch (this.state.request.status) {
      case RequestStatus.ACCEPTED:
        labelStyle = "success";
        break;
      case RequestStatus.CANCELLED:
        labelStyle = "warning";
        break;
      case RequestStatus.REJECTED:
        labelStyle = "danger";
        break;
      default:
        break;
    }
    return (
      <Label bsStyle={labelStyle} className="pull-right">
        {getStatusString(this.state.request.status)}
      </Label>
    );
  }

  getDisplayedLicence() {
    return this.state.request.status === RequestStatus.ACCEPTED
      ? this.state.request.acceptedLicence
      : this.state.request.requestedLicence;
  }

  renderVersions() {
    const request = this.state.request;
    return (
      <div>
        <h4>Patent Versions</h4>
        <ButtonGroup justified>
          {[...Array(request.patentNumVersions).keys()].map(i => {
            const v = i+1;
            return (
              <ButtonGroup key={i}>
                <Button onClick={() => this.downloadCopy(i)}>{request.patentNumVersions < 5 ? 'Version ' : 'v' + v}</Button>
              </ButtonGroup>
            )})}
        </ButtonGroup>
      </div>
    );
  }

  render() {
    const request = this.state.request;
    return (
      <div>
        <Panel eventKey={request.id} key={request.patentID}>
          <Panel.Heading>
            <Panel.Title toggle>
              {request.patentName} - Licence {this.getDisplayedLicence()}
              {this.getLabel()}
            </Panel.Title>
          </Panel.Heading>
          <Panel.Body collapsible>
            <div>
              {this.getButtons()}
              {request.patentNumVersions > 1 && request.acceptedLicence > 0 && this.renderVersions()}
            </div>
          </Panel.Body>
        </Panel>
        <MuiDialog disableEnforceFocus open={this.state.displayLicencesForm} onClose={() => this.closeForm()}>
          {this.state.displayLicencesForm && this.renderLicencesForm()}
        </MuiDialog>
        <MuiDialog disableEnforceFocus open={this.state.displayRatesForm} onClose={() => this.closeForm()}>
          {this.state.displayRatesForm && this.renderRatesForm()}
        </MuiDialog>
      </div>
    );
  }
}

export default RequestPanel