/*Set of React Components that are reused and are functional*/

import React from 'react'
import {FormControl, FormGroup, ControlLabel, HelpBlock, Alert} from 'react-bootstrap'
import Button from 'react-bootstrap-button-loader'
import '../css/Pages.css'
import {stampToDate} from './UtilityFunctions'
import {FileStates} from "./Constants";


/* encryption button component for file uploading form */
const EncryptFileButton = (props) => {
  let buttonState, buttonText;
  switch (props.fileState) {
    case FileStates.NOT_ENCRYPTED:
      buttonState = "default";
      buttonText = "Encrypt File";
      break;
    case FileStates.ENCRYPTING:
      buttonState = "default";
      buttonText = "Encrypting File...";
      break;
    case FileStates.ENCRYPTED:
      buttonState = "success";
      buttonText = "File encrypted";
      break;
    default:
      break;
  }
  return (
    <Button bsStyle={buttonState}
            loading={props.fileState === FileStates.ENCRYPTING}
            spinColor="#000"
            disabled={props.disabled}
            onClick={props.onClick}
            block>
      {buttonText}
    </Button>
  );
}


/*Submit button Component with loading state */
const SubmitButton = (props) => {
  return (
    <Button type='submit' spinColor="#000" loading={props.running} disabled={props.disabled} block>
      {props.running ? 'Sending' : 'Submit'}
    </Button>
  );
};


/*
* React Component for a FieldGroup (Form field with additional useful features)
* */
const FieldGroup = (props) => {
  return (
    <FormGroup controlId={props.id} validationState={props.validation}>
      <ControlLabel>{props.label}</ControlLabel>
      <FormControl name={props.name} type={props.type} value={props.value} placeholder={props.placeholder}
                   multiple={props.multiple} disabled={props.disabled} onChange={props.onChange} />
      <FormControl.Feedback/>
      {props.help && <HelpBlock>{props.help}</HelpBlock>}
    </FormGroup>
  );
};


/*Simple component to display when contract is not deployed*/
const ContractNotFound = (props) => {
  return (<div className="not-found">
    <h3>Contract not found on this Network, please try another network</h3>
  </div>);
};


/*Represents the container that display the given timestamp from the given user*/
const StampContainer = (props) => {
  let container = "";
  if (props.timestamp !== 0) {
    let date = stampToDate(props.timestamp);
    container = <Alert bsStyle="success">Document timestamped on {date}<br/>by {props.user}</Alert>
  } else {
    container = <Alert bsStyle="danger">Document not found in Database</Alert>
  }
  return <div style={{marginTop: '20px', textAlign: 'center', marginBottom: '100px'}}>{container}</div>
};


module.exports = { EncryptFileButton, SubmitButton, FieldGroup, ContractNotFound, StampContainer };