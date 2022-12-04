export interface Config {
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

export interface Cases {
    [name:string]: () => Promise<any>
}

export interface Paths {
    graphql: string,
    schema: string
    validate: string
    migrate: string
    alter: string
    dockerCompose: string
}