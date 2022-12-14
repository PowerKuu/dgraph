import colors from "colors"
import figlet from "figlet"

const version = "3.0.0"

export default {
    startup: {
        heading: () => {
        const header = figlet.textSync('DgraphCLI', {
            font: 'Graffiti',
            horizontalLayout: 'default',
            verticalLayout: 'default',
            
            whitespaceBreak: true
        })

        const indent = () => {
            return header.split("\n").map((str) => {
                return "  " + str
            }).join("\n")
        }

        return `  
${colors.rainbow(indent())}
        
  Name: DgraphCLI
  Version: ${version}
  Author: https://klevn.com
`       },

        success: (protocol:string, graphqlServer:string) => `Startup completed successfully. Run query on ${protocol}${graphqlServer}/graphql.`,

        prodMode: () => "Starting server in production mode.",
        livePlug: (schemaPath:string) => `Start editing ${schemaPath} to get live updates!`,
        
        startingGQL: (graphqlPath:string) => `Starting GQL dev server host: ${graphqlPath}.`
    },

    watch: {
        start: () => "Trying to find and watch GQL schema.",
        success: (schemaPath:string) => `Successfully watching schema: ${schemaPath}.`
    },

    docker: {
        error: (err:string) => `Error in docker-compose: ${err}.`,
        notFound: () => "Docker compose file not found. Copying deafult docker-compose.",
        start: (dockerComposePath:string) => `Starting docker server with ${dockerComposePath}.`,
        timeout: () => "The docker server did not start properly. Max timeout reached.",
        success: () => "Successfully running docker container."
    },
    
    
    
    validation: {
        errorSending: (validatePath:string) => `Error sending validation request to ${validatePath}.`,
        errorMessage: (message:string) => `Schema validation: "${message}".`,
        unknownError: (validate:string) => `Unknown validation error! Data: ${validate}.`,

        success: () => `Youre GQl schema validated successfully. Write "migrate" to update.`,
    },
    
    
    
    help: () => `
  List of commands:
  -   migrate: "Merge schema into the databse."
  -   drop [data/schema]: "Drop all data/schema and data from the database."
  -   reload: "Runs "drop schema" and "migrate".
  -   ratel: "Run the ratel GUI to inspect data."

  -   stop: "Stop this process."
  -   help: "This list of commands."
  `,

    deafult: (command:string) => `No command with name ${command}. Type "help" for all commands.`,
    question: () => `  [${colors.cyan(`DGRAPH V${version}`)}] [${new Date().toLocaleDateString("en-US")}]\n  -> `,
 
    ratel: {
        start: () => "Starting ratel server...",
        wait: () => `Wait a few seconds and then access ratel on "http://localhost:8000".`,
        errorRunning: () => "Unexpected error while running the ratel server.",
        isPortTaken: () => "Is port(8000) taken or is ratel already running?",
        changeDockerYML: (ratelPath:string) => `U can change docker-compose.yml at ${ratelPath} (Not recommended).`
    },

    migrating: {
        notValid: () => "Youre schema is not valid! Aborting migration.",
        starting: () => "Starting to migrate schema to database...",
        success: (status:number) => `Migrated schema to database. Status code: ${status}.`,
        error: (err:string) => `Unexpected error while migrating: ${err}.`
    },

    drop: {
        argumentData: () => "Argument must be a schema or data.",
        data: {
            starting: () => "Dropping data from database...",
            success: () => "Dropped all data from database.",
            error: (err:string) => `Unexpected error while dropping data: ${err}.`
        },

        schema: {
            starting: () => "Dropping schema and data from database...",
            success: () => "Dropped all schemas and data from database.",
            error: (err:string) => `Unexpected error while dropping schemas and data: ${err}.`
        }
    }
}