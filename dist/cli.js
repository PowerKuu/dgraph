"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const node_fetch_1 = __importDefault(require("node-fetch"));
const open_1 = __importDefault(require("open"));
const child_process_1 = require("child_process");
const console_clear_1 = __importDefault(require("console-clear"));
const logger_1 = require("./utils/logger");
const lang_1 = __importDefault(require("./lang"));
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
        (0, console_clear_1.default)();
        this.paths = paths;
        this.schema = "";
        this.schemaValid = false;
        this.pause();
    }
    async execute(argv) {
        const command = argv[0];
        const firstArgmuent = argv[1];
        this.pause();
        const cases = {
            help: async () => {
                this.help();
            },
            stop: async () => {
                process.exit(0);
            },
            migrate: async () => {
                return this.migrate();
            },
            drop: async () => {
                return this.drop(firstArgmuent);
            },
            reload: async () => {
                return this.reload();
            },
            ratel: async () => {
                return this.ratel();
            },
            default: async () => {
                (0, logger_1.info)("cli", lang_1.default.deafult(command));
            }
        };
        if (!command) {
            this.resume();
            return;
        }
        if (cases[command])
            await cases[command]().catch(() => { });
        else
            cases.default();
        this.resume();
    }
    help() {
        console.log(lang_1.default.help());
    }
    ratel() {
        return new Promise((resolve, reject) => {
            (0, logger_1.info)("ratel", lang_1.default.ratel.start());
            const ratelPath = (0, path_1.resolve)(__dirname, "./docker/ratel");
            var execErr;
            (0, logger_1.info)("ratel", lang_1.default.ratel.wait());
            (0, child_process_1.exec)("docker-compose up", { cwd: ratelPath }, (err) => {
                if (err) {
                    execErr = err;
                    (0, logger_1.error)("ratel", err);
                    (0, logger_1.error)("ratel", lang_1.default.ratel.errorRunning());
                    (0, logger_1.error)("ratel", lang_1.default.ratel.isPortTaken());
                    (0, logger_1.info)("ratel", lang_1.default.ratel.changeDockerYML(ratelPath));
                    reject();
                }
            });
            setTimeout(() => {
                if (execErr)
                    return;
                (0, open_1.default)(deafultRatelHost);
                resolve(true);
            }, 5000);
        });
    }
    drop(firstArgmuent) {
        return new Promise((resolve, reject) => {
            if (firstArgmuent != "data" && firstArgmuent != "schema") {
                (0, logger_1.error)("drop", lang_1.default.drop.argumentData());
                reject();
                return;
            }
            const dropingData = firstArgmuent == "data";
            const requestAlter = () => {
                const body = dropingData ? { drop_op: "DATA" } : { drop_all: true };
                return Promise.all([
                    (0, node_fetch_1.default)(this.paths.alter, {
                        "method": "OPTIONS"
                    }),
                    (0, node_fetch_1.default)(this.paths.alter, {
                        "body": JSON.stringify(body),
                        "method": "POST"
                    })
                ]);
            };
            const dropData = async () => {
                (0, logger_1.info)("drop", lang_1.default.drop.data.starting());
                return requestAlter().then(() => {
                    (0, logger_1.success)("drop", lang_1.default.drop.data.success());
                }).catch((err) => {
                    (0, logger_1.error)("drop", lang_1.default.drop.data.error(err));
                });
            };
            const dropSchema = async () => {
                (0, logger_1.info)("drop", lang_1.default.drop.schema.starting());
                return requestAlter().then(() => {
                    (0, logger_1.success)("drop", lang_1.default.drop.schema.success());
                }).catch((err) => {
                    (0, logger_1.error)("drop", lang_1.default.drop.schema.error(err));
                });
            };
            const operation = dropingData ? dropData : dropSchema;
            operation().finally(() => {
                resolve(true);
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
        readline.question(lang_1.default.question(), { signal: this.aborter.signal }, (command) => {
            const argv = command.split(" ");
            this.execute(argv);
        });
    }
    async migrate() {
        if (!this.schemaValid) {
            (0, logger_1.error)("migrating", lang_1.default.migrating.notValid());
            return;
        }
        (0, logger_1.info)("migrating", lang_1.default.migrating.starting());
        const response = await (0, node_fetch_1.default)(this.paths.migrate, {
            method: "POST",
            body: this.schema
        }).catch((err) => {
            (0, logger_1.error)("migrating", lang_1.default.migrating.error(err));
        });
        if (!response)
            return;
        (0, logger_1.success)("migrating", lang_1.default.migrating.success(response.status));
    }
    async reload() {
        if (!this.schemaValid) {
            (0, logger_1.error)("migrating", lang_1.default.migrating.notValid());
            return;
        }
        await this.drop("schema")
            .then(() => this.migrate())
            .catch(() => { });
        return;
    }
}
const cliSingelton = new CLI();
exports.default = cliSingelton;
