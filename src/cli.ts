import {resolve as resolvePath} from "path"
import nodeFetch from "node-fetch"
import openFile from "open" 
import { exec } from "child_process"

import clear from "console-clear"

import {error, info, success} from "./utils/logger"

import { Paths, Cases } from "./types"
import lang from "./lang"

const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
})

const deafultRatelHost = "http://localhost:8000/?latest"

class CLI {
    paths:Paths

    schemaValid: boolean
    schema: string

    aborter?: AbortController

    start(paths:Paths) {
        clear()

        this.paths = paths

        this.schema = ""
        this.schemaValid = false
        
        this.pause()
    }



    async execute(argv:string[]){
        const command = argv[0]
        const firstArgmuent = argv[1]

        this.pause()

        const cases:Cases = {
            help: async () => {
                this.help()
            },
            stop: async () => {
                process.exit(0)
            },
            migrate: async () => {
                return this.migrate()
            },
            drop: async () => {    
                return this.drop(firstArgmuent)
            },
            reload: async () => {
                return this.reload()
            },
            ratel: async () => {
                return this.ratel()
            },

            default: async () => {
                info("cli", lang.deafult(command))
            }
        }

        if (!command) {
            this.resume() 
            return
        }

        if (cases[command]) await cases[command]().catch(() => {})
        else cases.default()

        this.resume()
    }


    help() {
        console.log(lang.help())
    }
    
    ratel() {
        return new Promise((resolve, reject) => {
            info("ratel", lang.ratel.start())
            const ratelPath = resolvePath(__dirname, "./docker/ratel")

            var execErr:any

            info("ratel", lang.ratel.wait())

            exec("docker-compose up", {cwd: ratelPath}, (err) => {
                if (err) {
                    execErr = err

                    error("ratel", err)
                    error("ratel", lang.ratel.errorRunning())
                    error("ratel", lang.ratel.isPortTaken())
                    info("ratel", lang.ratel.changeDockerYML(ratelPath))

                    reject()
                }
            })

            setTimeout(() => {
                if (execErr) return
                openFile(deafultRatelHost)    
                resolve(true)
            }, 5000)
        })
    }

    drop(firstArgmuent:string) {
        return new Promise((resolve, reject) => {
            if (firstArgmuent != "data" && firstArgmuent != "schema") {
                error("drop", lang.drop.argumentData())
                reject()
                return
            }

            const dropingData = firstArgmuent == "data"

            const requestAlter = () => {
                const body = dropingData ? {drop_op: "DATA"} : {drop_all: true}

                return Promise.all([
                    nodeFetch(this.paths.alter, {
                        "method": "OPTIONS"
                    }), 

                    nodeFetch(this.paths.alter, {
                        "body": JSON.stringify(body),
                        "method": "POST"
                    })
                ])
            }

            const dropData = async () => {
                info("drop", lang.drop.data.starting())

                return requestAlter().then(() => {
                    success("drop", lang.drop.data.success())
                }).catch((err) => {
                    error("drop", lang.drop.data.error(err))
                })
            }

            const dropSchema = async () => {
                info("drop", lang.drop.schema.starting())
    
                return requestAlter().then(() => {
                    success("drop", lang.drop.schema.success())
                }).catch((err) => {
                    error("drop", lang.drop.schema.error(err))
                })
            }
    
            const operation = dropingData ? dropData : dropSchema

            operation().finally(() => {
                resolve(true)
            })
        })
    }


    pause() {
        if (this.aborter) {
            this.aborter.abort()
            delete this.aborter
        }

        const aborter = new AbortController()
        this.aborter = aborter
        return aborter
    }

    resume(){
        if (!this.aborter) this.aborter = new AbortController()

        readline.question(lang.question(), { signal: this.aborter.signal }, (command:string) => {
            const argv = command.split(" ")
            this.execute(argv)
        })
    }

    async migrate() {

        if (!this.schemaValid) {
            error("migrating", lang.migrating.notValid())
            return
        }

        info("migrating", lang.migrating.starting())
        
        const response = await nodeFetch(this.paths.migrate, {
            method: "POST",
            body: this.schema
        }).catch((err) => {
            error("migrating", lang.migrating.error(err))
        })

        if (!response) return

        success("migrating", lang.migrating.success(response.status))
    }

    async reload() {
        if (!this.schemaValid) {
            error("migrating", lang.migrating.notValid())
            return
        }

        await this.drop("schema")
        .then(() => this.migrate())
        .catch(() => {})

        return
    }
}

const cliSingelton = new CLI()
export default cliSingelton