#!/usr/bin/env node

import fs from "fs"
import path from "path"
import {exec} from "child_process"

import tcpPortUsed from "tcp-port-used"
import nodeFetch from "node-fetch"

import {error, info, success, logBreak} from "./utils/logger"
import cli from "./dgraph-cli"

import lang from "./lang"

interface Config {
    server: {
        host: string,
        port: number,
        ssl:  boolean
    },

    schema: string,
	docker: {
		compose: string,
		name: string,
	}
}

const workingDir = process.cwd()

const configPath = path.resolve(workingDir, "./dgraph-dedicated.json")
var currentConfig:Partial<Config>

try {
    currentConfig = require(configPath)
} catch (e) {
    currentConfig = {}
}

const config:Config = {
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
    info("Docker", lang.docker.notFound())
    logBreak()

    dockerComposePath = path.resolve(workingDir, "./docker-compose.yml")
    fs.writeFileSync(dockerComposePath, fs.readFileSync(
        path.resolve(__dirname, "./docker/deafult-docker.yml")
    ))
}

fs.writeFileSync(path.resolve(workingDir, "./dev.sh"), `
#!/usr/bin/env bash
npx dgraph-dedicated dev
`.trim())
fs.writeFileSync(path.resolve(workingDir, "./dev.bat"), `
@echo off
npx dgraph-dedicated dev
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
        if (err) error("Docker", lang.docker.error(String(err)), true)
    })

    return await waitUntilDockerConnection()
}

function watchGqlSchema() {
    async function updateGqlSchema() {  
        cli.abort()
        const schema = fs.readFileSync(schemaPath, {
            encoding: "utf-8"
        })

        const validateRaw = await nodeFetch(validatePath, {
            method: "POST",
            body: schema
        }).catch((err) => {
            error("Validation", lang.validation.errorSending(validatePath))
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
            success("Validation", lang.validation.success())
            cli.schema = schema
            cli.schemaValid = true
        } else if (firstElement) {
            validate.errors.forEach(element => {
                error("Validation", lang.validation.errorMessage(element.message))
            })

            cli.schemaValid = false
        } else {    
            error("Validation", lang.validation.unknownError(validate))

            cli.schemaValid = false
        }

        cli.resume()
    }

    if (!fs.existsSync(schemaPath)) {
        fs.writeFileSync(schemaPath, "")
    }

    fs.watchFile(schemaPath, {interval: 500}, async () => {
        await updateGqlSchema()
    })

    success("Watch", lang.watch.success(schemaPath))
    success("Startup", lang.startup.success(protocol, graphqlServer))
    info("Startup", lang.startup.livePlug(schemaPath))
    logBreak()
    cli.start(migratePath, alterPath)
}

async function runDev() {
    info("Startup", lang.startup.prodPlug())
    info("Startup", lang.startup.startingGQL(graphqlServer, config.server.ssl))
    info("Startup", lang.startup.info())

    info("Docker", lang.docker.start(dockerComposePath))

    await startDocker()
    .catch(() => {
        error("Docker", lang.docker.timeout(), true)
    })
    .then(() => {
        success("Docker", lang.docker.success())
        info("Watch", lang.watch.start())
        watchGqlSchema()
    })
}

async function runProd(){
    info("Startup", lang.startup.prodMode())
    info("Docker", lang.docker.start(dockerComposePath))
    await startDocker()
    success("Docker", lang.docker.success())
}


if (process.argv[2] == "dev" || !process.argv[2]) {
    runDev()
} else if (process.argv[2] == "prod") {
    runProd()
}