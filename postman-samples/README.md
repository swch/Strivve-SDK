# CardSavr API Sample Postman Requests

This directory contains a Postman collection of sample requests.  It can be imported into the Postman application and used to excercise the CardSavr RESTful API.  

## CardSavr Environment Instance API Cyprotgrpahy Requirement

The CardSavr Environment Instance must configured to allow unsigned REST requests and responses in addition to signed REST requests and responses.  Stivve can enable this upon request for non production environments.

## Set up a cardsavr enironments

Environment specific settings can be attained from support@strivve.com.  

- USERNAME
- PASSWORD
- CARDSAVR-INSTANCE (i.e. customer-dev)
- PORT (almost always 443)

## Global settings

- SITE_ID (You can use 1 for the easy synthetic site, but you can use any site available in the directory)
- SITE_USERNAME 
- SITE_PASSWORD
- SITE_USERNAME_2  (Feel free to set SITE_USERNAME / SITE_PASSWORD to incorrect values to test out credential resubmission)
- SITE_PASSWORD_2
- CARDHOLDER_CUID  (This can be used to override the cuid when testing persistent cardholders - the cuid is a unique identifier that can be used to reference a cardholder.  Ephemeral cardholders are deleted, but they can be correlated using their cuid)

## Synthetic sites

All postman scripts will work with actual merchant sites, but they are configured to work with Strivve's [synthetic sites](https://developers.strivve.com/testing/site-testing#user-experience-testing-synthetic-sites).  They behave like real sites, but respond to different usernames and passwords to simulate real site behavior.

## Single Job (Simple)

Pushng a card requires a few steps.  You must first let CardSavr know what card and billing information you would like to push.  Then you need to create the jobs for the merchants you would like to push.  Finally, you need to monitor that job to ensure that all the necessary credentials have been provided, but also report back to the cardholder with the necessary requests for that additional information.

Import "Single Job (simple)":

File->Import->Files or Folders->Single Job (simple).postman_collection.json

1. Log into CardSavr with the username and password provided by the Strivve support team
2. Select the merchants and find an active one where you'd like to place your card
3. Upsert a cardholder (cuid is used as a remote identifier for this cardholder - like a member_id).  Why upsert?  Upserts are very useful when you are unsure if the cardholder already exists.  Since cardholders have customer_keys (cuid), new cuids will cause cardholders to be created, and existing cuids will be updated and returned.
4. Upsert the card using the carholder id from #3 (note that the card has a child "address".  Although addresses can be shared between cards, it's often easier just to add a new one every time)
5. Create an account using the merchant id and cardholder id from #3.  For this example, the creds are supplied when creating the account (it is possible to start the job without credentials).  To know which credentials are required initially, check the account_link attributes in the merchant site -- the initial credentials have a type of "initial_account_link".
6. Post the job using the cardholder id, card id, and account id. 
7. Polling the cardholder or job.
    1. By polling the cardholder or the job (job in this example), you can determine if new credentials are required.  All jobs should be monitored until a termination type is set.  All statuses that start with "PENDING" will be accompanied with a credential request.  These credential requests include what parameters are required, along with an envelope_id.
    2. If initial credentials are incorrect, the envelope_id and new credentials must be supplied in the subsequent response.
    3. In the case where additional information is required (like a one-time-passcode), once again the appriate prompt must be made to the cardholder and the values must be submitted with envelope_id.
8. When polling the job returns a termination type, the session can be closed.  

## Single Job

Now that you are familiar with how to run a simple job, let's explore some more efficient and advanced techniques for placing cards on merchant sites.

Import Single Job.postman_collection.json

1. Log into CardSavr
2. Find a merchant
3. Post the job as a full hydrated body. This way you can post the cardholder, card, account and job in one call. 
    1. Default cardholders are ephemeral.  All cardholder data is purged upon completion of the session.
    2. If a job is posted with a persistent cardholder, credentials can be saved for future jobs. You also must send a x-cardsavr-cardholder-safe-key when using peristent cardholders.  (This header is available in the calls, and can be toggled on and off)
4. Poll the job
    1. Using the job id. This queries the entire state of the job
    2. Using the messages endpoint. This is handy for streaming status messages to the client
    3. Using the cardholder endpoint. This way if a cardholder is running simultaneous jobs, the status messages are merged. 
5. Credential requests
    1. Resubmit credentials
    2. Add Email and Phone if missing
    3. Submit TFA
    4. Submit Security Questions
6. After jobs coomplete, you can query the card placement results.  Even though ephemeral cardholders are purged, the card placement results (with no identifiable information) remain.
7. End the session

## CardUpdatr simulation w/two jobs

1. Log into Cardsavr
2. Create Cardholder
3. Upsert Card
4. Post Job
5. Save the credentials


At this point, you've procured a cardholder with a card that contains an access grant that can be used by CardUpdatr.  CardUpdatr then runs the following steps:

- Run step 3, logs on a lower privileged user that runs inside the browser
- Run step 4 to authorize the cardholder just created within the session of the browser's cardholder agent
- Now you can query the cardholder, create jobs


## Single Entity Job sample usage

There's a Postman collection for using the single entity job.  To use this Postman example:

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




## Importing The Template Into Postman

1. Launch Postman application.
2. File->Import->Upload Files->CardSavr-Template.postman_collection.json
