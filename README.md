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

The SDK is a typescript wrapper around the Strivve Cardsavr REST API.  Although there are several api calls you can make to manage your financial institutions users, cards and merchants, the CardsavrHelper of the SDK makes it easy to do the most common functions:  add credit cards to a user, and then post a job that can update that card on one or more merchant sites.  

For this sample, there are two applications.  The first is a simple node app that provisions a user and adds a credit card to their profile.  This card is encrypted and saved in the Cardsavr database, and only accessible by the updating process.  The second application is a simple web application written in javascript that collects a merchant site's credentails, posts a job to place that card, and then provides basic feedback to the cardholder:  status messages, and potentially additional security information like two-factor authentication codes, and even a chance to update the username or password.

If you are building your own application, you can also simply install the npm module into your own node or react application:

```bash
npm install @strivve/strivve-sdk
```

## Quick Start Guide

The Strivve Javascript SDK library is built around a class, CardsavrSession. To start using the library, you must instantiate a new CardsavrSession object.  This requires the following items:

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

In the provisioning application (/sample/index.js), you'll see where these settings need to be filled in.  Once they are provided, tbe application can be run:

```bash
node index.js
```

The provisioning application will log delimited key values that are required by the clinet application.  a one-use grant, and the username of the provisioned cardholder.  These are a short-lived user, and their information is deleted after the card is placed, or after 15 minutes if there is no activity.  When the user is deleted, their cards and merchant credentials are deleted along with it.

From the sample directory, you can also run a small express web server:

```bash
node webserver.js
```

This is just a simple static webserver that demonstrates how the web application works.  In the dist/index.html file, there is a simple application that uses a webpack bundle of the sdk (strivve-sdk.js) to manage the user's merchant credentials and job.  By passing the grant and username into the url of the web application:

http://localhost:3000/#grant=[GRANT]&username=[USERNAME]

Now the web application can re-establish the session using the grant and username provided by the original provisioning application.  The cardholder will be presented with a simple form for the merchant credentials of the site to place their card.  Once the form is submitted, the web application authenticates the user with the username and grant, and then posts the job as that user.  There is a messaging system the posts messages to the UI to show status, progress, and the success or failure of the job.  The form will also present additional fields to collect a new password or a two-factor authentication code.



