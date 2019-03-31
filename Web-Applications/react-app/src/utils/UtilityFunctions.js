/*Set of utility functions used multiple times */

import Dialog from 'react-bootstrap-dialog';
import {LARGE_FILE} from "./ErrorHandler";
import {Constants} from "./Constants";

/*Function that triggers the download of the given bytes*/
const saveByteArray = (name, bytes, window, document) => {
  let blob = new Blob([bytes]);
  let link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.download = name;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/*Utility function that extracts the json from a file and returns a promise that resolves into the json object,
* or is rejected if the parsing could not occur*/
const extractJson = (file, window) => {
  return new Promise(function (resolve, reject) {
    let f = file;
    if (typeof window.FileReader !== 'function') {
      reject('Browser does not support FileReader');
    }

    if (!f) {
      reject("Please select a file");
    } else if (f.type !== 'application/json') {
      reject('File is not a JSON')
    } else {
      let fr = new window.FileReader();
      fr.onload = function (data) {
        try {
          let tmp = data.target.result;
          JSON.parse(tmp);
          resolve(tmp)
        } catch (error) {
          reject('JSON file is corrupted')
        }
      };
      fr.readAsText(f);
    }
  })
};

/*Converts a unix timestamp to a String with date and time*/
const stampToDate = (timestamp) => {
  let date = new Date(timestamp * 1000);
  return date.toDateString() + " at " + date.toTimeString();
};

const successfullTx = (tx) => {
  window.dialog.show({
    title: "Successful Transaction",
    body: "Hash : " + tx.tx,
    bsSize: "large",
    actions: [
      Dialog.OKAction()
    ]

  });
};

/* Helper function that converts Wei to Ether*/
const toEther = (priceInWei, web3) => {
  if (web3 != null) {
    return web3.fromWei(priceInWei.toNumber(), 'ether');
  }
};

/*Helper function that converts Ether to Wei*/
const fromEther = (priceInEth, web3) => {
  if (web3 !== null) {
    return web3.toWei(priceInEth, 'ether');
  }
};

/*Utility function to validate emails*/
const validateEmail = (email) => {
  const email_regex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
  return email.match(email_regex) !== null ? 'success' : 'error';
};

/*Utility function to validate emails*/
const validateEmails = (email, repeat) => {
  if (email === '' || repeat === '') {
    return null;
  } else if (email === repeat) {
    return 'success'
  } else {
    return 'error'
  }
};

/*Utility function that returns true if the file is valid*/
const validateFile = (file, showAlert=true) => {
  const nameSplit = file.name.split('.');
  let toAlert = '';
  if (showAlert) {
    if (!file) {
      toAlert += '- Please select a file';
    } else if (file.size > Constants.MAX_FILE_SIZE) {
      toAlert += '- ' + LARGE_FILE;
    }
    if (nameSplit.length !== 2 /* || nameSplit[1] !== 'mp3' */) {
      toAlert += "- Invalid file name: please ensure that the name does not contain '.' \n " +
        "and that the extension is one of the following: [mp3]";
    }
    if (toAlert) {
      window.dialog.showAlert(toAlert);
    }
  }
  return (file !== "" && file.size < Constants.MAX_FILE_SIZE)
    && (nameSplit.length === 2 /* && nameSplit[1] === 'mp3' */);
};

/*Utility function that returns true there are multiple files and all of them are valid*/
const validateFiles = (files, showAlert=true) => {
  if(files.length === 0) {
    window.dialog.showAlert('Please select files');
    return false;
  } else if (files.length === 1) {
    window.dialog.showAlert('Please select more than one file. \n ' +
      'For a single file deposit, \n please register it HERE (TBD href to song reg)');
    return false;
  }
  else if (files.length > 100) {
    window.dialog.showAlert('Maximum number of files (100) reached.');
    return false;
  }
  const validFiles = files.every(file => validateFile(file, false));
  if(!validFiles && showAlert) {
    window.dialog.showAlert('At least one the file is not valid. Click for more info... (TBD)');
  }
  return validFiles;
}

module.exports = {
  extractJson,
  saveByteArray,
  stampToDate,
  successfullTx,
  toEther,
  fromEther,
  validateFile,
  validateFiles,
  validateEmail,
  validateEmails,
};


