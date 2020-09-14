# CardSavr API Sample Postman Requests

This directory contains a Postman collection of sample requests.  It can be imported into the Postman application and used to excercise the CardSavr RESTful API.  

## CardSavr Environment Instance API Cyprotgrpahy Requirement

The CardSavr Environment Instance must configured to allow unsigned REST requests and responses in addition to signed REST requests and responses.  Stivve can enable this upon request for non production environments.

## Specific Template Edits For Use With A CardSavr Environment Instance

In order to use it, the following edits will need to be made to the CardSavr-Template.postman_collection.json once it is imported into Postman.

- The label YOUR-INSTANVE-NAME found in URLs needs to be changed to the enviornment DNS subdomain of the CardSavr Environment it will be run against.  For exampple if the environment is myco-dev.cardsavr.io then YOUR-INSTANCE-NAME label needs to be changed to myco-test.
- The label YOUR-AGENT-PASSWORD found in "1-2 Session Login", "1-2 Session Login" and "2-2 Session Login" requests nees to be changed to the password of the customer user agent being used. This assumes this user has been created apriori by the Partner Portal application.
- The label YOUR-CUSTOMER-AGENT-NAME found in "1-2 Session Login" and "2-2 Session Login" needs to be changed to the name of the customer agent user being used.  This assumes this user has been created apriori by the Partner Portal application.
- The label CARDHOLDER-ID found in "3-2 Create Address", "3-3 Create Card", "3-4 Create Account" and "3-5 Create Single Site Job" needs to be changed to the :id property of the cardholder user returned in the JSON response from "1-3 Create User". 
- The label LINE-ONE found in "3-2 Create Address" nees to be changed to the address of the card to be used "3-5 Create Single Site Job".
- The optional label LINE-TWO found in "2-3 Create Address" needs to be changed to the address of the card to be used "3-5 Create Single Site Job" if a second address line is needed. 
- The label ZIP found in "2-3 Create Address" needs to be changed to the zip code of the card to be used "3-5 Create SIngle Site Job".
- The optional label ZIP-XXXX found in "2-3 Create Address" needs to be changed to the zip code of the card to be used "3-5 Create Single Site Job" if it available.
- The label MERCHANT-SITE-ID found in "3-4 Create Account" needs to be changed to the id of the merchant site returned from a previous GET/merchant/sites call.
- The label LOGIN-NAME-AT-MERCHANT found in "3-4 Create Account" needs to be changed to an existing login name at the merchant site.
- The label LOGIN-PASSWORD found in "3-4 Create Account" needs to be changed to the password of the login name at the merchant.
- The CARD-ID found in "3-5 Create Single Site Job" needs to be changed to the :id property of the card returned in the JSON response from "3-3 Create Card."
- The ACCOUNT-ID found in "3-5 Create Single Site Job" needs to be changed to the :id property of the account returned in the JSON response from "3-4 Create Account".

## Importing The Template Into Postman

1. Launch Postman application.
2. File->Import->Upload Files->CardSavr-Template.postman_collection.json
