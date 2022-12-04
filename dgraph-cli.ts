//!
//! This file need to be cleaned up. And is a beta release.
//!



import colors from "colors"
import path from "path"
import nodeFetch from "node-fetch"
import open from "open" 
import { exec } from "child_process"

import {error, info, success} from "./utils/logger"

import lang from "./lang"

const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
})

function help() {
    cliSingelton.abort()
    console.log(lang.help())
    cliSingelton.resume()
}

const deafultRatelHost = "http://localhost:8000/?latest"


function ratel() {
    cliSingelton.abort()
    info("Ratel", lang.ratel.start())
    const ratelPath = path.resolve(__dirname, "./docker/ratel")

    exec("docker-compose up", {cwd: ratelPath}, (err) => {
        if (err) {
            cliSingelton.abort()
            error("Ratel", lang.ratel.errorRunning())
            error("Ratel", lang.ratel.isPortTaken())
            info("Ratel", lang.ratel.changeDockerYML(ratelPath))
            cliSingelton.resume()
        }
    })
    info("Ratel", lang.ratel.wait())

    setTimeout(() => {
        open(deafultRatelHost)    
    }, 5000)

    cliSingelton.resume()
}

class CLI {
    schemaValid: boolean
    schema: string

    migratePath: string
    alterPath: string

    aborter: AbortController

    start(migratePath:string, alterPath:string) {
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

    execute(argv:string[]){
        switch (argv[0]) {
            case "help":
                help()
                break
            case "stop":
                process.exit(0)
                break

            case "migrate":
                if (!this.schemaValid) {
                    cliSingelton.abort()
                    error("Migrating", lang.migrating.notValid())
                    cliSingelton.resume()
                } else {
                    this.migrate()
                }

                break
            case "drop":
                if (argv[1] != "data" && argv[1] != "schema") {
                    cliSingelton.abort()
                    error("Drop", lang.drop.argumentData())
                    cliSingelton.resume()
                    return
                }
                
                this.drop(argv[1])
                break
            case "reload":
                if (!this.schemaValid) {
                    cliSingelton.abort()
                    error("Migrating", lang.migrating.notValid())
                    cliSingelton.resume()
                } else {
                    this.reload()
                }
                break
            case "ratel":
                ratel()
                break

            default:
                info("CLI", lang.deafult(argv[1]))
                this.resume()
        }
    }

    resume(){
        readline.question(`(CLI) [${colors.cyan("DGRAPH")}]: `, { signal: this.aborter.signal }, (command:string) => {
            const argv = command.split(" ")
            this.execute(argv)
        })
    }



    migrate() {
        cliSingelton.abort()
        info("Migrating", lang.migrating.starting())
        
        nodeFetch(this.migratePath, {
            method: "POST",
            body: this.schema
        }).then((code) => {
            success("Migrating", lang.migrating.success(code.status))
        }) .catch((err) => {
            error("Migrating", lang.migrating.error(err))
        }) .finally(() => {
            cliSingelton.resume()
        })
    }

    drop(data:"schema"|"data", resume = true) {
        return new Promise((resolve, reject) => {
            cliSingelton.abort()
    
            if (data == "data"){
                info("Drop", lang.drop.data.starting())
    
                const alter1Request = nodeFetch(this.alterPath, {
                    "body": JSON.stringify({
                        drop_op: "DATA"
                    }),
                    "method": "POST"
                })

                const alter2Request = nodeFetch(this.alterPath, {
                    "body": null,
                    "method": "OPTIONS"
                })
    
    
                Promise.all([alter1Request, alter2Request])
                .then(() => {
                    success("Drop", lang.drop.data.success())
                    resolve(true)
                }).catch((err) => {
                    error("Drop", lang.drop.data.error(err))
                    reject(true)
                }) .finally(() => {
                    if (resume) cliSingelton.resume()
                })
                
                return
            } else {
                info("Drop", lang.drop.schema.starting())
                const alter1 = nodeFetch(this.alterPath, {
                    "body": JSON.stringify({
                        drop_all: true
                    }),
                    "method": "POST"
                })
                const alter2 = nodeFetch(this.alterPath, {
                    "body": null,
                    "method": "OPTIONS"
                })
    
                Promise.all([alter1, alter2])
                .then(() => {
                    resolve(true)
                    success("Drop", lang.drop.schema.success())
                }).catch((err) => {
                    reject()
                    error("Drop", lang.drop.schema.error(err))
                }) .finally(() => {
                    if (resume) cliSingelton.resume()
                })
                
                return
            }
        })
    }

    async reload() {
        cliSingelton.abort()
        this.drop("schema", false)
        .then(() => {
            this.migrate()
        })
        .catch(() => {
    
        })
    }
}

const cliSingelton = new CLI()
export default cliSingelton