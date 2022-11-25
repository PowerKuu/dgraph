const colors = require("colors")
const path = require("path")
const nodeFetch = require("node-fetch")
const open = require('open')
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
-   ratle: "Run the ratle GUI to inspect data."

-   help: "Thist list of commands"
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

function drop(data, alterPath, queryPath) {
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
        }).catch((err) => {
            error("Drop", "Unexpected error while dropping data: " + err)
        }) .finally(() => {
            cli.resume()
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
            success("Drop", "Dropped all schemas and data from database.")
        }).catch((err) => {
            error("Drop", "Unexpected error while dropping schemas and data: " + err)
        }) .finally(() => {
            cli.resume()
        })
        
        return
    } else {
        error("DROP", "Argument must be a schema or data.")
    }

    cli.resume()
}

function ratle() {
    cli.abort()
    info("Ratle", "Starting ratle server...")
    exec("docker-compose up", {cwd: path.join(__dirname, "/ratel")}, (err) => {
        if (err) {
            cli.abort()
            error("Ratle", "Unexpected error while running the ratle server.")
            error("Ratle", "Is port 8000 taken or is ratle already running?")
            cli.resume()
        }
    })
    info("Ratle", `Wait a few seconds and then access ratle on "http://localhost:8000".`)

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
    queryPath

    question
    aborter

    start(migratePath, alterPath, queryPath) {
        this.schema = ""
        this.schemaValid = false

        this.migratePath = migratePath
        this.alterPath = alterPath
        this.queryPath = queryPath
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

                case "migrate":
                    if (!this.schemaValid) {
                        error("Migrating", "Youre schema is not valid! Aborting migration.")
                    } else {
                        migrate(this.schema, this.migratePath)
                    }

                    break
                case "drop":
                    drop(argv[1], this.alterPath, this.queryPath)
                    break
                case "ratle":
                    ratle()
                    break

                default:
                    info("CLI", `No command with name ${argv[0]}. Type help for all commands.`)
                    this.resume()
            }
        })
    }
}

const cli = new CLI()

module.exports = cli