import React from 'react';
import { hot } from 'react-hot-loader';
import CssBaseline from '@material-ui/core/CssBaseline';
import {BrowserRouter, Route, Switch} from 'react-router-dom';
import NavigationBar from "./NavigationBar";
import Dialog from "react-bootstrap-dialog";
import Home from "./Home";
import TimestampFree from "./Timestamp/TimestampFree";
import TimestampMetaMask from "./Timestamp/TimestampMetaMask";
import VerifyTimestamp from "./VerifyTimestamp/VerifyTimestamp";
import DepositFile from "./Patenting/DepositFile";
import Store from "./Patenting/Store";
import MyFiles from "./Patenting/MyFiles";
import MyRequests from "./Patenting/MyRequests";
import About from "./About";

const App = () => (
    <CssBaseline>
        <BrowserRouter>
            <div>
                <NavigationBar/>
                <Dialog ref={(el) => { window.dialog = el }} />
                <Switch>
                    <Route exact path='/' component={Home}/>
                    <Route exact path='/Timestamp' component={TimestampFree}/>
                    <Route exact path='/PersonalTimestamp' component={TimestampMetaMask}/>
                    <Route exact path='/VerifyTimestamp' component={VerifyTimestamp}/>
                    <Route exact path='/DepositFile' component={DepositFile}/>
                    <Route exact path='/Store' component={Store}/>
                    <Route exact path='/MyFiles' component={MyFiles}/>
                    <Route exact path='/MyRequests' component={MyRequests}/>
                    <Route exact path='/About' component={About}/>
                </Switch>
            </div>
        </BrowserRouter>,

    </CssBaseline>
);

export default hot(module)(App);
