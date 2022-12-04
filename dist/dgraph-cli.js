import { resolve } from "path";
import nodeFetch from "node-fetch";
import * as open from "open";
import { exec } from "child_process";
import { error, info, success } from "./utils/logger";
import lang from "./lang";
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});
const deafultRatelHost = "http://localhost:8000/?latest";
class CLI {
    paths;
    schemaValid;
    schema;
    aborter;
    start(paths) {
        this.paths = paths;
        this.schema = "";
        this.schemaValid = false;
        this.aborter = new AbortController();
        this.resume();
    }
    help() {
        cliSingelton.pause();
        console.log(lang.help());
        cliSingelton.resume();
    }
    ratel() {
        cliSingelton.pause();
        info("ratel", lang.ratel.start());
        const ratelPath = resolve(__dirname, "./docker/ratel");
        exec("docker-compose up", { cwd: ratelPath }, (err) => {
            if (err) {
                cliSingelton.pause();
                error("ratel", lang.ratel.errorRunning());
                error("ratel", lang.ratel.isPortTaken());
                info("ratel", lang.ratel.changeDockerYML(ratelPath));
                cliSingelton.resume();
            }
        });
        info("ratel", lang.ratel.wait());
        setTimeout(() => {
            open(deafultRatelHost);
        }, 5000);
        cliSingelton.resume();
    }
    execute(argv) {
        const command = argv[0];
        const firstArgmuent = argv[1];
        const cases = {
            help: () => {
                this.help();
            },
            stop: () => {
                process.exit(0);
            },
            migrate: () => {
                this.migrate();
            },
            drop: () => {
                this.drop(firstArgmuent);
            },
            reload: () => {
                this.reload();
            },
            ratel: () => {
                this.ratel();
            },
            default: () => {
                this.pause();
                info("cli", lang.deafult(firstArgmuent));
                this.resume();
            }
        };
        if (!command)
            return;
        if (cases[command])
            cases[command]();
        else
            cases.default();
    }
    drop(firstArgmuent, resume = true) {
        return new Promise((resolve, reject) => {
            cliSingelton.pause();
            if (firstArgmuent != "data" && firstArgmuent != "schema") {
                error("drop", lang.drop.argumentData());
                cliSingelton.resume();
                return;
            }
            const dropingData = firstArgmuent == "data";
            const requestAlter = () => {
                const body = dropingData ? { drop_op: "DATA" } : { drop_all: true };
                return Promise.all([
                    nodeFetch(this.paths.alter, {
                        "method": "OPTIONS"
                    }),
                    nodeFetch(this.paths.alter, {
                        "body": JSON.stringify(body),
                        "method": "POST"
                    })
                ]);
            };
            const dropData = async () => {
                info("drop", lang.drop.data.starting());
                return requestAlter().then(() => {
                    success("drop", lang.drop.data.success());
                    resolve(true);
                }).catch((err) => {
                    error("drop", lang.drop.data.error(err));
                    reject();
                });
            };
            const dropSchema = async () => {
                info("drop", lang.drop.schema.starting());
                return requestAlter().then(() => {
                    success("drop", lang.drop.schema.success());
                    resolve(true);
                }).catch((err) => {
                    error("drop", lang.drop.schema.error(err));
                    reject();
                });
            };
            const operation = dropingData ? dropData : dropSchema;
            operation().finally(() => {
                if (resume)
                    cliSingelton.resume();
            });
        });
    }
    pause() {
        if (this.aborter) {
            this.aborter.abort();
            delete this.aborter;
        }
        const aborter = new AbortController();
        this.aborter = aborter;
        return aborter;
    }
    resume() {
        if (!this.aborter)
            this.aborter = new AbortController();
        readline.question(lang.question(), { signal: this.aborter.signal }, (command) => {
            const argv = command.split(" ");
            this.execute(argv);
        });
    }
    async migrate() {
        cliSingelton.pause();
        const final = () => {
            cliSingelton.resume();
        };
        if (!this.schemaValid) {
            error("migrating", lang.migrating.notValid());
            final();
            return;
        }
        info("migrating", lang.migrating.starting());
        const response = await nodeFetch(this.paths.migrate, {
            method: "POST",
            body: this.schema
        }).catch((err) => {
            error("migrating", lang.migrating.error(err));
            final();
        });
        if (!response)
            return;
        success("migrating", lang.migrating.success(response.status));
        final();
    }
    async reload() {
        cliSingelton.pause();
        if (!this.schemaValid) {
            error("migrating", lang.migrating.notValid());
            cliSingelton.resume();
        }
        this.drop("schema", false)
            .then(() => this.migrate())
            .catch(() => { });
    }
}
const cliSingelton = new CLI();
export default cliSingelton;
