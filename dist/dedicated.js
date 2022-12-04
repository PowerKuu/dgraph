#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const child_process_1 = require("child_process");
const tcp_port_used_1 = require("tcp-port-used");
const node_fetch_1 = __importDefault(require("node-fetch"));
const logger_1 = require("./utils/logger");
const cli_1 = __importDefault(require("./cli"));
const lang_1 = __importDefault(require("./lang"));
const workingDir = process.cwd();
const configPath = (0, path_1.resolve)(workingDir, "./dgraph-dedicated.json");
var currentConfig;
try {
    currentConfig = require(configPath);
}
catch (e) {
    currentConfig = {};
}
const deafults = {
    config: {
        "server": {
            "host": "localhost",
            "port": 8080,
            "ssl": false
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
};
const config = {
    ...deafults.config,
    ...currentConfig
};
const graphqlServerHost = `${config.server.host}:${config.server.port}`;
const protocol = config.server.ssl ? "https://" : "http://";
const paths = {
    graphql: protocol + graphqlServerHost,
    schema: (0, path_1.resolve)(workingDir, config.schema),
    validate: protocol + graphqlServerHost + "/admin/schema/validate",
    migrate: protocol + graphqlServerHost + "/admin/schema",
    alter: protocol + graphqlServerHost + "/alter",
    dockerCompose: (0, path_1.resolve)(workingDir, config.docker.compose)
};
(0, fs_1.writeFileSync)((0, path_1.resolve)(workingDir, "./dev.sh"), deafults.devSh);
(0, fs_1.writeFileSync)((0, path_1.resolve)(workingDir, "./dev.bat"), deafults.devBat);
async function insureDockerExists() {
    if (!(0, fs_1.existsSync)(paths.dockerCompose)) {
        (0, logger_1.info)("Docker", lang_1.default.docker.notFound());
        (0, logger_1.logBreak)();
        paths.dockerCompose = (0, path_1.resolve)(workingDir, "./docker-compose.yml");
        (0, fs_1.writeFileSync)(paths.dockerCompose, (0, fs_1.readFileSync)((0, path_1.resolve)(__dirname, "./docker/deafult-docker.yml")));
    }
}
async function startDocker() {
    insureDockerExists();
    (0, child_process_1.exec)(`docker-compose up`, { cwd: workingDir }, (err) => {
        if (err)
            (0, logger_1.error)("Docker", lang_1.default.docker.error(String(err)), true);
    });
    return await waitUntilDockerConnection().catch(() => {
        (0, logger_1.error)("docker", lang_1.default.docker.timeout(), true);
    });
}
async function waitUntilDockerConnection() {
    return new Promise((resolve, reject) => {
        (0, tcp_port_used_1.waitUntilUsedOnHost)(config.server.port, config.server.host, 1000, 30000)
            .then(() => {
            setTimeout(resolve, 5000);
        })
            .catch(reject);
    });
}
function watchGqlSchema() {
    async function updateGqlSchema() {
        cli_1.default.pause();
        const schema = (0, fs_1.readFileSync)(paths.schema, {
            encoding: "utf-8"
        });
        const validateRaw = await (0, node_fetch_1.default)(paths.validate, {
            method: "POST",
            body: schema
        }).catch((err) => {
            (0, logger_1.error)("Validation", lang_1.default.validation.errorSending(paths.validate));
            (0, logger_1.error)("Validation", err);
        });
        if (!validateRaw)
            return;
        const validate = await validateRaw.json();
        const firstElement = validate.errors[0];
        if (firstElement &&
            firstElement.extensions &&
            firstElement.extensions.code === "success") {
            (0, logger_1.success)("Validation", lang_1.default.validation.success());
            cli_1.default.schema = schema;
            cli_1.default.schemaValid = true;
        }
        else if (firstElement) {
            validate.errors.forEach(element => {
                (0, logger_1.error)("Validation", lang_1.default.validation.errorMessage(element.message));
            });
            cli_1.default.schemaValid = false;
        }
        else {
            (0, logger_1.error)("Validation", lang_1.default.validation.unknownError(validate));
            cli_1.default.schemaValid = false;
        }
        cli_1.default.resume();
    }
    if (!(0, fs_1.existsSync)(paths.schema)) {
        (0, fs_1.writeFileSync)(paths.schema, "");
    }
    (0, fs_1.watchFile)(paths.schema, { interval: 500 }, async () => {
        await updateGqlSchema();
    });
    (0, logger_1.success)("Watch", lang_1.default.watch.success(paths.schema));
    (0, logger_1.success)("Startup", lang_1.default.startup.success(protocol, graphqlServerHost));
    (0, logger_1.info)("Startup", lang_1.default.startup.livePlug(paths.schema));
    (0, logger_1.logBreak)();
}
async function runCli() {
    cli_1.default.start(paths);
    console.log(lang_1.default.startup.heading());
    (0, logger_1.info)("Startup", lang_1.default.startup.startingGQL(paths.graphql));
    (0, logger_1.info)("Docker", lang_1.default.docker.start(paths.dockerCompose));
    await startDocker().catch((err) => {
        (0, logger_1.error)("Docker", err, true);
    });
    (0, logger_1.success)("Docker", lang_1.default.docker.success());
    (0, logger_1.info)("Watch", lang_1.default.watch.start());
    watchGqlSchema();
    cli_1.default.resume();
}
async function runProd() {
    (0, logger_1.info)("Startup", lang_1.default.startup.prodMode());
    (0, logger_1.info)("Docker", lang_1.default.docker.start(paths.dockerCompose));
    await startDocker();
    (0, logger_1.success)("Docker", lang_1.default.docker.success());
}
//# Run
insureDockerExists();
if (process.argv[2] == "cli" || !process.argv[2]) {
    runCli();
}
else if (process.argv[2] == "production") {
    runProd();
}
