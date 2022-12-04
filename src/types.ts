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

export interface Paths {
    schema: string
    validate: string
    migrate: string
    alter: string
    dockerCompose: string
}