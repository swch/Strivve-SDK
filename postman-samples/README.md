# CardSavr API Sample Postman Requests

This directory contains a Postman collection of sample requests.  It can be imported into the Postman application and used to excercise the CardSavr RESTful API.  

## CardSavr Environment Instance API Cyprotgrpahy Requirement

The CardSavr Environment Instance must configured to allow unsigned REST requests and responses in addition to signed REST requests and responses.  Stivve can enable this upon request for non production environments.

## Specific Template Edits For Use With A CardSavr Environment Instance

In order to use it, the following edits will need to be made to the CardSavr-Template.postman_collection.json once it is imported into Postman.

- The label YOUR-INSTANCE-NAME found in URLs needs to be changed to the enviornment DNS subdomain of the CardSavr Environment it will be run against.  For exampple if the environment is myco-dev.cardsavr.io then YOUR-INSTANCE-NAME label needs to be changed to myco-test.
- The label YOUR-AGENT-PASSWORD found in "1-2 Session Login", "1-2 Session Login" and "2-2 Session Login" requests nees to be changed to the password of the customer user agent being used. This assumes this user has been created apriori by the Partner Portal application.
- The label YOUR-CUSTOMER-AGENT-NAME found in "1-2 Session Login" and "2-2 Session Login" needs to be changed to the name of the customer agent user being used.  This assumes this user has been created apriori by the Partner Portal application.
- The label LINE-ONE found in "3-2 Create Address" nees to be changed to the address of the card to be used "3-5 Create Single Site Job".
- The optional label LINE-TWO found in "2-3 Create Address" needs to be changed to the address of the card to be used "3-5 Create Single Site Job" if a second address line is needed. 
- The label ZIP found in "2-3 Create Address" needs to be changed to the zip code of the card to be used "3-5 Create SIngle Site Job".
- The optional label ZIP-XXXX found in "2-3 Create Address" needs to be changed to the zip code of the card to be used "3-5 Create Single Site Job" if it available.
- The label MERCHANT-SITE-ID found in "3-4 Create Account" needs to be changed to the id of the merchant site returned from a previous GET/merchant/sites call.
- The label LOGIN-NAME-AT-MERCHANT found in "3-4 Create Account" needs to be changed to an existing login name at the merchant site.
- The label LOGIN-PASSWORD found in "3-4 Create Account" needs to be changed to the password of the login name at the merchant.

## Single Entity Job sample usage
There's also a Postman collection for using the single entity job.  To use this Postman example:

Import Single-entity-job.postman_collection.json

- Create a new environment in Postman
- Add a variable CARDSAVR-INSTANCE (this is the instance part of your API URL: api.CARDSAVR-INSTANCE.cardsavr.io)
- Add a variable for USERNAME (contact your account manager if you do not have the username)
- Add a variable for PASSWORD (contact your account manager if you do not have the password)
- Add a variable for TRACE with a value of {"key": "postman_test"}
- Run step 1 to login
- Run step 2 to see the merchant directory
- Run step 3 to submit a job (the merchant creds are purposefully entered incorrectly)
- Run step 4-1 to check the status of the job
- You may need to run 4-1 a few times but you will eventually see a message:  "There was a problem with login credentials, please re-submit."
- Run step 4-2 to resubmit credentials (the body for step 4-2 has the correct credentials)
- Run step 4-1 to check the status of the job
- You may need to run 4-1 a few times but you will eventually see a message:  "Please enter multi factor authentication from merchant site."
- Alternatively, you can call 4.0 (GET Job) which will also eventually the reflect that a TFA code is required. These status change are persistent unlike the messages, which are one time consumption.
- Run step 4-3 to submit TFA (for synthetic sites, the correct TFA code is hard coded in the body for 4-3 - for our synthetic sites, it's always 1234)
- Close the session with step 5

You are welcome to use 1-3 and find a non-syntheic site (they are available in the merchant directory), and post a card on a real site.  You will obviously need to supply real credentials and TFA codes if you do so.


## Importing The Template Into Postman

1. Launch Postman application.
2. File->Import->Upload Files->CardSavr-Template.postman_collection.json
