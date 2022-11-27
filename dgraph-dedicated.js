#!/usr/bin/env node

const fs = require("fs")
const path = require("path")
const {exec} = require("child_process")

const tcpPortUsed = require("tcp-port-used")
const nodeFetch = require("node-fetch")

const {error, info, success} = require("./utils/logger")
const cli = require("./dgraph-commands")

const workingDir = process.cwd()

const configPath = path.resolve(workingDir, "./dgraph-dedicated.json")
var currentConfig

try {
    currentConfig = require(configPath)
} catch (e) {
    currentConfig = {}
}

const config = {
    "server": {
        "host": "localhost",
        "port": 8080,
        "ssl":  false
    },

    "schema": "./schema.graphql",
	"docker": {
		"compose": "./docker-compose.yml",
		"name": "dgraph-dedicated",
	},
    ...(currentConfig)
}

fs.writeFileSync(configPath, JSON.stringify(config, null, "\t"))

const graphqlServer = `${config.server.host}:${config.server.port}`
const protocol = config.server.ssl ? "https://" : "http://"

const schemaPath = path.resolve(workingDir, config.schema)
const validatePath = protocol + graphqlServer + "/admin/schema/validate"
const migratePath = protocol + graphqlServer + "/admin/schema"
const queryPath = protocol + graphqlServer + "/query"
const alterPath = protocol + graphqlServer + "/alter"

var dockerComposePath = path.resolve(workingDir, config.docker.compose)

if (!fs.existsSync(dockerComposePath)) {
    info("Docker", "Docker compose file not found. Copying deafult docker-compose.")
    console.log("")

    dockerComposePath = path.resolve(workingDir, "./docker-compose.yml")
    fs.writeFileSync(dockerComposePath, fs.readFileSync(
        path.resolve(__dirname, "./docker/deafult-docker.yml")
    ))
}

fs.writeFileSync(path.resolve(workingDir, "./dev.sh"), `
#!/usr/bin/env bash
npx docker-dedicated dev
`.trim())
fs.writeFileSync(path.resolve(workingDir, "./dev.bat"), `
@echo off
npx docker-dedicated dev
`.trim())

async function waitUntilDockerConnection() {
    return new Promise((resolve, reject) => {
        tcpPortUsed.waitUntilUsedOnHost(config.server.port, config.server.host, 1000, 30000)
        .then(() => {
            setTimeout(resolve, 5000)
        })
        .catch(reject)
    })
}

async function startDocker() {
    exec(`docker-compose up`, {cwd: workingDir}, (err) => {
        if (err) error("Docker", "Error in docker-compose: " + err, true)
    })

    return await waitUntilDockerConnection()
}

function watchGqlSchema() {
    async function updateGqlSchema() {  
        cli.abort()
        const schema = fs.readFileSync(schemaPath)

        const validateRaw = await nodeFetch(validatePath, {
            method: "POST",
            body: schema
        }).catch((err) => {
            error("Validation", `Error sending validation request to ${validatePath}`)
            error("Validation", err)
        })

        if (!validateRaw) return
        const validate = await validateRaw.json()

        const firstElement = validate.errors[0]

        if (
            firstElement && 
            firstElement.extensions && 
            firstElement.extensions.code === "success") 
        {
            success("Validation", `Youre GQl schema validated successfully. Write "migrate" to update.`)
            cli.schema = schema
            cli.schemaValid = true
        } else if (firstElement) {
            validate.errors.forEach(element => {
                error("Validation", `Schema validation: "${element.message}".`)
            })

            cli.schemaValid = false
        } else {    
            error("Validation", "Unknown validation error! Data: " + validate)

            cli.schemaValid = false
        }

        cli.resume()
    }

    if (!fs.existsSync(schemaPath)) {
        fs.writeFileSync(schemaPath, "")
    }

    fs.watchFile(schemaPath, {interval: 500}, async (curr) => {
        await updateGqlSchema(curr)
    })

    success("Watch", "Successfully watching schema: " + schemaPath)
    success("Startup", `Startup completed successfully. Run query on ${protocol}${graphqlServer}/graphql`)
    info("Startup", `Start editing ${schemaPath} to get live updates!`)
    console.log("")
    cli.start(migratePath, alterPath)
}

async function runDev() {
    info("Startup", `Run "npx docker-dedicated prod" to run in production.`)
    info("Startup", `Starting GQL dev server host: ${graphqlServer}; ssl: ${config.server.ssl};`)
    info("Startup", `Name: dGraph GQL server; Version: 2.0.5; Author: klevn;`)

    info("Docker", `Starting docker server with ${dockerComposePath}.`)

    await startDocker()
    .catch(() => {
        error("Docker", "The docker server did not start properly. Max timeout reached.", true)
    })
    .then(() => {
        success("Docker", "Successfully running docker container.")
        info("Watch", "Trying to find and watch GQL schema.")
        watchGqlSchema()
    })
}

async function runProd(){
    info("Startup", "Starting server in production mode.")
    info("Docker", `Starting docker server with ${dockerComposePath}.`)
    await startDocker()
    success("Docker", "Successfully running docker container.")
}


if (process.argv[2] == "dev" || !process.argv[2]) {
    runDev()
} else if (process.argv[2] == "prod") {
    runProd()
}