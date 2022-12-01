//!
//! This file need to be cleaned up. And is a beta release.
//!



const colors = require("colors")
const path = require("path")
const nodeFetch = require("node-fetch")
const open = require("open")
const { exec } = require("child_process")

const {error, info, success} = require("./utils/logger")

const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
})

function help() {
    cli.abort()
    console.log(`
List of commands:
-   migrate: "Merge schema into the databse."
-   drop [data/schema]: "Drop all data/schema and data from the database."
-   reload: "Runs "drop schema" and "migrate".
-   ratel: "Run the ratel GUI to inspect data."

-   stop: "Stop this process."
-   help: "This list of commands"
    `)

    cli.resume()
}


function migrate(schema, migratePath) {
    cli.abort()
    info("Migrating", "Starting to migrate schema to database...")

    nodeFetch(migratePath, {
        method: "POST",
        body: schema
    }).then((code) => {
        success("Migrating", "Migrated schema to database. Status code: " + code.status)
    }) .catch((err) => {
        error("Migrating", "Unexpected error while migrating: " + err)
    }) .finally(() => {
        cli.resume()
    })
}

function drop(data, alterPath, resume = true) {
    return new Promise((resolve, reject) => {
        cli.abort()

        if (data == "data"){
            info("Drop", "Dropping data from database...")

            const alter1 = nodeFetch(alterPath, {
                "body": JSON.stringify({
                    drop_op: "DATA"
                }),
                "method": "POST"
            })
            const alter2 = nodeFetch(alterPath, {
                "body": null,
                "method": "OPTIONS"
            })


            Promise.all([alter1, alter2])
            .then(() => {
                success("Drop", "Dropped all data from database.")
                resolve()
            }).catch((err) => {
                error("Drop", "Unexpected error while dropping data: " + err)
                reject()
            }) .finally(() => {
                if (resume) cli.resume()
            })
            
            return
        } else if (data == "schema") {
            info("Drop", "Dropping schema and data from database...")
            const alter1 = nodeFetch(alterPath, {
                "body": JSON.stringify({
                    drop_all: true
                }),
                "method": "POST"
            })
            const alter2 = nodeFetch(alterPath, {
                "body": null,
                "method": "OPTIONS"
            })

            Promise.all([alter1, alter2])
            .then(() => {
                resolve()
                success("Drop", "Dropped all schemas and data from database.")
            }).catch((err) => {
                reject()
                error("Drop", "Unexpected error while dropping schemas and data: " + err)
            }) .finally(() => {
                if (resume) cli.resume()
            })
            
            return
        } else {
            error("DROP", "Argument must be a schema or data.")
            reject()
            if (resume) cli.resume()
        }
    })
}

function reload(schema, migratePath, alterPath) {
    cli.abort()
    drop("schema", alterPath, false)
    .then(() => {
        migrate(schema, migratePath)
    })
    .catch(() => {

    })
}

function ratel() {
    cli.abort()
    info("Ratel", "Starting ratel server...")
    const ratelPath = path.resolve(__dirname, "./docker/ratel")

    exec("docker-compose up", {cwd: ratelPath}, (err) => {
        if (err) {
            cli.abort()
            error("Ratel", "Unexpected error while running the ratel server.")
            error("Ratel", "Is port 8000 taken or is ratel already running?")
            info("Ratel", `U can change docker-compose.yml at ${ratelPath} (Not recommended).`)
            cli.resume()
        }
    })
    info("Ratel", `Wait a few seconds and then access ratel on "http://localhost:8000".`)

    setTimeout(() => {
        open("http://localhost:8000/?latest")    
    }, 5000)

    cli.resume()
}

class CLI {
    schemaValid
    schema

    migratePath
    alterPath

    question
    aborter

    start(migratePath, alterPath) {
        this.schema = ""
        this.schemaValid = false

        this.migratePath = migratePath
        this.alterPath = alterPath
        this.aborter = new AbortController()
        this.resume()
    }

    abort() {
        this.aborter.abort()
        this.aborter = new AbortController()
    }

    resume(){
        readline.question(`(CLI) [${colors.cyan("DGRAPH")}]: `, { signal: this.aborter.signal }, (command) => {
            const argv = command.split(" ")
    
            switch (argv[0]) {
                case "help":
                    help()
                    break
                case "stop":
                    process.exit(0)
                    break

                case "migrate":
                    if (!this.schemaValid) {
                        cli.abort()
                        error("Migrating", "Youre schema is not valid! Aborting migration.")
                        cli.resume()
                    } else {
                        migrate(this.schema, this.migratePath)
                    }

                    break
                case "drop":
                    drop(argv[1], this.alterPath)
                    break
                case "reload":
                    if (!this.schemaValid) {
                        cli.abort()
                        error("Migrating", "Youre schema is not valid! Aborting migration.")
                        cli.resume()
                    } else {
                        reload(this.schema, this.migratePath, this.alterPath)
                    }
                    break
                case "ratel":
                    ratel()
                    break

                default:
                    info("CLI", `No command with name ${argv[0]}. Type "help" for all commands.`)
                    this.resume()
            }
        })
    }
}

const cli = new CLI()

module.exports = cli