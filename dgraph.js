// https://github.com/graphql/graphql-playground/releases/tag/v1.8.10
// http://localhost:8080/graphql

const fs = require("fs")
const path = require("path")
const {exec} = require("child_process")

const tcpPortUsed = require("tcp-port-used")
const nodeFetch = require("node-fetch")

const {error, info, success} = require("./utils/logger")

const workingDir = __dirname

const graphqlSsl = false
const graphqlHost = "localhost"
const graphqlPort = 8080
const graphqlServer = `${graphqlHost}:${graphqlPort}`

const schemaPath = path.join(workingDir, "/schema.graphql")
const dockerComposePath = path.join(workingDir, "/docker-compose.yml")

const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
})

async function waitUntilDockerConnection() {
    return new Promise((resolve, reject) => {
        tcpPortUsed.waitUntilUsedOnHost(graphqlPort, graphqlHost, 1000, 30000)
        .then(() => {
            setTimeout(resolve, 5000)
        })
        .catch(reject)
    })
}

async function startDocker() {
    exec("docker-compose up", {cwd: workingDir}, (error) => {
        if (error) error("Docker", "Random error: " + error, true)
    })

    return await waitUntilDockerConnection()
}

function watchGqlSchema() {
    async function updateGqlSchema() {  
        console.log("")

        const schema = fs.readFileSync(schemaPath)
        const protocol = graphqlSsl ? "https://" : "http://"
        const validatePath = protocol + graphqlServer + "/admin/schema/validate"
        const migratePath = protocol + graphqlServer + "/admin/schema"

        const validateRaw = await nodeFetch(validatePath, {
            method: "POST",
            body: schema
        }).catch((error) => {
            error("Validation", `Error sending validation request to ${validatePath}`)
            error("Validation", error)
        })

        if (!validateRaw) return
        const validate = await validateRaw.json()

        const firstElement = validate.errors[0]

        if (
            firstElement && 
            firstElement.extensions && 
            firstElement.extensions.code === "success") 
        {
            success("Validation", "Youre GQl schema validated successfully.")

            readline.question("Type (yes) to migrate schema: ", (msg) => {
                if (msg == "yes") {
                    info("Migrating", "Starting to migrate schema to database.")

                    nodeFetch(migratePath, {
                        method: "POST",
                        body: schema
                    }) 
                    .then((code) => {
                        success("Migrating", "Migrated schema to database. Status code: " + code.status)
                    })
                    .catch((err) => {
                        error("Migrating", "Unexpected error while migrating: " + err)
                    })
                }
            })
        } else if (firstElement) {
            validate.errors.forEach(element => {
                error("Validation", `Schema validation: "${element.message}".`)
            })
        } else {    
            error("Validation", "Unknown validation error. Data: " + validate)
        }
    }

    if (!fs.existsSync(schemaPath)) {
        fs.writeFileSync(schemaPath, "")
    }

    fs.watchFile(schemaPath, {interval: 500}, async (curr) => {
        await updateGqlSchema(curr)
    })

    success("Watch", "Successfully watching schema: " + schemaPath)
    success("Startup", "Startup completed successfully.")
    console.log("[-----------------------------------------------------------------------------------------------]")
}

async function runDev() {
    info("Startup", `Starting GQL dev server host: ${graphqlServer}; ssl: ${graphqlSsl};`)
    info("Startup", `Name: dGraph GQL server; Version: 1.0.0; Author: klevn;`)
    info("Startup", `Start editing ${schemaPath} to get live updates!`)

    info("Docker", `Starting docker server with ${dockerComposePath}.`)

    await startDocker()
    .catch(() => {
        error("Docker", "The docker server did not start properly. Max timeout reached.", true)
    })
    .then(() => {
        success("Docker", "Successfully running docker container.")
        info("Watch", "Trying to find and wath GQL schema.")
        watchGqlSchema()
    })
}

runDev()