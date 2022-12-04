"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.success = exports.info = exports.error = exports.logBreak = exports.log = void 0;
const colors_1 = __importDefault(require("colors"));
function log(staus, state, message) {
    console.log(`  [${colors_1.default.bold(state.toUpperCase())}](${colors_1.default.cyan(staus)}) -> ${(message)}`);
}
exports.log = log;
function logBreak() {
    console.log("");
}
exports.logBreak = logBreak;
function error(state, message, fatal = false) {
    log(colors_1.default.red("ERROR"), state, message);
    if (fatal)
        throw new Error();
}
exports.error = error;
function info(state, message) {
    log(colors_1.default.yellow("INFO"), state, message);
}
exports.info = info;
function success(state, message) {
    log(colors_1.default.green("SUCCESS"), state, message);
}
exports.success = success;
