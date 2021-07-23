# Strivve-SDK

This library is an implementation of the CardSavr API for Node.js or web applications. It contains methods for session management; security and cryptography; and resource retrieval, creation, updating, and deleting. By mangaging CardSavr's complex security requirements automatically, the JavaScript library greatly simplifies the implementation of CardSavr in your own app.

Please note: most methods in this library are asynchronous and therefore return resolved promises. Each method's individual documentation will specify if it is asynchronous.  Take a look at the Quick Start guide to get up and running with the CardSavr library.

## Installation

Beging by cloning the repository

```bash
git clone https://github.com/swch/Strivve-SDK.git
```

To try out the SDK, cd to the sample directory, and:

```bash
npm install
```

This will install the SDK from npmjs.org as well as download the necessar dependencies.

The SDK is a typescript wrapper around the Strivve Cardsavr REST API.  Although there are several api calls you can make to manage your financial institution's users, cards and merchants, the CardsavrHelper of the SDK makes it easy to do the most common functions:  add credit cards to a user, and then post a job that can update that card on one or more merchant sites.  

For this sample, there are two applications.  The first is a simple node app that provisions a user and adds a credit card to their profile.  This card is encrypted and saved in the Cardsavr database, and only accessible by the updating process.  The second application is a simple web application written in javascript that collects a merchant site's credentails, posts a job to place that card, and then provides basic feedback to the cardholder:  status messages, and potentially additional security information like two-factor authentication codes, and even a chance to update the username or password.

If you are building your own application, you can also simply install the npm module into your own node or react application:

```bash
npm install @strivve/strivve-sdk
```

## Quick Start Guide

The Strivve Javascript SDK library is built around a class, CardsavrSession. To start using the library, you must instantiate a new CardsavrSession object.  This requires the following items in a strivve_creds.json file located in the "sample" directory.  There is a [sample file](../creds.sample.json) in the root of the repo (proxy settings are not implemented for this SDK):

1. API url (e.g. api.acmebank.cardsavr.io)
1. App name (app_name) and integrator key (app_key) - these can be obtained by contacting developer-support@strivve.com
1. App username and password - also obtained from a CardSavr administrator.  Simple applications (like the quick start) require a cardholder agent, while more complex applications may require a customer agent.

```javascript
var app_name = "CardUpdatr Demo"; //This can be anything
var app_key = "[REDACTED]". //from administrator
var cardsavr_server = "[REDACTED]";  //please use acmebank for demonstration purposes 
var app_username = "cardholder_demo";  //an integrator "cardholder_agent" that has the ability to provision users
var app_password = "[REDACTED]";  //integrator's password
```

The application is a simple web application (/sample/webserver.js).  The initial call to /create_user simply provisions the user, and hands off a grant and a username to a frontend webform that manages the interaction with the user.  Both create_user and the web page (/dist/index.html) require that these credentials be filled in.

From the sample directory, you can also run the express web server:

```bash
npm install
npm start
```

http://localhost:3000/create_user

This call will provision a user using the cardholder.json, card.json, and address.json files. These structures are based on the [API docuemntation](https://swch.github.io/slate).  The service then redirects to one of the following places:

http://localhost:3000/create_user (default - goes to the corresponding cardupdatr instance and runs CardUpdatr SSO)

http://localhost:3000/create_user?rd=index.html (launches index.html, a bare bones client application)

http://localhost:3000/create_user?rd=session_persist.html (for testing session persistence)

http://localhost:3000/create_user?rd=iframe.html (for testing embedded SSO)

This is just a simple api call and static webserver that demonstrates how the web application works.  In the dist/index.html file, there is a simple application that uses a webpack bundle of the sdk (strivve-sdk.js) to manage the user's merchant credentials and job.  The grant, username and card_id are passed in to launch the application.

http://localhost:3000/index.html#grant=[GRANT]&username=[USERNAME]&card_id=[CARD_ID]

Now the web application can re-establish the session using the grant and username provided by the original provisioning call.  The cardholder will be presented with a simple form for the merchant credentials of the site to place their card.  Once the form is submitted, the web application authenticates the user with the username and grant, and then posts the job as that user.  There is a messaging system the posts messages to the UI to show status, progress, and the success or failure of the job.  The form will also present additional fields to collect a new password or a two-factor authentication code.



