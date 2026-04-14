# Campus Compass

Campus Compass is a full-stack student management portal demonstrating a complete DevOps lifecycle. It includes a Node.js backend, a vanilla JavaScript frontend, and a comprehensive infrastructure setup on AWS using Terraform, Ansible, Docker, and Kubernetes (K3s) for orchestration, with CI/CD automated by GitHub Actions and monitoring provided by Prometheus and Grafana.

## Features

-   **Manual Student Entry**: Add individual students through a simple form.
-   **Bulk CSV Upload**: Import a list of students from a CSV file.
-   **Dynamic Search**: Instantly find students by name.
-   **Live Statistics**: View real-time counts of total students and search results.
-   **System Monitoring**: A dedicated Grafana dashboard visualizes application performance metrics.

## Technology Stack

-   **Backend**: Node.js, Express.js
-   **Frontend**: HTML5, CSS3, Vanilla JavaScript
-   **Containerization**: Docker
-   **Orchestration**: K3s (Lightweight Kubernetes)
-   **Infrastructure as Code**: Terraform
-   **Configuration Management**: Ansible
-   **CI/CD**: GitHub Actions
-   **Monitoring**: Prometheus, Grafana
-   **Security**: SonarCloud (SaaS)

## Architecture Overview

The project is structured to demonstrate a modern DevOps workflow:

1.  **`aws_infra/` (Terraform)**: Provisions the core infrastructure on AWS, including an EC2 `t3.small` instance, a security group with necessary ports (SSH, App, K3s, Grafana), and an SSH key pair.

2.  **`ansible/`**: Contains an Ansible playbook that configures the provisioned EC2 instance. It installs Docker, K3s, and other dependencies, then copies the application source code to the server.

3.  **`backend/`**: The Node.js application serves a static frontend and provides a REST API for student management. It is instrumented with `prom-client` to expose an `/metrics` endpoint for Prometheus.

4.  **`k8s/`**: Kubernetes manifests define the application's runtime environment.
    -   `deployment.yaml`: Deploys the Campus Compass application container.
    -   `service.yaml`: Exposes the application via a NodePort.
    -   `prometheus.yaml`: Deploys a Prometheus instance configured to scrape metrics from the application.
    -   `grafana.yaml`: Deploys Grafana with Prometheus pre-configured as a data source and includes a custom dashboard for application monitoring.

5.  **`.github/workflows/`**: GitHub Actions workflows automate the CI/CD process.
    -   `deploy.yml`: Triggers on a push to the `main` branch. It first runs a **SonarCloud Scan** for security analysis, then syncs files to the EC2 instance, builds the Docker image on the remote server, imports it into K3s, and applies the Kubernetes manifests to deploy the latest version.

## Deployment Guide

You can deploy the application manually using Terraform and Ansible or automatically via the CI/CD pipeline.

### Prerequisites

-   AWS Account and configured credentials.
-   Terraform CLI installed.
-   Ansible installed.
-   An SSH key pair.

### Manual Deployment

1.  **Generate an SSH Key**

    ```sh
    ssh-keygen -t rsa -b 4096 -f ~/.ssh/campus_compass_key
    ```
    Ensure the public key `~/.ssh/campus_compass_key.pub` is accessible.

2.  **Provision Infrastructure with Terraform**

    Navigate to the `aws_infra` directory and run:

    ```sh
    cd aws_infra
    terraform init
    terraform apply -auto-approve
    ```
    Take note of the `instance_public_ip` output.

3.  **Configure and Run Ansible**

    Update `ansible/inventory.ini` with the public IP of your new EC2 instance:
    ```ini
    [ec2]
    <YOUR_EC2_IP_HERE> ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/campus_compass_key ansible_ssh_common_args='-o StrictHostKeyChecking=no'
    ```
    Run the Ansible playbook from the root directory:
    ```sh
    ansible-playbook -i ansible/inventory.ini ansible/playbook.yml
    ```
    This will set up the server, build the Docker image, and deploy all services using K3s.

### Automated Deployment (CI/CD)

1.  **Fork the Repository** and clone it.

2.  **Provision Infrastructure**: Follow Step 2 from the manual deployment to create the EC2 instance with Terraform.

3.  **Configure GitHub Secrets**: In your forked repository, go to `Settings > Secrets and variables > Actions` and add the following repository secrets:
    -   `EC2_HOST`: The public IP address of your EC2 instance.
    -   `EC2_SSH_KEY`: The private key content from `~/.ssh/campus_compass_key`.
    -   `SONAR_TOKEN`: The analysis token generated from your SonarCloud account.

4.  **Trigger Deployment**: Push a commit to the `main` branch. The `deploy.yml` workflow will automatically run, deploying the application to your server.

### Accessing the Services

Once deployed, the services are available at the following endpoints:

-   **Campus Compass App**: `http://<YOUR_EC2_IP>:30009`
-   **Grafana Dashboard**: `http://<YOUR_EC2_IP>:3000`
-   **Prometheus UI**: `http://<YOUR_EC2_IP>:30090`

## Local Development

You can run the application locally for development and testing.

### Running the Node.js Server

1.  Navigate to the backend directory:
    ```sh
    cd backend
    ```
2.  Install dependencies:
    ```sh
    npm install
    ```
3.  Start the server:
    ```sh
    npm start
    ```
4.  Access the application at `http://localhost:9000`.

### Running with Docker

You can also build and run the application using the root Dockerfile:

```sh
docker build -t campus-compass .
docker run -p 9000:9000 campus-compass
```

## License

This project is licensed under the Business Source License 1.1. See the [LICENSE.txt](LICENSE.txt) file for details.


<!-- Triggering CI/CD pipeline to verify SonarCloud integration -->
