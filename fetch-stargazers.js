const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');

const GITHUB_API_URL = "https://api.github.com";
const BATCH_SIZE = 50;
const DELAY_BETWEEN_REQUESTS = 2000;
const REPO_PATH = process.env.GITHUB_REPOSITORY || "keploy/keploy"; // Default to keploy/keploy if not specified
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OUTPUT_FILE = path.join('data', 'stargazers.json');
const OUTPUT_CSV = path.join('data', 'stargazers.csv');

async function main() {
  console.log(`Starting to fetch stargazers for ${REPO_PATH}`);
  
  if (!GITHUB_TOKEN) {
    throw new Error("GitHub token is required. Set the GITHUB_TOKEN environment variable.");
  }

  try {
    // Create data directory if it doesn't exist
    await fs.mkdir('data', { recursive: true });
    
    // Fetch all stargazers
    const stargazers = await fetchAllStargazers(REPO_PATH, GITHUB_TOKEN);
    console.log(`Retrieved ${stargazers.length} stargazers`);
    
    // Enrich stargazer data with user details
    const enrichedStargazers = await enrichStargazersInBatches(stargazers, GITHUB_TOKEN);
    console.log(`Enriched data for ${enrichedStargazers.length} stargazers`);
    
    // Save data to JSON file
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(enrichedStargazers, null, 2));
    console.log(`Saved stargazer data to ${OUTPUT_FILE}`);
    
    // Generate and save CSV
    const csvData = generateCSV(enrichedStargazers);
    await fs.writeFile(OUTPUT_CSV, csvData);
    console.log(`Saved stargazer data to ${OUTPUT_CSV}`);
    
  } catch (error) {
    console.error("Error in stargazer fetch process:", error);
    process.exit(1);
  }
}

async function fetchAllStargazers(repoPath, githubToken) {
  let stargazers = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    console.log(`Fetching stargazers page ${page}`);
    const response = await fetch(`${GITHUB_API_URL}/repos/${repoPath}/stargazers?page=${page}&per_page=100`, {
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: "application/vnd.github.v3.star+json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch stargazers: ${response.statusText} (${response.status})`);
    }

    const data = await response.json();
    stargazers = stargazers.concat(data);
    hasMore = data.length === 100;
    page++;
    
    if (hasMore) {
      // Add a delay to avoid hitting rate limits
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
    }
  }

  return stargazers;
}

async function enrichStargazersInBatches(stargazers, githubToken) {
  const enrichedStargazers = [];

  for (let i = 0; i < stargazers.length; i += BATCH_SIZE) {
    console.log(`Enriching batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(stargazers.length / BATCH_SIZE)}`);
    const batch = stargazers.slice(i, i + BATCH_SIZE);
    const enrichedBatch = await Promise.all(
      batch.map(async (stargazer) => {
        const userDetails = await fetchUserDetailsWithRetry(stargazer.user.login, githubToken);
        return {
          username: stargazer.user.login,
          profile_url: stargazer.user.html_url,
          email: userDetails.email || "N/A",
          company: userDetails.company || "N/A",
          location: userDetails.location || "N/A",
          website: userDetails.blog || "N/A",
          linkedin: extractLinkedIn(userDetails),
          twitter: userDetails.twitter_username ? `https://twitter.com/${userDetails.twitter_username}` : "N/A",
          bio: userDetails.bio || "N/A",
          starred_at: stargazer.starred_at
        };
      })
    );

    enrichedStargazers.push(...enrichedBatch);
    
    if (i + BATCH_SIZE < stargazers.length) {
      // Add a delay to avoid hitting rate limits
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
    }
  }

  return enrichedStargazers;
}

function extractLinkedIn(userDetails) {
  if (userDetails.blog && userDetails.blog.includes("linkedin.com")) {
    return userDetails.blog;
  }
  return "N/A";
}

async function fetchUserDetailsWithRetry(username, githubToken, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${GITHUB_API_URL}/users/${username}`, {
        headers: { Authorization: `token ${githubToken}` },
      });

      if (!response.ok) {
        if (response.status === 403) {
          console.log(`Rate limit hit for ${username}, waiting 60 seconds...`);
          await new Promise((resolve) => setTimeout(resolve, 60000));
          continue;
        }
        throw new Error(`Failed to fetch user details for ${username}: ${response.statusText} (${response.status})`);
      }

      return response.json();
    } catch (error) {
      console.error(`Attempt ${attempt} failed for ${username}:`, error);
      if (attempt === retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
    }
  }
}

function generateCSV(stargazers) {
  const headers = ["Username", "GitHub URL", "Email", "Company", "Location", "Website", "LinkedIn", "Twitter", "Bio", "Starred At"];
  const rows = stargazers.map(stargazer => [
    stargazer.username,
    stargazer.profile_url,
    stargazer.email,
    stargazer.company,
    stargazer.location,
    stargazer.website,
    stargazer.linkedin,
    stargazer.twitter,
    stargazer.bio,
    stargazer.starred_at
  ]);

  const csvContent = [headers.join(","), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");
  return csvContent;
}

// Run the main function
main().catch(error => {
  console.error("Unhandled error:", error);
  process.exit(1);
}); 