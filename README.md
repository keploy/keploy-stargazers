# Keploy Stargazers

This repository contains a tool to fetch and track GitHub stargazers for Keploy repositories.

## Features

- **Automatic Daily Updates**: Uses GitHub Actions to fetch the latest stargazers every 24 hours
- **Structured Data Storage**: Saves stargazer information in both JSON and CSV formats
- **Enriched User Information**: Includes additional user details such as email, company, location, and social media profiles
- **Rate Limit Handling**: Implements delays and retries to handle GitHub API rate limits
- **Manual and Automated Workflows**: Supports both browser-based manual fetching and automated GitHub Actions workflows

## Automated Workflow

A GitHub Actions workflow (`fetch-stargazers.yml`) runs automatically every day at midnight UTC to:

1. Fetch all stargazers for the Keploy repository
2. Enrich the data with user details
3. Save the data in both JSON and CSV formats in the `data/` directory
4. Commit and push the changes to the repository

## Files

- **Web Interface**: `index.html`, `style.css`, and `script.js` provide a browser-based interface for manually fetching stargazers
- **Automated Script**: `fetch-stargazers.js` is a Node.js script that can be run automatically by GitHub Actions
- **GitHub Actions Workflow**: `.github/workflows/fetch-stargazers.yml` defines the automated workflow

## Data Output

The automated workflow generates and updates two files:

- `data/stargazers.json`: A JSON file containing detailed information about all stargazers
- `data/stargazers.csv`: A CSV file that can be easily imported into spreadsheet applications

## Manual Triggering

You can manually trigger the workflow in two ways:

1. **Via GitHub Actions**: Go to the Actions tab in the repository, select the "Fetch GitHub Stargazers" workflow, and click "Run workflow"
2. **Via Web Interface**: Open `index.html` in a browser, enter your GitHub token, and click "Fetch Stargazers"

## Configuration

To fetch stargazers for a different repository, you can modify the `GITHUB_REPOSITORY` environment variable in the GitHub Actions workflow.

## Requirements

- GitHub Personal Access Token with `repo` scope (for API access)
- Node.js (for running the script locally)

## License

MIT 