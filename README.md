# 🔑 web3-api & worker server

Thirdweb's Web3-API & Worker server.

> **Update the ENV vaiables as per your settings/environment.**

## Requirements

1. Docker
2. Nodesjs (>= v18)
3. PostgreSQL
4. ENV Variables (Check `.example.env`)
5. PG-Admin (Optional. PostgreSQL GUI)

## Running locally

1. Create a `.env` file and add all the environment variables from `.example.env`.
2. Run command: `yarn infra`

Locally, we use `docker-compose` to spin up the services, database and pg-admin GUI altogether.

The API will be accessible on `http://localhost:3005` by default.

## Running on a server

1. Set all environment variables defined in `.example.env`
2. Run command: `yarn start`

This will only run the required services. You will need to have a running postgres database that can be accessed from those services.

## Docs

You can view a live version of the Swagger documentation at: https://web3-api-akbv.chainsaw-dev.zeet.app

When running locally, the swagger docs are automatically deployed at `http://localhost:3005` or your remote server URL.

## Data Inpection

In local development, you can inspect your databaes through PG-Admin (Optional) at `http://localhost:5050`.
