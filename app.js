// This loads the environment variables from the .env file
require('dotenv-extended').load();

var builder = require('botbuilder');
var restify = require('restify');
var azure = require('botbuilder-azure'); 

var documentDbOptions = {
    host: 'https://tasqbot.documents.azure.com:443/', 
    masterKey: '6XUSVEJUy7fqUUnTL87aSszgQirY8PjZaaKLgzvIuPjjtcyU9sXWgnbmED9MAm4Srl88NB9NUPQXj4JkXTJNRg==', 
    database: 'botdocs',   
    collection: 'botdata'
};

var docDbClient = new azure.DocumentDbClient(documentDbOptions);

var cosmosStorage = new azure.AzureBotStorage({ gzipData: false }, docDbClient);

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Create connector and listen for messages
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});
server.post('/api/messages', connector.listen());

var instructions = 'Welcome to the Bot to showcase the DirectLine API. Send \'Show me a hero card\' or \'Send me a BotFramework image\' to see how the DirectLine client supports custom channel data. Any other message will be echoed.';

// Bot Storage: Here we register the state storage for your bot.    
// Default store: volatile in-memory store - Only for prototyping!
// We provide adapters for Azure Table, CosmosDb, SQL Azure, or you can implement your own!
// For samples and documentation, see: https://github.com/Microsoft/BotBuilder-Azure
var inMemoryStorage = new builder.MemoryBotStorage();

var bot = new builder.UniversalBot(connector, [
    // this section becomes the root dialog
    // If a conversation hasn't been started, and the message
    // sent by the user doesn't match a pattern, the
    // conversation will start here
    (session, args, next) => {
        session.send(`Hi there! I'm a sample bot showing how multiple dialogs work.`);
        session.send(`Let's start the first dialog, which will ask you your name.`);

        // Launch the getName dialog using beginDialog
        // When beginDialog completes, control will be passed
        // to the next function in the waterfall
        session.beginDialog('getName');
    },
    (session, results, next) => {
        // executed when getName dialog completes
        // results parameter contains the object passed into endDialogWithResults

        // check for a response
        if (results.response) {
            const name = session.privateConversationData.name = results.response;

            // When calling another dialog, you can pass arguments in the second parameter
            session.beginDialog('getAge', { name: name });
        } else {
            // no valid response received - End the conversation
            session.endConversation(`Sorry, I didn't understand the response. Let's start over.`);
        }
    },
    (session, results, next) => {
        // executed when getAge dialog completes
        // results parameter contains the object passed into endDialogWithResults

        // check for a response
        if (results.response) {
            const age = session.privateConversationData.age = results.response;
            const name = session.privateConversationData.name;

            session.endConversation(`Hello ${name}. You are ${age}`);
        } else {
            // no valid response received - End the conversation
            session.endConversation(`Sorry, I didn't understand the response. Let's start over.`);
        }
    },
]).set('storage', cosmosStorage); // Register in memory storage


bot.dialog('getName', [
    (session, args, next) => {
        // store reprompt flag
        if(args) {
            session.dialogData.isReprompt = args.isReprompt;
        }

        // prompt user
        builder.Prompts.text(session, 'What is your name?');
    },
    (session, results, next) => {
        const name = results.response;

        if (!name || name.trim().length < 3) {
            // Bad response. Logic for single re-prompt
            if (session.dialogData.isReprompt) {
                // Re-prompt ocurred
                // Send back empty string
                session.endDialogWithResult({ response: '' });
            } else {
                // Set the flag
                session.send('Sorry, name must be at least 3 characters.');

                // Call replaceDialog to start the dialog over
                // This will replace the active dialog on the stack
                // Send a flag to ensure we only reprompt once
                session.replaceDialog('getName', { isReprompt: true });
            }
        } else {
            // Valid name received
            // Return control to calling dialog
            // Pass the name in the response property of results
            session.endDialogWithResult({ response: name.trim() });
        }
    }
]);

bot.dialog('getAge', [
    (session, args, next) => {
        let name = session.dialogData.name = 'User';

        if (args) {
            // store reprompt flag
            session.dialogData.isReprompt = args.isReprompt;

            // retrieve name
            name = session.dialogData.name = args.name;
        }

        // prompt user
        builder.Prompts.number(session, `How old are you, ${name}?`);
    },
    (session, results, next) => {
        const age = results.response;

        // Basic validation - did we get a response?
        if (!age || age < 13 || age > 90) {
            // Bad response. Logic for single re-prompt
            if (session.dialogData.isReprompt) {
                // Re-prompt ocurred
                // Send back empty string
                session.endDialogWithResult({ response: '' });
            } else {
                // Set the flag
                session.dialogData.didReprompt = true;
                session.send(`Sorry, that doesn't look right.`);
                // Call replaceDialog to start the dialog over
                // This will replace the active dialog on the stack
                session.replaceDialog('getAge', 
                    { name: session.dialogData.name, isReprompt: true });
            }
        } else {
            // Valid age received
            // Return control to calling dialog
            // Pass the age in the response property of results
            session.endDialogWithResult({ response: age });
        }
    }
]);