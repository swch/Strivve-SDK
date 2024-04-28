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

Import CardUpdatr.postman_collection.json

1. Log into Cardsavr
2. Create Cardholder
3. Upsert Card
4. Authorize Cardholder (login as cardholder_sso_agent)
5. Post Jobs
    1. Job
    2. Job 2
6. Save the credentials
    1. This uses the envelope_id returned by the creation of "Job"
    2. Uses envelope_id from Job 2.
7. Query job statuses
    1. Query Cardholder job status (all jobs for this cardholder)
    2. Just query "Job"
    3. Just query "Job 2"
8. Resubmit credentials
    1. New creds for "Job" (must query job for postman to retrieve envelope_id)
    2. New creds for "Job 2"
    3. TFA prompt for "Job"
    4. TFA prompt for "Job 2"

## Cardupdatr simulation w/persisten cardholder

Import CardUpdatr (persistent cardholder).postman_collection.json

1. Log into Cardsavr
2. Upsert the Cardholder (make sure safe key header is turned on)
3. Upsert the Card
4. Post the job
5. Update the account w/creds
6. Get Job Status
    1. By cardholder messages
    2. Just get the Job

## Cardupdatr SSO (with late binding of CVV)

Import CU SSO w-late binding CVV.postman_collection.json

The final collection demonstrates how to implement an SSO application.  Once the card has been created, running "Lookup Cardholder" will write a url to the Postman console.  This command will enable CardUpdatr to assume the cardholder created earlier in the collection.

1. Log into Cardsavr
2. Upsert a card (no cvv code)
3. Lookup cardholder by cuid (at this point, you can simply grag the url from the postman console and you can execute CU on behalf of the cardholder - you'll notice that you are prompted for a cvv code if you try and push a card that requires one)
4. Log into Cardsavr with a cardholder agent
5. Authorize cardholder will give the new session access to the cardholder (using the grant from the #2)
6) Cardholder agent session can save the CVV

## Importing The Template Into Postman

1. Launch Postman application.
2. File->Import->Upload Files->CardSavr-Template.postman_collection.json
