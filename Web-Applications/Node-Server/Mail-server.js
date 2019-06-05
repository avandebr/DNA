const nodemailer = require('nodemailer');
require('dotenv').config();

/**
 * File that contains the functions to send emails to users when they timestamp or make a request to get a document
 */

var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SERVER_EMAIL,
        pass: process.env.EMAIL_PASSWORD
    }
});

module.exports = {

    /**
     *
     * @param ownerMail: The email address of the owner of the document with name patentName which has been requested
     * @param patentName: The name of the requested document
     * @param rentee: Email address of the requester
     *
     * Send an email to the owner of the deposited document with name patentname
     */
    sendRequest: function(ownerMail, patentName, rentee){
        var mailOptions = {
            from: '"DNA" <eth.notary@gmail.com>',
            to: ownerMail,
            subject: 'New Request for your document ' + patentName,
            text: "Dear user, \n\nThis email is a notification regarding your deposited document " + patentName + ".\n" +
                "User with address " + rentee + " has requested access. You can manage the request on the website. \n" +
                "\n When the request is accepted, the funds will be deposited into your account.\n\n"+
                "This is an automatic email, please do not answer. \n\nThe DNA team \n\n",
        };
        transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
              console.log(error);
            }
            else {
              console.log('Email sent for document request ' + info.response);
            }
        });
    },

    /**
     *
     * @param requesterMail: Email of the user that has requested the document with name patentName
     * @param patentName: The name of the requested document
     * @param accepted: Indicates if the request has been accepted or not
     *
     * Send an email to the requester of the document with name patentName to indicate him if the request has been
     * accepted or rejected
     */
    sendRequestResponse: function(requesterMail, patentName, accepted){
        var mailOptions = {
            from: '"DNA" <eth.notary@gmail.com>',
            to: requesterMail,
            subject: 'Request update',
            text: "Dear user, \n\nThis email is a notification regarding your request for the deposited document " + patentName + ".\n" +
                "The owner has " + (accepted ? "accepted" : "rejected") + " your access request.\n" +
                (accepted ? "You can download the document on the website.\n\n" : "Your deposit has been refunded.\n\n") +
                "This is an automatic email, please do not answer. \n\nThe DNA team \n\n",
        };
        transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
                console.log(error);
            }
            else {
                console.log('Email sent for document request response' + info.response);
            }
        });
    }
};