import '../css/Pages.css'
import TimeStamping from '../../build/contracts/TimeStamping'
import {FieldGroup, stampContainer, SubmitButton} from '../utils/htmlElements';

import React, {Component} from 'react'
import {getFileHash, extractJson} from "../utils/stampUtil";
import Constants from '../Constants';
import axios from "axios/index";

const OPERATION = 'verify';
const SERVER_ADDRESS = Constants.SERVER_IP + '/' + OPERATION;


const SIGNATURE = 'signature';
const FILE = 'file';

/*
* Component that serves to verify a timestamp of a document that has been done on the free platform
*
* The user is required to upload the document that has been signed and the signature which is a .json file
*
* It does not require a Web3 injection
* */
class VerifyFree extends Component {

  /* Constructor of the component
  * */
  constructor(props) {
    super(props);
    this.state = {
      hash: "",
      signature: "",
      timestamp: 0,
      email : "",
      waitingServer: false
    };

    this.resetState = this.resetState.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.validateForm = this.validateForm.bind(this);
    this.submitVerification = this.submitVerification.bind(this);
    this.fileSubmissionError = this.fileSubmissionError.bind(this);
  }

  /* Resets the state of the component
  * */
  resetState() {
    this.setState({hash: "", signature: "", timestamp: 0,email : "", waitingServer: false});
  }

  /*Error handling during file submission and parsing*/
  fileSubmissionError(err) {
    alert(err);
    this.resetState();
  }


  /* Handles the changes in the form elements (two documents to upload) */
  handleChange(e) {
    e.preventDefault();
    if (e.target.name === FILE) {
      getFileHash(e.target.files[0], window).then(res => this.setState({hash: res})).catch(this.fileSubmissionError)
    } else if (e.target.name === SIGNATURE) {
      extractJson(e.target.files[0], window).then(res => this.setState({signature: res})).catch(this.fileSubmissionError)
    }
  }

  /* This method sends the documents to the server for verification and transmits the response to the user*/
  submitVerification(e) {
    e.preventDefault();
    if (this.validateForm()) {
      this.setState({waitingServer: true});

      let form = new FormData();
      form.append('hash', this.state.hash);
      form.append('signature', this.state.signature);

      axios({
        method: 'post',
        url: SERVER_ADDRESS,
        data: form//JSON.stringify(data)
      }).then(res => {
        let d = res.data;
        this.setState({timestamp: d.stamp, email : d.email, waitingServer: false});
      }).catch(e => {
        alert(e.response.data);
        this.resetState()
      })
    } else {
      this.resetState()
    }
  }

  /* Validates the documents and verifies that the signature is a non corrupted json string
  * */
  validateForm() {
    if (this.state.signature === "" || this.state.hash === "") {
      alert("Please verify the files");
    }
    return this.state.signature !== "" && this.state.hash !== ""

  }

  /* The rendering method
  * */
  render() {
    return (
      <div className="time-stamp-container">
        <div className='time-stamp-header'>TimeStamping contract at {TimeStamping.networks[3].address} (Ropsten Testnet)</div>
        <form className="form" onSubmit={this.submitVerification}>
          <FieldGroup name={FILE} id="formsControlsFile" label="File" type="file" placeholder="" help="File to verify"
                      onChange={this.handleChange}/>
          <FieldGroup name={SIGNATURE} id="formsControlsFile" label="Signature" type="file" placeholder=""
                      help="Signature of the file (.json file)" onChange={this.handleChange}/>
          <SubmitButton running={this.state.waitingServer}/>
        </form>
        {stampContainer(this.state.timestamp, this.state.email)}
      </div>
    )

  }

}

export default VerifyFree