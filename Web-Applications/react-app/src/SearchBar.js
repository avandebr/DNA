import './css/Pages.css'

import React, {Component} from 'react';
import {Nav, FormControl, Form} from 'react-bootstrap';

/*---------------------------------------------------------------------------------- DONE ----------------------------------------------------------------------------------*/
// TODO : Add About, Additional Info, Licences and API
/*
* Class representing the Navigation Bar component
* */
export default class SearchBar extends Component {

  /*Component Constructor*/
  constructor(props) {
    super(props);
    this.state = {
      searchedFile: '',
      displayedFiles: [],
    };
    this.searchFiles = this.searchFiles.bind(this);
  }

  searchFiles(e) {
    e.preventDefault();
    window.dialog.showAlert('Searching...');
  }

  render() {
    return (
      <Nav pullRight>
        <Form className="searchbar-container" onSubmit={this.searchFiles}>
            <FormControl type="text" placeholder="Search" className="searchbar"/>
        </Form>
      </Nav>
    );
  }
}