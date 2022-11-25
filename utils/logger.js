const colors = require("colors")

function log(staus, state, message) {
    console.log(`(${staus}) [${colors.bold(state.toUpperCase())}] -> ${colors.bold(message)}`)
}


function error(state, message, fatal = false) {
    log(colors.red("ERROR"), state, message)
    if (fatal) throw new Error()
}

function info(state, message) {
    log(colors.yellow("INFO"), state, message)
}

function success(state, message) {
    log(colors.green("SUCCESS"), state, message)
}

exports.error = error
exports.info = info
exports.success = success









fetch("http://localhost:8080/alter", {
  "headers": {
    "accept": "*/*",
    "accept-language": "nb-NO,nb;q=0.9,no;q=0.8,nn;q=0.7,en-US;q=0.6,en;q=0.5",
    "content-type": "text/plain;charset=UTF-8",
    "sec-ch-ua": "\"Google Chrome\";v=\"107\", \"Chromium\";v=\"107\", \"Not=A?Brand\";v=\"24\"",
    "sec-ch-ua-mobile": "?1",
    "sec-ch-ua-platform": "\"Android\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "x-auth-token": "undefined",
    "Referer": "http://localhost:8000/",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  },
  "body": "{\"drop_op\":\"DATA\"}",
  "method": "POST"
});