#!/usr/bin/env node

import {existsSync, readFileSync, writeFileSync, watchFile} from "fs"
import {resolve} from "path"
import {exec} from "child_process"

import { waitUntilUsedOnHost } from "tcp-port-used"
import nodeFetch from "node-fetch"

import {error, info, success, logBreak} from "./utils/logger"
import cliSingelton from "./cli"

import {Config, Paths} from "./types"

import lang from "./lang"

const workingDir = process.cwd()

const configPath = resolve(workingDir, "./dgraph-dedicated.json")
var currentConfig:Partial<Config>

try {currentConfig = require(configPath)} catch (e) {currentConfig = {}}


const deafults = {
    config: {
        "server": {
            "host": "localhost",
            "port": 8080,
            "ssl":  false
        },
    
        "schema": "./schema.graphql",
        "docker": {
            "compose": "./docker-compose.yml",
            "name": "dgraph-dedicated",
        }
    },

    devSh: `
#!/usr/bin/env bash
npx @klevn/dgraph cli
    `.trim(),

    devBat: `
@echo off
npx @klevn/dgraph cli
pause
    `.trim()
}

const config:Config = {
    ...deafults.config,
    ...currentConfig
}

const graphqlServerHost = `${config.server.host}:${config.server.port}`
const protocol = config.server.ssl ? "https://" : "http://"

const paths:Paths = {
    graphql: protocol + graphqlServerHost,

    schema: resolve(workingDir, config.schema),
    validate: protocol + graphqlServerHost + "/admin/schema/validate",
    migrate:  protocol + graphqlServerHost + "/admin/schema",
    alter: protocol + graphqlServerHost + "/alter",

    dockerCompose: resolve(workingDir, config.docker.compose)
}

writeFileSync(resolve(workingDir, "./dev.sh"), deafults.devSh)
writeFileSync(resolve(workingDir, "./dev.bat"), deafults.devBat)


async function insureDockerExists() {
    if (!existsSync(paths.dockerCompose)) {
        info("Docker", lang.docker.notFound())
        logBreak()
    
        paths.dockerCompose = resolve(workingDir, "./docker-compose.yml")
        writeFileSync(paths.dockerCompose, readFileSync(
            resolve(__dirname, "./docker/deafult-docker.yml")
        ))
    }
}

async function startDocker() {
    insureDockerExists()

    exec(`docker-compose up`, {cwd: workingDir}, (err) => {
        if (err) error("Docker", lang.docker.error(String(err)), true)
    })

    return await waitUntilDockerConnection().catch(() => {
        error("docker", lang.docker.timeout(), true)
    })
}

async function waitUntilDockerConnection() {
    return new Promise((resolve, reject) => {
        waitUntilUsedOnHost(config.server.port, config.server.host, 1000, 30000)
        .then(() => {
            setInterval(() => {
                nodeFetch(paths.graphql).then(() => {
                    resolve(true)
                }).catch(() => {})
            }, 2000)
        })
        .catch(reject)
    })
}


async function watchGqlSchema() {
    async function updateGqlSchema() {  
        cliSingelton.pause()
        const schema = readFileSync(paths.schema, {
            encoding: "utf-8"
        })

        const validateRaw = await nodeFetch(paths.validate, {
            method: "POST",
            body: schema
        }).catch((err) => {
            error("Validation", lang.validation.errorSending(paths.validate))
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
            cliSingelton.schema = schema
            cliSingelton.schemaValid = true
        } else if (firstElement) {
            validate.errors.forEach(element => {
                error("Validation", lang.validation.errorMessage(element.message))
            })

            cliSingelton.schemaValid = false
        } else {    
            error("Validation", lang.validation.unknownError(validate))

            cliSingelton.schemaValid = false
        }
    }

    if (!existsSync(paths.schema)) {
        writeFileSync(paths.schema, "")
    }

    watchFile(paths.schema, {interval: 500}, async () => {
        await updateGqlSchema()
    })

    success("Watch", lang.watch.success(paths.schema))
    success("Startup", lang.startup.success(protocol, graphqlServerHost))
    info("Startup", lang.startup.livePlug(paths.schema))
    logBreak()
    await updateGqlSchema()
    logBreak()
}


async function runCli() {
    cliSingelton.start(paths)

    console.log(lang.startup.heading())

    info("Startup", lang.startup.startingGQL(paths.graphql))

    info("Docker", lang.docker.start(paths.dockerCompose))

    await startDocker().catch((err) => {
        error("Docker", err, true)
    })

    success("Docker", lang.docker.success())
    info("Watch", lang.watch.start())
    await watchGqlSchema()
    
    cliSingelton.resume()
}

async function runProd(){
    info("Startup", lang.startup.prodMode())
    info("Docker", lang.docker.start(paths.dockerCompose))
    await startDocker()
    success("Docker", lang.docker.success())
}


//# Run

insureDockerExists()

if (process.argv[2] == "cli" || !process.argv[2]) {
    runCli()
} else if (process.argv[2] == "production") {
    runProd()
}