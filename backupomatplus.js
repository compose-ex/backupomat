#!/usr/bin/env node

'use strict';

const yargs = require('yargs');
const fetch = require('node-fetch');
const fs = require('fs');

let apibase = "https://api.compose.io/2016-07";
let apitoken = process.env.COMPOSEAPITOKEN;
let apiheaders = {
    "Authorization": "Bearer " + apitoken,
    "Content-Type": "application/json"
};

let showDeployments = () => {
    fetch(`${apibase}/deployments/`, { headers: apiheaders })
        .then(function (res) {
            return res.json();
        })
        .then(function (json) {
            let deployments = json["_embedded"].deployments;
            for (let deployment of deployments) {
                console.log(`${deployment.id} ${deployment.type} ${deployment.name}`);
            }
        })
        .catch(function (err) {
            console.log(err);
        });
}

let listBackups = (deploymentid, options) => {
    fetch(`${apibase}/deployments/${deploymentid}/backups`, { headers: apiheaders })
        .then(function (res) {
            return res.json();
        })
        .then(function (json) {
            let backups = json["_embedded"].backups;
            for (let backup of backups) {
                console.log(`
Backup ID: ${backup.id}
Type:      ${backup.type}
Status:    ${backup.status} 
Base Name: ${backup.name}`);
            }
        })
        .catch(function (err) {
            console.log(err);
        });
}

let aboutBackup = (deploymentid, backupid, options) => {
    fetch(`${apibase}/deployments/${deploymentid}/backups/${backupid}`, { headers: apiheaders })
        .then(function (res) {
            return res.json();
        })
        .then(function (backup) {
            console.log(backup)
            console.log(`Backup ID: ${backup.id}
Type:      ${backup.type}
Status:    ${backup.status} 
Base Name: ${backup.name}
Download:  ${backup.download_link}`);
        })
        .catch(function (err) {
            console.log(err);
        });
}

let getBackup = (deploymentid, backupid, options) => {
    fetch(`${apibase}/deployments/${deploymentid}/backups/${backupid}`, { headers: apiheaders })
        .then(function (res) {
            return res.json();
        })
        .then(function (backup) {
            if (backup.download_link == null) {
                console.log(`API returned no download link for deployment ${backup.download_link}`);
                process.exit(1);
            }
            console.log(`Going to download ${backup.name}`);
            fetch(backup.download_link)
                .then((res) => {
                    var dest = fs.createWriteStream(`${backup.name}.tar.gz`, {
                        highWaterMark: Math.pow(2, 16)
                    });
                    res.body.pipe(dest);
                    dest.on('finish', () => {
                        console.log("Done");
                        process.exit(0);
                    })
                });
        })
        .catch(function (err) {
            console.log(err);
        });
}

let startBackup = (deploymentid, options) => {
    fetch(`${apibase}/deployments/${deploymentid}/backups`, { method: "POST", headers: apiheaders })
        .then(function (res) {
            return res.json();
        })
        .then(function (recipe) {
            console.log(`Recipe Id: ${recipe.id}
Status:        ${recipe.status}
`);
            pollForRecipeComplete(recipe.id)
        })
        .catch(function (err) {
            console.log(err);
        });
}

let pollForRecipeComplete = (recipeid) => {
    fetch(`${apibase}/recipes/${recipeid}`, { headers: apiheaders })
        .then(function (res) { return res.json() })
        .then(function (recipe) {
            if (recipe.status == "complete") { 
                process.stdout.write("\n"); 
                return getLatestOndemand(recipe.deployment_id);
                }
            else {
                process.stdout.write('.');
                setTimeout(pollForRecipeComplete, 10000, recipeid);
            }
        })
};

let getLatestOndemand = (deploymentid) => {
    fetch(`${apibase}/deployments/${deploymentid}/backups`, { headers: apiheaders })
        .then(function (res) {
            return res.json();
        })
        .then(function (json) {
            let backups = json["_embedded"].backups;
            for (let backup of backups) {
                if(backup.type=="on_demand") {
                    getBackup(backup.deployment_id,backup.id)
                    return true;
                }
            }
            console.log("No on demand backup found")
            return false;
        })
        .catch(function (err) {
            console.log(err);
        });
}

yargs.version("0.0.1")
    .command("deployments", "List deployments", {}, (argv) => showDeployments())
    .command("list <deploymentid>", "List deployment backups", {}, (argv) => listBackups(argv.deploymentid))
    .command("get <deploymentid> <backupid>", "Get specific backup", {}, (argv) => getBackup(argv.deploymentid, argv.backupid))
    .command("start <deploymentid>", "Start on demand backup", {}, (argv) => startBackup(argv.deploymentid))
    .command("about <deploymentid> <backupid>", "Get specific backup information", {}, (argv) => aboutBackup(argv.deploymentid, argv.backupid))
    .help()
    .argv;
