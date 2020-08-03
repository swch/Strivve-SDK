# CardSavr API Sample Postman Requests

This directory contains a Postman collection of sample requests.  It can be imported into the Postman application and used to excercise the CardSavr RESTful API.  

## CardSavr Environment Instance API Cyprotgrpahy Requirement

The CardSavr Environment Instance must configured to allow unsigned REST requests and responses in addition to signed REST requests and responses.  Stivve can enable this upon request for non production environments.

## Specific Template Edits For Use With A CardSavr Environment Instance

In order to use it, the following edits will need to be made to the CardSavr-Template.postman_collection.json once it is imported into Postman.

- The label CDE-ENVIRONMENT found in URLs needs to be changed to the enviornment DNS subdomain of the CardSavr Environment it will be run agains.  For exampple if the environment is myco-dev.cardsavr.io then the CDE-DOMAIN label needs to be changed to myco-test.
- The label CARDHOLDER-ID needs to be changed to the :id property of the cardholder_user returned from a GET /cardholder_users endpoint.
- The label GRANT-RETURNED-FROM-API.CDE-DOMAIN.CARDSAVR.IO/CARDHOLDER_USERS/DEMO-CARDHOLDER/CREDENTIAL-GRANT needs to be changed to the value returned from that end poimt.

## Importing The Template Into Postman

1. Launch Postman application.
2. File->Import->Upload Files->CardSavr-Template.postman_collection.json
