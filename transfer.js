#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const { program } = require('commander');
const Nedb = require('nedb');

// Parsing command-line options
program
    .version('0.1.0')
    .option(
        '-h, --mongodb-host [host]',
        'Host where your MongoDB is (default: localhost)',
        'localhost',
    )
    .option(
        '-u, --mongodb-username [username]',
        'Username for your MongoDB user',
    )
    .option(
        '-p, --mongodb-password [password]',
        'Password for your MongoDB user',
    )
    .option(
        '--mongodb-port [port]',
        'Port on which your MongoDB server is running (default: 27017)',
        parseInt,
    )
    .option('-d, --mongodb-dbname [name]', 'Name of the Mongo database')
    .option(
        '-c, --mongodb-collection [name]',
        'Collection to put your data into',
    )
    .option('-n, --nedb-datafile [path]', 'Path to the NeDB data file')
    .option(
        '-k, --keep-ids [true/false]',
        'Whether to keep ids used by NeDB or have MongoDB generate ObjectIds ' +
            '(probably a good idea to use ObjectIds from now on!)',
    );

program.parse(process.argv);

// Making sure we have all the config parameters we need

if (!program.mongodbDbname) {
    console.log('No MongoDB database name provided, can\'t proceed.');
    process.exit(1);
}

if (!program.mongodbCollection) {
    console.log('No MongoDB collection name provided, can\'t proceed.');
    process.exit(1);
}

if (!program.nedbDatafile) {
    console.log('No NeDB datafile path provided, can\'t proceed');
    process.exit(1);
}

if (!program.keepIds) {
    console.log(
        'The --keep-ids option wasn\'t used or not explicitely initialized.',
    );
    process.exit(1);
}

program.keepIds = program.keepIds === 'true';

let auth = '';
if (program.mongodbUsername) {
    auth += program.mongodbUsername;

    if (program.mongodbPassword) {
        auth += `:${program.mongodbPassword}`;
    }

    auth += '@';
}

const protocol = program.mongodbPort ? 'mongodb:' : 'mongodb+srv:';
let mongoUrl = `${protocol}//${auth}${program.mongodbHost}`;
if (program.mongodbPort) {
    mongoUrl += `:${program.mongodbPort}`;
}

mongoUrl += `/${program.mongodbDbname}`;
const mongoClient = new MongoClient(mongoUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

// Connect to the MongoDB database
console.log(`Connecting to ${mongoUrl}`);
mongoClient.connect(err => {
    if (err) {
        console.log('Couldn\'t connect to the Mongo database');
        console.log(err);
        process.exit(1);
    }

    console.log(`Connected`);

    const mdb = mongoClient.db(program.mongodbDbname);
    const collection = mdb.collection(program.mongodbCollection);

    ndb = new Nedb(program.nedbDatafile);
    ndb.loadDatabase(err => {
        if (err) {
            console.log('Error while loading the data from the NeDB database');
            console.log(err);
            process.exit(1);
        }

        const data = ndb.getAllData();

        if (data.length === 0) {
            console.log(
                `The NeDB database at ${program.nedbDatafile} contains no data, no work required`,
            );
            console.log(
                'You should probably check the NeDB datafile path though!',
            );
            process.exit(0);
        } else {
            console.log(
                `Loaded data from the NeDB database at ${program.nedbDatafile}, ${data.length} documents`,
            );
        }

        console.log(
            'Inserting documents (every dot represents one document) ...',
        );
        Promise.all(
            data.map(doc => {
                process.stdout.write('.');
                if (!program.keepIds) {
                    delete doc._id;
                }

                return new Promise((resolve, reject) => {
                    collection.insertOne(doc, err => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }),
        )
            .then(() => {
                console.log('');
                console.log('Everything went fine');
                process.exit(0);
            })
            .catch(err => {
                console.log('');
                console.log('An error happened while inserting data');
                console.log(err);
                process.exit(1);
            });
    });
});
