import './css/Pages.css'
import React, { Component } from 'react'
import { Grid, Row } from 'react-bootstrap'
import licences from './utils/Licences';

class Licences extends Component {

  render() {
    return (
      <Grid>
        <br/>
        <Row bsClass="title">DNA Licences</Row>
        <hr/>
        {Object.keys(licences).map(licence => (
          <div key={licence}>
            <h3>Licence {licence}</h3>
            <br/>
            <Row bsClass="paragraph">{licences[licence]}</Row>
          </div>
        ))}
      </Grid>
    )
  }
}

export default Licences;
