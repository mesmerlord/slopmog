#!/bin/bash

# Function to build and rollout Docker services
deploy_services() {
    local compose_file=$1
    shift  # Remove first argument (compose_file) from $@

    # Check if compose file is provided
    if [ -z "$compose_file" ]; then
        echo "Error: Please provide a compose file"
        echo "Usage: deploy_services <compose_file> <service1> [service2] [service3] ..."
        return 1
    fi

    # Check if at least one service is provided
    if [ $# -eq 0 ]; then
        echo "Error: Please provide at least one service to deploy"
        echo "Usage: deploy_services <compose_file> <service1> [service2] [service3] ..."
        return 1
    fi

    # Build all specified services at once
    echo "Building services: $@"
    docker compose -f "$compose_file" build "$@"

    # Rollout each service
    for service in "$@"; do
        echo "Rolling out service: $service"
        docker rollout -f "$compose_file" "$service"
    done
}

# Add this to your ~/.bashrc or ~/.bash_aliases
alias deploy='deploy_services'

# Usage examples:
# Single service:
# deploy production.yml slopmog_frontend
#
# Multiple services:
# deploy production.yml slopmog_frontend slopmog_prisma_studio


# Installing
# echo "source ~/slopmog/deploy.sh" >> ~/.bashrc
# source ~/.bashrc
